/**
 * src/api/middlewares/errorHandler.ts
 *
 * Global Express error-handling middleware (must have 4 parameters).
 *
 * Catches:
 *   - Explicitly thrown AppError instances (structured errors with HTTP codes)
 *   - Express body-parser / JSON parse errors
 *   - Unknown/unexpected errors (returns a safe generic message in production)
 *
 * Security note:
 *   In production, internal error details are suppressed and only logged
 *   server-side. The client receives a generic message so stack traces
 *   and internal paths are never leaked.
 */

import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { logger } from '../../utils/logger';
import { sendError } from '../../utils/responseHelper';
import { env } from '../../config/env';

// ---------------------------------------------------------------------------
// AppError — throw this anywhere in the codebase for structured HTTP errors
// ---------------------------------------------------------------------------

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = StatusCodes.INTERNAL_SERVER_ERROR,
    code: string = 'INTERNAL_ERROR',
    details?: unknown,
    isOperational: boolean = true,
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

// ---------------------------------------------------------------------------
// Global error handler
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function globalErrorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const requestId = res.locals['requestId'] as string | undefined;

  // --- Structured operational errors ---
  if (err instanceof AppError) {
    logger.warn('[ErrorHandler] Operational error', {
      requestId,
      code: err.code,
      message: err.message,
      statusCode: err.statusCode,
      path: req.path,
    });

    sendError(
      res,
      err.message,
      err.statusCode,
      err.code,
      env.isDevelopment ? err.details : undefined,
    );
    return;
  }

  // --- JSON / body-parser syntax errors ---
  if (err instanceof SyntaxError && 'body' in err) {
    logger.warn('[ErrorHandler] Malformed JSON body', { requestId, path: req.path });
    sendError(res, 'Invalid JSON in request body.', StatusCodes.BAD_REQUEST, 'MALFORMED_JSON');
    return;
  }

  // --- Unknown / programmer errors ---
  logger.error('[ErrorHandler] Unexpected error', {
    requestId,
    name: err.name,
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  sendError(
    res,
    env.isProduction
      ? 'An unexpected error occurred. Please try again later.'
      : err.message,
    StatusCodes.INTERNAL_SERVER_ERROR,
    'INTERNAL_ERROR',
    env.isDevelopment ? err.stack : undefined,
  );
}
