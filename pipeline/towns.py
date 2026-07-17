"""Match Zillow "City" regions to NJ municipalities (Census county subdivisions).

Zillow city names are informal (and include unincorporated places like Colonia
or Iselin that aren't municipalities); Census county subdivisions tile NJ
completely. Matching is by (county, normalized name), never across counties.
Ambiguous names — two municipalities in one county sharing a name, e.g. a
borough and a township — are NEVER guessed: they stay unmatched until an entry
is added to town_aliases.csv. Unmatched Zillow rows simply don't appear on the
town layer (gray on the map).

Run directly for a match report:  python towns.py
"""

import csv
import re
import subprocess
from pathlib import Path

import pandas as pd

import config
import download

ALIASES_PATH = Path(__file__).resolve().parent / "town_aliases.csv"
ATTRS_PATH = config.RAW_DIR / "cousub_attrs.csv"


def _ensure_attrs() -> pd.DataFrame:
    """Municipality attribute table (GEOID, NAME, NAMELSAD, NAMELSADCO),
    dumped from the cousub shapefile via mapshaper on first use."""
    if not ATTRS_PATH.exists():
        shp = download.download_boundaries("town")
        print("  extracting municipality attributes with mapshaper ...")
        subprocess.run(
            ["npx", "-y", "mapshaper", str(shp), "-o", "format=csv", str(ATTRS_PATH)],
            check=True,
        )
    df = pd.read_csv(ATTRS_PATH, dtype=str)
    # Census uses COUSUBFP 00000 for water/undefined areas.
    return df[df["COUSUBFP"] != "00000"].copy()


def normalize(name: str) -> str:
    """Lowercase, strip punctuation, expand common abbreviations."""
    s = re.sub(r"[^a-z0-9\s]", " ", str(name).lower())
    s = re.sub(r"\bmt\b", "mount", s)
    s = re.sub(r"\btwp\b", "township", s)
    s = re.sub(r"\bboro\b", "borough", s)
    return re.sub(r"\s+", " ", s).strip()


TYPE_WORDS = r"(township|borough|city|town|village)"


def strip_type(s: str) -> str:
    """Drop municipal-type words: 'city of orange' / 'boonton township' -> base name."""
    s = re.sub(rf"^{TYPE_WORDS} of ", "", s)
    s = re.sub(rf" {TYPE_WORDS}$", "", s)
    return s.strip()


def _load_aliases() -> dict[tuple[str, str], str]:
    """(normalized zillow name, county) -> GEOID from the committed alias CSV."""
    if not ALIASES_PATH.exists():
        return {}
    out = {}
    with open(ALIASES_PATH, newline="") as f:
        for row in csv.DictReader(f):
            out[(normalize(row["zillow_name"]), row["county"].strip())] = row["geoid"].strip()
    return out


def build_lookups() -> tuple[dict, dict, pd.DataFrame]:
    """Two match passes: exact normalized names (NAME and NAMELSAD, keeping
    type suffixes so 'Boonton Township' != 'Boonton'), then type-stripped
    names as a fallback. Values are GEOID sets per (county, name) key."""
    attrs = _ensure_attrs()
    exact: dict[tuple[str, str], set] = {}
    stripped: dict[tuple[str, str], set] = {}
    for _, r in attrs.iterrows():
        county, geoid = r["NAMELSADCO"], r["GEOID"]
        names = {normalize(r["NAME"]), normalize(r["NAMELSAD"])}
        for n in names:
            exact.setdefault((county, n), set()).add(geoid)
        for n in {strip_type(n) for n in names}:
            stripped.setdefault((county, n), set()).add(geoid)
    return exact, stripped, attrs


def match_zillow(df: pd.DataFrame, verbose: bool = False) -> pd.Series:
    """Map a Zillow city-level dataframe (indexed by RegionID, with RegionName
    and CountyName columns — city names repeat across counties) to municipality
    GEOIDs. Returns a Series aligned to df.index; NA where no confident match."""
    exact, stripped, attrs = build_lookups()
    aliases = _load_aliases()

    geoids, unmatched, ambiguous = {}, [], []
    for rid, name, county in zip(df.index, df["RegionName"], df["CountyName"]):
        norm = normalize(name)
        alias = aliases.get((norm, county))
        if alias:
            geoids[rid] = alias
            continue
        candidates = exact.get((county, norm)) or stripped.get((county, strip_type(norm))) or set()
        if len(candidates) == 1:
            geoids[rid] = next(iter(candidates))
        elif len(candidates) > 1:
            ambiguous.append((name, county, candidates))
        else:
            unmatched.append((name, county))

    matched = pd.Series(geoids).reindex(df.index)

    # Two Zillow rows landing on one municipality: keep the more significant
    # one (lower SizeRank) so a stray alias can't double-count a town.
    if "SizeRank" in df.columns:
        order = df["SizeRank"].rank(method="first")
        non_na = matched.dropna()
        for geoid in non_na[non_na.duplicated(keep=False)].unique():
            rows = non_na[non_na == geoid].index
            keep = min(rows, key=lambda r: order[r])
            for r in rows:
                if r != keep:
                    matched[r] = pd.NA
                    print(f"  WARNING: {df.loc[r, 'RegionName']} and {df.loc[keep, 'RegionName']}"
                          f" both matched {geoid}; kept {df.loc[keep, 'RegionName']}")

    if verbose:
        n = matched.notna().sum()
        print(f"\nTown match report: {n}/{len(df)} Zillow city rows matched "
              f"({n / len(df):.0%}) covering {n}/{len(attrs)} municipalities")
        if ambiguous:
            print(f"\nAMBIGUOUS (need town_aliases.csv entries) — {len(ambiguous)}:")
            for name, county, cands in ambiguous:
                opts = attrs[attrs["GEOID"].isin(cands)][["GEOID", "NAMELSAD"]]
                pretty = "; ".join(f"{g}={n}" for g, n in opts.itertuples(index=False))
                print(f"  {name} ({county}): {pretty}")
        if unmatched:
            print(f"\nUNMATCHED Zillow rows (likely unincorporated places) — {len(unmatched)}:")
            for name, county in sorted(unmatched, key=lambda x: (x[1], x[0])):
                print(f"  {name} ({county})")
        got = set(matched.dropna())
        missing = attrs[~attrs["GEOID"].isin(got)]
        print(f"\nMunicipalities with no Zillow data — {len(missing)}:")
        for _, r in missing.sort_values(["NAMELSADCO", "NAME"]).iterrows():
            print(f"  {r['NAMELSAD']} ({r['NAMELSADCO']})")

    return matched


def attributes() -> pd.DataFrame:
    """Municipality names indexed by GEOID: NAME, NAMELSAD, NAMELSADCO."""
    attrs = _ensure_attrs()
    return attrs.set_index("GEOID")[["NAME", "NAMELSAD", "NAMELSADCO"]]


def main() -> None:
    path = config.RAW_DIR / "zillow_town_zhvi.csv"
    df = pd.read_csv(path)
    df = df[df["State"] == config.STATE].set_index("RegionID")
    match_zillow(df, verbose=True)


if __name__ == "__main__":
    main()
