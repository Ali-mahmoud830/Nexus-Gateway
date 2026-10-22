/**
 * src/api/middlewares/adminAuth.ts
 *
 * Middleware to protect admin routes using JWT Bearer authentication.
 */

import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { AppError } from './errorHandler';

export interface AdminJwtPayload {
  role: string;
  gateway: string;
}

export function requireAdminAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError('Admin authentication required', StatusCodes.UNAUTHORIZED, 'AUTH_REQUIRED');
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, env.jwt.secret) as AdminJwtPayload;
    if (decoded.role !== 'super_admin') {
      throw new AppError('Forbidden: Insufficient privileges', StatusCodes.FORBIDDEN, 'FORBIDDEN');
    }
    (req as any).admin = decoded;
    next();
  } catch (err) {
    throw new AppError('Invalid or expired admin session token', StatusCodes.UNAUTHORIZED, 'INVALID_TOKEN');
  }
}
