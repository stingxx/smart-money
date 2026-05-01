// scripts/fetch-reddit.mjs
// Pulls hot posts from finance subreddits via their public .json endpoints.
// No authentication required — these endpoints are open to the public.
//
// Reddit asks for a descriptive User-Agent string.

import { REDDIT_SUBS, TICKER_BLACKLIST, VALID_TICKER_REGEX } from '../src/data/sources.js';

const USER_AGENT = 'SmartMoneyTracker/1.0 (github.com/stingxx)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchSub(name) {
  const url = `https://www.reddit.com/r/${name}/hot.json?limit=25`;
  const r = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!r.ok) {
    console.warn(`[reddit] ${name} returned ${r.status}`);
    return [];
  }
  const data = await r.json();
  return (data.data?.children || []).map((c) => c.data);
}

function extractTickers(text) {
  if (!text) return [];
  const found = new Set();
  for (const match of text.matchAll(VALID_TICKER_REGEX)) {
    const t = match[1];
    if (t.length < 2 || t.length > 5) continue;
    if (TICKER_BLACKLIST.has(t)) continue;
    found.add(t);
  }
  return [...found];
}

export async function fetchRedditData() {
  console.log(`[reddit] Fetching ${REDDIT_SUBS.length} subs`);
  const allPosts = [];
  const tickerCounts = new Map(); // ticker -> { mentions, subreddits:Set }

  for (const sub of REDDIT_SUBS) {
    try {
      const posts = await fetchSub(sub.name);
      for (const p of posts) {
        // Skip stickied/announcement posts
        if (p.stickied || p.pinned) continue;

        const combinedText = `${p.title || ''} ${p.selftext || ''}`;
        const tickers = extractTickers(combinedText);

        allPosts.push({
          id: p.id,
          title: p.title,
          subreddit: p.subreddit,
          author: p.author,
          score: p.score,
          num_comments: p.num_comments,
          created: new Date(p.created_utc * 1000).toISOString(),
          url: `https://www.reddit.com${p.permalink}`,
          tickers,
          flair: p.link_flair_text || null,
        });

        for (const t of tickers) {
          if (!tickerCounts.has(t)) {
            tickerCounts.set(t, { ticker: t, mentions: 0, subreddits: new Set() });
          }
          const entry = tickerCounts.get(t);
          entry.mentions += 1;
          entry.subreddits.add(p.subreddit);
        }
      }
      await sleep(800); // be polite, public endpoints rate-limit ~60/min
    } catch (e) {
      console.warn(`[reddit] ${sub.name} failed: ${e.message}`);
    }
  }

  // Sort posts by a "heat" score combining upvotes and comments
  const topPosts = allPosts
    .sort((a, b) => (b.score + b.num_comments * 2) - (a.score + a.num_comments * 2))
    .slice(0, 30);

  // Convert ticker counts to sorted array
  const topTickers = [...tickerCounts.values()]
    .map((t) => ({ ...t, subreddits: [...t.subreddits] }))
    .sort((a, b) => b.mentions - a.mentions)
    .slice(0, 20);

  console.log(`[reddit] Got ${allPosts.length} posts, ${topTickers.length} unique tickers`);
  return { posts: topPosts, tickers: topTickers };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  fetchRedditData()
    .then((r) => console.log(JSON.stringify(r, null, 2)))
    .catch((e) => { console.error(e); process.exit(1); });
}
