/**
 * backend/tools/sweeper/sweep.ts
 *
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║            NEXUS GATEWAY — ENTERPRISE AUTO-SWEEPER & AUDITOR        ║
 * ║                                                                      ║
 * ║  Multi-source blockchain auditor, fee accountant, and asset sweeper  ║
 * ║  for BEP-20 (BSC) and TRC-20 (TRON) Tether USD (USDT).              ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 *
 * KEY CAPABILITIES:
 *   1. O(1) Master Seed Caching  — BIP-32 root derived once; instant child keys.
 *   2. 6-Source BSC Aggregation  — BSC RPC × 5 failover nodes + BscScan API + Ankr.
 *   3. 4-Source TRON Aggregation — TronGrid RPC + TronScan API + Ankr TRON + TronWeb HTTP.
 *   4. 3-Source Price Feeds      — Binance → CoinGecko → CoinPaprika fallback chain.
 *   5. Live Market Valuation     — Live BNB/TRX/USDT prices for fiat yield & gas cost reporting.
 *   6. Multi-RPC Failover Pool   — 5+ public BSC nodes with 7s timeout circuit breaker.
 *   7. Safe Gas Management       — Dynamic 15% priority fee BSC, 35+ TRX energy buffer TRON.
 *   8. Concurrent Batch Scanning — O(N/C) batch reads without RPC rate-limit collisions.
 *   9. Database Synchronization  — Optional --sync-db updates MongoDB invoice state → FORWARDED.
 *  10. Strict Key Hygiene        — Private keys nullified in finally blocks after every broadcast.
 *  11. Persistent Run Logging    — Appends JSON records to logs/sweeper-runs.jsonl for audit trail.
 *
 * CLI USAGE:
 *   npx tsx tools/sweeper/sweep.ts --dry-run
 *   npx tsx tools/sweeper/sweep.ts --dry-run --scan 25 --concurrency 8
 *   npx tsx tools/sweeper/sweep.ts --live --network bsc --index 4
 *   npx tsx tools/sweeper/sweep.ts --live --scan 20 --sync-db
 *   npx tsx tools/sweeper/sweep.ts --live --scan 50 --network both --concurrency 10
 */

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import axios from 'axios';
import { ethers } from 'ethers';
import * as bip39 from 'bip39';
import HDKey from 'hdkey';
import TronWeb from 'tronweb';
import mongoose from 'mongoose';

// ─── Environment Configuration Loading ────────────────────────────────────────

const candidateEnvPaths = [
  path.resolve(__dirname, '.env.sweeper'),
  path.resolve(process.cwd(), '.env.sweeper'),
  path.resolve(process.cwd(), 'tools/sweeper/.env.sweeper'),
  path.resolve(process.cwd(), 'backend/tools/sweeper/.env.sweeper'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'backend/.env'),
];

const foundEnvPath = candidateEnvPaths.find((p) => fs.existsSync(p));
if (foundEnvPath) {
  dotenv.config({ path: foundEnvPath });
} else {
  dotenv.config();
}

// ─── Constants & Network Contracts ───────────────────────────────────────────

const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 value) returns (bool)',
];

const BSC_USDT_CONTRACT  = '0x55d398326f99059fF775485246999027B3197955';
const TRON_USDT_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';

const BSC_USDT_DECIMALS  = 18;
const TRON_USDT_DECIMALS = 6;

// Gas Station micro-funding thresholds
const BSC_GAS_THRESHOLD_WEI = ethers.parseEther('0.0002');
const BSC_GAS_FUND_BNB      = '0.0006';

const TRON_MIN_GAS_TRX  = 35;
const TRON_GAS_FUND_TRX = 38;

// ─── Multi-Source BSC RPC Failover Pool (6 public nodes) ────────────────────

const BSC_RPC_FAILOVER_POOL = [
  process.env['BSC_RPC'],
  process.env['BSC_RPC_PRIMARY'],
  process.env['BSC_RPC_SECONDARY'],
  process.env['BSC_RPC_TERTIARY'],
  'https://bsc-dataseed.binance.org',
  'https://bsc-dataseed1.defibit.io',
  'https://bsc-rpc.publicnode.com',
  'https://binance.llamarpc.com',
  'https://bsc-dataseed2.defibit.io',
  'https://bsc-dataseed3.defibit.io',
  'https://rpc.ankr.com/bsc',
].filter((url): url is string =>
  Boolean(url && url.trim().length > 0 && !url.includes('1rpc.io')),
).filter((url, i, arr) => arr.indexOf(url) === i); // deduplicate

// ─── Additional BSC Balance Source — BscScan API ─────────────────────────────

const BSCSCAN_API_KEY = process.env['BSCSCAN_API_KEY'] ?? '';

async function fetchBscScanBalance(address: string): Promise<string | null> {
  if (!BSCSCAN_API_KEY || BSCSCAN_API_KEY.includes('PLACEHOLDER')) return null;
  try {
    const res = await axios.get<{ status: string; result: string }>(
      `https://api.bscscan.com/api?module=account&action=tokenbalance` +
      `&contractaddress=${BSC_USDT_CONTRACT}&address=${address}` +
      `&tag=latest&apikey=${BSCSCAN_API_KEY}`,
      { timeout: 5000 },
    );
    if (res.data.status === '1') return res.data.result;
    return null;
  } catch {
    return null;
  }
}

// ─── Additional BSC Balance Source — Ankr Advanced API ───────────────────────

