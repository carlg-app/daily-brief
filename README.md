# Daily Brief — Setup Guide

Your personal, non-biased news intelligence app. Runs on iPhone as a PWA (no App Store needed).

---

## What you need (all free)

- A **GitHub account** → github.com
- A **Supabase account** → supabase.com

---

## Step 1 — Set up Supabase (your database)

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Click **New Project** — give it a name like `daily-brief`
3. Choose a region close to NZ (e.g. **Sydney**)
4. Once your project is ready, click **SQL Editor** in the left sidebar
5. Paste the entire contents of `supabase-schema.sql` into the editor and click **Run**
6. Go to **Settings → API** and copy:
   - **Project URL** (looks like `https://xxxx.supabase.co`)
   - **anon / public** key (long string starting with `eyJ...`)

Keep these two values — you'll need them in Step 3.

---

## Step 2 — Deploy the app to GitHub Pages

1. Go to [github.com](https://github.com) and create a **New Repository**
   - Name it `daily-brief`
   - Set it to **Public**
   - Click **Create repository**

2. Upload all the files from this folder to the repository:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `manifest.json`
   - `sw.js`
   - (Optional) `icons/` folder — see note below

3. In your repository, go to **Settings → Pages**
   - Under **Source**, select **Deploy from a branch**
   - Branch: `main`, folder: `/ (root)`
   - Click **Save**

4. Wait ~60 seconds. Your app will be live at:
   `https://YOUR-GITHUB-USERNAME.github.io/daily-brief/`

### Icons (optional but recommended)
Create two square PNG icons and put them in an `icons/` folder:
- `icons/icon-192.png` (192×192 px)
- `icons/icon-512.png` (512×512 px)

You can use a plain ☀️ or any image — just make it square with a dark background.

---

## Step 3 — Connect to your database

1. Open your app URL in Safari on iPhone (or desktop)
2. You'll see a setup screen — paste in your Supabase URL and anon key
3. Tap **Connect & Continue**

The app will load with today's demo news until your first real brief is pushed from Cowork.

---

## Step 4 — Install to iPhone Home Screen

1. Open the app URL in **Safari** on your iPhone
2. Tap the **Share** button (box with arrow at the bottom)
3. Scroll down and tap **Add to Home Screen**
4. Name it `Daily Brief` and tap **Add**

It now appears on your home screen like a native app — full screen, no browser bar.

---

## Step 5 — Connect Cowork to push daily news

In Cowork (Claude), set up a scheduled task that:
1. Searches for today's news across your 5 categories
2. Formats it into the database schema
3. Pushes it to Supabase each morning at 8am NZST

Ask Claude in Cowork: *"Set up the daily news task to push to my Supabase database"* and provide your Supabase URL and key.

---

## How the app works

| Feature | How it works |
|---|---|
| **Today tab** | Shows today's articles from Supabase (falls back to demo data) |
| **Category pills** | Filter articles by World / NZ / Politics / Justice / Science |
| **Two Perspectives** | Side-by-side coverage from different outlets for contested stories |
| **Expand article** | Tap any card to expand and read the full content |
| **Topics tab** | All tracked topics, grouped by category, sorted by article count |
| **Topic timeline** | Tap any topic → see every article on it in reverse-chronological order |
| **Background context** | AI-generated when a topic first appears; you can add your own notes |
| **Your Notes** | Per-topic personal notes saved locally and to Supabase |
| **Search** | Full-text search across all articles and topics |
| **Read Aloud** | 🔊 button reads today's headlines using your phone's built-in voice |
| **Offline** | App shell cached — works without internet (data loads when connected) |

---

## Adjusting your preferences

Just tell Claude in Cowork what you want to change:
- *"Add tech news as a category"*
- *"Only include science news from Nature and ScienceDaily"*
- *"Change the brief to 6:30am"*
- *"Add background context for the NZ housing crisis topic"*

---

## Troubleshooting

**App shows demo data only** → Check your Supabase URL and key in Settings (⚙️ icon)

**Audio doesn't work** → Must be in Safari on iPhone. Chrome blocks Web Speech API on iOS.

**App not updating** → Pull down to refresh, or tap ⚙️ → Save to force a reload.

**GitHub Pages not loading** → Wait a few minutes after enabling Pages, then hard-refresh.
