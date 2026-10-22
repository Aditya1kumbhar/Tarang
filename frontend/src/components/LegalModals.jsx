import React from 'react';
import { X, Shield, FileText, Lock, AlertCircle, Check } from 'lucide-react';

export function PrivacyPolicyModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-fade-in select-none">
      <div className="w-full max-w-2xl max-h-[85vh] bg-[#141417] border border-white/[0.1] rounded-2xl shadow-2xl flex flex-col text-[#f5f5f7]">
        {/* Header */}
        <div className="p-4 border-b border-white/[0.08] bg-black/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="glass-icon glass-icon-blue w-8 h-8">
              <Lock className="w-4 h-4 text-[#2997ff]" />
            </div>
            <div>
              <h2 className="font-semibold text-xs text-[#f5f5f7] tracking-tight uppercase">
                Privacy Policy
              </h2>
              <p className="text-[11px] text-[#86868b]">
                ORCA Maritime Intelligence Platform • Effective Date: October 2026
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="glass-icon w-8 h-8 text-[#86868b] hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs leading-relaxed text-[#d1d1d6]">
          <div>
            <h3 className="font-medium text-[#f5f5f7] text-sm mb-1">1. Scope and Statutory Compliance</h3>
            <p>
              This Privacy Policy governs the processing of spatial coordinates, harbour selections, and operational vessel telemetry within the ORCA (Oceanographic Reasoning & Collaborative Agents) maritime decision-support platform. ORCA operates in strict adherence to the Indian Digital Personal Data Protection Act (DPDP Act, 2023) and standard maritime data safety conventions.
            </p>
          </div>

          <div>
            <h3 className="font-medium text-[#f5f5f7] text-sm mb-1">2. Telemetry and Spatial Data Collection</h3>
            <p>
              ORCA processes only operational data strictly necessary for marine safety and navigation recommendations:
            </p>
            <ul className="list-disc list-inside mt-1.5 space-y-1 text-[#86868b]">
              <li>Landing harbour selection and vessel type classification (Country Craft vs. Mechanized Trawler).</li>
              <li>Requested offshore target coordinates and geodesic waypoints for A* route pathfinding.</li>
              <li>Live atmospheric and oceanographic measurements queried anonymously via open satellite telemetry (Open-Meteo and ERDDAP).</li>
            </ul>
          </div>

          <div>
            <h3 className="font-medium text-[#f5f5f7] text-sm mb-1">3. Zero Cross-Site Tracking and Ephemeral Storage</h3>
            <p>
              ORCA does not utilize commercial advertising cookies, tracking pixels, or third-party behavioral analytics scripts. All calculations, geofence evaluations, and multilingual syntheses are executed ephemerally in active memory. No persistent personal user identity is sold, distributed, or profiled.
            </p>
          </div>

          <div>
            <h3 className="font-medium text-[#f5f5f7] text-sm mb-1">4. Local Browser Persistence</h3>
            <p>
              Session state (such as selected language and landing harbour preferences) is held strictly in volatile component state or browser local storage and remains entirely within the user device.
            </p>
          </div>

          <div>
            <h3 className="font-medium text-[#f5f5f7] text-sm mb-1">5. Contact and Maritime Data Officer</h3>
            <p>
              For security disclosures or operational data inquiries, contact the platform maintainers at: 
              <span className="text-[#2997ff] font-mono ml-1">maritime-safety@orca.marine.gov.in</span>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-white/[0.08] bg-black/40 flex items-center justify-between">
          <span className="text-[11px] text-[#86868b] font-mono">
            Zero Tracking • DPDP Act Compliant
          </span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-white text-black font-medium text-xs transition hover:bg-white/90 shadow-sm"
          >
            Acknowledge
          </button>
        </div>
      </div>
    </div>
  );
}

export function TermsConditionsModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-fade-in select-none">
      <div className="w-full max-w-2xl max-h-[85vh] bg-[#141417] border border-white/[0.1] rounded-2xl shadow-2xl flex flex-col text-[#f5f5f7]">
        {/* Header */}
        <div className="p-4 border-b border-white/[0.08] bg-black/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="glass-icon glass-icon-blue w-8 h-8">
              <FileText className="w-4 h-4 text-[#2997ff]" />
            </div>
            <div>
              <h2 className="font-semibold text-xs text-[#f5f5f7] tracking-tight uppercase">
                Terms and Conditions
              </h2>
              <p className="text-[11px] text-[#86868b]">
                ORCA Operational Maritime Terms of Use • Effective Date: October 2026
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="glass-icon w-8 h-8 text-[#86868b] hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs leading-relaxed text-[#d1d1d6]">
          <div>
            <h3 className="font-medium text-[#f5f5f7] text-sm mb-1">1. Advisory Operational Nature</h3>
            <p>
              ORCA provides computational maritime advisory recommendations derived from satellite sea surface temperature (SST), chlorophyll-a gradients, deterministic mathematical front analysis, and numerical weather prediction. While algorithms enforce strict physical safety thresholds, ORCA is a secondary decision-support instrument. Primary navigational responsibility and seaworthiness discretion remain solely with the master, skipper, or vessel commander.
            </p>
          </div>

          <div>
            <h3 className="font-medium text-[#f5f5f7] text-sm mb-1">2. Maritime Border and IMBL Compliance</h3>
            <p>
              Vessel operators must strictly observe International Maritime Boundary Lines (IMBL), including the Indo-Sri Lanka and Indo-Pakistan maritime borders established under bilateral agreements and UNCLOS (1982). ORCA incorporates an automated 1.5 NM circuit breaker and 5.0 NM alert buffer. Crossing sovereign maritime borders without formal authorization is strictly illegal and subject to immediate coastal enforcement.
            </p>
          </div>

          <div>
            <h3 className="font-medium text-[#f5f5f7] text-sm mb-1">3. Marine Protected Areas (MPA)</h3>
            <p>
              Commercial trawling, motorized netting, and benthic extraction are strictly prohibited within statutory Marine Protected Areas, including the Gulf of Mannar Marine National Park, Malvan Marine Sanctuary, Gahirmatha, and Coringa Wildlife Sanctuary under the Wildlife (Protection) Act, 1972. ORCA automatically quarantines and disqualifies candidate fishing zones within designated MPA boundaries.
            </p>
          </div>

          <div>
            <h3 className="font-medium text-[#f5f5f7] text-sm mb-1">4. Severe Weather and Circuit Breakers</h3>
            <p>
              When ORCA returns a RED ALERT or when significant wave height exceeds critical limits (1.8m for artisanal country crafts, 2.8m for mechanized trawlers), all sea venture advice is revoked by safety circuit breaker. Seafarers must heed official Indian Coast Guard and IMD weather advisories.
            </p>
          </div>

          <div>
            <h3 className="font-medium text-[#f5f5f7] text-sm mb-1">5. No Warranty</h3>
            <p>
              ORCA is provided on an "as-is" and "as-available" basis for navigational aid. The developers, coastal authorities, and researchers accept no liability for loss, damage, or vessel incidents resulting from maritime venture decisions.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-white/[0.08] bg-black/40 flex items-center justify-between">
          <span className="text-[11px] text-[#86868b] font-mono">
            UNCLOS & Coast Guard Regulated
          </span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-white text-black font-medium text-xs transition hover:bg-white/90 shadow-sm"
          >
            Agree and Proceed
          </button>
        </div>
      </div>
    </div>
  );
}