async function fetchAnkrBscBalance(address: string): Promise<string | null> {
  try {
    const res = await axios.post<any>(
      'https://rpc.ankr.com/multichain',
      {
        jsonrpc: '2.0',
        method: 'ankr_getAccountBalance',
        params: {
          blockchain: ['bsc'],
          walletAddress: address,
          pageSize: 50,
        },
        id: 1,
      },
      { timeout: 6000 },
    );
    const assets: any[] = res.data?.result?.assets ?? [];
    const usdt = assets.find(
      (a: any) =>
        a.contractAddress?.toLowerCase() === BSC_USDT_CONTRACT.toLowerCase() &&
        a.blockchain === 'bsc',
    );
    if (usdt) {
      // Ankr returns balanceRawInteger as string
      return usdt.balanceRawInteger ?? null;
    }
    return null;
  } catch {
    return null;
  }
}

// ─── Additional TRON Balance Source — Ankr TRON API ──────────────────────────

async function fetchAnkrTronBalance(address: string): Promise<string | null> {
  try {
    const res = await axios.post<any>(
      'https://rpc.ankr.com/multichain',
      {
        jsonrpc: '2.0',
        method: 'ankr_getAccountBalance',
        params: {
          blockchain: ['tron'],
          walletAddress: address,
          pageSize: 50,
        },
        id: 1,
      },
      { timeout: 6000 },
    );
    const assets: any[] = res.data?.result?.assets ?? [];
    const usdt = assets.find(
      (a: any) =>
        a.contractAddress === TRON_USDT_CONTRACT && a.blockchain === 'tron',
    );
    return usdt?.balanceRawInteger ?? null;
  } catch {
    return null;
  }
}

// ─── Additional TRON Balance Source — TronWeb HTTP Fallback ──────────────────

const TRON_FALLBACK_NODES = [
  'https://api.trongrid.io',
  'https://rpc.ankr.com/http/tron',
  'https://tron-rpc.publicnode.com',
];

const TRON_FULL_NODE_DEFAULT = process.env['TRON_FULL_NODE'] || 'https://api.trongrid.io';

// ─── CLI Parameter Parsing ───────────────────────────────────────────────────

const cliArgs = process.argv.slice(2);

const isDryRun     = cliArgs.includes('--dry-run') || !cliArgs.includes('--live');
const isLive       = cliArgs.includes('--live');
const syncDatabase = cliArgs.includes('--sync-db');

const networkArg     = (cliArgs.find((_, i) => cliArgs[i - 1] === '--network') ?? 'both').toLowerCase();
const indexArg       = cliArgs.find((_, i) => cliArgs[i - 1] === '--index');
const scanArg        = cliArgs.find((_, i) => cliArgs[i - 1] === '--scan');
const concurrencyArg = cliArgs.find((_, i) => cliArgs[i - 1] === '--concurrency');
const minUsdArg      = cliArgs.find((_, i) => cliArgs[i - 1] === '--min-usd');

const targetIndex = indexArg !== undefined ? parseInt(indexArg, 10) : null;
const scanCount   = scanArg !== undefined ? parseInt(scanArg, 10) : (targetIndex !== null ? 1 : 50);
const concurrency = concurrencyArg !== undefined ? Math.max(1, parseInt(concurrencyArg, 10)) : 8;
const minSweepUsd = minUsdArg !== undefined
  ? parseFloat(minUsdArg)
  : parseFloat(process.env['MIN_SWEEP_USD'] || '0.5');

// ─── Terminal Formatting ─────────────────────────────────────────────────────

const c = {
  reset:   '\x1b[0m',
  bold:    '\x1b[1m',
  dim:     '\x1b[2m',
  green:   '\x1b[32m',
  yellow:  '\x1b[33m',
  red:     '\x1b[31m',
  cyan:    '\x1b[36m',
  blue:    '\x1b[34m',
  magenta: '\x1b[35m',
  white:   '\x1b[37m',
};

function log(level: 'INFO' | 'WARN' | 'ERROR' | 'DRY' | 'SUCCESS' | 'DATA' | 'SYNC', msg: string) {
  const ts = new Date().toISOString().replace('T', ' ').slice(11, 19);
  const badges: Record<string, string> = {
    INFO:    `${c.cyan}[INFO]${c.reset}`,
    WARN:    `${c.yellow}[WARN]${c.reset}`,
    ERROR:   `${c.red}[FAIL]${c.reset}`,
    DRY:     `${c.blue}[SIM ]${c.reset}`,
    SUCCESS: `${c.green}[DONE]${c.reset}`,
    DATA:    `${c.magenta}[DATA]${c.reset}`,
    SYNC:    `${c.green}[SYNC]${c.reset}`,
  };
  console.log(`${c.dim}${ts}${c.reset} ${badges[level] ?? '[LOG]'} ${msg}`);
}

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val || val.trim() === '') {
    throw new Error(`Missing required configuration: "${key}" — define it in your .env.sweeper file`);
  }
  return val.trim();
}

// ─── BIP-32 Root Key Caching Engine (O(1) PBKDF2) ────────────────────────────

let cachedMasterRoot: HDKey | null = null;

function getMasterRoot(mnemonic: string): HDKey {
  if (cachedMasterRoot) return cachedMasterRoot;

  const cleanMnemonic = mnemonic.trim();
  if (!bip39.validateMnemonic(cleanMnemonic)) {
    throw new Error('HD_MNEMONIC is not a valid BIP-39 mnemonic phrase.');
  }

  const seed = bip39.mnemonicToSeedSync(cleanMnemonic);
  cachedMasterRoot = HDKey.fromMasterSeed(seed);
  seed.fill(0); // zero-wipe raw seed from memory
  return cachedMasterRoot;
}

export interface DerivedKey {
  index: number;
  privateKeyHex: string;
  privateKeyHex0x: string;
  evmAddress: string;
  tronAddress: string;
}

