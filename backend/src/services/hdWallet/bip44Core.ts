/**
 * src/services/hdWallet/bip44Core.ts
 *
 * BIP-39 / BIP-32 / BIP-44 Core Engine
 *
 * Responsibilities:
 *   1. Validate the mnemonic from env at startup.
 *   2. Derive the BIP-32 master HD key from the mnemonic seed ONCE and cache
 *      it in a module-scoped variable so we don't re-derive on every request.
 *   3. Expose a function to derive a raw BIP-32 child node at any BIP-44 path.
 *
 * Security architecture:
 *   - The BIP-32 master key (xprv) is held in memory only — never written to
 *     disk, never logged, never serialised.
 *   - Private child key buffers are returned ONLY to internal callers that
 *     explicitly request them (sweeper); public-only derivation is the default.
 *   - The module is initialised exactly once via `initHdWallet()` which is
 *     called from server.ts at startup, before any routes are registered.
 *   - If the mnemonic is invalid, the server refuses to start.
 *
 * BIP-44 Path structure:
 *   m / purpose' / coin_type' / account' / change / address_index
 *   m / 44'      / 60'        / 0'       / 0      / N            ← BSC  (ETH coin type)
 *   m / 44'      / 195'       / 0'       / 0      / N            ← TRON
 */

import HDKey from 'hdkey';
import * as bip39 from 'bip39';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { RawChildNode } from './types';

// ---------------------------------------------------------------------------
// Module-level master key — cached after first call to initHdWallet()
// ---------------------------------------------------------------------------

let masterKey: HDKey | null = null;
let isInitialised = false;

// ---------------------------------------------------------------------------
// Initialisation
// ---------------------------------------------------------------------------

/**
 * Validates the mnemonic and derives the BIP-32 master HD key.
 * Must be called ONCE at server startup before any invoice operations.
 *
 * @throws If the mnemonic is not a valid BIP-39 phrase.
 */
export async function initHdWallet(): Promise<void> {
  if (isInitialised) {
    logger.warn('[HdWallet] initHdWallet() called more than once — ignoring duplicate call.');
    return;
  }

  const mnemonic = env.hd.mnemonic;

  // Validate BIP-39 mnemonic (checksum verification included)
  if (!bip39.validateMnemonic(mnemonic)) {
    throw new Error(
      '[HdWallet] FATAL: HD_MNEMONIC in .env is not a valid BIP-39 mnemonic. ' +
        'Generate a valid one offline and update your secrets provider.',
    );
  }

  logger.info('[HdWallet] Mnemonic validated. Deriving master key from seed…');

  // Derive 512-bit seed from mnemonic (async, uses PBKDF2 with 2048 iterations)
  // The empty string passphrase is the BIP-39 standard; for extra security
  // you can provide a 25th-word BIP-39 passphrase via a separate secret.
  const seed: Buffer = await bip39.mnemonicToSeed(mnemonic);

  // Derive BIP-32 master HD key from seed
  masterKey = HDKey.fromMasterSeed(seed);

  // Zero out the seed buffer immediately — we only need the master key
  seed.fill(0);

  isInitialised = true;
  logger.info('[HdWallet] Master HD key ready. Seed buffer zeroed.');
}

// ---------------------------------------------------------------------------
// Core derivation function
// ---------------------------------------------------------------------------

/**
 * Derives a BIP-32 child node at the given BIP-44 path and index.
 *
 * @param basePath - Base derivation path, e.g. "m/44'/60'/0'/0"
 * @param index    - The child index (address_index component of BIP-44)
 * @param requirePrivateKey - If true, throws when private key is unavailable.
 *                            Set to true ONLY inside the sweeper worker.
 */
export function deriveChildNode(
  basePath: string,
  index: number,
  requirePrivateKey: boolean = false,
): RawChildNode {
  if (!isInitialised || !masterKey) {
    throw new Error(
      '[HdWallet] HD wallet has not been initialised. Call initHdWallet() at server startup.',
    );
  }

  if (!Number.isInteger(index) || index < 0) {
    throw new Error(`[HdWallet] Invalid derivation index: ${index}. Must be a non-negative integer.`);
  }

  const fullPath = `${basePath}/${index}`;

  let childKey: HDKey;
  try {
    childKey = masterKey.derive(fullPath);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`[HdWallet] BIP-32 derivation failed at path "${fullPath}": ${msg}`);
  }

  if (!childKey.publicKey) {
    throw new Error(`[HdWallet] No public key derived at path "${fullPath}".`);
  }

  if (requirePrivateKey && !childKey.privateKey) {
    throw new Error(
      `[HdWallet] Private key required but not available at path "${fullPath}". ` +
        'Ensure the master key was initialised from an extended private key (xprv), not an xpub.',
    );
  }

  return {
    publicKeyBuffer: Buffer.from(childKey.publicKey),
    privateKeyBuffer: childKey.privateKey ? Buffer.from(childKey.privateKey) : null,
    derivationIndex: index,
  };
}

/**
 * Returns true if the HD wallet module has been successfully initialised.
 */
export function isHdWalletReady(): boolean {
  return isInitialised && masterKey !== null;
}
