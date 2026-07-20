"""Download raw data into data/raw/, skipping files fresher than 7 days."""

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


def download_zillow(level: str, force: bool = False) -> None:
    prefix = config.LEVELS[level]["zillow_prefix"]
    for key, (rel_tmpl, label) in config.ZILLOW_DATASETS.items():
        dest = config.RAW_DIR / f"zillow_{level}_{key}.csv"
        if not force and _is_fresh(dest):
            print(f"  {dest.name}: fresh, skipping")
            continue
        url = f"{config.ZILLOW_BASE}/{rel_tmpl.format(prefix=prefix)}"
        try:
            _stream_download(url, dest, f"{label} [{level}]")
        except requests.HTTPError as e:
            # Zillow doesn't publish every dataset at every level; scores.py
            # degrades gracefully via the coverage-weight machinery.
            print(f"  WARNING: {dest.name} unavailable ({e}); skipping this dataset")


def download_acs(level: str, force: bool = False) -> None:
    """Income plus every off-market signal variable, in one request per level."""
    dest = config.RAW_DIR / f"acs_{level}.json"
    if not force and _is_fresh(dest):
        print(f"  {dest.name}: fresh, skipping")
        return
    key = os.environ.get("CENSUS_API_KEY", "").strip()
    if not key:
        print(
            "  WARNING: CENSUS_API_KEY is not set. Skipping Census download;\n"
            "  affordability scores and off-market signals will be null. Get a\n"
            "  free key at https://api.census.gov/data/key_signup.html (.env locally,\n"
            "  and as the CENSUS_API_KEY repo secret for the weekly refresh)"
        )
        return
    url = f"{config.ACS_BASE}{config.LEVELS[level]['acs_for']}&key={key}"
    _stream_download(url, dest, f"ACS income + off-market signals [{level}]")


def fetch_mortgage_rate() -> float | None:
    """Latest 30-yr fixed rate from FRED's keyless CSV endpoint, as a fraction.
    Returns None on any failure; scores.py falls back to config.MORTGAGE_RATE."""
    cache = config.RAW_DIR / "mortgage_rate.txt"
    try:
        resp = requests.get(config.FRED_MORTGAGE_URL, timeout=60)
        resp.raise_for_status()
        lines = [ln for ln in resp.text.strip().splitlines() if "," in ln]
        last_date, last_val = lines[-1].split(",")[:2]
        rate = float(last_val) / 100
        if not 0.005 < rate < 0.20:
            raise ValueError(f"implausible rate {rate}")
        cache.write_text(f"{rate:.6f} {last_date}\n")
        print(f"  FRED 30-yr mortgage rate: {rate:.4%} (as of {last_date})")
        return rate
    except Exception as e:  # network, parse, or plausibility failure
        print(f"  WARNING: FRED rate fetch failed ({e}); using fallback")
        if cache.exists():
            try:
                rate = float(cache.read_text().split()[0])
                print(f"  using cached rate {rate:.4%}")
                return rate
            except (ValueError, IndexError):
                pass
        return None


def download_boundaries(level: str, force: bool = False) -> Path:
    """Fetch and unzip the Census boundary shapefile for a level; returns .shp path."""
    b = config.LEVELS[level]["boundary"]
    shp_dir = config.RAW_DIR / b["extract_dir"]
    shp = shp_dir / b["shp"]
    if not force and shp.exists():
        print(f"  {shp.name}: already extracted, skipping")
        return shp
    zip_path = config.RAW_DIR / Path(b["url"]).name
    if force or not zip_path.exists():
        _stream_download(b["url"], zip_path, f"Census boundary shapefile [{level}]")
    shp_dir.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path) as zf:
        zf.extractall(shp_dir)
    return shp


def main(force: bool = False) -> None:
    config.RAW_DIR.mkdir(parents=True, exist_ok=True)
    for level in config.LEVELS:
        print(f"Downloading Zillow datasets [{level}]:")
        download_zillow(level, force)
        print(f"Downloading Census income data [{level}]:")
        download_acs(level, force)


if __name__ == "__main__":
    main(force="--force" in sys.argv)
