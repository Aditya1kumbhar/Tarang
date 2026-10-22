import React, { useState } from 'react';
import { AlertTriangle, ShieldAlert, ShieldCheck, ChevronDown, ChevronUp, Waves, Wind } from 'lucide-react';

export default function SafetyAlertBanner({ safetyStatus, safetyOverrideBanner, weather, harbour }) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (!safetyStatus || safetyStatus === 'UNKNOWN') return null;

  const isRed = safetyStatus === 'RED_ALERT';
  const isAmber = safetyStatus === 'AMBER';
  const isGreen = safetyStatus === 'GREEN';

  // If green and no override banner, we show a sleek, compact status bar
  if (isGreen && !safetyOverrideBanner) {
    return (
      <div className="bg-black/50 border-b border-emerald-500/20 px-4 py-2 text-xs flex items-center justify-between backdrop-blur-xl">
        <div className="flex items-center gap-2 text-emerald-400">
          <div className="glass-icon glass-icon-emerald w-7 h-7 shrink-0">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          </div>
          <span className="font-medium tracking-tight">Clearance: Normal</span>
          <span className="text-white/20 hidden md:inline">•</span>
          <span className="text-[#86868b] hidden md:inline font-normal">
            Conditions clear off {harbour?.name || 'coast'}.
          </span>
        </div>
        {weather && (
          <div className="flex items-center gap-4 text-[#86868b] text-[11px]">
            <span className="flex items-center gap-1">
              <Waves className="w-3 h-3 text-[#86868b]" /> Waves: <strong className="text-[#f5f5f7] font-medium">{weather.wave_height_m}m</strong>
            </span>
            <span className="flex items-center gap-1">
              <Wind className="w-3 h-3 text-[#86868b]" /> Wind: <strong className="text-[#f5f5f7] font-medium">{weather.wind_speed_kmh} km/h</strong>
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`border-b transition-all duration-300 backdrop-blur-xl ${
        isRed
          ? 'bg-[#120809] border-red-500/30 text-[#f5f5f7]'
          : 'bg-[#141008] border-amber-500/30 text-[#f5f5f7]'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-8 h-8 rounded-lg shrink-0 ${
                isRed
                  ? 'glass-icon glass-icon-red'
                  : 'glass-icon glass-icon-amber'
              }`}
            >
              {isRed ? <ShieldAlert className="w-4 h-4 text-red-400" /> : <AlertTriangle className="w-4 h-4 text-amber-400" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border ${
                    isRed
                      ? 'bg-red-500/15 border-red-500/30 text-red-400'
                      : 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                  }`}
                >
                  {isRed ? 'Circuit Breaker' : 'Caution'}
                </span>
                <span className="text-xs sm:text-sm font-medium tracking-tight">
                  {isRed ? 'Hazardous Sea State' : 'Heightened Risk'}
                </span>
              </div>
              {!isExpanded && (
                <p className="text-xs text-[#86868b] truncate max-w-xl mt-0.5">
                  {safetyOverrideBanner || (isRed ? 'Do not venture into open sea.' : 'Review vessel limits before sailing.')}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {weather && (
              <div className="hidden lg:flex items-center gap-3 text-xs bg-white/[0.04] px-3 py-1 rounded-lg border border-white/[0.08] text-[#86868b]">
                <span className="flex items-center gap-1.5">
                  <Waves className="w-3.5 h-3.5 text-[#86868b]" />
                  <span>Wave: <strong className="font-medium text-[#f5f5f7]">{weather.wave_height_m}m</strong></span>
                </span>
                <span className="text-white/20">|</span>
                <span className="flex items-center gap-1.5">
                  <Wind className="w-3.5 h-3.5 text-[#86868b]" />
                  <span>Wind: <strong className="font-medium text-[#f5f5f7]">{weather.wind_speed_kmh} km/h</strong></span>
                </span>
              </div>
            )}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 rounded-md hover:bg-white/[0.08] text-[#86868b] hover:text-[#f5f5f7] transition-colors"
              title={isExpanded ? 'Collapse Alert' : 'Expand Alert'}
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {isExpanded && safetyOverrideBanner && (
          <div className="mt-2.5 pt-2 border-t border-white/[0.08] text-xs font-normal leading-relaxed bg-black/40 p-3 rounded-lg border border-white/[0.06] text-[#e1e1e6]">
            <p className="whitespace-pre-line font-mono">{safetyOverrideBanner}</p>
          </div>
        )}
      </div>
    </div>
  );
}
