import { monthName } from '../lib/format.js'

export default function Methodology({ meta }) {
  return (
    <div className="methodology">
      <a className="back-link" href="#/">
        ← Back to the map
      </a>
      <h1>How the scores work</h1>
      <p>
        Every New Jersey zip code, town and county gets scores from 0 to 100. A score is a{' '}
        <strong>percentile within New Jersey, at its own level</strong>: a zip scoring 90 ranks
        higher on that dimension than 90% of NJ zip codes; a town scoring 90 outranks 90% of NJ
        towns. Scores compare places <em>within the state</em> — they say nothing about NJ
        versus other states, and a zip score isn’t comparable to a county score.
      </p>
      <p>
        With only 21 counties, county scores move in coarse (~5-point) steps — that’s why the
        map also shows a county’s ordinal rank, like “#5 of 21.”
      </p>
      <p>
        To damp month-to-month noise, each underlying metric is averaged over the three most
        recent months of data{meta?.zillow_latest_month ? ` (currently through ${monthName(meta.zillow_latest_month)})` : ''}.
      </p>

      <h2>Trends and the map’s colors</h2>
      <p>
        The map colors by whatever you select: a composite score, a raw metric (like typical
        home value or rent yield), or its change over 1 month, 3 months, or 1 year. Scores and
        changes run on a red-to-green scale — deep red for the weakest markets (or biggest
        declines), soft neutral in the middle, deep green for the strongest (or biggest gains).
        Raw dollar metrics use a light-to-dark blue scale instead. Areas without data for the
        selected view stay faint and uncolored.
      </p>

      <h2>Investment score</h2>
      <p>Captures how strong the market’s fundamentals look for an owner or investor.</p>
      <ul>
        <li>1-year home value appreciation — weight 30</li>
        <li>5-year home value appreciation (annualized) — weight 20</li>
        <li>Gross rent yield (annual rent ÷ home value) — weight 30</li>
        <li>Supply tightening (inventory falling year-over-year) — weight 20</li>
      </ul>

      <h2>Hotness score</h2>
      <p>Captures how fast and competitively homes are selling right now.</p>
      <ul>
        <li>Share of listings with a price cut (fewer = hotter) — weight 30</li>
        <li>Inventory change year-over-year (falling = hotter) — weight 25</li>
        <li>Median days to pending sale (fewer = hotter) — weight 25</li>
        <li>Sale-to-list price ratio (higher = hotter) — weight 20</li>
      </ul>

      <h2>Affordability score</h2>
      <p>Captures how attainable homes are relative to local incomes and rents.</p>
      <ul>
        <li>Home value ÷ median household income (lower = more affordable) — weight 60</li>
        <li>
          Monthly mortgage payment ÷ monthly rent, assuming a 30-year loan at{' '}
          {meta ? (meta.mortgage_rate * 100).toFixed(2) : '6.75'}% with 20% down (lower = buying
          is relatively cheaper) — weight 40
        </li>
      </ul>
      <p>
        The mortgage rate updates automatically each refresh from the Freddie Mac Primary
        Mortgage Market Survey published by FRED.
      </p>

      <h2>Overall score</h2>
      <p>
        A weighted blend: 35% investment, 30% hotness, 35% affordability. If a dimension has no
        data for a zip, the blend re-weights across what’s available.
      </p>

      <h2>What counts as a “town”</h2>
      <p>
        Towns are New Jersey’s 564 official municipalities (Census county subdivisions).
        Zillow’s city-level data is matched to them by name within each county; ambiguous names
        (a borough and a township sharing a name) are resolved by a hand-checked list, and
        anything uncertain is left unmatched rather than guessed. Unincorporated places that
        Zillow tracks separately — like Short Hills or Colonia — aren’t municipalities, so they
        appear in zip view but stay uncolored in town view.
      </p>

      <h2>Missing data</h2>
      <p>
        Not every metric is published for every place — smaller markets often lack rent,
        days-on-market, or sale-to-list data. A dimension is only scored when at least half of
        its metric weight is available; otherwise the place shows no color for that layer. The
        detail panel notes when scores rest on partial data.
      </p>

      <h2>Data sources</h2>
      <ul>
        <li>
          Home values (ZHVI), rents (ZORI), days to pending, price cuts, sale-to-list ratio and
          inventory:{' '}
          <a href="https://www.zillow.com/research/data/" target="_blank" rel="noreferrer">
            Zillow Research
          </a>
          , updated monthly, at zip, city and county level.
        </li>
        <li>
          Median household income: U.S. Census Bureau, {meta?.acs_year ?? 2024} American
          Community Survey 5-Year Estimates.
        </li>
        <li>
          Market pulse: actual closed-sales data per county (median sale price, homes sold,
          listings, inventory) from the{' '}
          <a href="https://www.redfin.com/news/data-center/" target="_blank" rel="noreferrer">
            Redfin Data Center
          </a>
          , published monthly.
        </li>
        <li>
          Mortgage rate: Freddie Mac 30-year fixed average, via{' '}
          <a href="https://fred.stlouisfed.org/series/MORTGAGE30US" target="_blank" rel="noreferrer">
            FRED
          </a>
          .
        </li>
        <li>
          Boundaries: U.S. Census Bureau cartographic boundary files — 2020 ZCTAs (zip code
          approximations), 2023 county subdivisions (municipalities), and 2023 counties.
        </li>
      </ul>

      <h2>Fine print</h2>
      <p>
        This site is an independent project and is not affiliated with or endorsed by Zillow or
        the U.S. Census Bureau. Scores summarize public data and involve judgment calls in the
        formula weights; they are not financial, investment, or real estate advice. Always do
        your own research before making decisions about real property.
      </p>
    </div>
  )
}
