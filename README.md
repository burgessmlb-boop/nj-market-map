# NJ Market Map

An interactive map of the New Jersey housing market. Every zip code is colored by a
0–100 score, with four toggleable layers: **Overall**, **Investment**, **Hotness**,
and **Affordability**. Click any zip for its scores and underlying stats.

Built with free public data (Zillow Research, U.S. Census Bureau), a free basemap
(OpenFreeMap), and free hosting (GitHub Pages) — it costs $0/month to run.

## How it's organized

- `pipeline/` — Python scripts that download the data and compute the scores.
- `web/` — the website (React + MapLibre). The pipeline writes its results into
  `web/public/data/`, which is committed so the site is fully static.
- `data/raw/` — downloaded raw data (not committed; recreated on demand).

## One-time setup

1. Install dependencies:
   ```
   make setup
   ```
2. Get a free Census API key (needed for the income data behind the Affordability
   score): sign up at https://api.census.gov/data/key_signup.html, then copy
   `.env.example` to `.env` and paste the key in.

## Updating the data (monthly)

Zillow refreshes its data around the middle of each month. To update the site:

```
make refresh
```

This downloads the latest data, recomputes all scores, and runs sanity checks.
If everything passes, commit and push — the site redeploys automatically:

```
git add -A && git commit -m "Data refresh" && git push
```

Also check the current 30-year mortgage rate now and then and update
`MORTGAGE_RATE` in `pipeline/config.py` if it has moved meaningfully (it feeds
the rent-vs-buy affordability metric).

## Working on the site

```
make dev      # local preview at http://localhost:5173
make build    # production build into web/dist
```

## Data sources & attribution

- Home values, rents, and market metrics: [Zillow Research](https://www.zillow.com/research/data/) —
  the site must keep a visible "Data provided by Zillow" link on every page.
- Median household income: U.S. Census Bureau, ACS 5-Year Estimates.
- Zip boundaries: U.S. Census Bureau 2020 ZCTA cartographic boundary files.
- Basemap: [OpenFreeMap](https://openfreemap.org/) (© OpenMapTiles © OpenStreetMap contributors).

Scores are editorial summaries of public data, not financial advice.
