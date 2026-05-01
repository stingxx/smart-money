// scripts/fetch-blogs.mjs
// Fetches the latest posts from each tracked blogger's RSS feed.
// No authentication required.

import { XMLParser } from 'fast-xml-parser';
import { BLOGGERS } from '../src/data/sources.js';

const USER_AGENT = 'SmartMoneyTracker/1.0';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function stripHtml(s) {
  if (!s) return '';
  return String(s)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function pickArr(maybe) {
  if (!maybe) return [];
  return Array.isArray(maybe) ? maybe : [maybe];
}

// Normalize entries from either RSS 2.0 or Atom feeds.
function parseFeed(xml, blogger) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    parseTagValue: true,
    trimValues: true,
  });
  const tree = parser.parse(xml);

  // RSS 2.0
  if (tree.rss?.channel) {
    return pickArr(tree.rss.channel.item).map((it) => ({
      id: `${blogger.id}-${it.guid?.['#text'] || it.guid || it.link}`,
      title: stripHtml(it.title),
      link: typeof it.link === 'string' ? it.link : it.link?.['@_href'] || '',
      publishedAt: it.pubDate ? new Date(it.pubDate).toISOString() : null,
      snippet: stripHtml(it.description || it['content:encoded'] || '').slice(0, 220),
      author: blogger.name,
      handle: blogger.handle,
      tag: blogger.tag,
    }));
  }

  // Atom
  if (tree.feed?.entry) {
    return pickArr(tree.feed.entry).map((it) => {
      const link = pickArr(it.link).find((l) => l['@_rel'] !== 'self') || pickArr(it.link)[0];
      return {
        id: `${blogger.id}-${it.id || link?.['@_href']}`,
        title: stripHtml(it.title?.['#text'] || it.title),
        link: link?.['@_href'] || '',
        publishedAt: it.published || it.updated || null,
        snippet: stripHtml(it.summary?.['#text'] || it.summary || it.content?.['#text'] || it.content || '').slice(0, 220),
        author: blogger.name,
        handle: blogger.handle,
        tag: blogger.tag,
      };
    });
  }

  return [];
}

async function fetchBlogger(blogger) {
  try {
    const r = await fetch(blogger.feed, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
      },
    });
    if (!r.ok) {
      console.warn(`[blogs] ${blogger.name}: ${r.status}`);
      return [];
    }
    const xml = await r.text();
    const entries = parseFeed(xml, blogger).filter((e) => e.title && e.link);
    // Take 3 most recent per blogger
    return entries.slice(0, 3);
  } catch (e) {
    console.warn(`[blogs] ${blogger.name} failed: ${e.message}`);
    return [];
  }
}

export async function fetchBlogData() {
  console.log(`[blogs] Fetching ${BLOGGERS.length} feeds`);
  const all = [];
  for (const b of BLOGGERS) {
    const entries = await fetchBlogger(b);
    all.push(...entries);
    await sleep(300);
  }
  // Sort all entries by date, newest first
  all.sort((a, b) => {
    const ta = a.publishedAt ? Date.parse(a.publishedAt) : 0;
    const tb = b.publishedAt ? Date.parse(b.publishedAt) : 0;
    return tb - ta;
  });
  console.log(`[blogs] Got ${all.length} posts total`);
  return all;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  fetchBlogData()
    .then((r) => console.log(JSON.stringify(r, null, 2)))
    .catch((e) => { console.error(e); process.exit(1); });
}
