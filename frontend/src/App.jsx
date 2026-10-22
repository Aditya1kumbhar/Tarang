import React, { useState, useEffect, useCallback } from 'react';
import MarineMap from './components/MarineMap';
import ChatPanel from './components/ChatPanel';
import SafetyAlertBanner from './components/SafetyAlertBanner';
import AgentTraceDrawer from './components/AgentTraceDrawer';
import DistrictAuthorityBoard from './components/DistrictAuthorityBoard';
import { PrivacyPolicyModal, TermsConditionsModal } from './components/LegalModals';
import {
  Compass,
  Radio,
  Waves,
  Wind,
  Thermometer,
  ShieldCheck,
  ShieldAlert,
  Activity,
  Anchor,
  Globe,
  Building2,
  Sun,
  Moon,
} from 'lucide-react';

export default function App() {
  const [harbours, setHarbours] = useState([]);
  const [selectedHarbour, setSelectedHarbour] = useState(null);
  const [vesselType, setVesselType] = useState('country_craft');
  const [isBackendHealthy, setIsBackendHealthy] = useState(false);
  const [personaMode, setPersonaMode] = useState('fisher'); // 'fisher' | 'district'
  const [themeMode, setThemeMode] = useState('ocean'); // 'ocean' (dark) | 'chart' (light)

  // Marine Telemetry & Dashboard Snapshot
  const [liveWeather, setLiveWeather] = useState(null);
  const [safetyStatus, setSafetyStatus] = useState('GREEN');
  const [safetyOverrideBanner, setSafetyOverrideBanner] = useState(null);
  const [mapPayload, setMapPayload] = useState({ type: 'FeatureCollection', features: [] });

  // Chat & Traces State
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [agentTraces, setAgentTraces] = useState([]);
  const [provenanceList, setProvenanceList] = useState([]);
  const [evidenceLedger, setEvidenceLedger] = useState([]);
  const [isTraceDrawerOpen, setIsTraceDrawerOpen] = useState(false);

  // Legal Modals State
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  const [isTermsOpen, setIsTermsOpen] = useState(false);

  // Sync Tailwind dark mode class on root document
  useEffect(() => {
    if (themeMode === 'ocean') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [themeMode]);

  // 1. Initial Health Check & Harbours Load
  useEffect(() => {
    const initializeSystem = async () => {
      try {
        const healthRes = await fetch('/api/v1/health');
        if (healthRes.ok) setIsBackendHealthy(true);

        const harboursRes = await fetch('/api/v1/harbours');
        if (harboursRes.ok) {
          const harboursData = await harboursRes.json();
          setHarbours(harboursData);
          const defaultHarbour = harboursData.find((h) => h.id === 'rameswaram') || harboursData[0];
          setSelectedHarbour(defaultHarbour);
        }
      } catch (err) {
        console.error('System initialization error:', err);
      }
    };
    initializeSystem();
  }, []);

  // 2. URL Query Param Demo Evaluation Handler (?demo=safe|danger|cyclone|pfz|route)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const demoKey = params.get('demo');
    if (demoKey && ['safe', 'danger', 'cyclone', 'pfz', 'route'].includes(demoKey)) {
      const loadDemo = async () => {
        try {
          setIsLoading(true);
          const res = await fetch(`/api/v1/demo-scenario?scenario=${demoKey}`);
          if (res.ok) {
            const data = await res.json();
            if (data.harbour) setSelectedHarbour(data.harbour);
            if (data.vessel_type) setVesselType(data.vessel_type);
            setSafetyStatus(data.safety_status);
            setSafetyOverrideBanner(data.safety_override_banner);
            if (data.map_payload && data.map_payload.features) {
              setMapPayload(data.map_payload);
            }
            if (data.agent_traces) setAgentTraces(data.agent_traces);
            if (data.provenance_list) setProvenanceList(data.provenance_list);
            if (data.evidence_ledger) setEvidenceLedger(data.evidence_ledger);

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
  }, []);

  // 3. Fetch Dashboard Summary whenever harbour or vessel type changes
  const fetchDashboardSummary = useCallback(async (harbourId, vessel) => {
    try {
      const res = await fetch(`/api/v1/dashboard-summary?harbour_id=${harbourId}&vessel_type=${vessel}`);
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
        if (data.evidence_ledger) {
          setEvidenceLedger(data.evidence_ledger);
        }
      }
    } catch (err) {
      console.error('Error fetching dashboard summary:', err);
    }
  }, []);

  useEffect(() => {
    if (selectedHarbour) {
      fetchDashboardSummary(selectedHarbour.id, vesselType);
    }
  }, [selectedHarbour, vesselType, fetchDashboardSummary]);

  // 4. Handle User Chat Query
  const handleSendMessage = async (payload) => {
    setIsLoading(true);

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
      });

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

      if (data.agent_traces) setAgentTraces(data.agent_traces);
      if (data.provenance_list) setProvenanceList(data.provenance_list);
      if (data.evidence_ledger) setEvidenceLedger(data.evidence_ledger);
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

  return (
    <div
      className={`flex flex-col h-screen w-screen overflow-hidden font-sans transition-colors ${
        themeMode === 'ocean' ? 'dark bg-[#0a0a0c] text-[#f5f5f7]' : 'bg-[#f5f5f7] text-[#1d1d1f]'
      }`}
    >
      {/* 1. Apple-Minimalist Frosted Command Header */}
      <header
        className={`h-14 px-4 sm:px-6 flex items-center justify-between shrink-0 z-30 transition-colors backdrop-blur-xl border-b ${
          themeMode === 'chart'
            ? 'bg-white/80 border-black/[0.08] text-[#1d1d1f]'
            : 'bg-black/75 border-white/[0.08] text-[#f5f5f7]'
        }`}
      >
        {/* Brand & Identity */}
        <div className="flex items-center gap-3">
          <div className="glass-icon w-8 h-8">
            <Compass className="w-4 h-4 text-[#2997ff]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-semibold text-sm tracking-tight">
                ORCA
              </h1>
              <span
                className={`text-[10px] font-medium tracking-wide px-1.5 py-0.5 rounded border ${
                  themeMode === 'chart'
                    ? 'bg-black/[0.04] border-black/[0.08] text-[#86868b]'
                    : 'bg-white/[0.06] border-white/[0.1] text-[#86868b]'
                }`}
              >
                SIH 2026 PS #20
              </span>
            </div>
            <p className="text-[11px] text-[#86868b] hidden sm:block font-normal">
              Marine Intelligence
            </p>
          </div>
        </div>

        {/* Center: Apple Segmented Persona Switch & Telemetry Ribbon */}
        <div className="hidden md:flex items-center gap-3 text-xs">
          {/* Apple Segmented Control */}
          <div
            className={`flex items-center p-0.5 rounded-lg border transition-colors ${
              themeMode === 'chart'
                ? 'bg-black/[0.05] border-black/[0.08]'
                : 'bg-white/[0.06] border-white/[0.08]'
            }`}
          >
            <button
              type="button"
              onClick={() => setPersonaMode('fisher')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
                personaMode === 'fisher'
                  ? (themeMode === 'chart'
                      ? 'bg-white text-[#1d1d1f] shadow-sm'
                      : 'bg-white/[0.16] text-white shadow-sm')
                  : 'text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7]'
              }`}
            >
              <Anchor className="w-3.5 h-3.5" />
              <span>Fisher View</span>
            </button>
            <button
              type="button"
              onClick={() => setPersonaMode('district')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
                personaMode === 'district'
                  ? (themeMode === 'chart'
                      ? 'bg-white text-[#1d1d1f] shadow-sm'
                      : 'bg-white/[0.16] text-white shadow-sm')
                  : 'text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7]'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>District Board</span>
            </button>
          </div>

          {/* Live Telemetry Ribbon (Apple Spec Callouts) */}
          {liveWeather && (
            <div
              className={`flex items-center gap-3 px-3 py-1 rounded-lg border text-xs transition-colors ${
                themeMode === 'chart'
                  ? 'bg-black/[0.03] border-black/[0.06] text-[#1d1d1f]'
                  : 'bg-white/[0.04] border-white/[0.08] text-[#f5f5f7]'
              }`}
            >
              <div className="flex items-center gap-1.5" title="Sea Surface Temperature">
                <Thermometer className="w-3.5 h-3.5 text-[#86868b]" />
                <span className="font-medium tracking-tight">{liveWeather.sst_c}°C</span>
                <span className="text-[10px] text-[#86868b] uppercase tracking-wider">SST</span>
              </div>
              <span className="text-black/20 dark:text-white/20">|</span>
              <div className="flex items-center gap-1.5" title="Significant Wave Height">
                <Waves className="w-3.5 h-3.5 text-[#86868b]" />
                <span className="font-medium tracking-tight">{liveWeather.wave_height_m}m</span>
                <span className="text-[10px] text-[#86868b] uppercase tracking-wider">Waves</span>
              </div>
              <span className="text-black/20 dark:text-white/20">|</span>
              <div className="flex items-center gap-1.5" title="Surface Wind Speed">
                <Wind className="w-3.5 h-3.5 text-[#86868b]" />
                <span className="font-medium tracking-tight">{liveWeather.wind_speed_kmh} km/h</span>
                <span className="text-[10px] text-[#86868b] uppercase tracking-wider">Wind</span>
              </div>
            </div>
          )}

          {/* Circuit Breaker Status Pill */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium tracking-tight transition-colors ${
              safetyStatus === 'RED_ALERT'
                ? 'glass-icon glass-icon-red'
                : safetyStatus === 'AMBER'
                ? 'glass-icon glass-icon-amber'
                : 'glass-icon glass-icon-emerald'
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

        {/* Right Tools & Theme Toggle */}
        <div className="flex items-center gap-2 text-xs">
          {/* Theme Switch */}
          <button
            type="button"
            onClick={() => setThemeMode((prev) => (prev === 'chart' ? 'ocean' : 'chart'))}
            className="glass-icon px-2.5 py-1 text-xs gap-1.5"
            title="Toggle Visual Theme (Light vs Dark)"
          >
            {themeMode === 'chart' ? (
              <>
                <Sun className="w-3.5 h-3.5 text-[#86868b]" />
                <span className="hidden sm:inline">Light</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-[#86868b]" />
                <span className="hidden sm:inline">Dark</span>
              </>
            )}
          </button>

          {/* Agent Telemetry Drawer Button */}
          <button
            type="button"
            onClick={() => setIsTraceDrawerOpen(true)}
            className="glass-icon glass-icon-blue px-3 py-1 text-xs font-medium gap-1.5"
          >
            <Activity className="w-3.5 h-3.5 text-[#2997ff]" />
            <span>Telemetry</span>
          </button>

          {/* Legal Navigation */}
          <div className="hidden lg:flex items-center gap-2 text-[11px] text-[#86868b]">
            <button
              onClick={() => setIsPrivacyOpen(true)}
              className="hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7] transition"
            >
              Privacy
            </button>
            <span>•</span>
            <button
              onClick={() => setIsTermsOpen(true)}
              className="hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7] transition"
            >
              Terms
            </button>
          </div>

          {/* Backend Connectivity Indicator */}
          <div className="flex items-center gap-1.5 pl-2">
            <div
              className={`w-2 h-2 rounded-full ${
                isBackendHealthy ? 'bg-emerald-400' : 'bg-red-400'
              }`}
              title={isBackendHealthy ? 'FastAPI Backend Online' : 'Backend Offline'}
            />
            <span className="text-[11px] text-[#86868b] hidden sm:inline">
              {isBackendHealthy ? 'Live' : 'Offline'}
            </span>
          </div>
        </div>
      </header>

      {/* 2. Maritime Safety Circuit Breaker Banner (when alert active) */}
      <SafetyAlertBanner
        safetyStatus={safetyStatus}
        safetyOverrideBanner={safetyOverrideBanner}
        weather={liveWeather}
        harbour={selectedHarbour}
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
            }}
          />
        </div>
      ) : (
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
          {/* Left Side: Marine GIS Interactive Map */}
          <div className="w-full md:w-[58%] h-1/2 md:h-full relative shrink-0">
            <MarineMap
              harbours={harbours}
              activeHarbour={selectedHarbour}
              onSelectHarbour={(h) => setSelectedHarbour(h)}
              mapPayload={mapPayload}
              theme={themeMode}
            />
          </div>

          {/* Right Side: Multilingual Conversational Agent Console */}
          <div className="w-full md:w-[42%] h-1/2 md:h-full flex flex-col shrink-0">
            <ChatPanel
              harbours={harbours}
              selectedHarbour={selectedHarbour}
              onSelectHarbour={(h) => setSelectedHarbour(h)}
              vesselType={vesselType}
              onChangeVesselType={(v) => setVesselType(v)}
              messages={messages}
              isLoading={isLoading}
              onSendMessage={handleSendMessage}
              onOpenTraceDrawer={() => setIsTraceDrawerOpen(true)}
              liveWeather={liveWeather}
              safetyStatus={safetyStatus}
              theme={themeMode}
            />
          </div>
        </div>
      )}

      {/* 4. Multi-Agent Reasoning & Provenance Side Drawer */}
      <AgentTraceDrawer
        isOpen={isTraceDrawerOpen}
        onClose={() => setIsTraceDrawerOpen(false)}
        agentTraces={agentTraces}
        provenanceList={provenanceList}
        evidenceLedger={evidenceLedger}
      />

      {/* 5. Statutory Legal Modals */}
      <PrivacyPolicyModal
        isOpen={isPrivacyOpen}
        onClose={() => setIsPrivacyOpen(false)}
      />
      <TermsConditionsModal
        isOpen={isTermsOpen}
        onClose={() => setIsTermsOpen(false)}
      />
    </div>
  );
}
