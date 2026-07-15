"""Build web/public/data/nj_zcta.geojson from the Census ZCTA shapefile.

Runs rarely: boundaries only change with a new decennial census.
Requires Node (uses `npx mapshaper` for filtering + simplification).
"""

import subprocess
import sys

import config
import download


def main(force: bool = False) -> None:
    config.RAW_DIR.mkdir(parents=True, exist_ok=True)
    config.OUT_DIR.mkdir(parents=True, exist_ok=True)
    shp = download.download_boundaries(force)
    out = config.OUT_DIR / "nj_zcta.geojson"
    print("Filtering to NJ with mapshaper ...")
    # The 1:500k cartographic file is already generalized; the NJ extract is
    # ~1.2 MB at full detail, so no extra simplification is applied.
    cmd = [
        "npx", "-y", "mapshaper", str(shp),
        "-filter", "GEOID20.match(/^0[78]/) != null",
        "-each", "zip=GEOID20",
        "-filter-fields", "zip",
        "-o", "precision=0.00001", "format=geojson", str(out),
    ]
    subprocess.run(cmd, check=True)
    print(f"  -> {out} ({out.stat().st_size / 1e6:.2f} MB)")


if __name__ == "__main__":
    main(force="--force" in sys.argv)
