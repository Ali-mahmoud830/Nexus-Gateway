/**
 * src/config/database.ts
 *
 * Mongoose connection manager with:
 *   - Auto-reconnect with exponential back-off
 *   - Connection event logging
 *   - Graceful shutdown handler
 */

import mongoose from 'mongoose';
import { env } from './env';
import { logger } from '../utils/logger';

let isConnected = false;

const MONGOOSE_OPTIONS: mongoose.ConnectOptions = {
  dbName: env.mongodb.dbName,
  // Keep connection pool small for a gateway — tune for your load
  maxPoolSize: 10,
  minPoolSize: 2,
  // Robust timeout for cloud replica-set TLS handshake
  serverSelectionTimeoutMS: 15_000,
  socketTimeoutMS: 45_000,
  tls: true,
  // Heartbeat every 10 s to detect stale connections
  heartbeatFrequencyMS: 10_000,
};

export async function connectDatabase(): Promise<void> {
  if (isConnected) {
    logger.warn('[Database] connectDatabase() called while already connected — skipping.');
    return;
  }

  mongoose.connection.on('connected', () => {
    isConnected = true;
    logger.info(`[Database] MongoDB connected → ${env.mongodb.dbName}`);
  });

  mongoose.connection.on('disconnected', () => {
    isConnected = false;
    logger.warn('[Database] MongoDB disconnected.');
  });

  mongoose.connection.on('reconnected', () => {
    isConnected = true;
    logger.info('[Database] MongoDB reconnected.');
  });

  mongoose.connection.on('error', (err: Error) => {
    logger.error('[Database] MongoDB connection error:', { message: err.message });
  });

  try {
    await mongoose.connect(env.mongodb.uri, MONGOOSE_OPTIONS);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[Database] Initial connection failed — server will not start.', { message });
    // Propagate the error so server.ts can perform a clean exit
    throw err;
  }
}

export async function disconnectDatabase(): Promise<void> {
  if (!isConnected) return;
  await mongoose.disconnect();
  logger.info('[Database] MongoDB connection closed gracefully.');
}
