/**
 * tools/sweeper/sweep.ts
 *
 * ╔══════════════════════════════════════════════════════════════╗
 * ║          NEXUS GATEWAY — STANDALONE AUTO-SWEEPER            ║
 * ║                                                              ║
 * ║  Purpose : Forward USDT from HD-derived deposit addresses   ║
 * ║            to your designated cold wallet (BSC & TRON).     ║
 * ║                                                              ║
 * ║  Runs    : Independently of the main gateway server.        ║
 * ║  Mode    : DRY_RUN (simulate only) or LIVE (broadcast tx)   ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * USAGE
 * ─────
 *   # Simulate — no transactions broadcast (safe to test)
 *   npx tsx tools/sweeper/sweep.ts --dry-run
 *
 *   # Sweep a specific address (dry-run first, then live)
 *   npx tsx tools/sweeper/sweep.ts --dry-run  --network bsc  --index 0
 *   npx tsx tools/sweeper/sweep.ts --live      --network bsc  --index 0
 *
 *   # Sweep all indices 0-19 (dry-run)
 *   npx tsx tools/sweeper/sweep.ts --dry-run --network tron --scan 20
 *
 * ENVIRONMENT (copy .env.sweeper.example → .env.sweeper and fill in)
 * ───────────────────────────────────────────────────────────────────
 *   HD_MNEMONIC              — your 12/24-word BIP-39 mnemonic
 *   BSC_COLD_WALLET          — destination BSC address
 *   TRON_COLD_WALLET         — destination TRON address
 *   GAS_STATION_BSC_PRIVKEY  — BSC hot wallet private key (0x…) for gas top-ups
 *   GAS_STATION_TRON_PRIVKEY — TRON hot wallet private key (hex) for TRX top-ups
 *   BSC_RPC                  — (optional) custom BSC RPC
 *   TRON_FULL_NODE           — (optional) custom TRON full node
 */

import dotenv from 'dotenv';
import path from 'path';
import { ethers } from 'ethers';
import * as bip39 from 'bip39';
import HDKey from 'hdkey';
import TronWeb from 'tronweb';

// ─── Load .env.sweeper (located next to this script) ──────────────────────────
dotenv.config({ path: path.resolve(__dirname, '.env.sweeper') });

// ─── Constants ────────────────────────────────────────────────────────────────

/** BEP-20 / ERC-20 ABI (balanceOf + transfer only) */
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 value) returns (bool)',
];

const BSC_USDT_CONTRACT  = '0x55d398326f99059fF77548524799027B3197955'; // BEP-20 USDT
const TRON_USDT_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';       // TRC-20 USDT

const BSC_USDT_DECIMALS  = 18;
const TRON_USDT_DECIMALS = 6;

const MIN_SWEEP_USD      = 0.5;  // Skip addresses with < $0.50 USDT
const BSC_GAS_FUND_BNB   = '0.0005';  // BNB sent to temp wallet before sweep
const TRON_GAS_FUND_TRX  = 20;        // TRX sent to temp wallet before sweep

// HD derivation paths
const BSC_PATH_PREFIX  = "m/44'/60'/0'/0";   // EVM-compatible
const TRON_PATH_PREFIX = "m/44'/195'/0'/0";  // TRON BIP-44

// ─── CLI argument parsing ─────────────────────────────────────────────────────

const args = process.argv.slice(2);

const isDryRun  = args.includes('--dry-run') || !args.includes('--live');
const isLive    = args.includes('--live');
const networkArg = args.find((_, i) => args[i - 1] === '--network') ?? 'both';
const indexArg  = args.find((_, i) => args[i - 1] === '--index');
const scanArg   = args.find((_, i) => args[i - 1] === '--scan');

const targetIndex = indexArg !== undefined ? parseInt(indexArg, 10) : null;
const scanCount   = scanArg  !== undefined ? parseInt(scanArg,  10) : (targetIndex !== null ? 1 : 5);

// ─── Logging ──────────────────────────────────────────────────────────────────

const c = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  red:    '\x1b[31m',
  cyan:   '\x1b[36m',
  blue:   '\x1b[34m',
  white:  '\x1b[37m',
};

function log(level: 'INFO' | 'WARN' | 'ERROR' | 'DRY' | 'SUCCESS', msg: string) {
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const colors: Record<string, string> = {
    INFO:    c.cyan,
    WARN:    c.yellow,
    ERROR:   c.red,
    DRY:     c.blue,
    SUCCESS: c.green,
  };
  console.log(`${c.dim}[${ts}]${c.reset} ${colors[level]}[${level}]${c.reset} ${msg}`);
}

