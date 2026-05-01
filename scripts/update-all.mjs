// scripts/update-all.mjs
// Master orchestrator. Runs all fetchers, writes a single aggregate.json
// that the website reads on load.

import { writeFile, mkdir } from 'fs/promises';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

import { fetchAll13F } from './fetch-13f.mjs';
import { fetchRedditData } from './fetch-reddit.mjs';
import { fetchBlogData } from './fetch-blogs.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(__dirname, '..', 'public', 'data', 'aggregate.json');

async function main() {
  const startedAt = Date.now();
  console.log(`\n=== Smart Money daily update ===`);
  console.log(`Started: ${new Date().toISOString()}\n`);

  const result = {
    lastUpdated: new Date().toISOString(),
    holdings: {},
    redditTickers: [],
    redditPosts: [],
    blogPosts: [],
    errors: [],
  };

  // Run each fetcher independently — one failure shouldn't kill the others
  try {
    result.holdings = await fetchAll13F();
  } catch (e) {
    console.error(`[13F] FATAL: ${e.message}`);
    result.errors.push({ source: '13f', message: e.message });
  }

  try {
    const reddit = await fetchRedditData();
    result.redditPosts = reddit.posts;
    result.redditTickers = reddit.tickers;
  } catch (e) {
    console.error(`[reddit] FATAL: ${e.message}`);
    result.errors.push({ source: 'reddit', message: e.message });
  }

  try {
    result.blogPosts = await fetchBlogData();
  } catch (e) {
    console.error(`[blogs] FATAL: ${e.message}`);
    result.errors.push({ source: 'blogs', message: e.message });
  }

  await mkdir(dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(result, null, 2), 'utf8');

  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`\n=== Update complete in ${seconds}s ===`);
  console.log(`  Holdings:      ${Object.keys(result.holdings).length} investors`);
  console.log(`  Reddit posts:  ${result.redditPosts.length}`);
  console.log(`  Top tickers:   ${result.redditTickers.length}`);
  console.log(`  Blog posts:    ${result.blogPosts.length}`);
  console.log(`  Errors:        ${result.errors.length}`);
  console.log(`  Output:        ${OUT_PATH}\n`);

  if (result.errors.length > 0) {
    console.log('Errors encountered:');
    for (const e of result.errors) {
      console.log(`  - ${e.source}: ${e.message}`);
    }
  }
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
