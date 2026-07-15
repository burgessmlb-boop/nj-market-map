"""Download raw data into data/raw/, skipping files fresher than 7 days."""

import io
import os
import sys
import time
import zipfile
from pathlib import Path

import requests

import config

MAX_AGE_SECONDS = 7 * 24 * 3600
CHUNK = 1 << 20  # 1 MB


def _is_fresh(path: Path) -> bool:
    return path.exists() and (time.time() - path.stat().st_mtime) < MAX_AGE_SECONDS


def _stream_download(url: str, dest: Path, label: str) -> None:
    print(f"  downloading {label} ...")
    tmp = dest.with_suffix(dest.suffix + ".part")
    with requests.get(url, stream=True, timeout=300) as resp:
        resp.raise_for_status()
        with open(tmp, "wb") as f:
            for chunk in resp.iter_content(chunk_size=CHUNK):
                f.write(chunk)
    tmp.rename(dest)
    print(f"    -> {dest.name} ({dest.stat().st_size / 1e6:.1f} MB)")


def download_zillow(force: bool = False) -> None:
    for key, (rel_url, label) in config.ZILLOW_DATASETS.items():
        dest = config.RAW_DIR / f"zillow_{key}.csv"
        if not force and _is_fresh(dest):
            print(f"  {dest.name}: fresh, skipping")
            continue
        _stream_download(f"{config.ZILLOW_BASE}/{rel_url}", dest, label)


def download_acs(force: bool = False) -> None:
    dest = config.RAW_DIR / "acs_income.json"
    if not force and _is_fresh(dest):
        print(f"  {dest.name}: fresh, skipping")
        return
    key = os.environ.get("CENSUS_API_KEY", "").strip()
    if not key:
        print(
            "  WARNING: CENSUS_API_KEY is not set. Skipping income download;\n"
            "  affordability scores will be null. Get a free key at\n"
            "  https://api.census.gov/data/key_signup.html and put it in .env"
        )
        return
    _stream_download(f"{config.ACS_URL}&key={key}", dest, "ACS median household income")


def download_boundaries(force: bool = False) -> Path:
    """Fetch and unzip the national ZCTA shapefile; returns the .shp path."""
    shp_dir = config.RAW_DIR / "zcta_shp"
    shp = shp_dir / "cb_2020_us_zcta520_500k.shp"
    if not force and shp.exists():
        print(f"  {shp.name}: already extracted, skipping")
        return shp
    zip_path = config.RAW_DIR / "cb_2020_us_zcta520_500k.zip"
    if force or not zip_path.exists():
        _stream_download(config.ZCTA_SHAPEFILE_URL, zip_path, "Census ZCTA boundary shapefile")
    shp_dir.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path) as zf:
        zf.extractall(shp_dir)
    return shp


def main(force: bool = False) -> None:
    config.RAW_DIR.mkdir(parents=True, exist_ok=True)
    print("Downloading Zillow datasets:")
    download_zillow(force)
    print("Downloading Census income data:")
    download_acs(force)


if __name__ == "__main__":
    main(force="--force" in sys.argv)
