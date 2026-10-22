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
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-md animate-fade-in select-none">
      <div className="w-full max-w-xl h-full bg-[#0a0a0c] border-l border-white/[0.08] shadow-2xl flex flex-col text-[#f5f5f7]">
        {/* Drawer Header */}
        <div className="p-4 border-b border-white/[0.08] bg-black/60 backdrop-blur-xl flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="glass-icon glass-icon-blue w-8 h-8">
              <Activity className="w-4 h-4 text-[#2997ff]" />
            </div>
            <div>
              <h2 className="font-semibold text-xs tracking-tight text-[#f5f5f7] uppercase flex items-center gap-2">
                <span>Agent Telemetry</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.08] text-[#86868b] font-mono font-medium">
                  {agentTraces.length} Nodes
                </span>
              </h2>
              <div className="text-[11px] text-[#86868b] flex items-center gap-2 mt-0.5">
                <Clock className="w-3 h-3 text-[#86868b]" />
                <span>Latency: <strong className="text-[#f5f5f7] font-mono font-medium">{totalLatencyMs.toFixed(1)} ms</strong></span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="glass-icon w-8 h-8 text-[#86868b] hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs (Apple Segmented Style) */}
        <div className="flex items-center gap-1.5 p-2 border-b border-white/[0.06] bg-black/40 text-xs overflow-x-auto">
          <button
            onClick={() => setViewMode('summary')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition shrink-0 ${
              viewMode === 'summary'
                ? 'bg-white text-black shadow-sm'
                : 'text-[#86868b] hover:text-[#f5f5f7] hover:bg-white/[0.04]'
            }`}
          >
            DAG
          </button>
          <button
            onClick={() => setViewMode('ledger')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition shrink-0 flex items-center gap-1.5 ${
              viewMode === 'ledger'
                ? 'bg-white text-black shadow-sm'
                : 'text-[#86868b] hover:text-[#f5f5f7] hover:bg-white/[0.04]'
            }`}
          >
            <Layers className="w-3 h-3" />
            <span>Ledger ({evidenceLedger.length})</span>
          </button>
          <button
            onClick={() => setViewMode('provenance')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition shrink-0 flex items-center gap-1.5 ${
              viewMode === 'provenance'
                ? 'bg-white text-black shadow-sm'
                : 'text-[#86868b] hover:text-[#f5f5f7] hover:bg-white/[0.04]'
            }`}
          >
            <Database className="w-3 h-3" />
            <span>Provenance</span>
          </button>
          <button
            onClick={() => setViewMode('json')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition shrink-0 flex items-center gap-1.5 ${
              viewMode === 'json'
                ? 'bg-white text-black shadow-sm'
                : 'text-[#86868b] hover:text-[#f5f5f7] hover:bg-white/[0.04]'
            }`}
          >
            <Code className="w-3 h-3" />
            <span>JSON</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* TAB 1: Agent Execution DAG */}
          {viewMode === 'summary' && (
            <div className="space-y-3">
              {agentTraces.length === 0 ? (
                <div className="text-center py-12 text-[#86868b] text-xs">
                  No agent execution traces recorded yet.
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
                          ? 'bg-red-500/10 border-red-500/30'
                          : 'bg-white/[0.04] border-white/[0.08] hover:border-white/[0.15]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-6 h-6 rounded-lg text-xs font-mono font-medium ${
                              isCircuitBreaker
                                ? 'glass-icon glass-icon-red'
                                : isSynthesis
                                ? 'glass-icon glass-icon-emerald'
                                : isPlanner
                                ? 'glass-icon glass-icon-amber'
                                : 'glass-icon glass-icon-blue'
                            }`}
                          >
                            {idx + 1}
                          </div>
                          <div>
                            <h4 className="font-medium text-xs text-[#f5f5f7] tracking-tight">
                              {trace.agent_name}
                            </h4>
                            <p className="text-[11px] text-[#86868b]">{trace.task_description}</p>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1">
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/40 text-[#f5f5f7] border border-white/[0.08]">
                            {trace.latency_ms.toFixed(1)} ms
                          </span>
                          <span className="text-[9px] font-medium text-emerald-400 flex items-center gap-0.5">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            <span>{(trace.confidence_score * 100).toFixed(0)}% Conf.</span>
                          </span>
                        </div>
                      </div>

                      {/* Summary / Output Card */}
                      <div className="mt-2.5 pt-2 border-t border-white/[0.06] text-xs text-[#d1d1d6] bg-black/40 p-2.5 rounded-lg font-mono text-[11px] leading-relaxed">
                        {trace.output_summary}
                      </div>

                      {/* Citations if any */}
                      {trace.citations && trace.citations.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {trace.citations.map((cite, cIdx) => (
                            <span
                              key={cIdx}
                              className="text-[10px] px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.08] text-[#86868b]"
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
                    className="p-3.5 rounded-xl bg-white/[0.04] border border-white/[0.08] space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between border-b border-white/[0.06] pb-1.5">
                      <div className="flex items-center gap-1.5 text-[#f5f5f7] font-medium">
                        <Layers className="w-3.5 h-3.5 text-[#86868b]" />
                        <span>{entry.parameter_name}</span>
                      </div>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-medium uppercase border ${
                        entry.data_mode === 'LIVE'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }`}>
                        {entry.data_mode}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] text-[#86868b]">
                      <div>
                        <span>Platform:</span>{' '}
                        <strong className="text-[#f5f5f7] font-medium">{entry.platform_mission}</strong>
                      </div>
                      <div>
                        <span>Sensor:</span>{' '}
                        <strong className="text-[#f5f5f7] font-medium">{entry.source_sensor}</strong>
                      </div>
                      <div>
                        <span>Resolution:</span>{' '}
                        <strong className="text-[#f5f5f7] font-mono font-medium">{entry.spatial_resolution}</strong>
                      </div>
                      <div>
                        <span>Sector:</span>{' '}
                        <strong className="text-[#86868b] font-mono">{entry.station_id || 'Offshore Grid'}</strong>
                      </div>
                    </div>

                    {entry.anomaly_note && (
                      <div className="text-[11px] text-amber-300 bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20 leading-relaxed">
                        <strong className="text-amber-400 uppercase tracking-wider text-[10px] block mb-0.5 font-medium">
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
                <div className="text-center py-12 text-[#86868b] text-xs">
                  No external provenance entries registered for current query.
                </div>
              ) : (
                provenanceList.map((prov, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-white/[0.04] border border-white/[0.08] space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between border-b border-white/[0.06] pb-1.5">
                      <div className="flex items-center gap-1.5 text-[#f5f5f7] font-medium">
                        <Database className="w-3.5 h-3.5 text-[#86868b]" />
                        <span>{prov.source_dataset}</span>
                      </div>
                      <span className="text-[10px] font-mono text-[#86868b]">
                        {prov.timestamp_utc}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] text-[#86868b]">
                      <div>
                        <span>Resolution:</span>{' '}
                        <strong className="text-[#f5f5f7] font-mono font-medium">{prov.resolution_km} km</strong>
                      </div>
                      <div>
                        <span>Coordinates:</span>{' '}
                        <strong className="text-[#f5f5f7] font-mono font-medium">
                          [{prov.bounding_box.map((v) => v.toFixed(2)).join(', ')}]
                        </strong>
                      </div>
                    </div>

                    <div className="text-[11px] text-[#86868b] bg-black/40 p-2.5 rounded-lg border border-white/[0.06]">
                      <strong className="text-[#f5f5f7] font-medium">Methodology:</strong> {prov.processing_methodology}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 4: Raw JSON Inspector */}
          {viewMode === 'json' && (
            <div className="bg-black/60 p-3.5 rounded-xl border border-white/[0.08] overflow-x-auto">
              <pre className="text-[10px] font-mono text-[#d1d1d6] leading-relaxed">
                {JSON.stringify({ agent_traces: agentTraces, provenance_list: provenanceList }, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        <div className="p-3 border-t border-white/[0.08] bg-black/40 text-center text-[11px] text-[#86868b]">
          Deterministic Mathematical Verification & Strict Provenance Enforced
        </div>
      </div>
    </div>
  );
}
