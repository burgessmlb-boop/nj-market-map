"""Sanity checks on the pipeline outputs. Exits non-zero on hard failures."""

import json
import re
import sys
from datetime import date

import config

HARD_FAILURES = []


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


def main() -> None:
    scores_path = config.OUT_DIR / "scores.json"
    geo_path = config.OUT_DIR / "nj_zcta.geojson"

    print("Validating outputs:")
    data = json.loads(scores_path.read_text())
    zips = data["zips"]

    check(len(zips) >= 450, f"zips with ZHVI data: {len(zips)} (want >= 450)")
    bad_zip = [z for z in zips if not re.match(config.ZIP_PREFIX_PATTERN, z)]
    check(not bad_zip, f"all zips match NJ pattern (bad: {bad_zip[:5]})")

    size_mb = scores_path.stat().st_size / 1e6
    check(size_mb < 1.5, f"scores.json size {size_mb:.2f} MB (want < 1.5)")

    if geo_path.exists():
        geo = json.loads(geo_path.read_text())
        n_feat = len(geo["features"])
        check(550 <= n_feat <= 650, f"boundary features: {n_feat} (expect ~595)")
        geo_mb = geo_path.stat().st_size / 1e6
        check(geo_mb < 5, f"nj_zcta.geojson size {geo_mb:.2f} MB (want < 5)")
        geo_zips = {f["properties"]["zip"] for f in geo["features"]}
        missing_geo = len(set(zips) - geo_zips)
        check(missing_geo < 30, f"zips with scores but no polygon: {missing_geo}", hard=False)
    else:
        check(False, "nj_zcta.geojson missing - run `make boundaries`")

    latest = data["meta"]["zillow_latest_month"]
    y, mo = map(int, latest.split("-"))
    age_months = (date.today().year - y) * 12 + date.today().month - mo
    check(age_months <= 3, f"newest Zillow month {latest} ({age_months} months old, want <= 3)")

    for dim in ["overall", "investment", "hotness", "affordability"]:
        vals = [z["scores"][dim] for z in zips.values()]
        n = sum(v is not None for v in vals)
        in_range = all(v is None or 0 <= v <= 100 for v in vals)
        check(in_range, f"{dim}: all scores in [0,100] ({n}/{len(vals)} scored)")

    print("\nMetric coverage (non-null counts):")
    stat_keys = next(iter(zips.values()))["stats"].keys()
    for k in stat_keys:
        n = sum(z["stats"][k] is not None for z in zips.values())
        print(f"  {k:20s} {n:4d}/{len(zips)}")

    print("\nSpot checks:")
    expectations = [
        ("07030", "Hoboken", "high value, low affordability"),
        ("07078", "Short Hills", "very high value"),
        ("08102", "Camden", "low value, high affordability"),
    ]
    for z, name, note in expectations:
        if z not in zips:
            check(False, f"{z} ({name}) present", hard=False)
            continue
        st, sc = zips[z]["stats"], zips[z]["scores"]
        zhvi = f"${st['zhvi']:,.0f}" if st["zhvi"] else "n/a"
        print(f"  {z} {name:12s} zhvi={zhvi:>12s} overall={sc['overall']} "
              f"afford={sc['affordability']}  ({note})")

    hi = [z for z in ("07030", "07078") if z in zips and zips[z]["stats"]["zhvi"]]
    lo = [z for z in ("08102",) if z in zips and zips[z]["stats"]["zhvi"]]
    if hi and lo:
        check(
            min(zips[z]["stats"]["zhvi"] for z in hi) > max(zips[z]["stats"]["zhvi"] for z in lo),
            "rich-town ZHVI exceeds Camden ZHVI",
        )

    for dim in ["overall", "investment", "hotness", "affordability"]:
        print()
        histogram([z["scores"][dim] for z in zips.values()], dim)

    ranked = sorted(
        ((z, d) for z, d in zips.items() if d["scores"]["overall"] is not None),
        key=lambda kv: kv[1]["scores"]["overall"], reverse=True,
    )
    print("\nTop 10 overall:")
    for z, d in ranked[:10]:
        print(f"  {z} {d['city']:20s} {d['scores']['overall']}")
    print("Bottom 10 overall:")
    for z, d in ranked[-10:]:
        print(f"  {z} {d['city']:20s} {d['scores']['overall']}")

    if HARD_FAILURES:
        print(f"\n{len(HARD_FAILURES)} hard failure(s):")
        for f in HARD_FAILURES:
            print(f"  - {f}")
        sys.exit(1)
    print("\nAll validation checks passed.")


if __name__ == "__main__":
    main()
