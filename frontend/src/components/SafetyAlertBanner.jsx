import React, { useState } from 'react';
import { AlertTriangle, ShieldAlert, ChevronDown, ChevronUp } from 'lucide-react';

export default function SafetyAlertBanner({
  safetyStatus,
  safetyOverrideBanner,
  weather,
  harbour,
  theme = 'ocean',
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (!safetyStatus || safetyStatus === 'UNKNOWN') return null;

  const isRed = safetyStatus === 'RED_ALERT';
  const isAmber = safetyStatus === 'AMBER';
  const isGreen = safetyStatus === 'GREEN';

  // If green and no override banner, do not show any banner
  if (isGreen && !safetyOverrideBanner) {
    return null;
  }

  const isLight = theme === 'chart';

  // Dynamic Theme Palette
  const containerClasses = isLight
    ? isRed
      ? 'bg-[#fef2f2]/95 border-b border-[#fecaca] text-[#991b1b]'
      : 'bg-[#fffbeb]/95 border-b border-[#fde68a] text-[#78350f]'
    : isRed
      ? 'bg-[#120809]/95 border-b border-red-500/30 text-[#f5f5f7]'
      : 'bg-[#141008]/95 border-b border-amber-500/30 text-[#f5f5f7]';

  const iconContainerClasses = isLight
    ? isRed
      ? 'w-8 h-8 rounded-lg shrink-0 flex items-center justify-center bg-[#fee2e2] border border-[#fca5a5] shadow-xs'
      : 'w-8 h-8 rounded-lg shrink-0 flex items-center justify-center bg-[#fef3c7] border border-[#fde68a] shadow-xs'
    : isRed
      ? 'w-8 h-8 rounded-lg shrink-0 glass-icon glass-icon-red'
      : 'w-8 h-8 rounded-lg shrink-0 glass-icon glass-icon-amber';

  const badgeClasses = isLight
    ? isRed
      ? 'bg-[#fee2e2] border border-[#f87171] text-[#b91c1c]'
      : 'bg-[#fef3c7] border border-[#fcd34d] text-[#b45309]'
    : isRed
      ? 'bg-red-500/15 border border-red-500/30 text-red-400'
      : 'bg-amber-500/15 border border-amber-500/30 text-amber-400';

  const titleClasses = isLight
    ? isRed
      ? 'text-[#991b1b]'
      : 'text-[#78350f]'
    : 'text-[#f5f5f7]';

  const collapsedSubtextClasses = isLight
    ? isRed
      ? 'text-[#b91c1c]/80'
      : 'text-[#92400e]/80'
    : 'text-[#86868b]';

  const buttonClasses = isLight
    ? isRed
      ? 'p-1 rounded-md hover:bg-[#fecaca]/60 text-[#b91c1c] hover:text-[#991b1b] transition-colors'
      : 'p-1 rounded-md hover:bg-[#fde68a]/60 text-[#92400e] hover:text-[#78350f] transition-colors'
    : 'p-1 rounded-md hover:bg-white/[0.08] text-[#86868b] hover:text-[#f5f5f7] transition-colors';

  const expandedCardClasses = isLight
    ? isRed
      ? 'mt-2.5 pt-2 text-xs font-normal leading-relaxed bg-white/90 p-3 rounded-lg border border-[#fecaca] text-[#991b1b] shadow-xs max-h-36 sm:max-h-48 overflow-y-auto touch-momentum'
      : 'mt-2.5 pt-2 text-xs font-normal leading-relaxed bg-white/90 p-3 rounded-lg border border-[#fde68a] text-[#78350f] shadow-xs max-h-36 sm:max-h-48 overflow-y-auto touch-momentum'
    : 'mt-2.5 pt-2 text-xs font-normal leading-relaxed bg-black/40 p-3 rounded-lg border border-white/[0.06] text-[#e1e1e6] max-h-36 sm:max-h-48 overflow-y-auto touch-momentum';

  return (
    <div className={`transition-all duration-300 backdrop-blur-xl ${containerClasses}`}>
      <div className="max-w-7xl mx-auto px-4 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={iconContainerClasses}>
              {isRed ? (
                <ShieldAlert className={`w-4 h-4 ${isLight ? 'text-[#dc2626]' : 'text-red-400'}`} />
              ) : (
                <AlertTriangle className={`w-4 h-4 ${isLight ? 'text-[#d97706]' : 'text-amber-400'}`} />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-semibold uppercase tracking-[0.02em] px-2 py-0.5 rounded ${badgeClasses}`}>
                  {isRed ? 'Circuit Breaker' : 'Caution'}
                </span>
                <span className={`text-xs sm:text-sm font-semibold tracking-[-0.03em] ${titleClasses}`}>
                  {isRed ? 'Hazardous Sea State' : 'Heightened Risk'}
                </span>
              </div>
              {!isExpanded && (
                <p className={`text-xs truncate max-w-xl mt-0.5 leading-[1.65] tracking-[-0.01em] ${collapsedSubtextClasses}`}>
                  {safetyOverrideBanner || (isRed ? 'Do not venture into open sea.' : 'Review vessel limits before sailing.')}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className={buttonClasses}
              title={isExpanded ? 'Collapse Alert' : 'Expand Alert'}
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {isExpanded && safetyOverrideBanner && (
          <div className={expandedCardClasses}>
            <p className="whitespace-pre-line font-mono text-xs leading-[1.65] tracking-[0.02em]">{safetyOverrideBanner}</p>
          </div>
        )}
      </div>
    </div>
  );
}
