'use client';

/**
 * src/app/page.tsx
 *
 * Institutional Crypto Payment Gateway - Secure Checkout Terminal.
 * Clean, neutral, world-class FinTech design (Stripe / Coinbase Commerce tier).
 * Completely decoupled from merchant trading platform details.
 */

import React, { useState } from 'react';
import { CryptoNetwork, InvoiceDetails } from '@/types/invoice';
import { NetworkSelector } from '@/components/NetworkSelector';
import { CheckoutCard } from '@/components/CheckoutCard';
import { Navbar } from '@/components/Navbar';
import { createInvoice } from '@/lib/api';
import {
  ShieldCheck,
  Loader2,
  ArrowRight,
  HelpCircle,
  ChevronDown,
  Lock,
  Clock,
  Wallet,
  Zap,
} from 'lucide-react';

const PRESET_AMOUNTS = [25, 50, 100, 250, 500, 1000];

export default function CheckoutPortal() {
  const [selectedNetwork, setSelectedNetwork] = useState<CryptoNetwork>(CryptoNetwork.BSC);
  const [amount, setAmount] = useState<number>(100);
  const [customAmount, setCustomAmount] = useState<string>('100');
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
      setError('Please enter a valid amount');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const invoice = await createInvoice({
        userId: `client_${Math.random().toString(36).substring(2, 9)}`,
        amount,
        network: selectedNetwork,
        metadata: {
          orderReference: `ref_${Date.now()}`,
        },
      });
      setActiveInvoice(invoice);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to generate checkout invoice');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleFaq = (idx: number) => {
    setOpenFaq(openFaq === idx ? null : idx);
  };

  return (
    <div className="min-h-screen bg-[#040810] text-gray-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-black">
      {/* Institutional Navbar */}
      <Navbar />

      {/* Main Checkout Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 md:py-12 flex flex-col items-center">
        {/* Top Header Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-semibold mb-6">
          <ShieldCheck className="w-4 h-4 text-cyan-400" />
          <span>Non-Custodial Decentralized Payment Terminal</span>
        </div>

        <h1 className="text-3xl md:text-4xl font-black text-white text-center tracking-tight mb-2">
          Secure Crypto Checkout
        </h1>
        <p className="text-gray-400 text-sm text-center max-w-md mb-8">
          Select your preferred blockchain network and proceed with instant automated settlement.
        </p>

        {error && (
          <div className="w-full max-w-md mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-rose-500 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* View Switcher: Active Invoice vs Payment Setup */}
        {activeInvoice ? (
          <div className="w-full flex flex-col items-center animate-in fade-in duration-300">
            <CheckoutCard
              initialInvoice={activeInvoice}
              onInvoiceRegenerate={async (net) => {
                setSelectedNetwork(net);
                setActiveInvoice(null);
              }}
            />
            <button
              onClick={() => setActiveInvoice(null)}
              className="mt-6 text-xs text-gray-500 hover:text-gray-300 transition-colors cursor-pointer"
            >
              &larr; Start New Payment
            </button>
          </div>
        ) : (
          <div className="w-full max-w-md bg-gray-950/80 border border-gray-800/80 rounded-3xl p-6 shadow-2xl backdrop-blur-xl relative overflow-hidden">
            <div className="space-y-6">
              {/* Network Selection */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                  1. Select Payment Network
                </label>
                <NetworkSelector
                  selectedNetwork={selectedNetwork}
                  onSelect={setSelectedNetwork}
                />
              </div>

              {/* Amount Selection */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                  2. Payment Amount (USD)
                </label>

                {/* Preset Chips */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {PRESET_AMOUNTS.map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => handleSelectPreset(val)}
                      className={`py-2 px-3 rounded-xl border text-xs font-mono font-bold transition-all cursor-pointer ${
                        amount === val
                          ? 'bg-cyan-500 text-black border-cyan-400 shadow-md shadow-cyan-500/20'
                          : 'bg-gray-900/60 border-gray-800 text-gray-300 hover:border-gray-700 hover:bg-gray-900'
                      }`}
                    >
                      ${val}
                    </button>
                  ))}
                </div>

                {/* Custom Amount Field */}
                <div className="relative">
                  <span className="absolute left-4 top-3 text-gray-400 font-mono text-sm font-bold">
                    $
                  </span>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={customAmount}
                    onChange={handleCustomChange}
                    placeholder="Enter custom amount"
                    className="w-full bg-gray-900/80 border border-gray-800 rounded-xl pl-8 pr-16 py-2.5 text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                  <span className="absolute right-4 top-3 text-xs font-bold text-gray-500">
                    USDT
                  </span>
                </div>
              </div>

              {/* Submit / Proceed */}
              <button
                type="button"
                onClick={handleCreateInvoice}
                disabled={isLoading}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-extrabold text-sm transition-all shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Generating Secure Invoice...</span>
                  </>
                ) : (
                  <>
                    <span>Proceed to Payment</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Global Standard FAQ Section */}
        <div className="w-full max-w-md mt-10 space-y-3">
          <div className="border border-gray-800/80 rounded-2xl bg-gray-950/40 overflow-hidden">
            <button
              onClick={() => toggleFaq(0)}
              className="w-full p-4 text-left flex items-center justify-between text-xs font-semibold text-gray-300 hover:text-white transition-colors"
            >
              <div className="flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-cyan-400" />
                <span>How does non-custodial payment protection work?</span>
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 text-gray-500 transition-transform ${
                  openFaq === 0 ? 'rotate-180 text-cyan-400' : ''
                }`}
              />
            </button>
            {openFaq === 0 && (
              <div className="px-4 pb-4 text-[11px] text-gray-400 leading-relaxed border-t border-gray-900 pt-3">
                Each payment invoice automatically generates an isolated, one-time cryptographic
                deposit address on the blockchain. Your payment is verified directly on-chain
                without intermediary holding, ensuring maximum security and zero-custody risk.
              </div>
            )}
          </div>

          <div className="border border-gray-800/80 rounded-2xl bg-gray-950/40 overflow-hidden">
            <button
              onClick={() => toggleFaq(1)}
              className="w-full p-4 text-left flex items-center justify-between text-xs font-semibold text-gray-300 hover:text-white transition-colors"
            >
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                <span>How fast is the payment confirmed?</span>
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 text-gray-500 transition-transform ${
                  openFaq === 1 ? 'rotate-180 text-cyan-400' : ''
                }`}
              />
            </button>
            {openFaq === 1 && (
              <div className="px-4 pb-4 text-[11px] text-gray-400 leading-relaxed border-t border-gray-900 pt-3">
                Transactions on BNB Smart Chain (BEP-20) are typically validated within 3 to 15
                seconds (3 block confirmations). Transactions on TRON (TRC-20) settle in
                approximately 60 seconds (20 block confirmations).
              </div>
            )}
          </div>

          <div className="border border-gray-800/80 rounded-2xl bg-gray-950/40 overflow-hidden">
            <button
              onClick={() => toggleFaq(2)}
              className="w-full p-4 text-left flex items-center justify-between text-xs font-semibold text-gray-300 hover:text-white transition-colors"
            >
              <div className="flex items-center gap-2">
                <Wallet className="w-3.5 h-3.5 text-cyan-400" />
                <span>Which wallets and exchanges can I pay from?</span>
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 text-gray-500 transition-transform ${
                  openFaq === 2 ? 'rotate-180 text-cyan-400' : ''
                }`}
              />
            </button>
            {openFaq === 2 && (
              <div className="px-4 pb-4 text-[11px] text-gray-400 leading-relaxed border-t border-gray-900 pt-3">
                You can transfer from any Web3 wallet (MetaMask, Trust Wallet, TronLink, Ledger) or
                directly from any crypto exchange (Binance, OKX, Bybit, KuCoin) by scanning the QR
                code or copying the deposit address.
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Institutional Footer */}
      <footer className="w-full border-t border-gray-900 py-6 text-center text-xs text-gray-400 font-mono">
        Nexus Gateway Protocol &bull; Institutional Non-Custodial Clearing Rails
      </footer>
    </div>
  );
}
