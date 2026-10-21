/**
 * src/api/routes/health.ts
 *
 * Health-check endpoint — used by load balancers, Docker HEALTHCHECK,
 * and uptime monitors to verify the service is alive.
 *
 * GET /api/v1/health
 *   Returns 200 with uptime, memory usage, and MongoDB status.
 *
 * This route intentionally does NOT require authentication so that
 * infrastructure probes can reach it without credentials.
 */

import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { sendSuccess } from '../../utils/responseHelper';
import { getBlockchainTelemetry } from '../../services/blockchain';
import { getSweeperTelemetry } from '../../services/sweeper';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  const mongoState = mongoose.connection.readyState;

  // Mongoose readyState: 0=disconnected 1=connected 2=connecting 3=disconnecting
  const mongoStatus =
    mongoState === 1 ? 'connected' : mongoState === 2 ? 'connecting' : 'disconnected';

  const memoryUsage = process.memoryUsage();

  let blockchainTelemetry = null;
  let sweeperTelemetry = null;
  try {
    [blockchainTelemetry, sweeperTelemetry] = await Promise.all([
      getBlockchainTelemetry(),
      getSweeperTelemetry(),
    ]);
  } catch {
    // Ignore error if services are still booting
  }

  sendSuccess(res, {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    mongodb: mongoStatus,
    blockchain: blockchainTelemetry,
    sweeper: sweeperTelemetry,
    memory: {
      heapUsedMB: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      rssMB: Math.round(memoryUsage.rss / 1024 / 1024),
    },
  });
});

export default router;
