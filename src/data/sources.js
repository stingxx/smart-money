// src/data/sources.js
// Sources for the "Retail Pulse" section.
// Reddit JSON endpoints work without authentication.
// RSS feeds are public.

export const REDDIT_SUBS = [
  { name: 'wallstreetbets', label: 'r/wallstreetbets', emoji: '🦍', desc: 'Retail mania central — high volume, high signal noise' },
  { name: 'stocks', label: 'r/stocks', emoji: '📊', desc: 'Mainstream individual investor discussion' },
  { name: 'investing', label: 'r/investing', emoji: '📈', desc: 'General investing, more measured tone' },
  { name: 'valueinvesting', label: 'r/valueinvesting', emoji: '💎', desc: 'Buffett-style, deep-research discussion' },
  { name: 'SecurityAnalysis', label: 'r/SecurityAnalysis', emoji: '🔍', desc: 'Detailed write-ups, often institutional-quality' },
  { name: 'options', label: 'r/options', emoji: '🎲', desc: 'Options traders — leading indicator on flow' },
];

// Public RSS feeds. All free, all fetchable without auth.
export const BLOGGERS = [
  {
    id: 'doomberg',
    name: 'Doomberg',
    handle: '@DoombergT',
    description: 'Anonymous green-chicken energy and commodity analyst — sharp, contrarian.',
    feed: 'https://newsletter.doomberg.com/feed',
    homepage: 'https://newsletter.doomberg.com',
    tag: 'Energy / Macro',
  },
  {
    id: 'net-interest',
    name: 'Marc Rubinstein',
    handle: 'Net Interest',
    description: 'Former hedge fund analyst on banking, financials, and capital markets.',
    feed: 'https://www.netinterest.co/feed',
    homepage: 'https://www.netinterest.co',
    tag: 'Financials',
  },
  {
    id: 'the-diff',
    name: 'Byrne Hobart',
    handle: 'The Diff',
    description: 'Cross-disciplinary tech/finance analysis — strategy meets capital markets.',
    feed: 'https://www.thediff.co/feed',
    homepage: 'https://www.thediff.co',
    tag: 'Tech / Strategy',
  },
  {
    id: 'damodaran',
    name: 'Aswath Damodaran',
    handle: 'Musings on Markets',
    description: 'NYU Stern professor — the dean of valuation. Free public valuations of major names.',
    feed: 'http://aswathdamodaran.blogspot.com/feeds/posts/default?alt=rss',
    homepage: 'https://aswathdamodaran.blogspot.com',
    tag: 'Valuation',
  },
  {
    id: 'common-sense',
    name: 'Ben Carlson',
    handle: 'A Wealth of Common Sense',
    description: 'Levelheaded long-term portfolio commentary, lots of market history.',
    feed: 'https://awealthofcommonsense.com/feed/',
    homepage: 'https://awealthofcommonsense.com',
    tag: 'Long-term',
  },
  {
    id: 'dollars-data',
    name: 'Nick Maggiulli',
    handle: 'Of Dollars and Data',
    description: 'Data-driven personal finance and behavior, weekly posts.',
    feed: 'https://ofdollarsanddata.com/feed/',
    homepage: 'https://ofdollarsanddata.com',
    tag: 'Behavioral',
  },
  {
    id: 'reformed-broker',
    name: 'Josh Brown',
    handle: 'The Reformed Broker',
    description: 'Wall Street insider commentary, market culture, often funny.',
    feed: 'https://thereformedbroker.com/feed/',
    homepage: 'https://thereformedbroker.com',
    tag: 'Markets',
  },
  {
    id: 'pragcap',
    name: 'Cullen Roche',
    handle: 'Pragmatic Capitalism',
    description: 'Macro and monetary policy with a practitioner\'s eye.',
    feed: 'https://www.pragcap.com/feed/',
    homepage: 'https://www.pragcap.com',
    tag: 'Macro',
  },
];

// Blacklist common English words and acronyms that look like tickers.
// Even with $ prefix required, we keep this as a defense.
export const TICKER_BLACKLIST = new Set([
  'A', 'I', 'IT', 'BE', 'GO', 'SO', 'NOW', 'ALL', 'ANY', 'BIG', 'CAN', 'FOR',
  'GET', 'HAS', 'HE', 'HOW', 'NEW', 'NOT', 'ONE', 'OUR', 'OUT', 'TWO', 'WHO',
  'WHY', 'YOU', 'OK', 'OP', 'CEO', 'CFO', 'CTO', 'COO', 'IPO', 'ETF', 'API',
  'USA', 'EU', 'UK', 'US', 'FED', 'GDP', 'CPI', 'PPI', 'PE', 'PEG', 'EPS',
  'ROI', 'ROE', 'ROA', 'EBIT', 'WSB', 'YOLO', 'DD', 'TLDR', 'IMO', 'IMHO',
  'ATH', 'ATL', 'FOMO', 'BTFD', 'HODL', 'FUD', 'LFG', 'TLDR', 'OFF', 'ON',
  'OR', 'AND', 'BUT', 'IF', 'IS', 'AS', 'AT', 'OF', 'TO', 'BY', 'NO', 'AM',
  'PM', 'TV', 'OS', 'AI', 'ML', 'VR', 'AR', 'EV', 'TLDR', 'IRA', 'HSA', 'NPV',
  'SEC', 'IRS', 'NYSE', 'NASDAQ', 'NYC', 'LA', 'SF', 'WSJ', 'NYT', 'CNBC',
  'BBC', 'CNN', 'FOX', 'AKA', 'ASAP', 'ETA', 'FAQ', 'FYI', 'MVP', 'PR', 'QA',
  'AOC', 'POTUS', 'GOP', 'DM', 'PM', 'AM',
]);
// (NYT is a real ticker for the New York Times Co; if you ever care about that
// stock specifically, just remove it from the blacklist above.)

// Match ONLY $-prefixed tickers. This is the standard Reddit/social-media
// convention for stock cashtags and eliminates virtually all false positives
// that come from common English words appearing in post text.
//
// Examples that match:    $NVDA  $AAPL  $T  $BRK.B
// Examples that DON'T:    NVDA  Apple  off  voting on
export const VALID_TICKER_REGEX = /\$([A-Z]{1,5}(?:\.[A-Z])?)\b/g;
