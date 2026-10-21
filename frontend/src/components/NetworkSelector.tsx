'use client';

/**
 * src/components/NetworkSelector.tsx
 *
 * Interactive network selector enabling user to switch between
 * Binance Smart Chain (BEP-20) and TRON (TRC-20) for USDT deposit.
 */

import React from 'react';
import { CryptoNetwork } from '../types/invoice';
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
  return (
    <div className="w-full">
      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
        Select Payment Network
      </label>
      <div className="grid grid-cols-2 gap-3">
        {/* BSC Button */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => onSelect(CryptoNetwork.BSC)}
          className={`relative flex flex-col items-start p-3.5 rounded-xl border transition-all text-left ${
            selectedNetwork === CryptoNetwork.BSC
              ? 'border-yellow-500/80 bg-yellow-500/10 text-white shadow-lg shadow-yellow-500/10'
              : 'border-gray-800 bg-gray-900/50 text-gray-400 hover:border-gray-700 hover:text-gray-200'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <div className="flex items-center justify-between w-full mb-1.5">
            <span className="flex items-center gap-1.5 font-bold text-sm text-yellow-400">
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 animate-pulse" />
              BNB Chain
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-300 font-medium">
              BEP-20
            </span>
          </div>
          <p className="text-xs text-gray-300 font-medium">USDT on BSC</p>
          <div className="mt-2 flex items-center gap-1 text-[11px] text-gray-400">
            <Zap className="w-3 h-3 text-yellow-400" />
            <span>Fast (~3 sec) &bull; Lowest Fee</span>
          </div>
        </button>

        {/* TRON Button */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => onSelect(CryptoNetwork.TRON)}
          className={`relative flex flex-col items-start p-3.5 rounded-xl border transition-all text-left ${
            selectedNetwork === CryptoNetwork.TRON
              ? 'border-red-500/80 bg-red-500/10 text-white shadow-lg shadow-red-500/10'
              : 'border-gray-800 bg-gray-900/50 text-gray-400 hover:border-gray-700 hover:text-gray-200'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <div className="flex items-center justify-between w-full mb-1.5">
            <span className="flex items-center gap-1.5 font-bold text-sm text-red-400">
              <span className="w-2.5 h-2.5 rounded-full bg-red-400 animate-pulse" />
              TRON Network
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 font-medium">
              TRC-20
            </span>
          </div>
          <p className="text-xs text-gray-300 font-medium">USDT on TRON</p>
          <div className="mt-2 flex items-center gap-1 text-[11px] text-gray-400">
            <ShieldCheck className="w-3 h-3 text-red-400" />
            <span>High Liquidity &bull; Global Standard</span>
          </div>
        </button>
      </div>
    </div>
  );
};
