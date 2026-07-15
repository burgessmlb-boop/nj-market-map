"""Compute per-zip market metrics and 0-100 scores; emit scores.json."""

import json
import re
from datetime import date

import pandas as pd

import config

DATE_COL = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def load_zillow(key: str) -> pd.DataFrame:
    path = config.RAW_DIR / f"zillow_{key}.csv"
    if not path.exists():
        raise FileNotFoundError(f"{path} missing - run download.py first")
    df = pd.read_csv(path, dtype={"RegionName": str})
    df = df[df["State"] == config.STATE].copy()
    df["RegionName"] = df["RegionName"].str.zfill(5)
    return df.set_index("RegionName")


def date_cols(df: pd.DataFrame) -> list[str]:
    return sorted(c for c in df.columns if DATE_COL.match(c))


def smoothed(df: pd.DataFrame, months_back: int = 0) -> pd.Series:
    """Mean of the SMOOTH_MONTHS monthly columns ending `months_back` months
    before the newest column. NaN where a zip has no data in the window."""
    cols = date_cols(df)
    end = len(cols) - months_back
    start = end - config.SMOOTH_MONTHS
    if start < 0:
        raise ValueError(f"dataset too short for months_back={months_back}")
    return df[cols[start:end]].mean(axis=1, skipna=True)


def monthly_payment(price: pd.Series) -> pd.Series:
    """Monthly principal & interest on price at LOAN_TO_VALUE and MORTGAGE_RATE."""
    loan = price * config.LOAN_TO_VALUE
    r = config.MORTGAGE_RATE / 12
    n = 360
    factor = r * (1 + r) ** n / ((1 + r) ** n - 1)
    return loan * factor


def load_income() -> pd.Series:
    path = config.RAW_DIR / "acs_income.json"
    if not path.exists():
        print("  NOTE: no ACS income file; value_to_income will be null everywhere")
        return pd.Series(dtype=float, name="income")
    rows = json.loads(path.read_text())
    df = pd.DataFrame(rows[1:], columns=rows[0])
    zcta_col = "zip code tabulation area"
    df = df[df[zcta_col].str.match(config.ZIP_PREFIX_PATTERN)]
    income = pd.to_numeric(df[config.ACS_INCOME_VAR], errors="coerce")
    income[income < 0] = pd.NA  # Census sentinel values like -666666666
    return pd.Series(income.values, index=df[zcta_col].values, name="income").astype(float)


def build_metrics() -> tuple[pd.DataFrame, pd.DataFrame, dict]:
    zhvi = load_zillow("zhvi")
    zori = load_zillow("zori")
    dom = load_zillow("dom")
    price_cut = load_zillow("price_cut")
    sale_to_list = load_zillow("sale_to_list")
    inventory = load_zillow("inventory")

    m = pd.DataFrame(index=zhvi.index)
    m["zhvi"] = smoothed(zhvi)
    m["appreciation_1yr"] = m["zhvi"] / smoothed(zhvi, 12) - 1
    m["appreciation_5yr"] = (m["zhvi"] / smoothed(zhvi, 60)) ** (1 / 5) - 1
    m["zori"] = smoothed(zori).reindex(m.index)
    m["rent_yield"] = m["zori"] * 12 / m["zhvi"]
    m["days_to_pending"] = smoothed(dom).reindex(m.index)
    m["price_cut_share"] = smoothed(price_cut).reindex(m.index)
    m["sale_to_list"] = smoothed(sale_to_list).reindex(m.index)
    inv_now = smoothed(inventory)
    m["inventory_yoy"] = (inv_now / smoothed(inventory, 12) - 1).reindex(m.index)
    m["income"] = load_income().reindex(m.index)
    m["value_to_income"] = m["zhvi"] / m["income"]
    m["buy_to_rent"] = monthly_payment(m["zhvi"]) / m["zori"]

    places = zhvi[["City", "CountyName"]].fillna("")
    meta = {
        "generated": date.today().isoformat(),
        "zillow_latest_month": date_cols(zhvi)[-1][:7],
        "acs_year": config.ACS_YEAR,
        "mortgage_rate": config.MORTGAGE_RATE,
        "n_zips": int(len(m)),
    }
    return m, places, meta


