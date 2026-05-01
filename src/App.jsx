import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X, ExternalLink, ArrowUpRight, Loader2, AlertCircle,
  TrendingUp, TrendingDown, Plus, Minus, Circle, MessageSquare, BookOpen, Activity,
} from 'lucide-react';
import { INVESTORS, CATEGORIES } from './data/investors.js';
import { BLOGGERS, REDDIT_SUBS } from './data/sources.js';

// ────────────────────────────────────────────────────────────
// Theme tokens — kept here so they're easy to find and tweak
// ────────────────────────────────────────────────────────────
const THEME_CSS = `
  :root {
    --bg: #0d0f12;
    --surface: #15181d;
    --surface-2: #1c2026;
    --border: #2a2f37;
    --text: #e8e1d2;
    --text-muted: #87837a;
    --accent: #c89d4f;
    --accent-2: #d8b87a;
    --positive: #6b9a5f;
    --negative: #b8554a;
    --font-display: 'Instrument Serif', 'Times New Roman', serif;
    --font-body: 'DM Sans', -apple-system, sans-serif;
    --font-mono: 'JetBrains Mono', 'SF Mono', monospace;
  }
  body { background: var(--bg); margin: 0; font-family: var(--font-body); color: var(--text); }
  * { box-sizing: border-box; }
  a { color: inherit; }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes slideIn { from { transform: translateX(40px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
  @keyframes mastheadFade { from { opacity: 0; } to { opacity: 1; } }
  ::-webkit-scrollbar { width: 8px; height: 8px; }
  ::-webkit-scrollbar-track { background: var(--bg); }
  ::-webkit-scrollbar-thumb { background: var(--border); }
`;

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────
function formatRelativeTime(iso) {
  if (!iso) return '—';
  const now = Date.now();
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

async function fetchJSON(path, fallback) {
  try {
    const r = await fetch(path);
    if (!r.ok) throw new Error(`${path} → ${r.status}`);
    return await r.json();
  } catch (e) {
    console.warn('fetch failed', path, e);
    return fallback;
  }
}

// ────────────────────────────────────────────────────────────
// Section wrapper — editorial heading style
// ────────────────────────────────────────────────────────────
function SectionHeading({ kicker, title, count }) {
  return (
    <div className="section-heading">
      <div className="section-heading-row">
        <span className="kicker">{kicker}</span>
        {count !== undefined && <span className="count">{count}</span>}
      </div>
      <h2 className="section-title">{title}</h2>
      <div className="section-rule" />
      <style>{`
        .section-heading { padding: 64px 0 24px; }
        .section-heading-row { display:flex; justify-content:space-between; align-items:baseline; margin-bottom: 8px; }
        .kicker { font-family: var(--font-mono); color: var(--accent); font-size: 10px; letter-spacing: 0.25em; text-transform: uppercase; }
        .count { font-family: var(--font-mono); color: var(--text-muted); font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase; }
        .section-title { font-family: var(--font-display); font-size: clamp(36px, 5vw, 56px); margin: 0 0 16px; line-height: 1; color: var(--text); letter-spacing: -0.02em; }
        .section-rule { height:1px; background: var(--border); }
      `}</style>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Investor card
// ────────────────────────────────────────────────────────────
function InvestorCard({ investor, onClick, index, hasFreshHoldings }) {
  return (
    <article
      onClick={onClick}
      className="investor-card"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="ic-top">
        <div className="ic-avatar">{investor.initials}</div>
        <div className="ic-pill">{investor.category}</div>
      </div>
      <h3 className="ic-name">{investor.name}</h3>
      <p className="ic-fund">{investor.fund}</p>
      <p className="ic-bio">{investor.bio}</p>
      <div className="ic-bottom">
        <span>AUM · {investor.aum}</span>
        <span className="ic-cta">
          {hasFreshHoldings ? 'View latest' : 'View profile'}
          <ArrowUpRight size={12} />
        </span>
      </div>
      <style>{`
        .investor-card {
          cursor: pointer; padding: 28px; background: var(--surface);
          border: 1px solid var(--border); transition: all .25s ease;
          animation: fadeUp .7s ease-out backwards;
          position: relative; overflow: hidden;
        }
        .investor-card:hover { border-color: var(--accent); background: var(--surface-2); }
        .investor-card:hover .ic-cta { gap: 10px; }
        .ic-top { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 24px; }
        .ic-avatar {
          width: 56px; height: 56px; display:flex; align-items:center; justify-content:center;
          border: 1px solid var(--accent); color: var(--accent);
          font-family: var(--font-display); font-size: 20px; font-style: italic;
        }
        .ic-pill {
          font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.18em;
          text-transform: uppercase; color: var(--text-muted);
          padding: 4px 8px; border: 1px solid var(--border);
        }
        .ic-name { font-family: var(--font-display); font-size: 26px; line-height: 1.05; margin: 0 0 4px; color: var(--text); }
        .ic-fund { font-family: var(--font-display); font-style: italic; color: var(--accent); font-size: 14px; margin: 0 0 20px; }
        .ic-bio { font-size: 13px; line-height: 1.6; color: var(--text-muted); margin: 0 0 24px; }
        .ic-bottom {
          padding-top: 16px; border-top: 1px solid var(--border);
          display:flex; justify-content:space-between; align-items:center;
          font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.15em;
          text-transform: uppercase; color: var(--text-muted);
        }
        .ic-cta { display:flex; align-items:center; gap: 6px; transition: gap .2s ease; }
      `}</style>
    </article>
  );
}

// ────────────────────────────────────────────────────────────
// Detail drawer (right side panel)
// ────────────────────────────────────────────────────────────
function HoldingRow({ h, max }) {
  const pct = max > 0 ? (h.weight / max) * 100 : 0;
  return (
    <div className="holding-row">
      <span className="hr-tk">{h.ticker}</span>
      <div className="hr-co">
        <div className="hr-name">{h.company}</div>
        <div className="hr-bar"><div style={{ width: `${pct}%` }} /></div>
      </div>
      <span className="hr-val">{h.value || '—'}</span>
      <span className="hr-wt">{(h.weight || 0).toFixed(1)}%</span>
      <style>{`
        .holding-row {
          display:grid; grid-template-columns: 60px 1fr 90px 70px;
          align-items:center; gap: 16px; padding: 12px 0;
          border-bottom: 1px solid var(--border);
        }
        .hr-tk { font-family: var(--font-mono); color: var(--accent); font-size: 13px; letter-spacing: 0.05em; }
        .hr-co { min-width: 0; }
        .hr-name { font-size: 13px; color: var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .hr-bar { height: 1px; background: var(--border); margin-top: 6px; }
        .hr-bar > div { height: 1px; background: var(--accent); }
        .hr-val { font-family: var(--font-mono); font-size: 12px; color: var(--text-muted); text-align:right; }
        .hr-wt { font-family: var(--font-mono); font-size: 13px; color: var(--text); text-align:right; font-variant-numeric: tabular-nums; }
      `}</style>
    </div>
  );
}

function MoveRow({ m }) {
  const map = {
    New: { Icon: Plus, color: 'var(--positive)', label: 'New Position' },
    Added: { Icon: TrendingUp, color: 'var(--positive)', label: 'Added' },
    Reduced: { Icon: TrendingDown, color: 'var(--negative)', label: 'Reduced' },
    Sold: { Icon: Minus, color: 'var(--negative)', label: 'Sold' },
  };
  const c = map[m.action] || { Icon: Circle, color: 'var(--text-muted)', label: m.action };
  return (
    <div className="move-row">
      <div className="mr-icon" style={{ borderColor: c.color, color: c.color }}>
        <c.Icon size={13} />
      </div>
      <div className="mr-body">
        <span className="mr-tk">{m.ticker}</span>
        <span className="mr-co">{m.company}</span>
      </div>
      <span className="mr-label" style={{ color: c.color }}>{c.label}</span>
      <style>{`
        .move-row { display:flex; align-items:center; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--border); }
        .mr-icon { width:28px; height:28px; display:flex; align-items:center; justify-content:center; border:1px solid; flex-shrink: 0; }
        .mr-body { flex: 1; min-width: 0; display:flex; align-items:baseline; gap: 8px; }
        .mr-tk { font-family: var(--font-mono); color: var(--accent); font-size: 13px; }
        .mr-co { font-size: 13px; color: var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .mr-label { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase; flex-shrink: 0; }
      `}</style>
    </div>
  );
}

function DetailDrawer({ investor, holdings, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!investor) return null;

  const max = holdings?.topHoldings?.length
    ? Math.max(...holdings.topHoldings.map((h) => h.weight || 0)) : 0;

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <header className="drawer-head">
          <span className="kicker">Investor Profile</span>
          <button className="drawer-close" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </header>
        <div className="drawer-body">
          <div className="hero">
            <div className="hero-avatar">{investor.initials}</div>
            <div>
              <h2 className="hero-name">{investor.name}</h2>
              <p className="hero-fund">{investor.fund}</p>
              <div className="hero-meta">
                <span>{investor.strategy}</span><span>·</span>
                <span>AUM {investor.aum}</span><span>·</span>
                <span>Since {investor.activeSince}</span>
              </div>
            </div>
          </div>
          <p className="hero-bio">{investor.bio}</p>

          <div className="subsection-head">
            <span className="kicker">Latest Disclosed Holdings</span>
            {holdings?.fetchedAt && (
              <span className="kicker subtle">Updated {formatRelativeTime(holdings.fetchedAt)}</span>
            )}
          </div>

          {!holdings && (
            <div className="empty-state">
              <AlertCircle size={18} style={{ color: 'var(--text-muted)' }} />
              <div>
                <div className="empty-title">No fresh holdings data yet</div>
                <div className="empty-sub">The daily updater hasn't run for this fund. Use the source links below.</div>
              </div>
            </div>
          )}

          {holdings && (
            <>
              <div className="meta-grid">
                <div><span className="kicker">Reporting Period</span><div className="meta-val">{holdings.asOfDate || '—'}</div></div>
                <div><span className="kicker">Filed</span><div className="meta-val">{holdings.filingDate || '—'}</div></div>
                <div><span className="kicker">Portfolio Value</span><div className="meta-val accent">{holdings.totalValue || '—'}</div></div>
              </div>

              {holdings.summary && <p className="summary">{holdings.summary}</p>}

              {holdings.topHoldings?.length > 0 && (
                <div className="block">
                  <span className="kicker">Top Positions</span>
                  <div className="hr-header">
                    <span>Ticker</span><span>Company</span><span style={{textAlign:'right'}}>Value</span><span style={{textAlign:'right'}}>Weight</span>
                  </div>
                  {holdings.topHoldings.map((h, i) => <HoldingRow key={i} h={h} max={max} />)}
                </div>
              )}

              {holdings.recentMoves?.length > 0 && (
                <div className="block">
                  <span className="kicker">Recent Moves</span>
                  {holdings.recentMoves.map((m, i) => <MoveRow key={i} m={m} />)}
                </div>
              )}
            </>
          )}

          <div className="block sources">
            <span className="kicker">Primary Sources</span>
            {investor.sources.map((s, i) => (
              <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" className="src-link">
                {s.label}<ExternalLink size={13} />
              </a>
            ))}
          </div>
        </div>

        <style>{`
          .drawer-backdrop { position:fixed; inset:0; z-index:50; display:flex; justify-content:flex-end; background: rgba(0,0,0,.55); backdrop-filter: blur(4px); }
          .drawer { width:100%; max-width: 680px; height:100%; overflow-y:auto; background: var(--bg); border-left: 1px solid var(--border); animation: slideIn .4s cubic-bezier(.2,.8,.2,1); }
          .drawer-head { position:sticky; top:0; z-index:1; background: var(--bg); border-bottom: 1px solid var(--border); padding: 20px 32px; display:flex; justify-content:space-between; align-items:center; }
          .drawer-close { background:none; border:none; color: var(--text-muted); cursor:pointer; padding:4px; transition: color .2s; }
          .drawer-close:hover { color: var(--accent); }
          .drawer-body { padding: 32px; }
          .kicker { font-family: var(--font-mono); color: var(--text-muted); font-size: 10px; letter-spacing: 0.22em; text-transform: uppercase; }
          .kicker.subtle { color: var(--text-muted); opacity: .7; }
          .hero { display:flex; gap: 20px; margin-bottom: 28px; align-items: flex-start; }
          .hero-avatar { width:80px; height:80px; flex-shrink:0; display:flex; align-items:center; justify-content:center; border:1px solid var(--accent); color: var(--accent); font-family: var(--font-display); font-size: 30px; font-style: italic; }
          .hero-name { font-family: var(--font-display); font-size: 40px; line-height: 1.05; margin: 0 0 4px; }
          .hero-fund { font-family: var(--font-display); font-style: italic; color: var(--accent); font-size: 18px; margin: 0 0 12px; }
          .hero-meta { display:flex; flex-wrap:wrap; gap: 4px 12px; font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--text-muted); }
          .hero-bio { font-size: 15px; line-height: 1.65; color: var(--text-muted); margin: 0 0 32px; }
          .subsection-head { display:flex; justify-content:space-between; align-items:center; padding-bottom: 12px; border-bottom: 1px solid var(--border); margin-bottom: 20px; }
          .meta-grid { display:grid; grid-template-columns: repeat(3,1fr); gap:16px; margin-bottom: 28px; }
          .meta-val { font-family: var(--font-mono); font-size: 14px; color: var(--text); margin-top: 4px; }
          .meta-val.accent { color: var(--accent); }
          .summary { font-family: var(--font-display); font-style: italic; font-size: 15px; line-height: 1.65; padding-left: 16px; border-left: 2px solid var(--accent); margin: 0 0 32px; color: var(--text); }
          .block { margin-bottom: 32px; }
          .block .kicker { display:block; margin-bottom: 12px; }
          .hr-header { display:grid; grid-template-columns: 60px 1fr 90px 70px; gap: 16px; padding: 8px 0; border-bottom: 1px solid var(--border); font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--text-muted); }
          .empty-state { display:flex; gap:12px; padding: 20px; border: 1px solid var(--border); margin-bottom: 24px; }
          .empty-title { font-size: 14px; color: var(--text); margin-bottom: 4px; }
          .empty-sub { font-size: 12px; color: var(--text-muted); }
          .sources { padding-top: 24px; border-top: 1px solid var(--border); }
          .src-link { display:flex; justify-content:space-between; align-items:center; padding: 10px 0; font-size: 13px; color: var(--text); text-decoration:none; transition: color .2s; }
          .src-link:hover { color: var(--accent); }
        `}</style>
      </aside>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Retail Pulse — Top tickers, blog feed, reddit highlights
// ────────────────────────────────────────────────────────────
function TickerCard({ t, index }) {
  return (
    <div className="ticker-card" style={{ animationDelay: `${index * 30}ms` }}>
      <div className="tc-head">
        <span className="tc-symbol">${t.ticker}</span>
        <span className="tc-count">{t.mentions}</span>
      </div>
      <div className="tc-meta">
        <span>{t.mentions === 1 ? 'mention' : 'mentions'}</span>
        <span>·</span>
        <span>{t.subreddits?.length || 0} subs</span>
      </div>
      {t.subreddits?.length > 0 && (
        <div className="tc-subs">
          {t.subreddits.slice(0, 3).map((s) => (
            <span key={s} className="tc-sub">r/{s}</span>
          ))}
        </div>
      )}
      <style>{`
        .ticker-card {
          padding: 20px; background: var(--surface); border: 1px solid var(--border);
          animation: fadeUp .6s ease-out backwards;
        }
        .tc-head { display:flex; justify-content:space-between; align-items:baseline; margin-bottom: 8px; }
        .tc-symbol { font-family: var(--font-mono); color: var(--accent); font-size: 18px; letter-spacing: 0.05em; }
        .tc-count { font-family: var(--font-display); font-size: 32px; line-height: 1; color: var(--text); }
        .tc-meta { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--text-muted); display:flex; gap:6px; margin-bottom: 12px; }
        .tc-subs { display:flex; flex-wrap:wrap; gap: 6px; }
        .tc-sub { font-family: var(--font-mono); font-size: 10px; padding: 2px 8px; border: 1px solid var(--border); color: var(--text-muted); }
      `}</style>
    </div>
  );
}

function BlogPostCard({ post, index }) {
  return (
    <a href={post.link} target="_blank" rel="noopener noreferrer"
       className="blog-card" style={{ animationDelay: `${index * 40}ms` }}>
      <div className="bc-meta">
        <span className="bc-author">{post.author}</span>
        <span>·</span>
        <span className="bc-tag">{post.tag}</span>
        <span>·</span>
        <span className="bc-date">{formatRelativeTime(post.publishedAt)}</span>
      </div>
      <h3 className="bc-title">{post.title}</h3>
      {post.snippet && <p className="bc-snippet">{post.snippet}</p>}
      <div className="bc-cta">Read in full <ArrowUpRight size={12} /></div>
      <style>{`
        .blog-card {
          display:block; padding: 24px 28px; background: var(--surface);
          border: 1px solid var(--border); text-decoration:none; color: inherit;
          transition: all .25s; animation: fadeUp .6s ease-out backwards;
        }
        .blog-card:hover { border-color: var(--accent); background: var(--surface-2); }
        .blog-card:hover .bc-cta { gap: 10px; }
        .bc-meta { display:flex; flex-wrap:wrap; gap: 4px 8px; font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--text-muted); margin-bottom: 12px; }
        .bc-author { color: var(--accent); }
        .bc-title { font-family: var(--font-display); font-size: 22px; line-height: 1.2; margin: 0 0 8px; color: var(--text); }
        .bc-snippet { font-size: 13px; line-height: 1.6; color: var(--text-muted); margin: 0 0 16px; }
        .bc-cta { display:flex; align-items:center; gap: 6px; font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--accent); transition: gap .2s; }
      `}</style>
    </a>
  );
}

function RedditPostCard({ post, index }) {
  return (
    <a href={post.url} target="_blank" rel="noopener noreferrer"
       className="reddit-card" style={{ animationDelay: `${index * 30}ms` }}>
      <div className="rc-head">
        <span className="rc-sub">r/{post.subreddit}</span>
        <span className="rc-stats">↑ {post.score} · 💬 {post.num_comments}</span>
      </div>
      <div className="rc-title">{post.title}</div>
      {post.tickers?.length > 0 && (
        <div className="rc-tickers">
          {post.tickers.slice(0, 4).map((t) => <span key={t} className="rc-tk">${t}</span>)}
        </div>
      )}
      <style>{`
        .reddit-card { display:block; padding: 18px; background: var(--surface); border: 1px solid var(--border); text-decoration:none; color: inherit; transition: all .2s; animation: fadeUp .6s ease-out backwards; }
        .reddit-card:hover { border-color: var(--accent); }
        .rc-head { display:flex; justify-content:space-between; align-items:center; font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--text-muted); margin-bottom: 10px; }
        .rc-sub { color: var(--accent); }
        .rc-title { font-size: 14px; line-height: 1.45; color: var(--text); margin-bottom: 12px; }
        .rc-tickers { display:flex; gap: 6px; flex-wrap: wrap; }
        .rc-tk { font-family: var(--font-mono); font-size: 11px; padding: 2px 8px; border: 1px solid var(--border); color: var(--accent); }
      `}</style>
    </a>
  );
}

// ────────────────────────────────────────────────────────────
// Root
// ────────────────────────────────────────────────────────────
export default function App() {
  const [active, setActive] = useState(null);
  const [filter, setFilter] = useState('All');
  const [data, setData] = useState({
    holdings: {},
    redditTickers: [],
    redditPosts: [],
    blogPosts: [],
    lastUpdated: null,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const aggregate = await fetchJSON('/data/aggregate.json', null);
      if (cancelled) return;

      if (aggregate) {
        setData({
          holdings: aggregate.holdings || {},
          redditTickers: aggregate.redditTickers || [],
          redditPosts: aggregate.redditPosts || [],
          blogPosts: aggregate.blogPosts || [],
          lastUpdated: aggregate.lastUpdated || null,
          loading: false,
        });
      } else {
        setData((d) => ({ ...d, loading: false }));
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const visible = useMemo(
    () => (filter === 'All' ? INVESTORS : INVESTORS.filter((i) => i.category === filter)),
    [filter]
  );

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  return (
    <div className="app">
      <style>{THEME_CSS}</style>
      <style>{appCSS}</style>

      <div className="grain" />

      <div className="content">
        {/* Masthead */}
        <header className="masthead">
          <div className="masthead-top">
            <span>Vol. I · No. 01</span>
            <span>{today}</span>
          </div>
          <div className="masthead-frame">
            <h1 className="masthead-title">
              Smart <em>Money</em>
            </h1>
          </div>
          <p className="masthead-tagline">
            A reading of capital's most-watched practitioners — daily updates drawn from public 13F
            filings, Reddit discussion, and the newsletter crowd.
          </p>
          {data.lastUpdated && (
            <p className="masthead-stamp">
              Data last refreshed {formatRelativeTime(data.lastUpdated)}
            </p>
          )}
        </header>

        {/* Notice */}
        <section className="notice">
          <span className="notice-tag">Note</span>
          13F holdings are reported quarterly with a 45-day lag. Reddit and blog content updates daily.
          For informational purposes only — not investment advice.
        </section>

        {/* Institutional */}
        <SectionHeading kicker="Part One" title="The Institutional Desk" count={`${visible.length} of ${INVESTORS.length}`} />

        <div className="filter-bar">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setFilter(c)}
              className={`filter-btn ${c === filter ? 'active' : ''}`}
            >{c}</button>
          ))}
        </div>

        <div className="card-grid">
          {visible.map((inv, i) => (
            <InvestorCard
              key={inv.id}
              investor={inv}
              index={i}
              onClick={() => setActive(inv)}
              hasFreshHoldings={Boolean(data.holdings[inv.id])}
            />
          ))}
        </div>

        {/* Retail Pulse */}
        <SectionHeading
          kicker="Part Two"
          title="Retail Pulse"
          count={data.lastUpdated ? `Updated ${formatRelativeTime(data.lastUpdated)}` : ''}
        />

        {data.loading && (
          <div className="loading-block">
            <Loader2 className="spin" size={20} />
            <span>Loading retail data…</span>
          </div>
        )}

        {/* Top discussed tickers */}
        {data.redditTickers.length > 0 && (
          <>
            <h3 className="subsection-title">
              <Activity size={14} /> Most-Discussed Tickers · last 24h
            </h3>
            <div className="ticker-grid">
              {data.redditTickers.slice(0, 12).map((t, i) => (
                <TickerCard key={t.ticker} t={t} index={i} />
              ))}
            </div>
          </>
        )}

        {/* Reddit hot posts */}
        {data.redditPosts.length > 0 && (
          <>
            <h3 className="subsection-title">
              <MessageSquare size={14} /> Reddit Hot · across {REDDIT_SUBS.length} finance subs
            </h3>
            <div className="reddit-grid">
              {data.redditPosts.slice(0, 9).map((p, i) => (
                <RedditPostCard key={p.id} post={p} index={i} />
              ))}
            </div>
          </>
        )}

        {/* Blog feed */}
        {data.blogPosts.length > 0 && (
          <>
            <h3 className="subsection-title">
              <BookOpen size={14} /> From the Newsletter Crowd · {BLOGGERS.length} writers tracked
            </h3>
            <div className="blog-grid">
              {data.blogPosts.slice(0, 8).map((p, i) => (
                <BlogPostCard key={p.id || p.link} post={p} index={i} />
              ))}
            </div>
          </>
        )}

        {/* Empty state for retail if no data yet */}
        {!data.loading && data.redditTickers.length === 0 && data.blogPosts.length === 0 && (
          <div className="empty-block">
            <AlertCircle size={20} />
            <div>
              <div className="empty-title">No retail data yet</div>
              <div className="empty-sub">The daily updater hasn't run. It will populate this section automatically every morning.</div>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="site-footer">
          <div>Compiled from public 13F filings, Reddit, and finance blogger RSS feeds.</div>
          <div>For informational purposes only · Not investment advice</div>
        </footer>
      </div>

      {active && (
        <DetailDrawer
          investor={active}
          holdings={data.holdings[active.id] || null}
          onClose={() => setActive(null)}
        />
      )}
    </div>
  );
}

const appCSS = `
  .app { min-height:100vh; background: var(--bg); color: var(--text); position:relative; }
  .grain { position:fixed; inset:0; pointer-events:none; opacity:.03; z-index:0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"); }
  .content { position:relative; z-index:1; padding: 0 clamp(20px, 4vw, 56px); max-width: 1400px; margin: 0 auto; }

  .masthead { padding: 56px 0 40px; animation: mastheadFade .8s ease-out; }
  .masthead-top { display:flex; justify-content:space-between; margin-bottom: 32px;
    font-family: var(--font-mono); color: var(--text-muted); font-size: 10px; letter-spacing: 0.25em; text-transform: uppercase; }
  .masthead-frame { border-top: 1px solid var(--border); border-bottom: 3px double var(--border); padding: 24px 0; }
  .masthead-title { font-family: var(--font-display); font-size: clamp(56px, 10vw, 120px); line-height: .92; text-align:center; margin: 0; letter-spacing: -0.02em; }
  .masthead-title em { color: var(--accent); }
  .masthead-tagline { font-family: var(--font-display); font-style: italic; color: var(--text-muted);
    text-align:center; font-size: 16px; line-height: 1.55; margin: 28px auto 0; max-width: 640px; }
  .masthead-stamp { text-align:center; margin: 16px 0 0;
    font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--accent); }

  .notice { padding: 16px 20px; background: var(--surface); border: 1px solid var(--border);
    color: var(--text-muted); font-size: 12px; line-height: 1.55; }
  .notice-tag { font-family: var(--font-mono); color: var(--accent); font-size: 10px;
    letter-spacing: 0.22em; text-transform: uppercase; margin-right: 10px; }

  .filter-bar { display:flex; flex-wrap:wrap; gap:8px; margin-top: 24px; margin-bottom: 32px; }
  .filter-btn { padding: 8px 14px; background: transparent; border: 1px solid var(--border);
    color: var(--text-muted); font-family: var(--font-mono); font-size: 11px;
    letter-spacing: 0.18em; text-transform: uppercase; cursor: pointer; transition: all .2s; }
  .filter-btn:hover { border-color: var(--accent); color: var(--text); }
  .filter-btn.active { background: var(--accent); color: var(--bg); border-color: var(--accent); }

  .card-grid { display:grid; gap: 20px; grid-template-columns: 1fr; }
  @media (min-width: 720px) { .card-grid { grid-template-columns: repeat(2, 1fr); } }
  @media (min-width: 1080px) { .card-grid { grid-template-columns: repeat(3, 1fr); } }

  .subsection-title { display:flex; align-items:center; gap: 10px;
    font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.22em;
    text-transform: uppercase; color: var(--text-muted); margin: 48px 0 20px; }
  .subsection-title svg { color: var(--accent); }

  .ticker-grid { display:grid; gap: 12px; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); }
  .reddit-grid { display:grid; gap: 12px; grid-template-columns: 1fr; }
  @media (min-width: 720px) { .reddit-grid { grid-template-columns: repeat(2, 1fr); } }
  @media (min-width: 1080px) { .reddit-grid { grid-template-columns: repeat(3, 1fr); } }
  .blog-grid { display:grid; gap: 16px; grid-template-columns: 1fr; }
  @media (min-width: 900px) { .blog-grid { grid-template-columns: repeat(2, 1fr); } }

  .loading-block { display:flex; align-items:center; gap: 12px; padding: 24px;
    color: var(--text-muted); font-family: var(--font-mono); font-size: 11px;
    letter-spacing: 0.2em; text-transform: uppercase; }
  .spin { animation: spin 1s linear infinite; color: var(--accent); }
  @keyframes spin { to { transform: rotate(360deg); } }

  .empty-block { display:flex; gap: 16px; padding: 32px; border: 1px solid var(--border); margin-top: 24px; color: var(--text-muted); }
  .empty-block svg { color: var(--text-muted); flex-shrink:0; }
  .empty-title { font-size: 14px; color: var(--text); margin-bottom: 6px; }
  .empty-sub { font-size: 13px; color: var(--text-muted); line-height: 1.5; }

  .site-footer { margin-top: 80px; padding: 32px 0; border-top: 1px solid var(--border);
    text-align:center; font-family: var(--font-mono); font-size: 10px;
    letter-spacing: 0.22em; text-transform: uppercase; color: var(--text-muted);
    line-height: 2; }
`;
