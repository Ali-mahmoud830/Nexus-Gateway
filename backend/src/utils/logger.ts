/**
 * src/utils/logger.ts
 *
 * Production-grade structured logger built on Winston.
 *
 * Features:
 *   - JSON format in production (machine-parseable by log aggregators)
 *   - Pretty colorised format in development
 *   - Daily rotating log files with automatic compression
 *   - Separate error log file
 *   - Request-ID context support (added in Phase 4)
 *
 * Security note:
 *   Never log sensitive fields (mnemonic, private keys, JWT secrets).
 *   Add a redaction list below if you add more sensitive fields.
 */

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import { env } from '../config/env';

// Fields that must NEVER appear in log output
const SENSITIVE_KEYS = new Set([
  'mnemonic',
  'privateKey',
  'private_key',
  'jwtSecret',
  'jwt_secret',
  'password',
  'seed',
]);

/**
 * Recursively redacts sensitive keys from an object before it is serialised.
 */
function redactSensitive(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(redactSensitive);
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    result[key] = SENSITIVE_KEYS.has(key) ? '[REDACTED]' : redactSensitive(value);
  }
  return result;
}

const redactFormat = winston.format((info) => {
  const redacted = redactSensitive(info) as winston.Logform.TransformableInfo;
  return redacted;
});

// ---------------------------------------------------------------------------
// Transports
// ---------------------------------------------------------------------------

const logDir = path.resolve(env.logging.dir);

const consoleTransport = new winston.transports.Console({
  format:
    env.isProduction
      ? winston.format.combine(
          winston.format.timestamp(),
          redactFormat(),
          winston.format.json(),
        )
      : winston.format.combine(
          winston.format.colorize({ all: true }),
          winston.format.timestamp({ format: 'HH:mm:ss' }),
          redactFormat(),
          winston.format.printf(({ timestamp, level, message, ...meta }) => {
            const metaStr = Object.keys(meta).length
              ? `\n  ${JSON.stringify(meta, null, 2)}`
              : '';
            return `[${timestamp as string}] ${level}: ${message as string}${metaStr}`;
          }),
        ),
});

const dailyRotateTransport = new DailyRotateFile({
  dirname: logDir,
  filename: 'gateway-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '30d',
  format: winston.format.combine(
    winston.format.timestamp(),
    redactFormat(),
    winston.format.json(),
  ),
});

const errorRotateTransport = new DailyRotateFile({
  dirname: logDir,
  filename: 'gateway-error-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '30d',
  level: 'error',
  format: winston.format.combine(
    winston.format.timestamp(),
    redactFormat(),
    winston.format.json(),
  ),
});

// ---------------------------------------------------------------------------
// Logger instance
// ---------------------------------------------------------------------------

export const logger = winston.createLogger({
  level: env.logging.level,
  transports: [consoleTransport, dailyRotateTransport, errorRotateTransport],
  // Prevent winston from crashing the process on unhandled exceptions.
  // We handle those in server.ts instead.
  exitOnError: false,
});

logger.info('[Logger] Initialised.', { level: env.logging.level, logDir });
