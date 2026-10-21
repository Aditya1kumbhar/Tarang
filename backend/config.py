from dataclasses import dataclass
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"

@dataclass
class VesselThresholds:
    max_wave_height_amber: float
    max_wave_height_red: float
    max_wind_speed_amber: float
    max_wind_speed_red: float
    max_wind_gusts_red: float
    max_cape_red: float
    max_swell_period_red: float

# Safety Limits for Indian Vessel Types
VESSEL_SAFETY_MATRIX = {
    "country_craft": VesselThresholds(
        max_wave_height_amber=1.2,
        max_wave_height_red=1.8,
        max_wind_speed_amber=25.0,
        max_wind_speed_red=35.0,
        max_wind_gusts_red=50.0,
        max_cape_red=1500.0,
        max_swell_period_red=13.0,  # Kallakkadal surge vulnerability
    ),
    "mechanized_trawler": VesselThresholds(
        max_wave_height_amber=2.0,
        max_wave_height_red=2.8,
        max_wind_speed_amber=35.0,
        max_wind_speed_red=45.0,
        max_wind_gusts_red=60.0,
        max_cape_red=2000.0,
        max_swell_period_red=16.0,
    ),
}

# Geofence Distance Thresholds in Nautical Miles & Metres (1 NM = 1852 m)
NM_TO_KM = 1.852
NM_TO_M = 1852.0
GEOFENCE_WARNING_NM = 5.0
GEOFENCE_CRITICAL_NM = 1.5

# Fishermen Sea-Venture Safety Index (0-100) Parameters
RISK_TIER_LOW = 25        # 0-25: Safe
RISK_TIER_MODERATE = 50   # 26-50: Moderate / Caution
RISK_TIER_HIGH = 75       # 51-75: High Risk
# 76-100: Extreme Risk (Hard safety floor triggered)


# Potential Fishing Zone (PFZ) Parameters
PFZ_SST_MIN_OPTIMAL = 25.5
PFZ_SST_MAX_OPTIMAL = 29.2
PFZ_SST_MIN_TOLERANCE = 23.0
PFZ_SST_MAX_TOLERANCE = 31.5
PFZ_FRONT_GRADIENT_THRESHOLD = 0.15  # deg C/km
PFZ_CHLA_MIN_OPTIMAL = 0.4  # mg/m3
PFZ_CHLA_MAX_OPTIMAL = 3.0  # mg/m3
PFZ_HAB_EUTROPHICATION_CHLA = 5.5  # mg/m3 - sign of harmful algal bloom/hypoxia
PFZ_THERMAL_ANOMALY_HEATWAVE = 1.8  # deg C above baseline indicates marine heatwave

# External Data APIs & Resilience Timeouts
OPEN_METEO_MARINE_URL = "https://marine-api.open-meteo.com/v1/marine"
OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
API_TIMEOUT_SECONDS = 4.0

# Paths
HARBOURS_FILE = DATA_DIR / "harbours_india.json"
IMBL_FILE = DATA_DIR / "geofences" / "imbl_lines.geojson"
MPA_FILE = DATA_DIR / "geofences" / "mpa_zones.geojson"
FALLBACK_GRID_FILE = DATA_DIR / "fallback" / "indian_ocean_grid.json"

# API Keys & LLM settings
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
DEFAULT_HARBOUR_ID = "rameswaram"
