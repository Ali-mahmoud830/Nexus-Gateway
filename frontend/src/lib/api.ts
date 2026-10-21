/**
 * src/lib/api.ts
 *
 * Axios-based API client for interacting with the Crypto Payment Gateway backend.
 */

import axios from 'axios';
import { ApiResponse, InvoiceDetails, CryptoNetwork } from '../types/invoice';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
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
 * Creates a new crypto payment invoice on the backend.
 */
export async function createInvoice(payload: CreateInvoicePayload): Promise<InvoiceDetails> {
  const response = await apiClient.post<ApiResponse<InvoiceDetails>>('/invoices', payload);
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error?.message || 'Failed to create invoice');
  }
  return response.data.data;
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
