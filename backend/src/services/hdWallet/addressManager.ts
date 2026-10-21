/**
 * src/services/hdWallet/addressManager.ts
 *
 * High-Level Address Derivation Manager
 *
 * Responsibilities:
 *   1. Atomically obtain a unique, monotonic derivation index via Counter model
 *      (thread-safe, cluster-safe, prevents address collision under concurrent load).
 *   2. Route to the appropriate chain deriver (BSC or TRON).
 *   3. Enforce defense-in-depth: check database to guarantee address has never been used.
 *   4. Export `generateDepositAddress(network)` for invoice creation.
 *   5. Export `deriveChildPrivateKey(network, index)` for the Phase 5 sweeper worker.
 */

import { Counter } from '../../models/Counter';
import { Invoice, CryptoNetwork } from '../../models/Invoice';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { deriveBscAddress, deriveBscPrivateKey } from './bscDeriver';
import { deriveTronAddress, deriveTronPrivateKey } from './tronDeriver';
import { DerivedAddress, DerivedChildKey } from './types';

// Maximum retry attempts if an address collision is detected in database
const MAX_COLLISION_RETRIES = 3;

/**
 * Generates a brand-new, unique temporary deposit address for the specified network.
 * Atomically increments the sequence counter so no two invoices share the same address.
 *
 * @param network - CryptoNetwork.BSC or CryptoNetwork.TRON
 * @returns Promise<DerivedAddress> with public address, derivationIndex, and network
 */
export async function generateDepositAddress(network: CryptoNetwork): Promise<DerivedAddress> {
  const counterKey = `derivation_index_${network.toLowerCase()}`;
  let attempts = 0;

  while (attempts < MAX_COLLISION_RETRIES) {
    attempts++;

    // 1. Atomically acquire the next derivation index
    const derivationIndex = await Counter.getNextSequence(
      counterKey,
      env.hd.addressCounterOffset,
    );

    // 2. Derive public address based on network
    let derived: DerivedAddress;
    switch (network) {
      case CryptoNetwork.BSC:
        derived = deriveBscAddress(derivationIndex);
        break;

      case CryptoNetwork.TRON:
        derived = deriveTronAddress(derivationIndex);
        break;

      default:
        throw new Error(`[AddressManager] Unsupported cryptocurrency network: ${String(network)}`);
    }

    // 3. Defense-in-depth: Verify this address has never been used in the database
    const existing = await Invoice.findOne({
      depositAddress: derived.address,
      network: derived.network,
    }).lean();

    if (!existing) {
      logger.info('[AddressManager] Generated unique deposit address', {
        network: derived.network,
        address: derived.address,
        derivationIndex: derived.derivationIndex,
      });
      return derived;
    }

    // Unlikely collision / offset overlap detected — log warning and retry next index
    logger.warn('[AddressManager] Collision detected for derived address — advancing counter', {
      network,
      address: derived.address,
      derivationIndex,
      attempt: attempts,
    });
  }

  throw new Error(
    `[AddressManager] Failed to generate a unique deposit address for ${network} after ${MAX_COLLISION_RETRIES} attempts. ` +
      'Check HD_ADDRESS_COUNTER_OFFSET in your .env configuration.',
  );
}

/**
 * Derives the child private key for a given network and derivation index.
 *
 * SECURITY NOTICE:
 *   - Only callable by internal workers (Phase 5 auto-sweeper).
 *   - The returned private key exists strictly in ephemeral memory.
 *   - Never log or return this value to API clients.
 *
 * @param network         - CryptoNetwork.BSC or CryptoNetwork.TRON
 * @param derivationIndex - The index saved on the confirmed Invoice document
 * @returns DerivedChildKey containing privateKeyHex and verified address
 */
export function deriveChildPrivateKey(
  network: CryptoNetwork,
  derivationIndex: number,
): DerivedChildKey {
  switch (network) {
    case CryptoNetwork.BSC:
      return deriveBscPrivateKey(derivationIndex);

    case CryptoNetwork.TRON:
      return deriveTronPrivateKey(derivationIndex);

    default:
      throw new Error(
        `[AddressManager] Cannot derive private key for unsupported network: ${String(network)}`,
      );
  }
}
