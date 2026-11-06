import React, { useState, useEffect } from 'react';
import { Clock, Waves, Wind, AlertTriangle, ShieldCheck, ChevronRight } from 'lucide-react';

export default function HourlyTimeline({ harbourId = 'rameswaram', themeMode = 'ocean' }) {
  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeHour, setActiveHour] = useState(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    fetch(`/api/v1/risk/timeline?harbour_id=${harbourId}&hours=24`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data && data.points) {
          setPoints(data.points);
          // Default active hour to current or dawn
          const nowHour = new Date().getHours();
          const match = data.points.find((p) => p.hour === nowHour) || data.points[0];
          setActiveHour(match);
        }
      })
      .catch((err) => console.error('Failed to load risk timeline:', err))
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [harbourId]);

  if (loading && points.length === 0) {
    return (
      <div className="xdr-surface rounded-2xl p-4 flex items-center justify-center min-h-[140px] animate-pulse">
        <div className="flex items-center gap-2 text-xs text-[#86868b]">
          <Clock className="w-4 h-4 animate-spin text-[#2997FF]" />
          <span>Computing 24-hour sea state trajectory...</span>
        </div>
      </div>
    );
  }

  // Find launch and return windows
  const safePoints = points.filter((p) => p.score <= 35);
  const returnPoint = points.find((p, idx) => idx > 5 && p.score >= 50);

  return (
    <div className="xdr-surface rounded-2xl p-4 transition-all">
      {/* Header bar */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-[#2997FF]/15 flex items-center justify-center">
            <Clock className="w-3.5 h-3.5 text-[#2997FF]" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-semibold tracking-tight text-[#1D1D1F] dark:text-[#FFFFFF]">
              24-Hour Sea-State Trajectory
            </h3>
            <p className="text-[10px] sm:text-[11px] text-[#86868b] dark:text-[#A1A1A6]">
              Hour-by-hour coastal risk & safe navigation window
            </p>
          </div>
        </div>

        {/* Legend pills */}
        <div className="flex items-center gap-1.5 text-[9px] font-medium">
          <span className="flex items-center gap-1 text-[#30D158]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#30D158]" /> Safe (0-25)
          </span>
          <span className="flex items-center gap-1 text-[#FF9F0A] ml-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#FF9F0A]" /> Caution (26-50)
          </span>
          <span className="flex items-center gap-1 text-[#FF453A] ml-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#FF453A]" /> Danger (&gt;50)
          </span>
        </div>
      </div>

      {/* 24 Horizontal Slots Ribbon */}
      <div className="flex items-stretch gap-1.5 overflow-x-auto pb-2 pt-1 touch-momentum scrollbar-none">
        {points.map((pt) => {
          const isSelected = activeHour && activeHour.hour === pt.hour;
          const score = pt.score;
          const isSafe = score <= 25;
          const isCaution = score > 25 && score <= 50;
          const isDanger = score > 50;

          const slotColor = isSafe
            ? 'border-[#30D158]/30 bg-[#30D158]/10 text-[#30D158]'
            : isCaution
            ? 'border-[#FF9F0A]/30 bg-[#FF9F0A]/10 text-[#FF9F0A]'
            : 'border-[#FF453A]/30 bg-[#FF453A]/10 text-[#FF453A]';

          const barColor = isSafe ? 'bg-[#30D158]' : isCaution ? 'bg-[#FF9F0A]' : 'bg-[#FF453A]';

          return (
            <button
              key={pt.hour}
              onClick={() => setActiveHour(pt)}
              className={`flex-shrink-0 w-14 sm:w-16 py-2 px-1 rounded-xl flex flex-col items-center justify-between border transition-all duration-200 active:scale-95 select-none ${slotColor} ${
                isSelected
                  ? 'ring-2 ring-[#2997FF] shadow-[0_4px_16px_rgba(41,151,255,0.25)]'
                  : 'hover:opacity-90'
              }`}
            >
              {/* Hour Label */}
              <span className="text-[10px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#FFFFFF]">
                {String(pt.hour).padStart(2, '0')}:00
              </span>

              {/* Score Bar Indicator */}
              <div className="w-full px-1.5 my-1.5">
                <div className="w-full h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${barColor}`}
                    style={{ width: `${Math.min(100, Math.max(10, score))}%` }}
                  />
                </div>
              </div>

              {/* Wave & Wind Readings */}
              <div className="flex flex-col items-center gap-0.5 text-[9px] font-medium leading-none">
                <span className="text-[#1D1D1F] dark:text-[#E5E5EA]">
                  {pt.wave_height_m?.toFixed(1)}m
                </span>
                <span className="text-[#86868b] dark:text-[#8E8E93] text-[8px]">
                  {pt.wind_speed_kmh?.toFixed(0)}k
                </span>
              </div>

              {/* Special Indicator Badges */}
              {pt.hour === 5 && (
                <span className="mt-1 text-[7px] font-bold px-1 py-0.2 rounded bg-[#30D158]/25 text-[#30D158] uppercase">
                  Launch
                </span>
              )}
              {returnPoint && pt.hour === returnPoint.hour && (
                <span className="mt-1 text-[7px] font-bold px-1 py-0.2 rounded bg-[#FF453A]/25 text-[#FF453A] uppercase">
                  Return
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected Hour Details Callout */}
      {activeHour && (
        <div className="mt-2.5 pt-2.5 border-t border-black/[0.06] dark:border-white/[0.06] flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="font-semibold text-[#1D1D1F] dark:text-[#FFFFFF]">
              {String(activeHour.hour).padStart(2, '0')}:00 IST Window:
            </span>
            <div className="flex items-center gap-1.5">
              <Waves className="w-3.5 h-3.5 text-[#2997FF]" />
              <span className="text-[#86868b] dark:text-[#A1A1A6]">
                Wave: <strong className="text-[#1D1D1F] dark:text-[#FFFFFF]">{activeHour.wave_height_m}m</strong>
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Wind className="w-3.5 h-3.5 text-[#30D158]" />
              <span className="text-[#86868b] dark:text-[#A1A1A6]">
                Wind: <strong className="text-[#1D1D1F] dark:text-[#FFFFFF]">{activeHour.wind_speed_kmh} km/h</strong>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                activeHour.score <= 25
                  ? 'bg-[#30D158]/20 text-[#30D158]'
                  : activeHour.score <= 50
                  ? 'bg-[#FF9F0A]/20 text-[#FF9F0A]'
                  : 'bg-[#FF453A]/20 text-[#FF453A]'
              }`}
            >
              Risk Index {activeHour.score}/100 ({activeHour.category})
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
