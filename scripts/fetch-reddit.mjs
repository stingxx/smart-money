// scripts/fetch-reddit.mjs
// Fetches hot posts from finance subreddits via Reddit's RSS feeds.
// RSS works reliably from CI environments where JSON endpoints get blocked
// by Reddit's anti-bot detection.

import { XMLParser } from 'fast-xml-parser';
import { REDDIT_SUBS, TICKER_BLACKLIST, VALID_TICKER_REGEX } from '../src/data/sources.js';

const USER_AGENT =
  'Mozilla/5.0 (compatible; SmartMoneyTracker/1.0; +https://github.com/stingxx/smart-money)';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function pickArr(v) { return v ? (Array.isArray(v) ? v : [v]) : []; }

function stripHtml(s) {
  if (!s) return '';
  return String(s)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    // Numeric entities (decimal): &#8217; → ’
    .replace(/&#(\d+);/g, (_, n) => {
      const code = parseInt(n, 10);
      return code > 0 && code < 0x10000 ? String.fromCharCode(code) : '';
    })
    // Numeric entities (hex): &#x2019; → ’
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => {
      const code = parseInt(n, 16);
      return code > 0 && code < 0x10000 ? String.fromCharCode(code) : '';
    })
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    // Drop any remaining named entities we don't recognize
    .replace(/&[a-zA-Z]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTickers(text) {
  if (!text) return [];
  const found = new Set();
  for (const m of text.matchAll(VALID_TICKER_REGEX)) {
    const t = m[1];
    if (t.length < 2 || t.length > 5) continue;
    if (TICKER_BLACKLIST.has(t)) continue;
    found.add(t);
  }
  return [...found];
}

async function fetchSubRSS(name) {
  const urls = [
    `https://old.reddit.com/r/${name}/hot/.rss?limit=25`,
    `https://www.reddit.com/r/${name}/hot/.rss?limit=25`,
  ];

  for (const url of urls) {
    try {
      const r = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/atom+xml, application/rss+xml, application/xml, */*',
        },
      });
      if (r.ok) return await r.text();
      console.warn(`[reddit] ${url} → ${r.status}`);
    } catch (e) {
      console.warn(`[reddit] ${url} threw: ${e.message}`);
    }
  }
  return null;
}

function parseRedditAtom(xml, subName) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    parseTagValue: true,
    // Critical: bypass fast-xml-parser's 1000-entity expansion limit.
    // Reddit RSS contains many &amp; entities that trip this guard.
    // We decode entities ourselves in stripHtml() instead.
    processEntities: false,
  });
  const tree = parser.parse(xml);
  const entries = pickArr(tree.feed?.entry);

  return entries.map((e) => {
    const links = pickArr(e.link);
    const link = links.find((l) => l['@_rel'] !== 'self') || links[0];
    const title = stripHtml(e.title?.['#text'] || e.title);
    const content = stripHtml(e.content?.['#text'] || e.content || '');
    const idStr = String(e.id || '');
    const idMatch = idStr.match(/comments\/([a-z0-9]+)/);
    const postId = idMatch ? idMatch[1] : idStr.slice(-12);

    return {
      id: postId,
      title,
      subreddit: subName,
      author: e.author?.name || '[unknown]',
      score: 0,
      num_comments: 0,
      created: e.updated || e.published || null,
      url: link?.['@_href'] || '',
      tickers: extractTickers(`${title} ${content}`),
    };
  });
}

export async function fetchRedditData() {
  console.log(`[reddit] Fetching ${REDDIT_SUBS.length} subs via RSS`);
  const allPosts = [];
  const tickerCounts = new Map();

  for (const sub of REDDIT_SUBS) {
    const xml = await fetchSubRSS(sub.name);
    if (!xml) {
      console.warn(`[reddit] r/${sub.name}: all URLs failed`);
      await sleep(1200);
      continue;
    }

    try {
      const posts = parseRedditAtom(xml, sub.name);
      console.log(`[reddit] r/${sub.name}: ${posts.length} posts`);

      for (const p of posts) {
        if (!p.title || !p.url) continue;
        allPosts.push(p);
        for (const t of p.tickers) {
          if (!tickerCounts.has(t)) {
            tickerCounts.set(t, { ticker: t, mentions: 0, subreddits: new Set() });
          }
          const entry = tickerCounts.get(t);
          entry.mentions += 1;
          entry.subreddits.add(p.subreddit);
        }
      }
    } catch (e) {
      console.warn(`[reddit] r/${sub.name} parse failed: ${e.message}`);
    }

    await sleep(1500);
  }

  const topPosts = allPosts
    .sort((a, b) => {
      const ta = a.created ? Date.parse(a.created) : 0;
      const tb = b.created ? Date.parse(b.created) : 0;
      return tb - ta;
    })
    .slice(0, 30);

  const topTickers = [...tickerCounts.values()]
    .map((t) => ({ ...t, subreddits: [...t.subreddits] }))
    .sort((a, b) => b.mentions - a.mentions)
    .slice(0, 20);

  console.log(`[reddit] Total: ${allPosts.length} posts, ${topTickers.length} tickers`);
  return { posts: topPosts, tickers: topTickers };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  fetchRedditData()
    .then((r) => console.log(JSON.stringify(r, null, 2)))
    .catch((e) => { console.error(e); process.exit(1); });
}
