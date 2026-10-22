from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

class SafetyLevel(str, Enum):
    GREEN = "GREEN"
    AMBER = "AMBER"
    RED_ALERT = "RED_ALERT"

class VesselType(str, Enum):
    COUNTRY_CRAFT = "country_craft"
    MECHANIZED_TRAWLER = "mechanized_trawler"

class HarbourID(str, Enum):
    RAMESWARAM = "rameswaram"
    NAGAPATTINAM = "nagapattinam"
    CHENNAI = "chennai"
    KOCHI = "kochi"
    VIZHINJAM = "vizhinjam"
    MANGALURU = "mangaluru"
    MALVAN = "malvan"
    MUMBAI = "mumbai"
    VERAVAL = "veraval"
    VISAKHAPATNAM = "visakhapatnam"
    KAKINADA = "kakinada"
    PARADIP = "paradip"

class ScenarioType(str, Enum):
    SAFE = "safe"
    DANGER = "danger"
    CYCLONE = "cyclone"
    PFZ = "pfz"
    ROUTE = "route"

class BoundaryType(str, Enum):
    IMBL = "IMBL"
    MPA = "MPA"

class EvidenceLedgerEntry(BaseModel):
    parameter_name: str = Field(..., description="Parameter such as SST, Chl-a, Wave Height, Wind, IMBL Proximity")
    source_sensor: str = Field(..., description="Sensor name (e.g. OCM-3, SCAT-3, INSAT-3DS Imager, Open-Meteo)")
    platform_mission: str = Field(..., description="Satellite or platform mission (e.g. ISRO EOS-06, INSAT-3DS, NOAA)")
    timestamp_utc: str = Field(..., description="Observation or forecast UTC timestamp")
    spatial_resolution: str = Field(..., description="Spatial resolution (e.g. 366 m, 2 km, 5 km, 25 km)")
    confidence_tier: str = Field("Higher", description="Lower, Medium, or Higher Possibility")
    data_mode: str = Field("LIVE", description="LIVE, CACHED, or FALLBACK_SNAPSHOT")
    freshness_age_minutes: float = Field(0.0, description="Age of data in minutes")
    station_id: Optional[str] = Field(None, description="In-situ buoy or station identifier")
    anomaly_note: Optional[str] = Field(
        None, 
        description="Domain sensor notes (e.g. 'EOS-06 SSTM scan mechanism inactive; SST fused from INSAT-3DS & MODIS-Aqua')"
    )

class ProvenanceMetadata(BaseModel):
    source_dataset: str = Field(..., description="Satellite, sensor, or API dataset name")
    timestamp_utc: str = Field(..., description="ISO 8601 UTC timestamp of the observation")
    coordinates: Optional[List[float]] = Field(default=None, description="[Latitude, Longitude] or bbox")
    metrics: Dict[str, Any] = Field(default_factory=dict, description="Raw physical measurements")
    reasoning_trace: str = Field(..., description="Deterministic derivation or calculation steps")
    confidence_score: float = Field(..., ge=0.0, le=1.0, description="Confidence in dataset provenance [0-1]")

class HarbourInfo(BaseModel):
    id: str
    name: str
    local_name: str
    state: str
    lat: float
    lon: float
    primary_language: str
    description: Optional[str] = None

class WeatherHazardReport(BaseModel):
    harbour_id: str
    harbour_name: str
    latitude: float
    longitude: float
    vessel_type: VesselType
    safety_status: SafetyLevel
    sea_venture_safety_index: int = Field(default=0, ge=0, le=100, description="Deterministic 0-100 Sea-Venture Safety Index")
    risk_verdict: str = Field(default="LOW", description="LOW, MODERATE, HIGH, EXTREME, or UNKNOWN")
    wave_height_m: float
    wave_direction_deg: float
    wave_period_s: float
    swell_wave_height_m: float
    swell_wave_period_s: float
    wind_speed_kmh: float
    wind_gusts_kmh: float
    cape_j_kg: float
    ocean_current_velocity_ms: float
    weather_code: int
    advisory_message: str
    is_kallakkadal_risk: bool = False
    is_lightning_risk: bool = False
    circuit_breaker_triggered: bool = False
    provenance: ProvenanceMetadata
    evidence_ledger_entry: Optional[EvidenceLedgerEntry] = None

