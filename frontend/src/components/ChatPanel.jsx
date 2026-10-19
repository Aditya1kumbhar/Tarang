import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Compass,
  Ship,
  Languages,
  Activity,
  Layers,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  ChevronDown,
  ChevronRight,
  Info,
} from 'lucide-react';

const SIH_SCENARIOS = [
  {
    id: 'sih-1',
    label: 'PFZ Discovery',
    harbourId: 'rameswaram',
    vessel: 'country_craft',
    query: 'Find the highest confidence Potential Fishing Zones (PFZ) offshore from Rameswaram harbour.',
    tag: 'SIH PS #20 Q1',
  },
  {
    id: 'sih-2',
    label: 'Country Boat Safety',
    harbourId: 'kochi',
    vessel: 'country_craft',
    query: 'Is it safe for a small motorized country craft (Vallam) to venture into the sea off Kochi tomorrow morning?',
    tag: 'SIH PS #20 Q2',
  },
  {
    id: 'sih-3',
    label: 'Mechanized Trawler',
    harbourId: 'veraval',
    vessel: 'mechanized_trawler',
    query: 'Can a 45ft mechanized trawler venture out from Veraval harbour in Gujarat with 32 km/h winds and 2.1m wave height?',
    tag: 'SIH PS #20 Q3',
  },
  {
    id: 'sih-4',
    label: 'IMBL Border Alert',
    harbourId: 'rameswaram',
    vessel: 'country_craft',
    query: 'Find fishing coordinates 12 nautical miles East-Southeast of Rameswaram towards Talaimannar.',
    tag: 'SIH PS #20 Q4',
  },
  {
    id: 'sih-5',
    label: 'MPA Exclusion',
    harbourId: 'rameswaram',
    vessel: 'country_craft',
    query: 'Can we set our nets inside the Gulf of Mannar Marine National Park?',
    tag: 'SIH PS #20 Q5',
  },
  {
    id: 'sih-6',
    label: 'Safe A* Route',
    harbourId: 'chennai',
    vessel: 'country_craft',
    query: 'Calculate a safe navigation route from Chennai harbour to the PFZ cluster avoiding rough seas.',
    tag: 'SIH PS #20 Q6',
  },
  {
    id: 'sih-7',
    label: 'Catch Drop Diagnosis',
    harbourId: 'mangaluru',
    vessel: 'country_craft',
    query: 'Why has pelagic fish catch dropped significantly off the Mangaluru coast over the past two weeks?',
    tag: 'SIH PS #20 Q7',
  },
  {
    id: 'sih-8',
    label: 'Tamil (தமிழ்) Query',
    harbourId: 'rameswaram',
    vessel: 'country_craft',
    query: 'இன்று ராமேஸ்வரத்திலிருந்து சிறிய படகில் கடலுக்கு செல்லலாமா? காற்று மற்றும் அலை எப்படி உள்ளது?',
    tag: 'SIH PS #20 Q8',
  },
];

const DEMO_SCENARIOS = [
  { id: 'demo-safe', key: 'safe', label: 'Goa (Safe: 9)', query: 'Is it safe for a small motorized boat to venture into the sea tomorrow morning off the coast?', harbourId: 'malvan', vessel: 'country_craft' },
  { id: 'demo-danger', key: 'danger', label: 'Mumbai (Shear: 70)', query: 'Can a country craft venture out of Mumbai harbour with 34 km/h wind shear and 1.9m wave height?', harbourId: 'mumbai', vessel: 'country_craft' },
  { id: 'demo-cyclone', key: 'cyclone', label: 'Paradip (Cyclone: 92)', query: 'Severe weather alert off Paradip coast: wave height 3.8m, wind gusts 65 km/h, swell period 15s. Should vessels venture?', harbourId: 'paradip', vessel: 'country_craft' },
  { id: 'demo-pfz', key: 'pfz', label: 'Rameswaram (PFZ)', query: 'Find the highest confidence Potential Fishing Zones (PFZ) offshore from Rameswaram harbour.', harbourId: 'rameswaram', vessel: 'country_craft' },
  { id: 'demo-route', key: 'route', label: 'Chennai (Safe Route)', query: 'Calculate a safe navigation route from Chennai harbour to the PFZ cluster avoiding rough seas.', harbourId: 'chennai', vessel: 'country_craft' },
];

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ta', label: 'தமிழ் (Tamil)' },
  { code: 'ml', label: 'മലയാളം (Malayalam)' },
  { code: 'te', label: 'తెలుగు (Telugu)' },
  { code: 'mr', label: 'मराठी (Marathi)' },
  { code: 'hi', label: 'हिन्दी (Hindi)' },
];

