'use client';

/**
 * src/components/StatusBadge.tsx
 *
 * Real-time status indicator showing the exact stage of the payment:
 * - PENDING: Waiting for user deposit
 * - DETECTED: Blockchain tx picked up, awaiting confirmations
 * - CONFIRMED: Fully settled and credited
 * - EXPIRED: 15-minute window passed
 * - UNDERPAID: Insufficient amount received
 */

import React from 'react';
import { InvoiceStatus } from '../types/invoice';
import { Clock, Loader2, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

interface StatusBadgeProps {
  status: InvoiceStatus;
  confirmations?: number;
  requiredConfirmations?: number;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  confirmations = 0,
  requiredConfirmations = 3,
}) => {
  switch (status) {
    case InvoiceStatus.PENDING:
      return (
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
          </span>
          <Clock className="w-3.5 h-3.5" />
          <span>Awaiting Payment</span>
        </div>
      );

    case InvoiceStatus.DETECTED:
      return (
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-semibold">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>
            Payment Detected ({confirmations}/{requiredConfirmations} Confirmations)
          </span>
        </div>
      );

    case InvoiceStatus.CONFIRMED:
    case ('FORWARDED' as InvoiceStatus):
    case ('FORWARDING' as InvoiceStatus):
      return (
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Payment Confirmed</span>
        </div>
      );

    case InvoiceStatus.UNDERPAID:
      return (
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-400 text-xs font-semibold">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Underpaid Amount</span>
        </div>
      );

    case InvoiceStatus.EXPIRED:
      return (
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-500/10 border border-gray-500/30 text-gray-400 text-xs font-semibold">
          <Clock className="w-3.5 h-3.5" />
          <span>Invoice Expired</span>
        </div>
      );

    case InvoiceStatus.FAILED:
    default:
      return (
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold">
          <XCircle className="w-3.5 h-3.5" />
          <span>Payment Failed</span>
        </div>
      );
  }
};
