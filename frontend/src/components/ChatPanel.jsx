import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Compass,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  ChevronDown,
  ChevronRight,
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
  liveWeather = null,
  safetyStatus = 'GREEN',
  theme = 'chart',
  onViewMap = null,
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
        ? 'bg-[#fbfbfd] text-[#1d1d1f] border-black/[0.08]'
        : 'bg-[#0a0a0c] text-[#f5f5f7] border-white/[0.08]'
    }`}>
      {/* 1. Header & Configuration Controls */}
      <div className={`p-3.5 border-b space-y-3 transition-colors ${
        isChartTheme
          ? 'bg-white/80 border-black/[0.08] backdrop-blur-md'
          : 'bg-black/40 border-white/[0.08] backdrop-blur-md'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isChartTheme ? 'bg-[#0071e3]' : 'bg-[#2997ff]'}`}></div>
            <h2 className={`font-semibold text-xs tracking-tight uppercase ${isChartTheme ? 'text-[#1d1d1f]' : 'text-[#f5f5f7]'}`}>
              ORCA Console
            </h2>
          </div>
          {onViewMap && (
            <div className="flex items-center gap-1.5 md:hidden">
              <button
                type="button"
                onClick={onViewMap}
                className="glass-icon px-2.5 py-1 text-xs font-medium gap-1 text-[#2997ff]"
                title="Switch to Marine Map"
              >
                <Compass className="w-3.5 h-3.5" />
                <span>Map</span>
              </button>
            </div>
          )}
        </div>

        {/* Operating Controls Grid */}
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2 text-xs">
          {/* Harbour Selector */}
          <div>
            <label className="block text-[9px] sm:text-[10px] font-medium uppercase tracking-wider mb-1 text-[#86868b] truncate">
              Harbour
            </label>
            <select
              value={selectedHarbour?.id || 'rameswaram'}
              onChange={(e) => {
                const found = harbours.find((h) => h.id === e.target.value);
                if (found) onSelectHarbour(found);
              }}
              className={`w-full rounded-lg px-1.5 sm:px-2.5 py-1.5 text-[11px] sm:text-xs truncate focus:outline-none transition ${
                isChartTheme
                  ? 'bg-black/[0.03] border border-black/[0.1] text-[#1d1d1f] focus:border-[#0071e3]'
                  : 'bg-white/[0.05] border border-white/[0.1] text-[#f5f5f7] focus:border-[#2997ff]'
              }`}
            >
              {harbours.map((h) => (
                <option key={h.id} value={h.id} className={isChartTheme ? "bg-white text-[#1d1d1f]" : "bg-[#141417] text-white"}>
                  {h.name}
                </option>
              ))}
            </select>
          </div>

          {/* Vessel Selector */}
          <div>
            <label className="block text-[9px] sm:text-[10px] font-medium uppercase tracking-wider mb-1 text-[#86868b] truncate">
              Vessel
            </label>
            <select
              value={vesselType}
              onChange={(e) => onChangeVesselType(e.target.value)}
              className={`w-full rounded-lg px-1.5 sm:px-2.5 py-1.5 text-[11px] sm:text-xs truncate focus:outline-none transition ${
                isChartTheme
                  ? 'bg-black/[0.03] border border-black/[0.1] text-[#1d1d1f] focus:border-[#0071e3]'
                  : 'bg-white/[0.05] border border-white/[0.1] text-[#f5f5f7] focus:border-[#2997ff]'
              }`}
            >
              <option value="country_craft" className={isChartTheme ? "bg-white text-[#1d1d1f]" : "bg-[#141417] text-white"}>Country Craft</option>
              <option value="mechanized_trawler" className={isChartTheme ? "bg-white text-[#1d1d1f]" : "bg-[#141417] text-white"}>Trawler (45ft)</option>
            </select>
          </div>

          {/* Language Selector */}
          <div>
            <label className="block text-[9px] sm:text-[10px] font-medium uppercase tracking-wider mb-1 text-[#86868b] truncate">
              Language
            </label>
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className={`w-full rounded-lg px-1.5 sm:px-2.5 py-1.5 text-[11px] sm:text-xs truncate focus:outline-none transition ${
                isChartTheme
                  ? 'bg-black/[0.03] border border-black/[0.1] text-[#1d1d1f] focus:border-[#0071e3]'
                  : 'bg-white/[0.05] border border-white/[0.1] text-[#f5f5f7] focus:border-[#2997ff]'
              }`}
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code} className={isChartTheme ? "bg-white text-[#1d1d1f]" : "bg-[#141417] text-white"}>
                  {lang.label.split(' ')[0]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 2. Static DOM Sea-Venture Safety Dial (40px) & Regional TTS Briefing Bar */}
        <div className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-colors ${
          isChartTheme
            ? 'bg-white border-black/[0.08] shadow-sm'
            : 'bg-white/[0.03] border-white/[0.08]'
        }`}>
          <div className="flex items-center gap-3">
            {/* 40px Dial */}
            <div className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center text-center transition-colors ${
              currentScore >= 76
                ? 'glass-icon glass-icon-red'
                : currentScore >= 51
                ? 'glass-icon glass-icon-amber'
                : currentScore >= 26
                ? 'glass-icon glass-icon-amber'
                : 'glass-icon glass-icon-emerald'
            }`}>
              <span className={`font-mono font-bold text-2xl leading-none ${
                currentScore >= 76
                  ? 'text-red-700 dark:text-red-400'
                  : currentScore >= 26
                  ? 'text-amber-700 dark:text-amber-400'
                  : 'text-emerald-700 dark:text-emerald-400'
              }`}>{currentScore}</span>
              <span className="text-[9px] uppercase tracking-wider font-medium opacity-70 mt-0.5">/100</span>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border ${
                  currentVerdict === 'EXTREME'
                    ? 'bg-red-500/15 border-red-500/30 text-red-700 dark:text-red-400'
                    : currentVerdict === 'HIGH' || currentVerdict === 'MODERATE'
                    ? 'bg-amber-500/15 border-amber-500/30 text-amber-700 dark:text-amber-400'
                    : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                }`}>
                  {currentVerdict} RISK
                </span>
                <span className="text-[11px] font-normal text-[#86868b]">
                  {vesselType === 'country_craft' ? 'Country Boat' : 'Trawler (45ft)'}
                </span>
              </div>
              <p className={`text-[11px] mt-1 font-normal ${isChartTheme ? 'text-[#1d1d1f]' : 'text-[#d1d1d6]'}`}>
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
            className={`glass-icon px-3 py-2 text-xs font-medium gap-2 shrink-0 ${
              speakingMessageIndex === 9999 ? 'glass-icon-blue animate-pulse' : ''
            }`}
            title="Read live sea-venture advisory aloud (TTS)"
          >
            <Volume2 className="w-4 h-4 text-[#2997ff]" />
            <span className="tracking-wide">Listen</span>
          </button>
        </div>
      </div>

      {/* 3. Rehearsed Demo Scenarios */}
      <div className={`px-3 py-1.5 border-b flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs transition-colors ${
        isChartTheme ? 'bg-black/[0.02] border-black/[0.06]' : 'bg-black/20 border-white/[0.06]'
      }`}>
        <span className="text-[10px] font-medium uppercase tracking-wider shrink-0 text-[#86868b]">
          Demo:
        </span>
        {DEMO_SCENARIOS.map((dm) => (
          <button
            key={dm.id}
            onClick={() => handleScenarioClick(dm)}
            disabled={isLoading}
            className={`shrink-0 px-2.5 py-0.5 rounded-lg text-[11px] font-medium transition border ${
              isChartTheme
                ? 'bg-white hover:bg-black/[0.04] border-black/[0.08] text-[#1d1d1f]'
                : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.08] text-[#e1e1e6]'
            } disabled:opacity-50`}
            title={dm.query}
          >
            {dm.label}
          </button>
        ))}
      </div>

      {/* 4. SIH 2026 Problem Statement Benchmark Chips */}
      <div className={`px-3 py-2 border-b transition-colors ${
        isChartTheme ? 'bg-[#fbfbfd] border-black/[0.08]' : 'bg-black/30 border-white/[0.06]'
      }`}>
        <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider mb-1.5 text-[#86868b]">
          <Compass className="w-3 h-3 text-[#86868b]" />
          <span>Scenarios</span>
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {SIH_SCENARIOS.map((sc) => (
            <button
              key={sc.id}
              onClick={() => handleScenarioClick(sc)}
              disabled={isLoading}
              title={sc.query}
              className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-normal transition flex items-center gap-1 disabled:opacity-50 border ${
                isChartTheme
                  ? 'bg-white hover:bg-black/[0.04] border-black/[0.08] text-[#1d1d1f]'
                  : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.08] text-[#e1e1e6]'
              }`}
            >
              <span>{sc.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 3. Message Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#86868b]">
            <Compass className="w-5 h-5 text-[#86868b] mb-2" />
            <h3 className={`font-medium text-sm ${isChartTheme ? 'text-[#1d1d1f]' : 'text-[#f5f5f7]'}`}>
              Advisory Console
            </h3>
            <p className="text-xs text-[#86868b] mt-0.5">
              Select a scenario or enter a query.
            </p>
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
              <div className="max-w-[85%] bg-[#0071e3] text-white rounded-2xl rounded-br-sm px-4 py-2.5 text-xs shadow-sm">
                <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                <div className="mt-1 text-[9px] text-white/70 text-right font-mono">
                  {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ) : (
              <div className={`max-w-[95%] w-full rounded-2xl rounded-bl-sm p-4 text-xs shadow-sm space-y-3 border transition-colors ${
                isChartTheme
                  ? 'bg-white border-black/[0.08] text-[#1d1d1f]'
                  : 'bg-white/[0.04] border-white/[0.08] text-[#f5f5f7]'
              }`}>
                {/* Agent Header with Safety Badge */}
                <div className={`flex items-center justify-between border-b pb-2.5 ${
                  isChartTheme ? 'border-black/[0.06]' : 'border-white/[0.08]'
                }`}>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs tracking-tight">ORCA Synthesizer</span>
                    {msg.safety_status && (
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1 border ${
                          msg.safety_status === 'RED_ALERT'
                            ? 'bg-red-500/15 border-red-500/30 text-red-700 dark:text-red-400'
                            : msg.safety_status === 'AMBER'
                            ? 'bg-amber-500/15 border-amber-500/30 text-amber-700 dark:text-amber-400'
                            : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                        }`}
                      >
                        {msg.safety_status === 'RED_ALERT' && <ShieldAlert className="w-3 h-3 text-current" />}
                        {msg.safety_status === 'AMBER' && <AlertTriangle className="w-3 h-3 text-current" />}
                        {msg.safety_status === 'GREEN' && <ShieldCheck className="w-3 h-3 text-current" />}
                        <span>{msg.safety_status.replace('_', ' ')}</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* TTS Button */}
                    <button
                      onClick={() => handleSpeak(msg.recommendation || msg.content, idx)}
                      className="p-1 rounded-md hover:bg-white/[0.08] text-[#86868b] hover:text-[#f5f5f7] transition"
                      title={speakingMessageIndex === idx ? 'Stop Speaking' : 'Read Aloud (TTS)'}
                    >
                      {speakingMessageIndex === idx ? (
                        <VolumeX className="w-3.5 h-3.5 text-[#2997ff]" />
                      ) : (
                        <Volume2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Direct Recommendation */}
                <div className={`font-normal leading-relaxed whitespace-pre-wrap text-[13px] ${
                  isChartTheme ? 'text-[#1d1d1f]' : 'text-[#f5f5f7]'
                }`}>
                  {msg.recommendation || msg.content}
                </div>

                {/* Evidence & Physical Reasoning Accordion */}
                {msg.evidence_and_reasoning && msg.evidence_and_reasoning.length > 0 && (
                  <div className={`pt-2.5 border-t ${
                    isChartTheme ? 'border-black/[0.06]' : 'border-white/[0.08]'
                  }`}>
                    <button
                      onClick={() => toggleEvidence(idx)}
                      className="flex items-center gap-1.5 text-[11px] font-medium text-[#86868b] hover:text-[#f5f5f7] transition"
                    >
                      {expandedEvidence[idx] ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                      <span>Evidence ({msg.evidence_and_reasoning.length})</span>
                    </button>

                    {expandedEvidence[idx] && (
                      <div className={`mt-2 space-y-1.5 p-3 rounded-lg border text-[11px] font-mono ${
                        isChartTheme
                          ? 'bg-black/[0.02] border-black/[0.08] text-[#1d1d1f]'
                          : 'bg-black/40 border-white/[0.08] text-[#d1d1d6]'
                      }`}>
                        {msg.evidence_and_reasoning.map((ev, i) => (
                          <div key={i} className="border-l border-[#2997ff]/60 pl-2.5 py-0.5">
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
          <div className={`flex items-center gap-2.5 p-3 rounded-xl border text-xs transition-colors ${
            isChartTheme
              ? 'bg-black/[0.02] border-black/[0.08] text-[#1d1d1f]'
              : 'bg-white/[0.04] border-white/[0.08] text-[#f5f5f7]'
          }`}>
            <div className="w-3.5 h-3.5 border-2 border-[#2997ff] border-t-transparent rounded-full animate-spin"></div>
            <span>Evaluating sea state...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 4. Text & Voice Input Bar */}
      <form onSubmit={handleSend} className={`p-2.5 sm:p-3 pb-safe border-t transition-colors backdrop-blur-xl ${
        isChartTheme
          ? 'bg-white/80 border-black/[0.08]'
          : 'bg-black/60 border-white/[0.08]'
      }`}>
        <div className="relative flex items-center gap-2">
          {/* Speech-to-Text Toggle Button */}
          <button
            type="button"
            onClick={toggleListening}
            className={`p-2.5 rounded-lg transition ${
              isListening ? 'glass-icon glass-icon-red' : 'glass-icon'
            }`}
            title={isListening ? 'Listening...' : 'Voice Input'}
          >
            {isListening ? <MicOff className="w-4 h-4 text-red-400" /> : <Mic className="w-4 h-4 text-[#86868b]" />}
          </button>

          {/* Text Input Field */}
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={
              isListening
                ? 'Listening...'
                : 'Ask ORCA in any language...'
            }
            disabled={isLoading}
            className={`flex-1 rounded-lg px-3.5 py-2.5 text-xs transition focus:outline-none focus:ring-1 ${
              isChartTheme
                ? 'bg-black/[0.03] border border-black/[0.1] focus:border-[#0071e3] text-[#1d1d1f] placeholder-[#86868b] focus:ring-[#0071e3]'
                : 'bg-white/[0.05] border border-white/[0.1] focus:border-[#2997ff] text-[#f5f5f7] placeholder-[#86868b] focus:ring-[#2997ff]'
            }`}
          />

          {/* Send Button */}
          <button
            type="submit"
            disabled={!inputText.trim() || isLoading}
            className="glass-icon glass-icon-blue p-2.5 rounded-lg font-medium transition shadow-sm disabled:opacity-30"
            title="Send Query"
          >
            <Send className="w-4 h-4 text-current" />
          </button>
        </div>
      </form>
    </div>
  );
}
