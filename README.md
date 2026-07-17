# NJ Market Map

An interactive map of the New Jersey housing market for investors and the curious.
Every **zip code, town, and county** is colored by whatever you pick: a 0–100 score
(**Overall**, **Investment**, **Hotness**, **Affordability**), a raw metric (typical
home value, rent yield, days to pending…), or its **change over 1 month / 3 months /
1 year**. Click any place for its scores, 24-month price and rent charts, and stats.
A **Rankings** page lists the best places by any measure, and a **Market pulse** page
tracks Redfin's actual closed-sales data for every NJ county.

Built with free public data (Zillow Research, Redfin Data Center, U.S. Census Bureau,
FRED), a free basemap (OpenFreeMap), and free hosting (GitHub Pages) — it costs
$0/month to run.

## How it's organized

- `pipeline/` — Python scripts that download the data and compute the scores.
  - `config.py` — data sources, geography levels, score weights.
  - `towns.py` + `town_aliases.csv` — matches Zillow city names to official NJ
    municipalities (run `python towns.py` to see the match report).
  - `redfin.py` — builds the market pulse (streams Redfin's ~240 MB county tracker).
- `web/` — the website (React + MapLibre). The pipeline writes its results into
  `web/public/data/`, which is committed so the site is fully static.
- `data/raw/` — downloaded raw data (not committed; recreated on demand).
- `.github/workflows/refresh.yml` — refreshes the data **automatically every
  Thursday** and redeploys the site if anything changed.

## One-time setup

1. Install dependencies:
   ```
   make setup
   ```
2. Get a free Census API key (needed for the income data behind the Affordability
   score): sign up at https://api.census.gov/data/key_signup.html.
   - For local runs: copy `.env.example` to `.env` and paste the key in.
   - For the weekly automation: on GitHub, go to the repo's **Settings → Secrets
     and variables → Actions → New repository secret**, name it `CENSUS_API_KEY`,
     and paste the key as the value.

## Updating the data

**You normally don't have to do anything.** Every Thursday, GitHub Actions runs the
whole pipeline (Zillow monthly data, Redfin county sales data, the current weekly
mortgage rate from FRED), validates the results, commits them, and redeploys the site. If
validation fails, the workflow fails and GitHub emails you; nothing broken gets
published. You can also trigger it by hand from the repo's **Actions** tab
("Weekly data refresh" → "Run workflow").

To run it locally instead:

```
make refresh
```

The mortgage rate is fetched automatically from FRED each refresh — no more
hand-editing `MORTGAGE_RATE` (it remains only as an offline fallback).

Boundary shapes rarely change (decennial census); rebuild them with
`make boundaries` if ever needed.

## Working on the site

```
make dev      # local preview at http://localhost:5173
make build    # production build into web/dist
```

## Data sources & attribution

- Home values, rents, and market metrics: [Zillow Research](https://www.zillow.com/research/data/) —
  the site must keep a visible "Data provided by Zillow" link on every page.
- County sales data: [Redfin Data Center](https://www.redfin.com/news/data-center/)
  (attribution link in the site footer).
- Median household income: U.S. Census Bureau, ACS 5-Year Estimates.
- Mortgage rate: Freddie Mac 30-year average via [FRED](https://fred.stlouisfed.org/series/MORTGAGE30US).
- Boundaries: U.S. Census Bureau cartographic files — 2020 ZCTAs, 2023 county
  subdivisions (NJ municipalities), 2023 counties.
- Basemap: [OpenFreeMap](https://openfreemap.org/) (© OpenMapTiles © OpenStreetMap contributors).

Scores are editorial summaries of public data, not financial advice.
