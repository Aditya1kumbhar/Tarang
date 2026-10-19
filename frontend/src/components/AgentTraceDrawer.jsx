import React, { useState } from 'react';
import {
  X,
  Activity,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Database,
  Cpu,
  Layers,
  Code,
  ShieldAlert,
  ChevronDown,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';

export default function AgentTraceDrawer({ isOpen, onClose, agentTraces = [], provenanceList = [], evidenceLedger = [] }) {
  const [selectedTraceIndex, setSelectedTraceIndex] = useState(0);
  const [viewMode, setViewMode] = useState('summary'); // 'summary' | 'ledger' | 'provenance' | 'json'

  if (!isOpen) return null;

  const totalLatencyMs = agentTraces.reduce((sum, t) => sum + (t.latency_ms || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in select-none">
      <div className="w-full max-w-xl h-full bg-ocean-950 border-l border-cyan-500/30 shadow-2xl flex flex-col text-slate-100">
        {/* Drawer Header */}
        <div className="p-4 border-b border-cyan-500/20 bg-ocean-900/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 ring-1 ring-cyan-500/40">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-sm tracking-wide text-white uppercase flex items-center gap-2">
                <span>Collaborative Agent Telemetry</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono font-bold">
                  {agentTraces.length} Nodes
                </span>
              </h2>
              <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                <Clock className="w-3 h-3 text-cyan-400" />
                <span>Total Pipeline Latency: <strong className="text-cyan-300 font-mono">{totalLatencyMs.toFixed(1)} ms</strong></span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-cyan-500/10 bg-ocean-900/40 text-xs overflow-x-auto">
          <button
            onClick={() => setViewMode('summary')}
            className={`px-3 py-1.5 rounded-md font-semibold transition shrink-0 ${
              viewMode === 'summary'
                ? 'bg-cyan-600 text-slate-950'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            Agent DAG Execution
          </button>
          <button
            onClick={() => setViewMode('ledger')}
            className={`px-3 py-1.5 rounded-md font-semibold transition shrink-0 flex items-center gap-1.5 ${
              viewMode === 'ledger'
                ? 'bg-cyan-600 text-slate-950'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <Layers className="w-3 h-3" />
            <span>Evidence Ledger ({evidenceLedger.length})</span>
          </button>
          <button
            onClick={() => setViewMode('provenance')}
            className={`px-3 py-1.5 rounded-md font-semibold transition shrink-0 flex items-center gap-1.5 ${
              viewMode === 'provenance'
                ? 'bg-cyan-600 text-slate-950'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <Database className="w-3 h-3" />
            <span>Pydantic Provenance</span>
          </button>
          <button
            onClick={() => setViewMode('json')}
            className={`px-3 py-1.5 rounded-md font-semibold transition shrink-0 flex items-center gap-1.5 ${
              viewMode === 'json'
                ? 'bg-cyan-600 text-slate-950'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <Code className="w-3 h-3" />
            <span>Raw JSON</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* TAB 1: Agent Execution DAG */}
          {viewMode === 'summary' && (
            <div className="space-y-3">
              {agentTraces.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  No active agent execution traces recorded yet. Run any scenario to inspect the multi-agent DAG.
                </div>
              ) : (
                agentTraces.map((trace, idx) => {
                  const isCircuitBreaker = trace.agent_name.includes('CircuitBreaker');
                  const isSynthesis = trace.agent_name.includes('Synthesis');
                  const isPlanner = trace.agent_name.includes('Planner');

                  return (
                    <div
                      key={idx}
                      className={`p-3.5 rounded-xl border transition-all ${
                        isCircuitBreaker
                          ? 'bg-red-950/30 border-red-500/40'
                          : 'bg-ocean-850 border-cyan-500/20 hover:border-cyan-400/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold ${
                              isCircuitBreaker
                                ? 'bg-red-600 text-white'
                                : isSynthesis
                                ? 'bg-teal-600 text-white'
                                : isPlanner
                                ? 'bg-amber-600 text-white'
                                : 'bg-cyan-600 text-slate-950'
                            }`}
                          >
                            {idx + 1}
                          </div>
                          <div>
                            <h4 className="font-bold text-xs text-white tracking-wide">
                              {trace.agent_name}
                            </h4>
                            <p className="text-[11px] text-slate-400">{trace.task_description}</p>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1">
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/40 text-cyan-300 border border-cyan-500/20">
                            {trace.latency_ms.toFixed(1)} ms
                          </span>
                          <span className="text-[9px] font-semibold text-emerald-400 flex items-center gap-0.5">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            <span>{(trace.confidence_score * 100).toFixed(0)}% Conf.</span>
                          </span>
                        </div>
                      </div>

                      {/* Summary / Output Card */}
                      <div className="mt-2.5 pt-2 border-t border-white/10 text-xs text-slate-200 bg-black/30 p-2 rounded-lg font-mono text-[11px] leading-relaxed">
                        {trace.output_summary}
                      </div>

                      {/* Citations if any */}
                      {trace.citations && trace.citations.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {trace.citations.map((cite, cIdx) => (
                            <span
                              key={cIdx}
                              className="text-[10px] px-2 py-0.5 rounded bg-ocean-900 border border-slate-700 text-slate-300"
                            >
                              Source: {cite}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 2: Decoupled Evidence Ledger */}
          {viewMode === 'ledger' && (
            <div className="space-y-3">
              {evidenceLedger.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  No active evidence ledger entries recorded for current query.
                </div>
              ) : (
                evidenceLedger.map((entry, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-ocean-850 border border-cyan-500/20 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                      <div className="flex items-center gap-1.5 text-cyan-300 font-bold">
                        <Layers className="w-3.5 h-3.5 text-cyan-400" />
                        <span>{entry.parameter_name}</span>
                      </div>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                        entry.data_mode === 'LIVE'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}>
                        {entry.data_mode}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
                      <div>
                        <span className="text-slate-400">Mission/Platform:</span>{' '}
                        <strong className="text-white">{entry.platform_mission}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400">Sensor:</span>{' '}
                        <strong className="text-white">{entry.source_sensor}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400">Spatial Resolution:</span>{' '}
                        <strong className="text-cyan-300 font-mono">{entry.spatial_resolution}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400">Station / Sector:</span>{' '}
                        <strong className="text-slate-300 font-mono">{entry.station_id || 'Offshore Grid'}</strong>
                      </div>
                    </div>

                    {entry.anomaly_note && (
                      <div className="text-[11px] text-amber-200 bg-amber-950/40 p-2.5 rounded-lg border border-amber-500/30 leading-relaxed">
                        <strong className="text-amber-300 uppercase tracking-wider text-[10px] block mb-0.5">
                          Sensor Reality & Domain Grounding:
                        </strong>
                        {entry.anomaly_note}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 3: Pydantic Provenance Metadata */}
          {viewMode === 'provenance' && (
            <div className="space-y-3">
              {provenanceList.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  No external provenance entries registered for current query.
                </div>
              ) : (
                provenanceList.map((prov, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-ocean-850 border border-cyan-500/20 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                      <div className="flex items-center gap-1.5 text-cyan-300 font-bold">
                        <Database className="w-3.5 h-3.5 text-cyan-400" />
                        <span>{prov.source_dataset}</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">
                        {prov.timestamp_utc}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
                      <div>
                        <span className="text-slate-400">Resolution:</span>{' '}
                        <strong className="text-white font-mono">{prov.resolution_km} km</strong>
                      </div>
                      <div>
                        <span className="text-slate-400">Coordinates:</span>{' '}
                        <strong className="text-white font-mono">
                          [{prov.bounding_box.map((v) => v.toFixed(2)).join(', ')}]
                        </strong>
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-400 bg-black/30 p-2 rounded border border-white/5">
                      <strong>Methodology:</strong> {prov.processing_methodology}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 3: Raw JSON Inspector */}
          {viewMode === 'json' && (
            <div className="bg-ocean-900 p-3 rounded-xl border border-cyan-500/20 overflow-x-auto">
              <pre className="text-[10px] font-mono text-cyan-200 leading-relaxed">
                {JSON.stringify({ agent_traces: agentTraces, provenance_list: provenanceList }, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        <div className="p-3 border-t border-cyan-500/20 bg-ocean-900/60 text-center text-[11px] text-slate-400">
          Deterministic Mathematical Verification & Strict Provenance Enforced
        </div>
      </div>
    </div>
  );
}
