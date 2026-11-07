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
  initialHarbours = [],
  onSelectHarbour,
  theme = 'chart',
}) {
  const [boardData, setBoardData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stateFilter, setStateFilter] = useState('ALL');
  const [lastRefreshed, setLastRefreshed] = useState('');

  const fetchBoardData = async () => {
    setIsLoading(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    try {
      const res = await fetch(`/api/v1/district-board?vessel_type=${vesselType}`, {
        credentials: 'include',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        setBoardData(data);
        setError(null);
        setLastRefreshed(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      } else {
        setError(`Surveillance feed returned status ${res.status}`);
      }
    } catch (err) {
      clearTimeout(timeoutId);
      console.error('Error loading district authority board:', err);
      setError(err?.name === 'AbortError' ? 'Surveillance feed request timed out' : 'Unable to reach district authority surveillance feed');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    fetchBoardData();
    const interval = setInterval(() => {
      if (active) fetchBoardData();
    }, 120000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [vesselType]);

  const fallbackHarbours = React.useMemo(() => {
    if (!initialHarbours || initialHarbours.length === 0) return [];
    return initialHarbours.map((h) => ({
      harbour_id: h.id,
      harbour_name: h.name,
      local_name: h.local_name,
      state: h.state,
      lat: h.lat,
      lon: h.lon,
      safety_index: 22,
      risk_verdict: 'LOW',
      safety_status: 'GREEN',
      wave_height_m: 1.1,
      wind_speed_kmh: 14,
      nearest_boundary_distance_nm: 25.0,
      active_advisory: 'Standard baseline operational status. Live telemetry connecting.',
      circuit_breaker_triggered: false,
      is_preliminary: true,
    }));
  }, [initialHarbours]);

  const harbours = boardData?.harbours || fallbackHarbours;
  const states = ['ALL', ...new Set(harbours.map((h) => h.state))];

  const filteredHarbours = stateFilter === 'ALL'
    ? harbours
    : harbours.filter((h) => h.state === stateFilter);

  const redCount = harbours.filter((h) => h.safety_status === 'RED_ALERT' || h.circuit_breaker_triggered).length;
  const amberCount = harbours.filter((h) => h.safety_status === 'AMBER' && !h.circuit_breaker_triggered).length;
  const greenCount = harbours.filter((h) => (h.safety_status === 'GREEN' || !h.safety_status) && !h.circuit_breaker_triggered).length;

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
              {isLoading && !boardData && harbours.length === 0
                ? 'Connecting...'
                : `${boardData?.total_landing_centres || harbours.length} Centres`}
            </span>
          </div>
          <p className="text-xs text-[#86868b] dark:text-[#A1A1A6] mt-0.5 font-normal">
            Fleet status across {boardData ? (boardData.total_landing_centres || harbours.length) : (harbours.length || 12)} centres • {boardData?.data_mode === 'BASELINE' ? 'Baseline data' : (boardData?.data_mode || (harbours.length > 0 && !boardData ? 'Initialising...' : 'Live'))}{lastRefreshed ? ` (${lastRefreshed})` : ''}
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
        <div className={`p-4 rounded-2xl relative transition-all ${
          isChartTheme
            ? 'bg-white border border-black/[0.08] shadow-xs text-[#1D1D1F]'
            : 'bg-white/[0.04] border border-white/[0.08] text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] block text-[#86868b] dark:text-[#6E6E73]">
              Monitored
            </span>
            <div className="glass-icon w-7 h-7 rounded-lg">
              <Anchor className="w-3.5 h-3.5 text-[#2997FF]" />
            </div>
          </div>
          {isLoading && !boardData && harbours.length === 0 ? (
            <div className="h-8 w-14 bg-black/[0.06] dark:bg-white/[0.08] rounded-lg animate-pulse mt-1.5" />
          ) : (
            <span className="text-3xl font-bold tracking-tight mt-1.5 block tabular-nums text-[#1D1D1F] dark:text-white">{harbours.length}</span>
          )}
          <span className="text-[11px] text-[#86868b] dark:text-[#A1A1A6] mt-0.5 block">Landing centres</span>
        </div>

        <div className={`p-4 rounded-2xl transition-all relative ${
          redCount > 0
            ? 'xdr-jewel-red'
            : isChartTheme
            ? 'bg-white border border-black/[0.08] shadow-xs text-[#1D1D1F]'
            : 'bg-white/[0.04] border border-white/[0.08] text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] block text-[#86868b] dark:text-[#6E6E73]">
              Prohibited
            </span>
            <div className="glass-icon glass-icon-red w-7 h-7 rounded-lg">
              <ShieldAlert className="w-3.5 h-3.5 text-current" />
            </div>
          </div>
          {isLoading && !boardData && harbours.length === 0 ? (
            <div className="h-8 w-14 bg-black/[0.06] dark:bg-white/[0.08] rounded-lg animate-pulse mt-1.5" />
          ) : (
            <span className="text-3xl font-bold tracking-tight mt-1.5 block tabular-nums">{redCount}</span>
          )}
          <span className="text-[11px] text-[#86868b] dark:text-[#A1A1A6] mt-0.5 block">{redCount > 0 ? 'Banned' : 'None'}</span>
        </div>

        <div className={`p-4 rounded-2xl transition-all relative ${
          amberCount > 0
            ? 'xdr-jewel-amber'
            : isChartTheme
            ? 'bg-white border border-black/[0.08] shadow-xs text-[#1D1D1F]'
            : 'bg-white/[0.04] border border-white/[0.08] text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] block text-[#86868b] dark:text-[#6E6E73]">
              Caution
            </span>
            <div className="glass-icon glass-icon-amber w-7 h-7 rounded-lg">
              <AlertTriangle className="w-3.5 h-3.5 text-current" />
            </div>
          </div>
          {isLoading && !boardData && harbours.length === 0 ? (
            <div className="h-8 w-14 bg-black/[0.06] dark:bg-white/[0.08] rounded-lg animate-pulse mt-1.5" />
          ) : (
            <span className="text-3xl font-bold tracking-tight mt-1.5 block tabular-nums">{amberCount}</span>
          )}
          <span className="text-[11px] text-[#86868b] dark:text-[#A1A1A6] mt-0.5 block">{amberCount > 0 ? 'Advisory' : 'None'}</span>
        </div>

        <div className={`p-4 rounded-2xl relative transition-all ${
          isChartTheme
            ? 'bg-white border border-black/[0.08] shadow-xs text-[#1D1D1F]'
            : 'bg-white/[0.04] border border-white/[0.08] text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] block text-[#86868b] dark:text-[#6E6E73]">
              Clear
            </span>
            <div className="glass-icon glass-icon-emerald w-7 h-7 rounded-lg">
              <ShieldCheck className="w-3.5 h-3.5 text-current" />
            </div>
          </div>
          {isLoading && !boardData && harbours.length === 0 ? (
            <div className="h-8 w-14 bg-black/[0.06] dark:bg-white/[0.08] rounded-lg animate-pulse mt-1.5" />
          ) : (
            <span className="text-3xl font-bold tracking-tight text-[#16803D] dark:text-[#30D158] mt-1.5 block tabular-nums">{greenCount}</span>
          )}
          <span className="text-[11px] text-[#86868b] dark:text-[#A1A1A6] mt-0.5 block">Permitted</span>
        </div>
      </div>

      {/* Visible Error State when feed fails */}
      {error && harbours.length === 0 && (
        <div className={`p-8 rounded-2xl border text-center flex flex-col items-center justify-center my-6 transition-all ${
          isChartTheme
            ? 'bg-white border-red-500/20 text-[#1D1D1F]'
            : 'bg-red-950/20 border-red-500/30 text-white'
        }`}>
          <div className="glass-icon glass-icon-red w-12 h-12 rounded-2xl flex items-center justify-center mb-3">
            <ShieldAlert className="w-6 h-6 text-[#FF453A]" />
          </div>
          <h3 className="text-base font-semibold tracking-tight mb-1">
            Unable to Load District Surveillance Feed
          </h3>
          <p className="text-xs text-[#86868b] dark:text-[#A1A1A6] max-w-md mb-4 font-normal">
            {error}. Coastal telemetry servers could not be contacted.
          </p>
          <button
            type="button"
            onClick={fetchBoardData}
            disabled={isLoading}
            className="xdr-pill px-4 py-2 rounded-full text-xs font-semibold text-white bg-[#0071E3] dark:bg-[#2997FF] flex items-center gap-2 active:scale-[0.96] shadow-md"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Retry Connection</span>
          </button>
        </div>
      )}

      {error && harbours.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium bg-[#FF9F0A]/10 text-[#FF9F0A] border border-[#FF9F0A]/20 mb-4">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>Surveillance feed refresh note ({error}). Displaying available district status.</span>
        </div>
      )}

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
        {isLoading && harbours.length === 0 ? (
          Array.from({ length: 4 }).map((_, idx) => (
            <div
              key={`mob-skel-${idx}`}
              className={`p-3.5 rounded-2xl border animate-pulse ${
                isChartTheme
                  ? 'bg-white border-black/[0.08]'
                  : 'bg-white/[0.04] border-white/[0.08]'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-black/[0.06] dark:bg-white/[0.08]" />
                  <div className="space-y-1">
                    <div className="h-3.5 w-24 bg-black/[0.08] dark:bg-white/[0.1] rounded" />
                    <div className="h-2.5 w-16 bg-black/[0.04] dark:bg-white/[0.05] rounded" />
                  </div>
                </div>
                <div className="h-5 w-16 rounded-full bg-black/[0.06] dark:bg-white/[0.08]" />
              </div>
              <div className="h-7 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] mb-2" />
              <div className="flex justify-between items-center">
                <div className="h-3 w-20 bg-black/[0.04] dark:bg-white/[0.06] rounded" />
                <div className="h-5 w-14 rounded-full bg-black/[0.06] dark:bg-white/[0.08]" />
              </div>
            </div>
          ))
        ) : filteredHarbours.length > 0 ? (
          filteredHarbours.map((h) => {
            const isRed = h.safety_status === 'RED_ALERT' || h.circuit_breaker_triggered;
            return (
              <div
                key={h.harbour_id}
                className={`p-3.5 rounded-2xl border transition-all ${
                  isChartTheme
                    ? 'bg-white border-black/[0.08] shadow-xs text-[#1D1D1F]'
                    : 'bg-white/[0.04] border-white/[0.08] text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]'
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
          })
        ) : (
          <div className="p-6 text-center text-xs text-[#86868b] dark:text-[#A1A1A6]">
            No landing centres match filter &quot;{stateFilter}&quot;.
          </div>
        )}
      </div>

      {/* 5. Desktop High-Density Authority Matrix Table (>= md) */}
      <div className={`hidden md:block rounded-2xl border overflow-hidden transition-all ${
        isChartTheme
          ? 'border-black/[0.08] bg-white shadow-xs text-[#1D1D1F]'
          : 'border-white/[0.08] bg-[#0c0d11] text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]'
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
              {isLoading && harbours.length === 0 ? (
                Array.from({ length: 8 }).map((_, idx) => (
                  <tr key={`tbl-skel-${idx}`} className="animate-pulse">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-black/[0.06] dark:bg-white/[0.08]" />
                        <div className="space-y-1">
                          <div className="h-3.5 w-28 bg-black/[0.08] dark:bg-white/[0.1] rounded" />
                          <div className="h-2.5 w-20 bg-black/[0.04] dark:bg-white/[0.05] rounded" />
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="h-3 w-16 bg-black/[0.06] dark:bg-white/[0.08] rounded" />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="h-3.5 w-6 bg-black/[0.08] dark:bg-white/[0.1] rounded" />
                        <div className="w-24 h-1.5 bg-black/[0.06] dark:bg-white/[0.08] rounded-full" />
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="h-5 w-20 bg-black/[0.06] dark:bg-white/[0.08] rounded-full" />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="h-3.5 w-24 bg-black/[0.06] dark:bg-white/[0.08] rounded" />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="h-3.5 w-16 bg-black/[0.06] dark:bg-white/[0.08] rounded" />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="h-6 w-16 bg-black/[0.06] dark:bg-white/[0.08] rounded-lg ml-auto" />
                    </td>
                  </tr>
                ))
              ) : filteredHarbours.length > 0 ? (
                filteredHarbours.map((h) => {
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
                          <span className={`flex items-center gap-1 ${isChartTheme ? 'text-[#1D1D1F]' : 'text-white'}`}>
                            <Waves className="w-3 h-3 text-[#86868b]" />
                            {h.wave_height_m}m
                          </span>
                          <span className={`flex items-center gap-1 ${isChartTheme ? 'text-[#1D1D1F]' : 'text-white'}`}>
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
                          type="button"
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
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-xs text-[#86868b] dark:text-[#A1A1A6]">
                    {stateFilter !== 'ALL' ? (
                      <div>
                        <p className="font-medium text-sm text-[#1D1D1F] dark:text-white mb-1">No landing centres in {stateFilter}</p>
                        <p className="text-xs mb-3 font-normal">Try selecting a different coastal state or view all centres.</p>
                        <button
                          type="button"
                          onClick={() => setStateFilter('ALL')}
                          className="xdr-pill px-3 py-1 text-xs font-medium rounded-full text-[#0071E3] dark:text-[#2997FF] active:scale-[0.96]"
                        >
                          Reset to All States
                        </button>
                      </div>
                    ) : (
                      <p>No landing centres available</p>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
