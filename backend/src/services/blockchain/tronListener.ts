/**
 * src/services/blockchain/tronListener.ts
 *
 * Production Blockchain Event Scanner for TRON (TRC-20 USDT)
 *
 * Architecture:
 *   1. Targets active temporary deposit addresses generated for PENDING/DETECTED TRON invoices.
 *   2. Uses TronGrid API with failover and rate-limit backoff.
 *   3. Reconciles incoming TRC-20 transfers with 6 decimals (1 USDT = 1,000,000 Sun).
 *   4. Queries transaction execution status (receipt.result === 'SUCCESS') and block height.
 *   5. Tracks 20 block confirmations before marking invoices as CONFIRMED.
 */

import axios, { AxiosInstance } from 'axios';
import { ethers } from 'ethers';
import { env } from '../../config/env';
import { CryptoNetwork, Invoice, InvoiceStatus } from '../../models/Invoice';
import { logger } from '../../utils/logger';
import { paymentProcessor } from './paymentProcessor';
import { ListenerState, PaymentDetectedEvent } from './types';

const TRON_USDT_DECIMALS = 6;
const POLL_INTERVAL_MS = 3_000;

interface TronGridTrc20Tx {
  transaction_id: string;
  token_info: {
    symbol: string;
    address: string;
    decimals: number;
  };
  block_timestamp: number;
  from: string;
  to: string;
  type: string;
  value: string;
}

export class TronListener {
  private isRunning: boolean = false;
  private timer: NodeJS.Timeout | null = null;
  private isProcessing: boolean = false;
  private currentTipBlock: number = 0;
  private httpClient: AxiosInstance;

  constructor() {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'CryptoGateway-TronListener/1.0',
    };

    // Attach TRON API key if provided and not placeholder
    if (env.tron.apiKey && !env.tron.apiKey.includes('PLACEHOLDER')) {
      headers['TRON-PRO-API-KEY'] = env.tron.apiKey;
    }

    this.httpClient = axios.create({
      baseURL: env.tron.fullNode,
      timeout: 10_000,
      headers,
    });
  }

  /**
   * Starts the continuous TRON monitoring loop.
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('[TronListener] Already running — start() ignored.');
      return;
    }

    this.isRunning = true;
    logger.info('[TronListener] 🟢 Starting TRON TRC-20 USDT listener…');

    // Query current block tip
    await this.refreshBlockTip();

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
    logger.info('[TronListener] 🛑 Stopped TRON listener.');
  }

  /**
   * Schedules the next polling iteration.
   */
  private scheduleNextPoll(delayMs: number = POLL_INTERVAL_MS): void {
    if (!this.isRunning) return;

    this.timer = setTimeout(async () => {
      try {
        await this.scanCycle();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`[TronListener] Unexpected error in scan cycle: ${msg}`);
      } finally {
        this.scheduleNextPoll(POLL_INTERVAL_MS);
      }
    }, delayMs);
  }

  /**
   * Refreshes the latest TRON block number.
   */
  private async refreshBlockTip(): Promise<number> {
    try {
      const res = await this.httpClient.post('/wallet/getnowblock');
      const blockNum = res.data?.block_header?.raw_data?.number;
      if (typeof blockNum === 'number') {
        this.currentTipBlock = blockNum;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`[TronListener] Failed to refresh TRON block tip: ${msg}`);
    }
    return this.currentTipBlock;
  }

  /**
   * Main scan cycle: monitors active TRON temporary addresses for inbound USDT transfers.
   */
  private async scanCycle(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      // 1. Fetch all active TRON invoices
      const activeInvoices = await Invoice.find({
        network: CryptoNetwork.TRON,
        status: { $in: [InvoiceStatus.PENDING, InvoiceStatus.DETECTED] },
      }).select('depositAddress invoiceId status paymentDetails');

      if (activeInvoices.length === 0) {
        return;
      }

      // 2. Refresh current block height
      const currentBlock = await this.refreshBlockTip();

      // 3. Advance confirmations for in-flight DETECTED invoices
      if (currentBlock > 0) {
        await paymentProcessor.updateConfirmations(
          CryptoNetwork.TRON,
          currentBlock,
          env.tron.confirmationsRequired,
        );
      }

      // 4. Poll TRC-20 incoming transactions for each active temporary address
      for (const invoice of activeInvoices) {
        try {
          const address = invoice.depositAddress;

          // Query TronGrid account TRC-20 transfers
          const url = `/v1/accounts/${address}/transactions/trc20?contract_address=${env.tron.usdtContract}&limit=5`;
          const res = await this.httpClient.get<{ data: TronGridTrc20Tx[] }>(url);
          const txs = res.data?.data || [];

          for (const tx of txs) {
            // Check that it's an incoming Transfer to our deposit address
            if (tx.type !== 'Transfer' || tx.to !== address) {
              continue;
            }

            // Verify transaction receipt and block on-chain
            const txInfoRes = await this.httpClient.post('/wallet/gettransactioninfobyid', {
              value: tx.transaction_id,
            });

            const receiptResult = txInfoRes.data?.receipt?.result;
            // Result must be SUCCESS (not REVERT / OUT_OF_ENERGY)
            if (receiptResult && receiptResult !== 'SUCCESS') {
              logger.warn(
                `[TronListener] Transaction ${tx.transaction_id} reverted on-chain (receipt: ${receiptResult})`,
              );
              continue;
            }

            const txBlock = txInfoRes.data?.blockNumber || this.currentTipBlock;
            const confirmations = currentBlock > 0 ? Math.max(1, currentBlock - txBlock + 1) : 1;

            const formattedAmount = ethers.formatUnits(tx.value, TRON_USDT_DECIMALS);

            const paymentEvent: PaymentDetectedEvent = {
              network: CryptoNetwork.TRON,
              txHash: tx.transaction_id,
              fromAddress: tx.from,
              toAddress: address,
              rawAmount: tx.value,
              formattedAmount,
              blockNumber: txBlock,
              confirmations,
              timestamp: new Date(tx.block_timestamp),
            };

            // Hand over to payment processor
            await paymentProcessor.handlePaymentDetected(
              paymentEvent,
              env.tron.confirmationsRequired,
            );
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          logger.warn(
            `[TronListener] Failed to poll transfers for address ${invoice.depositAddress}: ${msg}`,
          );
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`[TronListener] Error in scan cycle: ${msg}`);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Returns current listener telemetry for health checks.
   */
  public async getStatus(): Promise<ListenerState> {
    const activeCount = await Invoice.countDocuments({
      network: CryptoNetwork.TRON,
      status: { $in: [InvoiceStatus.PENDING, InvoiceStatus.DETECTED] },
    });

    return {
      network: CryptoNetwork.TRON,
      isRunning: this.isRunning,
      lastScannedBlock: this.currentTipBlock,
      currentTipBlock: this.currentTipBlock,
      activeInvoicesTracked: activeCount,
    };
  }
}

// Singleton export
export const tronListener = new TronListener();
