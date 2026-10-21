/**
 * src/services/sweeper/types.ts
 *
 * TypeScript types and interfaces for the Auto-Forwarding Sweeper and Gas Station.
 */

import { CryptoNetwork } from '../../models/Invoice';

export interface SweepResult {
  invoiceId: string;
  network: CryptoNetwork;
  depositAddress: string;
  destinationAddress: string;
  sweptAmount: string;
  gasFee: string;
  txHash: string;
  success: boolean;
  error?: string;
}

export interface GasStationBalance {
  network: CryptoNetwork;
  address: string;
  nativeBalance: string;     // Formatted BNB or TRX
  nativeCurrency: string;    // 'BNB' | 'TRX'
  isSufficient: boolean;     // Whether it holds enough for at least 1 sweep
}

export interface SweeperTelemetry {
  isRunning: boolean;
  lastRunTimestamp: Date | null;
  pendingReadyCount: number;
  inProgressCount: number;
  totalSweptCount: number;
  gasStation: {
    bsc: GasStationBalance;
    tron: GasStationBalance;
  };
}
