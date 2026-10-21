/**
 * src/services/sweeper/index.ts
 *
 * Central export barrel for Auto-Forwarding Sweeper services.
 */

import { logger } from '../../utils/logger';
import { sweeperWorker } from './sweeperWorker';
import { SweeperTelemetry } from './types';

export * from './types';
export * from './gasStation';
export * from './bscSweeper';
export * from './tronSweeper';
export * from './sweeperWorker';

/**
 * Starts the auto-forwarding sweeper worker.
 */
export function startSweeperWorker(): void {
  logger.info('[Sweeper] Initializing auto-forwarding sweeper worker…');
  sweeperWorker.start();
  logger.info('[Sweeper] Auto-forwarding sweeper worker is active.');
}

/**
 * Stops the auto-forwarding sweeper worker on graceful shutdown.
 */
export function stopSweeperWorker(): void {
  logger.info('[Sweeper] Stopping auto-forwarding sweeper worker…');
  sweeperWorker.stop();
  logger.info('[Sweeper] Auto-forwarding sweeper worker stopped.');
}

/**
 * Returns current sweeper telemetry and gas station balances.
 */
export async function getSweeperTelemetry(): Promise<SweeperTelemetry> {
  return sweeperWorker.getTelemetry();
}
