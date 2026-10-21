/**
 * src/utils/responseHelper.ts
 *
 * Standardised API response envelope.
 * Every route returns the same shape so the frontend can
 * reliably detect success vs. error without inspecting status codes alone.
 *
 * Success shape:
 *   { success: true, data: T, meta?: object }
 *
 * Error shape:
 *   { success: false, error: { code: string, message: string, details?: unknown } }
 */

import { Response } from 'express';
import { StatusCodes } from 'http-status-codes';

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode: number = StatusCodes.OK,
  meta?: Record<string, unknown>,
): void {
  const body: ApiSuccessResponse<T> = { success: true, data };
  if (meta) body.meta = meta;
  res.status(statusCode).json(body);
}

export function sendError(
  res: Response,
  message: string,
  statusCode: number = StatusCodes.INTERNAL_SERVER_ERROR,
  code: string = 'INTERNAL_ERROR',
  details?: unknown,
): void {
  const body: ApiErrorResponse = {
    success: false,
    error: { code, message, ...(details !== undefined && { details }) },
  };
  res.status(statusCode).json(body);
}
