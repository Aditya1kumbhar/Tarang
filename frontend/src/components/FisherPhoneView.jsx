import React, { useState, useEffect, useRef } from 'react';
import {
  Volume2,
  VolumeX,
  Compass,
  Anchor,
  Clock,
  Waves,
  Wind,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Fuel,
  TrendingUp,
  MapPin,
  RefreshCw,
} from 'lucide-react';
import DataDrillBar from './DataDrillBar';
import HourlyTimeline from './HourlyTimeline';

const INDIC_LANGUAGES = [
  { code: 'en', label: 'English', voiceLang: 'en-IN' },
  { code: 'ta', label: 'தமிழ்', voiceLang: 'ta-IN' },
  { code: 'ml', label: 'മലയാളം', voiceLang: 'ml-IN' },
  { code: 'te', label: 'తెలుగు', voiceLang: 'te-IN' },
  { code: 'kn', label: 'ಕನ್ನಡ', voiceLang: 'kn-IN' },
  { code: 'mr', label: 'मराठी', voiceLang: 'mr-IN' },
  { code: 'gu', label: 'ગુજરાતી', voiceLang: 'gu-IN' },
  { code: 'bn', label: 'বাংলা', voiceLang: 'bn-IN' },
  { code: 'hi', label: 'हिन्दी', voiceLang: 'hi-IN' },
];

