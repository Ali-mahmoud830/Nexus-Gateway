/**
 * src/services/blockchain/bscListener.ts
 *
 * Production Blockchain Event Scanner for BNB Smart Chain (BSC / BEP-20 USDT)
 *
 * Architecture:
 *   1. Polls chain tip using multi-RPC failover manager (default 3s block time).
 *   2. Scans block chunks for BEP-20 Transfer events to the USDT contract.
 *   3. Filters incoming deposits destined for active temporary invoice addresses.
 *   4. Persists the latest processed block in MongoDB BlockCursor to prevent missed payments.
 *   5. Advances block confirmation counts for pending payments until 3 confirmations are reached.
 */

import { ethers } from 'ethers';
import { env } from '../../config/env';
import { CryptoNetwork, Invoice, InvoiceStatus } from '../../models/Invoice';
import { BlockCursor } from '../../models/BlockCursor';
import { logger } from '../../utils/logger';
import { bscRpcManager } from './rpcManager';
import { paymentProcessor } from './paymentProcessor';
import { ListenerState, PaymentDetectedEvent } from './types';

// ERC-20 / BEP-20 Transfer(address indexed from, address indexed to, uint256 value)
const TRANSFER_TOPIC = ethers.id('Transfer(address,address,uint256)');

// Max block chunk per eth_getLogs to prevent RPC payload limit errors
const MAX_BLOCK_CHUNK = 50;

// Poll interval in milliseconds (BSC produces blocks every ~3 seconds)
const POLL_INTERVAL_MS = 3_000;

// USDT on BSC has 18 decimals
const BSC_USDT_DECIMALS = 18;

export class BscListener {
  private isRunning: boolean = false;
  private timer: NodeJS.Timeout | null = null;
  private lastScannedBlock: number = 0;
  private isProcessing: boolean = false;

  /**
   * Starts the continuous block scanning loop.
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('[BscListener] Already running — start() ignored.');
      return;
    }

    this.isRunning = true;
    logger.info('[BscListener] 🟢 Starting BSC BEP-20 USDT listener…');

    // 1. Initialize block cursor
    try {
      const currentBlock = await bscRpcManager.executeWithFailover((provider) =>
        provider.getBlockNumber(),
      );

      // Start from stored cursor, or current tip - 5 blocks for safe warmup
      this.lastScannedBlock = await BlockCursor.getCursor(
        CryptoNetwork.BSC,
        Math.max(0, currentBlock - 5),
      );

      logger.info(
        `[BscListener] Synced with BSC chain. Current tip: #${currentBlock}, starting scan at: #${this.lastScannedBlock}`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`[BscListener] Failed to obtain initial BSC block tip: ${msg}`);
      // Fallback: will retry in loop
    }

    // 2. Start polling loop
    this.scheduleNextPoll(100);
  }

  /**
   * Stops the block scanner cleanly.
   */
  public stop(): void {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    logger.info('[BscListener] 🛑 Stopped BSC listener.');
  }

