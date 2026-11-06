import React, { useState, useEffect } from 'react';
import { Activity, AlertTriangle, AlertCircle, RefreshCw } from 'lucide-react';

const DRILLS = [
  {
    id: 'healthy',
    label: 'Healthy',
    badge: 'GO',
    color: 'emerald',
    icon: Activity,
    tooltip: 'All critical sensors fresh (<3h). Normal confidence.',
  },
  {
    id: 'stale',
    label: 'Stale',
    badge: 'CAUTION',
    color: 'amber',
    icon: AlertTriangle,
    tooltip: 'Wave telemetry is 4h old. Degraded confidence advisory.',
  },
  {
    id: 'unavailable',
    label: 'Unavailable',
    badge: 'INSUFF DATA',
    color: 'crimson',
    icon: AlertCircle,
    tooltip: 'Wave feed offline (>6h). Suppresses score & defer to VHF.',
  },
  {
    id: 'recovery',
    label: 'Recovery',
    badge: 'RESTORED',
    color: 'emerald',
    icon: RefreshCw,
    tooltip: 'Wave feed reconnected and verified fresh.',
  },
];

export default function DataDrillBar({ onDrillChange, themeMode = 'ocean' }) {
  const [activeDrill, setActiveDrill] = useState('healthy');
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    // Fetch active drill from backend
    fetch('/api/v1/config/data-health', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.active_drill) {
          setActiveDrill(data.active_drill);
        }
      })
      .catch((err) => console.error('Failed to get data health config:', err));
  }, []);

  const handleSelectDrill = async (drillId) => {
    if (drillId === activeDrill || isUpdating) return;
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/v1/config/data-health?drill=${drillId}`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setActiveDrill(data.active_drill);
        if (onDrillChange) {
          onDrillChange(data.active_drill);
        }
      }
    } catch (err) {
      console.error('Failed to set data drill:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      <div className="hidden lg:flex items-center gap-1.5 mr-1 text-[11px] font-medium text-[#86868b] dark:text-[#A1A1A6]">
        <Activity className="w-3.5 h-3.5 text-[#2997FF]" />
        <span>Telemetry Drill:</span>
      </div>

      <div
        className={`inline-flex items-center p-0.5 sm:p-1 rounded-full border transition-all ${
          themeMode === 'chart'
            ? 'bg-black/[0.04] border-black/[0.08]'
            : 'bg-white/[0.04] border-white/[0.08] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]'
        }`}
      >
        {DRILLS.map((drill) => {
          const isActive = activeDrill === drill.id;
          const Icon = drill.icon;

          return (
            <button
              key={drill.id}
              onClick={() => handleSelectDrill(drill.id)}
              disabled={isUpdating}
              title={drill.tooltip}
              className={`relative px-2 sm:px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-medium transition-all duration-200 flex items-center gap-1.5 select-none active:scale-[0.96] ${
                isActive
                  ? themeMode === 'chart'
                    ? 'bg-white text-[#1D1D1F] shadow-[0_2px_8px_rgba(0,0,0,0.12)]'
                    : 'bg-white/15 text-[#FFFFFF] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.3),0_4px_16px_rgba(0,0,0,0.4)]'
                  : themeMode === 'chart'
                  ? 'text-[#6e6e73] hover:text-[#1d1d1f]'
                  : 'text-[#86868b] hover:text-[#FFFFFF]'
              }`}
            >
              <Icon
                className={`w-3 h-3 ${
                  isActive
                    ? drill.color === 'emerald'
                      ? 'text-[#30D158]'
                      : drill.color === 'amber'
                      ? 'text-[#FF9F0A]'
                      : 'text-[#FF453A]'
                    : 'opacity-60'
                }`}
              />
              <span className="hidden xs:inline">{drill.label}</span>
              <span
                className={`text-[8px] font-bold px-1 py-0.2 rounded-full uppercase tracking-wider ${
                  isActive
                    ? drill.color === 'emerald'
                      ? 'bg-[#30D158]/20 text-[#30D158]'
                      : drill.color === 'amber'
                      ? 'bg-[#FF9F0A]/20 text-[#FF9F0A]'
                      : 'bg-[#FF453A]/20 text-[#FF453A]'
                    : 'opacity-40 bg-black/10 dark:bg-white/10'
                }`}
              >
                {drill.badge}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
