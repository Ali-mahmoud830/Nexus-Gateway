/**
 * src/api/controllers/invoiceController.ts
 *
 * Controller handling crypto payment invoice generation and status queries.
 *
 * Privacy mechanism:
 *   - Each invoice request dynamically generates a child address from HD wallet.
 *   - Main wallet address is never returned or revealed to the payer.
 */

import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { v4 as uuidv4 } from 'uuid';
import { Invoice, InvoiceStatus, CryptoNetwork, CryptoCurrency } from '../../models/Invoice';
import { generateDepositAddress } from '../../services/hdWallet';
import { env } from '../../config/env';
import { sendSuccess } from '../../utils/responseHelper';
import { AppError } from '../middlewares/errorHandler';
import { logger } from '../../utils/logger';

export interface CreateInvoiceRequestBody {
  userId: string;
  amount: number;
  network: CryptoNetwork;
  metadata?: Record<string, unknown>;
  webhookUrl?: string;
}

/**
 * POST /api/v1/invoices
 * Creates a new cryptocurrency payment invoice with a dedicated deposit address.
 */
export async function createInvoice(
  req: Request<unknown, unknown, CreateInvoiceRequestBody>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { userId, amount, network, metadata, webhookUrl } = req.body;

    // 1. Strict validation
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      throw new AppError('userId is required', StatusCodes.BAD_REQUEST, 'INVALID_USER_ID');
    }

    if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
      throw new AppError(
        'amount must be a positive number',
        StatusCodes.BAD_REQUEST,
        'INVALID_AMOUNT',
      );
    }

    if (!Object.values(CryptoNetwork).includes(network)) {
      throw new AppError(
        `Invalid network "${network}". Supported networks: ${Object.values(CryptoNetwork).join(', ')}`,
        StatusCodes.BAD_REQUEST,
        'INVALID_NETWORK',
      );
    }

    // 2. Generate unique temporary deposit address
    const derived = await generateDepositAddress(network);

    // 3. Format expected crypto amount (USDT is pegged 1:1 with USD)
    const expectedCryptoAmount = amount.toFixed(6);

    // 4. Calculate 15-minute expiration window
    const expiresAt = new Date(Date.now() + env.invoice.expiryMinutes * 60 * 1000);

    // 5. Generate human-readable invoice ID
    const invoiceId = `inv_${uuidv4().replace(/-/g, '').slice(0, 16)}`;

    // 6. Persist to MongoDB
    const invoice = await Invoice.create({
      invoiceId,
      userId: userId.trim(),
      fiatAmount: amount,
      fiatCurrency: 'USD',
      cryptoCurrency: CryptoCurrency.USDT,
      network,
      expectedCryptoAmount,
      paidCryptoAmount: '0',
      depositAddress: derived.address,
      derivationIndex: derived.derivationIndex,
      status: InvoiceStatus.PENDING,
      paymentDetails: {
        confirmations: 0,
      },
      forwardingDetails: {},
      expiresAt,
      metadata: metadata || {},
      webhookUrl: webhookUrl || null,
      webhookDelivered: false,
      webhookAttempts: 0,
    });

    logger.info('[InvoiceController] Created invoice', {
      invoiceId: invoice.invoiceId,
      userId: invoice.userId,
      network: invoice.network,
      depositAddress: invoice.depositAddress,
      amount: invoice.expectedCryptoAmount,
    });

    sendSuccess(
      res,
      {
        invoiceId: invoice.invoiceId,
        depositAddress: invoice.depositAddress,
        expectedCryptoAmount: invoice.expectedCryptoAmount,
        cryptoCurrency: invoice.cryptoCurrency,
        network: invoice.network,
        status: invoice.status,
        expiresAt: invoice.expiresAt,
        createdAt: invoice.createdAt,
      },
      StatusCodes.CREATED,
    );
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/invoices/:invoiceId
 * Returns the current status and payment progress of an invoice.
 */
export async function getInvoiceStatus(
  req: Request<{ invoiceId: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { invoiceId } = req.params;

    if (!invoiceId) {
      throw new AppError('invoiceId param is required', StatusCodes.BAD_REQUEST, 'MISSING_PARAM');
    }

    const invoice = await Invoice.findOne({ invoiceId });

    if (!invoice) {
      throw new AppError(
        `Invoice with ID "${invoiceId}" not found`,
        StatusCodes.NOT_FOUND,
        'INVOICE_NOT_FOUND',
      );
    }

    // 1. If invoice is already paid/confirmed on-chain, normalize user-facing status
    let userFacingStatus = invoice.status;
    if (
      invoice.status === InvoiceStatus.FORWARDING ||
      invoice.status === InvoiceStatus.FORWARDED ||
      (invoice.status === InvoiceStatus.FAILED && !!invoice.paymentDetails?.txHash) ||
      parseFloat(invoice.paidCryptoAmount || '0') > 0
    ) {
      userFacingStatus = InvoiceStatus.CONFIRMED;
    }

    // 2. Real-time reconciliation: If still PENDING or expired but unpaid, check TronGrid on-demand
    if (
      (invoice.status === InvoiceStatus.PENDING || invoice.status === InvoiceStatus.EXPIRED) &&
      invoice.network === CryptoNetwork.TRON &&
      parseFloat(invoice.paidCryptoAmount || '0') === 0
    ) {
      try {
        const url = `https://api.trongrid.io/v1/accounts/${invoice.depositAddress}/transactions/trc20?contract_address=${env.tron.usdtContract}&limit=1`;
        const tronRes = await fetch(url);
        const tronData = (await tronRes.json()) as { data?: Array<{ transaction_id: string; value: string; type: string; to: string }> };
        const latestTx = tronData.data?.[0];

        if (latestTx && latestTx.type === 'Transfer' && latestTx.to === invoice.depositAddress) {
          const formatted = (parseInt(latestTx.value, 10) / 1_000_000).toFixed(6);
          invoice.status = InvoiceStatus.CONFIRMED;
          invoice.paidCryptoAmount = formatted;
          invoice.paymentDetails = {
            txHash: latestTx.transaction_id,
            confirmations: 20,
            paidAt: new Date(),
          };
          await invoice.save();
          userFacingStatus = InvoiceStatus.CONFIRMED;
          logger.info(`[InvoiceController] Reconciled TRON payment on-demand for ${invoice.invoiceId}!`);
        }
      } catch (checkErr) {
        logger.debug('[InvoiceController] On-demand TRON check skipped', { error: checkErr });
      }
    }

    // 3. Lazy check: if pending, not paid, and time expired, update status in DB
    if (invoice.isExpired() && parseFloat(invoice.paidCryptoAmount || '0') === 0 && userFacingStatus !== InvoiceStatus.CONFIRMED) {
      invoice.status = InvoiceStatus.EXPIRED;
      userFacingStatus = InvoiceStatus.EXPIRED;
      await invoice.save();
    }

    sendSuccess(res, {
      invoiceId: invoice.invoiceId,
      depositAddress: invoice.depositAddress,
      expectedCryptoAmount: invoice.expectedCryptoAmount,
      paidCryptoAmount: invoice.paidCryptoAmount,
      cryptoCurrency: invoice.cryptoCurrency,
      network: invoice.network,
      status: userFacingStatus,
      confirmations: invoice.paymentDetails.confirmations || 0,
      txHash: invoice.paymentDetails.txHash,
      expiresAt: invoice.expiresAt,
      createdAt: invoice.createdAt,
    });
  } catch (err) {
    next(err);
  }
}
