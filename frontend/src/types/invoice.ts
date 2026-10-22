/**
 * src/types/invoice.ts
 *
 * Frontend types mirroring the backend schema, API contracts, and Web3 fee models.
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

export interface NetworkFeeInfo {
  network: CryptoNetwork;
  feeUsdt: number;
  feeFormatted: string;
  isSubsidized: boolean;
  blockTimeEstimate: string;
  protocolBadge: string;
}

export interface InvoiceDetails {
  invoiceId: string;
  depositAddress: string;
  expectedCryptoAmount: string;
  baseAmount?: number;
  feeAmount?: number;
  paidCryptoAmount?: string;
  cryptoCurrency: CryptoCurrency;
  network: CryptoNetwork;
  status: InvoiceStatus;
  confirmations?: number;
  txHash?: string;
  expiresAt: string;
  createdAt: string;
  feeBreakdown?: {
    baseAmount: number;
    networkFee: number;
    totalAmount: number;
    isSubsidized: boolean;
  };
}

export interface SystemHealthData {
  status: string;
  timestamp: string;
  uptime: number;
  mongodb: string;
  blockchain: {
    bsc: {
      network: string;
      isRunning: boolean;
      lastScannedBlock: number;
      currentTipBlock: number;
      activeInvoicesTracked: number;
    };
    tron: {
      network: string;
      isRunning: boolean;
      activeInvoicesTracked: number;
    };
    bscRpcNodes?: Array<{
      url: string;
      isHealthy: boolean;
      latencyMs: number;
    }>;
  };
  sweeper: {
    isRunning: boolean;
    gasStation?: {
      bsc: { nativeBalance: string; isSufficient: boolean };
      tron: { nativeBalance: string; isSufficient: boolean };
    };
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface AdminGasStationInfo {
  address: string;
  nativeBalance: string;
  nativeCurrency: string;
  status: 'HEALTHY' | 'LOW';
}

export interface AdminOverviewData {
  metrics: {
    totalVolumeUsdt: string;
    todayVolumeUsdt: string;
    totalFeesCollectedUsdt: string;
    totalInvoices: number;
    statusCounts: Record<string, number>;
  };
  gasStation: {
    bsc: AdminGasStationInfo;
    tron: AdminGasStationInfo;
  };
  system: {
    uptimeSeconds: number;
    timestamp: string;
    nodeEnv: string;
  };
}

export interface AdminApiKey {
  keyId: string;
  name: string;
  keyPrefix: string;
  rawKey?: string;
  scopes: string[];
  isActive: boolean;
  totalRequests: number;
  lastUsedAt?: string;
  createdAt: string;
}