def score_dimensions(m: pd.DataFrame) -> pd.DataFrame:
    # Percentile-rank every metric within NJ, 0-100, higher = better.
    pct = pd.DataFrame(index=m.index)
    for dim_cfg in config.DIMENSIONS.values():
        for metric, spec in dim_cfg.items():
            if metric in pct.columns:
                continue
            ranked = m[metric].rank(pct=True) * 100
            pct[metric] = 100 - ranked if spec["invert"] else ranked

    scores = pd.DataFrame(index=m.index)
    for dim, dim_cfg in config.DIMENSIONS.items():
        weights = pd.DataFrame(
            {metric: pct[metric].notna() * spec["weight"] for metric, spec in dim_cfg.items()}
        )
        total_weight = sum(spec["weight"] for spec in dim_cfg.values())
        available = weights.sum(axis=1)
        weighted = sum(
            pct[metric].fillna(0) * spec["weight"] for metric, spec in dim_cfg.items()
        )
        score = weighted / available
        score[available < config.MIN_WEIGHT_COVERAGE * total_weight] = pd.NA
        scores[dim] = score
        scores[f"{dim}_coverage"] = (available / total_weight).round(2)

    dims = list(config.OVERALL_WEIGHTS)
    w = pd.DataFrame(
        {d: scores[d].notna() * config.OVERALL_WEIGHTS[d] for d in dims}
    )
    total = w.sum(axis=1)
    blend = sum(scores[d].astype(float).fillna(0) * config.OVERALL_WEIGHTS[d] for d in dims)
    overall = blend / total
    overall[total == 0] = pd.NA
    scores["overall"] = overall
    return scores


def _num(v, digits=4):
    if pd.isna(v):
        return None
    return round(float(v), digits)


def build_output(m, places, scores, meta) -> dict:
    zips = {}
    for z in m.index:
        row, s = m.loc[z], scores.loc[z]
        zips[z] = {
            "city": places.loc[z, "City"],
            "county": places.loc[z, "CountyName"].replace(" County", ""),
            "scores": {
                "overall": _num(s["overall"], 1),
                "investment": _num(s["investment"], 1),
                "hotness": _num(s["hotness"], 1),
                "affordability": _num(s["affordability"], 1),
            },
            "coverage": {
                "investment": _num(s["investment_coverage"], 2),
                "hotness": _num(s["hotness_coverage"], 2),
                "affordability": _num(s["affordability_coverage"], 2),
            },
            "stats": {
                "zhvi": _num(row["zhvi"], 0),
                "appreciation_1yr": _num(row["appreciation_1yr"]),
                "appreciation_5yr": _num(row["appreciation_5yr"]),
                "zori": _num(row["zori"], 0),
                "rent_yield": _num(row["rent_yield"]),
                "days_to_pending": _num(row["days_to_pending"], 1),
                "sale_to_list": _num(row["sale_to_list"]),
                "price_cut_share": _num(row["price_cut_share"]),
                "inventory_yoy": _num(row["inventory_yoy"]),
                "income": _num(row["income"], 0),
                "value_to_income": _num(row["value_to_income"], 2),
                "buy_to_rent": _num(row["buy_to_rent"], 2),
            },
        }
    return {"meta": meta, "zips": zips}


def main() -> dict:
    print("Computing metrics ...")
    m, places, meta = build_metrics()
    print(f"  {len(m)} NJ zips in ZHVI")
    scores = score_dimensions(m)
    out = build_output(m, places, scores, meta)
    config.OUT_DIR.mkdir(parents=True, exist_ok=True)
    dest = config.OUT_DIR / "scores.json"
    dest.write_text(json.dumps(out, separators=(",", ":")))
    print(f"  -> {dest} ({dest.stat().st_size / 1e6:.2f} MB)")
    return out


if __name__ == "__main__":
    main()