export default function ChatPanel({
  harbours = [],
  selectedHarbour = null,
  onSelectHarbour = () => {},
  vesselType = 'country_craft',
  onChangeVesselType = () => {},
  messages = [],
  isLoading = false,
  onSendMessage = () => {},
  onOpenTraceDrawer = () => {},
  liveWeather = null,
  safetyStatus = 'GREEN',
  theme = 'chart',
}) {
  const [inputText, setInputText] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [isListening, setIsListening] = useState(false);
  const [speakingMessageIndex, setSpeakingMessageIndex] = useState(null);
  const [expandedEvidence, setExpandedEvidence] = useState({});

  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Web Speech API: Speech-to-Text Recognition Setup
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = selectedLanguage === 'ta' ? 'ta-IN' : selectedLanguage === 'hi' ? 'hi-IN' : 'en-IN';

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInputText((prev) => (prev ? `${prev} ${transcript}` : transcript));
        setIsListening(false);
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, [selectedLanguage]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert('Speech Recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge.');
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) {
        console.error(e);
      }
    }
  };

  // Web Speech API: Text-to-Speech
  const handleSpeak = (text, index) => {
    if (!('speechSynthesis' in window)) {
      alert('Text-to-Speech is not supported in this browser.');
      return;
    }

    if (speakingMessageIndex === index) {
      window.speechSynthesis.cancel();
      setSpeakingMessageIndex(null);
      return;
    }

    window.speechSynthesis.cancel();
    const cleanText = text.replace(/[*#_]|\p{Extended_Pictographic}/gu, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    utterance.onend = () => {
      setSpeakingMessageIndex(null);
    };
    utterance.onerror = () => {
      setSpeakingMessageIndex(null);
    };

    setSpeakingMessageIndex(index);
    window.speechSynthesis.speak(utterance);
  };

  const handleSend = (e) => {
    e?.preventDefault();
    if (!inputText.trim() || isLoading) return;
    onSendMessage({
      message: inputText.trim(),
      harbour_id: selectedHarbour?.id || 'rameswaram',
      vessel_type: vesselType,
      language: selectedLanguage,
    });
    setInputText('');
  };

  const handleScenarioClick = (scenario) => {
    const targetHarbour = harbours.find((h) => h.id === scenario.harbourId) || selectedHarbour;
    if (targetHarbour) {
      onSelectHarbour(targetHarbour);
    }
    onChangeVesselType(scenario.vessel);
    onSendMessage({
      message: scenario.query,
      harbour_id: scenario.harbourId,
      vessel_type: scenario.vessel,
      language: scenario.id === 'sih-8' ? 'ta' : selectedLanguage,
    });
  };

  const toggleEvidence = (msgIdx) => {
    setExpandedEvidence((prev) => ({
      ...prev,
      [msgIdx]: !prev[msgIdx],
    }));
  };

  const isChartTheme = theme === 'chart';
  const currentScore = liveWeather?.sea_venture_safety_index ?? (safetyStatus === 'RED_ALERT' ? 92 : safetyStatus === 'AMBER' ? 35 : 12);
  const currentVerdict = liveWeather?.risk_verdict ?? (safetyStatus === 'RED_ALERT' ? 'EXTREME' : safetyStatus === 'AMBER' ? 'MODERATE' : 'LOW');

  return (
    <div className={`flex flex-col h-full border-l transition-colors select-none ${
      isChartTheme
        ? 'bg-paper-100 text-ink-900 border-paper-300'
        : 'bg-ocean-900 text-slate-100 border-cyan-500/20'
    }`}>
      {/* 1. Header & Configuration Controls */}
      <div className={`p-3.5 border-b space-y-2.5 ${
        isChartTheme
          ? 'bg-paper-200/80 border-paper-300'
          : 'bg-ocean-950/70 border-cyan-500/20 backdrop-blur-md'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full animate-pulse ${isChartTheme ? 'bg-chart-500' : 'bg-cyan-400'}`}></div>
            <h2 className={`font-extrabold text-sm tracking-wide uppercase ${isChartTheme ? 'text-chart-600' : 'text-cyan-300'}`}>
              ORCA Fisher Console
            </h2>
          </div>
          <button
            onClick={onOpenTraceDrawer}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold shadow transition ${
              isChartTheme
                ? 'bg-paper-50 hover:bg-paper-300 text-ink-800 border border-paper-300'
                : 'bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Agent Traces</span>
          </button>
        </div>

        {/* Operating Controls Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
          {/* Harbour Selector */}
          <div>
            <label className={`block text-[10px] font-semibold uppercase tracking-wider mb-1 ${
              isChartTheme ? 'text-ink-500' : 'text-slate-400'
            }`}>
              Landing Harbour
            </label>
            <select
              value={selectedHarbour?.id || 'rameswaram'}
              onChange={(e) => {
                const found = harbours.find((h) => h.id === e.target.value);
                if (found) onSelectHarbour(found);
              }}
              className={`w-full rounded-md px-2 py-1.5 text-xs focus:outline-none ${
                isChartTheme
                  ? 'bg-paper-50 border border-paper-300 text-ink-900 focus:border-chart-500'
                  : 'bg-ocean-850 border border-slate-700 text-white focus:border-cyan-500'
              }`}
            >
              {harbours.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name} ({h.local_name || h.state})
                </option>
              ))}
            </select>
          </div>

          {/* Vessel Selector */}
          <div>
            <label className={`block text-[10px] font-semibold uppercase tracking-wider mb-1 ${
              isChartTheme ? 'text-ink-500' : 'text-slate-400'
            }`}>
              Vessel Profile
            </label>
            <select
              value={vesselType}
              onChange={(e) => onChangeVesselType(e.target.value)}
              className={`w-full rounded-md px-2 py-1.5 text-xs focus:outline-none ${
                isChartTheme
                  ? 'bg-paper-50 border border-paper-300 text-ink-900 focus:border-chart-500'
                  : 'bg-ocean-850 border border-slate-700 text-white focus:border-cyan-500'
              }`}
            >
              <option value="country_craft">Country Craft (Vallam)</option>
              <option value="mechanized_trawler">Mechanized Trawler (45ft)</option>
            </select>
          </div>

          {/* Language Selector */}
          <div>
            <label className={`block text-[10px] font-semibold uppercase tracking-wider mb-1 ${
              isChartTheme ? 'text-ink-500' : 'text-slate-400'
            }`}>
              Response Language
            </label>
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className={`w-full rounded-md px-2 py-1.5 text-xs focus:outline-none ${
                isChartTheme
                  ? 'bg-paper-50 border border-paper-300 text-ink-900 focus:border-chart-500'
                  : 'bg-ocean-850 border border-slate-700 text-white focus:border-cyan-500'
              }`}
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 2. Static DOM Sea-Venture Safety Dial (40px) & Regional TTS Briefing Bar */}
        <div className={`p-3 rounded-md border flex items-center justify-between gap-3 ${
          isChartTheme
            ? 'bg-paper-50 border-paper-300'
            : 'bg-ocean-950/80 border-cyan-500/20'
        }`}>
          <div className="flex items-center gap-3">
            {/* 40px Dial */}
            <div className={`flex flex-col items-center justify-center w-14 h-14 rounded-md border text-center ${
              currentScore >= 76
                ? 'bg-red-600/15 border-red-600 text-red-600 dark:text-red-400'
                : currentScore >= 51
                ? 'bg-amber-600/15 border-amber-600 text-amber-600 dark:text-amber-400'
                : currentScore >= 26
                ? 'bg-amber-500/15 border-amber-500 text-amber-500 dark:text-amber-400'
                : 'bg-emerald-600/15 border-emerald-500 text-emerald-600 dark:text-emerald-400'
            }`}>
              <span className="font-mono font-bold text-2xl leading-none">{currentScore}</span>
              <span className="text-[9px] uppercase tracking-wider font-extrabold mt-0.5">/100</span>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                  currentVerdict === 'EXTREME'
                    ? 'bg-red-700 text-white'
                    : currentVerdict === 'HIGH'
                    ? 'bg-amber-600 text-white'
                    : currentVerdict === 'MODERATE'
                    ? 'bg-amber-500 text-black'
                    : 'bg-emerald-600 text-white'
                }`}>
                  {currentVerdict} RISK
                </span>
                <span className={`text-[11px] font-mono ${isChartTheme ? 'text-ink-500' : 'text-slate-400'}`}>
                  {vesselType === 'country_craft' ? 'Country Boat' : 'Trawler (45ft)'}
                </span>
              </div>
              <p className={`text-[11px] mt-1 font-medium ${isChartTheme ? 'text-ink-700' : 'text-slate-300'}`}>
                Departure: <strong>04:30 - 11:30 IST</strong> • Return-by: <strong>13:00 IST</strong>
              </p>
            </div>
          </div>

          {/* Prominent Listen Audio Briefing Button */}
          <button
            onClick={() => {
              const latestMsg = messages.filter((m) => m.role === 'assistant').slice(-1)[0];
              const textToRead = latestMsg?.recommendation || latestMsg?.content || `${selectedHarbour?.name || 'Harbour'}: Sea-Venture Safety Index is ${currentScore} out of 100, verdict is ${currentVerdict} risk.`;
              handleSpeak(textToRead, 9999);
            }}
            className={`flex items-center gap-2 px-3 py-2 rounded-md font-bold text-xs shadow-sm transition shrink-0 ${
              speakingMessageIndex === 9999
                ? 'bg-cyan-400 text-slate-950 animate-pulse'
                : (isChartTheme ? 'bg-chart-500 hover:bg-chart-600 text-white' : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950')
            }`}
            title="Read live sea-venture advisory aloud (TTS)"
          >
            <Volume2 className="w-4 h-4" />
            <span className="font-extrabold uppercase tracking-wide">Listen</span>
          </button>
        </div>
      </div>

      {/* 3. Rehearsed Demo Scenarios (Judge Quick-Switch) */}
      <div className={`px-3 py-1.5 border-b flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs ${
        isChartTheme ? 'bg-paper-200/50 border-paper-300' : 'bg-ocean-950/60 border-cyan-500/10'
      }`}>
        <span className={`text-[10px] font-bold uppercase tracking-wider shrink-0 ${
          isChartTheme ? 'text-ink-500' : 'text-slate-400'
        }`}>
          Demo Scenarios:
        </span>
        {DEMO_SCENARIOS.map((dm) => (
          <button
            key={dm.id}
            onClick={() => handleScenarioClick(dm)}
            disabled={isLoading}
            className={`shrink-0 px-2 py-0.5 rounded text-[11px] font-bold transition border ${
              isChartTheme
                ? 'bg-paper-50 hover:bg-paper-300 border-paper-300 text-ink-800'
                : 'bg-ocean-800 hover:bg-cyan-900/60 border-cyan-500/30 text-cyan-200'
            } disabled:opacity-50`}
            title={dm.query}
          >
            {dm.label}
          </button>
        ))}
      </div>

      {/* 4. SIH 2026 Problem Statement 1-Click Benchmark Chips */}
      <div className={`px-3 py-2 border-b ${
        isChartTheme ? 'bg-paper-100 border-paper-300' : 'bg-ocean-950/40 border-cyan-500/10'
      }`}>
        <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider mb-1.5 ${
          isChartTheme ? 'text-ink-500' : 'text-slate-400'
        }`}>
          <Compass className={`w-3 h-3 ${isChartTheme ? 'text-chart-500' : 'text-cyan-400'}`} />
          <span>SIH 2026 PS #20 Benchmark Scenarios:</span>
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {SIH_SCENARIOS.map((sc) => (
            <button
              key={sc.id}
              onClick={() => handleScenarioClick(sc)}
              disabled={isLoading}
              title={sc.query}
              className={`shrink-0 px-2.5 py-1 rounded-md text-xs font-medium transition shadow-sm flex items-center gap-1 disabled:opacity-50 border ${
                isChartTheme
                  ? 'bg-paper-50 hover:bg-paper-200 border-paper-300 text-ink-800'
                  : 'bg-ocean-800 hover:bg-cyan-900/60 border-cyan-500/30 text-cyan-200'
              }`}
            >
              <span>{sc.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 3. Message Stream */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 space-y-3">
            <div className="w-10 h-10 rounded-md bg-ocean-800 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Compass className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-200">Operational Oceanographic Reasoning</h3>
              <p className="text-xs text-slate-400 max-w-sm mt-1">
                Evaluate Potential Fishing Zones (PFZ), wave hazard thresholds via Open-Meteo, IMBL/MPA geofence compliance, and A* navigation pathfinding.
              </p>
            </div>
            <div className="text-[11px] text-cyan-400/90 bg-ocean-850 border border-cyan-500/20 px-3 py-1.5 rounded-md">
              Select any benchmark scenario to execute collaborative multi-agent reasoning.
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex flex-col ${
              msg.role === 'user' ? 'items-end' : 'items-start'
            }`}
          >
            {msg.role === 'user' ? (
              <div className="max-w-[85%] bg-cyan-700 text-white rounded-2xl rounded-tr-sm px-3.5 py-2 text-xs shadow-md">
                <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                <div className="mt-1 text-[9px] text-cyan-200/70 text-right">
                  {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ) : (
              <div className="max-w-[95%] w-full bg-ocean-850 border border-cyan-500/20 rounded-2xl rounded-tl-sm p-3 text-xs shadow-xl space-y-2.5">
                {/* Agent Header with Safety Badge */}
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-cyan-300">ORCA Synthesizer</span>
                    {msg.safety_status && (
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${
                          msg.safety_status === 'RED_ALERT'
                            ? 'bg-red-600 text-white'
                            : msg.safety_status === 'AMBER'
                            ? 'bg-amber-500 text-black'
                            : 'bg-emerald-600 text-white'
                        }`}
                      >
                        {msg.safety_status === 'RED_ALERT' && <ShieldAlert className="w-3 h-3" />}
                        {msg.safety_status === 'AMBER' && <AlertTriangle className="w-3 h-3" />}
                        {msg.safety_status === 'GREEN' && <ShieldCheck className="w-3 h-3" />}
                        <span>{msg.safety_status.replace('_', ' ')}</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* TTS Button */}
                    <button
                      onClick={() => handleSpeak(msg.recommendation || msg.content, idx)}
                      className={`p-1 rounded hover:bg-white/10 transition ${
                        speakingMessageIndex === idx ? 'text-cyan-400 animate-pulse' : 'text-slate-400'
                      }`}
                      title={speakingMessageIndex === idx ? 'Stop Speaking' : 'Read Aloud (TTS)'}
                    >
                      {speakingMessageIndex === idx ? (
                        <VolumeX className="w-3.5 h-3.5 text-cyan-400" />
                      ) : (
                        <Volume2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                    {/* Trace Drawer Trigger */}
                    <button
                      onClick={onOpenTraceDrawer}
                      className="p-1 rounded text-slate-400 hover:text-cyan-300 hover:bg-white/10 transition"
                      title="Inspect Agent DAG Trace"
                    >
                      <Activity className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Direct Recommendation */}
                <div className="text-slate-100 font-medium leading-relaxed whitespace-pre-wrap text-[13px]">
                  {msg.recommendation || msg.content}
                </div>

                {/* Evidence & Physical Reasoning Accordion */}
                {msg.evidence_and_reasoning && msg.evidence_and_reasoning.length > 0 && (
                  <div className="pt-2 border-t border-white/10">
                    <button
                      onClick={() => toggleEvidence(idx)}
                      className="flex items-center gap-1.5 text-[11px] font-bold text-cyan-400 hover:text-cyan-300 transition"
                    >
                      {expandedEvidence[idx] ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                      <span>Scientific Evidence & Provenance ({msg.evidence_and_reasoning.length} Metrics)</span>
                    </button>

                    {expandedEvidence[idx] && (
                      <div className="mt-2 space-y-1.5 bg-ocean-950/80 p-2.5 rounded-lg border border-cyan-500/20 text-[11px] font-mono">
                        {msg.evidence_and_reasoning.map((ev, i) => (
                          <div key={i} className="text-slate-300 border-l-2 border-cyan-500 pl-2 py-0.5">
                            {ev}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-2.5 p-3 rounded-md bg-ocean-850/80 border border-cyan-500/20 text-xs text-cyan-300">
            <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
            <span>Collaborative agents reasoning: Planner &rarr; Specialists &rarr; Guardrail...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 4. Text & Voice Input Bar */}
      <form onSubmit={handleSend} className="p-3 bg-ocean-950/80 border-t border-cyan-500/20">
        <div className="relative flex items-center gap-2">
          {/* Speech-to-Text Toggle Button */}
          <button
            type="button"
            onClick={toggleListening}
            className={`p-2 rounded-md transition ${
              isListening
                ? 'bg-red-600 text-white ring-2 ring-red-400'
                : 'bg-ocean-800 text-slate-300 hover:text-cyan-300 hover:bg-ocean-700 border border-slate-700'
            }`}
            title={isListening ? 'Listening (Click to stop)...' : 'Voice Input (Web Speech API)'}
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          {/* Text Input Field */}
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={
              isListening
                ? 'Listening to your voice...'
                : 'Query ORCA in English, தமிழ், മലയാളം, తెలుగు, मराठी, हिन्दी...'
            }
            disabled={isLoading}
            className="flex-1 bg-ocean-850 border border-cyan-500/30 focus:border-cyan-400 rounded-md px-3.5 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
          />

          {/* Send Button */}
          <button
            type="submit"
            disabled={!inputText.trim() || isLoading}
            className="p-2 rounded-md bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 text-slate-950 disabled:text-slate-600 font-bold transition shadow"
            title="Send Query"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
