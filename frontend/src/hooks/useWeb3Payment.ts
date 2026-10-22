'use client';

/**
 * src/hooks/useWeb3Payment.ts
 *
 * Web3 One-Click Wallet Payment Hook.
 * Supports direct wallet checkout via:
 * 1. MetaMask / Injected EVM wallets for BSC (BEP-20 USDT)
 * 2. TronLink for TRON (TRC-20 USDT)
 *
 * Automatically handles network switching, parameter encoding, and broadcast.
 */

import { useState, useCallback, useEffect } from 'react';
import { CryptoNetwork } from '../types/invoice';

const BSC_CHAIN_ID_HEX = '0x38'; // 56 in decimal
const BSC_USDT_CONTRACT = '0x55d398326f99059fF775485246999027B3197955';
const TRON_USDT_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';

export interface UseWeb3PaymentOptions {
  network: CryptoNetwork;
  depositAddress: string;
  expectedAmount: string;
  onSuccess?: (txHash: string) => void;
}

export interface UseWeb3PaymentResult {
  isWalletAvailable: boolean;
  walletName: string;
  isProcessing: boolean;
  error: string | null;
  txHash: string | null;
  payWithWallet: () => Promise<string | null>;
}

declare global {
  interface Window {
    ethereum?: {
      isMetaMask?: boolean;
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    };
    tronWeb?: {
      ready: boolean;
      defaultAddress?: { base58: string };
      contract: () => {
        at: (address: string) => Promise<{
          transfer: (to: string, amount: string | number) => {
            send: () => Promise<string>;
          };
        }>;
      };
      toSun: (trx: number) => number;
    };
    tronLink?: {
      ready: boolean;
      request: (args: { method: string }) => Promise<{ code: number; message: string }>;
    };
  }
}

export function useWeb3Payment({
  network,
  depositAddress,
  expectedAmount,
  onSuccess,
}: UseWeb3PaymentOptions): UseWeb3PaymentResult {
  const [isWalletAvailable, setIsWalletAvailable] = useState(false);
  const [walletName, setWalletName] = useState('Web3 Wallet');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  // Check wallet presence based on active network
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (network === CryptoNetwork.BSC) {
      const hasEth = typeof window.ethereum !== 'undefined';
      setIsWalletAvailable(hasEth);
      setWalletName(window.ethereum?.isMetaMask ? 'MetaMask' : 'Trust Wallet / Web3');
    } else {
      const hasTron = typeof window.tronWeb !== 'undefined' || typeof window.tronLink !== 'undefined';
      setIsWalletAvailable(hasTron);
      setWalletName('TronLink');
    }
  }, [network]);

  /**
   * Helper: encodes ERC-20 transfer(address,uint256) data payload
   */
  const encodeBscUsdtTransfer = useCallback((recipient: string, amountStr: string): string => {
    const methodId = 'a9059cbb'; // transfer(address,uint256)
    const cleanAddress = recipient.toLowerCase().replace(/^0x/, '').padStart(64, '0');

    // BSC USDT has 18 decimals
    const [whole, fraction = ''] = amountStr.split('.');
    const paddedFraction = fraction.padEnd(18, '0').slice(0, 18);
    const rawUnits = BigInt(whole + paddedFraction);
    const hexAmount = rawUnits.toString(16).padStart(64, '0');

    return `0x${methodId}${cleanAddress}${hexAmount}`;
  }, []);

  /**
   * Triggers One-Click Web3 Transfer
   */
  const payWithWallet = useCallback(async (): Promise<string | null> => {
    setIsProcessing(true);
    setError(null);

    try {
      if (network === CryptoNetwork.BSC) {
        if (!window.ethereum) {
          throw new Error('No EVM wallet detected. Please install MetaMask or Trust Wallet.');
        }

        // 1. Request account access
        const accounts = (await window.ethereum.request({
          method: 'eth_requestAccounts',
        })) as string[];

        if (!accounts || accounts.length === 0) {
          throw new Error('Wallet connection rejected by user.');
        }

        const userAccount = accounts[0];

        // 2. Switch chain to BSC Mainnet if needed
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: BSC_CHAIN_ID_HEX }],
          });
        } catch (switchError: unknown) {
          // Error code 4902 means the chain has not been added to MetaMask yet
          const code = (switchError as { code?: number })?.code;
          if (code === 4902) {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [
                {
                  chainId: BSC_CHAIN_ID_HEX,
                  chainName: 'Binance Smart Chain Mainnet',
                  nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
                  rpcUrls: ['https://bsc-rpc.publicnode.com', 'https://bsc.drpc.org'],
                  blockExplorerUrls: ['https://bscscan.com/'],
                },
              ],
            });
          } else {
            throw switchError;
          }
        }

        // 3. Construct and dispatch transfer
        const callData = encodeBscUsdtTransfer(depositAddress, expectedAmount);

        const txHashResult = (await window.ethereum.request({
          method: 'eth_sendTransaction',
          params: [
            {
              from: userAccount,
              to: BSC_USDT_CONTRACT,
              data: callData,
            },
          ],
        })) as string;

        setTxHash(txHashResult);
        onSuccess?.(txHashResult);
        return txHashResult;
      } else {
        // TRON Network Payment via TronLink
        if (!window.tronWeb && !window.tronLink) {
          throw new Error('TronLink wallet not detected. Please install the TronLink browser extension.');
        }

        // Request login if using tronLink extension wrapper
        if (window.tronLink && window.tronLink.request) {
          await window.tronLink.request({ method: 'tron_requestAccounts' });
        }

        if (!window.tronWeb || !window.tronWeb.defaultAddress?.base58) {
          throw new Error('Please unlock your TronLink account to proceed.');
        }

        // Load TRC-20 USDT contract (6 decimals)
        const parsedAmount = parseFloat(expectedAmount);
        const sunUnits = Math.round(parsedAmount * 1_000_000);

        const contract = await window.tronWeb.contract().at(TRON_USDT_CONTRACT);
        const resultTx = await contract.transfer(depositAddress, sunUnits).send();

        const cleanTx = typeof resultTx === 'string' ? resultTx : JSON.stringify(resultTx);
        setTxHash(cleanTx);
        onSuccess?.(cleanTx);
        return cleanTx;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Wallet transaction failed or cancelled';
      setError(msg);
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, [network, depositAddress, expectedAmount, encodeBscUsdtTransfer, onSuccess]);

  return {
    isWalletAvailable,
    walletName,
    isProcessing,
    error,
    txHash,
    payWithWallet,
  };
}
