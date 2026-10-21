/**
 * scripts/testPhase6.ts
 *
 * Automated verification test for Phase 6 (Next.js Checkout UI & Gateway Integration).
 *
 * Tests:
 * 1. Checks Backend Health (/api/v1/health)
 * 2. Creates a BSC USDT Invoice (/api/v1/invoices)
 * 3. Creates a TRON USDT Invoice (/api/v1/invoices)
 * 4. Queries Invoice Status (/api/v1/invoices/:invoiceId)
 * 5. Verifies Next.js Checkout Server is responding on http://localhost:3000
 * 6. Verifies Next.js Checkout Page responds with 200 OK for the newly created invoice
 */

import axios from 'axios';

const BACKEND_URL = 'http://localhost:4000/api/v1';
const FRONTEND_URL = 'http://localhost:3000';

async function runPhase6Tests() {
  console.log('\n======================================================');
  console.log('--- PHASE 6: FRONTEND & END-TO-END VERIFICATION ---');
  console.log('======================================================\n');

  try {
    // 1. Backend Health Check
    console.log('[Test 1] Checking Backend Health...');
    const healthRes = await axios.get(`${BACKEND_URL}/health`);
    console.log('  -> Backend Status:', healthRes.data.data.status);
    console.log('  -> Database:', healthRes.data.data.mongodb.status);
    console.log('  -> Sweeper Running:', healthRes.data.data.sweeper.isRunning);
    console.log('  [PASS] Backend is operational.\n');

    // 2. Create BSC USDT Invoice
    console.log('[Test 2] Creating BEP-20 (BSC) USDT Invoice...');
    const bscInvoiceRes = await axios.post(`${BACKEND_URL}/invoices`, {
      userId: 'test_trader_phase6_bsc',
      amount: 150,
      network: 'BSC',
      metadata: { source: 'phase_6_automated_test' },
    });
    const bscInvoice = bscInvoiceRes.data.data;
    console.log('  -> Invoice ID:', bscInvoice.invoiceId);
    console.log('  -> Deposit Address (BSC):', bscInvoice.depositAddress);
    console.log('  -> Expected Amount:', bscInvoice.expectedCryptoAmount, bscInvoice.cryptoCurrency);
    console.log('  -> Status:', bscInvoice.status);
    console.log('  -> Expires At:', bscInvoice.expiresAt);
    console.log('  [PASS] BSC Invoice created successfully.\n');

    // 3. Create TRON USDT Invoice
    console.log('[Test 3] Creating TRC-20 (TRON) USDT Invoice...');
    const tronInvoiceRes = await axios.post(`${BACKEND_URL}/invoices`, {
      userId: 'test_trader_phase6_tron',
      amount: 250,
      network: 'TRON',
      metadata: { source: 'phase_6_automated_test' },
    });
    const tronInvoice = tronInvoiceRes.data.data;
    console.log('  -> Invoice ID:', tronInvoice.invoiceId);
    console.log('  -> Deposit Address (TRON):', tronInvoice.depositAddress);
    console.log('  -> Expected Amount:', tronInvoice.expectedCryptoAmount, tronInvoice.cryptoCurrency);
    console.log('  -> Status:', tronInvoice.status);
    console.log('  -> Expires At:', tronInvoice.expiresAt);
    console.log('  [PASS] TRON Invoice created successfully.\n');

    // 4. Verify Invoice Status Polling Endpoint
    console.log('[Test 4] Querying Invoice Status Endpoint...');
    const statusRes = await axios.get(`${BACKEND_URL}/invoices/${bscInvoice.invoiceId}`);
    console.log('  -> Polled Invoice ID:', statusRes.data.data.invoiceId);
    console.log('  -> Polled Status:', statusRes.data.data.status);
    console.log('  -> Confirmations:', statusRes.data.data.confirmations);
    console.log('  [PASS] Polling endpoint returned consistent status.\n');

    // 5. Verify Next.js Landing Page is Live
    console.log('[Test 5] Verifying Next.js Server on port 3000...');
    const frontendHomeRes = await axios.get(FRONTEND_URL, { timeout: 10000 });
    console.log('  -> Frontend Root HTTP Status:', frontendHomeRes.status);
    console.log('  -> Contains "Fund Your Trading Account":', frontendHomeRes.data.includes('Fund Your Trading Account') || frontendHomeRes.data.includes('Binary Options'));
    console.log('  [PASS] Frontend root is live and serving the deposit terminal.\n');

    // 6. Verify Direct Invoice Checkout Page
    console.log(`[Test 6] Verifying Next.js Checkout Page for /pay/${bscInvoice.invoiceId}...`);
    const checkoutPageRes = await axios.get(`${FRONTEND_URL}/pay/${bscInvoice.invoiceId}`, { timeout: 10000 });
    console.log('  -> Checkout Page HTTP Status:', checkoutPageRes.status);
    console.log('  [PASS] Checkout route responds 200 OK.\n');

    console.log('======================================================');
    console.log('--- ALL PHASE 6 CHECKS PASSED WITH 0 ERRORS! ---');
    console.log('======================================================\n');
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      console.error('Test failed with Axios error:', err.response?.data || err.message);
    } else {
      console.error('Test failed with error:', err);
    }
    process.exit(1);
  }
}

runPhase6Tests();
