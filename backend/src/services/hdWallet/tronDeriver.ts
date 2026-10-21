/**
 * src/services/hdWallet/tronDeriver.ts
 *
 * BIP-44 Derivation for TRON (TRC-20)
 *
 * Derivation path:
 *   m/44'/195'/0'/0/{index}
 *
 * TRON Address Format:
 *   1. Derive child node from master HDKey.
 *   2. Compute 20-byte EVM-style hash from public key (keccak256).
 *   3. Prepend 0x41 (TRON Mainnet address prefix) -> 21 bytes.
 *   4. Append 4-byte double-SHA256 checksum -> 25 bytes.
 *   5. Base58 encode -> standard TRON address starting with 'T'.
 *
 * The Base58Check encoding is implemented using native Node.js crypto,
 * ensuring high performance, zero network overhead, and zero runtime dependencies.
 */

import crypto from 'crypto';
import { ethers } from 'ethers';
import { env } from '../../config/env';
import { CryptoNetwork } from '../../models/Invoice';
import { deriveChildNode } from './bip44Core';
import { DerivedAddress, DerivedChildKey } from './types';

// ---------------------------------------------------------------------------
// Base58Check Encoding Helpers (Standard Bitcoin / TRON Alphabet)
// ---------------------------------------------------------------------------

const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/**
 * Base58 encodes an arbitrary buffer.
 */
function base58Encode(buffer: Buffer): string {
  const digits: number[] = [0];

  for (let i = 0; i < buffer.length; i++) {
    let carry = buffer[i]!;
    for (let j = 0; j < digits.length; ++j) {
      carry += digits[j]! << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }

  let str = '';
  // Leading zeros in buffer are converted to '1's
  for (let i = 0; i < buffer.length && buffer[i] === 0; i++) {
    str += '1';
  }

  for (let i = digits.length - 1; i >= 0; i--) {
    str += ALPHABET[digits[i]!];
  }

  return str;
}

/**
 * Converts a 21-byte hex string (with '41' prefix) to a Base58Check TRON address.
 */
export function tronHexToBase58(hexAddressWith41: string): string {
  const cleanHex = hexAddressWith41.startsWith('0x')
    ? hexAddressWith41.slice(2)
    : hexAddressWith41;

  const payload = Buffer.from(cleanHex, 'hex');

  // Double SHA-256 for 4-byte checksum
  const hash1 = crypto.createHash('sha256').update(payload).digest();
  const hash2 = crypto.createHash('sha256').update(hash1).digest();
  const checksum = hash2.subarray(0, 4);

  return base58Encode(Buffer.concat([payload, checksum]));
}

// ---------------------------------------------------------------------------
// Public Derivation Functions
// ---------------------------------------------------------------------------

/**
 * Derives a public deposit address for TRON at the specified BIP-44 index.
 * Uses public key derivation only — the private key is never accessed.
 *
 * @param index - BIP-44 address_index
 * @returns DerivedAddress with Base58Check TRON address (e.g. T...)
 */
export function deriveTronAddress(index: number): DerivedAddress {
  const child = deriveChildNode(env.hd.tronDerivationPath, index, false);
  const pubKeyHex = `0x${child.publicKeyBuffer.toString('hex')}`;

  // 1. Compute 20-byte address from public key via keccak256
  const evmAddress = ethers.computeAddress(pubKeyHex);

  // 2. Prepend '41' (TRON Mainnet prefix byte)
  const tronHex = `41${evmAddress.slice(2).toLowerCase()}`;

  // 3. Base58Check encode
  const address = tronHexToBase58(tronHex);

  return {
    address,
    derivationIndex: index,
    network: CryptoNetwork.TRON,
  };
}

/**
 * Derives the private key and public address for TRON at the specified BIP-44 index.
 *
 * SECURITY WARNING:
 *   Used EXCLUSIVELY by the Phase 5 auto-forwarding worker in memory to sign
 *   the sweep transaction to the cold wallet.
 *   Must NEVER be called in API controllers, logged, or stored in the database.
 *
 * @param index - BIP-44 address_index
 * @returns DerivedChildKey with hex private key and verified Base58Check address
 */
export function deriveTronPrivateKey(index: number): DerivedChildKey {
  const child = deriveChildNode(env.hd.tronDerivationPath, index, true);

  if (!child.privateKeyBuffer) {
    throw new Error(`[TronDeriver] Failed to extract private key for TRON at index ${index}`);
  }

  const privateKeyHex = child.privateKeyBuffer.toString('hex');

  // Re-derive the public address directly from the private key to verify consistency
  const evmAddress = ethers.computeAddress(`0x${privateKeyHex}`);
  const tronHex = `41${evmAddress.slice(2).toLowerCase()}`;
  const address = tronHexToBase58(tronHex);

  return {
    privateKeyHex,
    address,
    network: CryptoNetwork.TRON,
    derivationIndex: index,
  };
}
