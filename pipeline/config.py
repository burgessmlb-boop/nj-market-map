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
# NJ zips are 07xxx and 08xxx; ZCTA GEOIDs share the same prefixes.
ZIP_PREFIX_PATTERN = r"^0[78]\d{3}$"

ZILLOW_BASE = "https://files.zillowstatic.com/research/public_csvs"
ZILLOW_DATASETS = {
    # key: (relative URL, human name)
    "zhvi": ("zhvi/Zip_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv",
             "Zillow Home Value Index (mid-tier, smoothed, seasonally adjusted)"),
    "zori": ("zori/Zip_zori_uc_sfrcondomfr_sm_sa_month.csv",
             "Zillow Observed Rent Index (smoothed, seasonally adjusted)"),
    "dom": ("med_doz_pending/Zip_med_doz_pending_uc_sfrcondo_sm_month.csv",
            "Median days to pending"),
    "price_cut": ("perc_listings_price_cut/Zip_perc_listings_price_cut_uc_sfrcondo_sm_month.csv",
                  "Share of listings with a price cut"),
    "sale_to_list": ("mean_sale_to_list/Zip_mean_sale_to_list_uc_sfrcondo_sm_month.csv",
                     "Mean sale-to-list ratio"),
    "inventory": ("invt_fs/Zip_invt_fs_uc_sfrcondo_sm_month.csv",
                  "For-sale inventory"),
}

ACS_YEAR = 2024
ACS_INCOME_VAR = "B19013_001E"  # median household income
ACS_URL = (
    f"https://api.census.gov/data/{ACS_YEAR}/acs/acs5"
    f"?get=NAME,{ACS_INCOME_VAR}&for=zip%20code%20tabulation%20area:*"
)

ZCTA_SHAPEFILE_URL = "https://www2.census.gov/geo/tiger/GENZ2020/shp/cb_2020_us_zcta520_500k.zip"

# 30-year fixed rate used for the rent-vs-buy affordability metric.
# Hand-tuned in v1; update alongside the monthly data refresh.
MORTGAGE_RATE = 0.0675
LOAN_TO_VALUE = 0.80

# How many trailing monthly columns to average for a "current" reading.
SMOOTH_MONTHS = 3

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