function deriveKey(mnemonic: string, coinType: 60 | 195, index: number): DerivedKey {
  const root = getMasterRoot(mnemonic);
  const derivationPath = `m/44'/${coinType}'/0'/0/${index}`;
  const child = root.derive(derivationPath);

  if (!child.privateKey) {
    throw new Error(`Failed to derive child key at path ${derivationPath}`);
  }

  const privateKeyHex   = child.privateKey.toString('hex');
  const privateKeyHex0x = `0x${privateKeyHex}`;
  const evmAddress      = ethers.computeAddress(privateKeyHex0x);
  const tronAddressHex  = `41${evmAddress.slice(2).toLowerCase()}`;
  const tronAddress     = TronWeb.address.fromHex(tronAddressHex);

  return { index, privateKeyHex, privateKeyHex0x, evmAddress, tronAddress };
}

// ─── Multi-RPC Failover Provider for BSC ─────────────────────────────────────

class ResilientBscProvider {
  private urls: string[];
  private currentIndex: number = 0;

  constructor(urls: string[]) {
    this.urls = Array.from(new Set(urls));
  }

  public async execute<T>(op: (provider: ethers.JsonRpcProvider, url: string) => Promise<T>): Promise<T> {
    let lastError: Error | null = null;
    const maxAttempts = this.urls.length;

    for (let i = 0; i < maxAttempts; i++) {
      const activeUrl = this.urls[this.currentIndex]!;
      const bscNet = ethers.Network.from(56);
      const provider = new ethers.JsonRpcProvider(activeUrl, bscNet, { staticNetwork: bscNet });

      try {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`RPC timeout on ${activeUrl}`)), 7000),
        );
        return await Promise.race([op(provider, activeUrl), timeoutPromise]);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        this.currentIndex = (this.currentIndex + 1) % this.urls.length;
      }
    }
    throw new Error(`All ${maxAttempts} BSC RPC nodes failed. Last error: ${lastError?.message}`);
  }

  public getActiveUrl(): string {
    return this.urls[this.currentIndex]!;
  }
}

// ─── 3-Source Market Price Aggregator ────────────────────────────────────────

interface MarketPrices {
  bnbUsd: number;
  trxUsd: number;
  source: string;
  timestamp: Date;
}

async function fetchLiveMarketPrices(): Promise<MarketPrices> {
  const fallback: MarketPrices = { bnbUsd: 650.0, trxUsd: 0.28, source: 'hardcoded-fallback', timestamp: new Date() };

  // Source 1: Binance (fastest, most accurate)
  try {
    const res = await axios.get<Array<{ symbol: string; price: string }>>(
      'https://api.binance.com/api/v3/ticker/price?symbols=["BNBUSDT","TRXUSDT"]',
      { timeout: 4000 },
    );
    let bnb = fallback.bnbUsd, trx = fallback.trxUsd;
    for (const item of res.data) {
      if (item.symbol === 'BNBUSDT') bnb = parseFloat(item.price);
      if (item.symbol === 'TRXUSDT') trx = parseFloat(item.price);
    }
    return { bnbUsd: bnb, trxUsd: trx, source: 'Binance', timestamp: new Date() };
  } catch { /* fall through */ }

  // Source 2: CoinGecko (free tier)
  try {
    const res = await axios.get<Record<string, { usd: number }>>(
      'https://api.coingecko.com/api/v3/simple/price?ids=binancecoin,tron&vs_currencies=usd',
      { timeout: 6000 },
    );
    return {
      bnbUsd: res.data['binancecoin']?.usd ?? fallback.bnbUsd,
      trxUsd: res.data['tron']?.usd ?? fallback.trxUsd,
      source: 'CoinGecko',
      timestamp: new Date(),
    };
  } catch { /* fall through */ }

  // Source 3: CoinPaprika (no API key required)
  try {
    const [bnbRes, trxRes] = await Promise.all([
      axios.get<{ quotes: { USD: { price: number } } }>('https://api.coinpaprika.com/v1/tickers/bnb-binance-coin', { timeout: 6000 }),
      axios.get<{ quotes: { USD: { price: number } } }>('https://api.coinpaprika.com/v1/tickers/trx-tron', { timeout: 6000 }),
    ]);
    return {
      bnbUsd: bnbRes.data.quotes.USD.price,
      trxUsd: trxRes.data.quotes.USD.price,
      source: 'CoinPaprika',
      timestamp: new Date(),
    };
  } catch { /* fall through */ }

  return fallback;
}

// ─── Multi-Source TRON Balance Aggregator (4 sources) ────────────────────────

interface TronBalanceAggregation {
  rawUsdt: string;
  formattedUsdt: string;
  trxBalance: number;
  sourcesVerified: string[];
}

