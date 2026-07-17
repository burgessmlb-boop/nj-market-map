"""Central configuration for the NJ Real Estate Map data pipeline."""

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

try:
    from dotenv import load_dotenv

    load_dotenv(ROOT / ".env")
except ImportError:
    pass
RAW_DIR = ROOT / "data" / "raw"
OUT_DIR = ROOT / "web" / "public" / "data"

STATE = "NJ"
STATE_FIPS = "34"
# NJ zips are 07xxx and 08xxx; ZCTA GEOIDs share the same prefixes.
ZIP_PREFIX_PATTERN = r"^0[78]\d{3}$"

# NJ's 21 counties: Zillow "CountyName" -> county FIPS (stable since 1970s).
NJ_COUNTY_FIPS = {
    "Atlantic County": "001", "Bergen County": "003", "Burlington County": "005",
    "Camden County": "007", "Cape May County": "009", "Cumberland County": "011",
    "Essex County": "013", "Gloucester County": "015", "Hudson County": "017",
    "Hunterdon County": "019", "Mercer County": "021", "Middlesex County": "023",
    "Monmouth County": "025", "Morris County": "027", "Ocean County": "029",
    "Passaic County": "031", "Salem County": "033", "Somerset County": "035",
    "Sussex County": "037", "Union County": "039", "Warren County": "041",
}

ZILLOW_BASE = "https://files.zillowstatic.com/research/public_csvs"
# {prefix} is the geography level of the file: Zip / City / County / State.
ZILLOW_DATASETS = {
    # key: (relative URL template, human name)
    "zhvi": ("zhvi/{prefix}_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv",
             "Zillow Home Value Index (mid-tier, smoothed, seasonally adjusted)"),
    "zori": ("zori/{prefix}_zori_uc_sfrcondomfr_sm_sa_month.csv",
             "Zillow Observed Rent Index (smoothed, seasonally adjusted)"),
    "dom": ("med_doz_pending/{prefix}_med_doz_pending_uc_sfrcondo_sm_month.csv",
            "Median days to pending"),
    "price_cut": ("perc_listings_price_cut/{prefix}_perc_listings_price_cut_uc_sfrcondo_sm_month.csv",
                  "Share of listings with a price cut"),
    "sale_to_list": ("mean_sale_to_list/{prefix}_mean_sale_to_list_uc_sfrcondo_sm_month.csv",
                     "Mean sale-to-list ratio"),
    "inventory": ("invt_fs/{prefix}_invt_fs_uc_sfrcondo_sm_month.csv",
                  "For-sale inventory"),
}

ACS_YEAR = 2024
ACS_INCOME_VAR = "B19013_001E"  # median household income
ACS_BASE = f"https://api.census.gov/data/{ACS_YEAR}/acs/acs5?get=NAME,{ACS_INCOME_VAR}"

# Geography levels rendered as map layers. Each level gets its own Zillow
# downloads, ACS income pull, boundary geojson, and scores_{level}.json.
LEVELS = {
    "zip": {
        "zillow_prefix": "Zip",
        "acs_for": "&for=zip%20code%20tabulation%20area:*",
        "boundary": {
            "url": "https://www2.census.gov/geo/tiger/GENZ2020/shp/cb_2020_us_zcta520_500k.zip",
            "shp": "cb_2020_us_zcta520_500k.shp",
            "extract_dir": "zcta_shp",
            # National file: keep NJ zips only.
            "filter": "GEOID20.match(/^0[78]/) != null",
            "fields": "id=GEOID20, name=GEOID20",
        },
    },
    "town": {
        "zillow_prefix": "City",
        "acs_for": f"&for=county%20subdivision:*&in=state:{STATE_FIPS}",
        "boundary": {
            "url": f"https://www2.census.gov/geo/tiger/GENZ2023/shp/cb_2023_{STATE_FIPS}_cousub_500k.zip",
            "shp": f"cb_2023_{STATE_FIPS}_cousub_500k.shp",
            "extract_dir": "cousub_shp",
            # State file is already NJ-only; drop Census "undefined" fillers.
            "filter": "COUSUBFP != '00000'",
            "fields": "id=GEOID, name=NAME",
        },
    },
    "county": {
        "zillow_prefix": "County",
        "acs_for": f"&for=county:*&in=state:{STATE_FIPS}",
        "boundary": {
            "url": "https://www2.census.gov/geo/tiger/GENZ2023/shp/cb_2023_us_county_500k.zip",
            "shp": "cb_2023_us_county_500k.shp",
            "extract_dir": "county_shp",
            "filter": f"STATEFP == '{STATE_FIPS}'",
            "fields": "id=GEOID, name=NAME",
        },
    },
}

