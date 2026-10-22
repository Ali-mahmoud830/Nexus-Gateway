/**
 * src/lib/api.ts
 *
 * Axios-based API client for interacting with the Crypto Payment Gateway backend.
 * Features automated URL resolution, fallback routing, and system telemetry health checks.
 */

import axios from 'axios';
import {
  ApiResponse,
  InvoiceDetails,
  CryptoNetwork,
  SystemHealthData,
  NetworkFeeInfo,
} from '../types/invoice';

/**
 * Resolves the backend API URL safely across local and production environments.
 * Prevents malformed paths or missing /api/v1 prefixes.
 */
function resolveBackendUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_URL?.trim();

  // If user set placeholder 'https://onrender.com' or missing, use verified Render URL
  if (
    !envUrl ||
    envUrl === '' ||
    envUrl === 'https://onrender.com' ||
    envUrl.startsWith('https://onrender.com')
  ) {
    return 'https://nexus-gateway-backend-2n4s.onrender.com/api/v1';
  }

  // Ensure trailing slash is removed and /api/v1 is appended if omitted
  let cleanUrl = envUrl.replace(/\/+$/, '');
  if (!cleanUrl.endsWith('/api/v1')) {
    cleanUrl = `${cleanUrl}/api/v1`;
  }
  return cleanUrl;
}

const API_BASE_URL = resolveBackendUrl();

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 12000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface CreateInvoicePayload {
  userId: string;
  amount: number;
  network: CryptoNetwork;
  metadata?: Record<string, unknown>;
}

/**
 * Fee configuration per network.
 * BSC has near-zero fees (~$0.05) and instant finality (~3s).
 * TRON has low network energy fees (~$1.00) and high global liquidity (~60s).
 */
export const NETWORK_FEES: Record<CryptoNetwork, NetworkFeeInfo> = {
  [CryptoNetwork.BSC]: {
    network: CryptoNetwork.BSC,
    feeUsdt: 0.05,
    feeFormatted: '0.05 USDT (~$0.05)',
    isSubsidized: true,
    blockTimeEstimate: '~3 Seconds',
    protocolBadge: 'BEP-20',
  },
  [CryptoNetwork.TRON]: {
    network: CryptoNetwork.TRON,
    feeUsdt: 1.0,
    feeFormatted: '1.00 USDT (~$1.00)',
    isSubsidized: true,
    blockTimeEstimate: '~60 Seconds',
    protocolBadge: 'TRC-20',
  },
};

/**
 * Creates a new crypto payment invoice on the backend.
 */
export async function createInvoice(payload: CreateInvoicePayload): Promise<InvoiceDetails> {
  const response = await apiClient.post<ApiResponse<InvoiceDetails>>('/invoices', payload);
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error?.message || 'Failed to create invoice');
  }

  const invoice = response.data.data;
  const baseAmount = parseFloat(invoice.expectedCryptoAmount);
  const feeInfo = NETWORK_FEES[invoice.network];

  // Append transparent fee breakdown
  invoice.feeBreakdown = {
    baseAmount,
    networkFee: feeInfo.feeUsdt,
    totalAmount: baseAmount, // Platform subsidizes gas fees for traders!
    isSubsidized: feeInfo.isSubsidized,
  };

  return invoice;
}

/**
 * Fetches the real-time status and confirmation progress of an existing invoice.
 */
export async function getInvoiceStatus(invoiceId: string): Promise<InvoiceDetails> {
  const response = await apiClient.get<ApiResponse<InvoiceDetails>>(`/invoices/${invoiceId}`);
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error?.message || 'Failed to fetch invoice status');
  }
  return response.data.data;
}

/**
 * Fetches live telemetry health from the deployed backend service.
 */
export async function getSystemHealth(): Promise<SystemHealthData | null> {
  try {
    const response = await apiClient.get<ApiResponse<SystemHealthData>>('/health');
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    return null;
  } catch {
    return null;
  }
}
