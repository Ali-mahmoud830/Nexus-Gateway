'use client';

/**
 * src/components/Navbar.tsx
 *
 * Professional FinTech Navigation Header.
 * Displays live blockchain scanner telemetry, node health, and trader account status.
 */

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSystemHealth } from '@/lib/api';
import { SystemHealthData } from '@/types/invoice';
import { Shield, Activity, User, ExternalLink } from 'lucide-react';

export const Navbar: React.FC = () => {
  const [health, setHealth] = useState<SystemHealthData | null>(null);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function checkHealth() {
      const data = await getSystemHealth();
      if (mounted) {
        if (data && data.status === 'ok') {
          setHealth(data);
          setIsOnline(true);
        } else {
          setIsOnline(false);
        }
      }
    }

    checkHealth();
    const interval = setInterval(checkHealth, 15000); // 15s refresh
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const bscBlock = health?.blockchain?.bsc?.currentTipBlock;
  const bestLatency = health?.blockchain?.bscRpcNodes?.[0]?.latencyMs || 37;

  return (
    <header className="w-full border-b border-gray-800/80 bg-[#070b14]/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition-transform">
            <Shield className="w-5 h-5 text-black stroke-[2.5]" />
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-white text-base tracking-tight leading-none group-hover:text-cyan-400 transition-colors">
              NEXUS<span className="text-cyan-400 font-light ml-1">GATEWAY</span>
            </span>
            <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mt-0.5">
              Privacy Crypto Rails
            </span>
          </div>
        </Link>

        {/* Live Telemetry Heartbeat Pill */}
        <div className="hidden md:flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-900/90 border border-gray-800 text-xs">
            <span className="relative flex h-2 w-2">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full ${
                  isOnline ? 'bg-emerald-400' : 'bg-amber-400'
                } opacity-75`}
              />
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  isOnline ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
            </span>
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-gray-300 font-medium">
              {isOnline ? 'Cloud Backend Live' : 'Connecting to Node...'}
            </span>
            {bscBlock && (
              <span className="text-[11px] font-mono text-gray-500 border-l border-gray-800 pl-2">
                BSC #{bscBlock.toLocaleString()} ({bestLatency}ms)
              </span>
            )}
          </div>

          {/* Trader Account Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-xs text-cyan-300">
            <User className="w-3.5 h-3.5" />
            <span className="font-mono font-medium">trader_usr_8829</span>
            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-200">
              VIP
            </span>
          </div>
        </div>

        {/* Right Action Links */}
        <div className="flex items-center gap-2.5 text-xs">
          <Link
            href="/admin"
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500/20 to-blue-500/20 hover:from-cyan-500/30 hover:to-blue-500/30 border border-cyan-500/30 text-cyan-300 font-bold transition-all shadow-sm shadow-cyan-500/10 cursor-pointer"
          >
            <Shield className="w-3.5 h-3.5 text-cyan-400" />
            <span>Admin Center</span>
          </Link>
        </div>
      </div>
    </header>
  );
};
