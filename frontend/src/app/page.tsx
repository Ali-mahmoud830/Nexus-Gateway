'use client';

/**
 * src/app/page.tsx
 *
 * Binary Options Trading Platform - Deposit Terminal.
 * Allows users to choose an amount and network, creates a dynamic
 * private HD-derived invoice, and displays the real-time checkout card.
 */

import React, { useState } from 'react';
import { CryptoNetwork, InvoiceDetails } from '@/types/invoice';
import { NetworkSelector } from '@/components/NetworkSelector';
import { CheckoutCard } from '@/components/CheckoutCard';
import { createInvoice } from '@/lib/api';
import { ShieldCheck, TrendingUp, Sparkles, Loader2, ArrowRight } from 'lucide-react';

const PRESET_AMOUNTS = [25, 50, 100, 250, 500, 1000];

export default function DepositPortal() {
  const [selectedNetwork, setSelectedNetwork] = useState<CryptoNetwork>(CryptoNetwork.BSC);
  const [amount, setAmount] = useState<number>(100);
  const [customAmount, setCustomAmount] = useState<string>('100');
  const [userId] = useState<string>('trader_usr_8829');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeInvoice, setActiveInvoice] = useState<InvoiceDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSelectPreset = (val: number) => {
    setAmount(val);
    setCustomAmount(val.toString());
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomAmount(val);
    const parsed = parseFloat(val);
    if (!isNaN(parsed) && parsed > 0) {
      setAmount(parsed);
    }
  };

  const handleCreateInvoice = async () => {
    if (amount <= 0 || isNaN(amount)) {
      setError('Please enter a valid deposit amount');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const invoice = await createInvoice({
        userId,
        amount,
        network: selectedNetwork,
        metadata: {
          platform: 'BinaryOptions_Pro',
          accountType: 'VIP_LIVE',
        },
      });
      setActiveInvoice(invoice);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to generate deposit address');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setActiveInvoice(null);
  };

  return (
    <main className="min-h-screen bg-[#070b14] text-gray-100 flex flex-col items-center justify-center p-4 md:p-8 relative selection:bg-cyan-500 selection:text-black">
      {/* Background Gradients */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-cyan-600/10 via-emerald-600/10 to-yellow-600/10 blur-[130px] pointer-events-none rounded-full" />

      {/* Header Branding */}
      <div className="w-full max-w-md text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold mb-2">
          <TrendingUp className="w-3.5 h-3.5" />
          <span>Binary Options &bull; Instant Crypto Deposit</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
          Fund Your Trading Account
        </h1>
        <p className="text-xs text-gray-400 mt-1">
          Zero slippage &bull; Instant auto-crediting &bull; Privacy-isolated HD addresses
        </p>
      </div>

      {/* Content Switcher: Form or Live Checkout Card */}
      {activeInvoice ? (
        <div className="w-full max-w-md space-y-4">
          <button
            type="button"
            onClick={handleReset}
            className="text-xs text-gray-400 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            &larr; Choose different deposit amount
          </button>
          <CheckoutCard
            initialInvoice={activeInvoice}
            onInvoiceRegenerate={async (net) => {
              setSelectedNetwork(net);
              await handleCreateInvoice();
            }}
          />
        </div>
      ) : (
        <div className="w-full max-w-md rounded-3xl crypto-card p-6 shadow-2xl border border-gray-800/80 relative">
          <div className="space-y-5">
            {/* Network Selector */}
            <NetworkSelector
              selectedNetwork={selectedNetwork}
              onSelect={setSelectedNetwork}
              disabled={isLoading}
            />

            {/* Deposit Amount Presets */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Deposit Amount (USD)
              </label>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {PRESET_AMOUNTS.map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => handleSelectPreset(val)}
                    disabled={isLoading}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                      amount === val && customAmount === val.toString()
                        ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20'
                        : 'bg-gray-900/60 text-gray-300 border border-gray-800 hover:border-gray-700'
                    }`}
                  >
                    ${val}
                  </button>
                ))}
              </div>

              {/* Custom Amount Input */}
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-bold">
                  $
                </span>
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={customAmount}
                  onChange={handleCustomChange}
                  disabled={isLoading}
                  placeholder="Custom amount"
                  className="w-full pl-8 pr-16 py-2.5 rounded-xl bg-gray-900/80 border border-gray-800 text-white font-mono text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-400">
                  USDT
                </span>
              </div>
            </div>

            {/* Trader Summary Box */}
            <div className="p-3.5 rounded-2xl bg-gray-900/40 border border-gray-800/60 space-y-2 text-xs">
              <div className="flex justify-between text-gray-400">
                <span>Account ID</span>
                <span className="font-mono text-gray-300">{userId}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Expected USDT</span>
                <span className="font-mono font-bold text-white">
                  {amount.toFixed(2)} USDT
                </span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Network Protocol</span>
                <span className="text-gray-300">
                  {selectedNetwork === CryptoNetwork.BSC ? 'BNB Chain (BEP-20)' : 'TRON (TRC-20)'}
                </span>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                {error}
              </div>
            )}

            {/* Submit Action */}
            <button
              type="button"
              onClick={handleCreateInvoice}
              disabled={isLoading || amount <= 0}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-black font-extrabold text-sm shadow-xl shadow-cyan-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Deriving Private Deposit Address...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Deposit {amount.toFixed(2)} USDT</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </button>
          </div>

          {/* Privacy badge */}
          <div className="mt-5 pt-4 border-t border-gray-800/80 flex items-center justify-center gap-1.5 text-[11px] text-gray-500">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span>End-to-End Privacy Guaranteed via HD Key Derivation</span>
          </div>
        </div>
      )}
    </main>
  );
}
