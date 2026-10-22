/**
 * src/api/controllers/adminController.ts
 *
 * Comprehensive Admin Controller providing complete oversight, financial telemetry,
 * real-time gas monitoring, manual on-chain reconciliation, sweeper triggering,
 * and developer API key management.
 */

import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { Invoice, InvoiceStatus, CryptoNetwork } from '../../models/Invoice';
import { ApiKey } from '../../models/ApiKey';
import { GatewayConfig } from '../../models/GatewayConfig';
import { gasStation } from '../../services/sweeper/gasStation';
import { sweepTronInvoice } from '../../services/sweeper/tronSweeper';
import { sweepBscInvoice } from '../../services/sweeper/bscSweeper';
import { env } from '../../config/env';
import { sendSuccess } from '../../utils/responseHelper';
import { AppError } from '../middlewares/errorHandler';
import { logger } from '../../utils/logger';

// Default Master Passkey if not set in environment
const ADMIN_MASTER_SECRET = process.env['ADMIN_SECRET'] || 'nexus_admin_master_2026';

/**
 * POST /api/v1/admin/login
 * Validates master passkey and returns a secure JWT admin token.
 */
export async function adminLogin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { passkey } = req.body;

    if (!passkey || typeof passkey !== 'string') {
      throw new AppError('Passkey is required', StatusCodes.BAD_REQUEST, 'MISSING_PASSKEY');
    }

    if (passkey.trim() !== ADMIN_MASTER_SECRET.trim()) {
      logger.warn('[AdminAuth] Unauthorized admin login attempt rejected.');
      throw new AppError('Invalid admin master passkey', StatusCodes.UNAUTHORIZED, 'INVALID_AUTH');
    }

    const token = jwt.sign(
      { role: 'super_admin', gateway: 'nexus_payment_rails' },
      env.jwt.secret,
      { expiresIn: '8h' },
    );

    logger.info('[AdminAuth] ✅ Super Admin authenticated successfully.');

    sendSuccess(res, {
      token,
      expiresIn: '8h',
      role: 'super_admin',
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/admin/overview
 * Real-time financial telemetry, total volumes, and live Gas Station reserve balances.
 */
export async function getAdminOverview(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // 1. Calculate financial aggregates
    const allInvoices = await Invoice.find().lean();

    let totalVolumeUsdt = 0;
    let todayVolumeUsdt = 0;
    let totalFeesCollectedUsdt = 0;
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const statusCounts: Record<string, number> = {
      PENDING: 0,
      DETECTED: 0,
      CONFIRMED: 0,
      FORWARDING: 0,
      FORWARDED: 0,
      EXPIRED: 0,
      FAILED: 0,
    };

    for (const inv of allInvoices) {
      statusCounts[inv.status] = (statusCounts[inv.status] || 0) + 1;

      const isPaid =
        inv.status === InvoiceStatus.CONFIRMED ||
        inv.status === InvoiceStatus.FORWARDING ||
        inv.status === InvoiceStatus.FORWARDED;

      if (isPaid) {
        const amount = parseFloat(inv.paidCryptoAmount || inv.expectedCryptoAmount || '0');
        totalVolumeUsdt += amount;
        totalFeesCollectedUsdt += inv.feeAmount || 0;

        if (new Date(inv.createdAt) >= startOfToday) {
          todayVolumeUsdt += amount;
        }
      }
    }

    // 2. Fetch live Gas Station reserves
    let bscGasInfo = { address: '', nativeBalance: '0', nativeCurrency: 'BNB' };
    let tronGasInfo = { address: '', nativeBalance: '0', nativeCurrency: 'TRX' };

    try {
      bscGasInfo = await gasStation.getBscGasBalance();
    } catch (e) {
      logger.warn('[Admin] Could not fetch BSC gas balance:', e);
    }

    try {
      tronGasInfo = await gasStation.getTronGasBalance();
    } catch (e) {
      logger.warn('[Admin] Could not fetch TRON gas balance:', e);
    }

    sendSuccess(res, {
      metrics: {
        totalVolumeUsdt: totalVolumeUsdt.toFixed(2),
        todayVolumeUsdt: todayVolumeUsdt.toFixed(2),
        totalFeesCollectedUsdt: totalFeesCollectedUsdt.toFixed(2),
        totalInvoices: allInvoices.length,
        statusCounts,
      },
      gasStation: {
        bsc: {
          ...bscGasInfo,
          status: parseFloat(bscGasInfo.nativeBalance) > 0.005 ? 'HEALTHY' : 'LOW',
        },
        tron: {
          ...tronGasInfo,
          status: parseFloat(tronGasInfo.nativeBalance) > 30 ? 'HEALTHY' : 'LOW',
        },
      },
      system: {
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
        nodeEnv: process.env.NODE_ENV || 'production',
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/admin/invoices
 * Paginated list with filtering and search.
 */
export async function getAdminInvoices(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = Math.max(1, parseInt((req.query['page'] as string) || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt((req.query['limit'] as string) || '20', 10)));
    const network = req.query['network'] as string | undefined;
    const status = req.query['status'] as string | undefined;
    const search = req.query['search'] as string | undefined;

    const query: Record<string, unknown> = {};

    if (network && Object.values(CryptoNetwork).includes(network as CryptoNetwork)) {
      query['network'] = network;
    }
    if (status && Object.values(InvoiceStatus).includes(status as InvoiceStatus)) {
      query['status'] = status;
    }
    if (search && search.trim() !== '') {
      const s = search.trim();
      query['$or'] = [
        { invoiceId: { $regex: s, $options: 'i' } },
        { userId: { $regex: s, $options: 'i' } },
        { depositAddress: { $regex: s, $options: 'i' } },
        { 'paymentDetails.txHash': { $regex: s, $options: 'i' } },
      ];
    }

    const total = await Invoice.countDocuments(query);
    const invoices = await Invoice.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    sendSuccess(res, {
      invoices,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/admin/invoices/:invoiceId/reconcile
 * Force-reconciles or confirms an invoice manually.
 */
export async function reconcileInvoiceManually(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { invoiceId } = req.params;
    const { txHash, status } = req.body;

    const invoice = await Invoice.findOne({ invoiceId });
    if (!invoice) {
      throw new AppError(`Invoice ${invoiceId} not found`, StatusCodes.NOT_FOUND, 'NOT_FOUND');
    }

    invoice.status = (status as InvoiceStatus) || InvoiceStatus.CONFIRMED;
    if (txHash) {
      invoice.paymentDetails = {
        ...invoice.paymentDetails,
        txHash,
        confirmations: 25,
        paidAt: new Date(),
      };
      invoice.paidCryptoAmount = invoice.expectedCryptoAmount;
    }

    await invoice.save();
    logger.info(`[Admin] Manually reconciled invoice ${invoiceId} to ${invoice.status}`);

    sendSuccess(res, {
      message: `Invoice ${invoiceId} reconciled successfully`,
      invoice,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/admin/invoices/:invoiceId/sweep
 * Triggers on-demand manual auto-forwarding for a confirmed invoice.
 */
export async function triggerManualSweep(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { invoiceId } = req.params;

    const invoice = await Invoice.findOne({ invoiceId });
    if (!invoice) {
      throw new AppError(`Invoice ${invoiceId} not found`, StatusCodes.NOT_FOUND, 'NOT_FOUND');
    }

    logger.info(`[Admin] Triggering manual sweep for invoice ${invoiceId} (${invoice.network})`);

    let sweepResult;
    if (invoice.network === CryptoNetwork.TRON) {
      sweepResult = await sweepTronInvoice(invoice);
    } else {
      sweepResult = await sweepBscInvoice(invoice);
    }

    sendSuccess(res, {
      sweepResult,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/admin/keys
 * Lists all active developer API keys.
 */
export async function getAdminApiKeys(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const keys = await ApiKey.find().sort({ createdAt: -1 }).lean();
    sendSuccess(res, { keys });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/admin/keys
 * Generates a new merchant API key (nx_live_...).
 */
export async function createAdminApiKey(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, scopes } = req.body;

    if (!name || typeof name !== 'string') {
      throw new AppError('Key name is required', StatusCodes.BAD_REQUEST, 'MISSING_NAME');
    }

    const rawSecret = crypto.randomBytes(28).toString('hex');
    const fullKey = `nx_live_${rawSecret}`;
    const keyPrefix = `${fullKey.slice(0, 14)}...${fullKey.slice(-4)}`;
    const secretHash = crypto.createHash('sha256').update(fullKey).digest('hex');
    const keyId = `key_${crypto.randomBytes(8).toString('hex')}`;

    const newKey = await ApiKey.create({
      keyId,
      name: name.trim(),
      keyPrefix,
      secretHash,
      scopes: scopes || ['invoices:create', 'invoices:read'],
      isActive: true,
      totalRequests: 0,
    });

    logger.info(`[Admin] Generated developer API key: ${keyId} (${name})`);

    sendSuccess(res, {
      key: {
        keyId: newKey.keyId,
        name: newKey.name,
        keyPrefix: newKey.keyPrefix,
        rawKey: fullKey, // Returned only ONCE
        scopes: newKey.scopes,
        createdAt: newKey.createdAt,
      },
    }, StatusCodes.CREATED);
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/v1/admin/keys/:keyId
 * Revokes / deletes an API key.
 */
export async function deleteAdminApiKey(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { keyId } = req.params;
    await ApiKey.findOneAndDelete({ keyId });
    logger.info(`[Admin] Revoked API key: ${keyId}`);

    sendSuccess(res, { message: `API key ${keyId} revoked successfully` });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/admin/config
 * Retrieves active global gateway fee rates and operational thresholds.
 */
export async function getGatewayConfig(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const config = await GatewayConfig.getActiveConfig();
    sendSuccess(res, { config });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/v1/admin/config
 * Updates dynamic percentage fee rates and thresholds, instantly syncing to database.
 */
export async function updateGatewayConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { bscFeePercent, tronFeePercent, minBscFeeUsd, minTronFeeUsd, autoSweepEnabled } = req.body;

    const config = await GatewayConfig.getActiveConfig();

    if (typeof bscFeePercent === 'number') {
      if (bscFeePercent < 0 || bscFeePercent > 50) {
        throw new AppError('bscFeePercent must be between 0% and 50%', StatusCodes.BAD_REQUEST, 'INVALID_CONFIG');
      }
      config.bscFeePercent = parseFloat(bscFeePercent.toFixed(2));
    }

    if (typeof tronFeePercent === 'number') {
      if (tronFeePercent < 0 || tronFeePercent > 50) {
        throw new AppError('tronFeePercent must be between 0% and 50%', StatusCodes.BAD_REQUEST, 'INVALID_CONFIG');
      }
      config.tronFeePercent = parseFloat(tronFeePercent.toFixed(2));
    }

    if (typeof minBscFeeUsd === 'number' && minBscFeeUsd >= 0) {
      config.minBscFeeUsd = parseFloat(minBscFeeUsd.toFixed(2));
    }

    if (typeof minTronFeeUsd === 'number' && minTronFeeUsd >= 0) {
      config.minTronFeeUsd = parseFloat(minTronFeeUsd.toFixed(2));
    }

    if (typeof autoSweepEnabled === 'boolean') {
      config.autoSweepEnabled = autoSweepEnabled;
    }

    config.updatedBy = (req as any).admin?.gateway || 'super_admin';
    await config.save();

    logger.info('[Admin] Updated gateway fee configuration:', {
      bscFeePercent: config.bscFeePercent,
      tronFeePercent: config.tronFeePercent,
      minBscFeeUsd: config.minBscFeeUsd,
      minTronFeeUsd: config.minTronFeeUsd,
    });

    sendSuccess(res, {
      message: 'Gateway fee configuration updated successfully',
      config,
    });
  } catch (err) {
    next(err);
  }
}

