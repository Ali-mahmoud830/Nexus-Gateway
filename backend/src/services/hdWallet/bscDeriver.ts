/**
 * src/services/hdWallet/bscDeriver.ts
 *
 * BIP-44 Derivation for BNB Smart Chain (BSC / BEP-20)
 *
 * Derivation path:
 *   m/44'/60'/0'/0/{index}
 *
 * Follows EIP-55 checksummed EVM address format:
 *   1. Derive child node from master HDKey.
 *   2. Compute 20-byte address from compressed/uncompressed public key.
 *   3. Format with EIP-55 mixed-case checksum via ethers.computeAddress.
 */

import { ethers } from 'ethers';
import { env } from '../../config/env';
import { CryptoNetwork } from '../../models/Invoice';
import { deriveChildNode } from './bip44Core';
import { DerivedAddress, DerivedChildKey } from './types';

/**
 * Derives a public deposit address for BSC at the specified BIP-44 index.
 * Uses public key derivation only — the private key is never accessed.
 *
 * @param index - BIP-44 address_index
 * @returns DerivedAddress with checksummed EVM address
 */
export function deriveBscAddress(index: number): DerivedAddress {
  const child = deriveChildNode(env.hd.bscDerivationPath, index, false);
  const pubKeyHex = `0x${child.publicKeyBuffer.toString('hex')}`;
  const address = ethers.computeAddress(pubKeyHex);

  return {
    address,
    derivationIndex: index,
    network: CryptoNetwork.BSC,
  };
}

/**
 * Derives the private key and public address for BSC at the specified BIP-44 index.
 *
 * SECURITY WARNING:
 *   Used EXCLUSIVELY by the Phase 5 auto-forwarding worker in memory to sign
 *   the sweep transaction to the cold wallet.
 *   Must NEVER be called in API controllers, logged, or stored in the database.
 *
 * @param index - BIP-44 address_index
 * @returns DerivedChildKey with hex private key and verified checksummed address
 */
export function deriveBscPrivateKey(index: number): DerivedChildKey {
  const child = deriveChildNode(env.hd.bscDerivationPath, index, true);

  if (!child.privateKeyBuffer) {
    throw new Error(`[BscDeriver] Failed to extract private key for BSC at index ${index}`);
  }

  const privateKeyHex = child.privateKeyBuffer.toString('hex');
  const address = ethers.computeAddress(`0x${privateKeyHex}`);

  return {
    privateKeyHex,
    address,
    network: CryptoNetwork.BSC,
    derivationIndex: index,
  };
}