  /**
   * Schedules the next block scan iteration.
   */
  private scheduleNextPoll(delayMs: number = POLL_INTERVAL_MS): void {
    if (!this.isRunning) return;

    this.timer = setTimeout(async () => {
      try {
        await this.scanCycle();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`[BscListener] Unexpected error in scan cycle: ${msg}`);
      } finally {
        this.scheduleNextPoll(POLL_INTERVAL_MS);
      }
    }, delayMs);
  }

  /**
   * Single scan cycle: fetches new blocks, queries Transfer logs, processes payments.
   */
  private async scanCycle(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      // 1. Fetch active temporary deposit addresses
      const activeInvoices = await Invoice.find({
        network: CryptoNetwork.BSC,
        status: { $in: [InvoiceStatus.PENDING, InvoiceStatus.DETECTED] },
      }).select('depositAddress');

      // 2. Fetch current block tip
      const currentBlock = await bscRpcManager.executeWithFailover((provider) =>
        provider.getBlockNumber(),
      );

      // Always advance confirmations for detected invoices, even if no new deposits
      await paymentProcessor.updateConfirmations(
        CryptoNetwork.BSC,
        currentBlock,
        env.bsc.confirmationsRequired,
      );

      // If we are already caught up to the tip, wait for next block
      if (this.lastScannedBlock >= currentBlock) {
        return;
      }

      // If no active invoices, fast-forward cursor to tip - 2 to save RPC calls
      if (activeInvoices.length === 0) {
        this.lastScannedBlock = Math.max(this.lastScannedBlock, currentBlock - 2);
        await BlockCursor.setCursor(CryptoNetwork.BSC, this.lastScannedBlock);
        return;
      }

      // 3. Calculate block chunk
      const fromBlock = this.lastScannedBlock + 1;
      const toBlock = Math.min(currentBlock, fromBlock + MAX_BLOCK_CHUNK - 1);

      logger.debug(
        `[BscListener] Scanning BSC blocks #${fromBlock} to #${toBlock} (${activeInvoices.length} active invoice(s))`,
      );

      // Prepare 32-byte zero-padded topic filters for each active deposit address
      const targetTopics = activeInvoices.map((inv) =>
        ethers.zeroPadValue(inv.depositAddress, 32),
      );

      // 4. Query BEP-20 Transfer logs targeting our specific deposit addresses
      const logs = await bscRpcManager.executeWithFailover((provider) =>
        provider.getLogs({
          address: env.bsc.usdtContract,
          topics: [
            TRANSFER_TOPIC,
            null,
            targetTopics.length === 1 ? targetTopics[0]! : targetTopics,
          ],
          fromBlock,
          toBlock,
        }),
      );

      if (logs.length > 0) {
        logger.info(`[BscListener] Found ${logs.length} USDT Transfer log(s) for watched addresses!`);
      }

      // 5. Parse and process each log
      for (const log of logs) {
        try {
          if (log.topics.length < 3) continue;

          // Decode 'from' and 'to' from indexed topics (32 bytes to 20-byte checksummed address)
          const fromAddress = ethers.getAddress(`0x${log.topics[1]!.slice(26)}`);
          const toAddress = ethers.getAddress(`0x${log.topics[2]!.slice(26)}`);

          // Decode raw transfer value
          const rawAmount = BigInt(log.data).toString();
          const formattedAmount = ethers.formatUnits(rawAmount, BSC_USDT_DECIMALS);

          const confirmations = Math.max(1, currentBlock - log.blockNumber + 1);

          const paymentEvent: PaymentDetectedEvent = {
            network: CryptoNetwork.BSC,
            txHash: log.transactionHash,
            fromAddress,
            toAddress,
            rawAmount,
            formattedAmount,
            blockNumber: log.blockNumber,
            confirmations,
            timestamp: new Date(),
          };

          // Reconcile with payment processor
          await paymentProcessor.handlePaymentDetected(
            paymentEvent,
            env.bsc.confirmationsRequired,
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          logger.error(`[BscListener] Error parsing transfer log: ${msg}`, { log });
        }
      }

      // 6. Update cursor in memory and database
      this.lastScannedBlock = toBlock;
      await BlockCursor.setCursor(CryptoNetwork.BSC, toBlock);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`[BscListener] Scan iteration failed: ${msg}`);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Returns current listener telemetry for health checks.
   */
  public async getStatus(): Promise<ListenerState> {
    let currentTip = 0;
    try {
      currentTip = await bscRpcManager.executeWithFailover((p) => p.getBlockNumber());
    } catch {
      // Ignore in status check
    }

    const activeCount = await Invoice.countDocuments({
      network: CryptoNetwork.BSC,
      status: { $in: [InvoiceStatus.PENDING, InvoiceStatus.DETECTED] },
    });

    return {
      network: CryptoNetwork.BSC,
      isRunning: this.isRunning,
      lastScannedBlock: this.lastScannedBlock,
      currentTipBlock: currentTip,
      activeInvoicesTracked: activeCount,
    };
  }
}

// Singleton export
export const bscListener = new BscListener();
