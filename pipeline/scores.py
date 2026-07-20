"""Compute market metrics and 0-100 scores per geography level; emit
scores_{zip,town,county}.json. Scores are percentile-ranked WITHIN each level
(zips among zips, towns among towns, counties among 21 counties)."""

import json
import re
import sys
from datetime import date

import pandas as pd

import config
import towns

DATE_COL = re.compile(r"^\d{4}-\d{2}-\d{2}$")

# Output metric name -> Zillow dataset key (for trends/history extraction).
METRIC_DATASET = {
    "zhvi": "zhvi",
    "zori": "zori",
    "days_to_pending": "dom",
    "price_cut_share": "price_cut",
    "inventory": "inventory",
}


def load_zillow(level: str, key: str) -> pd.DataFrame | None:
    """NJ rows of one Zillow dataset, indexed by the level's geo id:
    zip -> 5-digit zip, town -> RegionID (mapped to GEOID later),
    county -> 5-digit county GEOID. None if the file wasn't downloadable."""
    path = config.RAW_DIR / f"zillow_{level}_{key}.csv"
    if not path.exists():
        if key == "zhvi":
            raise FileNotFoundError(f"{path} missing - run download.py first")
        print(f"  NOTE: {path.name} missing; {key} metrics will be null")
        return None
    df = pd.read_csv(path, dtype={"RegionName": str, "StateCodeFIPS": str,
                                  "MunicipalCodeFIPS": str})
    df = df[df["State"] == config.STATE].copy()
    if level == "zip":
        df["_id"] = df["RegionName"].str.zfill(5)
    elif level == "town":
        df["_id"] = df["RegionID"]
    else:  # county
        df["_id"] = df["StateCodeFIPS"].str.zfill(2) + df["MunicipalCodeFIPS"].str.zfill(3)
    return df.set_index("_id")


def load_level_frames(level: str) -> dict[str, pd.DataFrame | None]:
    """All six datasets for a level. For towns, indices are remapped from
    Zillow RegionID to municipality GEOID; unmatched regions are dropped."""
    frames = {key: load_zillow(level, key) for key in config.ZILLOW_DATASETS}
    if level == "town":
        matched = towns.match_zillow(frames["zhvi"])
        idmap = matched.dropna()
        print(f"  town match: {len(idmap)}/{len(matched)} Zillow city regions -> municipalities")
        for key, df in frames.items():
            if df is None:
                continue
            df = df[df.index.isin(idmap.index)].copy()
            df.index = df.index.map(idmap)
            frames[key] = df
    return frames


def date_cols(df: pd.DataFrame) -> list[str]:
    return sorted(c for c in df.columns if DATE_COL.match(c))


def smoothed(df: pd.DataFrame | None, months_back: int = 0,
             index: pd.Index | None = None) -> pd.Series:
    """Mean of the SMOOTH_MONTHS monthly columns ending `months_back` months
    before the newest column. NaN-filled series when data is missing/short."""
    if df is None:
        return pd.Series(pd.NA, index=index, dtype=float)
    cols = date_cols(df)
    end = len(cols) - months_back
    start = end - config.SMOOTH_MONTHS
    if start < 0:
        return pd.Series(pd.NA, index=df.index, dtype=float)
    return df[cols[start:end]].mean(axis=1, skipna=True)


def monthly_payment(price: pd.Series, rate: float) -> pd.Series:
    """Monthly principal & interest on price at LOAN_TO_VALUE and `rate`."""
    loan = price * config.LOAN_TO_VALUE
    r = rate / 12
    n = 360
    factor = r * (1 + r) ** n / ((1 + r) ** n - 1)
    return loan * factor


def load_acs(level: str) -> pd.DataFrame:
    """ACS variables for a level, indexed by geo id. Empty frame if missing."""
    path = config.RAW_DIR / f"acs_{level}.json"
    if not path.exists():
        print(f"  NOTE: no ACS file for {level}; income and signals will be null")
        return pd.DataFrame()
    rows = json.loads(path.read_text())
    df = pd.DataFrame(rows[1:], columns=rows[0])
    if level == "zip":
        geo = df["zip code tabulation area"]
        df = df[geo.str.match(config.ZIP_PREFIX_PATTERN)].copy()
        ids = df["zip code tabulation area"]
    elif level == "town":
        ids = df["state"] + df["county"] + df["county subdivision"]
    else:  # county
        ids = df["state"] + df["county"]
    out = pd.DataFrame(index=pd.Index(ids.values, name="id"))
    for var in config.ACS_VARS:
        if var not in df.columns:
            continue
        vals = pd.to_numeric(df[var], errors="coerce")
        # Census sentinels for suppressed/unavailable values are large negatives.
        vals[vals < 0] = pd.NA
        out[var] = vals.values
    return out


def load_income(acs: pd.DataFrame) -> pd.Series:
    """ACS median household income indexed by the level's geo id."""
    if acs.empty or config.ACS_INCOME_VAR not in acs.columns:
        return pd.Series(dtype=float, name="income")
    return acs[config.ACS_INCOME_VAR].astype(float).rename("income")