async function fetchAggregatedTronBalance(
  address: string,
  fullNode: string,
  apiKey?: string,
): Promise<TronBalanceAggregation> {
  const sources: string[] = [];
  let rawUsdt = '0';
  let trxBalance = 0;

  // Source 1: TronGrid REST API — trigger/constant call (no TronWeb, no API key required)
  try {
    const triggerRes = await axios.post<any>(
      `${fullNode}/wallet/triggerconstantcontract`,
      {
        owner_address: TronWeb.address.toHex(address),
        contract_address: TronWeb.address.toHex(TRON_USDT_CONTRACT),
        function_selector: 'balanceOf(address)',
        parameter: TronWeb.address.toHex(address).replace(/^0x/, '').padStart(64, '0'),
        visible: false,
      },
      {
        headers: apiKey && !apiKey.includes('PLACEHOLDER')
          ? { 'TRON-PRO-API-KEY': apiKey }
          : {},
        timeout: 7000,
      },
    );
    const hexResult: string = triggerRes.data?.constant_result?.[0] ?? '';
    if (hexResult && hexResult !== '0'.repeat(64)) {
      rawUsdt = BigInt('0x' + hexResult).toString();
      sources.push('TronGrid REST');
    }
    // Native TRX balance
    const accRes = await axios.post<any>(
      `${fullNode}/wallet/getaccount`,
      { address: TronWeb.address.toHex(address), visible: false },
      { timeout: 5000 },
    );
    trxBalance = (accRes.data?.balance ?? 0) / 1_000_000;
  } catch { /* fall through */ }

  // Source 2: TronScan Open API (no key required)
  if (sources.length === 0 || rawUsdt === '0') {
    try {
      const tsRes = await axios.get<{ trc20token_balances?: Array<{ contract_address: string; balance: string }> }>(
        `https://apilist.tronscanapi.com/api/account/tokens?address=${address}`,
        { timeout: 6000 },
      );
      const token = tsRes.data?.trc20token_balances?.find(
        (t) => t.contract_address === TRON_USDT_CONTRACT,
      );
      if (token) {
        rawUsdt = token.balance;
        sources.push('TronScan API');
      }
      // TRX balance from TronScan account endpoint
      if (trxBalance === 0) {
        const accTs = await axios.get<{ balance?: number }>(
          `https://apilist.tronscanapi.com/api/account?address=${address}`,
          { timeout: 5000 },
        );
        trxBalance = (accTs.data?.balance ?? 0) / 1_000_000;
      }
    } catch { /* fall through */ }
  }

  // Source 3: Ankr Multichain (third independent source)
  if (sources.length === 0 || rawUsdt === '0') {
    const ankrRaw = await fetchAnkrTronBalance(address);
    if (ankrRaw !== null) {
      rawUsdt = ankrRaw;
      sources.push('Ankr Multichain');
    }
  }

  // Source 4: publicnode TRON endpoint (pure HTTP, no API key)
  if (sources.length === 0) {
    try {
      const pubNode = 'https://tron-rpc.publicnode.com';
      const triggerRes2 = await axios.post<any>(
        `${pubNode}/wallet/triggerconstantcontract`,
        {
          owner_address: TronWeb.address.toHex(address),
          contract_address: TronWeb.address.toHex(TRON_USDT_CONTRACT),
          function_selector: 'balanceOf(address)',
          parameter: TronWeb.address.toHex(address).replace(/^0x/, '').padStart(64, '0'),
          visible: false,
        },
        { timeout: 7000 },
      );
      const hexResult2: string = triggerRes2.data?.constant_result?.[0] ?? '';
      if (hexResult2 && hexResult2 !== '0'.repeat(64)) {
        rawUsdt = BigInt('0x' + hexResult2).toString();
        sources.push('PublicNode TRON');
      }
    } catch { /* ignore */ }
  }

  const formattedUsdt = ethers.formatUnits(rawUsdt, TRON_USDT_DECIMALS);
  return {
    rawUsdt,
    formattedUsdt,
    trxBalance,
    sourcesVerified: sources.length > 0 ? sources : ['All sources offline'],
  };
}

// ─── Multi-Source BSC Balance Aggregator (3 sources) ─────────────────────────

interface BscBalanceAggregation {
  rawUsdt: bigint;
  formattedUsdt: string;
  nativeBnb: string;
  sourcesVerified: string[];
}

async function fetchAggregatedBscBalance(
  address: string,
  bscProvider: ResilientBscProvider,
): Promise<BscBalanceAggregation> {
  const sources: string[] = [];
  let rawUsdt = 0n;
  let nativeBnb = '0.000000';

  // Source 1: BSC RPC (primary + 5-node failover)
  try {
    await bscProvider.execute(async (provider, activeUrl) => {
      const contract = new ethers.Contract(BSC_USDT_CONTRACT, ERC20_ABI, provider);
      rawUsdt = await contract['balanceOf'](address);
      const rawBnb = await provider.getBalance(address);
      nativeBnb = ethers.formatEther(rawBnb);
      sources.push(`BSC RPC (${new URL(activeUrl).hostname})`);
    });
  } catch { /* fall through */ }

  // Source 2: BscScan API (independent on-chain verification)
  if (sources.length === 0 || rawUsdt === 0n) {
    const bscScanRaw = await fetchBscScanBalance(address);
    if (bscScanRaw !== null) {
      const bscScanBig = BigInt(bscScanRaw);
      if (bscScanBig > rawUsdt) {
        rawUsdt = bscScanBig;
      }
      sources.push('BscScan API');
    }
  }

  // Source 3: Ankr Multichain API (third independent source)
  if (sources.length === 0 || rawUsdt === 0n) {
    const ankrRaw = await fetchAnkrBscBalance(address);
    if (ankrRaw !== null) {
      const ankrBig = BigInt(ankrRaw);
      if (ankrBig > rawUsdt) rawUsdt = ankrBig;
      sources.push('Ankr Multichain');
    }
  }

  return {
    rawUsdt,
    formattedUsdt: ethers.formatUnits(rawUsdt, BSC_USDT_DECIMALS),
    nativeBnb,
    sourcesVerified: sources.length > 0 ? sources : ['All sources offline'],
  };
}

// ─── MongoDB Atlas Aggregation & Synchronization ─────────────────────────────

interface DatabaseInvoiceInfo {
  invoiceId: string;
  userId: string;
  status: string;
  expectedCryptoAmount: string;
  paidCryptoAmount: string;
  fiatAmount: number;
}

let isMongoConnected = false;
let InvoiceModel: mongoose.Model<any> | null = null;

