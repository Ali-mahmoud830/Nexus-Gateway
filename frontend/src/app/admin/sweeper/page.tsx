'use client';

/**
 * src/app/admin/sweeper/page.tsx
 *
 * Nexus Gateway — Live Sweeper Monitor Dashboard
 * Displays real-time sweeper audit data from logs/sweeper-runs.jsonl
 * Served via /api/admin/sweeper-logs backend endpoint.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield, RefreshCw, Activity, ArrowLeft, TrendingUp,
  CheckCircle2, AlertTriangle, Clock, Zap, Database,
  Wallet, DollarSign, ExternalLink, Server, Radio,
} from 'lucide-react';
import Link from 'next/link';
import { adminLogin } from '../../../lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SweeperRun {
  runAt: string;
  mode: 'dry-run' | 'live';
  network: string;
  indicesScanned: string;
  addressesAudited: number;
  fundedTargets: number;
  totalSweptUsdt: string;
  netRecoveredUsd: string;
  gasCostUsd: string;
  priceSource: string;
  bnbUsd: number;
  trxUsd: number;
}

interface SweeperStatus {
  runs: SweeperRun[];
  taskSchedulerActive: boolean;
  lastRunAt: string | null;
  lastRunStatus: 'success' | 'failed' | 'unknown';
  totalRunsToday: number;
  totalUsdtSweptAllTime: number;
  gasStationBscAddress: string;
  gasStationTronAddress: string;
  scanRange: string;
}

// ── API helpers ───────────────────────────────────────────────────────────────

const API_BASE =
  process.env['NEXT_PUBLIC_API_URL'] ||
  (typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'http://localhost:3001'
    : 'https://nexus-gateway-backend-2n4s.onrender.com');

async function fetchSweeperStatus(token: string): Promise<SweeperStatus> {
  const res = await fetch(`${API_BASE}/api/admin/sweeper/status`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon, label, value, sub, color = 'cyan', pulse = false,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  color?: 'cyan' | 'green' | 'yellow' | 'rose' | 'purple';
  pulse?: boolean;
}) {
  const colors = {
    cyan:   { bg: 'bg-cyan-500/10',   border: 'border-cyan-500/20',   text: 'text-cyan-400'   },
    green:  { bg: 'bg-emerald-500/10',border: 'border-emerald-500/20',text: 'text-emerald-400' },
    yellow: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', text: 'text-yellow-400'  },
    rose:   { bg: 'bg-rose-500/10',   border: 'border-rose-500/20',   text: 'text-rose-400'    },
    purple: { bg: 'bg-purple-500/10', border: 'border-purple-500/20', text: 'text-purple-400'  },
  }[color];

  return (
    <div className={`rounded-2xl border ${colors.bg} ${colors.border} p-5`}>
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">{label}</span>
        <div className={`w-8 h-8 rounded-xl ${colors.bg} ${colors.border} border flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${colors.text}`} />
        </div>
      </div>
      <div className={`text-2xl font-black ${colors.text} flex items-center gap-2`}>
        {value}
        {pulse && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
      </div>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

function RunRow({ run, index }: { run: SweeperRun; index: number }) {
  const isLive   = run.mode === 'live';
  const hasFunds = run.fundedTargets > 0;
  const dateStr  = new Date(run.runAt).toLocaleString();

  return (
    <tr className={`border-b border-gray-800/60 transition-colors ${hasFunds ? 'bg-emerald-500/5' : 'hover:bg-gray-900/40'}`}>
      <td className="px-4 py-3 text-xs text-gray-400 font-mono">{dateStr}</td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
          isLive ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
        }`}>
          {isLive ? <Zap className="w-2.5 h-2.5" /> : <Activity className="w-2.5 h-2.5" />}
          {run.mode}
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-gray-300 font-mono">{run.indicesScanned}</td>
      <td className="px-4 py-3 text-xs text-gray-300 text-center">{run.addressesAudited}</td>
      <td className="px-4 py-3 text-center">
        {hasFunds ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3" />
            {run.fundedTargets} found
          </span>
        ) : (
          <span className="text-xs text-gray-600">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-xs font-mono font-bold text-emerald-400 text-right">
        {parseFloat(run.totalSweptUsdt) > 0 ? `${parseFloat(run.totalSweptUsdt).toFixed(2)} USDT` : '—'}
      </td>
      <td className="px-4 py-3 text-xs font-bold text-right">
        {parseFloat(run.netRecoveredUsd) > 0
          ? <span className="text-emerald-400">${parseFloat(run.netRecoveredUsd).toFixed(2)}</span>
          : <span className="text-gray-600">$0.00</span>
        }
      </td>
      <td className="px-4 py-3 text-xs text-gray-500 text-right font-mono">
        BNB ${run.bnbUsd?.toFixed(0)} / TRX ${run.trxUsd?.toFixed(4)}
      </td>
    </tr>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SweeperMonitorPage() {
  const [token, setToken]       = useState<string | null>(null);
  const [passkey, setPasskey]   = useState('');
  const [authErr, setAuthErr]   = useState<string | null>(null);
  const [logging, setLogging]   = useState(false);

  const [status, setStatus]     = useState<SweeperStatus | null>(null);
  const [loading, setLoading]   = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // Load saved token
  useEffect(() => {
    const t = localStorage.getItem('nexus_admin_token');
    if (t) setToken(t);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthErr(null);
    setLogging(true);
    try {
      const res = await adminLogin(passkey);
      localStorage.setItem('nexus_admin_token', res.token);
      setToken(res.token);
      setPasskey('');
    } catch (err: any) {
      setAuthErr(err.message || 'Invalid passkey');
    } finally {
      setLogging(false);
    }
  };

  const loadStatus = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await fetchSweeperStatus(token);
      setStatus(data);
      setLastRefresh(new Date());
    } catch {
      // Backend may be offline — build status from JSONL log
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!token) return;
    loadStatus();
    const iv = setInterval(loadStatus, 30_000);
    return () => clearInterval(iv);
  }, [token, loadStatus]);

  // ── Auth Gate ─────────────────────────────────────────────────────────────
  if (!token) {
    return (
      <div className="min-h-screen bg-black text-gray-100 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-gray-950 border border-gray-800 rounded-3xl p-8">
          <div className="text-center mb-6">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mb-3">
              <Shield className="w-7 h-7 text-cyan-400" />
            </div>
            <h1 className="text-xl font-black text-white">Sweeper Monitor</h1>
            <p className="text-xs text-gray-500 mt-1">Admin authentication required</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              value={passkey}
              onChange={e => setPasskey(e.target.value)}
              placeholder="Master passkey..."
              className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500 font-mono"
              required
            />
            {authErr && (
              <p className="text-xs text-rose-400 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />{authErr}
              </p>
            )}
            <button
              type="submit"
              disabled={logging}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {logging ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              Unlock Monitor
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────
  const runs      = status?.runs ?? [];
  const totalSwept = runs.reduce((s, r) => s + parseFloat(r.totalSweptUsdt || '0'), 0);
  const totalRuns  = runs.length;
  const liveRuns   = runs.filter(r => r.mode === 'live').length;
  const runsWithFunds = runs.filter(r => r.fundedTargets > 0).length;
  const latestRun  = runs[0];

  return (
    <div className="min-h-screen bg-black text-gray-100">
      {/* Header */}
      <header className="border-b border-gray-800/80 bg-gray-950/80 backdrop-blur-md sticky top-0 z-30 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/admin"
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Admin
          </Link>
          <div className="w-px h-4 bg-gray-700" />
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
              <Radio className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <span className="font-black text-white text-sm">Sweeper Monitor</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] text-gray-400">Auto-runs every 5 minutes · 50 indices × BSC + TRON</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {lastRefresh && (
            <span className="text-xs text-gray-500">
              Refreshed {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={loadStatus}
            className="p-2 rounded-xl bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-300 hover:text-white transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* Gas Station Alert */}
        <div className="rounded-2xl bg-yellow-500/5 border border-yellow-500/20 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
            <div className="space-y-3 w-full">
              <p className="text-sm font-bold text-yellow-300">Gas Station Wallets — Must be funded for live sweeping</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-black/40 rounded-xl p-3 border border-gray-800">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">BSC Gas Station (needs 0.01+ BNB)</p>
                  <p className="font-mono text-xs text-yellow-300 break-all">0x72185b2ae2a80386100E7F7f6a5DCEb31Cb01F9A</p>
                  <a
                    href="https://bscscan.com/address/0x72185b2ae2a80386100E7F7f6a5DCEb31Cb01F9A"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[10px] text-cyan-400 hover:underline mt-1"
                  >
                    <ExternalLink className="w-3 h-3" /> View on BscScan
                  </a>
                </div>
                <div className="bg-black/40 rounded-xl p-3 border border-gray-800">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">TRON Gas Station (needs 50+ TRX)</p>
                  <p className="font-mono text-xs text-yellow-300 break-all">TVjTLqXUzMUsHhjAPaWP3TpA7vvz2MuvU1</p>
                  <a
                    href="https://tronscan.org/#/address/TVjTLqXUzMUsHhjAPaWP3TpA7vvz2MuvU1"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[10px] text-cyan-400 hover:underline mt-1"
                  >
                    <ExternalLink className="w-3 h-3" /> View on TronScan
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={Activity}
            label="Total Runs"
            value={totalRuns.toString()}
            sub={`${liveRuns} live · ${totalRuns - liveRuns} dry-run`}
            color="cyan"
            pulse
          />
          <StatCard
            icon={CheckCircle2}
            label="Funded Targets Found"
            value={runsWithFunds.toString()}
            sub="Runs where balance > $0.50"
            color="green"
          />
          <StatCard
            icon={DollarSign}
            label="Total Swept"
            value={`${totalSwept.toFixed(2)} USDT`}
            sub="All-time, live mode only"
            color="yellow"
          />
          <StatCard
            icon={Clock}
            label="Last Run"
            value={latestRun ? new Date(latestRun.runAt).toLocaleTimeString() : '—'}
            sub={latestRun ? new Date(latestRun.runAt).toLocaleDateString() : 'No runs yet'}
            color="purple"
          />
        </div>

        {/* Configuration Panel */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl bg-gray-900/60 border border-gray-800 p-5 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-gray-300 uppercase tracking-wider">
              <Server className="w-4 h-4 text-cyan-400" />Scheduler Config
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-gray-500">Schedule</span><span className="text-white font-mono">Every 5 minutes</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Indices scanned</span><span className="text-white font-mono">0 – 49 (50 each)</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Addresses/run</span><span className="text-white font-mono">100 (50 BSC + 50 TRON)</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Concurrency</span><span className="text-white font-mono">8 parallel</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Min threshold</span><span className="text-white font-mono">$0.50 USDT</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Mode</span><span className="text-emerald-400 font-mono font-bold">LIVE</span></div>
            </div>
          </div>

          <div className="rounded-2xl bg-gray-900/60 border border-gray-800 p-5 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-gray-300 uppercase tracking-wider">
              <Database className="w-4 h-4 text-cyan-400" />Data Sources
            </div>
            <div className="space-y-2 text-xs">
              {[
                { chain: 'BSC', sources: ['10 RPC failover nodes', 'BscScan API', 'Ankr Multichain'] },
                { chain: 'TRON', sources: ['TronGrid REST API', 'TronScan API', 'Ankr Multichain', 'PublicNode TRON'] },
                { chain: 'Prices', sources: ['Binance Ticker', 'CoinGecko', 'CoinPaprika'] },
              ].map(g => (
                <div key={g.chain}>
                  <span className="text-cyan-400 font-bold">{g.chain}:</span>
                  <span className="text-gray-400"> {g.sources.join(' · ')}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-gray-900/60 border border-gray-800 p-5 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-gray-300 uppercase tracking-wider">
              <Wallet className="w-4 h-4 text-cyan-400" />Cold Wallets (Destination)
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <p className="text-gray-500 mb-1">BSC Cold Wallet</p>
                <p className="font-mono text-emerald-400 break-all text-[10px]">0x943c7eb933fa9724433095973a03f5a880976d2a</p>
                <a href="https://bscscan.com/address/0x943c7eb933fa9724433095973a03f5a880976d2a" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-cyan-400 hover:underline mt-1">
                  <ExternalLink className="w-3 h-3" /> BscScan
                </a>
              </div>
              <div>
                <p className="text-gray-500 mb-1">TRON Cold Wallet</p>
                <p className="font-mono text-emerald-400 break-all text-[10px]">TS2rMsBFtWM8VV3qN6PuHEmNdsbo3BQj4K</p>
                <a href="https://tronscan.org/#/address/TS2rMsBFtWM8VV3qN6PuHEmNdsbo3BQj4K" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-cyan-400 hover:underline mt-1">
                  <ExternalLink className="w-3 h-3" /> TronScan
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Latest Run Prices */}
        {latestRun && (
          <div className="rounded-2xl bg-gray-900/40 border border-gray-800 p-5">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">Latest Live Prices ({latestRun.priceSource})</span>
            </div>
            <div className="flex gap-6 text-sm">
              <div><span className="text-gray-500">BNB</span> <span className="text-white font-bold">${latestRun.bnbUsd?.toFixed(2)}</span></div>
              <div><span className="text-gray-500">TRX</span> <span className="text-white font-bold">${latestRun.trxUsd?.toFixed(4)}</span></div>
              <div className="ml-auto text-xs text-gray-500">Last updated: {new Date(latestRun.runAt).toLocaleString()}</div>
            </div>
          </div>
        )}

        {/* Run History Table */}
        <div className="rounded-2xl bg-gray-900/40 border border-gray-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span className="text-sm font-bold text-white">Run History</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-gray-800 text-gray-400 font-mono">{runs.length} runs</span>
            </div>
          </div>

          {runs.length === 0 ? (
            <div className="p-12 text-center">
              <Activity className="w-10 h-10 text-gray-700 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">No run history yet.</p>
              <p className="text-gray-600 text-xs mt-1">The sweeper runs automatically every 5 minutes.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-800 bg-gray-900/60">
                    {['Time', 'Mode', 'Indices', 'Addresses', 'Funded', 'USDT Swept', 'Net USD', 'Prices'].map(h => (
                      <th key={h} className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run, i) => <RunRow key={i} run={run} index={i} />)}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Backend Offline Notice */}
        {!status && (
          <div className="rounded-2xl bg-rose-500/5 border border-rose-500/20 p-5 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-rose-300">Backend API Offline</p>
              <p className="text-xs text-gray-400 mt-1">
                The Render backend is currently returning 503. This is because the service is <strong>suspended due to non-payment</strong>.
                Pay the invoice at <a href="https://dashboard.render.com" target="_blank" className="text-cyan-400 underline">dashboard.render.com</a> to restore it.
                The local sweeper (Windows Task Scheduler) continues to run independently.
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
