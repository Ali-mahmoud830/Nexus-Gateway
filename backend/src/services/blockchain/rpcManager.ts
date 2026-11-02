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

// Battle-tested, high-capacity official Binance Smart Chain public endpoints
const RELIABLE_BSC_FALLBACKS = [
  'https://bsc-dataseed.binance.org',
  'https://bsc-dataseed1.defibit.io',
  'https://bsc-dataseed1.ninicoin.io',
  'https://bsc-dataseed2.defibit.io',
  'https://binance.llamarpc.com',
  'https://bsc-rpc.publicnode.com',
];

export class BscRpcManager {
  private urls: string[] = [];
  private providers: Map<string, ethers.JsonRpcProvider> = new Map();
  private currentIndex: number = 0;
  private nodeHealth: Map<string, RpcNodeHealth> = new Map();
  private readonly requestTimeoutMs: number = 8_000;
  private readonly maxFailuresBeforeCooldown: number = 3;
  private lastLoggedAllFailedAt: number = 0;

  constructor() {
    // 1. Gather all candidate URLs from environment and reliable fallbacks
    const candidateUrls = [
      ...env.bsc.rpcUrls,
      ...RELIABLE_BSC_FALLBACKS,
    ];

    // 2. Filter out null/empty and known broken rate-limited domains (e.g. free 1rpc which caps usage)
    const filtered = candidateUrls
      .map((u) => u?.trim())
      .filter((u): u is string => {
        if (!u || u.length === 0) return false;
        // 1rpc free plan caps strictly with -32001 errors; ignore if using free public domain
        if (u.includes('1rpc.io')) return false;
        return true;
      });

    // Deduplicate
    this.urls = Array.from(new Set(filtered));

    if (this.urls.length === 0) {
      this.urls = [...RELIABLE_BSC_FALLBACKS];
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

      // ethers.JsonRpcProvider with custom static network
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

    logger.info(`[BscRpcManager] Initialized with ${this.urls.length} resilient RPC node(s)`, {
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

        // Only log warning if not already repeatedly failing to prevent log pollution
        const isQuotaErr = lastError.message.includes('usage limit') || 
                           lastError.message.includes('-32001') || 
                           lastError.message.includes('billing/plan');

        if (attempts <= 2 || isQuotaErr) {
          logger.warn(
            `[BscRpcManager] Node failure on "${currentUrl}" (${attempts}/${maxAttempts}). Rotating to next RPC node. Reason: ${lastError.message}`,
          );
        }

        // Rotate to next node
        this.rotateToNextNode();
      }
    }

    const now = Date.now();
    // Throttle "All BSC RPC endpoints failed" error to once per 60 seconds
    if (now - this.lastLoggedAllFailedAt > 60_000) {
      this.lastLoggedAllFailedAt = now;
      logger.error('[BscRpcManager] All BSC RPC endpoints failed.', {
        attempts,
        lastError: lastError?.message,
      });
    }

    throw new Error(
      `[BscRpcManager] All ${this.urls.length} BSC RPC nodes failed. Last error: ${lastError?.message}`,
    );
  }

  /**
   * Checks if an RPC node is available or if its cooldown has elapsed.
   */
  private isNodeAvailable(url: string): boolean {
    const health = this.nodeHealth.get(url);
    if (!health) return true;
    if (health.isHealthy) return true;

    // Cooldown auto-recovery: retry unhealthy nodes after 60s
    const COOLDOWN_MS = 60_000;
    if (Date.now() - health.lastChecked.getTime() > COOLDOWN_MS) {
      health.isHealthy = true;
      health.consecutiveFailures = 0;
      return true;
    }
    return false;
  }

  /**
   * Rotates currentIndex to the next available healthy node.
   */
  private rotateToNextNode(): void {
    const previous = this.urls[this.currentIndex];

    // Look for next available node (healthy or past cooldown)
    for (let i = 1; i <= this.urls.length; i++) {
      const idx = (this.currentIndex + i) % this.urls.length;
      const candidateUrl = this.urls[idx]!;
      if (this.isNodeAvailable(candidateUrl)) {
        this.currentIndex = idx;
        break;
      }
    }

    const next = this.urls[this.currentIndex];
    if (previous !== next) {
      logger.info(`[BscRpcManager] Switched active RPC from ${previous} -> ${next}`);
    }
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

      // Permanent plan limit or quota reached -> mark unhealthy immediately
      const isQuotaLimit =
        errorMsg.includes('usage limit') ||
        errorMsg.includes('-32001') ||
        errorMsg.includes('billing/plan');

      if (isQuotaLimit || health.consecutiveFailures >= this.maxFailuresBeforeCooldown) {
        health.isHealthy = false;
        logger.error(
          `[BscRpcManager] RPC node "${url}" marked unhealthy (${isQuotaLimit ? 'QUOTA_EXCEEDED' : 'MAX_FAILURES'}). Error: ${errorMsg}`,
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
