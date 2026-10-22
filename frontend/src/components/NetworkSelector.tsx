'use client';

/**
 * src/components/NetworkSelector.tsx
 *
 * Institutional Network Selector for USDT deposits.
 * Features official SVG iconography for Binance Smart Chain and TRON,
 * transparent fee estimations, and instant protocol badges.
 */

import React from 'react';
import { CryptoNetwork } from '../types/invoice';
import { NETWORK_FEES } from '../lib/api';
import { Zap, ShieldCheck } from 'lucide-react';

interface NetworkSelectorProps {
  selectedNetwork: CryptoNetwork;
  onSelect: (network: CryptoNetwork) => void;
  disabled?: boolean;
}

export const NetworkSelector: React.FC<NetworkSelectorProps> = ({
  selectedNetwork,
  onSelect,
  disabled = false,
}) => {
  const bscFee = NETWORK_FEES[CryptoNetwork.BSC];
  const tronFee = NETWORK_FEES[CryptoNetwork.TRON];

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Select Deposit Network
        </label>
        <span className="text-[11px] text-cyan-400 font-medium">USDT Stablecoin</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* BSC BEP-20 Option */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => onSelect(CryptoNetwork.BSC)}
          className={`relative flex flex-col items-start p-4 rounded-2xl border transition-all text-left ${
            selectedNetwork === CryptoNetwork.BSC
              ? 'border-yellow-500/80 bg-gradient-to-br from-yellow-500/15 via-gray-900 to-gray-900 text-white shadow-xl shadow-yellow-500/10'
              : 'border-gray-800 bg-gray-900/50 text-gray-400 hover:border-gray-700 hover:text-gray-200'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          {/* Header with Logo */}
          <div className="flex items-center justify-between w-full mb-2">
            <div className="flex items-center gap-2">
              {/* Binance Smart Chain Vector Logo */}
              <svg className="w-5 h-5 text-yellow-400" viewBox="0 0 32 32" fill="currentColor">
                <path d="M16 2.5L20.2 6.7L11.8 15.1L7.6 10.9L16 2.5Z" />
                <path d="M21.8 8.3L26 12.5L16 22.5L11.8 18.3L21.8 8.3Z" />
                <path d="M16 24.1L20.2 19.9L24.4 24.1L16 32.5L7.6 24.1L11.8 19.9L16 24.1Z" />
                <path d="M6 12.5L10.2 16.7L6 20.9L1.8 16.7L6 12.5Z" />
                <path d="M26 12.5L30.2 16.7L26 20.9L21.8 16.7L26 12.5Z" />
              </svg>
              <span className="font-bold text-sm text-yellow-400">BNB Chain</span>
            </div>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
              BEP-20
            </span>
          </div>

          <p className="text-xs text-gray-300 font-medium">Tether USDT</p>

          {/* Fee & Speed Badge */}
          <div className="mt-3 pt-2.5 border-t border-gray-800/80 w-full flex flex-col gap-1 text-[11px]">
            <div className="flex items-center justify-between text-gray-400">
              <span className="flex items-center gap-1">
                <Zap className="w-3 h-3 text-yellow-400" />
                <span>Speed</span>
              </span>
              <span className="font-medium text-yellow-300">{bscFee.blockTimeEstimate}</span>
            </div>
            <div className="flex items-center justify-between text-gray-400">
              <span>Network Gas</span>
              <span className="text-emerald-400 font-mono font-medium">~$0.05 (Subsidized)</span>
            </div>
          </div>
        </button>

        {/* TRON TRC-20 Option */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => onSelect(CryptoNetwork.TRON)}
          className={`relative flex flex-col items-start p-4 rounded-2xl border transition-all text-left ${
            selectedNetwork === CryptoNetwork.TRON
              ? 'border-red-500/80 bg-gradient-to-br from-red-500/15 via-gray-900 to-gray-900 text-white shadow-xl shadow-red-500/10'
              : 'border-gray-800 bg-gray-900/50 text-gray-400 hover:border-gray-700 hover:text-gray-200'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          {/* Header with Logo */}
          <div className="flex items-center justify-between w-full mb-2">
            <div className="flex items-center gap-2">
              {/* TRON Vector Logo */}
              <svg className="w-5 h-5 text-red-500" viewBox="0 0 32 32" fill="currentColor">
                <path d="M2.5 3.5L28.5 7.5L23.5 28.5L2.5 3.5Z" fillOpacity="0.3" />
                <path d="M2.5 3.5L28.5 7.5L16 18.5L2.5 3.5Z" />
                <path d="M16 18.5L28.5 7.5L23.5 28.5L16 18.5Z" />
                <path d="M2.5 3.5L16 18.5L23.5 28.5L2.5 3.5Z" fillOpacity="0.6" />
              </svg>
              <span className="font-bold text-sm text-red-400">TRON Network</span>
            </div>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/30">
              TRC-20
            </span>
          </div>

          <p className="text-xs text-gray-300 font-medium">Tether USDT</p>

          {/* Fee & Speed Badge */}
          <div className="mt-3 pt-2.5 border-t border-gray-800/80 w-full flex flex-col gap-1 text-[11px]">
            <div className="flex items-center justify-between text-gray-400">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-red-400" />
                <span>Liquidity</span>
              </span>
              <span className="font-medium text-red-300">Global Standard</span>
            </div>
            <div className="flex items-center justify-between text-gray-400">
              <span>Network Gas</span>
              <span className="text-emerald-400 font-mono font-medium">~$1.00 (Subsidized)</span>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
};
