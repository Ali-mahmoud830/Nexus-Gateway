/**
 * src/api/middlewares/apiKeyAuth.ts
 *
 * Middleware to authenticate and validate merchant developer API keys (nx_live_...).
 * Supports both required and optional authentication modes.
 */

import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import crypto from 'crypto';
import { ApiKey } from '../../models/ApiKey';
import { AppError } from './errorHandler';
import { logger } from '../../utils/logger';

/**
 * Extracts and verifies the API key if provided in 'x-api-key' or 'Authorization: Bearer nx_live_...'.
 * Updates lastUsedAt and totalRequests in real-time.
 */
export async function validateApiKey(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const headerKey = req.headers['x-api-key'] as string | undefined;
  const authHeader = req.headers['authorization'];

  let rawKey: string | null = null;
  if (headerKey && typeof headerKey === 'string') {
    rawKey = headerKey.trim();
  } else if (authHeader && authHeader.startsWith('Bearer nx_live_')) {
    rawKey = authHeader.replace('Bearer ', '').trim();
  }

  if (!rawKey) {
    // If no key provided, allow proceeding (for public checkout UI compatibility)
    return next();
  }

  try {
    const secretHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const keyDoc = await ApiKey.findOne({ secretHash, isActive: true });

    if (!keyDoc) {
      logger.warn('[ApiKeyAuth] Invalid or inactive API key rejected');
      throw new AppError('Invalid or inactive API key', StatusCodes.UNAUTHORIZED, 'INVALID_API_KEY');
    }

    // Update telemetry asynchronously
    keyDoc.totalRequests = (keyDoc.totalRequests || 0) + 1;
    keyDoc.lastUsedAt = new Date();
    keyDoc.save().catch((e) => logger.warn('[ApiKeyAuth] Failed to update key telemetry:', e));

    (req as any).merchantApiKey = keyDoc;
    next();
  } catch (err) {
    next(err);
  }
}
