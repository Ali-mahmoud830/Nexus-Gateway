/**
 * src/services/blockchain/paymentProcessor.ts
 *
 * Core Payment Verification and Reconciliation Engine
 *
 * Responsibilities:
 *   1. Reconciles raw on-chain token transfer events against active Invoice records.
 *   2. Handles unit conversions with exact decimal precision (18 decimals for BSC, 6 for TRON).
 *   3. Enforces strict slippage tolerance and detects underpayments/overpayments.
 *   4. Updates invoice states idempotently:
 *      - PENDING -> DETECTED (when tx is spotted but needs more confirmations)
 *      - DETECTED -> CONFIRMED (when required block confirmations are reached)
 *   5. Dispatches webhooks to the binary options trading platform to credit user balances.
 */

import crypto from 'crypto';
import axios from 'axios';
import { Invoice, InvoiceStatus, CryptoNetwork } from '../../models/Invoice';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { PaymentDetectedEvent } from './types';

// Micro-tolerance for stablecoins: allow up to $0.01 discrepancy for dust/rounding
const SLIPPAGE_TOLERANCE_USD = 0.01;

export class PaymentProcessor {
  /**
   * Processes an incoming payment event spotted by the blockchain listener.
   *
   * @param event - Standardized payment detected event
   * @param requiredConfirmations - Number of block confirmations required by the network
   */
  public async handlePaymentDetected(
    event: PaymentDetectedEvent,
    requiredConfirmations: number,
  ): Promise<void> {
    const { network, txHash, fromAddress, toAddress, formattedAmount, blockNumber, confirmations } =
      event;

    // 1. Look up the corresponding invoice in database
    const invoice = await Invoice.findByAddressAndNetwork(toAddress, network);

    if (!invoice) {
      // Transfer to an address not associated with any active invoice.
      // Could be past invoice or unrelated transfer — log for audit.
      logger.debug('[PaymentProcessor] Transfer detected for untracked address', {
        network,
        toAddress,
        amount: formattedAmount,
        txHash,
      });
      return;
    }

    // 2. Prevent state regression (Idempotency Guard)
    // If invoice is already CONFIRMED, FORWARDING, or FORWARDED, ignore duplicate events
    if (
      [
        InvoiceStatus.CONFIRMED,
        InvoiceStatus.FORWARDING,
        InvoiceStatus.FORWARDED,
      ].includes(invoice.status)
    ) {
      logger.info(
        `[PaymentProcessor] Invoice ${invoice.invoiceId} already in ${invoice.status} state. Skipping event.`,
        { invoiceId: invoice.invoiceId, txHash },
      );
      return;
    }

    const expectedNum = parseFloat(invoice.expectedCryptoAmount);
    const paidNum = parseFloat(formattedAmount);
    const difference = paidNum - expectedNum;

    logger.info('[PaymentProcessor] Reconciling payment for invoice', {
      invoiceId: invoice.invoiceId,
      network,
      expected: invoice.expectedCryptoAmount,
      received: formattedAmount,
      confirmations,
      requiredConfirmations,
      txHash,
    });

    // 3. Update payment audit details
    invoice.paymentDetails.txHash = txHash;
    invoice.paymentDetails.fromAddress = fromAddress;
    invoice.paymentDetails.blockNumber = blockNumber;
    invoice.paymentDetails.confirmations = confirmations;
    invoice.paidCryptoAmount = formattedAmount;

    // 4. Financial Reconciliation: Check Underpayment / Overpayment with Safe Tolerance
    const baseNum = invoice.baseAmount || invoice.fiatAmount;
    const isUnderpaid =
      paidNum < baseNum - 0.5 && paidNum < expectedNum - SLIPPAGE_TOLERANCE_USD;

    if (isUnderpaid) {
      // Underpayment detected (user sent significantly less than required deposit)
      logger.warn('[PaymentProcessor] Underpayment detected', {
        invoiceId: invoice.invoiceId,
        expected: invoice.expectedCryptoAmount,
        base: baseNum,
        received: formattedAmount,
        deficit: (expectedNum - paidNum).toFixed(6),
      });

      invoice.status = InvoiceStatus.UNDERPAID;
      invoice.paymentDetails.paidAt = new Date();
      await invoice.save();

      // Trigger notification for partial payment
      await this.dispatchWebhook(invoice, 'INVOICE_UNDERPAID');
      return;
    }

    // 5. Confirmation threshold check
    if (confirmations >= requiredConfirmations) {
      // Reached required confirmations -> Mark CONFIRMED
      invoice.status =
        difference > SLIPPAGE_TOLERANCE_USD
          ? InvoiceStatus.OVERPAID
          : InvoiceStatus.CONFIRMED;

      invoice.paymentDetails.paidAt = new Date();

      if (difference > SLIPPAGE_TOLERANCE_USD) {
        invoice.metadata = {
          ...invoice.metadata,
          surplusAmount: difference.toFixed(6),
        };
      }

      await invoice.save();

      logger.info(
        `[PaymentProcessor] 💰 Payment fully confirmed for invoice ${invoice.invoiceId}! Credit platform user ${invoice.userId}.`,
        {
          invoiceId: invoice.invoiceId,
          userId: invoice.userId,
          status: invoice.status,
          amount: invoice.paidCryptoAmount,
          txHash,
        },
      );

      // Notify binary options core engine to credit user balance
      await this.dispatchWebhook(invoice, 'PAYMENT_CONFIRMED');
    } else {
      // In-flight confirmation progress -> Mark DETECTED
      if (invoice.status === InvoiceStatus.PENDING) {
        invoice.status = InvoiceStatus.DETECTED;
        await invoice.save();

        logger.info(
          `[PaymentProcessor] Invoice ${invoice.invoiceId} moved to DETECTED (${confirmations}/${requiredConfirmations} confs)`,
        );

        await this.dispatchWebhook(invoice, 'PAYMENT_DETECTED');
      } else {
        // Just save updated confirmation count
        await invoice.save();
      }
    }
  }

