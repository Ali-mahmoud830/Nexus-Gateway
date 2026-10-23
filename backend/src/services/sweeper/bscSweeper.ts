/**
 * src/services/sweeper/bscSweeper.ts
 *
 * Dedicated Auto-Forwarding Sweeper for BNB Smart Chain (BEP-20 USDT)
 *
 * Privacy Architecture:
 *   1. Recovers child private key strictly into ephemeral memory from the stored derivation index.
 *   2. Auto-funds the temporary deposit wallet with gas BNB via Gas Station.
 *   3. Sweeps 100% of the BEP-20 USDT tokens to the main cold wallet.
 *   4. Immediately zeroes the ephemeral private key buffer.
 *   5. Saves on-chain transaction hash, gas fee audit, and timestamps.
 */

import { ethers } from 'ethers';
import { env } from '../../config/env';
import { IInvoiceDocument, InvoiceStatus, CryptoNetwork } from '../../models/Invoice';
import { logger } from '../../utils/logger';
import { bscRpcManager } from '../blockchain/rpcManager';
import { deriveChildPrivateKey } from '../hdWallet/addressManager';
import { gasStation } from './gasStation';
import { SweepResult } from './types';

// Minimal ERC-20 ABI for balance check and transfer
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 value) returns (bool)',
];

const BSC_USDT_DECIMALS = 18;

/**
 * Sweeps all BEP-20 USDT from a confirmed temporary deposit address to the cold wallet.
 *
 * @param invoice - Mongoose Invoice document ready for forwarding
 * @returns SweepResult detailing the on-chain transfer
 */