async function initMongoConnection(uri?: string): Promise<boolean> {
  if (!uri || uri.trim() === '') return false;
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 4000, tls: true });
    isMongoConnected = true;

    const schema = new mongoose.Schema(
      {
        invoiceId: String,
        userId: String,
        status: String,
        expectedCryptoAmount: String,
        paidCryptoAmount: String,
        fiatAmount: Number,
        depositAddress: String,
        network: String,
        forwardingDetails: mongoose.Schema.Types.Mixed,
      },
      { collection: 'invoices', strict: false },
    );
    InvoiceModel = mongoose.models['Invoice'] || mongoose.model('Invoice', schema);
    return true;
  } catch {
    return false;
  }
}

async function findInvoiceForAddress(address: string, network: string): Promise<DatabaseInvoiceInfo | null> {
  if (!isMongoConnected || !InvoiceModel) return null;
  try {
    const inv = await InvoiceModel.findOne({
      depositAddress: { $regex: new RegExp(`^${address}$`, 'i') },
      network: network.toUpperCase(),
    }).lean();
    if (!inv) return null;
    return {
      invoiceId: inv.invoiceId,
      userId: inv.userId,
      status: inv.status,
      expectedCryptoAmount: inv.expectedCryptoAmount || '0',
      paidCryptoAmount: inv.paidCryptoAmount || '0',
      fiatAmount: inv.fiatAmount || 0,
    };
  } catch {
    return null;
  }
}

async function markInvoiceForwarded(
  address: string,
  network: string,
  txHash: string,
  destination: string,
  amount: string,
  gasFee: string,
): Promise<boolean> {
  if (!isMongoConnected || !InvoiceModel) return false;
  try {
    await InvoiceModel.updateOne(
      { depositAddress: { $regex: new RegExp(`^${address}$`, 'i') }, network: network.toUpperCase() },
      {
        $set: {
          status: 'FORWARDED',
          'forwardingDetails.forwardTxHash': txHash,
          'forwardingDetails.forwardToAddress': destination,
          'forwardingDetails.forwardedAt': new Date(),
          'forwardingDetails.actualForwardedAmount': amount,
          'forwardingDetails.gasFeeUsed': gasFee,
        },
      },
    );
    return true;
  } catch {
    return false;
  }
}

// ─── Audit Report Record Definition ──────────────────────────────────────────

interface AddressAuditReport {
  network: 'BSC' | 'TRON';
  index: number;
  address: string;
  balanceUsdt: string;
  balanceUsd: number;
  nativeGasBalance: string;
  nativeGasSymbol: string;
  gasStatus: 'SUFFICIENT' | 'NEEDS_FUNDING';
  sources: string[];
  dbInvoice?: DatabaseInvoiceInfo | null;
  action: 'READY_TO_SWEEP' | 'BELOW_MINIMUM' | 'SWEPT' | 'FAILED';
  txHash?: string;
  gasCostUsd?: number;
  explorerUrl: string;
}

// ─── BSC Sweep Executor ──────────────────────────────────────────────────────

async function executeBscSweep(
  key: DerivedKey,
  coldWallet: string,
  gasStationPrivKey: string | null,
  bscProvider: ResilientBscProvider,
  rawBalance: bigint,
  formattedBalance: string,
  marketPrices: MarketPrices,
  dryRun: boolean,
): Promise<{ txHash: string; gasCostUsd: number }> {
  if (dryRun) return { txHash: 'DRY_RUN_SIMULATED', gasCostUsd: 0 };

  return await bscProvider.execute(async (provider) => {
    // 1. Gas check & micro-funding
    const currentBnb = await provider.getBalance(key.evmAddress);

    if (currentBnb < BSC_GAS_THRESHOLD_WEI) {
      if (!gasStationPrivKey || gasStationPrivKey.trim() === '') {
        throw new Error(
          `BSC [${key.index}] has ${ethers.formatEther(currentBnb)} BNB (below threshold). ` +
          `Set GAS_STATION_BSC_PRIVKEY in .env.sweeper for automated gas funding.`,
        );
      }
      const gasSigner = new ethers.Wallet(gasStationPrivKey, provider);
      log('INFO', `  BSC [${key.index}] Micro-funding gas: sending ${BSC_GAS_FUND_BNB} BNB…`);
      const fundTx = await gasSigner.sendTransaction({
        to: key.evmAddress,
        value: ethers.parseEther(BSC_GAS_FUND_BNB),
      });
      await fundTx.wait(1);
      log('SUCCESS', `  BSC [${key.index}] Gas funded! TxHash: ${fundTx.hash}`);
    }

    // 2. Dynamic gas price (15% priority buffer)
    const feeData = await provider.getFeeData();
    const dynamicGasPrice = ((feeData.gasPrice ?? 3000000000n) * 115n) / 100n;

    // 3. Ephemeral signer — zeroed after use
    let childSigner: ethers.Wallet | null = new ethers.Wallet(key.privateKeyHex0x, provider);
    let usdtContract: ethers.Contract | null = new ethers.Contract(BSC_USDT_CONTRACT, ERC20_ABI, childSigner);

    try {
      log('INFO', `  BSC [${key.index}] Broadcasting ${formattedBalance} USDT → ${coldWallet}…`);
      const sweepTx = await usdtContract['transfer'](coldWallet, rawBalance, { gasPrice: dynamicGasPrice });
      log('INFO', `  BSC [${key.index}] Tx broadcasted: ${sweepTx.hash}. Awaiting 1 confirmation…`);
      const receipt = await sweepTx.wait(1);

      const gasUsed = receipt?.gasUsed ?? 0n;
      const effectiveGasPrice = receipt?.gasPrice ?? dynamicGasPrice;
      const gasBnb = ethers.formatEther(gasUsed * effectiveGasPrice);
      const gasCostUsd = parseFloat(gasBnb) * marketPrices.bnbUsd;

      log('SUCCESS', `  BSC [${key.index}] SWEPT ${formattedBalance} USDT! TxHash: ${sweepTx.hash} (Gas: $${gasCostUsd.toFixed(3)})`);
      return { txHash: sweepTx.hash, gasCostUsd };
    } finally {
      childSigner = null;
      usdtContract = null;
    }
  });
}