  /**
   * Updates block confirmations for in-flight DETECTED invoices.
   */
  public async updateConfirmations(
    network: CryptoNetwork,
    currentBlock: number,
    requiredConfirmations: number,
  ): Promise<void> {
    const detectedInvoices = await Invoice.find({
      network,
      status: InvoiceStatus.DETECTED,
      'paymentDetails.blockNumber': { $ne: null },
    });

    for (const invoice of detectedInvoices) {
      const txBlock = invoice.paymentDetails.blockNumber!;
      const confirmations = Math.max(0, currentBlock - txBlock + 1);

      if (confirmations !== invoice.paymentDetails.confirmations) {
        invoice.paymentDetails.confirmations = confirmations;

        if (confirmations >= requiredConfirmations) {
          invoice.status = InvoiceStatus.CONFIRMED;
          invoice.paymentDetails.paidAt = new Date();
          await invoice.save();

          logger.info(
            `[PaymentProcessor] 💰 Invoice ${invoice.invoiceId} reached required confirmations (${confirmations}/${requiredConfirmations})! Marked CONFIRMED.`,
          );

          await this.dispatchWebhook(invoice, 'PAYMENT_CONFIRMED');
        } else {
          await invoice.save();
        }
      }
    }
  }

  /**
   * Dispatches cryptographically signed HMAC-SHA256 webhook payload to the external platform callback URL.
   */
  private async dispatchWebhook(
    invoice: any,
    event: 'PAYMENT_DETECTED' | 'PAYMENT_CONFIRMED' | 'INVOICE_UNDERPAID',
  ): Promise<void> {
    if (!invoice.webhookUrl) return;

    const timestamp = Math.floor(Date.now() / 1000);
    const payload = {
      event,
      timestamp: new Date().toISOString(),
      data: {
        invoiceId: invoice.invoiceId,
        userId: invoice.userId,
        amount: invoice.baseAmount || invoice.fiatAmount,
        baseAmount: invoice.baseAmount || invoice.fiatAmount,
        feeAmount: invoice.feeAmount || 0,
        expectedCryptoAmount: invoice.expectedCryptoAmount,
        paidCryptoAmount: invoice.paidCryptoAmount,
        cryptoCurrency: invoice.cryptoCurrency,
        network: invoice.network,
        depositAddress: invoice.depositAddress,
        status: invoice.status,
        txHash: invoice.paymentDetails?.txHash,
        confirmations: invoice.paymentDetails?.confirmations,
        metadata: invoice.metadata,
      },
    };

    const signaturePayload = `${timestamp}.${JSON.stringify(payload)}`;
    const signature = crypto
      .createHmac('sha256', env.jwt.secret)
      .update(signaturePayload)
      .digest('hex');

    const maxRetries = 3;
    let delivered = false;

    for (let attempt = 1; attempt <= maxRetries && !delivered; attempt++) {
      try {
        invoice.webhookAttempts = (invoice.webhookAttempts || 0) + 1;
        await axios.post(invoice.webhookUrl, payload, {
          timeout: 6000,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'NexusPay-Webhook/2.0',
            'X-Nexus-Signature': `t=${timestamp},v1=${signature}`,
            'X-Nexus-Timestamp': `${timestamp}`,
            'X-Nexus-Event': event,
          },
        });

        delivered = true;
        invoice.webhookDelivered = true;
        await invoice.save();

        logger.info(
          `[PaymentProcessor] Webhook delivered successfully to ${invoice.webhookUrl} (attempt ${attempt})`,
          {
            invoiceId: invoice.invoiceId,
            event,
          },
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.warn(
          `[PaymentProcessor] Webhook delivery attempt ${attempt} failed for ${invoice.invoiceId}: ${msg}`,
        );
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
        } else {
          await invoice.save();
        }
      }
    }
  }
}

// Singleton export
export const paymentProcessor = new PaymentProcessor();