// ─── Environment validation ───────────────────────────────────────────────────

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val || val.trim() === '') {
    throw new Error(`Missing required env var: ${key} — check your .env.sweeper file`);
  }
  return val.trim();
}

// ─── HD Wallet Key Derivation ─────────────────────────────────────────────────

interface DerivedKey {
  index: number;
  privateKeyHex: string;    // Raw hex (no 0x prefix) for TRON
  privateKeyHex0x: string;  // 0x-prefixed for EVM
  evmAddress: string;       // Checksummed EVM address
  tronAddress: string;      // Base58Check TRON address
}

function deriveKey(mnemonic: string, coinType: 60 | 195, index: number): DerivedKey {
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const root = HDKey.fromMasterSeed(seed);
  const path = `m/44'/${coinType}'/0'/0/${index}`;
  const child = root.derive(path);

  if (!child.privateKey) {
    throw new Error(`[HDKey] Failed to derive key at path ${path}`);
  }

  const privateKeyHex   = child.privateKey.toString('hex');
  const privateKeyHex0x = `0x${privateKeyHex}`;
  const evmAddress      = ethers.computeAddress(privateKeyHex0x);

  // Convert EVM hex address → TRON Base58Check
  const tronAddressHex = `41${evmAddress.slice(2).toLowerCase()}`;
  const tronAddress    = TronWeb.address.fromHex(tronAddressHex);

  return { index, privateKeyHex, privateKeyHex0x, evmAddress, tronAddress };
}

// ─── BSC Sweeper ──────────────────────────────────────────────────────────────

async function sweepBscAddress(
  key: DerivedKey,
  coldWallet: string,
  gasPrivKey: string | null,
  provider: ethers.JsonRpcProvider,
  dryRun: boolean,
): Promise<{ swept: string; txHash: string } | null> {
  const contract = new ethers.Contract(BSC_USDT_CONTRACT, ERC20_ABI, provider);
  const rawBalance: bigint = await contract['balanceOf'](key.evmAddress);
  const formatted = ethers.formatUnits(rawBalance, BSC_USDT_DECIMALS);
  const amount    = parseFloat(formatted);

  log('INFO', `  BSC [${key.index}] ${key.evmAddress} → ${formatted} USDT`);

  if (amount < MIN_SWEEP_USD) {
    log('WARN', `  BSC [${key.index}] Balance below minimum (${MIN_SWEEP_USD} USDT). Skipping.`);
    return null;
  }

  if (dryRun) {
    log('DRY', `  BSC [${key.index}] DRY-RUN: Would sweep ${formatted} USDT → ${coldWallet}`);
    return { swept: formatted, txHash: 'DRY_RUN_NO_TX' };
  }

  // ── 1. Fund gas if needed ─────────────────────────────────────────────────
  const bnbBalance = await provider.getBalance(key.evmAddress);
  const minGasWei  = ethers.parseEther('0.0002');

  if (bnbBalance < minGasWei) {
    if (!gasPrivKey) {
      throw new Error(`BSC [${key.index}] needs BNB for gas but GAS_STATION_BSC_PRIVKEY is not set.`);
    }
    const gasSigner  = new ethers.Wallet(gasPrivKey, provider);
    log('INFO', `  BSC [${key.index}] Funding gas: sending ${BSC_GAS_FUND_BNB} BNB…`);
    const fundTx = await gasSigner.sendTransaction({
      to:    key.evmAddress,
      value: ethers.parseEther(BSC_GAS_FUND_BNB),
    });
    await fundTx.wait(1);
    log('SUCCESS', `  BSC [${key.index}] Gas funded! TxHash: ${fundTx.hash}`);
  }

  // ── 2. Broadcast USDT transfer ────────────────────────────────────────────
  const signer         = new ethers.Wallet(key.privateKeyHex0x, provider);
  const contractSigned = new ethers.Contract(BSC_USDT_CONTRACT, ERC20_ABI, signer);

  log('INFO', `  BSC [${key.index}] Broadcasting transfer of ${formatted} USDT → ${coldWallet}…`);
  const tx = await contractSigned['transfer'](coldWallet, rawBalance);

  log('INFO', `  BSC [${key.index}] Tx broadcasted: ${tx.hash}. Awaiting confirmation…`);
  const receipt = await tx.wait(1);

  const gasUsed  = receipt?.gasUsed  ?? 0n;
  const gasPrice = receipt?.gasPrice ?? 0n;
  const gasFee   = ethers.formatEther(gasUsed * gasPrice);

  log('SUCCESS', `  BSC [${key.index}] ✅ SWEPT ${formatted} USDT! TxHash: ${tx.hash} | Gas: ${gasFee} BNB`);
  return { swept: formatted, txHash: tx.hash };
}