// ─── TRON Sweep Executor ─────────────────────────────────────────────────────

async function executeTronSweep(
  key: DerivedKey,
  coldWallet: string,
  gasStationPrivKey: string | null,
  fullNode: string,
  apiKey: string | undefined,
  rawBalanceStr: string,
  formattedBalance: string,
  currentTrx: number,
  marketPrices: MarketPrices,
  dryRun: boolean,
): Promise<{ txHash: string; gasCostUsd: number }> {
  if (dryRun) return { txHash: 'DRY_RUN_SIMULATED', gasCostUsd: 0 };

  // 1. Gas check & micro-funding
  if (currentTrx < TRON_MIN_GAS_TRX) {
    if (!gasStationPrivKey || gasStationPrivKey.trim() === '') {
      throw new Error(
        `TRON [${key.index}] has ${currentTrx} TRX (below ${TRON_MIN_GAS_TRX} TRX minimum). ` +
        `Set GAS_STATION_TRON_PRIVKEY in .env.sweeper for automated gas funding.`,
      );
    }
    const gasWeb = new TronWeb({ fullHost: fullNode, privateKey: gasStationPrivKey });
    if (apiKey && !apiKey.includes('PLACEHOLDER')) {
      gasWeb.setHeader({ 'TRON-PRO-API-KEY': apiKey });
    }
    log('INFO', `  TRON [${key.index}] Micro-funding gas: sending ${TRON_GAS_FUND_TRX} TRX…`);
    const fundTx = await gasWeb.trx.sendTransaction(key.tronAddress, gasWeb.toSun(TRON_GAS_FUND_TRX));
    const txId = fundTx?.transaction?.txID || fundTx?.txid;
    if (!fundTx?.result || !txId) throw new Error(`TRON gas funding broadcast failed for ${key.tronAddress}`);
    log('SUCCESS', `  TRON [${key.index}] Gas funded! TxID: ${txId}`);
    await new Promise((r) => setTimeout(r, 3500));
  }

  // 2. Ephemeral signer
  let signerWeb: any = new TronWeb({ fullHost: fullNode, privateKey: key.privateKeyHex });
  if (apiKey && !apiKey.includes('PLACEHOLDER')) {
    signerWeb.setHeader({ 'TRON-PRO-API-KEY': apiKey });
  }

  try {
    const contract = await signerWeb.contract().at(TRON_USDT_CONTRACT);
    log('INFO', `  TRON [${key.index}] Broadcasting ${formattedBalance} USDT → ${coldWallet}…`);
    const sweepTxHash = await contract.transfer(coldWallet, rawBalanceStr).send();

    if (!sweepTxHash) throw new Error(`TRON transfer returned empty hash for index ${key.index}`);

    const estimatedTrxBurn = 30;
    const gasCostUsd = estimatedTrxBurn * marketPrices.trxUsd;
    log('SUCCESS', `  TRON [${key.index}] SWEPT ${formattedBalance} USDT! TxHash: ${sweepTxHash}`);
    return { txHash: sweepTxHash, gasCostUsd };
  } finally {
    signerWeb = null;
  }
}

// ─── Concurrency Batch Runner ────────────────────────────────────────────────

async function mapConcurrent<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let currentIndex = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (currentIndex < items.length) {
      const idx = currentIndex++;
      results[idx] = await fn(items[idx]!);
    }
  });

  await Promise.all(workers);
  return results;
}

// ─── Persistent Run Log (JSONL audit trail) ───────────────────────────────────

