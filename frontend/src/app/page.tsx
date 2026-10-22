'use client';

/**
 * src/app/page.tsx
 *
 * Institutional Binary Options Trading Platform - Deposit Terminal.
 * Features:
 * - Live Blockchain Telemetry Navbar
 * - Official Network SVG Selectors (BSC BEP-20 vs TRON TRC-20)
 * - Trading Bonus Tiers (+5%, +10%, +15%)
 * - Western numeral hardening (tabular-nums)
 * - Security & Privacy Accordion
 */

import React, { useState } from 'react';
import { CryptoNetwork, InvoiceDetails } from '@/types/invoice';
import { NetworkSelector } from '@/components/NetworkSelector';
import { CheckoutCard } from '@/components/CheckoutCard';
import { Navbar } from '@/components/Navbar';
import { createInvoice } from '@/lib/api';
import {
  ShieldCheck,
  TrendingUp,
  Sparkles,
  Loader2,
  ArrowRight,
  Gift,
  HelpCircle,
  ChevronDown,
  Lock,
  Clock,
  WalletCards,
} from 'lucide-react';

const PRESET_AMOUNTS = [
  { val: 25, bonus: null },
  { val: 50, bonus: null },
  { val: 100, bonus: null },
  { val: 250, bonus: '+5% Bonus' },
  { val: 500, bonus: '+10% Bonus' },
  { val: 1000, bonus: '+15% VIP' },
];

export default function DepositPortal() {
  const [selectedNetwork, setSelectedNetwork] = useState<CryptoNetwork>(CryptoNetwork.BSC);
  const [amount, setAmount] = useState<number>(100);
  const [customAmount, setCustomAmount] = useState<string>('100');
  const [userId] = useState<string>('trader_usr_8829');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeInvoice, setActiveInvoice] = useState<InvoiceDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

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

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-gray-100 flex flex-col selection:bg-cyan-500 selection:text-black">
      {/* Top Navbar */}
      <Navbar />

      <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 relative">
        {/* Background Ambient Glow */}
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

              {/* Deposit Amount Presets with Bonus Badges */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Deposit Amount (USD)
                  </label>
                  <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-medium">
                    <Gift className="w-3 h-3" />
                    <span>Bonus tiers available</span>
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-3">
                  {PRESET_AMOUNTS.map(({ val, bonus }) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => handleSelectPreset(val)}
                      disabled={isLoading}
                      className={`relative py-2.5 px-3 rounded-xl text-xs font-bold transition-all text-center ${
                        amount === val && customAmount === val.toString()
                          ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20'
                          : 'bg-gray-900/60 text-gray-300 border border-gray-800 hover:border-gray-700'
                      }`}
                    >
                      <span className="font-mono tabular-nums">${val}</span>
                      {bonus && (
                        <span className="block text-[9px] font-bold text-emerald-400 leading-none mt-0.5">
                          {bonus}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Custom Amount Input with Western Numeral Enforcing */}
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-bold">
                    $
                  </span>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    inputMode="decimal"
                    lang="en"
                    value={customAmount}
                    onChange={handleCustomChange}
                    disabled={isLoading}
                    placeholder="Custom amount"
                    className="w-full pl-8 pr-16 py-2.5 rounded-xl bg-gray-900/80 border border-gray-800 text-white font-mono tabular-nums text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400">
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
                  <span className="font-mono font-bold text-white tabular-nums">
                    {amount.toFixed(2)} USDT
                  </span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Network Protocol</span>
                  <span className="text-gray-300 font-medium">
                    {selectedNetwork === CryptoNetwork.BSC ? 'BNB Chain (BEP-20)' : 'TRON (TRC-20)'}
                  </span>
                </div>
                <div className="flex justify-between text-gray-400 pt-1 border-t border-gray-800/60">
                  <span>Network Gas Fee</span>
                  <span className="text-emerald-400 font-medium">Subsidized (0.00 Fee)</span>
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
                    <span className="tabular-nums">Deposit {amount.toFixed(2)} USDT</span>
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

        {/* Security & FAQ Accordion Section */}
        <div className="w-full max-w-md mt-6 space-y-2">
          <div className="border border-gray-800/80 rounded-2xl bg-gray-900/30 overflow-hidden text-xs">
            <button
              type="button"
              onClick={() => toggleFaq(0)}
              className="w-full p-3.5 flex items-center justify-between text-left text-gray-300 font-semibold hover:text-white transition-colors"
            >
              <span className="flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-cyan-400" />
                How does address privacy protection work?
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform ${openFaq === 0 ? 'rotate-180' : ''}`}
              />
            </button>
            {openFaq === 0 && (
              <div className="px-3.5 pb-3.5 text-[11px] text-gray-400 leading-relaxed border-t border-gray-800/40 pt-2">
                Every invoice dynamically generates an ephemeral child address derived using
                cryptographic BIP-44 HD trees. Your platform&apos;s main cold wallet is never exposed
                to payers. Once funds arrive, our decoupled sweeper asynchronously forwards them
                with random timing jitter.
              </div>
            )}
          </div>

          <div className="border border-gray-800/80 rounded-2xl bg-gray-900/30 overflow-hidden text-xs">
            <button
              type="button"
              onClick={() => toggleFaq(1)}
              className="w-full p-3.5 flex items-center justify-between text-left text-gray-300 font-semibold hover:text-white transition-colors"
            >
              <span className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-yellow-400" />
                How fast is my trading deposit credited?
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform ${openFaq === 1 ? 'rotate-180' : ''}`}
              />
            </button>
            {openFaq === 1 && (
              <div className="px-3.5 pb-3.5 text-[11px] text-gray-400 leading-relaxed border-t border-gray-800/40 pt-2">
                On BNB Smart Chain (BEP-20), payments are detected in ~3 seconds and confirmed
                after 3 block confirmations (~9s). On TRON (TRC-20), payments are verified after 20
                confirmations (~60s). Your account balance updates automatically with zero page
                refresh needed.
              </div>
            )}
          </div>

          <div className="border border-gray-800/80 rounded-2xl bg-gray-900/30 overflow-hidden text-xs">
            <button
              type="button"
              onClick={() => toggleFaq(2)}
              className="w-full p-3.5 flex items-center justify-between text-left text-gray-300 font-semibold hover:text-white transition-colors"
            >
              <span className="flex items-center gap-2">
                <WalletCards className="w-3.5 h-3.5 text-emerald-400" />
                Which wallets can I send from?
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform ${openFaq === 2 ? 'rotate-180' : ''}`}
              />
            </button>
            {openFaq === 2 && (
              <div className="px-3.5 pb-3.5 text-[11px] text-gray-400 leading-relaxed border-t border-gray-800/40 pt-2">
                You can use any crypto wallet or exchange, including Binance, Trust Wallet, MetaMask,
                OKX, Bybit, TronLink, or Phantom. Make sure to choose the matching network (BEP-20 or
                TRC-20) when sending.
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
