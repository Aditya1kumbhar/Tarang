import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Waves,
  Wind,
  ArrowRight,
  Filter,
  RefreshCw,
  Building2,
  Anchor,
} from 'lucide-react';

export default function DistrictAuthorityBoard({
  vesselType = 'country_craft',
  onSelectHarbour,
  theme = 'chart',
}) {
  const [boardData, setBoardData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [stateFilter, setStateFilter] = useState('ALL');
  const [lastRefreshed, setLastRefreshed] = useState('');

  const fetchBoardData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/v1/district-board?vessel_type=${vesselType}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setBoardData(data);
        setLastRefreshed(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      }
    } catch (err) {
      console.error('Error loading district authority board:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBoardData();
    const interval = setInterval(fetchBoardData, 30000);
    return () => clearInterval(interval);
  }, [vesselType]);

  const harbours = boardData?.harbours || [];
  const states = ['ALL', ...new Set(harbours.map((h) => h.state))];

  const filteredHarbours = stateFilter === 'ALL'
    ? harbours
    : harbours.filter((h) => h.state === stateFilter);

  const redCount = harbours.filter((h) => h.safety_status === 'RED_ALERT' || h.circuit_breaker_triggered).length;
  const amberCount = harbours.filter((h) => h.safety_status === 'AMBER' && !h.circuit_breaker_triggered).length;
  const greenCount = harbours.filter((h) => h.safety_status === 'GREEN').length;

  const isChartTheme = theme === 'chart';

  const getVerdictBadge = (verdict, score) => {
    switch (verdict) {
      case 'EXTREME':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wider xdr-jewel-red">
            <ShieldAlert className="w-3 h-3 text-current" />
            EXTREME ({score})
          </span>
        );
      case 'HIGH':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wider xdr-jewel-amber">
            <AlertTriangle className="w-3 h-3 text-current" />
            HIGH ({score})
          </span>
        );
      case 'MODERATE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wider xdr-jewel-amber">
            MODERATE ({score})
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wider xdr-jewel-emerald">
            <ShieldCheck className="w-3 h-3 text-current" />
            LOW ({score})
          </span>
        );
    }
  };

  return (
    <div className={`flex flex-col h-full w-full overflow-y-auto p-4 md:p-6 pb-28 md:pb-6 touch-momentum transition-colors ${
      isChartTheme ? 'bg-[#F5F5F7] text-[#1D1D1F]' : 'bg-black text-white'
    }`}>
      {/* 1. Header & Quick Metrics */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="glass-icon w-8 h-8 rounded-xl">
              <Building2 className="w-4 h-4 text-[#2997FF]" />
            </div>
            <h2 className="text-lg font-semibold tracking-tight xdr-gradient-text">
              District Board
            </h2>
            <span className="xdr-pill text-[10px] px-2.5 py-0.5 rounded-full font-semibold tracking-wide uppercase text-[#86868b] dark:text-[#A1A1A6]">
              12 Centres
            </span>
          </div>
          <p className="text-xs text-[#86868b] dark:text-[#A1A1A6] mt-0.5 font-normal">
            Fleet status across 12 centres • {lastRefreshed || 'Live'}
          </p>
        </div>

        {/* Action button & refresh */}
        <div className="flex items-center gap-2">
          <button
            onClick={fetchBoardData}
            disabled={isLoading}
            className="xdr-pill px-3.5 py-1.5 rounded-full text-xs font-medium gap-1.5 flex items-center active:scale-[0.96] text-[#1D1D1F] dark:text-white"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* 2. Top Executive Summary Bento Grid (Apple Liquid Retina XDR Hardware Spec Style) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="xdr-surface p-4 rounded-2xl relative">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] block text-[#86868b] dark:text-[#6E6E73]">
              Monitored
            </span>
            <div className="glass-icon w-7 h-7 rounded-lg">
              <Anchor className="w-3.5 h-3.5 text-[#2997FF]" />
            </div>
          </div>
          <span className="text-3xl font-bold tracking-tight mt-1.5 block tabular-nums text-[#1D1D1F] dark:text-white">12</span>
          <span className="text-[11px] text-[#86868b] dark:text-[#A1A1A6] mt-0.5 block">Landing centres</span>
        </div>

        <div className={`p-4 rounded-2xl transition-all relative ${
          redCount > 0
            ? 'xdr-jewel-red'
            : 'xdr-surface'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] block text-[#86868b] dark:text-[#6E6E73]">
              Prohibited
            </span>
            <div className="glass-icon glass-icon-red w-7 h-7 rounded-lg">
              <ShieldAlert className="w-3.5 h-3.5 text-current" />
            </div>
          </div>
          <span className="text-3xl font-bold tracking-tight mt-1.5 block tabular-nums">{redCount}</span>
          <span className="text-[11px] text-[#86868b] dark:text-[#A1A1A6] mt-0.5 block">{redCount > 0 ? 'Banned' : 'None'}</span>
        </div>

        <div className={`p-4 rounded-2xl transition-all relative ${
          amberCount > 0
            ? 'xdr-jewel-amber'
            : 'xdr-surface'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] block text-[#86868b] dark:text-[#6E6E73]">
              Caution
            </span>
            <div className="glass-icon glass-icon-amber w-7 h-7 rounded-lg">
              <AlertTriangle className="w-3.5 h-3.5 text-current" />
            </div>
          </div>
          <span className="text-3xl font-bold tracking-tight mt-1.5 block tabular-nums">{amberCount}</span>
          <span className="text-[11px] text-[#86868b] dark:text-[#A1A1A6] mt-0.5 block">{amberCount > 0 ? 'Advisory' : 'None'}</span>
        </div>

        <div className="xdr-surface p-4 rounded-2xl relative">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] block text-[#86868b] dark:text-[#6E6E73]">
              Clear
            </span>
            <div className="glass-icon glass-icon-emerald w-7 h-7 rounded-lg">
              <ShieldCheck className="w-3.5 h-3.5 text-current" />
            </div>
          </div>
          <span className="text-3xl font-bold tracking-tight text-[#16803D] dark:text-[#30D158] mt-1.5 block tabular-nums">{greenCount}</span>
          <span className="text-[11px] text-[#86868b] dark:text-[#A1A1A6] mt-0.5 block">Permitted</span>
        </div>
      </div>

      {/* 3. State Filter Bar */}
      <div className="flex items-center gap-1.5 flex-wrap mb-4">
        <span className="text-xs font-semibold text-[#86868b] dark:text-[#6E6E73] flex items-center gap-1 mr-2 uppercase tracking-wider text-[10px]">
          <Filter className="w-3 h-3 text-[#2997FF]" />
          State:
        </span>
        {states.map((st) => (
          <button
            key={st}
            onClick={() => setStateFilter(st)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition active:scale-[0.96] ${
              stateFilter === st
                ? 'bg-[#0071E3] dark:bg-[#2997FF] text-white shadow-xs'
                : 'xdr-pill text-[#86868b] dark:text-[#A1A1A6] hover:text-[#1D1D1F] dark:hover:text-white'
            }`}
          >
            {st}
          </button>
        ))}
      </div>

      {/* 4. Mobile Responsive Harbour Cards (< md) */}
      <div className="md:hidden space-y-2.5 mb-6">
        {filteredHarbours.map((h) => {
          const isRed = h.safety_status === 'RED_ALERT' || h.circuit_breaker_triggered;
          return (
            <div
              key={h.harbour_id}
              className={`p-3.5 rounded-2xl border transition-all ${
                isChartTheme
                  ? 'bg-white border-black/[0.08] shadow-xs'
                  : 'xdr-surface'
              } ${isRed ? (isChartTheme ? 'bg-red-500/5 border-red-500/20' : 'bg-red-950/20 border-red-500/30 shadow-[0_0_20px_rgba(255,69,58,0.15)]') : ''}`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <div className="glass-icon w-7 h-7 shrink-0 rounded-lg">
                    <Anchor className="w-3.5 h-3.5 text-[#2997FF]" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-xs tracking-tight text-[#1D1D1F] dark:text-white">{h.harbour_name}</h3>
                    <p className="text-[10px] text-[#86868b] dark:text-[#A1A1A6]">{h.local_name} • {h.state}</p>
                  </div>
                </div>
                {getVerdictBadge(h.risk_verdict, h.safety_index)}
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] mb-2.5 py-1.5 px-2.5 rounded-xl xdr-pill">
                <div className="flex items-center gap-1.5">
                  <Waves className="w-3.5 h-3.5 text-[#2997FF]" />
                  <span className="tabular-nums">{h.wave_height_m}m waves</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Wind className="w-3.5 h-3.5 text-[#2997FF]" />
                  <span className="tabular-nums">{h.wind_speed_kmh} km/h wind</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-0.5">
                <span className="text-[10px] text-[#86868b] dark:text-[#A1A1A6]">
                  {h.nearest_boundary_distance_nm <= 1.5 ? (
                    <strong className="text-red-400 font-medium">Border Alert: {h.nearest_boundary_distance_nm.toFixed(1)} NM</strong>
                  ) : (
                    <span>Clearance: {h.nearest_boundary_distance_nm.toFixed(1)} NM</span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => onSelectHarbour && onSelectHarbour(h.harbour_id)}
                  className="xdr-pill px-3 py-1 text-xs font-medium gap-1 text-[#0071E3] dark:text-[#2997FF] rounded-full flex items-center active:scale-[0.96]"
                >
                  <span>Inspect</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 5. Desktop High-Density Authority Matrix Table (>= md) */}
      <div className={`hidden md:block rounded-2xl border overflow-hidden transition-all ${
        isChartTheme ? 'border-black/[0.08] bg-white shadow-xs' : 'xdr-surface'
      }`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className={`border-b text-[10px] uppercase font-semibold tracking-[0.08em] ${
                isChartTheme ? 'bg-black/[0.02] border-black/[0.06] text-[#86868b]' : 'bg-white/[0.03] border-white/[0.06] text-[#86868b] dark:text-[#6E6E73]'
              }`}>
                <th className="py-3.5 px-4 font-semibold">Landing Centre</th>
                <th className="py-3.5 px-4 font-semibold">State</th>
                <th className="py-3.5 px-4 font-semibold">Safety Index (0-100)</th>
                <th className="py-3.5 px-4 font-semibold">Verdict</th>
                <th className="py-3.5 px-4 font-semibold">Wave & Wind</th>
                <th className="py-3.5 px-4 font-semibold">Boundary Clearance</th>
                <th className="py-3.5 px-4 font-semibold text-right">Command Action</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isChartTheme ? 'divide-black/[0.04]' : 'divide-white/[0.04]'}`}>
              {filteredHarbours.map((h) => {
                const isRed = h.safety_status === 'RED_ALERT' || h.circuit_breaker_triggered;
                return (
                  <tr
                    key={h.harbour_id}
                    className={`transition ${
                      isChartTheme
                        ? 'hover:bg-black/[0.02]'
                        : 'hover:bg-white/[0.02]'
                    } ${isRed ? (isChartTheme ? 'bg-red-500/5' : 'bg-red-950/15') : ''}`}
                  >
                    {/* Landing Centre */}
                    <td className="py-3 px-4">
                      <div className="font-medium flex items-center gap-2">
                        <div className="glass-icon w-6 h-6 shrink-0">
                          <Anchor className="w-3 h-3 text-[#2997ff]" />
                        </div>
                        <span className="text-sm font-medium tracking-[-0.02em]">{h.harbour_name}</span>
                      </div>
                      <span className="text-[11px] block mt-0.5 text-[#86868b] tracking-[-0.01em]">
                        {h.local_name}
                      </span>
                    </td>

                    {/* State */}
                    <td className="py-3 px-4 font-normal text-[#86868b] tracking-[-0.01em]">
                      {h.state}
                    </td>

                    {/* Safety Index Gauge */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono font-medium text-sm w-7 tabular-nums tracking-tight">
                          {h.safety_index}
                        </span>
                        <div className="w-24 h-1.5 bg-black/[0.08] dark:bg-white/[0.08] rounded-full overflow-hidden shrink-0">
                          <div
                            className={`h-full ${
                              h.safety_index >= 76
                                ? 'bg-red-500'
                                : h.safety_index >= 51
                                ? 'bg-amber-500'
                                : h.safety_index >= 26
                                ? 'bg-amber-400'
                                : 'bg-emerald-400'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(5, h.safety_index))}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Verdict */}
                    <td className="py-3 px-4">
                      {getVerdictBadge(h.risk_verdict, h.safety_index)}
                    </td>

                    {/* Wave & Wind */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3 font-mono text-[11px] text-[#86868b] tracking-[0.02em] tabular-nums">
                        <span className="flex items-center gap-1 text-[#f5f5f7]">
                          <Waves className="w-3 h-3 text-[#86868b]" />
                          {h.wave_height_m}m
                        </span>
                        <span className="flex items-center gap-1 text-[#f5f5f7]">
                          <Wind className="w-3 h-3 text-[#86868b]" />
                          {h.wind_speed_kmh} km/h
                        </span>
                      </div>
                    </td>

                    {/* Boundary Clearance */}
                    <td className="py-3 px-4 font-mono text-[11px] tracking-[0.02em] tabular-nums">
                      <span className={h.nearest_boundary_distance_nm <= 1.5 ? 'text-red-400 font-medium' : 'text-[#86868b]'}>
                        {h.nearest_boundary_distance_nm.toFixed(1)} NM
                      </span>
                    </td>

                    {/* Command Action */}
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => onSelectHarbour && onSelectHarbour(h.harbour_id)}
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium transition shadow-sm ${
                          isChartTheme
                            ? 'bg-black/[0.04] hover:bg-black/[0.08] text-[#1d1d1f] border border-black/[0.08]'
                            : 'bg-white/[0.08] hover:bg-white/[0.14] text-[#f5f5f7] border border-white/[0.1]'
                        }`}
                        title={`Focus ${h.harbour_name} in Fisher View`}
                      >
                        <span>Inspect</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
