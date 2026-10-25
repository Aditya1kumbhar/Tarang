import React, { useEffect } from 'react';
import { X, ShieldCheck, FileText } from 'lucide-react';

export function PrivacyModal({ isOpen, onClose, theme }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isLight = theme === 'chart';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className={`w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden transition-colors ${
          isLight
            ? 'bg-white text-[#1d1d1f] border-black/[0.08]'
            : 'bg-[#121214] text-[#f5f5f7] border-white/[0.1]'
        }`}
      >
        {/* Modal Header */}
        <div
          className={`flex items-center justify-between px-6 py-4 border-b shrink-0 ${
            isLight ? 'border-black/[0.06] bg-black/[0.02]' : 'border-white/[0.06] bg-white/[0.02]'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-sky-500/10 text-sky-500">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-tight">Statutory Privacy Policy</h2>
              <p className="text-[11px] text-[#86868b]">Digital Personal Data Protection (DPDP) Act, 2023</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition ${
              isLight
                ? 'hover:bg-black/[0.06] text-[#86868b] hover:text-[#1d1d1f]'
                : 'hover:bg-white/[0.08] text-[#86868b] hover:text-[#f5f5f7]'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs leading-relaxed text-[#86868b] dark:text-[#a1a1a6]">
          <section className="space-y-1.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#1d1d1f] dark:text-[#f5f5f7]">
              1. Scope and Data Sovereignty
            </h3>
            <p>
              ORCA (Oceanographic Reasoning and Collaborative Agents) operates under strict data minimization
              principles compliant with India's Digital Personal Data Protection (DPDP) Act, 2023. We do not
              collect, store, or sell personal identifiable information (PII), national identity credentials, or
              telecom subscriber identifiers.
            </p>
          </section>

          <section className="space-y-1.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#1d1d1f] dark:text-[#f5f5f7]">
              2. Ephemeral Geolocation Processing
            </h3>
            <p>
              Vessel coordinates and harbour reference points are processed in volatile server memory solely to
              evaluate proximity to maritime geofences (International Maritime Boundary Lines and Marine Protected
              Areas) and compute wave-aware navigation waypoints. Telemetry coordinates are not persisted across
              disconnected sessions.
            </p>
          </section>

          <section className="space-y-1.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#1d1d1f] dark:text-[#f5f5f7]">
              3. Oceanographic and Meteorological Data Sources
            </h3>
            <p>
              Physical marine telemetry (sea surface temperature, significant wave heights, wind vectors, and
              chlorophyll-a concentrations) is retrieved from verified public scientific services including
              Open-Meteo, INCOIS, and ISRO earth observation platforms. No user telemetry is shared with external
              commercial entities.
            </p>
          </section>

          <section className="space-y-1.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#1d1d1f] dark:text-[#f5f5f7]">
              4. Data Retention and Deletion
            </h3>
            <p>
              Chat inquiries and route calculations are cached ephemerally in RAM for up to five minutes solely to
              optimize network efficiency and prevent duplicate computations. Users maintain full rights under
              Section 12 of the DPDP Act 2023 to terminate interactions without persistent profiling.
            </p>
          </section>
        </div>

        {/* Modal Footer */}
        <div
          className={`flex items-center justify-between px-6 py-3 border-t shrink-0 text-[11px] text-[#86868b] ${
            isLight ? 'border-black/[0.06] bg-black/[0.02]' : 'border-white/[0.06] bg-white/[0.02]'
          }`}
        >
          <span>Effective Date: October 2026</span>
          <button
            type="button"
            onClick={onClose}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              isLight
                ? 'bg-black text-white hover:bg-black/90'
                : 'bg-white text-black hover:bg-white/90'
            }`}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

export function TermsModal({ isOpen, onClose, theme }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isLight = theme === 'chart';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className={`w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden transition-colors ${
          isLight
            ? 'bg-white text-[#1d1d1f] border-black/[0.08]'
            : 'bg-[#121214] text-[#f5f5f7] border-white/[0.1]'
        }`}
      >
        {/* Modal Header */}
        <div
          className={`flex items-center justify-between px-6 py-4 border-b shrink-0 ${
            isLight ? 'border-black/[0.06] bg-black/[0.02]' : 'border-white/[0.06] bg-white/[0.02]'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-cyan-500/10 text-cyan-500">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-tight">Terms of Maritime Service</h2>
              <p className="text-[11px] text-[#86868b]">UNCLOS and Directorate General of Shipping Advisory</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition ${
              isLight
                ? 'hover:bg-black/[0.06] text-[#86868b] hover:text-[#1d1d1f]'
                : 'hover:bg-white/[0.08] text-[#86868b] hover:text-[#f5f5f7]'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs leading-relaxed text-[#86868b] dark:text-[#a1a1a6]">
          <section className="space-y-1.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#1d1d1f] dark:text-[#f5f5f7]">
              1. Nature of Advisory Service
            </h3>
            <p>
              ORCA provides algorithmic maritime decision support for Indian coastal fishermen and harbor
              authorities. The system synthesizes oceanographic numerical models with deterministic safety circuit
              breakers. All outputs are advisory in nature and do not replace mandatory navigation watches, marine
              radar, or depth sounders.
            </p>
          </section>

          <section className="space-y-1.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#1d1d1f] dark:text-[#f5f5f7]">
              2. Master of the Vessel Command Authority
            </h3>
            <p>
              Under Regulation 34-1 of the International Convention for the Safety of Life at Sea (SOLAS) and
              relevant provisions of the Indian Merchant Shipping Act, the master, skipper, or craft operator
              retains sole responsibility for vessel handling, crew welfare, and departure authorization.
            </p>
          </section>

          <section className="space-y-1.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#1d1d1f] dark:text-[#f5f5f7]">
              3. Statutory Precedence of Official Warnings
            </h3>
            <p>
              In the event of any divergence between ORCA advisories and statutory cyclone, storm, or Kallakkadal
              bulletins issued by the India Meteorological Department (IMD) or the Indian Coast Guard (ICG),
              statutory governmental notices supersede all platform outputs unconditionally.
            </p>
          </section>

          <section className="space-y-1.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#1d1d1f] dark:text-[#f5f5f7]">
              4. Sovereign Maritime Boundary Adherence
            </h3>
            <p>
              Geofence warnings for the International Maritime Boundary Line (IMBL) in the Palk Bay, Gulf of
              Mannar, and Sir Creek are calculated against official cartographic coordinates. Vessel operators must
              respect maritime sovereignty and avoid crossing into foreign territorial waters under any
              circumstances.
            </p>
          </section>
        </div>

        {/* Modal Footer */}
        <div
          className={`flex items-center justify-between px-6 py-3 border-t shrink-0 text-[11px] text-[#86868b] ${
            isLight ? 'border-black/[0.06] bg-black/[0.02]' : 'border-white/[0.06] bg-white/[0.02]'
          }`}
        >
          <span>Compliance: UNCLOS 1982 / SOLAS V</span>
          <button
            type="button"
            onClick={onClose}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              isLight
                ? 'bg-black text-white hover:bg-black/90'
                : 'bg-white text-black hover:bg-white/90'
            }`}
          >
            Acknowledge
          </button>
        </div>
      </div>
    </div>
  );
}