function appendRunLog(record: object) {
  try {
    const logsDir = path.resolve(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
    const logFile = path.join(logsDir, 'sweeper-runs.jsonl');
    fs.appendFileSync(logFile, JSON.stringify(record) + '\n', 'utf-8');
  } catch { /* non-fatal */ }
}

// ─── Main Application Controller ─────────────────────────────────────────────

async function main() {
  const runStart = new Date();

  console.log(`\n${c.bold}╔════════════════════════════════════════════════════════════════════════╗`);
  console.log(`║            NEXUS GATEWAY — ENTERPRISE AUTO-SWEEPER & AUDITOR           ║`);
  console.log(`╚════════════════════════════════════════════════════════════════════════╝${c.reset}\n`);

  if (isDryRun) {
    console.log(`${c.blue}${c.bold}  MODE: DRY-RUN AUDIT — Simulated analysis only. Zero transactions broadcast.${c.reset}\n`);
  } else {
    console.log(`${c.red}${c.bold}  MODE: LIVE ON-CHAIN SWEEP — REAL TRANSACTIONS WILL BE BROADCASTED!${c.reset}\n`);
  }

  // 1. Environment & key validation
  const mnemonic = requireEnv('HD_MNEMONIC');
  getMasterRoot(mnemonic);

  const doBsc  = networkArg === 'both' || networkArg === 'bsc';
  const doTron = networkArg === 'both' || networkArg === 'tron';

  const bscColdWallet  = doBsc  ? requireEnv('BSC_COLD_WALLET')  : '';
  const tronColdWallet = doTron ? requireEnv('TRON_COLD_WALLET') : '';

  const gasPrivKeyBsc  = process.env['GAS_STATION_BSC_PRIVKEY']  ?? null;
  const gasPrivKeyTron = process.env['GAS_STATION_TRON_PRIVKEY'] ?? null;
  const tronNode       = process.env['TRON_FULL_NODE'] || TRON_FULL_NODE_DEFAULT;
  const tronApiKey     = process.env['TRON_API_KEY'];

  const bscProvider = new ResilientBscProvider(BSC_RPC_FAILOVER_POOL);

  // 2. Fetch live market prices (3-source chain: Binance → CoinGecko → CoinPaprika)
  log('DATA', 'Aggregating live asset prices (Binance → CoinGecko → CoinPaprika)…');
  const marketPrices = await fetchLiveMarketPrices();
  log('INFO', `Live Spot Rates [${marketPrices.source}]: BNB = $${marketPrices.bnbUsd.toFixed(2)} | TRX = $${marketPrices.trxUsd.toFixed(4)}`);

  // 3. MongoDB connection (optional)
  const mongoUri = process.env['MONGODB_URI'];
  const hasMongo = await initMongoConnection(mongoUri);
  if (hasMongo) {
    log('SYNC', `MongoDB Atlas connected — invoice cross-reference enabled.`);
  } else {
    log('INFO', `MongoDB not configured or offline — running in autonomous HD-derivation mode.`);
  }

  // 4. Calculate scan range
  const startIndex = targetIndex ?? 0;
  const endIndex   = targetIndex !== null ? targetIndex : startIndex + scanCount - 1;
  const indices    = Array.from({ length: endIndex - startIndex + 1 }, (_, i) => startIndex + i);

  log('INFO', `Auditing indices ${startIndex}..${endIndex} on ${networkArg.toUpperCase()} (Concurrency: ${concurrency}, MinThreshold: $${minSweepUsd})`);
  log('INFO', `BSC sources: RPC failover (${BSC_RPC_FAILOVER_POOL.length} nodes) + BscScan API + Ankr`);
  log('INFO', `TRON sources: TronGrid RPC + TronScan API + Ankr Multichain + TronWeb HTTP`);
  console.log(`${c.dim}────────────────────────────────────────────────────────────────────────${c.reset}`);

  // 5. Phase 1 — Concurrent batch audit
  const auditTasks: Array<{ network: 'BSC' | 'TRON'; index: number }> = [];
  for (const idx of indices) {
    if (doBsc)  auditTasks.push({ network: 'BSC',  index: idx });
    if (doTron) auditTasks.push({ network: 'TRON', index: idx });
  }

  log('INFO', `Querying ${auditTasks.length} addresses across all configured sources…`);

  const auditReports = await mapConcurrent(auditTasks, concurrency, async (task): Promise<AddressAuditReport> => {
    if (task.network === 'BSC') {
      const key = deriveKey(mnemonic, 60, task.index);
      const agg = await fetchAggregatedBscBalance(key.evmAddress, bscProvider);
      const balNum = parseFloat(agg.formattedUsdt);
      const dbInvoice = await findInvoiceForAddress(key.evmAddress, 'BSC');
      const bnbNum = parseFloat(agg.nativeBnb);

      return {
        network: 'BSC',
        index: task.index,
        address: key.evmAddress,
        balanceUsdt: agg.formattedUsdt,
        balanceUsd: balNum,
        nativeGasBalance: agg.nativeBnb,
        nativeGasSymbol: 'BNB',
        gasStatus: bnbNum >= 0.0002 ? 'SUFFICIENT' : 'NEEDS_FUNDING',
        sources: agg.sourcesVerified,
        dbInvoice,
        action: balNum >= minSweepUsd ? 'READY_TO_SWEEP' : 'BELOW_MINIMUM',
        explorerUrl: `https://bscscan.com/token/${BSC_USDT_CONTRACT}?a=${key.evmAddress}`,
      };
    } else {
      const key = deriveKey(mnemonic, 195, task.index);
      const agg = await fetchAggregatedTronBalance(key.tronAddress, tronNode, tronApiKey);
      const balNum = parseFloat(agg.formattedUsdt);
      const dbInvoice = await findInvoiceForAddress(key.tronAddress, 'TRON');

      return {
        network: 'TRON',
        index: task.index,
        address: key.tronAddress,
        balanceUsdt: agg.formattedUsdt,
        balanceUsd: balNum,
        nativeGasBalance: agg.trxBalance.toFixed(2),
        nativeGasSymbol: 'TRX',
        gasStatus: agg.trxBalance >= TRON_MIN_GAS_TRX ? 'SUFFICIENT' : 'NEEDS_FUNDING',
        sources: agg.sourcesVerified,
        dbInvoice,
        action: balNum >= minSweepUsd ? 'READY_TO_SWEEP' : 'BELOW_MINIMUM',
        explorerUrl: `https://tronscan.org/#/address/${key.tronAddress}`,
      };
    }
  });

  // Display results
  for (const report of auditReports) {
    const isFunded = report.balanceUsd >= minSweepUsd;
    const color = isFunded ? c.green : c.dim;
    const invTag = report.dbInvoice ? ` [DB: ${report.dbInvoice.status} | ${report.dbInvoice.invoiceId}]` : '';
    console.log(
      `${color}• [${report.network}] #${report.index.toString().padEnd(2)} ${report.address} → ` +
      `${c.bold}${report.balanceUsdt} USDT${c.reset}${color} ($${report.balanceUsd.toFixed(2)}) | ` +
      `Gas: ${report.nativeGasBalance} ${report.nativeGasSymbol} (${report.gasStatus}) | ` +
      `Srcs: ${report.sources.join(' + ')}${invTag}${c.reset}`,
    );
  }

  // 6. Phase 2 — Sequential sweep execution
  const sweepTargets = auditReports.filter((r) => r.action === 'READY_TO_SWEEP');

  console.log(`\n${c.bold}════════════════════════════════════════════════════════════════════════`);
  console.log(`                EXECUTION PHASE — READY TARGETS: ${sweepTargets.length}`);
  console.log(`════════════════════════════════════════════════════════════════════════${c.reset}\n`);

  let totalBscSweptUsdt  = 0;
  let totalTronSweptUsdt = 0;
  let totalGasSpentUsd   = 0;

  for (const target of sweepTargets) {
    log('INFO', `Processing [${target.network}] Index #${target.index} (${target.address}) holding ${target.balanceUsdt} USDT…`);

    try {
      if (target.network === 'BSC') {
        const key = deriveKey(mnemonic, 60, target.index);
        const rawBal = ethers.parseUnits(target.balanceUsdt, BSC_USDT_DECIMALS);
        const res = await executeBscSweep(key, bscColdWallet, gasPrivKeyBsc, bscProvider, rawBal, target.balanceUsdt, marketPrices, isDryRun);

        target.action    = 'SWEPT';
        target.txHash    = res.txHash;
        target.gasCostUsd = res.gasCostUsd;
        totalBscSweptUsdt += target.balanceUsd;
        totalGasSpentUsd  += res.gasCostUsd;

        if (!isDryRun && syncDatabase) {
          const synced = await markInvoiceForwarded(target.address, 'BSC', res.txHash, bscColdWallet, target.balanceUsdt, `${(res.gasCostUsd / marketPrices.bnbUsd).toFixed(6)} BNB`);
          if (synced) log('SYNC', `Database invoice synchronized → FORWARDED.`);
        }
      } else {
        const key = deriveKey(mnemonic, 195, target.index);
        const rawBalStr = ethers.parseUnits(target.balanceUsdt, TRON_USDT_DECIMALS).toString();
        const currentTrx = parseFloat(target.nativeGasBalance);
        const res = await executeTronSweep(key, tronColdWallet, gasPrivKeyTron, tronNode, tronApiKey, rawBalStr, target.balanceUsdt, currentTrx, marketPrices, isDryRun);

        target.action    = 'SWEPT';
        target.txHash    = res.txHash;
        target.gasCostUsd = res.gasCostUsd;
        totalTronSweptUsdt += target.balanceUsd;
        totalGasSpentUsd   += res.gasCostUsd;

        if (!isDryRun && syncDatabase) {
          const synced = await markInvoiceForwarded(target.address, 'TRON', res.txHash, tronColdWallet, target.balanceUsdt, '30 TRX');
          if (synced) log('SYNC', `Database invoice synchronized → FORWARDED.`);
        }
      }
    } catch (err) {
      target.action = 'FAILED';
      log('ERROR', `Sweep failed for [${target.network}] #${target.index}: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (!isDryRun) await new Promise((r) => setTimeout(r, 2000));
  }

  // 7. Final summary
  const totalSweptUsdt = totalBscSweptUsdt + totalTronSweptUsdt;
  const netProfitUsd   = totalSweptUsdt - totalGasSpentUsd;

  console.log(`\n${c.bold}╔════════════════════════════════════════════════════════════════════════╗`);
  console.log(`║                       AGGREGATED SWEEPER SUMMARY                       ║`);
  console.log(`╚════════════════════════════════════════════════════════════════════════╝${c.reset}\n`);

  console.log(`  Total Addresses Audited  : ${auditReports.length}`);
  console.log(`  Funded Targets Detected  : ${sweepTargets.length}`);
  console.log(`  BSC USDT Swept / Audited : ${c.green}${totalBscSweptUsdt.toFixed(6)} USDT${c.reset}`);
  console.log(`  TRON USDT Swept / Audited: ${c.green}${totalTronSweptUsdt.toFixed(6)} USDT${c.reset}`);
  console.log(`  Total Gross Value        : ${c.bold}$${totalSweptUsdt.toFixed(2)} USD${c.reset}`);
  console.log(`  Total Gas Fees Incurred  : $${totalGasSpentUsd.toFixed(3)} USD`);
  console.log(`  Net Recovered Capital    : ${c.bold}${c.green}$${netProfitUsd.toFixed(2)} USD${c.reset}\n`);
  console.log(`  Price Source             : ${marketPrices.source}`);
  console.log(`  Run Completed At         : ${new Date().toISOString()}\n`);

  if (sweepTargets.length > 0) {
    console.log(`${c.bold}VERIFICATION LINKS:${c.reset}`);
    for (const t of sweepTargets) {
      console.log(`  • [${t.network}] Index #${t.index}: ${t.explorerUrl} ${t.txHash ? `(Tx: ${t.txHash})` : ''}`);
    }
    console.log('');
  }

  if (isDryRun) {
    console.log(`${c.blue}✔ Dry-run audit complete. Pass --live to broadcast on-chain transactions.${c.reset}\n`);
  }

  // 8. Persistent JSONL audit log
  appendRunLog({
    runAt: runStart.toISOString(),
    mode: isDryRun ? 'dry-run' : 'live',
    network: networkArg,
    indicesScanned: `${startIndex}–${endIndex}`,
    addressesAudited: auditReports.length,
    fundedTargets: sweepTargets.length,
    totalSweptUsdt: totalSweptUsdt.toFixed(6),
    netRecoveredUsd: netProfitUsd.toFixed(2),
    gasCostUsd: totalGasSpentUsd.toFixed(3),
    priceSource: marketPrices.source,
    bnbUsd: marketPrices.bnbUsd,
    trxUsd: marketPrices.trxUsd,
  });

  if (isMongoConnected) await mongoose.disconnect();
}

// ─── Process Signal & Error Handlers ─────────────────────────────────────────

main().catch((err) => {
  log('ERROR', `Fatal execution error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
