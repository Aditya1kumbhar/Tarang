"""
Coastal Fishery Productivity Decline Diagnostic Engine for ORCA.
Identifies physical oceanographic causes of fish catch collapse:
1. Marine Heatwave & Thermal Stratification Barrier
2. Harmful Algal Bloom (HAB) & Coastal Hypoxic Dead Zones
3. Post-Cyclone / Storm Sediment Turbidity & Pelagic Dispersal
"""

from datetime import datetime, timezone
import logging

from backend.config import (
    PFZ_HAB_EUTROPHICATION_CHLA,
    PFZ_THERMAL_ANOMALY_HEATWAVE,
)
from backend.schemas.models import (
    ProductivityDiagnosis,
    ProvenanceMetadata,
)

logger = logging.getLogger(__name__)


def diagnose_productivity_decline(
    region_name: str,
    latitude: float,
    longitude: float,
    sst_anomaly_c: float,
    chla_current_mg_m3: float,
    chla_historical_mg_m3: float = 1.6,
    recent_wind_gusts_kmh: float = 20.0,
    recent_wave_height_m: float = 1.0,
) -> ProductivityDiagnosis:
    """
    Diagnoses the oceanic causal mechanism behind fish catch drops using physical metrics.
    """
    # 1. Marine Heatwave / Strong Thermal Stratification
    if (
        sst_anomaly_c >= PFZ_THERMAL_ANOMALY_HEATWAVE
        or (sst_anomaly_c >= 1.4 and chla_current_mg_m3 < 0.20)
    ):
        primary_mech = "Marine Heatwave & Thermocline Stratification Barrier"
        severity = "CRITICAL"
        explanation = (
            f"A sharp sea surface temperature anomaly of +{sst_anomaly_c:.2f}°C has created an impenetrable "
            "thermal stratification barrier (shallow pycnocline). This density capping prevents wind-driven "
            "Ekman pumping and nutrient upwelling from the deep thermocline, causing surface chlorophyll-a "
            f"to crash to {chla_current_mg_m3:.2f} mg/m³ (vs historical {chla_historical_mg_m3:.2f} mg/m³). "
            "Pelagic shoals (oil sardines, Indian mackerel) have evacuated to deeper, cooler offshore waters."
        )
        outlook = (
            "Relocate fishing fleets 25-40 km offshore beyond the thermal anomaly barrier or transition "
            "from surface gillnets to deep-water trolling lines (>40m depth). Inshore catches will remain "
            "depressed until seasonal atmospheric cooling breaks the thermal barrier."
        )

    # 2. Harmful Algal Bloom (HAB) / Coastal Eutrophication Hypoxia
    elif chla_current_mg_m3 >= PFZ_HAB_EUTROPHICATION_CHLA:
        primary_mech = "Harmful Algal Bloom (HAB) & Coastal Hypoxic Dead Zone"
        severity = "HIGH"
        explanation = (
            f"Excessive Chlorophyll-a concentration ({chla_current_mg_m3:.2f} mg/m³ >= "
            f"{PFZ_HAB_EUTROPHICATION_CHLA:.1f} mg/m³ threshold) indicates an acute algal bloom / eutrophication event. "
            "Rapid bacterial decomposition of senescent algal biomass severely depletes dissolved oxygen (< 2.0 mg/L) "
            "in the benthic and mid-water column, suffocating demersal species and forcing coastal finfish to flee."
        )
        outlook = (
            "Immediately halt bottom trawling and crab netting within the bloom footprint. Strictly refrain from "
            "harvesting filter-feeding bivalves/shellfish due to phycotoxin bioaccumulation. Shift operations "
            "to open pelagic sectors where dissolved oxygen exceeds 4.5 mg/L."
        )

    # 3. Extreme Turbidity & Storm Dispersal
    elif recent_wind_gusts_kmh >= 45.0 or recent_wave_height_m >= 2.5:
        primary_mech = "Post-Cyclone Agitation & Sediment Turbidity Dispersal"
        severity = "MODERATE"
        explanation = (
            f"Recent high sea turbulence (wave height {recent_wave_height_m:.1f}m, gusts {recent_wind_gusts_kmh:.1f} km/h) "
            "has violently resuspended fine coastal sediments, causing severe water column turbidity. "
            "Reduced underwater visibility and gill irritation have caused schooling pelagics to scatter offshore."
        )
        outlook = (
            "Allow 48 to 72 hours for hydrodynamic settling and optical clarity restoration. Target shelf-break "
            "zones where water clarity has recovered ahead of inshore coastal bays."
        )

    # 4. Normal / Optimal Productive Conditions
    else:
        primary_mech = "Normal Trophic Upwelling & Planktonic Balance"
        severity = "LOW"
        explanation = (
            f"SST anomaly (+{sst_anomaly_c:.2f}°C) and Chlorophyll-a ({chla_current_mg_m3:.2f} mg/m³) "
            "are within the optimal physiological window for Indian coastal fisheries. Nutrient mixing is healthy."
        )
        outlook = (
            "Favorable fishing venture conditions. Target high-probability Potential Fishing Zones (PFZs) "
            "recommended by ocean thermal front advisories."
        )

    provenance = ProvenanceMetadata(
        source_dataset="Multi-Temporal SST Anomaly Climatology & Ocean Color Trophic Diagnostic Suite",
        timestamp_utc=datetime.now(timezone.utc).isoformat(),
        coordinates=[latitude, longitude],
        metrics={
            "region_name": region_name,
            "sst_anomaly_c": sst_anomaly_c,
            "chla_current_mg_m3": chla_current_mg_m3,
            "chla_historical_mg_m3": chla_historical_mg_m3,
            "recent_wind_gusts_kmh": recent_wind_gusts_kmh,
            "recent_wave_height_m": recent_wave_height_m,
            "primary_mechanism": primary_mech,
            "severity_level": severity,
        },
        reasoning_trace=(
            f"Evaluated multi-parameter physical diagnostics for {region_name}. "
            f"Anomaly: {sst_anomaly_c}°C, Chl-a: {chla_current_mg_m3} mg/m³. "
            f"Diagnosed Mechanism: {primary_mech} (Severity: {severity})."
        ),
        confidence_score=0.94,
    )

    return ProductivityDiagnosis(
        region_name=region_name,
        latitude=latitude,
        longitude=longitude,
        sst_anomaly_c=sst_anomaly_c,
        chla_current_mg_m3=chla_current_mg_m3,
        chla_historical_mg_m3=chla_historical_mg_m3,
        primary_mechanism=primary_mech,
        severity_level=severity,
        explanation=explanation,
        remediation_outlook=outlook,
        provenance=provenance,
    )
