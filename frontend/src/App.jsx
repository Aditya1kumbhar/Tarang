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
  const [themeMode, setThemeMode] = useState('chart'); // 'chart' | 'ocean'

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
        setLiveWeather(data.weather);
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
        themeMode === 'ocean' ? 'dark bg-ocean-950 text-slate-100' : 'bg-paper-100 text-ink-900'
      }`}
    >
      {/* 1. Top Command Header */}
      <header
        className={`h-14 px-4 flex items-center justify-between shrink-0 z-30 shadow-sm border-b transition-colors ${
          themeMode === 'chart'
            ? 'bg-paper-50 border-paper-400 text-ink-900'
            : 'bg-ocean-900 border-cyan-500/30 text-slate-100 shadow-lg'
        }`}
      >
        {/* Brand & Identity */}
        <div className="flex items-center gap-3">
          <div
            className={`relative flex items-center justify-center w-9 h-9 rounded-sm border ${
              themeMode === 'chart'
                ? 'bg-paper-200 border-paper-500 text-ink-900'
                : 'bg-cyan-950 border-cyan-400/50 text-cyan-300'
            }`}
          >
            <Compass className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-mono font-bold text-base tracking-wider uppercase">
                ORCA
              </h1>
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-sm border font-mono ${
                  themeMode === 'chart'
                    ? 'bg-paper-200 border-paper-400 text-ink-700'
                    : 'bg-cyan-950 border-cyan-500/40 text-cyan-300'
                }`}
              >
                SIH 2026 PS #20
              </span>
            </div>
            <p className="text-[10px] text-ink-600 dark:text-slate-400 hidden sm:block tracking-tight font-mono">
              Oceanographic Reasoning & Collaborative Agents • Indian Fisheries & Maritime Safety
            </p>
          </div>
        </div>

        {/* Center: Persona Switch & Live Marine Ribbon */}
        <div className="hidden md:flex items-center gap-3 text-xs">
          {/* Dual Persona Switch */}
          <div className="flex items-center rounded-sm border border-paper-400 dark:border-cyan-500/30 overflow-hidden bg-paper-200 dark:bg-ocean-950 text-xs font-mono">
            <button
              type="button"
              onClick={() => setPersonaMode('fisher')}
              className={`px-3 py-1 flex items-center gap-1.5 transition-colors ${
                personaMode === 'fisher'
                  ? 'bg-ink-900 text-paper-50 dark:bg-cyan-500 dark:text-slate-950 font-bold'
                  : 'text-ink-600 dark:text-slate-400 hover:text-ink-900 dark:hover:text-slate-200'
              }`}
            >
              <Anchor className="w-3.5 h-3.5" />
              <span>Fisher View</span>
            </button>
            <button
              type="button"
              onClick={() => setPersonaMode('district')}
              className={`px-3 py-1 flex items-center gap-1.5 transition-colors ${
                personaMode === 'district'
                  ? 'bg-ink-900 text-paper-50 dark:bg-cyan-500 dark:text-slate-950 font-bold'
                  : 'text-ink-600 dark:text-slate-400 hover:text-ink-900 dark:hover:text-slate-200'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>District Board</span>
            </button>
          </div>

          {/* Live Telemetry Ribbon */}
          {liveWeather && (
            <div className="flex items-center gap-3 px-3 py-1 rounded-sm border border-paper-400 dark:border-cyan-500/20 bg-paper-200/80 dark:bg-ocean-950/70 font-mono">
              <div className="flex items-center gap-1.5 text-ink-800 dark:text-amber-300" title="Sea Surface Temperature">
                <Thermometer className="w-3.5 h-3.5" />
                <span className="font-bold">{liveWeather.sst_c}°C SST</span>
              </div>
              <span className="text-paper-500 dark:text-white/20">|</span>
              <div className="flex items-center gap-1.5 text-ink-800 dark:text-cyan-300" title="Significant Wave Height">
                <Waves className="w-3.5 h-3.5" />
                <span className="font-bold">{liveWeather.wave_height_m}m Waves</span>
              </div>
              <span className="text-paper-500 dark:text-white/20">|</span>
              <div className="flex items-center gap-1.5 text-ink-800 dark:text-sky-300" title="Surface Wind Speed">
                <Wind className="w-3.5 h-3.5" />
                <span className="font-bold">{liveWeather.wind_speed_kmh} km/h Wind</span>
              </div>
            </div>
          )}

          {/* Circuit Breaker Status Badge */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-[11px] font-mono font-bold uppercase tracking-wider ${
              safetyStatus === 'RED_ALERT'
                ? 'bg-risk-extreme text-white border border-red-700'
                : safetyStatus === 'AMBER'
                ? 'bg-risk-moderate text-ink-900 border border-amber-600'
                : 'bg-risk-low/20 border border-risk-low text-emerald-800 dark:text-emerald-300'
            }`}
          >
            {safetyStatus === 'RED_ALERT' ? (
              <ShieldAlert className="w-3.5 h-3.5" />
            ) : (
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            )}
            <span>Circuit Breaker: {safetyStatus.replace('_', ' ')}</span>
          </div>
        </div>

        {/* Right Tools & Theme Toggle */}
        <div className="flex items-center gap-2 text-xs">
          {/* Theme Switch */}
          <button
            type="button"
            onClick={() => setThemeMode((prev) => (prev === 'chart' ? 'ocean' : 'chart'))}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm border border-paper-400 dark:border-cyan-500/30 bg-paper-200 dark:bg-ocean-950 font-mono text-[11px] hover:border-ink-500 dark:hover:border-cyan-400 transition-colors"
            title="Toggle Visual Theme (Nautical Chart vs Ocean Dark)"
          >
            {themeMode === 'chart' ? (
              <>
                <Sun className="w-3.5 h-3.5 text-chart-600" />
                <span className="hidden sm:inline">Chart Paper</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden sm:inline">Ocean Dark</span>
              </>
            )}
          </button>

          {/* Agent Telemetry Drawer Button */}
          <button
            type="button"
            onClick={() => setIsTraceDrawerOpen(true)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-sm font-mono text-[11px] font-bold transition-colors ${
              themeMode === 'chart'
                ? 'bg-ink-900 hover:bg-ink-800 text-paper-50 border border-ink-900'
                : 'bg-cyan-600 hover:bg-cyan-500 text-slate-950'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Agent Telemetry</span>
          </button>

          {/* Custom Domain Badge */}
          <div className="hidden xl:flex items-center gap-1.5 text-[11px] font-mono px-2 py-1 rounded-sm border border-paper-400 dark:border-cyan-500/30 bg-paper-200 dark:bg-ocean-950">
            <Globe className="w-3 h-3 text-chart-600 dark:text-cyan-400" />
            <span>orca.marine.gov.in</span>
          </div>

          {/* Legal Navigation */}
          <div className="hidden lg:flex items-center gap-2 text-[11px] font-mono text-ink-600 dark:text-slate-400">
            <button
              onClick={() => setIsPrivacyOpen(true)}
              className="hover:underline underline-offset-2"
            >
              Privacy
            </button>
            <span>•</span>
            <button
              onClick={() => setIsTermsOpen(true)}
              className="hover:underline underline-offset-2"
            >
              Terms
            </button>
          </div>

          {/* Backend Connectivity Status */}
          <div className="flex items-center gap-1.5 pl-1">
            <div
              className={`w-2 h-2 rounded-sm ${
                isBackendHealthy ? 'bg-emerald-500 shadow-[0_0_6px_#10b981]' : 'bg-red-500'
              }`}
              title={isBackendHealthy ? 'FastAPI Backend Online (:8000)' : 'Backend Offline'}
            />
            <span className="text-[10px] text-ink-600 dark:text-slate-400 hidden sm:inline font-mono">
              {isBackendHealthy ? 'Online' : 'Offline'}
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
