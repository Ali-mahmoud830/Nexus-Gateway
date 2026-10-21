/**
 * src/server.ts
 *
 * Application entry point.
 *
 * Responsibilities:
 *   1. Validate environment (env.ts runs its checks on import)
 *   2. Connect to MongoDB (real URI in production; in-memory fallback in dev)
 *   3. Create the Express app
 *   4. Bind the HTTP server to the configured port
 *   5. Register process-level signal handlers for graceful shutdown
 *
 * Graceful shutdown sequence (SIGTERM / SIGINT):
 *   a. Stop accepting new connections (server.close)
 *   b. Disconnect from MongoDB
 *   c. Exit cleanly with code 0
 *
 * This pattern is critical in containerised deployments (Docker/Kubernetes)
 * where the orchestrator sends SIGTERM before forcibly killing the process.
 */

import http from 'http';

// env import MUST be first — validates all variables before anything else runs
import { env } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/database';
import { logger } from './utils/logger';
import { createApp } from './app';
import { initHdWallet } from './services/hdWallet';
import { startBlockchainListeners, stopBlockchainListeners } from './services/blockchain';
import { startSweeperWorker, stopSweeperWorker } from './services/sweeper';

const SHUTDOWN_TIMEOUT_MS = 10_000; // 10 s to drain in-flight requests

async function bootstrap(): Promise<void> {
  // -------------------------------------------------------------------------
  // 1. Database
  //    - Production: fail hard if DB is unreachable (never silently proceed)
  //    - Development: warn and continue so the Express stack can be verified
  //      without a running MongoDB. Routes that need the DB will return 503.
  // -------------------------------------------------------------------------
  if (env.isProduction) {
    await connectDatabase();
  } else {
    try {
      await connectDatabase();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn(
        '[Server] ⚠️  MongoDB unavailable in development — server will start anyway. ' +
          'Database-dependent routes will return 503 until MongoDB is running. ' +
          `Error: ${message}`,
      );
    }
  }

  // -------------------------------------------------------------------------
  // 2. HD Wallet Initialisation (validates mnemonic & caches master HD key)
  // -------------------------------------------------------------------------
  await initHdWallet();

  // -------------------------------------------------------------------------
  // 3. Express application
  // -------------------------------------------------------------------------
  const app = createApp();
  const server = http.createServer(app);

  // -------------------------------------------------------------------------
  // 4. Start listening
  // -------------------------------------------------------------------------
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(env.port, () => {
      logger.info(
        `[Server] 🚀 Crypto Payment Gateway running on port ${env.port} ` +
          `[${env.nodeEnv.toUpperCase()}]`,
      );
      logger.info(`[Server] API base URL → http://localhost:${env.port}/api/${env.apiVersion}`);
      logger.info(
        `[Server] Health check → http://localhost:${env.port}/api/${env.apiVersion}/health`,
      );
      resolve();
    });
  });

  // -------------------------------------------------------------------------
  // 5. Blockchain Listeners (Real-time BSC & TRON deposit detection)
  // -------------------------------------------------------------------------
  await startBlockchainListeners();

  // -------------------------------------------------------------------------
  // 6. Auto-Forwarding Sweeper (Decoupled cold-wallet sweeps)
  // -------------------------------------------------------------------------
  startSweeperWorker();

  // -------------------------------------------------------------------------
  // 7. Graceful shutdown
  // -------------------------------------------------------------------------
  let isShuttingDown = false;

  async function gracefulShutdown(signal: string): Promise<void> {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.info(`[Server] ${signal} received — starting graceful shutdown…`);

    // Force-kill if shutdown takes too long (e.g., stuck connections)
    const forceExit = setTimeout(() => {
      logger.error('[Server] Graceful shutdown timed out — forcing exit.');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    forceExit.unref(); // Don't keep the event loop alive just for the timer

    try {
      // a. Stop sweeper worker and blockchain listeners
      stopSweeperWorker();
      stopBlockchainListeners();

      // b. Stop accepting new connections; wait for existing ones to finish
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      );
      logger.info('[Server] HTTP server closed.');

      // c. Close database connection
      await disconnectDatabase();

      clearTimeout(forceExit);
      logger.info('[Server] Shutdown complete. Goodbye. 👋');
      process.exit(0);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('[Server] Error during shutdown:', { message });
      clearTimeout(forceExit);
      process.exit(1);
    }
  }

  process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => void gracefulShutdown('SIGINT'));

  // -------------------------------------------------------------------------
  // 5. Unhandled rejection / exception guards
  //    Log and exit — never silently swallow unhandled errors in production.
  // -------------------------------------------------------------------------
  process.on('unhandledRejection', (reason: unknown) => {
    logger.error('[Server] Unhandled Promise Rejection:', {
      reason: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
    });
    // In production, exit so the orchestrator can restart cleanly.
    if (env.isProduction) process.exit(1);
  });

  process.on('uncaughtException', (err: Error) => {
    logger.error('[Server] Uncaught Exception — this is a programmer error:', {
      message: err.message,
      stack: err.stack,
    });
    process.exit(1);
  });
}

// Run
bootstrap().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  // logger may not be initialised if env validation failed, so use console as fallback
  console.error('[Server] Fatal startup error:', message);
  process.exit(1);
});
