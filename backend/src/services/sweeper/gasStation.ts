/**
 * src/services/sweeper/gasStation.ts
 *
 * Automated Gas Station / Funder for Temporary Deposit Wallets
 *
 * Blockchain Requirement:
 *   When users pay BEP-20 or TRC-20 USDT into unique derived deposit addresses,
 *   those temporary addresses contain 0 BNB and 0 TRX.
 *   To broadcast the token transfer to the cold wallet, the temporary wallet
 *   must hold a micro-amount of native gas currency to execute the smart contract.
 *
 * Responsibilities:
 *   1. Manages hot Gas Station wallets for BSC (BNB) and TRON (TRX).
 *   2. Inspects deposit wallet balances before funding to prevent double-spending or redundant funding.
 *   3. Broadcasts gas funding transactions and awaits on-chain confirmation before sweeping begins.
 *   4. Monitors and reports Gas Station reserve balances.
 */

import { ethers } from 'ethers';
import TronWeb from 'tronweb';
import { env } from '../../config/env';
import { CryptoNetwork } from '../../models/Invoice';
import { logger } from '../../utils/logger';
import { bscRpcManager } from '../blockchain/rpcManager';
import { deriveChildNode } from '../hdWallet/bip44Core';
import { tronHexToBase58 } from '../hdWallet/tronDeriver';
import { GasStationBalance } from './types';

// Micro-funding parameters
const MIN_BSC_GAS_THRESHOLD = '0.0002'; // If temp wallet already has 0.0002 BNB, skip funding
const BSC_GAS_FUND_AMOUNT = '0.0004';   // ~0.0004 BNB (~$0.25) covers BEP-20 transfer easily

const MIN_TRON_GAS_THRESHOLD = 15;      // In TRX
const TRON_GAS_FUND_AMOUNT = 20;        // 20 TRX covers TRC-20 energy burn easily

export class GasStation {
  private bscWallet: ethers.Wallet | null = null;
  private tronWeb: any = null;
  private tronAddress: string = '';

  constructor() {
    this.init();
  }

  /**
   * Initializes or re-initializes Gas Station signers.
   * Can be called after HD wallet is initialized to derive fallback keys.
   */
  public init(): void {
    if (!this.bscWallet) {
      this.initBscGasStation();
    }
    if (!this.tronWeb) {
      this.initTronGasStation();
    }
  }

