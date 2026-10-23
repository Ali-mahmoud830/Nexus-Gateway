'use client';

/**
 * src/components/CheckoutCard.tsx
 *
 * Core checkout container assembling:
 * 1. 15-minute countdown clock
 * 2. Transparent Dynamic Fee Breakdown (Base + Gas + Subsidized total)
 * 3. One-Click Web3 Wallet Checkout (MetaMask / Trust Wallet / TronLink)
 * 4. QR Code & Ephemeral Deposit Address
 * 5. Real-time polling updates & Success confetti
 */

import React, { useState } from 'react';
import { InvoiceDetails, InvoiceStatus, CryptoNetwork } from '../types/invoice';
import { useInvoicePoller } from '../hooks/useInvoicePoller';
import { useWeb3Payment } from '../hooks/useWeb3Payment';
import { NETWORK_FEES } from '../lib/api';
import { StatusBadge } from './StatusBadge';
import { CountdownTimer } from './CountdownTimer';
import { QrCodeCard } from './QrCodeCard';
import { SuccessView } from './SuccessView';
import {
  RefreshCw,
  Shield,
  AlertCircle,
  Wallet,
  Loader2,
  CheckCircle2,
  HelpCircle,
  Receipt,
} from 'lucide-react';

interface CheckoutCardProps {
  initialInvoice: InvoiceDetails;
  onInvoiceRegenerate?: (network: CryptoNetwork) => Promise<void>;
}