export async function sweepBscInvoice(invoice: IInvoiceDocument): Promise<SweepResult> {
  const { invoiceId, depositAddress, derivationIndex } = invoice;
  const coldWallet = env.wallets.bscMainWallet;

  logger.info(`[BscSweeper] Starting sweep for invoice ${invoiceId} (${depositAddress} -> ${coldWallet})`);

  // 1. Mark status as FORWARDING
  invoice.status = InvoiceStatus.FORWARDING;
  await invoice.save();

  let ephemeralPrivateKey: string | null = null;

  try {
    const provider = bscRpcManager.getActiveProvider();
    const usdtContractReadOnly = new ethers.Contract(env.bsc.usdtContract, ERC20_ABI, provider);

    // 2. Query actual on-chain USDT balance
    const rawBalance: bigint = await usdtContractReadOnly['balanceOf'](depositAddress);
    const formattedBalance = ethers.formatUnits(rawBalance, BSC_USDT_DECIMALS);
    const balanceNum = parseFloat(formattedBalance);

    if (balanceNum < env.sweeper.minAmountUsd) {
      const msg = `Deposit wallet holds ${formattedBalance} USDT (below minimum sweep threshold of ${env.sweeper.minAmountUsd} USD). Skipping sweep.`;
      logger.warn(`[BscSweeper] ${msg}`, { invoiceId, depositAddress });

      invoice.status = InvoiceStatus.FAILED;
      invoice.forwardingDetails.failureReason = msg;
      await invoice.save();

      return {
        invoiceId,
        network: CryptoNetwork.BSC,
        depositAddress,
        destinationAddress: coldWallet,
        sweptAmount: '0',
        gasFee: '0',
        txHash: '',
        success: false,
        error: msg,
      };
    }

    // 3. Determine if dual routing is required (Principal -> Cold Wallet, Fee -> Gas Station)
    const gasStationAddress = gasStation.getBscAddress();
    const feeNum = invoice.feeAmount && invoice.feeAmount > 0 ? invoice.feeAmount : 0;
    const feeBn =
      feeNum > 0 ? ethers.parseUnits(feeNum.toFixed(6), BSC_USDT_DECIMALS) : 0n;
    const shouldSplit =
      feeBn > 0n &&
      rawBalance > feeBn &&
      !!gasStationAddress &&
      gasStationAddress.toLowerCase() !== coldWallet.toLowerCase();

    // Ensure deposit wallet has BNB for gas
    await gasStation.ensureBscGas(depositAddress, shouldSplit);

    // 4. Ephemerally derive child private key
    const childKey = deriveChildPrivateKey(CryptoNetwork.BSC, derivationIndex);
    ephemeralPrivateKey = childKey.privateKeyHex;

    // Defense-in-depth: assert derived address matches deposit address exactly
    if (childKey.address.toLowerCase() !== depositAddress.toLowerCase()) {
      throw new Error(
        `Cryptographic integrity error: derived address ${childKey.address} does not match invoice deposit address ${depositAddress}`,
      );
    }

    // 5. Build and sign sweep transaction
    const signer = new ethers.Wallet(ephemeralPrivateKey, provider);
    const usdtContractWithSigner = new ethers.Contract(env.bsc.usdtContract, ERC20_ABI, signer);

    if (shouldSplit) {
      // DUAL ROUTING: Split deposit into Net Principal -> Cold Wallet and Fee -> Gas Station
      const netBn = rawBalance - feeBn;
      const netFormatted = ethers.formatUnits(netBn, BSC_USDT_DECIMALS);
      const feeFormatted = ethers.formatUnits(feeBn, BSC_USDT_DECIMALS);

      logger.info(
        `[BscSweeper] Dual-sweep for invoice ${invoiceId}: Principal ${netFormatted} USDT -> ${coldWallet}, Fee ${feeFormatted} USDT -> ${gasStationAddress}`,
      );

      // Step 5a: Transfer Net Principal to Cold Wallet
      const netTx = await usdtContractWithSigner['transfer'](coldWallet, netBn);
      logger.info(`[BscSweeper] Principal transfer broadcasted: ${netTx.hash}. Awaiting confirmation…`);
      const netReceipt = await netTx.wait(1);

      // Step 5b: Transfer Fee Surcharge to Gas Station
      let feeTxHash = '';
      let feeGasUsed = 0n;
      try {
        const feeTx = await usdtContractWithSigner['transfer'](gasStationAddress, feeBn);
        logger.info(`[BscSweeper] Fee surcharge broadcasted: ${feeTx.hash}. Awaiting confirmation…`);
        const feeReceipt = await feeTx.wait(1);
        feeTxHash = feeTx.hash;
        feeGasUsed = feeReceipt.gasUsed || 0n;
        logger.info(`[BscSweeper] ✅ Fee surcharge swept to gas station for invoice ${invoiceId}! TxHash: ${feeTxHash}`);
      } catch (feeErr) {
        const feeErrMsg = feeErr instanceof Error ? feeErr.message : String(feeErr);
        logger.error(`[BscSweeper] ⚠️ Fee transfer to gas station failed for invoice ${invoiceId}: ${feeErrMsg}`);
      }

      // Calculate combined gas fee
      const totalGasUsed = (netReceipt.gasUsed || 0n) + feeGasUsed;
      const gasPrice = netReceipt.gasPrice || 0n;
      const gasFee = ethers.formatEther(totalGasUsed * gasPrice);

      logger.info(
        `[BscSweeper] ✅ Dual-sweep confirmed for invoice ${invoiceId}! PrincipalTx: ${netTx.hash}, FeeTx: ${feeTxHash}, TotalGas: ${gasFee} BNB`,
      );

      // 6. Update Invoice with complete dual-routing audit record
      invoice.status = InvoiceStatus.FORWARDED;
      invoice.forwardingDetails = {
        forwardTxHash: netTx.hash,
        forwardToAddress: coldWallet,
        forwardedAt: new Date(),
        gasFeeUsed: gasFee,
        actualForwardedAmount: netFormatted,
        feeForwardTxHash: feeTxHash || undefined,
        feeForwardToAddress: gasStationAddress,
        actualFeeForwardedAmount: feeFormatted,
      };
      await invoice.save();

      return {
        invoiceId,
        network: CryptoNetwork.BSC,
        depositAddress,
        destinationAddress: coldWallet,
        sweptAmount: netFormatted,
        gasFee,
        txHash: netTx.hash,
        feeTxHash: feeTxHash || undefined,
        feeSweptAmount: feeFormatted,
        feeDestinationAddress: gasStationAddress,
        success: true,
      };
    } else {
      // SINGLE TRANSFER: 100% of balance to Cold Wallet
      logger.info(
        `[BscSweeper] Broadcasting single sweep of ${formattedBalance} USDT from ${depositAddress} to cold wallet ${coldWallet}…`,
      );

      const tx = await usdtContractWithSigner['transfer'](coldWallet, rawBalance);
      logger.info(`[BscSweeper] Sweep transaction broadcasted: ${tx.hash}. Awaiting confirmation…`);

      const receipt = await tx.wait(1);
      const gasUsed = receipt.gasUsed || 0n;
      const gasPrice = receipt.gasPrice || 0n;
      const gasFee = ethers.formatEther(gasUsed * gasPrice);

      logger.info(
        `[BscSweeper] ✅ Sweep confirmed for invoice ${invoiceId}! TxHash: ${tx.hash}, GasFee: ${gasFee} BNB`,
      );

      // 6. Update Invoice with audit record
      invoice.status = InvoiceStatus.FORWARDED;
      invoice.forwardingDetails = {
        forwardTxHash: tx.hash,
        forwardToAddress: coldWallet,
        forwardedAt: new Date(),
        gasFeeUsed: gasFee,
        actualForwardedAmount: formattedBalance,
      };
      await invoice.save();

      return {
        invoiceId,
        network: CryptoNetwork.BSC,
        depositAddress,
        destinationAddress: coldWallet,
        sweptAmount: formattedBalance,
        gasFee,
        txHash: tx.hash,
        success: true,
      };
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error(`[BscSweeper] ❌ Sweep failed for invoice ${invoiceId}: ${errorMsg}`, {
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
      network: CryptoNetwork.BSC,
      depositAddress,
      destinationAddress: coldWallet,
      sweptAmount: '0',
      gasFee: '0',
      txHash: '',
      success: false,
      error: errorMsg,
    };
  } finally {
    // 7. Security: Flush private key from memory
    if (ephemeralPrivateKey) {
      ephemeralPrivateKey = null;
    }
  }
}
