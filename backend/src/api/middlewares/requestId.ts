/**
 * src/api/middlewares/requestId.ts
 *
 * Attaches a unique UUID v4 to every incoming request.
 * The ID is:
 *   1. Stored on res.locals.requestId for use in downstream handlers.
 *   2. Echoed back in the X-Request-ID response header so clients
 *      can correlate their requests with server-side logs.
 */

import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = (req.headers['x-request-id'] as string | undefined) ?? uuidv4();
  res.locals['requestId'] = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
}
