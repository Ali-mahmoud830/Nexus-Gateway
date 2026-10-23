'use client';

/**
 * src/components/CountdownTimer.tsx
 *
 * 15-minute countdown clock component displaying minutes and seconds
 * with an urgent pulsing alert when less than 3 minutes remain.
 */

import React from 'react';
import { useCountdown } from '../hooks/useCountdown';
import { Clock, AlertCircle } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface CountdownTimerProps {
  expiresAt: string | undefined;
  onExpire?: () => void;
}

export const CountdownTimer: React.FC<CountdownTimerProps> = ({ expiresAt, onExpire }) => {
  const { t } = useLanguage();
  const { minutes, seconds, formatted, isExpired, percentageRemaining } = useCountdown(
    expiresAt,
    15 * 60,
    onExpire,
  );

  const isUrgent = minutes < 3 && !isExpired;

  if (isExpired) {
    return (
      <div className="flex items-center gap-2 text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3.5 py-2 rounded-xl text-xs font-semibold">
        <AlertCircle className="w-4 h-4" />
        <span>{t.timeExpired}</span>
      </div>
    );
  }

  return (
    <div className="w-full bg-gray-900/60 rounded-xl p-3 border border-gray-800">
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="flex items-center gap-1.5 text-gray-400 font-medium">
          <Clock className={`w-3.5 h-3.5 ${isUrgent ? 'text-amber-400 animate-pulse' : 'text-gray-400'}`} />
          {t.paymentWindow}
        </span>
        <span
          className={`font-mono font-bold text-sm tracking-wider ${
            isUrgent ? 'text-amber-400 animate-pulse' : 'text-gray-200'
          }`}
        >
          {formatted}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
        <div
          className={`h-full transition-all duration-1000 ${
            isUrgent
              ? 'bg-gradient-to-r from-amber-500 to-rose-500'
              : 'bg-gradient-to-r from-emerald-500 to-cyan-500'
          }`}
          style={{ width: `${percentageRemaining}%` }}
        />
      </div>
    </div>
  );
};
