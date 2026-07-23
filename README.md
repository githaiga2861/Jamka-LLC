# Jamka LLC — Trip & Money Books

A premium, mobile-first PWA for a one-truck operation. Tracks rate confirmations, loaded and empty miles (measured automatically from real US addresses), the 20% United Transport cut, fuel and every other expense, fuel discounts and refunds from weekly broker receipts, summaries, per-mile analytics, and a document vault — all synced through Supabase so the same PIN and data work on every device.

## 1. Set up Supabase (once, ~5 minutes)

1. Create a free project at https://supabase.com.
2. Open **SQL Editor → New query**, paste the whole of `supabase/schema.sql`, and press **Run**. This creates all tables, the `jamka-docs` storage bucket, and sets the starting PIN to **1234**.
3. Go to **Project Settings → API** and copy the **Project URL** and the **anon public key**.

To change the PIN later, run this in the SQL Editor (replace `NEWPIN`):
```sql
-- Get the hash first at any SHA-256 tool, or run in your browser console:
-- crypto.subtle.digest('SHA-256', new TextEncoder().encode('NEWPIN')).then(b=>console.log([...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')))
update settings set pin_hash = 'PASTE_HASH_HERE' where id = 1;
```

> Note: the app is a single-owner tool. Anyone with the anon key can reach the data, so keep the key private and do not share the deployed URL publicly.

## 2. Run locally

```bash
npm install
cp .env.example .env    # fill in your Supabase URL and anon key
npm run dev
```

## 3. Deploy on Vercel (recommended — easiest)

1. Push this folder to a GitHub repo.
2. Import the repo at https://vercel.com/new.
3. In the Vercel project settings, add two environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy. Open the URL on the iPhone in Safari → Share → **Add to Home Screen** and it installs as an app with the golden truck icon.

## 4. Deploy on GitHub Pages

1. Push to GitHub (branch `main`).
2. Repo **Settings → Secrets and variables → Actions**: add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. Repo **Settings → Pages → Source**: choose **GitHub Actions**.
4. The included workflow (`.github/workflows/deploy.yml`) builds and publishes on every push.

## How the math works

- **Pay**: `net = gross − 20%`. Shown at entry time with the full breakdown.
- **Loaded miles**: real driving distance (OSRM router over OpenStreetMap) between each stop while freight is on board — handles 2 pickups → 1 delivery, deliver-then-reload inside one rate con, and any mix.
- **Empty miles**: last drop-off of the previous trip → first pickup of the new one, plus any empty stretch inside a trip (dropped off, driving to the next pickup). Every stretch is listed separately with its own miles.
- **Expense matching**: an expense's exact date & time places it inside the trip whose window (first pickup → last delivery, padded a day) contains it.
- **Fuel discounts**: entered from the weekly UT LLC receipt (date + load number only) and matched to the trip by load number first, date second.
- **Week**: summaries' "This week" runs Monday 00:00 → Sunday 23:59 to mirror the UT LLC receipt week.

## Stack

Vite + React 18, Supabase (Postgres + Storage), OpenStreetMap Nominatim (address lookup), OSRM (road mileage). No paid APIs.
