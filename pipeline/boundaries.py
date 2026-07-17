"""Build web/public/data/geo_{zip,town,county}.geojson from Census shapefiles.

Runs rarely: boundaries only change with a new decennial census. The outputs
are committed, so the weekly refresh workflow never rebuilds them.
Requires Node (uses `npx mapshaper` for filtering + simplification).
"""

import subprocess
import sys

import config
import download

# Re-simplify if an output exceeds its budget (the 1:500k source is already
# generalized, so this normally doesn't trigger).
SIMPLIFY_PCT = "55%"


def build_level(level: str, force: bool = False) -> None:
    b = config.LEVELS[level]["boundary"]
    shp = download.download_boundaries(level, force)
    out = config.OUT_DIR / f"geo_{level}.geojson"
    budget_mb = config.EXPECTED[level]["geo_mb"]
    print(f"Building {out.name} with mapshaper ...")
    cmd = [
        "npx", "-y", "mapshaper", str(shp),
        "-filter", b["filter"],
        "-each", b["fields"],
        "-filter-fields", "id,name",
        "-o", "precision=0.00001", "format=geojson", str(out),
    ]
    subprocess.run(cmd, check=True)
    size_mb = out.stat().st_size / 1e6
    if size_mb > budget_mb:
        print(f"  {size_mb:.2f} MB exceeds {budget_mb} MB budget; simplifying ...")
        cmd = cmd[:3] + ["-simplify", SIMPLIFY_PCT, "keep-shapes"] + cmd[3:]
        subprocess.run(cmd, check=True)
        size_mb = out.stat().st_size / 1e6
    print(f"  -> {out} ({size_mb:.2f} MB)")


def main(force: bool = False) -> None:
    config.RAW_DIR.mkdir(parents=True, exist_ok=True)
    config.OUT_DIR.mkdir(parents=True, exist_ok=True)
    for level in config.LEVELS:
        build_level(level, force)


if __name__ == "__main__":
    main(force="--force" in sys.argv)
