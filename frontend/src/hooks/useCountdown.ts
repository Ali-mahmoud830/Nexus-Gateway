'use client';

/**
 * src/hooks/useCountdown.ts
 *
 * Real-time countdown timer hook calculated from ISO expiresAt timestamp.
 * Provides formatted minutes/seconds, remaining percentage, and expiration detection.
 */

import { useState, useEffect, useCallback } from 'react';

export interface CountdownState {
  minutes: number;
  seconds: number;
  formatted: string;
  isExpired: boolean;
  percentageRemaining: number;
}

export function useCountdown(
  expiresAt: string | undefined,
  totalDurationSeconds: number = 15 * 60,
  onExpire?: () => void,
): CountdownState {
  const calculateRemaining = useCallback(() => {
    if (!expiresAt) {
      return { totalSeconds: 0, isExpired: true };
    }
    const target = new Date(expiresAt).getTime();
    const now = Date.now();
    const diff = Math.max(0, Math.floor((target - now) / 1000));
    return {
      totalSeconds: diff,
      isExpired: diff <= 0,
    };
  }, [expiresAt]);

  const [{ totalSeconds, isExpired }, setTime] = useState(calculateRemaining);

  useEffect(() => {
    // Initial check
    const current = calculateRemaining();
    setTime(current);

    if (current.isExpired) {
      onExpire?.();
      return;
    }

    const interval = setInterval(() => {
      const next = calculateRemaining();
      setTime(next);

      if (next.isExpired) {
        clearInterval(interval);
        onExpire?.();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [calculateRemaining, onExpire]);

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const formatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const percentageRemaining = Math.min(
    100,
    Math.max(0, (totalSeconds / totalDurationSeconds) * 100),
  );

  return {
    minutes,
    seconds,
    formatted,
    isExpired,
    percentageRemaining,
  };
}
