'use client';

/**
 * src/components/QrCodeCard.tsx
 *
 * Renders the deposit QR code, one-click copy buttons for amount and address,
 * and direct links to BscScan / TronScan.
 */

import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { CryptoNetwork } from '../types/invoice';
import { Copy, Check, ExternalLink, ShieldAlert } from 'lucide-react';

interface QrCodeCardProps {
  depositAddress: string;
  expectedAmount: string;
  cryptoCurrency: string;
  network: CryptoNetwork;
}

export const QrCodeCard: React.FC<QrCodeCardProps> = ({
  depositAddress,
  expectedAmount,
  cryptoCurrency,
  network,
}) => {
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [copiedAmount, setCopiedAmount] = useState(false);

  const copyToClipboard = async (text: string, type: 'address' | 'amount') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'address') {
        setCopiedAddress(true);
        setTimeout(() => setCopiedAddress(false), 2000);
      } else {
        setCopiedAmount(true);
        setTimeout(() => setCopiedAmount(false), 2000);
      }
    } catch {
      // Fallback
    }
  };

  const explorerUrl =
    network === CryptoNetwork.BSC
      ? `https://bscscan.com/address/${depositAddress}`
      : `https://tronscan.org/#/address/${depositAddress}`;

  // Direct URI scheme for wallets (e.g., ethereum:0x... or tron:T...)
  const qrValue =
    network === CryptoNetwork.BSC
      ? `ethereum:${depositAddress}?amount=${expectedAmount}`
      : depositAddress;

  return (
    <div className="flex flex-col items-center w-full space-y-4">
      {/* QR Code Container with High Contrast Framing */}
      <div className="p-3.5 bg-white rounded-2xl shadow-xl shadow-black/40 border border-gray-200">
        <QRCodeSVG
          value={qrValue}
          size={190}
          level="H"
          includeMargin={false}
          imageSettings={{
            src: '/favicon.ico',
            x: undefined,
            y: undefined,
            height: 24,
            width: 24,
            excavate: true,
          }}
        />
      </div>

      {/* Amount Copy Box */}
      <div className="w-full bg-gray-900/80 rounded-xl p-3 border border-gray-800">
        <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
          <span>Amount to Pay</span>
          <span className="text-yellow-400/90 font-medium">Send exact amount</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold font-mono text-white tracking-tight">
              {expectedAmount}
            </span>
            <span className="text-xs font-semibold text-gray-400">
              {cryptoCurrency} ({network === CryptoNetwork.BSC ? 'BEP-20' : 'TRC-20'})
            </span>
          </div>
          <button
            type="button"
            onClick={() => copyToClipboard(expectedAmount, 'amount')}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 transition-colors"
          >
            {copiedAmount ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Address Copy Box */}
      <div className="w-full bg-gray-900/80 rounded-xl p-3 border border-gray-800">
        <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
          <span>Deposit Address</span>
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            <span>View on Explorer</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-mono text-gray-300 break-all select-all">
            {depositAddress}
          </span>
          <button
            type="button"
            onClick={() => copyToClipboard(depositAddress, 'address')}
            className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 transition-colors"
          >
            {copiedAddress ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Warning Notice */}
      <div className="w-full flex items-start gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300/90 text-xs">
        <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-400" />
        <p className="leading-tight">
          Only send <strong className="text-white">USDT</strong> via the{' '}
          <strong className="text-white">
            {network === CryptoNetwork.BSC ? 'BNB Smart Chain (BEP-20)' : 'TRON (TRC-20)'}
          </strong>{' '}
          network to this unique address. Sending any other token or network may result in permanent
          loss.
        </p>
      </div>
    </div>
  );
};
