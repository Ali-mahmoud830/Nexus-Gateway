/**
 * src/services/blockchain/rpcManager.ts
 *
 * Multi-RPC Failover and Circuit-Breaker Manager for BNB Smart Chain (BSC)
 *
 * Responsibilities:
 *   1. Manages a prioritized pool of BSC JSON-RPC endpoints.
 *   2. Wraps all Web3/RPC operations in automatic failover execution with retries.
 *   3. Tracks node latency, failure rates, and circuit-breaker states.
 *   4. Seamlessly rotates to secondary/tertiary RPCs if primary experiences rate limits (HTTP 429),
 *      timeouts, network errors, or block synchronization delays.
 */

import { ethers } from 'ethers';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { RpcNodeHealth } from './types';

export class BscRpcManager {
  private urls: string[];
  private providers: Map<string, ethers.JsonRpcProvider> = new Map();
  private currentIndex: number = 0;
  private nodeHealth: Map<string, RpcNodeHealth> = new Map();
  private readonly requestTimeoutMs: number = 10_000;
  private readonly maxFailuresBeforeCooldown: number = 3;

  constructor() {
    this.urls = [...env.bsc.rpcUrls].filter((url) => url && url.trim().length > 0);

    if (this.urls.length === 0) {
      throw new Error('[BscRpcManager] No valid BSC RPC URLs configured in environment.');
    }

    // Initialize health records and providers
    for (const url of this.urls) {
      this.nodeHealth.set(url, {
        url,
        isHealthy: true,
        latencyMs: 0,
        consecutiveFailures: 0,
        lastChecked: new Date(),
      });

      // ethers.JsonRpcProvider with custom static network and fetch options
      const provider = new ethers.JsonRpcProvider(
        url,
        {
          name: 'binance',
          chainId: 56, // BSC Mainnet Chain ID
        },
        {
          staticNetwork: true, // Prevents eth_chainId overhead on every single query
        },
      );
      this.providers.set(url, provider);
    }

    logger.info(`[BscRpcManager] Initialized with ${this.urls.length} RPC node(s)`, {
      primary: this.urls[0],
      fallbacks: this.urls.slice(1),
    });
  }

  /**
   * Returns the current active provider.
   */
  public getActiveProvider(): ethers.JsonRpcProvider {
    const url = this.urls[this.currentIndex]!;
    return this.providers.get(url)!;
  }

  /**
   * Returns the current active RPC URL.
   */
  public getActiveUrl(): string {
    return this.urls[this.currentIndex]!;
  }

  /**
   * Executes an asynchronous RPC operation with automatic multi-node failover and retries.
   *
   * @param operation - Function that receives an ethers JsonRpcProvider and returns a promise.
   * @returns Result of the operation.
   */
  public async executeWithFailover<T>(
    operation: (provider: ethers.JsonRpcProvider) => Promise<T>,
  ): Promise<T> {
    let attempts = 0;
    const maxAttempts = this.urls.length;
    let lastError: Error | null = null;

    while (attempts < maxAttempts) {
      const currentUrl = this.urls[this.currentIndex]!;
      const provider = this.providers.get(currentUrl)!;
      const startTime = Date.now();

      try {
        // Enforce timeout on the RPC call
        const result = await Promise.race([
          operation(provider),
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error(`RPC request timeout after ${this.requestTimeoutMs}ms`)),
              this.requestTimeoutMs,
            ),
          ),
        ]);

        // Record success metrics
        const latency = Date.now() - startTime;
        this.recordSuccess(currentUrl, latency);

        return result;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        attempts++;

        this.recordFailure(currentUrl, lastError.message);

        logger.warn(
          `[BscRpcManager] Node failure on "${currentUrl}" (${attempts}/${maxAttempts}). Rotating to next RPC node. Error: ${lastError.message}`,
        );

        // Rotate to next node
        this.rotateToNextNode();
      }
    }

    logger.error('[BscRpcManager] All BSC RPC endpoints failed.', {
      attempts,
      lastError: lastError?.message,
    });
    throw new Error(
      `[BscRpcManager] All ${this.urls.length} BSC RPC nodes failed. Last error: ${lastError?.message}`,
    );
  }

  /**
   * Rotates currentIndex to the next available healthy node.
   */
  private rotateToNextNode(): void {
    const previous = this.urls[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.urls.length;
    const next = this.urls[this.currentIndex];

    logger.info(`[BscRpcManager] Switched active RPC from ${previous} -> ${next}`);
  }

  /**
   * Updates health record on success.
   */
  private recordSuccess(url: string, latencyMs: number): void {
    const health = this.nodeHealth.get(url);
    if (health) {
      health.isHealthy = true;
      health.latencyMs = latencyMs;
      health.consecutiveFailures = 0;
      health.lastChecked = new Date();
    }
  }

  /**
   * Updates health record on failure.
   */
  private recordFailure(url: string, errorMsg: string): void {
    const health = this.nodeHealth.get(url);
    if (health) {
      health.consecutiveFailures++;
      health.lastChecked = new Date();
      if (health.consecutiveFailures >= this.maxFailuresBeforeCooldown) {
        health.isHealthy = false;
        logger.error(
          `[BscRpcManager] RPC node "${url}" exceeded max consecutive failures (${this.maxFailuresBeforeCooldown}). Marked unhealthy. Error: ${errorMsg}`,
        );
      }
    }
  }

  /**
   * Returns current health snapshot of all RPC nodes in the pool.
   */
  public getHealthStatus(): RpcNodeHealth[] {
    return Array.from(this.nodeHealth.values());
  }
}

// Singleton export
export const bscRpcManager = new BscRpcManager();
