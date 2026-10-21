'use client';

/**
 * src/hooks/useInvoicePoller.ts
 *
 * Polling hook that queries the backend every N milliseconds for the latest
 * invoice status. Automatically halts polling upon reaching a terminal state.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getInvoiceStatus } from '../lib/api';
import { InvoiceDetails, InvoiceStatus } from '../types/invoice';

const TERMINAL_STATUSES = new Set([
  InvoiceStatus.CONFIRMED,
  InvoiceStatus.EXPIRED,
  InvoiceStatus.FAILED,
]);

export interface UseInvoicePollerOptions {
  invoiceId: string;
  initialData?: InvoiceDetails;
  pollIntervalMs?: number;
  onStatusChange?: (newStatus: InvoiceStatus, oldStatus?: InvoiceStatus) => void;
}

export interface UseInvoicePollerResult {
  invoice: InvoiceDetails | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  isTerminal: boolean;
}

export function useInvoicePoller({
  invoiceId,
  initialData,
  pollIntervalMs = 3000,
  onStatusChange,
}: UseInvoicePollerOptions): UseInvoicePollerResult {
  const [invoice, setInvoice] = useState<InvoiceDetails | null>(initialData || null);
  const [loading, setLoading] = useState<boolean>(!initialData);
  const [error, setError] = useState<string | null>(null);

  const prevStatusRef = useRef<InvoiceStatus | undefined>(initialData?.status);
  const isTerminal = invoice ? TERMINAL_STATUSES.has(invoice.status) : false;

  const fetchStatus = useCallback(async () => {
    if (!invoiceId) return;

    try {
      const data = await getInvoiceStatus(invoiceId);
      setInvoice(data);
      setError(null);

      if (prevStatusRef.current !== data.status) {
        onStatusChange?.(data.status, prevStatusRef.current);
        prevStatusRef.current = data.status;
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Failed to fetch invoice status';
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  }, [invoiceId, onStatusChange]);

  useEffect(() => {
    // Immediate initial fetch if no initialData
    if (!initialData) {
      fetchStatus();
    }

    if (isTerminal) {
      return;
    }

    const intervalId = setInterval(fetchStatus, pollIntervalMs);
    return () => clearInterval(intervalId);
  }, [fetchStatus, isTerminal, initialData, pollIntervalMs]);

  return {
    invoice,
    loading,
    error,
    refresh: fetchStatus,
    isTerminal,
  };
}
