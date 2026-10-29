import React, { useState, useEffect, useCallback } from 'react';
import MarineMap from './components/MarineMap';
import ChatPanel from './components/ChatPanel';
import SafetyAlertBanner from './components/SafetyAlertBanner';
import DistrictAuthorityBoard from './components/DistrictAuthorityBoard';
import LoginPage from './components/LoginPage';
import {
  Compass,
  Radio,
  Waves,
  Wind,
  Thermometer,
  ShieldCheck,
  ShieldAlert,
  Anchor,
  Building2,
  Sun,
  Moon,
  LogOut,
} from 'lucide-react';

export default function App() {
  // Authentication & Security State
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  const [harbours, setHarbours] = useState([]);
  const [selectedHarbour, setSelectedHarbour] = useState(null);
  const [vesselType, setVesselType] = useState('country_craft');
  const [personaMode, setPersonaMode] = useState('fisher'); // 'fisher' | 'district'
  const [mobileTab, setMobileTab] = useState('map'); // 'map' | 'chat' (phone responsive navigation)
  const [themeMode, setThemeMode] = useState('ocean'); // 'ocean' (dark) | 'chart' (light)

  // Marine Telemetry & Dashboard Snapshot
  const [liveWeather, setLiveWeather] = useState(null);
  const [safetyStatus, setSafetyStatus] = useState('GREEN');
  const [safetyOverrideBanner, setSafetyOverrideBanner] = useState(null);
  const [mapPayload, setMapPayload] = useState({ type: 'FeatureCollection', features: [] });

  // Chat State
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Sync Tailwind dark mode class on root document
  useEffect(() => {
    if (themeMode === 'ocean') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [themeMode]);

  // 0. Verify Active Google Session on Initial Mount
  useEffect(() => {
    let isMounted = true;
    const verifySession = async () => {
      try {
        const res = await fetch('/api/v1/auth/me', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.user) {
            setCurrentUser(data.user);
          }
        }
      } catch (err) {
        console.debug('No active authentication session:', err);
      } finally {
        if (isMounted) setIsAuthChecking(false);
      }
    };
    verifySession();
    return () => {
      isMounted = false;
    };
  }, []);

  // 1. Initial Harbours Load (Strictly gated by authentication)
  useEffect(() => {
    if (!currentUser) return;
    const initializeSystem = async () => {
      try {
        const harboursRes = await fetch('/api/v1/harbours', { credentials: 'include' });
        if (harboursRes.ok) {
          const harboursData = await harboursRes.json();
          setHarbours(harboursData);
          const defaultHarbour = harboursData.find((h) => h.id === 'rameswaram') || harboursData[0];
          setSelectedHarbour(defaultHarbour);
        } else if (harboursRes.status === 401) {
          setCurrentUser(null);
        }
      } catch (err) {
        console.error('System initialization error:', err);
      }
    };
    initializeSystem();
  }, [currentUser]);

  // 2. URL Query Param Demo Evaluation Handler (?demo=safe|danger|cyclone|pfz|route)
  useEffect(() => {
    if (!currentUser) return;
    const params = new URLSearchParams(window.location.search);
    const demoKey = params.get('demo');
    if (demoKey && ['safe', 'danger', 'cyclone', 'pfz', 'route'].includes(demoKey)) {
      const loadDemo = async () => {
        try {
          setIsLoading(true);
          const res = await fetch(`/api/v1/demo-scenario?scenario=${demoKey}`, { credentials: 'include' });
          if (res.ok) {
            const data = await res.json();
            if (data.harbour) setSelectedHarbour(data.harbour);
            if (data.vessel_type) setVesselType(data.vessel_type);
            setSafetyStatus(data.safety_status);
            setSafetyOverrideBanner(data.safety_override_banner);
            if (data.map_payload && data.map_payload.features) {
              setMapPayload(data.map_payload);
            }

            const scenarioQueryMap = {
              safe: 'Is it safe for a small motorized boat to venture into the sea tomorrow morning off the coast?',
              danger: 'Can a country craft venture out of Mumbai harbour with 34 km/h wind shear and 1.9m wave height?',
              cyclone: 'Severe weather alert off Paradip coast: wave height 3.8m, wind gusts 65 km/h, swell period 15s. Should vessels venture?',
              pfz: 'Find the highest confidence Potential Fishing Zones (PFZ) offshore from Rameswaram harbour.',
              route: 'Calculate a safe navigation route from Chennai harbour to the PFZ cluster avoiding rough seas.',
            };

            setMessages([
              { role: 'user', content: scenarioQueryMap[demoKey] || 'Demo Evaluation Scenario' },
              {
                role: 'assistant',
                content: data.recommendation,
                recommendation: data.recommendation,
                safety_status: data.safety_status,
                evidence_and_reasoning: data.evidence_and_reasoning,
                detected_language: data.detected_language,
                timestamp: new Date().toISOString(),
              },
            ]);
          }
        } catch (err) {
          console.error('Failed to load demo scenario:', err);
        } finally {
          setIsLoading(false);
        }
      };
      loadDemo();
    }
  }, [currentUser]);

  // 3. Fetch Dashboard Summary whenever harbour or vessel type changes
  const fetchDashboardSummary = useCallback(async (harbourId, vessel) => {
    if (!currentUser) return;
    try {
      const res = await fetch(
        `/api/v1/dashboard-summary?harbour_id=${harbourId}&vessel_type=${vessel}`,
        { credentials: 'include' }
      );
      if (res.ok) {
        const data = await res.json();
        setLiveWeather({
          ...data.weather,
          sst_c: data.top_pfz?.sst_c || data.weather?.sst_c || 28.4,
        });
        setSafetyStatus(data.weather?.safety_status || 'GREEN');
        setSafetyOverrideBanner(data.safety_override_banner);
        if (data.map_payload && data.map_payload.features) {
          setMapPayload(data.map_payload);
        }
      } else if (res.status === 401) {
        setCurrentUser(null);
      }
    } catch (err) {
      console.error('Error fetching dashboard summary:', err);
    }
  }, [currentUser]);

  useEffect(() => {
    if (selectedHarbour && currentUser) {
      fetchDashboardSummary(selectedHarbour.id, vesselType);
    }
  }, [selectedHarbour, vesselType, fetchDashboardSummary, currentUser]);

  // 4. Handle User Chat Query
  const handleSendMessage = async (payload) => {
    setIsLoading(true);
    setMobileTab('chat'); // Switch to chat tab on phone when message sent

    const userMsg = {
      role: 'user',
      content: payload.message,
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const res = await fetch('/api/v1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      });

      if (res.status === 401) {
        setCurrentUser(null);
        throw new Error('Authentication required. Please sign in again.');
      }

      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }

      const data = await res.json();

      const agentMsg = {
        role: 'assistant',
        content: data.recommendation,
        recommendation: data.recommendation,
        safety_status: data.safety_status,
        evidence_and_reasoning: data.evidence_and_reasoning,
        detected_language: data.detected_language,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, agentMsg]);

      setSafetyStatus(data.safety_status);
      setSafetyOverrideBanner(data.safety_override_banner);

      if (data.map_payload && data.map_payload.features && data.map_payload.features.length > 0) {
        setMapPayload(data.map_payload);
      }
    } catch (err) {
      console.error('Chat error:', err);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Failed to contact ORCA multi-agent reasoning backend. Please check connection.',
          safety_status: 'AMBER',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // 5. Handle Sign Out
  const handleSignOut = async () => {
    try {
      await fetch('/api/v1/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setCurrentUser(null);
    }
  };

  // 6. Security Gate Loading State
  if (isAuthChecking) {
    return (
      <div
        className={`min-h-[100dvh] w-screen flex flex-col items-center justify-center select-none transition-colors ${
          themeMode === 'chart' ? 'bg-[#f5f5f7] text-[#1d1d1f]' : 'bg-[#030712] text-[#f5f5f7]'
        }`}
      >
        <div className="glass-icon w-12 h-12 flex items-center justify-center mb-4 animate-pulse">
          <Compass className="w-6 h-6 text-[#2997ff]" />
        </div>
        <p className="text-xs text-[#86868b] tracking-tight">Verifying Maritime Security Gate...</p>
      </div>
    );
  }

  // 7. Strict Google Authentication Lockout Screen (Impossible to bypass)
  if (!currentUser) {
    return (
      <LoginPage
        onLoginSuccess={setCurrentUser}
        themeMode={themeMode}
      />
    );
  }

  return (
    <div
      className={`flex flex-col h-screen h-[100dvh] w-screen overflow-hidden font-sans transition-colors ${
        themeMode === 'ocean' ? 'dark bg-black text-[#FFFFFF]' : 'bg-[#F5F5F7] text-[#1D1D1F]'
      }`}
    >
      {/* 1. Apple MacBook Pro Liquid Retina XDR Display Bar (Ultra-Translucent, Specular Depth) */}
      <header
        className={`min-h-14 h-[calc(3.5rem+env(safe-area-inset-top,0px))] pt-[env(safe-area-inset-top,0px)] px-3 sm:px-6 flex items-center justify-between shrink-0 z-30 transition-colors backdrop-blur-2xl border-b ${
          themeMode === 'chart'
            ? 'bg-white/80 border-black/[0.08] text-[#1D1D1F] shadow-[0_1px_0_0_rgba(255,255,255,0.8)]'
            : 'bg-black/75 border-white/[0.08] text-[#FFFFFF] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1),0_10px_30px_rgba(0,0,0,0.8)]'
        }`}
      >
        {/* Left: Brand Identity & Primary Views */}
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-2.5">
            <div className="glass-icon w-8 h-8 sm:w-8.5 sm:h-8.5 rounded-xl shadow-xs">
              <Compass className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-[#0071e3] dark:text-[#2997FF]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-semibold text-base sm:text-lg tracking-[-0.03em] leading-tight xdr-gradient-text">
                  ORCA
                </h1>
                <span className="hidden sm:inline-block text-[9px] uppercase font-semibold tracking-[0.06em] px-1.5 py-0.5 rounded-full bg-black/[0.04] dark:bg-white/[0.08] text-[#86868b] dark:text-[#A1A1A6] border border-black/[0.04] dark:border-white/[0.06]">
                  Gov of India
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-[#86868b] dark:text-[#A1A1A6] block font-normal leading-tight tracking-[-0.01em]">
                Marine Intelligence
              </p>
            </div>
          </div>

          <div className="h-5 w-px bg-black/[0.08] dark:bg-white/[0.08] hidden md:block" />

          {/* Primary View Switcher (Apple Floating Capsule Control) */}
          <div
            className={`hidden md:inline-flex items-center p-1 rounded-full border transition-all ${
              themeMode === 'chart'
                ? 'bg-black/[0.03] border-black/[0.06]'
                : 'bg-white/[0.05] border-white/[0.08] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]'
            }`}
          >
            <button
              type="button"
              onClick={() => setPersonaMode('fisher')}
              className={`px-3.5 py-1 rounded-full text-xs font-medium tracking-[-0.01em] transition-all flex items-center gap-1.5 active:scale-[0.96] ${
                personaMode === 'fisher'
                  ? (themeMode === 'chart'
                      ? 'bg-white text-[#1D1D1F] shadow-xs'
                      : 'bg-white/15 text-white shadow-[0_2px_8px_rgba(0,0,0,0.5)] border border-white/20')
                  : 'text-[#86868b] dark:text-[#A1A1A6] hover:text-[#1D1D1F] dark:hover:text-white'
              }`}
            >
              <Anchor className="w-3.5 h-3.5" />
              <span>Fisher View</span>
            </button>
            <button
              type="button"
              onClick={() => setPersonaMode('district')}
              className={`px-3.5 py-1 rounded-full text-xs font-medium tracking-[-0.01em] transition-all flex items-center gap-1.5 active:scale-[0.96] ${
                personaMode === 'district'
                  ? (themeMode === 'chart'
                      ? 'bg-white text-[#1D1D1F] shadow-xs'
                      : 'bg-white/15 text-white shadow-[0_2px_8px_rgba(0,0,0,0.5)] border border-white/20')
                  : 'text-[#86868b] dark:text-[#A1A1A6] hover:text-[#1D1D1F] dark:hover:text-white'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>District Board</span>
            </button>
          </div>
        </div>

        {/* Center: Live Environmental Telemetry & Breaker Status Group */}
        <div className="hidden xl:flex items-center gap-4 text-xs">
          {liveWeather && (
            <div className="flex items-center gap-4 text-[#86868b] dark:text-[#A1A1A6]">
              <div className="flex items-center gap-1.5" title="Sea Surface Temperature">
                <Thermometer className="w-3.5 h-3.5 text-[#2997FF]" />
                <span className="font-semibold tracking-[-0.01em] tabular-nums text-[#1D1D1F] dark:text-white">
                  {liveWeather.sst_c}°C
                </span>
                <span className="text-[10px] uppercase tracking-[0.06em] font-mono text-[#86868b] dark:text-[#6E6E73]">SST</span>
              </div>
              <span className="text-black/15 dark:text-white/20">•</span>
              <div className="flex items-center gap-1.5" title="Significant Wave Height">
                <Waves className="w-3.5 h-3.5 text-[#2997FF]" />
                <span className="font-semibold tracking-[-0.01em] tabular-nums text-[#1D1D1F] dark:text-white">
                  {liveWeather.wave_height_m}m
                </span>
                <span className="text-[10px] uppercase tracking-[0.06em] font-mono text-[#86868b] dark:text-[#6E6E73]">Waves</span>
              </div>
              <span className="text-black/15 dark:text-white/20">•</span>
              <div className="flex items-center gap-1.5" title="Surface Wind Speed">
                <Wind className="w-3.5 h-3.5 text-[#2997FF]" />
                <span className="font-semibold tracking-[-0.01em] tabular-nums text-[#1D1D1F] dark:text-white">
                  {liveWeather.wind_speed_kmh} km/h
                </span>
                <span className="text-[10px] uppercase tracking-[0.06em] font-mono text-[#86868b] dark:text-[#6E6E73]">Wind</span>
              </div>
            </div>
          )}

          {/* Luminous High Dynamic Range Breaker Status Indicator */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium tracking-[-0.01em] transition-all ${
              safetyStatus === 'RED_ALERT'
                ? 'xdr-jewel-red'
                : safetyStatus === 'AMBER'
                ? 'xdr-jewel-amber'
                : 'xdr-jewel-emerald'
            }`}
          >
            {safetyStatus === 'RED_ALERT' ? (
              <ShieldAlert className="w-3.5 h-3.5 text-current" />
            ) : (
              <ShieldCheck className="w-3.5 h-3.5 text-current" />
            )}
            <span>Breaker: {safetyStatus.replace('_', ' ')}</span>
          </div>
        </div>

        {/* Right: Secondary Actions, Theme Toggle & Officer Identity */}
        <div className="flex items-center gap-1.5 sm:gap-2 text-xs">
          {/* Theme Switch */}
          <button
            type="button"
            onClick={() => setThemeMode((prev) => (prev === 'chart' ? 'ocean' : 'chart'))}
            className="xdr-pill p-1.5 sm:px-3 sm:py-1 rounded-full text-xs gap-1.5 flex items-center text-[#86868b] dark:text-[#A1A1A6] hover:text-[#1D1D1F] dark:hover:text-white active:scale-[0.96] transition"
            title="Toggle Visual Theme (Light vs Dark)"
          >
            {themeMode === 'chart' ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-500" />
                <span className="hidden sm:inline font-medium text-[11px]">Light</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-[#2997FF]" />
                <span className="hidden sm:inline font-medium text-[11px]">Dark</span>
              </>
            )}
          </button>

          {/* Authenticated User Session Badge & Sign Out */}
          {currentUser && (
            <div className="flex items-center gap-1.5 pl-1.5 border-l border-black/[0.08] dark:border-white/[0.08]">
              <div
                className="xdr-pill flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                title={`Signed in as ${currentUser.name} (${currentUser.email})`}
              >
                {currentUser.picture ? (
                  <img
                    src={currentUser.picture}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="w-4 h-4 rounded-full object-cover ring-1 ring-black/10 dark:ring-white/20"
                  />
                ) : (
                  <div className="w-4 h-4 rounded-full bg-[#0071e3]/15 text-[#0071e3] text-[9px] font-semibold flex items-center justify-center">
                    {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                )}
                <span className="hidden lg:inline text-[11px] font-medium text-[#1D1D1F] dark:text-[#FFFFFF] max-w-[120px] truncate">
                  {currentUser.name || currentUser.email}
                </span>
              </div>

              <button
                type="button"
                onClick={handleSignOut}
                className="p-1.5 rounded-full text-[#86868b] dark:text-[#A1A1A6] hover:text-[#FF453A] dark:hover:text-[#FF453A] hover:bg-red-500/10 active:scale-[0.96] transition"
                title={`Sign Out (${currentUser.email})`}
                aria-label="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* 2. Maritime Safety Circuit Breaker Banner (when alert active) */}
      <SafetyAlertBanner
        safetyStatus={safetyStatus}
        safetyOverrideBanner={safetyOverrideBanner}
        weather={liveWeather}
        harbour={selectedHarbour}
        theme={themeMode}
      />

      {/* 3. Main Persona View */}
      {personaMode === 'district' ? (
        <div className="flex-1 overflow-hidden relative">
          <DistrictAuthorityBoard
            vesselType={vesselType}
            theme={themeMode}
            onSelectHarbour={(harbourId) => {
              const h = harbours.find((item) => item.id === harbourId);
              if (h) setSelectedHarbour(h);
              setPersonaMode('fisher');
              setMobileTab('map');
            }}
          />
        </div>
      ) : (
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
          {/* Left Side: Marine GIS Interactive Map */}
          <div className={`w-full md:w-[58%] h-full relative shrink-0 ${
            mobileTab === 'map' ? 'block' : 'hidden md:block'
          }`}>
            <MarineMap
              harbours={harbours}
              activeHarbour={selectedHarbour}
              onSelectHarbour={(h) => setSelectedHarbour(h)}
              mapPayload={mapPayload}
              theme={themeMode}
            />
          </div>

          {/* Right Side: Multilingual Conversational Agent Console */}
          <div className={`w-full md:w-[42%] h-full flex flex-col shrink-0 ${
            mobileTab === 'chat' ? 'flex' : 'hidden md:flex'
          }`}>
            <ChatPanel
              harbours={harbours}
              selectedHarbour={selectedHarbour}
              onSelectHarbour={(h) => setSelectedHarbour(h)}
              vesselType={vesselType}
              onChangeVesselType={(v) => setVesselType(v)}
              messages={messages}
              isLoading={isLoading}
              onSendMessage={handleSendMessage}
              liveWeather={liveWeather}
              safetyStatus={safetyStatus}
              theme={themeMode}
              onViewMap={() => setMobileTab('map')}
            />
          </div>
        </div>
      )}

      {/* 4. Mobile Bottom Tab Navigation Bar (Safe Area Aligned for Home Indicators) */}
      <nav
        className={`md:hidden shrink-0 border-t backdrop-blur-2xl px-2 pt-1.5 pb-safe flex items-center justify-around z-30 select-none transition-colors ${
          themeMode === 'chart'
            ? 'bg-white/85 border-black/[0.08] text-[#1D1D1F]'
            : 'bg-black/85 border-white/[0.08] text-white shadow-[0_-10px_30px_rgba(0,0,0,0.8)]'
        }`}
      >
        <button
          type="button"
          onClick={() => {
            setPersonaMode('fisher');
            setMobileTab('map');
          }}
          className={`flex-1 py-1.5 px-2 rounded-xl min-h-[48px] flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition active:scale-[0.96] ${
            personaMode === 'fisher' && mobileTab === 'map'
              ? (themeMode === 'chart' ? 'text-[#0071e3] bg-black/[0.05]' : 'text-[#2997FF] bg-white/[0.1] shadow-xs border border-white/10')
              : 'text-[#86868b] dark:text-[#A1A1A6] hover:text-[#1D1D1F] dark:hover:text-white'
          }`}
        >
          <Compass className="w-4 h-4" />
          <span>Marine Map</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setPersonaMode('fisher');
            setMobileTab('chat');
          }}
          className={`flex-1 py-1.5 px-2 rounded-xl min-h-[48px] flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition relative active:scale-[0.96] ${
            personaMode === 'fisher' && mobileTab === 'chat'
              ? (themeMode === 'chart' ? 'text-[#0071e3] bg-black/[0.05]' : 'text-[#2997FF] bg-white/[0.1] shadow-xs border border-white/10')
              : 'text-[#86868b] dark:text-[#A1A1A6] hover:text-[#1D1D1F] dark:hover:text-white'
          }`}
        >
          <div className="relative">
            <Radio className="w-4 h-4" />
            {safetyStatus === 'RED_ALERT' && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            )}
          </div>
          <span>AI Advisory</span>
        </button>

        <button
          type="button"
          onClick={() => setPersonaMode('district')}
          className={`flex-1 py-1.5 px-2 rounded-xl min-h-[48px] flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition active:scale-[0.96] ${
            personaMode === 'district'
              ? (themeMode === 'chart' ? 'text-[#0071e3] bg-black/[0.05]' : 'text-[#2997FF] bg-white/[0.1] shadow-xs border border-white/10')
              : 'text-[#86868b] dark:text-[#A1A1A6] hover:text-[#1D1D1F] dark:hover:text-white'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>District Board</span>
        </button>
      </nav>
    </div>
  );
}
