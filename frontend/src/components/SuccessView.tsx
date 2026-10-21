'use client';

/**
 * src/components/SuccessView.tsx
 *
 * Celebratory screen displayed once payment confirmation is finalized.
 * Fires confetti and presents the verified transaction hash.
 */

import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { CryptoNetwork } from '../types/invoice';
import { CheckCircle2, ExternalLink, ArrowRight } from 'lucide-react';

interface SuccessViewProps {
  amount: string;
  cryptoCurrency: string;
  network: CryptoNetwork;
  txHash?: string;
  depositAddress: string;
  onReturn?: () => void;
}

export const SuccessView: React.FC<SuccessViewProps> = ({
  amount,
  cryptoCurrency,
  network,
  txHash,
  onReturn,
}) => {
  useEffect(() => {
    // Fire confetti bursts
    const duration = 2.5 * 1000;
    const animationEnd = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
      });

      if (Date.now() < animationEnd) {
        requestAnimationFrame(frame);
      }
    };
    frame();
  }, []);

  const explorerUrl = txHash
    ? network === CryptoNetwork.BSC
      ? `https://bscscan.com/tx/${txHash}`
      : `https://tronscan.org/#/transaction/${txHash}`
    : null;

  return (
    <div className="flex flex-col items-center text-center space-y-6 py-4 animate-in fade-in duration-500">
      {/* Animated Check Icon */}
      <div className="relative">
        <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-500/40 flex items-center justify-center crypto-glow-success">
          <CheckCircle2 className="w-10 h-10 text-emerald-400 animate-bounce" />
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Payment Confirmed!</h2>
        <p className="text-sm text-gray-400 mt-1">
          Your deposit has been verified on the blockchain and credited.
        </p>
      </div>

      {/* Payment Summary Box */}
      <div className="w-full bg-gray-900/80 rounded-2xl p-4 border border-emerald-500/30 text-left space-y-3">
        <div className="flex justify-between items-center text-xs text-gray-400">
          <span>Amount Credited</span>
          <span className="text-emerald-400 font-bold font-mono text-sm">
            +{amount} {cryptoCurrency}
          </span>
        </div>
        <div className="flex justify-between items-center text-xs text-gray-400">
          <span>Network</span>
          <span className="text-gray-200 font-medium">
            {network === CryptoNetwork.BSC ? 'BNB Smart Chain (BEP-20)' : 'TRON (TRC-20)'}
          </span>
        </div>

        {txHash && (
          <div className="pt-2 border-t border-gray-800 flex justify-between items-center text-xs">
            <span className="text-gray-400">Transaction</span>
            <a
              href={explorerUrl || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 font-mono text-[11px]"
            >
              <span>
                {txHash.slice(0, 8)}...{txHash.slice(-8)}
              </span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}
      </div>

      {/* Return Button */}
      <button
        type="button"
        onClick={onReturn || (() => window.location.reload())}
        className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-bold text-sm shadow-lg shadow-emerald-500/25 transition-all cursor-pointer"
      >
        <span>Return to Trading Dashboard</span>
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
};
