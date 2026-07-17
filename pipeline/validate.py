"""Sanity checks on the pipeline outputs. Exits non-zero on hard failures."""

import json
import re
import sys
from datetime import date

import config

HARD_FAILURES = []
DIMS = ["overall", "investment", "hotness", "affordability"]


def check(ok: bool, msg: str, hard: bool = True) -> None:
    tag = "OK " if ok else ("FAIL" if hard else "WARN")
    print(f"  [{tag}] {msg}")
    if not ok and hard:
        HARD_FAILURES.append(msg)


def histogram(values, label, width=40):
    vals = [v for v in values if v is not None]
    if not vals:
        print(f"  {label}: no data")
        return
    buckets = [0] * 10
    for v in vals:
        buckets[min(int(v // 10), 9)] += 1
    peak = max(buckets)
    print(f"  {label} distribution (n={len(vals)}):")
    for i, b in enumerate(buckets):
        bar = "#" * round(b / peak * width) if peak else ""
        print(f"    {i*10:3d}-{i*10+9:3d} {b:4d} {bar}")


def find(geos: dict, name: str) -> dict | None:
    return next((e for e in geos.values() if e["name"] == name), None)


def validate_level(level: str) -> dict | None:
    exp = config.EXPECTED[level]
    scores_path = config.OUT_DIR / f"scores_{level}.json"
    geo_path = config.OUT_DIR / f"geo_{level}.geojson"
    print(f"\n=== {level} ===")

    if not scores_path.exists():
        check(False, f"{scores_path.name} missing - run scores.py")
        return None
    data = json.loads(scores_path.read_text())
    geos = data["geos"]

    n_scored = sum(1 for e in geos.values() if e["scores"]["overall"] is not None)
    check(n_scored >= exp["min_scored"],
          f"geos with overall score: {n_scored} (want >= {exp['min_scored']})")

    if level == "zip":
        bad = [g for g in geos if not re.match(config.ZIP_PREFIX_PATTERN, g)]
        check(not bad, f"all ids match NJ zip pattern (bad: {bad[:5]})")
    else:
        bad = [g for g in geos if not g.startswith(config.STATE_FIPS)]
        check(not bad, f"all ids are NJ GEOIDs (bad: {bad[:5]})")

    size_mb = scores_path.stat().st_size / 1e6
    check(size_mb < exp["scores_mb"],
          f"{scores_path.name} size {size_mb:.2f} MB (want < {exp['scores_mb']})")

    if geo_path.exists():
        geo = json.loads(geo_path.read_text())
        n_feat = len(geo["features"])
        lo, hi = exp["features"]
        check(lo <= n_feat <= hi, f"boundary features: {n_feat} (expect {lo}-{hi})")
        geo_mb = geo_path.stat().st_size / 1e6
        check(geo_mb < exp["geo_mb"], f"{geo_path.name} size {geo_mb:.2f} MB (want < {exp['geo_mb']})")
        geo_ids = {f["properties"]["id"] for f in geo["features"]}
        orphans = len(set(geos) - geo_ids)
        check(orphans < 30, f"geos with scores but no polygon: {orphans}", hard=False)
    else:
        check(False, f"{geo_path.name} missing - run `make boundaries`")

    latest = data["meta"]["zillow_latest_month"]
    y, mo = map(int, latest.split("-"))
    age_months = (date.today().year - y) * 12 + date.today().month - mo
    check(age_months <= 3, f"newest Zillow month {latest} ({age_months} months old, want <= 3)")

    for dim in DIMS:
        vals = [e["scores"][dim] for e in geos.values()]
        in_range = all(v is None or 0 <= v <= 100 for v in vals)
        n = sum(v is not None for v in vals)
        check(in_range, f"{dim}: all scores in [0,100] ({n}/{len(vals)} scored)")

    # Trend plausibility: annual home-value moves beyond +/-50% mean bad joins.
    wild = [g for g, e in geos.items()
            if (t := e["trends"].get("zhvi", {}).get("m12")) is not None and abs(t) > 0.5]
    check(not wild, f"zhvi 1-yr deltas plausible (wild: {wild[:5]})")

    n_hist = sum(1 for e in geos.values() if e["history"].get("zhvi"))
    bad_hist = [g for g, e in geos.items()
                for vals in [e["history"].get("zhvi")]
                if vals and len(vals) != config.HISTORY_MONTHS]
    check(not bad_hist, f"history arrays are {config.HISTORY_MONTHS} months "
          f"({n_hist} geos with zhvi history; bad: {bad_hist[:3]})")

    domains = data["meta"].get("domains", {})
    need = ["zhvi"] + [f"{m}__{w}" for m in config.TREND_METRICS for w in config.TREND_WINDOWS]
    missing = [f for f in need if f not in domains]
    check(not missing, f"color domains present ({len(domains)} fields; missing: {missing[:4]})",
          hard=level != "county")  # 21 counties can undercut the n>=5 quantile floor

    return data


def spot_checks(all_data: dict) -> None:
    print("\nSpot checks:")
    zips = all_data.get("zip", {}).get("geos", {})
    for z, name, note in [("07030", "Hoboken", "high value"),
                          ("07078", "Short Hills", "very high value"),
                          ("08102", "Camden", "low value")]:
        e = zips.get(z)
        if not e:
            check(False, f"{z} ({name}) present", hard=False)
            continue
        zhvi = e["stats"]["zhvi"]
        print(f"  {z} {name:12s} zhvi={'$' + format(zhvi, ',') if zhvi else 'n/a':>12s} "
              f"overall={e['scores']['overall']}  ({note})")
    hi = [zips[z]["stats"]["zhvi"] for z in ("07030", "07078") if z in zips and zips[z]["stats"]["zhvi"]]
    lo = [zips[z]["stats"]["zhvi"] for z in ("08102",) if z in zips and zips[z]["stats"]["zhvi"]]
    if hi and lo:
        check(min(hi) > max(lo), "rich-zip ZHVI exceeds Camden ZHVI")

    towns = all_data.get("town", {}).get("geos", {})
    hob, cam = find(towns, "Hoboken"), find(towns, "Camden")
    if hob and cam and hob["stats"]["zhvi"] and cam["stats"]["zhvi"]:
        check(hob["stats"]["zhvi"] > cam["stats"]["zhvi"], "Hoboken town ZHVI exceeds Camden town ZHVI")
    else:
        check(False, "Hoboken and Camden towns matched and priced", hard=False)

    counties = all_data.get("county", {}).get("geos", {})
    if "34003" in counties and "34011" in counties:
        check(counties["34003"]["stats"]["zhvi"] > counties["34011"]["stats"]["zhvi"],
              "Bergen county ZHVI exceeds Cumberland county ZHVI")


def validate_pulse() -> None:
    """The pulse is best-effort: missing is a warning, but a stale or
    malformed file fails hard (it means the weekly refresh quietly broke)."""
    print("\n=== pulse ===")
    path = config.OUT_DIR / "pulse.json"
    if not path.exists():
        check(False, "pulse.json missing (weekly pulse not built yet)", hard=False)
        return
    data = json.loads(path.read_text())
    counties = data.get("counties", {})
    check(len(counties) >= 15, f"counties in pulse: {len(counties)} (want >= 15)")
    n_months = min((len(c["months"]) for c in counties.values()), default=0)
    check(n_months >= 10, f"months per county: >= {n_months} (want >= 10)")
    latest = data["meta"]["redfin_latest_month"]
    y, mo = map(int, latest.split("-"))
    age_days = (date.today() - date(y, mo, 1)).days
    check(age_days <= config.PULSE_MAX_AGE_DAYS,
          f"latest Redfin month {latest} ({age_days} days old, "
          f"want <= {config.PULSE_MAX_AGE_DAYS} days)")
    state = data.get("state", {})
    check(state.get("zhvi") is not None and state.get("mortgage_rate") is not None,
          "state summary has zhvi + mortgage rate")


def main() -> None:
    print("Validating outputs:")
    all_data = {}
    for level in config.LEVELS:
        data = validate_level(level)
        if data:
            all_data[level] = data

    validate_pulse()
    spot_checks(all_data)

    if "zip" in all_data:
        geos = all_data["zip"]["geos"]
        for dim in DIMS:
            print()
            histogram([e["scores"][dim] for e in geos.values()], f"zip {dim}")

    for level, data in all_data.items():
        ranked = sorted(
            ((g, e) for g, e in data["geos"].items() if e["scores"]["overall"] is not None),
            key=lambda kv: kv[1]["scores"]["overall"], reverse=True,
        )
        print(f"\nTop 5 {level} overall:")
        for g, e in ranked[:5]:
            label = e["name"] if level != "zip" else f"{g} {e.get('city', '')}"
            print(f"  {label:24s} {e['scores']['overall']}")

    if HARD_FAILURES:
        print(f"\n{len(HARD_FAILURES)} hard failure(s):")
        for f in HARD_FAILURES:
            print(f"  - {f}")
        sys.exit(1)
    print("\nAll validation checks passed.")


if __name__ == "__main__":
    main()
