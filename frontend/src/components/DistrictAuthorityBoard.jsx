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
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-red-700 text-white tracking-wider">
            <ShieldAlert className="w-3 h-3" />
            EXTREME ({score})
          </span>
        );
      case 'HIGH':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-600 text-white tracking-wider">
            <AlertTriangle className="w-3 h-3" />
            HIGH ({score})
          </span>
        );
      case 'MODERATE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/40 tracking-wider">
            MODERATE ({score})
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-600/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40 tracking-wider">
            <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            LOW ({score})
          </span>
        );
    }
  };

  return (
    <div className={`flex flex-col h-full w-full overflow-y-auto p-4 md:p-6 transition-colors ${
      isChartTheme ? 'bg-paper-100 text-ink-900' : 'bg-ocean-950 text-slate-100'
    }`}>
      {/* 1. Header & Quick Metrics */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className={`w-5 h-5 ${isChartTheme ? 'text-chart-500' : 'text-cyan-400'}`} />
            <h2 className="text-xl font-bold tracking-tight">
              District Maritime Authority Board
            </h2>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
              isChartTheme ? 'bg-paper-200 text-ink-700 border border-paper-300' : 'bg-ocean-900 text-cyan-300 border border-cyan-500/30'
            }`}>
              12 Landing Centres
            </span>
          </div>
          <p className={`text-xs mt-0.5 ${isChartTheme ? 'text-ink-500' : 'text-slate-400'}`}>
            Coast-wide synoptic marine safety oversight and fleet venture clearance • Updated at {lastRefreshed || 'Synchronizing...'}
          </p>
        </div>

        {/* Action button & refresh */}
        <div className="flex items-center gap-2">
          <button
            onClick={fetchBoardData}
            disabled={isLoading}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition shadow-sm ${
              isChartTheme
                ? 'bg-paper-200 hover:bg-paper-300 text-ink-800 border border-paper-300'
                : 'bg-ocean-900 hover:bg-ocean-800 text-cyan-300 border border-cyan-500/30'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh Telemetry</span>
          </button>
        </div>
      </div>

      {/* 2. Top Executive Summary Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className={`p-3 rounded-md border ${
          isChartTheme ? 'bg-paper-50 border-paper-300' : 'bg-ocean-900/60 border-cyan-500/20'
        }`}>
          <span className={`text-[11px] font-bold uppercase tracking-wider block ${
            isChartTheme ? 'text-ink-500' : 'text-slate-400'
          }`}>
            Monitored Harbours
          </span>
          <span className="text-2xl font-mono font-bold mt-1 block">12</span>
          <span className="text-[10px] text-slate-400">Gujarat to Odisha Coastline</span>
        </div>

        <div className={`p-3 rounded-md border ${
          redCount > 0 ? 'bg-red-500/10 border-red-500/40 text-red-600 dark:text-red-400' : (isChartTheme ? 'bg-paper-50 border-paper-300' : 'bg-ocean-900/60 border-cyan-500/20')
        }`}>
          <span className="text-[11px] font-bold uppercase tracking-wider block">
            Venture Prohibited (Red)
          </span>
          <span className="text-2xl font-mono font-bold mt-1 block">{redCount}</span>
          <span className="text-[10px]">{redCount > 0 ? 'Active Circuit Breaker' : 'Zero Active Bans'}</span>
        </div>

        <div className={`p-3 rounded-md border ${
          amberCount > 0 ? 'bg-amber-500/10 border-amber-500/40 text-amber-600 dark:text-amber-400' : (isChartTheme ? 'bg-paper-50 border-paper-300' : 'bg-ocean-900/60 border-cyan-500/20')
        }`}>
          <span className="text-[11px] font-bold uppercase tracking-wider block">
            Caution Advised (Amber)
          </span>
          <span className="text-2xl font-mono font-bold mt-1 block">{amberCount}</span>
          <span className="text-[10px]">Moderate Sea State Warning</span>
        </div>

        <div className={`p-3 rounded-md border ${
          isChartTheme ? 'bg-paper-50 border-paper-300' : 'bg-ocean-900/60 border-cyan-500/20'
        }`}>
          <span className={`text-[11px] font-bold uppercase tracking-wider block ${
            isChartTheme ? 'text-ink-500' : 'text-slate-400'
          }`}>
            Optimal Sea State (Green)
          </span>
          <span className="text-2xl font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-1 block">{greenCount}</span>
          <span className="text-[10px] text-slate-400">Clear Venture Permitted</span>
        </div>
      </div>

      {/* 3. State Filter Bar */}
      <div className="flex items-center gap-1.5 flex-wrap mb-4">
        <span className={`text-xs font-bold flex items-center gap-1 mr-2 ${isChartTheme ? 'text-ink-700' : 'text-slate-300'}`}>
          <Filter className="w-3.5 h-3.5" />
          Filter State:
        </span>
        {states.map((st) => (
          <button
            key={st}
            onClick={() => setStateFilter(st)}
            className={`px-2.5 py-1 rounded text-xs font-bold transition ${
              stateFilter === st
                ? (isChartTheme ? 'bg-chart-500 text-white shadow' : 'bg-cyan-500 text-slate-950 shadow')
                : (isChartTheme ? 'bg-paper-200 hover:bg-paper-300 text-ink-700' : 'bg-ocean-900 hover:bg-ocean-800 text-slate-300')
            }`}
          >
            {st}
          </button>
        ))}
      </div>

      {/* 4. High-Density Authority Matrix Table */}
      <div className={`rounded-md border overflow-hidden shadow-sm ${
        isChartTheme ? 'border-paper-300 bg-paper-50' : 'border-cyan-500/20 bg-ocean-900/40'
      }`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className={`border-b font-mono uppercase text-[11px] tracking-wider ${
                isChartTheme ? 'bg-paper-200/70 border-paper-300 text-ink-700' : 'bg-ocean-950/80 border-cyan-500/30 text-cyan-300'
              }`}>
                <th className="py-2.5 px-3">Landing Centre</th>
                <th className="py-2.5 px-3">State</th>
                <th className="py-2.5 px-3">Safety Index (0-100)</th>
                <th className="py-2.5 px-3">Verdict</th>
                <th className="py-2.5 px-3">Wave & Wind</th>
                <th className="py-2.5 px-3">Boundary Clearance</th>
                <th className="py-2.5 px-3 text-right">Command Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-inherit">
              {filteredHarbours.map((h) => {
                const isRed = h.safety_status === 'RED_ALERT' || h.circuit_breaker_triggered;
                return (
                  <tr
                    key={h.harbour_id}
                    className={`transition ${
                      isChartTheme
                        ? 'hover:bg-paper-100'
                        : 'hover:bg-ocean-800/40'
                    } ${isRed ? (isChartTheme ? 'bg-red-500/5' : 'bg-red-950/20') : ''}`}
                  >
                    {/* Landing Centre */}
                    <td className="py-2.5 px-3">
                      <div className="font-bold flex items-center gap-1.5">
                        <Anchor className={`w-3.5 h-3.5 shrink-0 ${isChartTheme ? 'text-chart-500' : 'text-cyan-400'}`} />
                        <span>{h.harbour_name}</span>
                      </div>
                      <span className={`text-[11px] block mt-0.5 ${isChartTheme ? 'text-ink-500' : 'text-slate-400'}`}>
                        {h.local_name}
                      </span>
                    </td>

                    {/* State */}
                    <td className="py-2.5 px-3 font-medium">
                      {h.state}
                    </td>

                    {/* Safety Index Gauge */}
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm w-8">
                          {h.safety_index}
                        </span>
                        <div className="w-24 h-2 bg-slate-200 dark:bg-ocean-950 rounded-full overflow-hidden shrink-0">
                          <div
                            className={`h-full ${
                              h.safety_index >= 76
                                ? 'bg-red-600'
                                : h.safety_index >= 51
                                ? 'bg-amber-600'
                                : h.safety_index >= 26
                                ? 'bg-amber-400'
                                : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(5, h.safety_index))}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Verdict */}
                    <td className="py-2.5 px-3">
                      {getVerdictBadge(h.risk_verdict, h.safety_index)}
                    </td>

                    {/* Wave & Wind */}
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-3 font-mono text-[11px]">
                        <span className="flex items-center gap-1 text-cyan-600 dark:text-cyan-300">
                          <Waves className="w-3 h-3" />
                          {h.wave_height_m}m
                        </span>
                        <span className="flex items-center gap-1 text-sky-600 dark:text-sky-300">
                          <Wind className="w-3 h-3" />
                          {h.wind_speed_kmh} km/h
                        </span>
                      </div>
                    </td>

                    {/* Boundary Clearance */}
                    <td className="py-2.5 px-3 font-mono text-[11px]">
                      <span className={h.nearest_boundary_distance_nm <= 1.5 ? 'text-red-600 font-bold' : (isChartTheme ? 'text-ink-700' : 'text-slate-300')}>
                        {h.nearest_boundary_distance_nm.toFixed(1)} NM
                      </span>
                    </td>

                    {/* Command Action */}
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => onSelectHarbour && onSelectHarbour(h.harbour_id)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold transition shadow-sm ${
                          isChartTheme
                            ? 'bg-paper-200 hover:bg-chart-500 hover:text-white text-ink-800 border border-paper-300'
                            : 'bg-ocean-950 hover:bg-cyan-500 hover:text-slate-950 text-cyan-300 border border-cyan-500/40'
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
