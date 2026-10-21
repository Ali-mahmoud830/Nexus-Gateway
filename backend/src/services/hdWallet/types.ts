/**
 * src/services/hdWallet/types.ts
 *
 * Shared TypeScript interfaces and types for the HD Wallet subsystem.
 * Kept in a separate file so consumers import types without pulling in
 * any cryptographic dependencies.
 */

import { CryptoNetwork } from '../../models/Invoice';

// ---------------------------------------------------------------------------
// Address derivation result — returned to invoice creation logic
// ---------------------------------------------------------------------------

export interface DerivedAddress {
  /** The derived public deposit address string (EVM checksum or TRON Base58Check) */
  address: string;
  /** BIP-44 child index used — stored on the Invoice for later private-key re-derivation */
  derivationIndex: number;
  /** Which network this address was derived for */
  network: CryptoNetwork;
}

// ---------------------------------------------------------------------------
// Private key derivation result — used ONLY inside the sweeper worker
// NEVER stored, never logged, never returned over the network
// ---------------------------------------------------------------------------

export interface DerivedChildKey {
  /** Hex-encoded private key (no 0x prefix) */
  privateKeyHex: string;
  /** Corresponding public deposit address — used to verify before signing */
  address: string;
  network: CryptoNetwork;
  derivationIndex: number;
}

// ---------------------------------------------------------------------------
// Internal raw BIP-32 child node — passed between deriver modules
// ---------------------------------------------------------------------------

export interface RawChildNode {
  /** Compressed 33-byte public key as Buffer */
  publicKeyBuffer: Buffer;
  /** 32-byte private key as Buffer (null if hardened derivation without xprv) */
  privateKeyBuffer: Buffer | null;
  derivationIndex: number;
}
