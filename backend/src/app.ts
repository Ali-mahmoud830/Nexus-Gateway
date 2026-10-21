/**
 * src/app.ts
 *
 * Express application factory.
 *
 * Separation from server.ts means:
 *   1. Testing can import the app without binding to a port.
 *   2. The HTTP server lifecycle (start / shutdown) stays in server.ts.
 *
 * Middleware stack order (matters for security and correctness):
 *   1. requestId       — stamp every request first so all subsequent logs carry the ID
 *   2. helmet          — set security headers before any content is sent
 *   3. compression     — compress responses
 *   4. cors            — handle CORS before rate limiting to allow preflight through
 *   5. globalLimiter   — block abusive clients early
 *   6. morgan          — access logging (after rate limiting to avoid logging floods)
 *   7. express.json    — parse request bodies
 *   8. Routes          — business logic
 *   9. 404 handler     — catch unmatched routes
 *  10. globalErrorHandler — catch all thrown errors
 */

import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { StatusCodes } from 'http-status-codes';

import { env } from './config/env';
import { logger } from './utils/logger';
import { requestIdMiddleware } from './api/middlewares/requestId';
import { globalLimiter } from './api/middlewares/rateLimiter';
import { globalErrorHandler } from './api/middlewares/errorHandler';
import { sendError } from './utils/responseHelper';
import apiRouter from './api/routes/index';

export function createApp(): Application {
  const app = express();

  // -------------------------------------------------------------------------
  // Trust proxy — enable when running behind Nginx / Cloudflare in production
  // so req.ip returns the real client IP for rate limiting.
  // -------------------------------------------------------------------------
  if (env.isProduction) {
    app.set('trust proxy', 1);
  }

  // -------------------------------------------------------------------------
  // 1. Request ID
  // -------------------------------------------------------------------------
  app.use(requestIdMiddleware);

  // -------------------------------------------------------------------------
  // 2. Security headers (Helmet)
  //    Disables X-Powered-By, sets CSP, HSTS, XSS protection, etc.
  // -------------------------------------------------------------------------
  app.use(
    helmet({
      contentSecurityPolicy: env.isProduction,
      hsts: env.isProduction ? { maxAge: 31_536_000, includeSubDomains: true } : false,
    }),
  );

  // -------------------------------------------------------------------------
  // 3. Compression
  // -------------------------------------------------------------------------
  app.use(compression());

  // -------------------------------------------------------------------------
  // 4. CORS
  // -------------------------------------------------------------------------
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (e.g., server-to-server, curl)
        if (!origin) return callback(null, true);
        if (env.cors.allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        logger.warn('[CORS] Blocked request from disallowed origin.', { origin });
        return callback(new Error(`CORS policy violation: origin "${origin}" is not allowed.`));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
      exposedHeaders: ['X-Request-ID'],
    }),
  );

  // -------------------------------------------------------------------------
  // 5. Global rate limiter
  // -------------------------------------------------------------------------
  app.use(globalLimiter);

  // -------------------------------------------------------------------------
  // 6. HTTP access logging (morgan → winston)
  // -------------------------------------------------------------------------
  app.use(
    morgan('combined', {
      stream: {
        write: (message: string) => logger.http(message.trim()),
      },
      // Skip logging health checks to reduce noise
      skip: (req) => req.path === `/${env.apiVersion}/health`,
    }),
  );

  // -------------------------------------------------------------------------
  // 7. Body parsers
  //    Limit body size to 10kb — gateway requests carry no file uploads.
  // -------------------------------------------------------------------------
  app.use(express.json({ limit: '10kb' }));
  app.use(express.urlencoded({ extended: true, limit: '10kb' }));

  // -------------------------------------------------------------------------
  // 8. API routes
  // -------------------------------------------------------------------------
  app.use(`/api/${env.apiVersion}`, apiRouter);

  // -------------------------------------------------------------------------
  // 9. 404 handler — must come after all valid routes
  // -------------------------------------------------------------------------
  app.use((req: Request, res: Response, _next: NextFunction) => {
    logger.warn('[App] Route not found.', { method: req.method, path: req.path });
    sendError(
      res,
      `Route ${req.method} ${req.path} not found.`,
      StatusCodes.NOT_FOUND,
      'ROUTE_NOT_FOUND',
    );
  });

  // -------------------------------------------------------------------------
  // 10. Global error handler — must be the LAST middleware registered
  // -------------------------------------------------------------------------
  app.use(globalErrorHandler);

  return app;
}
