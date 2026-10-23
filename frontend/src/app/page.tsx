'use client';

/**
 * src/app/page.tsx
 *
 * Institutional Crypto Payment Gateway - Secure Checkout Terminal.
 * Clean, neutral, world-class FinTech design (Stripe / Coinbase Commerce tier).
 * 100% localized across 8 world languages with dynamic admin-controlled presets and digital wallets.
 */

import React, { useState, useEffect } from 'react';
import { CryptoNetwork, InvoiceDetails } from '@/types/invoice';
import { NetworkSelector } from '@/components/NetworkSelector';
import { CheckoutCard } from '@/components/CheckoutCard';
import { Navbar } from '@/components/Navbar';
import { createInvoice, getPublicConfig, PublicCustomWallet } from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';
import {
  ShieldCheck,
  Loader2,
  ArrowRight,
  Lock,
  Clock,
  Wallet,
  Smartphone,
  Copy,
  Check,
} from 'lucide-react';

export default function CheckoutPortal() {
  const { t, isRtl } = useLanguage();

  const [selectedNetwork, setSelectedNetwork] = useState<CryptoNetwork>(CryptoNetwork.BSC);
  const [presetAmounts, setPresetAmounts] = useState<number[]>([25, 50, 100, 250, 500, 1000]);
  const [amount, setAmount] = useState<number>(100);
  const [customAmount, setCustomAmount] = useState<string>('100');
  const [customWallets, setCustomWallets] = useState<PublicCustomWallet[]>([]);
  const [activeTab, setActiveTab] = useState<'crypto' | 'digital'>('crypto');

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeInvoice, setActiveInvoice] = useState<InvoiceDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [copiedWalletId, setCopiedWalletId] = useState<string | null>(null);

  // Fetch dynamic public configuration from backend on mount
  useEffect(() => {
    let isMounted = true;
    async function loadConfig() {
      try {
        const config = await getPublicConfig();
        if (isMounted) {
          if (config.presetAmounts && config.presetAmounts.length > 0) {
            setPresetAmounts(config.presetAmounts);
          }
          if (config.defaultDepositAmount) {
            setAmount(config.defaultDepositAmount);
            setCustomAmount(config.defaultDepositAmount.toString());
          }
          if (config.customWallets) {
            setCustomWallets(config.customWallets);
          }
        }
      } catch (err) {
        // Fallback gracefully to default presets if server is spinning up
        console.warn('Using standard presets while backend wakes up:', err);
      }
    }
    loadConfig();
    return () => {
      isMounted = false;
    };
  }, []);

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

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedWalletId(id);
    setTimeout(() => setCopiedWalletId(null), 2000);
  };

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="min-h-screen bg-[#040810] text-gray-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-black"
    >
      {/* Institutional Navbar */}
      <Navbar />

      {/* Main Checkout Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 md:py-12 flex flex-col items-center">
        {/* Top Header Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-semibold mb-6">
          <ShieldCheck className="w-4 h-4 text-cyan-400 flex-shrink-0" />
          <span>{t.terminalBadge}</span>
        </div>

        <h1 className="text-3xl md:text-4xl font-black text-white text-center tracking-tight mb-2">
          {t.checkoutTitle}
        </h1>
        <p className="text-gray-400 text-sm text-center max-w-md mb-6">
          {t.checkoutSubtitle}
        </p>

        {/* Payment Method Switcher (Crypto USDT vs Digital Wallets like JazzCash) */}
        {customWallets.length > 0 && !activeInvoice && (
          <div className="flex items-center gap-2 p-1 bg-gray-900/80 border border-gray-800 rounded-2xl mb-6">
            <button
              type="button"
              onClick={() => setActiveTab('crypto')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'crypto'
                  ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/20'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Wallet className="w-3.5 h-3.5" />
              <span>{t.cryptoTab}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('digital')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'digital'
                  ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/20'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>{t.digitalWalletsTab}</span>
            </button>
          </div>
        )}

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
              className="mt-6 text-xs text-gray-400 hover:text-gray-200 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <span>&larr;</span>
              <span>{t.startNewPayment}</span>
            </button>
          </div>
        ) : activeTab === 'digital' && customWallets.length > 0 ? (
          /* Custom Digital Wallets List (JazzCash / EasyPaisa / Bank Transfer) */
          <div className="w-full max-w-md space-y-4">
            {customWallets.map((wallet) => (
              <div
                key={wallet.id}
                className="bg-gray-950/80 border border-gray-800/80 rounded-3xl p-6 shadow-2xl backdrop-blur-xl relative overflow-hidden"
              >
                <div className="flex items-center justify-between pb-4 border-b border-gray-900 mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-cyan-500/20 flex items-center justify-center text-cyan-400">
                      <Smartphone className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm">{wallet.name}</h3>
                      <p className="text-[11px] text-cyan-400 font-medium">{t.digitalWalletsTab}</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                    ACTIVE
                  </span>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] font-semibold text-gray-400 block mb-1">
                      {t.accountTitle}
                    </label>
                    <div className="text-sm font-bold text-white bg-gray-900/60 px-3 py-2 rounded-xl border border-gray-800">
                      {wallet.accountTitle}
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-gray-400 block mb-1">
                      {t.accountNumber}
                    </label>
                    <div className="flex items-center justify-between bg-gray-900/60 px-3 py-2 rounded-xl border border-gray-800">
                      <span dir="ltr" className="font-mono text-sm font-bold text-cyan-300">
                        {wallet.accountNumber}
                      </span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(wallet.accountNumber, wallet.id)}
                        className="p-1 hover:bg-gray-800 rounded text-gray-400 hover:text-white transition-colors cursor-pointer"
                        title={t.copy}
                      >
                        {copiedWalletId === wallet.id ? (
                          <Check className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {wallet.instructions && (
                    <div>
                      <label className="text-[11px] font-semibold text-gray-400 block mb-1">
                        {t.instructions}
                      </label>
                      <p className="text-xs text-gray-300 bg-gray-900/40 p-3 rounded-xl border border-gray-800/60 leading-relaxed">
                        {wallet.instructions}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Standard Crypto Checkout Card */
          <div className="w-full max-w-md bg-gray-950/80 border border-gray-800/80 rounded-3xl p-6 shadow-2xl backdrop-blur-xl relative overflow-hidden">
            <div className="space-y-6">
              {/* Network Selection */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                  {t.selectNetworkLabel}
                </label>
                <NetworkSelector
                  selectedNetwork={selectedNetwork}
                  onSelect={setSelectedNetwork}
                />
              </div>

              {/* Amount Selection */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                  {t.paymentAmountLabel}
                </label>

                {/* Dynamic Admin-Configurable Preset Chips */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {presetAmounts.map((val) => (
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
                      <span dir="ltr">${val}</span>
                    </button>
                  ))}
                </div>

                {/* Custom Amount Field - Strict LTR isolation to prevent numeral flip */}
                <div className="relative" dir="ltr">
                  <span className="absolute left-4 top-3 text-gray-400 font-mono text-sm font-bold">
                    $
                  </span>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={customAmount}
                    onChange={handleCustomChange}
                    placeholder={t.enterCustomAmount}
                    className="w-full bg-gray-900/80 border border-gray-800 rounded-xl pl-8 pr-16 py-2.5 text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                  <span className="absolute right-4 top-3 text-xs font-bold text-gray-400 font-mono">
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
                    <span>{t.generatingInvoice}</span>
                  </>
                ) : (
                  <>
                    <span>{t.proceedToPayment}</span>
                    <ArrowRight className={`w-4 h-4 ${isRtl ? 'rotate-180' : ''}`} />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Global Standard FAQ Section - 100% Translated */}
        <div className="w-full max-w-md mt-10 space-y-3">
          <div className="border border-gray-800/80 rounded-2xl bg-gray-950/40 overflow-hidden">
            <button
              onClick={() => toggleFaq(0)}
              className="w-full p-4 text-left flex items-center justify-between text-xs font-semibold text-gray-300 hover:text-white transition-colors"
            >
              <div className="flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                <span>{t.faq1Question}</span>
              </div>
              <span className={`text-gray-500 transition-transform ${openFaq === 0 ? 'rotate-180 text-cyan-400' : ''}`}>
                ▼
              </span>
            </button>
            {openFaq === 0 && (
              <div className="px-4 pb-4 text-[11px] text-gray-400 leading-relaxed border-t border-gray-900 pt-3">
                {t.faq1Answer}
              </div>
            )}
          </div>

          <div className="border border-gray-800/80 rounded-2xl bg-gray-950/40 overflow-hidden">
            <button
              onClick={() => toggleFaq(1)}
              className="w-full p-4 text-left flex items-center justify-between text-xs font-semibold text-gray-300 hover:text-white transition-colors"
            >
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                <span>{t.faq2Question}</span>
              </div>
              <span className={`text-gray-500 transition-transform ${openFaq === 1 ? 'rotate-180 text-cyan-400' : ''}`}>
                ▼
              </span>
            </button>
            {openFaq === 1 && (
              <div className="px-4 pb-4 text-[11px] text-gray-400 leading-relaxed border-t border-gray-900 pt-3">
                {t.faq2Answer}
              </div>
            )}
          </div>

          <div className="border border-gray-800/80 rounded-2xl bg-gray-950/40 overflow-hidden">
            <button
              onClick={() => toggleFaq(2)}
              className="w-full p-4 text-left flex items-center justify-between text-xs font-semibold text-gray-300 hover:text-white transition-colors"
            >
              <div className="flex items-center gap-2">
                <Wallet className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                <span>{t.faq3Question}</span>
              </div>
              <span className={`text-gray-500 transition-transform ${openFaq === 2 ? 'rotate-180 text-cyan-400' : ''}`}>
                ▼
              </span>
            </button>
            {openFaq === 2 && (
              <div className="px-4 pb-4 text-[11px] text-gray-400 leading-relaxed border-t border-gray-900 pt-3">
                {t.faq3Answer}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Institutional Footer */}
      <footer className="w-full border-t border-gray-900 py-6 text-center text-xs text-gray-400 font-mono">
        {t.protocolFooter}
      </footer>
    </div>
  );
}
