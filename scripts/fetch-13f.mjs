// scripts/fetch-13f.mjs
// Pulls the most recent 13F-HR filing for each tracked investor from SEC EDGAR.
//
// SEC requires User-Agent in the format "<Name> <Email>". Without an
// email-looking string they return 403 Forbidden. We hardcode this rather
// than reading from env so it can't be accidentally overridden.

import { XMLParser } from 'fast-xml-parser';
import { INVESTORS } from '../src/data/investors.js';

// Format SEC mandates: must contain something email-shaped.
// Using GitHub's no-reply alias which is a real deliverable address tied to your account.
const USER_AGENT = 'SmartMoneyTracker stingxx@users.noreply.github.com';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function secFetch(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json,text/xml,*/*',
      'Accept-Encoding': 'gzip, deflate',
      Host: new URL(url).host,
    },
  });
  if (!res.ok) {
    throw new Error(`SEC ${res.status} ${res.statusText} on ${url}`);
  }
  return res;
}

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
      };
    }
  }
  return null;
}

async function findInfoTableUrl(cik, accession) {
  const cikInt = parseInt(cik, 10);
  const indexUrl = `https://www.sec.gov/Archives/edgar/data/${cikInt}/${accession}/index.json`;
  const r = await secFetch(indexUrl);
  const data = await r.json();
  const items = data.directory?.item || [];
  let candidate = items.find(
    (it) =>
      it.name.toLowerCase().endsWith('.xml') &&
      (it.name.toLowerCase().includes('informationtable') ||
        it.name.toLowerCase().includes('infotable'))
  );
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
    processEntities: false,
  });
  const tree = parser.parse(xml);
  const root = tree.informationTable || tree;
  const rows = pickArray(root.infoTable);
  return rows.map((row) => ({
    name: String(row.nameOfIssuer || '').trim(),
    titleOfClass: String(row.titleOfClass || '').trim(),
    cusip: String(row.cusip || '').trim(),
    value: Number(row.value) || 0,
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

function extractTickerHint(name) {
  const upper = name.toUpperCase();
  const map = {
    'APPLE INC': 'AAPL', 'MICROSOFT CORP': 'MSFT', 'AMAZON COM INC': 'AMZN',
    'ALPHABET INC CL A': 'GOOGL', 'ALPHABET INC CL C': 'GOOG', 'ALPHABET INC': 'GOOGL',
    'META PLATFORMS': 'META', 'NVIDIA CORP': 'NVDA', 'TESLA INC': 'TSLA',
    'BERKSHIRE HATHAWAY': 'BRK.B', 'COCA COLA CO': 'KO', 'AMERICAN EXPRESS': 'AXP',
    'BANK AMER CORP': 'BAC', 'BANK OF AMERICA': 'BAC', 'CHEVRON CORP': 'CVX',
    'OCCIDENTAL PETROLEUM': 'OXY', 'KRAFT HEINZ': 'KHC', 'MOODYS CORP': 'MCO',
    'CITIGROUP INC': 'C', 'WELLS FARGO': 'WFC', 'JPMORGAN CHASE': 'JPM',
    'GOLDMAN SACHS': 'GS', 'CHIPOTLE MEXICAN': 'CMG', 'HILTON WORLDWIDE': 'HLT',
    'UNIVERSAL MUSIC': 'UMG', 'NIKE INC': 'NKE', 'ALLY FINANCIAL': 'ALLY',
    'WALT DISNEY': 'DIS', 'PINTEREST INC': 'PINS', 'COINBASE GLOBAL': 'COIN',
    'PALANTIR TECH': 'PLTR', 'ROKU INC': 'ROKU', 'GREEN BRICK': 'GRBK',
    'CNH INDUSTRIAL': 'CNH', 'HP INC': 'HPQ', 'EAST WEST BANCORP': 'EWBC',
    'MICRON TECH': 'MU', 'WARRIOR MET COAL': 'HCC', 'SOUTHWEST GAS': 'SWX',
    'CVR ENERGY': 'CVI', 'BROOKFIELD CORP': 'BN', 'BYD CO LTD': 'BYDDY',
    'LIBERTY MEDIA': 'LSXMK', 'GARRETT MOTION': 'GTX', 'WILLIS TOWERS': 'WTW',
    'LIBERTY GLOBAL': 'LBTYK', 'ROBINHOOD MARKETS': 'HOOD', 'PFIZER INC': 'PFE',
  };
  for (const [k, v] of Object.entries(map)) {
    if (upper.includes(k)) return v;
  }
  const firstWord = upper.split(/\s+/)[0].replace(/[^A-Z]/g, '');
  return firstWord.slice(0, 5) || '—';
}

function toTitleCase(s) {
  return s.toLowerCase().split(/\s+/)
    .map((w) => (w.length === 0 ? '' : w[0].toUpperCase() + w.slice(1)))
    .join(' ');
}

async function buildHoldingsForInvestor(inv) {
  if (!inv.cik) return null;
  console.log(`[13F] → ${inv.name} (CIK ${inv.cik})`);

  try {
    const meta = await findLatest13F(inv.cik);
    if (!meta) {
      console.log(`[13F]   no 13F-HR found for ${inv.name}`);
      return null;
    }
    console.log(`[13F]   filing ${meta.accession} (${meta.filingDate})`);

    await sleep(150);
    const xmlUrl = await findInfoTableUrl(inv.cik, meta.accession);
    if (!xmlUrl) {
      console.log(`[13F]   no info table for ${inv.name}`);
      return null;
    }

    await sleep(150);
    const rows = await parseInfoTable(xmlUrl);

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

    console.log(`[13F]   ✓ ${inv.name}: ${sorted.length} positions, ${formatCurrency(totalValueUsd)}`);

    return {
      asOfDate: meta.reportDate,
      filingDate: meta.filingDate,
      totalValue: formatCurrency(totalValueUsd),
      totalPositions: sorted.length,
      topHoldings,
      recentMoves: [],
      summary: `${sorted.length} positions totaling ${formatCurrency(totalValueUsd)} as of ${meta.reportDate}.`,
      sourceUrl: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${inv.cik}&type=13F`,
      fetchedAt: new Date().toISOString(),
    };
  } catch (e) {
    console.error(`[13F]   ✗ ${inv.name}: ${e.message}`);
    return null;
  }
}

export async function fetchAll13F() {
  console.log(`[13F] Fetching for ${INVESTORS.length} investors`);
  console.log(`[13F] Using User-Agent: ${USER_AGENT}`);
  const result = {};
  for (const inv of INVESTORS) {
    const data = await buildHoldingsForInvestor(inv);
    if (data) result[inv.id] = data;
    await sleep(250);
  }
  console.log(`[13F] Done — ${Object.keys(result).length}/${INVESTORS.length} successful`);
  return result;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  fetchAll13F()
    .then((r) => console.log(JSON.stringify(r, null, 2)))
    .catch((e) => { console.error(e); process.exit(1); });
}
