"""
Agent State and Execution Telemetry Schemas for ORCA.
Provides typed asynchronous state passing across the multi-agent pipeline:
Planner -> Parallel Specialist Agents -> Deterministic Safety Circuit Breaker -> Multilingual Synthesizer.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
from pydantic import BaseModel, Field

from backend.schemas.models import (
    AgentTrace,
    EvidenceLedgerEntry,
    GeofenceAssessment,
    HarbourInfo,
    NavigationRoute,
    PFZReport,
    ProductivityDiagnosis,
    ProvenanceMetadata,
    SafetyLevel,
    VesselType,
    WeatherHazardReport,
)


class OrchestratorState(BaseModel):
    """
    Central typed execution state passed through the multi-agent DAG.
    """
    # 1. Input Context
    conversation_id: str = "default_session"
    query: str
    detected_language: str = "en"
    harbour_id: str = "rameswaram"
    harbour: Optional[HarbourInfo] = None
    vessel_type: VesselType = VesselType.COUNTRY_CRAFT

    # 2. Planner Decomposition
    intent: str = "general_maritime"
    required_agents: List[str] = Field(default_factory=list)
    custom_weather_params: Optional[Dict[str, Any]] = None
    target_dt: Optional[datetime] = None
    target_coordinates: Optional[Tuple[float, float]] = None  # (lat, lon)
    target_name: Optional[str] = None
    target_bearing_deg: Optional[float] = None
    target_distance_nm: Optional[float] = None

    # 3. Specialist Agent Execution Artifacts
    weather_report: Optional[WeatherHazardReport] = None
    pfz_report: Optional[PFZReport] = None
    geofence_assessment: Optional[GeofenceAssessment] = None
    navigation_route: Optional[NavigationRoute] = None
    productivity_diagnosis: Optional[ProductivityDiagnosis] = None

    # 4. Deterministic Safety Circuit Breaker & Index
    circuit_breaker_triggered: bool = False
    safety_status: SafetyLevel = SafetyLevel.GREEN
    sea_venture_safety_index: int = 0
    risk_verdict: str = "LOW"
    safety_override_banner: Optional[str] = None
    override_reasons: List[str] = Field(default_factory=list)

    # 5. Agent Tracing, Evidence Ledger & Provenance
    agent_traces: List[AgentTrace] = Field(default_factory=list)
    provenance_list: List[ProvenanceMetadata] = Field(default_factory=list)
    evidence_ledger: List[EvidenceLedgerEntry] = Field(default_factory=list)

    # 6. Final Synthesized Outputs
    recommendation: str = ""
    evidence_and_reasoning: List[str] = Field(default_factory=list)
    map_payload: Dict[str, Any] = Field(
        default_factory=lambda: {"type": "FeatureCollection", "features": []}
    )
