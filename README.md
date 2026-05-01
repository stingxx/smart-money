# Smart Money

A daily-updated dashboard tracking the public holdings and market commentary of America's most-watched investors. Pulls data from SEC EDGAR (13F filings), Reddit (finance subs), and finance blogger RSS feeds.

**Zero monthly cost.** Hosted on Vercel free tier. Daily updates by GitHub Actions free tier.

---

## Deployment — 4 steps, no coding required

### Step 1 · Create the GitHub repo

1. Go to https://github.com/new
2. Repository name: `smart-money`
3. Set it to **Public** (required for free GitHub Actions on a personal account — private repos get fewer free minutes, but Public is unlimited)
4. **Do NOT** check "Add a README file" — we already have one
5. Click **Create repository**

### Step 2 · Upload the project files

On the new empty repo page, you'll see a section that says "uploading an existing file". Click **uploading an existing file** (it's a link in the middle of the page).

1. **Drag the entire `smart-money` folder contents** (not the folder itself — the files inside) onto the upload area
2. Wait for upload to finish (~30 seconds)
3. Scroll down, in "Commit changes" type: `Initial commit`
4. Click **Commit changes**

### Step 3 · Connect to Vercel

1. Go to https://vercel.com/new
2. If prompted, sign in with GitHub
3. Find `smart-money` in the list of repos and click **Import**
4. On the configuration screen:
   - **Framework Preset**: should auto-detect as **Vite**
   - Leave everything else at defaults
5. Click **Deploy**

Wait ~2 minutes. Vercel will show a confetti animation when done. Click the preview URL to see your live site.

Your site is now live at `smart-money-{random}.vercel.app`. You can configure a custom domain later in Vercel's settings if you want.

### Step 4 · Trigger the first data fetch

The site is live but the "Retail Pulse" section will be empty until the first scheduled run (next morning at 5:30am ET). To populate it immediately:

1. Go to your GitHub repo → **Actions** tab
2. In the left sidebar, click **Daily data update**
3. Click the **Run workflow** dropdown on the right → **Run workflow** (green button)
4. Wait ~3 minutes for the run to complete
5. Vercel will automatically detect the data update and redeploy (another ~1 min)
6. Refresh your site — full data should now be visible

**That's it. From now on it updates automatically every morning.**

---

## How it works

```
GitHub Actions (cron: daily 9:30 UTC)
     │
     ├─→ scripts/fetch-13f.mjs   ─→ SEC EDGAR
     ├─→ scripts/fetch-reddit.mjs ─→ Reddit public .json endpoints
     └─→ scripts/fetch-blogs.mjs  ─→ RSS feeds
                │
                ▼
     public/data/aggregate.json  (committed back to repo)
                │
                ▼
     Vercel auto-deploys on push
                │
                ▼
            Live site
```

## Customization

### Add or remove tracked investors
Edit `src/data/investors.js`. You'll need:
- The fund's SEC CIK number (look up at https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany)
- A short bio and your category tag

### Add or remove blogs/subreddits
Edit `src/data/sources.js`. RSS feeds: just add the URL. Subreddits: just add the name.

### Run the data update locally to test
```bash
npm install
npm run fetch-data
npm run dev
```

Open http://localhost:5173 to preview.

---

## License & disclaimer

For informational purposes only. Not investment advice. 13F holdings are reported quarterly with a 45-day lag.
