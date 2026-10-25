import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ORCA Application ErrorBoundary caught an unhandled exception:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen w-screen bg-[#0a0a0c] text-[#f5f5f7] p-6 text-center select-none font-sans">
          <div className="max-w-md w-full p-6 rounded-2xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-xl shadow-2xl flex flex-col items-center">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4 text-amber-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h1 className="text-base font-semibold tracking-tight mb-2">
              ORCA Interface Recovery
            </h1>
            <p className="text-xs text-[#86868b] leading-relaxed mb-5">
              An unexpected display issue occurred in the interface. Click below to reload and restore normal marine operations.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0071e3] hover:bg-[#0077ed] text-white text-xs font-medium transition-all shadow-md active:scale-95"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reload Interface</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

