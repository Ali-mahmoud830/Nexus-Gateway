/**
 * src/config/devDatabase.ts
 *
 * Development-only helper that spins up an in-memory MongoDB instance
 * using mongodb-memory-server when NODE_ENV=development and no real
 * MONGODB_URI is reachable.
 *
 * This file is NEVER imported in production. The production path always
 * uses the real MONGODB_URI from connectDatabase() in database.ts.
 *
 * Usage: imported conditionally in server.ts only when NODE_ENV=development.
 */

import { MongoMemoryServer } from 'mongodb-memory-server';
import { logger } from '../utils/logger';

let mongod: MongoMemoryServer | null = null;

/**
 * Starts an in-memory MongoDB server and returns its connection URI.
 * The binary is cached after first download (~40 MB, one-time cost).
 */
export async function startDevMemoryMongo(): Promise<string> {
  logger.warn(
    '[DevDB] ⚠️  Starting in-memory MongoDB (development only). ' +
      'Data will NOT persist between restarts. ' +
      'Set a real MONGODB_URI in .env to use a persistent database.',
  );

  mongod = await MongoMemoryServer.create({
    instance: {
      port: 27017,   // Use standard port so the URI in .env stays valid
      dbName: 'crypto_gateway',
    },
  });

  const uri = mongod.getUri();
  logger.info(`[DevDB] In-memory MongoDB running at: ${uri}`);
  return uri;
}

/**
 * Stops the in-memory server gracefully (called during shutdown).
 */
export async function stopDevMemoryMongo(): Promise<void> {
  if (mongod) {
    await mongod.stop();
    mongod = null;
    logger.info('[DevDB] In-memory MongoDB stopped.');
  }
}