export const CheckoutCard: React.FC<CheckoutCardProps> = ({
  initialInvoice,
  onInvoiceRegenerate,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showFeeDetails, setShowFeeDetails] = useState(false);

  const { invoice, refresh, error } = useInvoicePoller({
    invoiceId: initialInvoice.invoiceId,
    initialData: initialInvoice,
    pollIntervalMs: 3000,
  });

  const activeInvoice = invoice || initialInvoice;
  const isConfirmed =
    activeInvoice.status === InvoiceStatus.CONFIRMED ||
    activeInvoice.status === ('FORWARDED' as InvoiceStatus) ||
    activeInvoice.status === ('FORWARDING' as InvoiceStatus) ||
    parseFloat(activeInvoice.paidCryptoAmount || '0') > 0 ||
    !!activeInvoice.txHash;
  const isExpired = activeInvoice.status === InvoiceStatus.EXPIRED && !isConfirmed;

  // Web3 One-Click Payment hook
  const {
    isWalletAvailable,
    walletName,
    isProcessing: isWeb3Processing,
    error: web3Error,
    txHash: web3TxHash,
    payWithWallet,
  } = useWeb3Payment({
    network: activeInvoice.network,
    depositAddress: activeInvoice.depositAddress,
    expectedAmount: activeInvoice.expectedCryptoAmount,
    onSuccess: async () => {
      // Force an immediate refresh when wallet returns a broadcasted hash
      await refresh();
    },
  });

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    setTimeout(() => setIsRefreshing(false), 600);
  };

  const feeInfo = NETWORK_FEES[activeInvoice.network];
  const feeAmount = activeInvoice.feeAmount ?? feeInfo.feeUsdt;
  const totalAmount = parseFloat(activeInvoice.expectedCryptoAmount);
  const baseAmount = activeInvoice.baseAmount ?? Math.max(0, totalAmount - feeAmount);
  const requiredConfirmations = activeInvoice.network === CryptoNetwork.BSC ? 3 : 20;

  return (
    <div className="w-full max-w-md mx-auto rounded-3xl crypto-card p-6 shadow-2xl relative overflow-hidden transition-all duration-300">
      {/* Network Ambient Glow */}
      <div
        className={`absolute -top-24 -right-24 w-48 h-48 rounded-full blur-3xl opacity-20 pointer-events-none ${
          activeInvoice.network === CryptoNetwork.BSC ? 'bg-yellow-400' : 'bg-red-500'
        }`}
      />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-800/80 pb-4 mb-4">
        <div>
          <span className="text-[11px] font-mono text-gray-400 uppercase tracking-wider">
            Invoice #{activeInvoice.invoiceId.slice(-8)}
          </span>
          <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            Complete Deposit
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge
            status={activeInvoice.status}
            confirmations={activeInvoice.confirmations || 0}
            requiredConfirmations={requiredConfirmations}
          />
          <button
            type="button"
            onClick={handleManualRefresh}
            title="Refresh status"
            disabled={isRefreshing}
            className="p-1.5 rounded-lg bg-gray-800/80 hover:bg-gray-700 text-gray-400 hover:text-white transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error alerts */}
      {error && (
        <div className="mb-4 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>Sync issue: {error}. Retrying...</span>
        </div>
      )}

      {web3Error && (
        <div className="mb-4 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>Wallet notice: {web3Error}</span>
        </div>
      )}

      {web3TxHash && (
        <div className="mb-4 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span className="truncate">Tx broadcasted! Awaiting confirmations...</span>
        </div>
      )}

      {/* Main Content */}
      {isConfirmed ? (
        <SuccessView
          amount={activeInvoice.expectedCryptoAmount}
          cryptoCurrency={activeInvoice.cryptoCurrency}
          network={activeInvoice.network}
          txHash={activeInvoice.txHash || web3TxHash || undefined}
          depositAddress={activeInvoice.depositAddress}
        />
      ) : isExpired ? (
        <div className="flex flex-col items-center text-center space-y-4 py-8">
          <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-rose-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Payment Session Expired</h3>
            <p className="text-xs text-gray-400 mt-1 max-w-xs">
              The 15-minute deposit window has ended. To safeguard your funds, please generate a new
              deposit address.
            </p>
          </div>
          {onInvoiceRegenerate && (
            <button
              type="button"
              onClick={() => onInvoiceRegenerate(activeInvoice.network)}
              className="mt-2 px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-600 text-black font-bold text-xs transition-colors cursor-pointer"
            >
              Generate New Invoice
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Countdown timer */}
          <CountdownTimer expiresAt={activeInvoice.expiresAt} />

          {/* Web3 One-Click Wallet Button */}
          <div className="w-full">
            <button
              type="button"
              onClick={payWithWallet}
              disabled={isWeb3Processing}
              className={`w-full py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeInvoice.network === CryptoNetwork.BSC
                  ? 'bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-black shadow-lg shadow-yellow-500/20'
                  : 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white shadow-lg shadow-red-500/20'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isWeb3Processing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Confirming in {walletName}...</span>
                </>
              ) : (
                <>
                  <Wallet className="w-4 h-4" />
                  <span>
                    Pay {activeInvoice.expectedCryptoAmount} USDT via {walletName}
                  </span>
                </>
              )}
            </button>
            <p className="text-[10px] text-center text-gray-500 mt-1.5">
              Instant 1-Click transfer &bull; Or scan QR code below manually
            </p>
          </div>

          {/* Transparent Dynamic Fee Breakdown Box */}
          <div className="w-full bg-gray-900/60 rounded-xl p-3 border border-gray-800 text-xs">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowFeeDetails(!showFeeDetails)}
                className="flex items-center gap-1.5 text-gray-300 font-medium hover:text-white transition-colors cursor-pointer"
              >
                <Receipt className="w-3.5 h-3.5 text-cyan-400" />
                <span>Payment Summary & Fees</span>
                <HelpCircle className="w-3 h-3 text-gray-500" />
              </button>
              <span className="font-mono font-bold text-white">
                {activeInvoice.expectedCryptoAmount} USDT
              </span>
            </div>

            {showFeeDetails && (
              <div className="mt-2.5 pt-2 border-t border-gray-800/80 space-y-1.5 text-[11px] text-gray-400 animate-in fade-in duration-200">
                <div className="flex justify-between">
                  <span>Invoice Amount</span>
                  <span className="font-mono text-gray-200">${baseAmount.toFixed(2)} USDT</span>
                </div>
                <div className="flex justify-between">
                  <span>{feeInfo.protocolBadge} Network Fee</span>
                  <span className="font-mono text-amber-400">+${feeAmount.toFixed(2)} USDT</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-gray-800 font-semibold text-gray-200">
                  <span>Total Due</span>
                  <span className="font-mono text-cyan-300">
                    {activeInvoice.expectedCryptoAmount} USDT
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* QR Code and Deposit Details */}
          <QrCodeCard
            depositAddress={activeInvoice.depositAddress}
            expectedAmount={activeInvoice.expectedCryptoAmount}
            cryptoCurrency={activeInvoice.cryptoCurrency}
            network={activeInvoice.network}
          />
        </div>
      )}

      {/* Security Seal Footer */}
      <div className="mt-5 pt-4 border-t border-gray-800/80 flex items-center justify-center gap-2 text-[11px] text-gray-500">
        <Shield className="w-3.5 h-3.5 text-emerald-500/80" />
        <span>Secured by Non-Custodial Smart Contract Rails</span>
      </div>
    </div>
  );
};
