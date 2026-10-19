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
      <div className="bg-emerald-950/60 border-b border-emerald-500/30 px-4 py-2 text-xs flex items-center justify-between backdrop-blur-md">
        <div className="flex items-center gap-2 text-emerald-300">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-semibold uppercase tracking-wider">Sea Venture Clearance: Normal</span>
          <span className="text-emerald-400/70 hidden md:inline">|</span>
          <span className="text-emerald-200/90 hidden md:inline">
            Conditions off {harbour?.name || 'coast'} within safe operating limits.
          </span>
        </div>
        {weather && (
          <div className="flex items-center gap-4 text-emerald-200/80 text-[11px]">
            <span className="flex items-center gap-1">
              <Waves className="w-3 h-3 text-emerald-400" /> Wave: {weather.wave_height_m}m
            </span>
            <span className="flex items-center gap-1">
              <Wind className="w-3 h-3 text-emerald-400" /> Wind: {weather.wind_speed_kmh} km/h
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`border-b transition-all duration-300 backdrop-blur-md ${
        isRed
          ? 'bg-gradient-to-r from-red-950/90 via-red-900/80 to-rose-950/90 border-red-500 text-red-100 shadow-[0_4px_20px_rgba(239,68,68,0.25)]'
          : 'bg-gradient-to-r from-amber-950/90 via-amber-900/80 to-yellow-950/90 border-amber-500 text-amber-100 shadow-[0_4px_20px_rgba(245,158,11,0.2)]'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`p-1.5 rounded-lg shrink-0 ${
                isRed
                  ? 'bg-red-500/20 text-red-400 ring-1 ring-red-500/50 animate-pulse'
                  : 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/50'
              }`}
            >
              {isRed ? <ShieldAlert className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                    isRed ? 'bg-red-600 text-white' : 'bg-amber-500 text-black font-extrabold'
                  }`}
                >
                  {isRed ? 'CRITICAL CIRCUIT BREAKER' : 'CAUTION ADVISORY'}
                </span>
                <span className="text-sm font-semibold tracking-wide">
                  {isRed ? 'HAZARDOUS SEA CONDITIONS / RESTRICTED ZONE' : 'EXERCISE HEIGHTENED CAUTION'}
                </span>
              </div>
              {!isExpanded && (
                <p className="text-xs opacity-90 truncate max-w-xl mt-0.5">
                  {safetyOverrideBanner || (isRed ? 'Do not venture into the open sea.' : 'Review vessel safety limits before sailing.')}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {weather && (
              <div className="hidden lg:flex items-center gap-3 text-xs bg-black/30 px-3 py-1 rounded-md border border-white/10">
                <span className="flex items-center gap-1.5">
                  <Waves className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Wave: <strong className="font-bold">{weather.wave_height_m}m</strong></span>
                </span>
                <span className="text-white/30">|</span>
                <span className="flex items-center gap-1.5">
                  <Wind className="w-3.5 h-3.5 text-sky-400" />
                  <span>Wind: <strong className="font-bold">{weather.wind_speed_kmh} km/h</strong></span>
                </span>
              </div>
            )}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 rounded hover:bg-white/10 text-white/80 transition-colors"
              title={isExpanded ? 'Collapse Alert' : 'Expand Alert'}
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {isExpanded && safetyOverrideBanner && (
          <div className="mt-2.5 pt-2 border-t border-white/10 text-xs sm:text-sm font-medium leading-relaxed bg-black/25 p-2.5 rounded-lg border">
            <p className="whitespace-pre-line font-mono">{safetyOverrideBanner}</p>
          </div>
        )}
      </div>
    </div>
  );
}