export default function FisherPhoneView({
  selectedHarbour,
  vesselType,
  harbours = [],
  onSelectHarbour,
  onSelectVessel,
  onSwitchToDesktop,
  themeMode = 'ocean',
}) {
  const [fishingData, setFishingData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedLang, setSelectedLang] = useState('en');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const synthRef = useRef(window.speechSynthesis);

  const harbourId = selectedHarbour?.id || 'rameswaram';

  const loadFishingPlan = () => {
    setLoading(true);
    fetch(`/api/v1/fishing?harbour_id=${harbourId}`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setFishingData(data);
      })
      .catch((err) => console.error('Failed to load fishing plan:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadFishingPlan();
    // Stop speaking when harbour changes
    if (synthRef.current) synthRef.current.cancel();
    setIsSpeaking(false);
  }, [harbourId]);

  // Web Speech API Voice Narration
  const handleToggleVoice = () => {
    if (!synthRef.current) {
      alert('Speech synthesis is not supported on this device/browser.');
      return;
    }

    if (isSpeaking) {
      synthRef.current.cancel();
      setIsSpeaking(false);
      return;
    }

    if (!fishingData) return;

    const riskScore = fishingData.risk?.score || 25;
    const isSafe = riskScore <= 35;
    const departure = fishingData.trip_plan?.best_departure_time || '05:30 IST';
    const returnBy = fishingData.trip_plan?.return_by_time || '11:00 IST';
    const target = fishingData.trip_plan?.target_ground?.zone_id || 'PFZ 1';
    const species = fishingData.trip_plan?.likely_species?.join(', ') || 'Indian mackerel';
    const wave = fishingData.weather?.wave_height_m || 1.1;
    const wind = fishingData.weather?.wind_speed_kmh || 16.0;

    let textToSpeak = '';
    if (isSafe) {
      textToSpeak = `Maritime advisory for ${selectedHarbour?.name || 'your harbour'}. Conditions are favourable for sea venture. Recommended departure time is ${departure}. You must return by ${returnBy} before sea state deteriorates. Wave height is ${wave} metres and surface wind is ${wind} kilometres per hour. Target zone is ${target}, with high likelihood of ${species}.`;
    } else {
      textToSpeak = `Caution alert for ${selectedHarbour?.name || 'your harbour'}. High sea conditions or squall warning in effect. Wave height is ${wave} metres, wind is ${wind} kilometres per hour. Small fishing craft are advised not to venture past nearshore waters. Follow official coastal bulletins.`;
    }

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    const langObj = INDIC_LANGUAGES.find((l) => l.code === selectedLang);
    utterance.lang = langObj?.voiceLang || 'en-IN';
    utterance.rate = 0.95;

    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    synthRef.current.cancel();
    synthRef.current.speak(utterance);
    setIsSpeaking(true);
  };

  const riskScore = fishingData?.risk?.score ?? 20;
  const isSafe = riskScore <= 25;
  const isCaution = riskScore > 25 && riskScore <= 50;
  const isDanger = riskScore > 50;

  const statusLabel = isSafe ? 'SAFE TO LAUNCH' : isCaution ? 'HEIGHTENED CAUTION' : 'DO NOT VENTURE';
  const statusColor = isSafe ? 'text-[#30D158]' : isCaution ? 'text-[#FF9F0A]' : 'text-[#FF453A]';
  const ringColor = isSafe ? 'border-[#30D158]' : isCaution ? 'border-[#FF9F0A]' : 'border-[#FF453A]';

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 space-y-4 touch-momentum max-w-xl mx-auto w-full">
      {/* Top Selector Bar (Harbour & Language) */}
      <div className="flex items-center justify-between gap-2">
        <select
          value={harbourId}
          onChange={(e) => {
            const h = harbours.find((item) => item.id === e.target.value);
            if (h && onSelectHarbour) onSelectHarbour(h);
          }}
          className="flex-1 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl px-3 py-2 text-xs font-semibold text-[#1D1D1F] dark:text-[#FFFFFF] focus:outline-none focus:ring-1 focus:ring-[#2997FF]"
        >
          {harbours.map((h) => (
            <option key={h.id} value={h.id} className="dark:bg-[#1C1C1E] text-black dark:text-white">
              {h.name} ({h.state})
            </option>
          ))}
        </select>

        <select
          value={selectedLang}
          onChange={(e) => setSelectedLang(e.target.value)}
          className="bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl px-2.5 py-2 text-xs font-semibold text-[#1D1D1F] dark:text-[#FFFFFF] focus:outline-none focus:ring-1 focus:ring-[#2997FF]"
        >
          {INDIC_LANGUAGES.map((l) => (
            <option key={l.code} value={l.code} className="dark:bg-[#1C1C1E] text-black dark:text-white">
              {l.label}
            </option>
          ))}
        </select>

        <button
          onClick={loadFishingPlan}
          title="Refresh telemetry"
          className="p-2 rounded-xl border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 active:scale-95"
        >
          <RefreshCw className={`w-4 h-4 text-[#86868b] ${loading ? 'animate-spin text-[#2997FF]' : ''}`} />
        </button>
      </div>

      {/* Telemetry Drill Simulator Bar for Judges/Demonstrators */}
      <div className="xdr-surface rounded-2xl p-2.5 flex items-center justify-between">
        <span className="text-[10px] font-semibold tracking-tight text-[#86868b] uppercase">
          Test Telemetry Drill:
        </span>
        <DataDrillBar onDrillChange={loadFishingPlan} themeMode={themeMode} />
      </div>

      {/* Giant 40px Numeric Safety Dial Card */}
      <div className="xdr-surface rounded-3xl p-6 flex flex-col items-center justify-center text-center relative overflow-hidden shadow-xl">
        <div className="relative mb-3 flex items-center justify-center">
          {/* Dial ring */}
          <div
            className={`w-32 h-32 rounded-full border-4 flex flex-col items-center justify-center shadow-lg transition-colors ${ringColor} ${
              isSafe ? 'bg-[#30D158]/10' : isCaution ? 'bg-[#FF9F0A]/10' : 'bg-[#FF453A]/10'
            }`}
          >
            <span className="text-4xl font-extrabold tracking-tight text-[#1D1D1F] dark:text-[#FFFFFF]">
              {riskScore}
            </span>
            <span className="text-[10px] font-bold text-[#86868b] tracking-wider uppercase">
              Safety Index
            </span>
          </div>
        </div>

        <h2 className={`text-xl font-bold tracking-tight uppercase ${statusColor}`}>
          {statusLabel}
        </h2>
        <p className="text-xs text-[#86868b] dark:text-[#A1A1A6] mt-1 max-w-sm">
          {fishingData?.safety_gate?.headline ||
            'Physical wave, wind, and geofence parameters evaluated by deterministic tools'}
        </p>
      </div>

      {/* Giant One-Tap "LISTEN" Audio Button */}
      <button
        onClick={handleToggleVoice}
        className={`w-full py-4 px-6 rounded-2xl font-bold text-sm tracking-wide transition-all duration-200 flex items-center justify-center gap-3 select-none active:scale-[0.98] shadow-lg ${
          isSpeaking
            ? 'bg-[#FF453A] text-white animate-pulse shadow-[0_8px_24px_rgba(255,69,58,0.4)]'
            : 'bg-[#0071E3] dark:bg-[#2997FF] text-white hover:opacity-95 shadow-[0_8px_24px_rgba(41,151,255,0.35)]'
        }`}
      >
        {isSpeaking ? (
          <>
            <VolumeX className="w-5 h-5" />
            <span>STOP AUDIO NARRATION</span>
          </>
        ) : (
          <>
            <Volume2 className="w-5 h-5" />
            <span>LISTEN TO TODAY&apos;S TRIP PLAN (VOICE)</span>
          </>
        )}
      </button>

      {/* Actionable Today Trip Window: Departure & Return Cards */}
      <div className="grid grid-cols-2 gap-3">
        {/* Departure Card */}
        <div className="xdr-surface rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#30D158] mb-1">
            <Clock className="w-3.5 h-3.5" />
            <span>Best Departure</span>
          </div>
          <span className="text-2xl font-bold tracking-tight text-[#1D1D1F] dark:text-[#FFFFFF]">
            {fishingData?.trip_plan?.best_departure_time || '05:30 IST'}
          </span>
          <span className="text-[10px] text-[#86868b] mt-1">Dawn feeding window</span>
        </div>

        {/* Return-By Deadline Card */}
        <div className="xdr-surface rounded-2xl p-4 flex flex-col justify-between border-l-2 border-l-[#FF453A]">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#FF453A] mb-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Mandatory Return</span>
          </div>
          <span className="text-2xl font-bold tracking-tight text-[#FF453A]">
            {fishingData?.trip_plan?.return_by_time || '11:30 IST'}
          </span>
          <span className="text-[10px] text-[#86868b] mt-1">Before afternoon squalls</span>
        </div>
      </div>

      {/* 24-Hour Sea-State Trajectory Ribbon */}
      <HourlyTimeline harbourId={harbourId} themeMode={themeMode} />

      {/* Target Fishing Grounds & Species Likelihood Card */}
      <div className="xdr-surface rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#2997FF]" />
            <h3 className="text-xs sm:text-sm font-semibold tracking-tight text-[#1D1D1F] dark:text-[#FFFFFF]">
              Target Species Likelihood
            </h3>
          </div>
          <span className="text-[10px] font-medium text-[#86868b]">INCOIS + OBIS</span>
        </div>

        {/* Species Chips */}
        <div className="flex flex-wrap gap-2">
          {fishingData?.trip_plan?.likely_species?.map((sp, idx) => (
            <div
              key={idx}
              className="px-3 py-1.5 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 flex items-center gap-2"
            >
              <div className="w-2 h-2 rounded-full bg-[#30D158]" />
              <span className="text-xs font-semibold text-[#1D1D1F] dark:text-[#FFFFFF]">{sp}</span>
            </div>
          ))}
        </div>

        {/* Recommended Area */}
        {fishingData?.trip_plan?.target_ground && (
          <div className="p-3 rounded-xl bg-[#2997FF]/10 border border-[#2997FF]/20 flex items-center justify-between text-xs">
            <div>
              <p className="font-semibold text-[#1D1D1F] dark:text-[#FFFFFF]">
                Primary Target: Zone {fishingData.trip_plan.target_ground.zone_id}
              </p>
              <p className="text-[11px] text-[#86868b]">
                {fishingData.trip_plan.target_ground.distance_km} km offshore · SST {fishingData.trip_plan.target_ground.sst_c}°C
              </p>
            </div>
            <div className="text-right">
              <span className="text-sm font-bold text-[#30D158]">
                {fishingData.trip_plan.target_ground.probability_pct}%
              </span>
              <p className="text-[9px] uppercase tracking-wider text-[#86868b]">Probability</p>
            </div>
          </div>
        )}
      </div>

      {/* Artisanal Trip Economics Card */}
      {fishingData?.trip_plan?.economics && (
        <div className="xdr-surface rounded-2xl p-4 space-y-2.5">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#30D158]" />
            <h3 className="text-xs sm:text-sm font-semibold tracking-tight text-[#1D1D1F] dark:text-[#FFFFFF]">
              Artisanal Trip Economics (FRP Boat)
            </h3>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center pt-1">
            <div className="p-2 rounded-xl bg-black/5 dark:bg-white/5">
              <span className="text-[10px] text-[#86868b] block">Fuel Burn</span>
              <strong className="text-xs sm:text-sm font-bold text-[#1D1D1F] dark:text-[#FFFFFF]">
                {fishingData.trip_plan.economics.fuel_litres} L (₹{fishingData.trip_plan.economics.fuel_cost_inr})
              </strong>
            </div>

            <div className="p-2 rounded-xl bg-black/5 dark:bg-white/5">
              <span className="text-[10px] text-[#86868b] block">Est Haul</span>
              <strong className="text-xs sm:text-sm font-bold text-[#1D1D1F] dark:text-[#FFFFFF]">
                {fishingData.trip_plan.economics.catch_kg_low}-{fishingData.trip_plan.economics.catch_kg_high} kg
              </strong>
            </div>

            <div className="p-2 rounded-xl bg-[#30D158]/10 border border-[#30D158]/20">
              <span className="text-[10px] text-[#30D158] block">Net Profit</span>
              <strong className="text-xs sm:text-sm font-bold text-[#30D158]">
                ₹{fishingData.trip_plan.economics.profit_inr}
              </strong>
            </div>
          </div>

          <p className="text-[9px] text-[#86868b] italic text-center">
            {fishingData.trip_plan.economics.assumptions}
          </p>
        </div>
      )}

      {/* Button to Switch Back to Desktop GIS View */}
      <button
        onClick={onSwitchToDesktop}
        className="w-full py-3 rounded-xl border border-black/10 dark:border-white/10 text-xs font-semibold text-[#86868b] hover:text-[#1D1D1F] dark:hover:text-[#FFFFFF] hover:bg-black/5 dark:hover:bg-white/5 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
      >
        <Compass className="w-4 h-4 text-[#2997FF]" />
        <span>Switch to Desktop GIS Map & Full Reasoning</span>
      </button>
    </div>
  );
}