def build_signals(acs: pd.DataFrame, index: pd.Index) -> pd.DataFrame:
    """Off-market opportunity signals as shares (0-1), suppressed where the
    denominator is too small for ACS estimates to mean anything."""
    out = pd.DataFrame(index=index)
    for key, spec in config.ACS_SIGNALS.items():
        if acs.empty or spec["den"] not in acs.columns:
            out[key] = pd.NA
            continue
        den = acs[spec["den"]].reindex(index)
        num = sum(
            acs[v].reindex(index).fillna(0) for v in spec["num"] if v in acs.columns
        )
        share = num / den
        share[den < config.MIN_UNITS_FOR_SIGNAL] = pd.NA
        share[den.isna()] = pd.NA
        out[key] = share
    return out


def build_places(level: str, frames: dict) -> pd.DataFrame:
    """Display names per geo: name (+ city/county/official where applicable)."""
    zhvi = frames["zhvi"]
    if level == "zip":
        places = zhvi[["City", "CountyName"]].fillna("")
        places["name"] = places.index
        places["county"] = places["CountyName"].str.replace(" County", "", regex=False)
        return places[["name", "City", "county"]].rename(columns={"City": "city"})
    if level == "town":
        attrs = towns.attributes().reindex(zhvi.index)
        return pd.DataFrame({
            "name": attrs["NAME"],
            "official": attrs["NAMELSAD"],
            "county": attrs["NAMELSADCO"].str.replace(" County", "", regex=False),
        })
    # county
    return pd.DataFrame({
        "name": zhvi["RegionName"].str.replace(" County", "", regex=False),
    }, index=zhvi.index)


def build_metrics(acs: pd.DataFrame, frames: dict, mortgage_rate: float) -> pd.DataFrame:
    zhvi = frames["zhvi"]
    m = pd.DataFrame(index=zhvi.index)
    m["zhvi"] = smoothed(zhvi)
    m["appreciation_1yr"] = m["zhvi"] / smoothed(zhvi, 12) - 1
    m["appreciation_5yr"] = (m["zhvi"] / smoothed(zhvi, 60)) ** (1 / 5) - 1
    m["zori"] = smoothed(frames["zori"], index=m.index).reindex(m.index)
    m["rent_yield"] = m["zori"] * 12 / m["zhvi"]
    m["days_to_pending"] = smoothed(frames["dom"], index=m.index).reindex(m.index)
    m["price_cut_share"] = smoothed(frames["price_cut"], index=m.index).reindex(m.index)
    m["sale_to_list"] = smoothed(frames["sale_to_list"], index=m.index).reindex(m.index)
    inv_now = smoothed(frames["inventory"], index=m.index)
    inv_yr = smoothed(frames["inventory"], 12, index=m.index)
    m["inventory_yoy"] = (inv_now / inv_yr - 1).reindex(m.index)
    m["income"] = load_income(acs).reindex(m.index)
    m["value_to_income"] = m["zhvi"] / m["income"]
    m["buy_to_rent"] = monthly_payment(m["zhvi"], mortgage_rate) / m["zori"]
    return m


def build_trends(frames: dict, index: pd.Index) -> dict[str, pd.Series]:
    """Precomputed deltas per metric and window, e.g. trends['zhvi__m3']."""
    out = {}
    for metric, kind in config.TREND_METRICS.items():
        df = frames.get(METRIC_DATASET[metric])
        now = smoothed(df, index=index).reindex(index)
        for win, months in config.TREND_WINDOWS.items():
            past = smoothed(df, months, index=index).reindex(index)
            delta = now / past - 1 if kind == "pct" else now - past
            out[f"{metric}__{win}"] = delta
    return out


def build_history(frames: dict, index: pd.Index) -> tuple[dict, str]:
    """Raw monthly values for sparklines: {metric: DataFrame}, history_start."""
    out, start = {}, None
    for metric in config.HISTORY_METRICS:
        df = frames.get(METRIC_DATASET[metric])
        if df is None:
            continue
        cols = date_cols(df)[-config.HISTORY_MONTHS:]
        if not start and cols:
            start = cols[0][:7]
        out[metric] = df[cols].reindex(index)
    return out, start


def score_dimensions(m: pd.DataFrame) -> pd.DataFrame:
    # Percentile-rank every metric within the level, 0-100, higher = better.
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


def build_ranks(scores: pd.DataFrame) -> pd.DataFrame:
    """Ordinal rank per dimension, 1 = best, NA where unscored."""
    ranks = pd.DataFrame(index=scores.index)
    for dim in list(config.OVERALL_WEIGHTS) + ["overall"]:
        ranks[dim] = scores[dim].rank(ascending=False, method="min")
    return ranks


def build_domains(m: pd.DataFrame, trends: dict) -> dict:
    """[p5, p50, p95] per colorable field so the frontend can build MapLibre
    color expressions without scanning. Trend deltas get a symmetric domain
    centered on 0 (they color with a diverging ramp)."""
    domains = {}
    for col in m.columns:
        vals = m[col].dropna()
        if len(vals) >= 5:
            q = vals.quantile([0.05, 0.5, 0.95])
            domains[col] = [_num(q.iloc[0]), _num(q.iloc[1]), _num(q.iloc[2])]
    for field, series in trends.items():
        vals = series.dropna()
        if len(vals) >= 5:
            a = float(vals.abs().quantile(0.95))
            if a > 0:
                domains[field] = [_num(-a), 0, _num(a)]
    return domains


