// scripts/fetch-13f.mjs
// Pulls the most recent 13F-HR filing for each tracked investor from SEC EDGAR
// and parses the holdings out of informationtable.xml.
//
// SEC requires a User-Agent header identifying you. Set via env var SEC_USER_AGENT
// or it defaults to a generic identifier.

import { XMLParser } from 'fast-xml-parser';
import { INVESTORS } from '../src/data/investors.js';

const USER_AGENT =
  process.env.SEC_USER_AGENT ||
  'SmartMoneyTracker github.com/stingxx';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function secFetch(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json,text/xml,*/*',
    },
  });
  if (!res.ok) {
    throw new Error(`SEC ${res.status} on ${url}`);
  }
  return res;
}

// Get list of recent filings for a CIK, return the most recent 13F-HR accession.
async function findLatest13F(cik) {
  const padded = cik.padStart(10, '0');
  const url = `https://data.sec.gov/submissions/CIK${padded}.json`;
  const r = await secFetch(url);
  const data = await r.json();
  const recent = data.filings?.recent;
  if (!recent) return null;

  for (let i = 0; i < recent.form.length; i++) {
    if (recent.form[i] === '13F-HR') {
      return {
        accession: recent.accessionNumber[i].replace(/-/g, ''),
        filingDate: recent.filingDate[i],
        reportDate: recent.reportDate[i] || null,
        primaryDocument: recent.primaryDocument[i],
      };
    }
  }
  return null;
}

// Find the information table XML file within a filing folder.
async function findInfoTableUrl(cik, accession) {
  const cikInt = parseInt(cik, 10);
  const indexUrl = `https://www.sec.gov/Archives/edgar/data/${cikInt}/${accession}/index.json`;
  const r = await secFetch(indexUrl);
  const data = await r.json();
  const items = data.directory?.item || [];

  // The holdings file is usually named something with "informationtable"
  // (case-insensitive) or "infotable", and has .xml extension.
  let candidate = items.find(
    (it) =>
      it.name.toLowerCase().endsWith('.xml') &&
      (it.name.toLowerCase().includes('informationtable') ||
        it.name.toLowerCase().includes('infotable'))
  );

  // Fallback: any XML that's not primary_doc.xml
  if (!candidate) {
    candidate = items.find(
      (it) =>
        it.name.toLowerCase().endsWith('.xml') &&
        !it.name.toLowerCase().includes('primary')
    );
  }
  if (!candidate) return null;

  return `https://www.sec.gov/Archives/edgar/data/${cikInt}/${accession}/${candidate.name}`;
}

function pickArray(maybe) {
  if (!maybe) return [];
  return Array.isArray(maybe) ? maybe : [maybe];
}

async function parseInfoTable(url) {
  const r = await secFetch(url);
  const xml = await r.text();
  const parser = new XMLParser({
    ignoreAttributes: false,
    removeNSPrefix: true,
    parseTagValue: true,
  });
  const tree = parser.parse(xml);
  const root = tree.informationTable || tree;
  const rows = pickArray(root.infoTable);

  return rows.map((row) => ({
    name: String(row.nameOfIssuer || '').trim(),
    titleOfClass: String(row.titleOfClass || '').trim(),
    cusip: String(row.cusip || '').trim(),
    value: Number(row.value) || 0, // in thousands of USD per SEC convention
    shares: Number(row.shrsOrPrnAmt?.sshPrnamt) || 0,
    sshType: String(row.shrsOrPrnAmt?.sshPrnamtType || '').trim(),
  }));
}

function formatCurrency(usd) {
  if (usd >= 1e9) return `$${(usd / 1e9).toFixed(1)}B`;
  if (usd >= 1e6) return `$${(usd / 1e6).toFixed(0)}M`;
  if (usd >= 1e3) return `$${(usd / 1e3).toFixed(0)}K`;
  return `$${usd.toFixed(0)}`;
}

// Try to recover ticker symbols. SEC 13Fs only give CUSIPs, so for now
// we just use a heuristic mapping for the most common holdings.
// Production implementations use a CUSIP-to-ticker service (paid).
function extractTickerHint(name) {
  const upper = name.toUpperCase();
  // Quick heuristic — match common name patterns to tickers.
  // Not exhaustive; the company name will display anyway.
  const map = {
    'APPLE INC': 'AAPL',
    'MICROSOFT CORP': 'MSFT',
    'AMAZON COM INC': 'AMZN',
    'ALPHABET INC': 'GOOGL',
    'META PLATFORMS': 'META',
    'NVIDIA CORP': 'NVDA',
    'TESLA INC': 'TSLA',
    'BERKSHIRE HATHAWAY': 'BRK.B',
    'COCA COLA CO': 'KO',
    'AMERICAN EXPRESS': 'AXP',
    'BANK AMER CORP': 'BAC',
    'BANK OF AMERICA': 'BAC',
    'CHEVRON CORP': 'CVX',
    'OCCIDENTAL PETROLEUM': 'OXY',
    'KRAFT HEINZ': 'KHC',
    'MOODYS CORP': 'MCO',
    'CITIGROUP INC': 'C',
    'WELLS FARGO': 'WFC',
    'JPMORGAN CHASE': 'JPM',
    'GOLDMAN SACHS': 'GS',
    'CHIPOTLE MEXICAN': 'CMG',
    'HILTON WORLDWIDE': 'HLT',
    'UNIVERSAL MUSIC': 'UMG',
    'ALPHABET INC CL C': 'GOOG',
    'LIBERTY MEDIA': 'LSXMK',
    'NIKE INC': 'NKE',
    'ALLY FINANCIAL': 'ALLY',
    'WALT DISNEY': 'DIS',
    'PINTEREST INC': 'PINS',
    'COINBASE GLOBAL': 'COIN',
    'PALANTIR TECH': 'PLTR',
    'ROKU INC': 'ROKU',
    'GREEN BRICK': 'GRBK',
    'CNH INDUSTRIAL': 'CNH',
    'HP INC': 'HPQ',
    'EAST WEST BANCORP': 'EWBC',
    'MICRON TECH': 'MU',
    'WARRIOR MET COAL': 'HCC',
    'SOUTHWEST GAS': 'SWX',
    'CVR ENERGY': 'CVI',
  };
  for (const [k, v] of Object.entries(map)) {
    if (upper.includes(k)) return v;
  }
  // Fallback: first word abbreviation, capped at 5 chars
  const firstWord = upper.split(/\s+/)[0].replace(/[^A-Z]/g, '');
  return firstWord.slice(0, 5) || '—';
}

// For one investor, build the holdings payload.
async function buildHoldingsForInvestor(inv) {
  if (!inv.cik) return null;
  console.log(`  → ${inv.name}`);

  try {
    const meta = await findLatest13F(inv.cik);
    if (!meta) {
      console.log(`     no 13F-HR found`);
      return null;
    }

    await sleep(120); // be polite to SEC
    const xmlUrl = await findInfoTableUrl(inv.cik, meta.accession);
    if (!xmlUrl) {
      console.log(`     no info table xml`);
      return null;
    }

    await sleep(120);
    const rows = await parseInfoTable(xmlUrl);

    // Aggregate by issuer (multiple share classes → combine value)
    const grouped = new Map();
    for (const r of rows) {
      const key = r.name + '|' + r.titleOfClass;
      const existing = grouped.get(key);
      if (existing) {
        existing.value += r.value;
        existing.shares += r.shares;
      } else {
        grouped.set(key, { ...r });
      }
    }

    const sorted = [...grouped.values()].sort((a, b) => b.value - a.value);
    const totalValueK = sorted.reduce((s, r) => s + r.value, 0);
    const totalValueUsd = totalValueK * 1000;

    const topHoldings = sorted.slice(0, 10).map((r) => ({
      ticker: extractTickerHint(r.name),
      company: toTitleCase(r.name),
      weight: totalValueK > 0 ? +((r.value / totalValueK) * 100).toFixed(2) : 0,
      value: formatCurrency(r.value * 1000),
      shares: r.shares,
    }));

    return {
      asOfDate: meta.reportDate,
      filingDate: meta.filingDate,
      totalValue: formatCurrency(totalValueUsd),
      totalPositions: sorted.length,
      topHoldings,
      recentMoves: [], // SEC doesn't tell us this directly; would need quarter-over-quarter diff
      summary: `${sorted.length} positions totaling ${formatCurrency(totalValueUsd)} as of ${meta.reportDate}.`,
      sourceUrl: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${inv.cik}&type=13F`,
      fetchedAt: new Date().toISOString(),
    };
  } catch (e) {
    console.warn(`     ERROR: ${e.message}`);
    return null;
  }
}

function toTitleCase(s) {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w.length === 0 ? '' : w[0].toUpperCase() + w.slice(1)))
    .join(' ');
}

export async function fetchAll13F() {
  console.log(`[13F] Fetching for ${INVESTORS.length} investors`);
  const result = {};
  for (const inv of INVESTORS) {
    const data = await buildHoldingsForInvestor(inv);
    if (data) result[inv.id] = data;
    await sleep(200);
  }
  console.log(`[13F] Done — ${Object.keys(result).length}/${INVESTORS.length} successful`);
  return result;
}

// Run standalone
if (import.meta.url === `file://${process.argv[1]}`) {
  fetchAll13F()
    .then((r) => console.log(JSON.stringify(r, null, 2)))
    .catch((e) => { console.error(e); process.exit(1); });
}
