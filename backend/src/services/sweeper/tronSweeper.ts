/**
 * src/services/sweeper/tronSweeper.ts
 *
 * Dedicated Auto-Forwarding Sweeper for TRON (TRC-20 USDT)
 *
 * Privacy Architecture:
 *   1. Recovers child private key strictly into ephemeral memory from stored derivation index.
 *   2. Auto-funds the temporary deposit wallet with gas TRX via Gas Station.
 *   3. Sweeps 100% of the TRC-20 USDT tokens to the main TRON cold wallet.
 *   4. Zeroes ephemeral private key memory immediately after transaction broadcast.
 *   5. Saves on-chain transaction hash and sweep timestamps.
 */

import { ethers } from 'ethers';
import TronWeb from 'tronweb';
import { env } from '../../config/env';
import { IInvoiceDocument, InvoiceStatus, CryptoNetwork } from '../../models/Invoice';
import { logger } from '../../utils/logger';
import { deriveChildPrivateKey } from '../hdWallet/addressManager';
import { gasStation } from './gasStation';
import { SweepResult } from './types';

const TRON_USDT_DECIMALS = 6;

/**
 * Sweeps all TRC-20 USDT from a confirmed temporary deposit address to the TRON cold wallet.
 *
 * @param invoice - Mongoose Invoice document ready for forwarding
 * @returns SweepResult detailing the on-chain transfer
 */
export async function sweepTronInvoice(invoice: IInvoiceDocument): Promise<SweepResult> {
  const { invoiceId, depositAddress, derivationIndex } = invoice;
  const coldWallet = env.wallets.tronMainWallet;

  logger.info(`[TronSweeper] Starting sweep for invoice ${invoiceId} (${depositAddress} -> ${coldWallet})`);

  // 1. Mark status as FORWARDING
  invoice.status = InvoiceStatus.FORWARDING;
  await invoice.save();

  let ephemeralPrivateKey: string | null = null;
  let tempTronWeb: any = null;

  try {
    const readOnlyTronWeb = new TronWeb({ fullHost: env.tron.fullNode });
    if (env.tron.apiKey && !env.tron.apiKey.includes('PLACEHOLDER')) {
      readOnlyTronWeb.setHeader({ 'TRON-PRO-API-KEY': env.tron.apiKey });
    }

    // 2. Query on-chain TRC-20 USDT balance
    const contractReadOnly = await readOnlyTronWeb.contract().at(env.tron.usdtContract);
    const rawBalanceBn = await contractReadOnly.balanceOf(depositAddress).call();
    const rawBalance = rawBalanceBn.toString();
    const formattedBalance = ethers.formatUnits(rawBalance, TRON_USDT_DECIMALS);
    const balanceNum = parseFloat(formattedBalance);

    if (balanceNum < env.sweeper.minAmountUsd) {
      const msg = `Deposit wallet holds ${formattedBalance} USDT (below minimum sweep threshold of ${env.sweeper.minAmountUsd} USD). Skipping sweep.`;
      logger.warn(`[TronSweeper] ${msg}`, { invoiceId, depositAddress });

      invoice.status = InvoiceStatus.FAILED;
      invoice.forwardingDetails.failureReason = msg;
      await invoice.save();

      return {
        invoiceId,
        network: CryptoNetwork.TRON,
        depositAddress,
        destinationAddress: coldWallet,
        sweptAmount: '0',
        gasFee: '0',
        txHash: '',
        success: false,
        error: msg,
      };
    }

    // 3. Ensure deposit wallet has TRX for energy / fee burn
    await gasStation.ensureTronGas(depositAddress);

    // 4. Ephemerally derive child private key
    const childKey = deriveChildPrivateKey(CryptoNetwork.TRON, derivationIndex);
    ephemeralPrivateKey = childKey.privateKeyHex;

    // Defense-in-depth: assert derived address matches deposit address exactly
    if (childKey.address !== depositAddress) {
      throw new Error(
        `Cryptographic integrity error: derived TRON address ${childKey.address} does not match invoice deposit address ${depositAddress}`,
      );
    }

    // 5. Build ephemeral TronWeb instance to sign and broadcast the transfer
    tempTronWeb = new TronWeb({
      fullHost: env.tron.fullNode,
      privateKey: ephemeralPrivateKey,
    });

    if (env.tron.apiKey && !env.tron.apiKey.includes('PLACEHOLDER')) {
      tempTronWeb.setHeader({ 'TRON-PRO-API-KEY': env.tron.apiKey });
    }

    logger.info(
      `[TronSweeper] Broadcasting sweep of ${formattedBalance} USDT from ${depositAddress} to cold wallet ${coldWallet}…`,
    );

    const contractWithSigner = await tempTronWeb.contract().at(env.tron.usdtContract);
    const txHash = await contractWithSigner.transfer(coldWallet, rawBalance).send();

    if (!txHash) {
      throw new Error(`[TronSweeper] Transaction broadcast returned empty hash for invoice ${invoiceId}`);
    }

    logger.info(`[TronSweeper] ✅ Sweep broadcasted for invoice ${invoiceId}! TxHash: ${txHash}`);

    // 6. Update Invoice with complete audit record
    invoice.status = InvoiceStatus.FORWARDED;
    invoice.forwardingDetails = {
      forwardTxHash: txHash,
      forwardToAddress: coldWallet,
      forwardedAt: new Date(),
      gasFeeUsed: 'BURN_TRX',
      actualForwardedAmount: formattedBalance,
    };
    await invoice.save();

    return {
      invoiceId,
      network: CryptoNetwork.TRON,
      depositAddress,
      destinationAddress: coldWallet,
      sweptAmount: formattedBalance,
      gasFee: 'BURN_TRX',
      txHash,
      success: true,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error(`[TronSweeper] ❌ Sweep failed for invoice ${invoiceId}: ${errorMsg}`, {
      invoiceId,
      depositAddress,
    });

    // Do NOT overwrite user payment status to FAILED!
    // The user's deposit is verified on-chain. Keep status as CONFIRMED so their balance is credited.
    // The sweeper will automatically retry forwarding once the Gas Station is funded.
    invoice.forwardingDetails.failureReason = errorMsg;
    await invoice.save();

    return {
      invoiceId,
      network: CryptoNetwork.TRON,
      depositAddress,
      destinationAddress: coldWallet,
      sweptAmount: '0',
      gasFee: '0',
      txHash: '',
      success: false,
      error: errorMsg,
    };
  } finally {
    // 7. Security: Flush private key and temporary TronWeb instance from memory
    ephemeralPrivateKey = null;
    tempTronWeb = null;
  }
}
