/**
 * src/services/blockchain/index.ts
 *
 * Central export and lifecycle coordinator for Blockchain Listeners.
 */

import { logger } from '../../utils/logger';
import { bscListener } from './bscListener';
import { tronListener } from './tronListener';
import { bscRpcManager } from './rpcManager';
import { ListenerState, RpcNodeHealth } from './types';

export * from './types';
export * from './rpcManager';
export * from './paymentProcessor';
export * from './bscListener';
export * from './tronListener';

/**
 * Starts all blockchain event listeners concurrently.
 */
export async function startBlockchainListeners(): Promise<void> {
  logger.info('[Blockchain] Initializing blockchain payment listeners…');
  await Promise.all([bscListener.start(), tronListener.start()]);
  logger.info('[Blockchain] All blockchain listeners are operational.');
}

/**
 * Stops all blockchain event listeners during graceful shutdown.
 */
export function stopBlockchainListeners(): void {
  logger.info('[Blockchain] Stopping blockchain payment listeners…');
  bscListener.stop();
  tronListener.stop();
  logger.info('[Blockchain] All blockchain listeners stopped.');
}

/**
 * Returns telemetry data for health checks and status monitoring.
 */
export async function getBlockchainTelemetry(): Promise<{
  bsc: ListenerState;
  tron: ListenerState;
  bscRpcNodes: RpcNodeHealth[];
}> {
  const [bsc, tron] = await Promise.all([bscListener.getStatus(), tronListener.getStatus()]);

  return {
    bsc,
    tron,
    bscRpcNodes: bscRpcManager.getHealthStatus(),
  };
}
