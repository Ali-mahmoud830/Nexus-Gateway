/**
 * src/lib/api.ts
 *
 * Axios-based API client for interacting with the Crypto Payment Gateway backend.
 * Features automated URL resolution, customer-paid gas fees, and full Admin Command Center API suite.
 */

import axios from 'axios';
import {
  ApiResponse,
  InvoiceDetails,
  CryptoNetwork,
  SystemHealthData,
  NetworkFeeInfo,
  AdminOverviewData,
  AdminApiKey,
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
 * Fees are covered transparently by the customer and automatically fund network gas.
 */
export const NETWORK_FEES: Record<CryptoNetwork, NetworkFeeInfo> = {
  [CryptoNetwork.BSC]: {
    network: CryptoNetwork.BSC,
    feeUsdt: 0.30,
    feeFormatted: '0.30 USDT (~$0.30)',
    isSubsidized: false,
    blockTimeEstimate: '~3 Seconds',
    protocolBadge: 'BEP-20',
  },
  [CryptoNetwork.TRON]: {
    network: CryptoNetwork.TRON,
    feeUsdt: 2.50,
    feeFormatted: '2.50 USDT (~$2.50)',
    isSubsidized: false,
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
  const feeInfo = NETWORK_FEES[invoice.network];
  const feeAmount = invoice.feeAmount ?? feeInfo.feeUsdt;
  const baseAmount = invoice.baseAmount ?? payload.amount;

  invoice.feeBreakdown = {
    baseAmount,
    networkFee: feeAmount,
    totalAmount: parseFloat(invoice.expectedCryptoAmount),
    isSubsidized: false,
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

// ===========================================================================
// ADMIN COMMAND CENTER API CLIENT
// ===========================================================================

function getAdminHeaders(token: string) {
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
}

/**
 * Authenticates admin via master passkey.
 */
export async function adminLogin(passkey: string): Promise<{ token: string; expiresIn: string }> {
  const response = await apiClient.post<ApiResponse<{ token: string; expiresIn: string }>>(
    '/admin/login',
    { passkey },
  );
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error?.message || 'Authentication failed');
  }
  return response.data.data;
}

/**
 * Fetches real-time admin telemetry overview, volume, and Gas Station balances.
 */
export async function getAdminOverview(token: string): Promise<AdminOverviewData> {
  const response = await apiClient.get<ApiResponse<AdminOverviewData>>(
    '/admin/overview',
    getAdminHeaders(token),
  );
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error?.message || 'Failed to fetch admin overview');
  }
  return response.data.data;
}

/**
 * Fetches paginated invoices with filter options.
 */
export async function getAdminInvoices(
  token: string,
  params?: { page?: number; limit?: number; network?: string; status?: string; search?: string },
): Promise<{ invoices: any[]; pagination: { total: number; page: number; limit: number; totalPages: number } }> {
  const response = await apiClient.get<
    ApiResponse<{ invoices: any[]; pagination: { total: number; page: number; limit: number; totalPages: number } }>
  >('/admin/invoices', {
    ...getAdminHeaders(token),
    params,
  });
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error?.message || 'Failed to fetch admin invoices');
  }
  return response.data.data;
}

/**
 * Forces manual reconciliation / verification of an invoice.
 */
export async function reconcileInvoiceManually(
  token: string,
  invoiceId: string,
  data?: { txHash?: string; status?: string },
): Promise<any> {
  const response = await apiClient.post<ApiResponse<any>>(
    `/admin/invoices/${invoiceId}/reconcile`,
    data || {},
    getAdminHeaders(token),
  );
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error?.message || 'Failed to reconcile invoice');
  }
  return response.data.data;
}

/**
 * Triggers manual immediate sweep for an invoice.
 */
export async function triggerManualSweep(token: string, invoiceId: string): Promise<any> {
  const response = await apiClient.post<ApiResponse<any>>(
    `/admin/invoices/${invoiceId}/sweep`,
    {},
    getAdminHeaders(token),
  );
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error?.message || 'Failed to trigger sweep');
  }
  return response.data.data;
}

/**
 * Fetches active developer API keys.
 */
export async function getAdminApiKeys(token: string): Promise<AdminApiKey[]> {
  const response = await apiClient.get<ApiResponse<{ keys: AdminApiKey[] }>>(
    '/admin/keys',
    getAdminHeaders(token),
  );
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error?.message || 'Failed to fetch API keys');
  }
  return response.data.data.keys;
}

/**
 * Generates a new merchant API key.
 */
export async function createAdminApiKey(
  token: string,
  name: string,
  scopes?: string[],
): Promise<{ key: AdminApiKey }> {
  const response = await apiClient.post<ApiResponse<{ key: AdminApiKey }>>(
    '/admin/keys',
    { name, scopes },
    getAdminHeaders(token),
  );
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error?.message || 'Failed to generate API key');
  }
  return response.data.data;
}

/**
 * Revokes an existing API key.
 */
export async function deleteAdminApiKey(token: string, keyId: string): Promise<void> {
  const response = await apiClient.delete<ApiResponse<any>>(
    `/admin/keys/${keyId}`,
    getAdminHeaders(token),
  );
  if (!response.data.success) {
    throw new Error(response.data.error?.message || 'Failed to revoke API key');
  }
}