def _num(v, digits=4):
    if v is None or pd.isna(v):
        return None
    v = round(float(v), digits)
    return int(v) if digits == 0 else v


def _int(v):
    if v is None or pd.isna(v):
        return None
    return int(round(float(v)))


def build_signal_pct(signals: pd.DataFrame) -> pd.DataFrame:
    """Percentile-rank each signal within the level (0-100). Higher always means
    'more of this signal', so the frontend can average any mix of checked
    signals into one heat value."""
    pct = pd.DataFrame(index=signals.index)
    for col in signals.columns:
        pct[col] = signals[col].rank(pct=True) * 100
    return pct


def build_output(m, places, scores, ranks, trends, history, signals, signal_pct, meta) -> dict:
    geos = {}
    scored_counts = {d: int(scores[d].notna().sum())
                     for d in ["overall", "investment", "hotness", "affordability"]}
    for g in m.index:
        row, s, r = m.loc[g], scores.loc[g], ranks.loc[g]
        entry = {
            "name": str(places.loc[g, "name"]),
            "scores": {
                "overall": _num(s["overall"], 1),
                "investment": _num(s["investment"], 1),
                "hotness": _num(s["hotness"], 1),
                "affordability": _num(s["affordability"], 1),
            },
            "rank": {k: _int(r[k]) for k in ranks.columns},
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
            "trends": {},
            "history": {},
            # Off-market signals: raw share for display, percentile for blending.
            "signals": {
                k: _num(signals.loc[g, k]) for k in signals.columns
                if not pd.isna(signals.loc[g, k])
            },
            "signal_pct": {
                k: _num(signal_pct.loc[g, k], 1) for k in signal_pct.columns
                if not pd.isna(signal_pct.loc[g, k])
            },
        }
        for col in ("city", "county", "official"):
            if col in places.columns:
                v = places.loc[g, col]
                if isinstance(v, str) and v:
                    entry[col] = v
        for metric in config.TREND_METRICS:
            deltas = {win: _num(trends[f"{metric}__{win}"].get(g))
                      for win in config.TREND_WINDOWS}
            if any(v is not None for v in deltas.values()):
                entry["trends"][metric] = deltas
        for metric, hdf in history.items():
            vals = [_int(v) for v in hdf.loc[g]]
            if any(v is not None for v in vals):
                entry["history"][metric] = vals
        geos[g] = entry
    meta = dict(meta, scored=scored_counts)
    return {"meta": meta, "geos": geos}


def run_level(level: str, mortgage_rate: float) -> None:
    print(f"Computing metrics [{level}] ...")
    frames = load_level_frames(level)
    acs = load_acs(level)
    m = build_metrics(acs, frames, mortgage_rate)
    print(f"  {len(m)} {level} geos in ZHVI")
    places = build_places(level, frames)
    scores = score_dimensions(m)
    ranks = build_ranks(scores)
    trends = build_trends(frames, m.index)
    history, history_start = build_history(frames, m.index)
    signals = build_signals(acs, m.index)
    signal_pct = build_signal_pct(signals)
    covered = {k: int(signals[k].notna().sum()) for k in signals.columns}
    print("  off-market signals: " + ", ".join(f"{k}={v}" for k, v in covered.items()))
    domains = build_domains(m, trends)
    for k in signals.columns:
        vals = signals[k].dropna()
        if len(vals) >= 5:
            q = vals.quantile([0.05, 0.5, 0.95])
            domains[f"signal_{k}"] = [_num(q.iloc[0]), _num(q.iloc[1]), _num(q.iloc[2])]
    meta = {
        "level": level,
        "generated": date.today().isoformat(),
        "zillow_latest_month": date_cols(frames["zhvi"])[-1][:7],
        "acs_year": config.ACS_YEAR,
        "mortgage_rate": round(mortgage_rate, 4),
        "n": int(len(m)),
        "history_start": history_start,
        "history_months": config.HISTORY_MONTHS,
        "domains": domains,
        "signal_coverage": covered,
    }
    out = build_output(m, places, scores, ranks, trends, history, signals, signal_pct, meta)
    config.OUT_DIR.mkdir(parents=True, exist_ok=True)
    dest = config.OUT_DIR / f"scores_{level}.json"
    dest.write_text(json.dumps(out, separators=(",", ":")))
    print(f"  -> {dest} ({dest.stat().st_size / 1e6:.2f} MB)")


def main(levels: list[str] | None = None) -> None:
    import download

    rate = download.fetch_mortgage_rate() or config.MORTGAGE_RATE
    for level in levels or config.LEVELS:
        run_level(level, rate)


if __name__ == "__main__":
    levels = [a for a in sys.argv[1:] if a in config.LEVELS]
    main(levels or None)
