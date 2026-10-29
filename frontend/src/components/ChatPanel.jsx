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
  MapPin,
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

  // Auto-scroll messages (safe against mobile WebKit smooth scroll differences)
  useEffect(() => {
    try {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    } catch (e) {
      try {
        messagesEndRef.current?.scrollIntoView(false);
      } catch (err) {
        // Fallback for older mobile WebKit
      }
    }
  }, [messages, isLoading]);

  // Web Speech API: Speech-to-Text Recognition Setup
  useEffect(() => {
    try {
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
    } catch (err) {
      console.warn('SpeechRecognition initialization error or policy restriction:', err);
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
        : 'bg-black text-[#FFFFFF] border-white/[0.08]'
    }`}>
      {/* 1. Header & Configuration Controls */}
      {/* Stage 1 & 2: Operational Context & Risk Assessment */}
      <div className={`p-3.5 border-b space-y-3 transition-colors ${
        isChartTheme
          ? 'bg-white border-black/[0.08]'
          : 'bg-black/90 backdrop-blur-2xl border-white/[0.08]'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${isChartTheme ? 'bg-[#0071e3]' : 'bg-[#2997FF]'}`}></div>
            <h2 className={`font-semibold text-xs tracking-[-0.02em] ${isChartTheme ? 'text-[#1D1D1F]' : 'xdr-gradient-text'}`}>
              ORCA Operational Console
            </h2>
          </div>
          {onViewMap && (
            <div className="flex items-center gap-1.5 md:hidden">
              <button
                type="button"
                onClick={onViewMap}
                className="xdr-pill px-3 py-1 text-xs font-medium gap-1 text-[#0071e3] dark:text-[#2997FF] rounded-full flex items-center active:scale-[0.96]"
                title="Switch to Marine Map"
              >
                <Compass className="w-3.5 h-3.5" />
                <span>Map</span>
              </button>
            </div>
          )}
        </div>

        {/* Context Selectors Grid */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          {/* Harbour Selector */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-[0.08em] mb-1 text-[#858B95] dark:text-[#6E6E73] truncate">
              Harbour
            </label>
            <select
              value={selectedHarbour?.id || 'rameswaram'}
              onChange={(e) => {
                const found = harbours.find((h) => h.id === e.target.value);
                if (found) onSelectHarbour(found);
              }}
              className={`w-full rounded-xl px-2.5 py-1.5 text-[16px] md:text-xs truncate focus:outline-none transition-all ${
                isChartTheme
                  ? 'bg-black/[0.03] border border-black/[0.08] text-[#1D1D1F] focus:border-[#0071e3]'
                  : 'bg-white/[0.04] border border-white/[0.08] text-white focus:border-[#2997FF] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]'
              }`}
            >
              {harbours.map((h) => (
                <option key={h.id} value={h.id} className={isChartTheme ? "bg-white text-[#1D1D1F]" : "bg-[#101216] text-white"}>
                  {h.name}
                </option>
              ))}
            </select>
          </div>

          {/* Vessel Selector */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-[0.08em] mb-1 text-[#858B95] dark:text-[#6E6E73] truncate">
              Vessel
            </label>
            <select
              value={vesselType}
              onChange={(e) => onChangeVesselType(e.target.value)}
              className={`w-full rounded-xl px-2.5 py-1.5 text-[16px] md:text-xs truncate focus:outline-none transition-all ${
                isChartTheme
                  ? 'bg-black/[0.03] border border-black/[0.08] text-[#1D1D1F] focus:border-[#0071e3]'
                  : 'bg-white/[0.04] border border-white/[0.08] text-white focus:border-[#2997FF] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]'
              }`}
            >
              <option value="country_craft" className={isChartTheme ? "bg-white text-[#1D1D1F]" : "bg-[#101216] text-white"}>Country Craft</option>
              <option value="mechanized_trawler" className={isChartTheme ? "bg-white text-[#1D1D1F]" : "bg-[#101216] text-white"}>Trawler (45ft)</option>
            </select>
          </div>

          {/* Language Selector */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-[0.08em] mb-1 text-[#858B95] dark:text-[#6E6E73] truncate">
              Language
            </label>
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className={`w-full rounded-xl px-2.5 py-1.5 text-[16px] md:text-xs truncate focus:outline-none transition-all ${
                isChartTheme
                  ? 'bg-black/[0.03] border border-black/[0.08] text-[#1D1D1F] focus:border-[#0071e3]'
                  : 'bg-white/[0.04] border border-white/[0.08] text-white focus:border-[#2997FF] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]'
              }`}
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code} className={isChartTheme ? "bg-white text-[#1D1D1F]" : "bg-[#101216] text-white"}>
                  {lang.label.split(' ')[0]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Stage 2: Risk Assessment & Operational Schedule Bento Card (Liquid Retina XDR Gauge) */}
        <div className={`rounded-2xl p-3.5 flex items-center justify-between gap-3.5 transition-all ${
          isChartTheme
            ? 'bg-white border border-black/[0.08] shadow-xs text-[#1D1D1F]'
            : 'bg-white/[0.04] border border-white/[0.08] text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]'
        }`}>
          <div className="flex items-center gap-3.5">
            {/* Luminous Risk Score Anchor */}
            <div className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center text-center p-2 transition-all ${
              currentScore >= 76
                ? 'xdr-jewel-red'
                : currentScore >= 51
                ? 'xdr-jewel-amber'
                : currentScore >= 26
                ? 'xdr-jewel-amber'
                : 'xdr-jewel-emerald'
            }`}>
              <span className="font-mono font-bold text-2xl leading-none tabular-nums tracking-tight">
                {currentScore}
              </span>
              <span className="text-[9px] uppercase tracking-[0.06em] font-mono opacity-80 mt-0.5">/100</span>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-semibold uppercase tracking-[0.06em] px-2.5 py-0.5 rounded-full ${
                  currentVerdict === 'EXTREME'
                    ? 'xdr-jewel-red'
                    : currentVerdict === 'HIGH' || currentVerdict === 'MODERATE'
                    ? 'xdr-jewel-amber'
                    : 'xdr-jewel-emerald'
                }`}>
                  {currentVerdict} RISK
                </span>
                <span className="text-[11px] font-normal tracking-[-0.01em] text-[#858B95] dark:text-[#A1A1A6]">
                  {vesselType === 'country_craft' ? 'Country Boat' : 'Trawler (45ft)'}
                </span>
              </div>
              <p className={`text-[11px] mt-1 font-normal tracking-[-0.01em] ${isChartTheme ? 'text-[#1D1D1F]' : 'text-[#E1E1E6]'}`}>
                Departure: <strong>04:30 - 11:30 IST</strong> • Return-by: <strong>13:00 IST</strong>
              </p>
            </div>
          </div>

          {/* Listen Action Button (Apple Pill) */}
          <button
            onClick={() => {
              const latestMsg = messages.filter((m) => m.role === 'assistant').slice(-1)[0];
              const textToRead = latestMsg?.recommendation || latestMsg?.content || `${selectedHarbour?.name || 'Harbour'}: Sea-Venture Safety Index is ${currentScore} out of 100, verdict is ${currentVerdict} risk.`;
              handleSpeak(textToRead, 9999);
            }}
            className={`xdr-pill px-3 py-2 rounded-full text-xs font-medium gap-1.5 shrink-0 flex items-center transition active:scale-[0.96] ${
              speakingMessageIndex === 9999
                ? 'bg-[#0071e3]/15 text-[#0071e3] dark:text-[#2997FF] animate-pulse border-[#0071e3]/30'
                : 'text-[#0071e3] dark:text-[#2997FF]'
            }`}
            title="Read live sea-venture advisory aloud (TTS)"
          >
            <Volume2 className="w-4 h-4 text-current" />
            <span className="tracking-tight hidden sm:inline">Listen</span>
          </button>
        </div>
      </div>

      {/* Stage 3: Quick Destination Shortcuts (Pill Strip) */}
      <div className={`px-3.5 py-2 border-b flex items-center gap-1.5 overflow-x-auto no-scrollbar touch-momentum text-xs transition-colors ${
        isChartTheme ? 'bg-[#FAFAFC] border-black/[0.06]' : 'bg-black/60 border-white/[0.06]'
      }`}>
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] shrink-0 text-[#858B95] dark:text-[#6E6E73] mr-1 flex items-center gap-1">
          <MapPin className="w-3 h-3 text-[#2997FF]" />
          Ports:
        </span>
        {DEMO_SCENARIOS.map((dm) => {
          const isSelected = selectedHarbour?.id === dm.harbourId;
          return (
            <button
              key={dm.id}
              onClick={() => handleScenarioClick(dm)}
              disabled={isLoading}
              className={`shrink-0 px-3 py-1 rounded-full text-[11px] font-medium transition active:scale-[0.96] border ${
                isSelected
                  ? 'bg-[#0071e3]/15 dark:bg-[#2997FF]/15 text-[#0071e3] dark:text-[#2997FF] border-[#0071e3]/30 dark:border-[#2997FF]/30 shadow-xs'
                  : 'xdr-pill text-[#51545A] dark:text-[#A1A1A6] hover:text-[#1D1D1F] dark:hover:text-white'
              } disabled:opacity-50`}
              title={dm.query}
            >
              {dm.label}
            </button>
          );
        })}
      </div>

      {/* Stage 4: Operational Scenarios Selector */}
      <div className={`px-3.5 py-2 border-b transition-colors ${
        isChartTheme ? 'bg-white border-black/[0.06]' : 'bg-black/90 border-white/[0.06]'
      }`}>
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] mb-1.5 text-[#858B95] dark:text-[#6E6E73]">
          <Compass className="w-3 h-3 text-[#2997FF]" />
          <span>Operational Scenarios</span>
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar touch-momentum">
          {SIH_SCENARIOS.map((sc) => (
            <button
              key={sc.id}
              onClick={() => handleScenarioClick(sc)}
              disabled={isLoading}
              title={sc.query}
              className="xdr-pill shrink-0 px-3 py-1 rounded-full text-xs font-normal transition active:scale-[0.96] flex items-center gap-1 disabled:opacity-50 text-[#51545A] dark:text-[#D1D5DB] hover:text-[#1D1D1F] dark:hover:text-white"
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
              <div className="max-w-[85%] bg-[#0071e3] dark:bg-[#2997FF] text-white rounded-2xl rounded-br-xs px-4 py-2.5 text-xs shadow-md">
                <p className="leading-[1.65] tracking-[-0.01em] whitespace-pre-wrap">{msg.content}</p>
                <div className="mt-1 text-[9px] text-white/70 text-right font-mono tracking-[0.02em]">
                  {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ) : (
              <div className={`max-w-[95%] w-full rounded-2xl rounded-bl-xs p-4 text-xs space-y-3.5 transition-all ${
                isChartTheme
                  ? 'bg-white border border-black/[0.08] shadow-xs text-[#1D1D1F]'
                  : 'bg-white/[0.04] border border-white/[0.08] text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]'
              }`}>
                {/* Agent Header with Safety Badge */}
                <div className={`flex items-center justify-between border-b pb-2.5 ${
                  isChartTheme ? 'border-black/[0.06]' : 'border-white/[0.08]'
                }`}>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs tracking-[-0.02em] xdr-gradient-text">ORCA Synthesizer</span>
                    {msg.safety_status && (
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-[0.06em] flex items-center gap-1 ${
                          msg.safety_status === 'RED_ALERT'
                            ? 'xdr-jewel-red'
                            : msg.safety_status === 'AMBER'
                            ? 'xdr-jewel-amber'
                            : 'xdr-jewel-emerald'
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
                      className="p-1.5 rounded-full hover:bg-black/[0.04] dark:hover:bg-white/[0.08] text-[#858B95] hover:text-[#1D1D1F] dark:hover:text-white transition active:scale-[0.96]"
                      title={speakingMessageIndex === idx ? 'Stop Speaking' : 'Read Aloud (TTS)'}
                    >
                      {speakingMessageIndex === idx ? (
                        <VolumeX className="w-3.5 h-3.5 text-[#0071e3] dark:text-[#2997FF]" />
                      ) : (
                        <Volume2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Direct Recommendation */}
                <div className={`font-normal leading-[1.65] whitespace-pre-wrap text-[13px] tracking-[-0.01em] ${
                  isChartTheme ? 'text-[#1D1D1F]' : 'text-[#FFFFFF]'
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
                      className="flex items-center gap-1.5 text-xs font-medium text-[#858B95] dark:text-[#A1A1A6] hover:text-[#0071e3] dark:hover:text-[#2997FF] transition active:scale-[0.97]"
                    >
                      {expandedEvidence[idx] ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                      <span>Evidence ({msg.evidence_and_reasoning.length})</span>
                    </button>

                    {expandedEvidence[idx] && (
                      <div className="mt-2.5 space-y-1.5 p-3.5 rounded-xl xdr-pill text-xs font-mono tracking-[0.01em] text-[#374151] dark:text-[#D1D5DB]">
                        {msg.evidence_and_reasoning.map((ev, i) => (
                          <div key={i} className="border-l-2 border-[#0071e3]/60 dark:border-[#2997FF]/60 pl-2.5 py-0.5">
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
          <div className="xdr-pill flex items-center gap-2.5 p-3 rounded-2xl text-xs transition-colors">
            <div className="w-3.5 h-3.5 border-2 border-[#0071e3] dark:border-[#2997FF] border-t-transparent rounded-full animate-spin"></div>
            <span className="text-[#51545A] dark:text-[#A1A1A6]">Evaluating sea state...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Stage 7: Text & Voice Input Bar (Apple Spotlight-Style Command Capsule) */}
      <form onSubmit={handleSend} className={`p-2.5 sm:p-3 border-t transition-colors backdrop-blur-2xl shrink-0 ${
        isChartTheme
          ? 'bg-white/90 border-black/[0.08]'
          : 'bg-black/90 border-white/[0.08] shadow-[0_-10px_30px_rgba(0,0,0,0.8)]'
      }`}>
        <div className="xdr-pill rounded-2xl p-1.5 flex items-center gap-2 focus-within:border-[#2997FF]/50 focus-within:ring-2 focus-within:ring-[#2997FF]/20 transition-all">
          {/* Speech-to-Text Toggle Button */}
          <button
            type="button"
            onClick={toggleListening}
            className={`p-2 rounded-xl min-w-[38px] min-h-[38px] flex items-center justify-center transition border active:scale-[0.96] ${
              isListening
                ? 'bg-red-500/15 border-red-500/30 text-red-500'
                : 'border-transparent text-[#858B95] dark:text-[#A1A1A6] hover:text-[#1D1D1F] dark:hover:text-white'
            }`}
            title={isListening ? 'Listening...' : 'Voice Input'}
            aria-label="Voice Input"
          >
            {isListening ? <MicOff className="w-4 h-4 text-red-400" /> : <Mic className="w-4 h-4" />}
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
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="sentences"
            enterKeyHint="send"
            className="flex-1 bg-transparent px-2.5 py-1.5 text-[16px] md:text-xs leading-[1.65] tracking-[-0.01em] transition focus:outline-none text-[#1D1D1F] dark:text-white placeholder-[#858B95] dark:placeholder-[#6E6E73]"
          />

          {/* Send Button */}
          <button
            type="submit"
            disabled={!inputText.trim() || isLoading}
            className="p-2 rounded-xl min-w-[38px] min-h-[38px] flex items-center justify-center font-medium transition shadow-xs bg-[#0071e3] dark:bg-[#2997FF] text-white hover:opacity-95 disabled:opacity-30 active:scale-[0.96]"
            title="Send Query"
            aria-label="Send Query"
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
      </form>
    </div>
  );
}