class PFZCandidate(BaseModel):
    zone_id: str
    latitude: float
    longitude: float
    bearing_deg: float
    bearing_cardinal: str
    distance_km: float
    distance_nm: float
    depth_m: float
    sst_c: float
    chla_mg_m3: float
    sst_gradient_c_per_km: float
    pfz_score: float = Field(..., ge=0.0, le=100.0)
    biological_rationale: str
    is_geofence_safe: bool = True
    front_category: str = Field(default="Cayula-Cornillon Bimodal Front", description="Thermal front detection type")
    persistence_days: int = Field(default=7, description="Thermal front 7-day buffer persistence")
    confidence_tier: str = Field(default="Higher Possibility", description="Higher, Medium, or Lower Possibility")
    evidence_ledger_entry: Optional[EvidenceLedgerEntry] = None

class PFZReport(BaseModel):
    harbour_id: str
    candidates: List[PFZCandidate]
    top_recommendation: Optional[PFZCandidate] = None
    provenance: ProvenanceMetadata

class GeofenceAssessment(BaseModel):
    is_violation: bool
    alert_level: str = Field("NONE", description="NONE, WARNING, or CRITICAL")
    boundary_type: Optional[BoundaryType] = None
    boundary_name: Optional[str] = None
    distance_nm: float
    distance_km: float
    warning_directive: Optional[str] = None
    provenance: ProvenanceMetadata

class RouteWaypoint(BaseModel):
    latitude: float
    longitude: float
    distance_from_start_km: float
    wave_height_m: Optional[float] = None
    wind_speed_kmh: Optional[float] = None

class NavigationRoute(BaseModel):
    harbour_id: str
    destination_name: str
    waypoints: List[RouteWaypoint]
    geojson_linestring: Dict[str, Any]
    total_distance_km: float
    total_distance_nm: float
    estimated_hours: float
    fuel_savings_percent: float
    is_safe: bool
    avoided_hazards: List[str] = Field(default_factory=list)
    provenance: ProvenanceMetadata

class ProductivityDiagnosis(BaseModel):
    region_name: str
    latitude: float
    longitude: float
    sst_anomaly_c: float
    chla_current_mg_m3: float
    chla_historical_mg_m3: float
    primary_mechanism: str
    severity_level: str
    explanation: str
    remediation_outlook: str
    provenance: ProvenanceMetadata

class AgentTrace(BaseModel):
    agent_name: str
    task_description: str
    latency_ms: float
    status: str = "COMPLETED"
    input_payload: Dict[str, Any] = Field(default_factory=dict)
    output_summary: str
    confidence_score: float = 1.0
    citations: List[str] = Field(default_factory=list)

class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000, description="User query message, required, max 2000 characters")
    harbour_id: Optional[HarbourID] = HarbourID.RAMESWARAM
    vessel_type: Optional[VesselType] = VesselType.COUNTRY_CRAFT
    language: Optional[str] = Field("en", pattern=r"^(en|ta|ml|te|kn|mr|gu|or|bn|hi)$", description="Supported language code")
    conversation_id: Optional[str] = None

class ChatResponse(BaseModel):
    recommendation: str
    safety_status: SafetyLevel
    sea_venture_safety_index: int = Field(default=0, ge=0, le=100, description="Deterministic 0-100 Sea-Venture Safety Index")
    risk_verdict: str = Field(default="LOW", description="LOW, MODERATE, HIGH, EXTREME, or UNKNOWN")
    safety_override_banner: Optional[str] = None
    evidence_and_reasoning: List[str]
    detected_language: str
    harbour: HarbourInfo
    vessel_type: VesselType
    map_payload: Dict[str, Any] = Field(
        default_factory=lambda: {"type": "FeatureCollection", "features": []}
    )
    agent_traces: List[AgentTrace] = Field(default_factory=list)
    provenance_list: List[ProvenanceMetadata] = Field(default_factory=list)
    evidence_ledger: List[EvidenceLedgerEntry] = Field(default_factory=list)

class DashboardSummaryResponse(BaseModel):
    harbour: HarbourInfo
    weather: WeatherHazardReport
    top_pfz: Optional[PFZCandidate] = None
    geofence: GeofenceAssessment
    safety_override_banner: Optional[str] = None
    map_payload: Dict[str, Any]
    evidence_ledger: List[EvidenceLedgerEntry] = Field(default_factory=list)

class DistrictHarbourSummary(BaseModel):
    harbour_id: str
    harbour_name: str
    local_name: str
    state: str
    lat: float
    lon: float
    safety_index: int = Field(..., ge=0, le=100)
    risk_verdict: str
    safety_status: SafetyLevel
    wave_height_m: float
    wind_speed_kmh: float
    nearest_boundary_distance_nm: float
    active_advisory: str
    circuit_breaker_triggered: bool = False

class DistrictBoardResponse(BaseModel):
    timestamp_utc: str
    total_landing_centres: int
    harbours: List[DistrictHarbourSummary]
