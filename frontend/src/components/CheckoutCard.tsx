'use client';

/**
 * src/components/CheckoutCard.tsx
 *
 * Core checkout container assembling the network selector, QR code,
 * 15-minute countdown clock, real-time polling updates, and success state.
 */

import React, { useState } from 'react';
import { InvoiceDetails, InvoiceStatus, CryptoNetwork } from '../types/invoice';
import { useInvoicePoller } from '../hooks/useInvoicePoller';
import { StatusBadge } from './StatusBadge';
import { CountdownTimer } from './CountdownTimer';
import { QrCodeCard } from './QrCodeCard';
import { SuccessView } from './SuccessView';
import { RefreshCw, Shield, AlertCircle } from 'lucide-react';

interface CheckoutCardProps {
  initialInvoice: InvoiceDetails;
  onInvoiceRegenerate?: (network: CryptoNetwork) => Promise<void>;
}

export const CheckoutCard: React.FC<CheckoutCardProps> = ({
  initialInvoice,
  onInvoiceRegenerate,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { invoice, refresh, error } = useInvoicePoller({
    invoiceId: initialInvoice.invoiceId,
    initialData: initialInvoice,
    pollIntervalMs: 3000,
  });

  const activeInvoice = invoice || initialInvoice;
  const isConfirmed = activeInvoice.status === InvoiceStatus.CONFIRMED;
  const isExpired = activeInvoice.status === InvoiceStatus.EXPIRED;

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    setTimeout(() => setIsRefreshing(false), 600);
  };

  const requiredConfirmations = activeInvoice.network === CryptoNetwork.BSC ? 3 : 20;

  return (
    <div className="w-full max-w-md mx-auto rounded-3xl crypto-card p-6 shadow-2xl relative overflow-hidden transition-all duration-300">
      {/* Network Accent Glow */}
      <div
        className={`absolute -top-24 -right-24 w-48 h-48 rounded-full blur-3xl opacity-20 pointer-events-none ${
          activeInvoice.network === CryptoNetwork.BSC ? 'bg-yellow-400' : 'bg-red-500'
        }`}
      />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-800/80 pb-4 mb-5">
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

      {/* Error alert if poller failed */}
      {error && (
        <div className="mb-4 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>Sync error: {error}. Reconnecting...</span>
        </div>
      )}

      {/* Main Content Body */}
      {isConfirmed ? (
        <SuccessView
          amount={activeInvoice.expectedCryptoAmount}
          cryptoCurrency={activeInvoice.cryptoCurrency}
          network={activeInvoice.network}
          txHash={activeInvoice.txHash}
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

          {/* QR Code and Deposit Details */}
          <QrCodeCard
            depositAddress={activeInvoice.depositAddress}
            expectedAmount={activeInvoice.expectedCryptoAmount}
            cryptoCurrency={activeInvoice.cryptoCurrency}
            network={activeInvoice.network}
          />
        </div>
      )}

      {/* Privacy Guarantee Footer */}
      <div className="mt-5 pt-4 border-t border-gray-800/80 flex items-center justify-center gap-2 text-[11px] text-gray-500">
        <Shield className="w-3.5 h-3.5 text-emerald-500/80" />
        <span>Decoupled HD Ephemeral Address &bull; Auto-Swept to Cold Storage</span>
      </div>
    </div>
  );
};