# Validation expectations and file-size budgets per level.
EXPECTED = {
    "zip": {"min_scored": 450, "features": (550, 650), "scores_mb": 1.5, "geo_mb": 5.0},
    "town": {"min_scored": 300, "features": (555, 580), "scores_mb": 1.5, "geo_mb": 2.5},
    "county": {"min_scored": 21, "features": (21, 21), "scores_mb": 1.5, "geo_mb": 1.0},
}

# 30-year fixed rate for the rent-vs-buy metric. Auto-fetched from FRED each
# refresh; this constant is only the fallback if FRED is unreachable.
FRED_MORTGAGE_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=MORTGAGE30US"
MORTGAGE_RATE = 0.0675
LOAN_TO_VALUE = 0.80

# How many trailing monthly columns to average for a "current" reading.
SMOOTH_MONTHS = 3

# Trend deltas shipped per geo: metric -> delta kind ("pct" = relative change,
# "abs" = simple difference; days/shares are already rates so pct is misleading).
TREND_METRICS = {
    "zhvi": "pct",
    "zori": "pct",
    "days_to_pending": "abs",
    "price_cut_share": "abs",
    "inventory": "pct",
}
TREND_WINDOWS = {"m1": 1, "m3": 3, "m12": 12}

# Monthly history arrays for sparklines (raw values, not smoothed).
HISTORY_MONTHS = 24
HISTORY_METRICS = ["zhvi", "zori"]

# Metric weights per dimension. "invert" means lower raw value = better score.
DIMENSIONS = {
    "investment": {
        "appreciation_1yr": {"weight": 30, "invert": False},
        "appreciation_5yr": {"weight": 20, "invert": False},
        "rent_yield": {"weight": 30, "invert": False},
        "inventory_yoy": {"weight": 20, "invert": True},
    },
    # Zip-level DOM and sale-to-list are sparse in NJ (~130 and ~50 zips), so
    # the broadly-available price-cut and inventory metrics carry more weight;
    # DOM/sale-to-list still sharpen the score where Zillow publishes them.
    "hotness": {
        "days_to_pending": {"weight": 25, "invert": True},
        "sale_to_list": {"weight": 20, "invert": False},
        "price_cut_share": {"weight": 30, "invert": True},
        "inventory_yoy": {"weight": 25, "invert": True},
    },
    "affordability": {
        "value_to_income": {"weight": 60, "invert": True},
        "buy_to_rent": {"weight": 40, "invert": True},
    },
}

OVERALL_WEIGHTS = {"investment": 0.35, "hotness": 0.30, "affordability": 0.35}

# A dimension needs at least this share of its metric weight present to get a score.
MIN_WEIGHT_COVERAGE = 0.5

# --- Market pulse (Redfin county tracker + Zillow state series + FRED rate) ---

# Redfin's maintained public dataset: monthly actual-sales data per county.
# (Their covid-era "weekly_housing_market_data" S3 files froze in 2021.)
REDFIN_TRACKER_URL = (
    "https://redfin-public-data.s3.us-west-2.amazonaws.com/"
    "redfin_market_tracker/county_market_tracker.tsv000.gz"
)
REDFIN_MONTHS = 26
# Redfin publishes ~monthly with some lag; validate hard-fails beyond this.
PULSE_MAX_AGE_DAYS = 90

# Zillow state-level series for the NJ summary strip.
ZILLOW_STATE_DATASETS = {
    "zhvi": ZILLOW_DATASETS["zhvi"],
    "zori": ZILLOW_DATASETS["zori"],
}
