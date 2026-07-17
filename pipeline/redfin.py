"""Build web/public/data/pulse.json — the market pulse.

Contents: monthly actual-sales series for every NJ county from Redfin's
county market tracker (median sale price, homes sold, listings, inventory),
plus a statewide summary from Zillow's state series and the weekly FRED
mortgage rate. Redfin reports real transactions — a complement to Zillow's
model-based value estimates.

The tracker is a ~240 MB gzipped national TSV, stream-parsed in chunks with
only the needed columns. Any failure here must never block the map refresh:
run.py catches exceptions and keeps the last committed pulse.json.
"""

import gzip
import json
from datetime import date

import pandas as pd
import requests

import config
import download
import scores

USECOLS = [
    "PERIOD_END", "REGION_TYPE", "IS_SEASONALLY_ADJUSTED", "REGION",
    "STATE_CODE", "PROPERTY_TYPE",
    "MEDIAN_SALE_PRICE", "MEDIAN_SALE_PRICE_YOY",
    "HOMES_SOLD", "PENDING_SALES", "NEW_LISTINGS", "INVENTORY",
    "MEDIAN_DOM", "AVG_SALE_TO_LIST",
]

# metric -> rounding (0 = int)
SERIES = {
    "MEDIAN_SALE_PRICE": 0,
    "MEDIAN_SALE_PRICE_YOY": 4,
    "HOMES_SOLD": 0,
    "PENDING_SALES": 0,
    "NEW_LISTINGS": 0,
    "INVENTORY": 0,
    "MEDIAN_DOM": 1,
    "AVG_SALE_TO_LIST": 4,
}


def fetch_nj_counties() -> pd.DataFrame:
    print("  streaming Redfin county tracker (~240 MB gz) ...")
    frames = []
    with requests.get(config.REDFIN_TRACKER_URL, stream=True, timeout=600) as resp:
        resp.raise_for_status()
        gz = gzip.GzipFile(fileobj=resp.raw)
        reader = pd.read_csv(gz, sep="\t", usecols=USECOLS, chunksize=200_000)
        for i, chunk in enumerate(reader):
            nj = chunk[
                (chunk["STATE_CODE"] == "NJ")
                & (chunk["REGION_TYPE"] == "county")
                & (chunk["PROPERTY_TYPE"] == "All Residential")
                & (chunk["IS_SEASONALLY_ADJUSTED"].astype(str).str.lower() == "false")
            ]
            if len(nj):
                frames.append(nj)
            if (i + 1) % 10 == 0:
                print(f"    ... {(i + 1) * 200_000 / 1e6:.0f}M rows scanned")
    df = pd.concat(frames, ignore_index=True)
    print(f"  {len(df)} NJ county-month rows")
    return df


def build_counties(df: pd.DataFrame) -> dict:
    counties = {}
    for region, g in df.groupby("REGION"):
        name = region.replace(" County, NJ", "")
        g = g.sort_values("PERIOD_END").drop_duplicates("PERIOD_END", keep="last")
        g = g.tail(config.REDFIN_MONTHS)
        entry = {"months": [p[:7] for p in g["PERIOD_END"]]}
        for col, digits in SERIES.items():
            vals = []
            for v in g[col]:
                if pd.isna(v):
                    vals.append(None)
                elif digits == 0:
                    vals.append(int(round(float(v))))
                else:
                    vals.append(round(float(v), digits))
            entry[col.lower()] = vals
        counties[name] = entry
    return counties


def build_state(mortgage_rate: float) -> dict:
    """NJ statewide strip from Zillow's state-level series."""
    out = {"mortgage_rate": round(mortgage_rate, 4)}
    for key in config.ZILLOW_STATE_DATASETS:
        path = config.RAW_DIR / f"zillow_state_{key}.csv"
        if not path.exists():
            continue
        df = pd.read_csv(path)
        row = df[df["RegionName"] == "New Jersey"]
        if row.empty:
            continue
        now = scores.smoothed(row)
        past = scores.smoothed(row, 12)
        cur = float(now.iloc[0]) if pd.notna(now.iloc[0]) else None
        out[key] = int(round(cur)) if cur is not None else None
        if cur is not None and pd.notna(past.iloc[0]) and past.iloc[0]:
            out[f"{key}_yoy"] = round(cur / float(past.iloc[0]) - 1, 4)
        out["zillow_latest_month"] = scores.date_cols(row)[-1][:7]
    return out


def download_state(force: bool = False) -> None:
    for key, (rel_tmpl, label) in config.ZILLOW_STATE_DATASETS.items():
        dest = config.RAW_DIR / f"zillow_state_{key}.csv"
        if not force and dest.exists():
            continue
        url = f"{config.ZILLOW_BASE}/{rel_tmpl.format(prefix='State')}"
        try:
            download._stream_download(url, dest, f"{label} [state]")
        except Exception as e:
            # Zillow doesn't publish every series at state level (no state
            # ZORI as of 2026); the summary strip just omits that stat.
            print(f"  NOTE: no state-level {key} ({e}); omitting from summary")


def main() -> None:
    print("Building market pulse ...")
    config.RAW_DIR.mkdir(parents=True, exist_ok=True)
    download_state()
    rate = download.fetch_mortgage_rate() or config.MORTGAGE_RATE
    df = fetch_nj_counties()
    counties = build_counties(df)
    latest = max(m for c in counties.values() for m in c["months"])
    out = {
        "meta": {
            "generated": date.today().isoformat(),
            "redfin_latest_month": latest,
            "months": config.REDFIN_MONTHS,
        },
        "state": build_state(rate),
        "counties": counties,
    }
    dest = config.OUT_DIR / "pulse.json"
    dest.write_text(json.dumps(out, separators=(",", ":")))
    print(f"  -> {dest} ({dest.stat().st_size / 1e3:.0f} KB, latest month {latest})")


if __name__ == "__main__":
    main()