// ─── TRON Sweeper ─────────────────────────────────────────────────────────────

async function sweepTronAddress(
  key: DerivedKey,
  coldWallet: string,
  gasPrivKey: string | null,
  fullNode: string,
  dryRun: boolean,
): Promise<{ swept: string; txHash: string } | null> {
  const readOnly = new TronWeb({ fullHost: fullNode });

  const contract = await readOnly.contract().at(TRON_USDT_CONTRACT);
  const rawBal   = await contract.balanceOf(key.tronAddress).call();
  const rawStr   = rawBal.toString();
  const formatted = ethers.formatUnits(rawStr, TRON_USDT_DECIMALS);
  const amount    = parseFloat(formatted);

  log('INFO', `  TRON [${key.index}] ${key.tronAddress} → ${formatted} USDT`);

  if (amount < MIN_SWEEP_USD) {
    log('WARN', `  TRON [${key.index}] Balance below minimum (${MIN_SWEEP_USD} USDT). Skipping.`);
    return null;
  }

  if (dryRun) {
    log('DRY', `  TRON [${key.index}] DRY-RUN: Would sweep ${formatted} USDT → ${coldWallet}`);
    return { swept: formatted, txHash: 'DRY_RUN_NO_TX' };
  }

  // ── 1. Fund TRX gas if needed ─────────────────────────────────────────────
  const trxBalSun = await readOnly.trx.getBalance(key.tronAddress);
  const trxBal    = readOnly.fromSun(trxBalSun);

  if (trxBal < TRON_GAS_FUND_TRX) {
    if (!gasPrivKey) {
      throw new Error(`TRON [${key.index}] needs TRX for gas but GAS_STATION_TRON_PRIVKEY is not set.`);
    }
    const gasWeb = new TronWeb({ fullHost: fullNode, privateKey: gasPrivKey });
    log('INFO', `  TRON [${key.index}] Funding gas: sending ${TRON_GAS_FUND_TRX} TRX…`);
    const fundTx = await gasWeb.trx.sendTransaction(key.tronAddress, gasWeb.toSun(TRON_GAS_FUND_TRX));
    if (!fundTx?.result) {
      throw new Error(`TRON gas funding failed for ${key.tronAddress}`);
    }
    log('SUCCESS', `  TRON [${key.index}] TRX gas funded! TxID: ${fundTx.transaction?.txID}`);
    // Wait for TRON block (~3 seconds)
    await new Promise((r) => setTimeout(r, 3500));
  }

  // ── 2. Broadcast TRC-20 transfer ──────────────────────────────────────────
  const signerWeb  = new TronWeb({ fullHost: fullNode, privateKey: key.privateKeyHex });
  const contractSigned = await signerWeb.contract().at(TRON_USDT_CONTRACT);

  log('INFO', `  TRON [${key.index}] Broadcasting transfer of ${formatted} USDT → ${coldWallet}…`);
  const txHash = await contractSigned.transfer(coldWallet, rawStr).send();

  if (!txHash) {
    throw new Error(`TRON transfer returned empty txHash for index ${key.index}`);
  }

  log('SUCCESS', `  TRON [${key.index}] ✅ SWEPT ${formatted} USDT! TxHash: ${txHash}`);
  return { swept: formatted, txHash };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${c.bold}╔══════════════════════════════════════════╗`);
  console.log(`║   NEXUS GATEWAY — STANDALONE SWEEPER   ║`);
  console.log(`╚══════════════════════════════════════════╝${c.reset}\n`);

  if (isDryRun) {
    console.log(`${c.blue}${c.bold}  MODE: DRY-RUN — No transactions will be broadcast.${c.reset}\n`);
  } else {
    console.log(`${c.red}${c.bold}  MODE: LIVE — Real transactions WILL be broadcast!${c.reset}\n`);
  }

  // ── Validate env ───────────────────────────────────────────────────────────
  const mnemonic = requireEnv('HD_MNEMONIC');

  if (!bip39.validateMnemonic(mnemonic)) {
    throw new Error('HD_MNEMONIC is not a valid BIP-39 mnemonic phrase.');
  }

  const doBsc  = networkArg === 'both' || networkArg === 'bsc';
  const doTron = networkArg === 'both' || networkArg === 'tron';

  const bscColdWallet  = doBsc  ? requireEnv('BSC_COLD_WALLET')  : '';
  const tronColdWallet = doTron ? requireEnv('TRON_COLD_WALLET') : '';

  const gasPrivKeyBsc  = process.env['GAS_STATION_BSC_PRIVKEY']  ?? null;
  const gasPrivKeyTron = process.env['GAS_STATION_TRON_PRIVKEY'] ?? null;

  const bscRpc    = process.env['BSC_RPC']        ?? 'https://bsc-dataseed.binance.org';
  const tronNode  = process.env['TRON_FULL_NODE'] ?? 'https://api.trongrid.io';

  const provider  = doBsc ? new ethers.JsonRpcProvider(bscRpc) : null;

  // ── Determine which indices to scan ──────────────────────────────────────
  const startIndex = targetIndex ?? 0;
  const endIndex   = targetIndex !== null ? targetIndex : startIndex + scanCount - 1;

  log('INFO', `Scanning indices ${startIndex}–${endIndex} on ${networkArg.toUpperCase()} network(s)`);
  log('INFO', `BSC RPC : ${bscRpc}`);
  log('INFO', `TRON    : ${tronNode}`);
  console.log('');

  // ── Summary accumulators ──────────────────────────────────────────────────
  let totalSweptBsc  = 0;
  let totalSweptTron = 0;
  const sweepResults: Array<{ network: string; index: number; amount: string; txHash: string }> = [];

  // ── Main scan loop ────────────────────────────────────────────────────────
  for (let idx = startIndex; idx <= endIndex; idx++) {
    console.log(`${c.dim}────────────────────────────────────────${c.reset}`);
    log('INFO', `Scanning index ${idx}…`);

    if (doBsc && provider) {
      try {
        const key    = deriveKey(mnemonic, 60, idx);
        const result = await sweepBscAddress(key, bscColdWallet, gasPrivKeyBsc, provider, isDryRun);
        if (result) {
          totalSweptBsc += parseFloat(result.swept);
          sweepResults.push({ network: 'BSC', index: idx, amount: result.swept, txHash: result.txHash });
        }
      } catch (err) {
        log('ERROR', `BSC [${idx}] ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (doTron) {
      try {
        const key    = deriveKey(mnemonic, 195, idx);
        const result = await sweepTronAddress(key, tronColdWallet, gasPrivKeyTron, tronNode, isDryRun);
        if (result) {
          totalSweptTron += parseFloat(result.swept);
          sweepResults.push({ network: 'TRON', index: idx, amount: result.swept, txHash: result.txHash });
        }
      } catch (err) {
        log('ERROR', `TRON [${idx}] ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Small delay between indices to be polite to RPC nodes
    if (idx < endIndex) {
      await new Promise((r) => setTimeout(r, 800));
    }
  }

  // ── Final summary ─────────────────────────────────────────────────────────
  console.log(`\n${c.bold}╔══════════════════════════════════════════╗`);
  console.log(`║               SWEEP SUMMARY              ║`);
  console.log(`╚══════════════════════════════════════════╝${c.reset}`);

  if (sweepResults.length === 0) {
    log('INFO', 'No addresses had sufficient balance to sweep.');
  } else {
    console.log('');
    for (const r of sweepResults) {
      log('SUCCESS', `[${r.network}] Index ${r.index} → ${r.amount} USDT | TxHash: ${r.txHash}`);
    }
    console.log('');
    if (doBsc)  log('SUCCESS', `Total BSC  swept: ${totalSweptBsc.toFixed(6)} USDT`);
    if (doTron) log('SUCCESS', `Total TRON swept: ${totalSweptTron.toFixed(6)} USDT`);
  }

  if (isDryRun) {
    console.log(`\n${c.blue}  ✔ Dry-run complete. Run with --live to broadcast real transactions.${c.reset}\n`);
  }
}

main().catch((err) => {
  log('ERROR', `Fatal: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
