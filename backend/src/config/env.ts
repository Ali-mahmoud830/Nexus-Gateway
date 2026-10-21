/**
 * src/config/env.ts
 *
 * Single source of truth for all environment configuration.
 * Validates every required variable at process startup so the server
 * refuses to boot — rather than silently failing mid-request — if
 * anything is misconfigured.
 *
 * Security note:
 *   HD_MNEMONIC is read once here and never exported as a raw string.
 *   All downstream code must import `env` and access `env.hd.mnemonic`.
 *   In production, replace the dotenv read with a call to your secrets
 *   manager (AWS Secrets Manager, Vault, GCP Secret Manager, etc.)
 *   and delete the HD_MNEMONIC line from .env entirely.
 */

import dotenv from 'dotenv';
import path from 'path';

// Load .env from the project root (backend/)
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Reads a required environment variable.
 * Throws at startup if the variable is missing or empty.
 */
function requireEnv(key: keyof NodeJS.ProcessEnv): string {
  const value = process.env[key];
  if (value === undefined || value.trim() === '') {
    throw new Error(
      `[Config] Missing required environment variable: "${key}". ` +
        `Check your .env file or secrets provider.`,
    );
  }
  return value.trim();
}

/**
 * Reads an optional environment variable with a fallback default.
 */
function optionalEnv(key: keyof NodeJS.ProcessEnv, defaultValue: string): string {
  const value = process.env[key];
  return value && value.trim() !== '' ? value.trim() : defaultValue;
}

/**
 * Reads a numeric environment variable, throwing if it is not a valid number.
 */
function requireEnvInt(key: keyof NodeJS.ProcessEnv): number {
  const raw = requireEnv(key);
  const parsed = parseInt(raw, 10);
  if (isNaN(parsed)) {
    throw new Error(
      `[Config] Environment variable "${key}" must be an integer, got: "${raw}"`,
    );
  }
  return parsed;
}

// ---------------------------------------------------------------------------
// Validated configuration object
// ---------------------------------------------------------------------------

export const env = {
  nodeEnv: requireEnv('NODE_ENV') as 'development' | 'production' | 'test',
  port: parseInt(optionalEnv('PORT', '4000'), 10),
  apiVersion: optionalEnv('API_VERSION', 'v1'),

  cors: {
    allowedOrigins: requireEnv('ALLOWED_ORIGINS')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  },

  mongodb: {
    uri: requireEnv('MONGODB_URI'),
    dbName: requireEnv('MONGODB_DB_NAME'),
  },

  jwt: {
    secret: requireEnv('JWT_SECRET'),
    expiresIn: optionalEnv('JWT_EXPIRES_IN', '1h'),
  },

  hd: {
    /**
     * The mnemonic is intentionally kept inside this nested object
     * and is never re-exported as a top-level string to reduce the
     * surface area where it can accidentally be logged or serialised.
     */
    mnemonic: requireEnv('HD_MNEMONIC'),
    bscDerivationPath: optionalEnv('BSC_DERIVATION_PATH', "m/44'/60'/0'/0"),
    tronDerivationPath: optionalEnv('TRON_DERIVATION_PATH', "m/44'/195'/0'/0"),
    addressCounterOffset: parseInt(optionalEnv('HD_ADDRESS_COUNTER_OFFSET', '0'), 10),
  },

  wallets: {
    bscMainWallet: requireEnv('BSC_MAIN_WALLET'),
    tronMainWallet: requireEnv('TRON_MAIN_WALLET'),
  },

  bsc: {
    rpcUrls: [
      requireEnv('BSC_RPC_PRIMARY'),
      requireEnv('BSC_RPC_SECONDARY'),
      requireEnv('BSC_RPC_TERTIARY'),
    ],
    usdtContract: requireEnv('BSC_USDT_CONTRACT'),
    confirmationsRequired: requireEnvInt('BSC_CONFIRMATIONS_REQUIRED'),
  },

  tron: {
    fullNode: requireEnv('TRON_FULL_NODE'),
    solidityNode: requireEnv('TRON_SOLIDITY_NODE'),
    eventServer: requireEnv('TRON_EVENT_SERVER'),
    apiKey: requireEnv('TRON_API_KEY'),
    usdtContract: requireEnv('TRON_USDT_CONTRACT'),
    confirmationsRequired: requireEnvInt('TRON_CONFIRMATIONS_REQUIRED'),
  },

  invoice: {
    expiryMinutes: requireEnvInt('INVOICE_EXPIRY_MINUTES'),
  },

  sweeper: {
    cronIntervalSeconds: parseInt(optionalEnv('SWEEPER_CRON_INTERVAL_SECONDS', '30'), 10),
    minAmountUsd: parseFloat(optionalEnv('SWEEPER_MIN_AMOUNT_USD', '1')),
    gasStationBscPrivateKey: optionalEnv('GAS_STATION_BSC_PRIVATE_KEY', ''),
    gasStationTronPrivateKey: optionalEnv('GAS_STATION_TRON_PRIVATE_KEY', ''),
  },

  logging: {
    level: optionalEnv('LOG_LEVEL', 'info'),
    dir: optionalEnv('LOG_DIR', './logs'),
  },

  get isDevelopment(): boolean {
    return this.nodeEnv === 'development';
  },

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  },
} as const;

export type Env = typeof env;
