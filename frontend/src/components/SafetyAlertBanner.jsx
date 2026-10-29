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

  // Dynamic Theme Palette (Apple Liquid Retina XDR Alert Styling)
  const containerClasses = isLight
    ? isRed
      ? 'bg-[#fef2f2] border-b border-[#fecaca] text-[#991b1b]'
      : 'bg-[#fffbeb] border-b border-[#fde68a] text-[#78350f]'
    : isRed
      ? 'bg-black/90 border-b border-red-500/25 text-[#FF453A] shadow-[0_4px_20px_rgba(255,69,58,0.15)]'
      : 'bg-black/90 border-b border-amber-500/25 text-[#FF9F0A] shadow-[0_4px_20px_rgba(255,159,10,0.15)]';

  const iconContainerClasses = isLight
    ? isRed
      ? 'w-7 h-7 rounded-xl shrink-0 flex items-center justify-center bg-[#fee2e2] text-[#dc2626]'
      : 'w-7 h-7 rounded-xl shrink-0 flex items-center justify-center bg-[#fef3c7] text-[#d97706]'
    : isRed
      ? 'w-7 h-7 rounded-xl shrink-0 flex items-center justify-center xdr-jewel-red'
      : 'w-7 h-7 rounded-xl shrink-0 flex items-center justify-center xdr-jewel-amber';

  const badgeClasses = isLight
    ? isRed
      ? 'bg-[#fee2e2] border border-[#f87171] text-[#b91c1c]'
      : 'bg-[#fef3c7] border border-[#fcd34d] text-[#b45309]'
    : isRed
      ? 'xdr-jewel-red'
      : 'xdr-jewel-amber';

  const titleClasses = isLight
    ? isRed
      ? 'text-[#991b1b]'
      : 'text-[#78350f]'
    : isRed
      ? 'text-white'
      : 'text-white';

  const collapsedSubtextClasses = isLight
    ? isRed
      ? 'text-[#b91c1c]/90'
      : 'text-[#92400e]/90'
    : 'text-[#A1A1A6]';

  const buttonClasses = isLight
    ? isRed
      ? 'p-1.5 rounded-full hover:bg-[#fee2e2] text-[#991b1b] transition-colors active:scale-[0.96]'
      : 'p-1.5 rounded-full hover:bg-[#fef3c7] text-[#78350f] transition-colors active:scale-[0.96]'
    : 'p-1.5 rounded-full hover:bg-white/[0.08] text-[#86868b] hover:text-white transition-colors active:scale-[0.96]';

  const expandedCardClasses = isLight
    ? isRed
      ? 'mt-2.5 pt-2 text-xs font-normal leading-relaxed bg-white/95 p-3.5 rounded-xl border border-[#fecaca] text-[#991b1b] shadow-xs max-h-36 sm:max-h-48 overflow-y-auto touch-momentum'
      : 'mt-2.5 pt-2 text-xs font-normal leading-relaxed bg-white/95 p-3.5 rounded-xl border border-[#fde68a] text-[#78350f] shadow-xs max-h-36 sm:max-h-48 overflow-y-auto touch-momentum'
    : isRed
      ? 'mt-2.5 pt-2 text-xs font-normal leading-relaxed bg-red-950/40 border border-red-500/30 p-3.5 rounded-xl text-red-200 max-h-36 sm:max-h-48 overflow-y-auto touch-momentum backdrop-blur-xl'
      : 'mt-2.5 pt-2 text-xs font-normal leading-relaxed bg-amber-950/40 border border-amber-500/30 p-3.5 rounded-xl text-amber-200 max-h-36 sm:max-h-48 overflow-y-auto touch-momentum backdrop-blur-xl';

  return (
    <div className={`transition-all duration-300 backdrop-blur-xl ${containerClasses}`}>
      <div className="max-w-7xl mx-auto px-4 py-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className={iconContainerClasses}>
              {isRed ? (
                <ShieldAlert className="w-4 h-4 text-current" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-current" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-semibold uppercase tracking-[0.02em] px-1.5 py-0.5 rounded ${badgeClasses}`}>
                  {isRed ? 'Circuit Breaker' : 'Caution'}
                </span>
                <span className={`text-xs sm:text-[13px] font-semibold tracking-[-0.02em] ${titleClasses}`}>
                  {isRed ? 'Hazardous Sea State' : 'Heightened Risk Advisory'}
                </span>
              </div>
              {!isExpanded && (
                <p className={`text-xs truncate max-w-2xl mt-0.5 leading-normal tracking-[-0.01em] ${collapsedSubtextClasses}`}>
                  {safetyOverrideBanner || (isRed ? 'Do not venture into open sea.' : 'Review vessel limits before sailing.')}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
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
            <p className="whitespace-pre-line font-sans text-xs sm:text-[13px] leading-[1.65] tracking-[-0.01em]">{safetyOverrideBanner}</p>
          </div>
        )}
      </div>
    </div>
  );
}
