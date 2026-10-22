/**
 * src/api/middlewares/rateLimiter.ts
 *
 * Rate-limiting middleware using express-rate-limit.
 *
 * Two tiers:
 *   - globalLimiter   : Broad protection across all routes (300 req / 15 min)
 *   - invoiceLimiter  : Tighter limit on invoice creation (10 req / 15 min)
 *                       Prevents address exhaustion attacks that would drain
 *                       your HD wallet index space.
 *
 * Security note:
 *   In production behind a reverse proxy (Nginx, Cloudflare), set
 *   app.set('trust proxy', 1) in app.ts so req.ip resolves to the real
 *   client IP rather than the proxy's internal address.
 */

import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import { StatusCodes } from 'http-status-codes';
import { env } from '../../config/env';

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export const globalLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: WINDOW_MS,
  max: 10000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many requests. Please slow down and try again later.',
    },
  },
  statusCode: StatusCodes.TOO_MANY_REQUESTS,
  skip: (req) =>
    env.nodeEnv === 'test' ||
    req.path.includes('/health') ||
    (req.method === 'GET' && req.path.includes('/invoices/')),
});

export const invoiceLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: WINDOW_MS,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Invoice creation limit reached. Please wait before creating another invoice.',
    },
  },
  statusCode: StatusCodes.TOO_MANY_REQUESTS,
  skip: () => env.nodeEnv === 'test',
});
