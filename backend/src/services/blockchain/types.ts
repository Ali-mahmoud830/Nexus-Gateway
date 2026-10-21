/**
 * src/services/blockchain/types.ts
 *
 * TypeScript types and interfaces for the Blockchain Listener and RPC subsystems.
 */

import { CryptoNetwork } from '../../models/Invoice';

export interface PaymentDetectedEvent {
  network: CryptoNetwork;
  txHash: string;
  fromAddress: string;
  toAddress: string;             // The matched temporary deposit address
  rawAmount: string;             // Raw token units in base units (Wei for BSC, Sun for TRON)
  formattedAmount: string;       // Formatted human-readable amount (e.g. "50.000000")
  blockNumber: number;
  confirmations: number;
  timestamp: Date;
}

export interface RpcNodeHealth {
  url: string;
  isHealthy: boolean;
  latencyMs: number;
  consecutiveFailures: number;
  lastChecked: Date;
}

export interface ListenerState {
  network: CryptoNetwork;
  isRunning: boolean;
  lastScannedBlock: number;
  currentTipBlock: number;
  activeInvoicesTracked: number;
}
