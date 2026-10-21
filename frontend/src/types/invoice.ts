/**
 * src/types/invoice.ts
 *
 * Frontend types mirroring the backend schema and API contracts.
 */

export enum CryptoNetwork {
  BSC = 'BSC',
  TRON = 'TRON',
}

export enum CryptoCurrency {
  USDT = 'USDT',
}

export enum InvoiceStatus {
  PENDING = 'PENDING',
  DETECTED = 'DETECTED',
  CONFIRMED = 'CONFIRMED',
  EXPIRED = 'EXPIRED',
  FAILED = 'FAILED',
  UNDERPAID = 'UNDERPAID',
}

export interface InvoiceDetails {
  invoiceId: string;
  depositAddress: string;
  expectedCryptoAmount: string;
  paidCryptoAmount?: string;
  cryptoCurrency: CryptoCurrency;
  network: CryptoNetwork;
  status: InvoiceStatus;
  confirmations?: number;
  txHash?: string;
  expiresAt: string;
  createdAt: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: {
    code: string;
    message: string;
  };
}
