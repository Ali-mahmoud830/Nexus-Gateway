/**
 * src/services/sweeper/sweeperWorker.ts
 *
 * Decoupled Background Worker for Automated Cold-Wallet Sweeps
 *
 * Privacy & Security Architecture:
 *   1. Decoupled Timing: Runs on an asynchronous cron loop, separating deposit timestamps from sweep timestamps.
 *   2. Randomized Delay: Inserts a randomized pause (1-4 seconds) between batch sweeps to prevent on-chain timing clustering.
 *   3. Sequential Execution: Sweeps one wallet at a time to prevent nonce collisions and gas spikes.
 *   4. Failure Isolation: If a single sweep fails, it logs and marks that invoice as FAILED without blocking the queue.
 */

import { Invoice, InvoiceStatus, CryptoNetwork } from '../../models/Invoice';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { sweepBscInvoice } from './bscSweeper';
import { sweepTronInvoice } from './tronSweeper';
import { gasStation } from './gasStation';
import { SweeperTelemetry } from './types';

export class SweeperWorker {
  private isRunning: boolean = false;
  private timer: NodeJS.Timeout | null = null;
  private isProcessing: boolean = false;
  private lastRunTimestamp: Date | null = null;
  private totalSweptCount: number = 0;

  /**
   * Starts the background sweeper worker loop.
   */
  public start(): void {
    if (this.isRunning) {
      logger.warn('[SweeperWorker] Already running — start() ignored.');
      return;
    }

    this.isRunning = true;
    logger.info(
      `[SweeperWorker] 🟢 Starting Auto-Forwarding Sweeper (interval: ${env.sweeper.cronIntervalSeconds}s)…`,
    );

    this.scheduleNextRun(1000);
  }

  /**
   * Stops the background sweeper loop cleanly.
   */
  public stop(): void {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    logger.info('[SweeperWorker] 🛑 Stopped Auto-Forwarding Sweeper.');
  }

  /**
   * Schedules the next execution cycle.
   */
  private scheduleNextRun(delayMs: number = env.sweeper.cronIntervalSeconds * 1000): void {
    if (!this.isRunning) return;

    this.timer = setTimeout(async () => {
      try {
        await this.sweepCycle();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`[SweeperWorker] Unexpected error in sweeper cycle: ${msg}`);
      } finally {
        this.scheduleNextRun();
      }
    }, delayMs);
  }

  /**
   * Executes a single sweep cycle across all confirmed pending invoices.
   */
  private async sweepCycle(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;
    this.lastRunTimestamp = new Date();

    try {
      // 1. Fetch invoices ready for sweeping (status: CONFIRMED)
      const readyInvoices = await Invoice.findReadyForForwarding();

      if (readyInvoices.length === 0) {
        return;
      }

      logger.info(`[SweeperWorker] Found ${readyInvoices.length} confirmed invoice(s) ready for sweeping.`);

      // 2. Process invoices sequentially with privacy delay
      for (const invoice of readyInvoices) {
        try {
          if (invoice.network === CryptoNetwork.BSC) {
            const result = await sweepBscInvoice(invoice);
            if (result.success) {
              this.totalSweptCount++;
            }
          } else if (invoice.network === CryptoNetwork.TRON) {
            const result = await sweepTronInvoice(invoice);
            if (result.success) {
              this.totalSweptCount++;
            }
          }

          // Privacy timing jitter: sleep 1.5 - 3.5 seconds between sweeps
          const jitterMs = 1500 + Math.floor(Math.random() * 2000);
          await new Promise((resolve) => setTimeout(resolve, jitterMs));
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          logger.error(`[SweeperWorker] Error sweeping invoice ${invoice.invoiceId}: ${msg}`);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`[SweeperWorker] Error in sweep cycle: ${msg}`);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Returns current telemetry and status for health monitoring.
   */
  public async getTelemetry(): Promise<SweeperTelemetry> {
    const [pendingReadyCount, inProgressCount, bscGas, tronGas] = await Promise.all([
      Invoice.countDocuments({ status: InvoiceStatus.CONFIRMED }),
      Invoice.countDocuments({ status: InvoiceStatus.FORWARDING }),
      gasStation.getBscGasBalance(),
      gasStation.getTronGasBalance(),
    ]);

    return {
      isRunning: this.isRunning,
      lastRunTimestamp: this.lastRunTimestamp,
      pendingReadyCount,
      inProgressCount,
      totalSweptCount: this.totalSweptCount,
      gasStation: {
        bsc: bscGas,
        tron: tronGas,
      },
    };
  }
}

// Singleton export
export const sweeperWorker = new SweeperWorker();
