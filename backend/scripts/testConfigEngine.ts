/**
 * scripts/testConfigEngine.ts
 *
 * Verifies GatewayConfig singleton initialization and percentage fee calculations.
 */

import { connectDatabase } from '../src/config/database';
import { GatewayConfig } from '../src/models/GatewayConfig';
import { CryptoNetwork } from '../src/models/Invoice';

async function runTest() {
  console.log('[TestConfigEngine] Connecting to DB...');
  await connectDatabase();

  console.log('[TestConfigEngine] Fetching active config...');
  const config = await GatewayConfig.getActiveConfig();
  console.log('Active Configuration:', {
    bscFeePercent: `${config.bscFeePercent}%`,
    tronFeePercent: `${config.tronFeePercent}%`,
    minBscFeeUsd: `$${config.minBscFeeUsd}`,
    minTronFeeUsd: `$${config.minTronFeeUsd}`,
  });

  // Test TRON fee calculations
  const depositAmounts = [10, 50, 100, 500, 1000];
  console.log('\n--- TRON Fee Simulation (Rate: ' + config.tronFeePercent + '%, Floor: $' + config.minTronFeeUsd + ') ---');
  for (const amt of depositAmounts) {
    const rawFee = (amt * config.tronFeePercent) / 100;
    const finalFee = Math.max(rawFee, config.minTronFeeUsd);
    const totalExpected = amt + finalFee;
    console.log(`Deposit: $${amt.toFixed(2)} -> Fee: $${finalFee.toFixed(2)} -> Total Expected: ${totalExpected.toFixed(6)} USDT`);
  }

  // Test BSC fee calculations
  console.log('\n--- BSC Fee Simulation (Rate: ' + config.bscFeePercent + '%, Floor: $' + config.minBscFeeUsd + ') ---');
  for (const amt of depositAmounts) {
    const rawFee = (amt * config.bscFeePercent) / 100;
    const finalFee = Math.max(rawFee, config.minBscFeeUsd);
    const totalExpected = amt + finalFee;
    console.log(`Deposit: $${amt.toFixed(2)} -> Fee: $${finalFee.toFixed(2)} -> Total Expected: ${totalExpected.toFixed(6)} USDT`);
  }

  process.exit(0);
}

runTest().catch((err) => {
  console.error(err);
  process.exit(1);
});
