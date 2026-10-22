import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Waves,
  Wind,
  Compass,
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
      const res = await fetch(`/api/v1/district-board?vessel_type=${vesselType}`);
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
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/30">
            <ShieldAlert className="w-3 h-3 text-current" />
            EXTREME ({score})
          </span>
        );
      case 'HIGH':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
            <AlertTriangle className="w-3 h-3 text-current" />
            HIGH ({score})
          </span>
        );
      case 'MODERATE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
            MODERATE ({score})
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
            <ShieldCheck className="w-3 h-3 text-current" />
            LOW ({score})
          </span>
        );
    }
  };

  return (
    <div className={`flex flex-col h-full w-full overflow-y-auto p-4 md:p-6 transition-colors ${
      isChartTheme ? 'bg-[#f5f5f7] text-[#1d1d1f]' : 'bg-[#0a0a0c] text-[#f5f5f7]'
    }`}>
      {/* 1. Header & Quick Metrics */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="glass-icon w-8 h-8">
              <Building2 className="w-4 h-4 text-[#2997ff]" />
            </div>
            <h2 className="text-lg font-semibold tracking-tight">
              District Board
            </h2>
            <span className={`text-[10px] px-2 py-0.5 rounded font-medium tracking-wide uppercase border ${
              isChartTheme ? 'bg-black/[0.04] text-[#86868b] border-black/[0.08]' : 'bg-white/[0.06] text-[#86868b] border-white/[0.1]'
            }`}>
              12 Centres
            </span>
          </div>
          <p className="text-xs text-[#86868b] mt-0.5 font-normal">
            Fleet status across 12 centres • {lastRefreshed || 'Live'}
          </p>
        </div>

        {/* Action button & refresh */}
        <div className="flex items-center gap-2">
          <button
            onClick={fetchBoardData}
            disabled={isLoading}
            className="glass-icon px-3 py-1.5 text-xs font-medium gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* 2. Top Executive Summary Tiles (Apple Tech Specs Style with Glassmorphic Icons) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className={`p-4 rounded-xl border transition-colors relative ${
          isChartTheme ? 'bg-white border-black/[0.08] shadow-sm' : 'bg-white/[0.04] border-white/[0.08]'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium uppercase tracking-wider block text-[#86868b]">
              Monitored
            </span>
            <div className="glass-icon w-7 h-7">
              <Anchor className="w-3.5 h-3.5 text-[#2997ff]" />
            </div>
          </div>
          <span className="text-3xl font-semibold tracking-tight mt-1.5 block">12</span>
          <span className="text-[11px] text-[#86868b] mt-0.5 block">Landing centres</span>
        </div>

        <div className={`p-4 rounded-xl border transition-colors relative ${
          redCount > 0
            ? 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400'
            : (isChartTheme ? 'bg-white border-black/[0.08] shadow-sm' : 'bg-white/[0.04] border-white/[0.08]')
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium uppercase tracking-wider block text-[#86868b]">
              Prohibited
            </span>
            <div className="glass-icon glass-icon-red w-7 h-7">
              <ShieldAlert className="w-3.5 h-3.5 text-current" />
            </div>
          </div>
          <span className="text-3xl font-semibold tracking-tight mt-1.5 block">{redCount}</span>
          <span className="text-[11px] text-[#86868b] mt-0.5 block">{redCount > 0 ? 'Banned' : 'None'}</span>
        </div>

        <div className={`p-4 rounded-xl border transition-colors relative ${
          amberCount > 0
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400'
            : (isChartTheme ? 'bg-white border-black/[0.08] shadow-sm' : 'bg-white/[0.04] border-white/[0.08]')
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium uppercase tracking-wider block text-[#86868b]">
              Caution
            </span>
            <div className="glass-icon glass-icon-amber w-7 h-7">
              <AlertTriangle className="w-3.5 h-3.5 text-current" />
            </div>
          </div>
          <span className="text-3xl font-semibold tracking-tight mt-1.5 block">{amberCount}</span>
          <span className="text-[11px] text-[#86868b] mt-0.5 block">{amberCount > 0 ? 'Advisory' : 'None'}</span>
        </div>

        <div className={`p-4 rounded-xl border transition-colors relative ${
          isChartTheme ? 'bg-white border-black/[0.08] shadow-sm' : 'bg-white/[0.04] border-white/[0.08]'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium uppercase tracking-wider block text-[#86868b]">
              Clear
            </span>
            <div className="glass-icon glass-icon-emerald w-7 h-7">
              <ShieldCheck className="w-3.5 h-3.5 text-current" />
            </div>
          </div>
          <span className="text-3xl font-semibold tracking-tight text-emerald-700 dark:text-emerald-400 mt-1.5 block">{greenCount}</span>
          <span className="text-[11px] text-[#86868b] mt-0.5 block">Permitted</span>
        </div>
      </div>

      {/* 3. State Filter Bar */}
      <div className="flex items-center gap-1.5 flex-wrap mb-4">
        <span className="text-xs font-medium text-[#86868b] flex items-center gap-1 mr-2">
          <Filter className="w-3.5 h-3.5" />
          State:
        </span>
        {states.map((st) => (
          <button
            key={st}
            onClick={() => setStateFilter(st)}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
              stateFilter === st
                ? (isChartTheme ? 'bg-[#1d1d1f] text-white shadow-sm' : 'bg-white text-black shadow-sm')
                : (isChartTheme ? 'bg-black/[0.04] hover:bg-black/[0.08] text-[#86868b]' : 'bg-white/[0.04] hover:bg-white/[0.08] text-[#86868b] hover:text-[#f5f5f7]')
            }`}
          >
            {st}
          </button>
        ))}
      </div>

      {/* 4. High-Density Authority Matrix Table (Apple Spec Layout) */}
      <div className={`rounded-xl border overflow-hidden transition-colors ${
        isChartTheme ? 'border-black/[0.08] bg-white shadow-sm' : 'border-white/[0.08] bg-white/[0.02]'
      }`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className={`border-b text-[10px] uppercase tracking-wider ${
                isChartTheme ? 'bg-black/[0.02] border-black/[0.06] text-[#86868b]' : 'bg-white/[0.03] border-white/[0.06] text-[#86868b]'
              }`}>
                <th className="py-3 px-4 font-medium">Landing Centre</th>
                <th className="py-3 px-4 font-medium">State</th>
                <th className="py-3 px-4 font-medium">Safety Index (0-100)</th>
                <th className="py-3 px-4 font-medium">Verdict</th>
                <th className="py-3 px-4 font-medium">Wave & Wind</th>
                <th className="py-3 px-4 font-medium">Boundary Clearance</th>
                <th className="py-3 px-4 font-medium text-right">Command Action</th>
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
                        <span className="text-sm font-medium">{h.harbour_name}</span>
                      </div>
                      <span className="text-[11px] block mt-0.5 text-[#86868b]">
                        {h.local_name}
                      </span>
                    </td>

                    {/* State */}
                    <td className="py-3 px-4 font-normal text-[#86868b]">
                      {h.state}
                    </td>

                    {/* Safety Index Gauge */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono font-medium text-sm w-7">
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
                      <div className="flex items-center gap-3 font-mono text-[11px] text-[#86868b]">
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
                    <td className="py-3 px-4 font-mono text-[11px]">
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