  /**
   * Initializes BSC Gas Station signer.
   */
  private initBscGasStation(): void {
    let privKeyHex = env.sweeper.gasStationBscPrivateKey;

    // Fallback: derive designated child key m/44'/60'/0'/1/0 from master HDKey
    if (!privKeyHex || privKeyHex.trim() === '') {
      try {
        const child = deriveChildNode("m/44'/60'/0'/1", 0, true);
        if (child.privateKeyBuffer) {
          privKeyHex = `0x${child.privateKeyBuffer.toString('hex')}`;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.warn(`[GasStation] Could not derive BSC gas wallet from HD: ${msg}`);
      }
    }

    if (privKeyHex && privKeyHex.startsWith('0x') && privKeyHex.length === 66) {
      this.bscWallet = new ethers.Wallet(privKeyHex);
      logger.info(`[GasStation] BSC Gas Station active: ${this.bscWallet.address}`);
    } else {
      logger.warn('[GasStation] BSC Gas Station not configured. Auto-funding will fail unless funded manually.');
    }
  }

  /**
   * Initializes TRON Gas Station signer.
   */
  private initTronGasStation(): void {
    let privKeyHex = env.sweeper.gasStationTronPrivateKey;

    // Fallback: derive designated child key m/44'/195'/0'/1/0 from master HDKey
    if (!privKeyHex || privKeyHex.trim() === '') {
      try {
        const child = deriveChildNode("m/44'/195'/0'/1", 0, true);
        if (child.privateKeyBuffer) {
          privKeyHex = child.privateKeyBuffer.toString('hex');
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.warn(`[GasStation] Could not derive TRON gas wallet from HD: ${msg}`);
      }
    }

    if (privKeyHex && privKeyHex.length === 64) {
      try {
        // Derive address
        const evmAddr = ethers.computeAddress(`0x${privKeyHex}`);
        this.tronAddress = tronHexToBase58(`41${evmAddr.slice(2).toLowerCase()}`);

        this.tronWeb = new TronWeb({
          fullHost: env.tron.fullNode,
          privateKey: privKeyHex,
        });

        if (env.tron.apiKey && !env.tron.apiKey.includes('PLACEHOLDER')) {
          this.tronWeb.setHeader({ 'TRON-PRO-API-KEY': env.tron.apiKey });
        }

        logger.info(`[GasStation] TRON Gas Station active: ${this.tronAddress}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.warn(`[GasStation] Failed to initialize TronWeb Gas Station: ${msg}`);
      }
    } else {
      logger.warn('[GasStation] TRON Gas Station not configured. Auto-funding will fail unless funded manually.');
    }
  }

  /**
   * Ensures the target BSC temporary address has sufficient BNB for a token transfer.
   * If balance is below threshold, broadcasts a micro-funding transaction and awaits confirmation.
   *
   * @param targetAddress - The temporary deposit address to fund
   * @returns Funding transaction hash, or null if funding was not needed
   */
  public async ensureBscGas(targetAddress: string): Promise<string | null> {
    const currentBalanceWei = await bscRpcManager.executeWithFailover((provider) =>
      provider.getBalance(targetAddress),
    );

    const minThresholdWei = ethers.parseEther(MIN_BSC_GAS_THRESHOLD);

    if (currentBalanceWei >= minThresholdWei) {
      logger.debug(
        `[GasStation] Address ${targetAddress} already has ${ethers.formatEther(currentBalanceWei)} BNB. Skipping gas funding.`,
      );
      return null;
    }

    if (!this.bscWallet) {
      throw new Error(
        `[GasStation] BSC Gas Station wallet not available to fund ${targetAddress}`,
      );
    }

    logger.info(`[GasStation] Funding ${BSC_GAS_FUND_AMOUNT} BNB to deposit address ${targetAddress}…`);

    const activeProvider = bscRpcManager.getActiveProvider();
    const connectedSigner = this.bscWallet.connect(activeProvider);

    const tx = await connectedSigner.sendTransaction({
      to: targetAddress,
      value: ethers.parseEther(BSC_GAS_FUND_AMOUNT),
    });

    logger.info(`[GasStation] Broadcasted BNB gas funding tx: ${tx.hash}. Awaiting 1 confirmation…`);
    await tx.wait(1);
    logger.info(`[GasStation] BNB gas funding confirmed for ${targetAddress}!`);

    return tx.hash;
  }

  /**
   * Ensures the target TRON temporary address has sufficient TRX for a TRC-20 transfer.
   * If balance is below threshold, transfers TRX and awaits broadcast confirmation.
   *
   * @param targetAddress - The temporary deposit address to fund
   * @returns Funding transaction ID, or null if funding was not needed
   */
  public async ensureTronGas(targetAddress: string): Promise<string | null> {
    if (!this.tronWeb) {
      throw new Error(`[GasStation] TRON Gas Station wallet not configured.`);
    }

    const balanceSun = await this.tronWeb.trx.getBalance(targetAddress);
    const balanceTrx = this.tronWeb.fromSun(balanceSun);

    if (balanceTrx >= MIN_TRON_GAS_THRESHOLD) {
      logger.debug(
        `[GasStation] Address ${targetAddress} already has ${balanceTrx} TRX. Skipping gas funding.`,
      );
      return null;
    }

    logger.info(`[GasStation] Funding ${TRON_GAS_FUND_AMOUNT} TRX to deposit address ${targetAddress}…`);

    const fundAmountSun = this.tronWeb.toSun(TRON_GAS_FUND_AMOUNT);
    const tx = await this.tronWeb.trx.sendTransaction(targetAddress, fundAmountSun);

    if (!tx || !tx.result) {
      throw new Error(`[GasStation] Failed to broadcast TRX funding transaction to ${targetAddress}`);
    }

    const txId = tx.transaction?.txID || tx.txid;
    logger.info(`[GasStation] TRX gas funding broadcasted: ${txId}.`);

    // Await 3 seconds for TRON block confirmation
    await new Promise((resolve) => setTimeout(resolve, 3500));

    return txId;
  }

  /**
   * Returns current BSC Gas Station reserve balance.
   */
  public async getBscGasBalance(): Promise<GasStationBalance> {
    if (!this.bscWallet) {
      this.initBscGasStation();
    }

    if (!this.bscWallet) {
      return {
        network: CryptoNetwork.BSC,
        address: 'NOT_CONFIGURED',
        nativeBalance: '0.0000',
        nativeCurrency: 'BNB',
        isSufficient: false,
      };
    }

    try {
      const balanceWei = await bscRpcManager.executeWithFailover((p) =>
        p.getBalance(this.bscWallet!.address),
      );
      const balanceBnb = ethers.formatEther(balanceWei);

      return {
        network: CryptoNetwork.BSC,
        address: this.bscWallet.address,
        nativeBalance: parseFloat(balanceBnb).toFixed(4),
        nativeCurrency: 'BNB',
        isSufficient: balanceWei >= ethers.parseEther(MIN_BSC_GAS_THRESHOLD),
      };
    } catch {
      return {
        network: CryptoNetwork.BSC,
        address: this.bscWallet.address,
        nativeBalance: '0.0000',
        nativeCurrency: 'BNB',
        isSufficient: false,
      };
    }
  }

  /**
   * Returns current TRON Gas Station reserve balance.
   */
  public async getTronGasBalance(): Promise<GasStationBalance> {
    if (!this.tronWeb) {
      this.initTronGasStation();
    }

    if (!this.tronWeb || !this.tronAddress) {
      return {
        network: CryptoNetwork.TRON,
        address: 'NOT_CONFIGURED',
        nativeBalance: '0.0',
        nativeCurrency: 'TRX',
        isSufficient: false,
      };
    }

    try {
      const balanceSun = await this.tronWeb.trx.getBalance(this.tronAddress);
      const balanceTrx = this.tronWeb.fromSun(balanceSun);

      return {
        network: CryptoNetwork.TRON,
        address: this.tronAddress,
        nativeBalance: parseFloat(balanceTrx).toFixed(2),
        nativeCurrency: 'TRX',
        isSufficient: balanceTrx >= MIN_TRON_GAS_THRESHOLD,
      };
    } catch {
      return {
        network: CryptoNetwork.TRON,
        address: this.tronAddress,
        nativeBalance: '0.0',
        nativeCurrency: 'TRX',
        isSufficient: false,
      };
    }
  }
}

// Singleton export
export const gasStation = new GasStation();
