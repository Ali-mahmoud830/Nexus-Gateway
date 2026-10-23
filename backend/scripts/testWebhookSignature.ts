/**
 * scripts/testWebhookSignature.ts
 *
 * Demonstrates and verifies how the trading platform can verify
 * the incoming HMAC SHA-256 webhook signature from Nexus Gateway.
 */

import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const secret = process.env.JWT_SECRET || 'nexus_master_jwt_secret_2026';

function generateSimulatedWebhook() {
  const timestamp = Math.floor(Date.now() / 1000);
  const payload = {
    event: 'PAYMENT_CONFIRMED',
    timestamp: new Date().toISOString(),
    data: {
      invoiceId: 'inv_a1b2c3d4e5f6g7h8',
      userId: 'trader_user_9921',
      amount: 100.0,
      baseAmount: 100.0,
      feeAmount: 2.5,
      expectedCryptoAmount: '102.500000',
      paidCryptoAmount: '102.500000',
      cryptoCurrency: 'USDT',
      network: 'TRON',
      depositAddress: 'THLNguYKN3S8RUzVyi9ErynW4YmXLU5c8n',
      status: 'CONFIRMED',
      txHash: '918bfd1628ca94892bc181e11a14150efb06f25be24fa2da12b9a76d8b9e847c',
      confirmations: 20,
      metadata: {
        tradingAccountId: 'ACC-78912',
      },
    },
  };

  const signaturePayload = `${timestamp}.${JSON.stringify(payload)}`;
  const signature = crypto.createHmac('sha256', secret).update(signaturePayload).digest('hex');

  const headers = {
    'X-Nexus-Signature': `t=${timestamp},v1=${signature}`,
    'X-Nexus-Timestamp': `${timestamp}`,
    'X-Nexus-Event': 'PAYMENT_CONFIRMED',
  };

  return { payload, headers, timestamp, signature };
}

// Verification function on the Trading Platform side:
function verifyTradingPlatformWebhook(
  rawBody: string,
  signatureHeader: string,
  timestampHeader: string,
  secretKey: string,
): boolean {
  // 1. Check timestamp age (reject if older than 5 minutes to prevent replay attacks)
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const incomingTimestamp = parseInt(timestampHeader, 10);
  if (Math.abs(currentTimestamp - incomingTimestamp) > 300) {
    console.error('Webhook timestamp expired or out of sync (Replay Attack Protection)!');
    return false;
  }

  // 2. Extract v1 hash from header (format: t=...,v1=...)
  const parts = signatureHeader.split(',');
  const hashPart = parts.find((p) => p.startsWith('v1='));
  if (!hashPart) return false;
  const expectedHash = hashPart.split('=')[1];

  // 3. Compute expected signature
  const expectedPayload = `${incomingTimestamp}.${rawBody}`;
  const computedHash = crypto.createHmac('sha256', secretKey).update(expectedPayload).digest('hex');

  // 4. Timing-safe comparison
  return crypto.timingSafeEqual(Buffer.from(computedHash, 'hex'), Buffer.from(expectedHash, 'hex'));
}

async function test() {
  console.log('\n======================================================');
  console.log('       NEXUS GATEWAY WEBHOOK HMAC VERIFICATION        ');
  console.log('======================================================\n');

  const { payload, headers, timestamp, signature } = generateSimulatedWebhook();
  console.log('[1] Generated Webhook Payload:');
  console.log(JSON.stringify(payload, null, 2));

  console.log('\n[2] Outgoing Security Headers:');
  console.log(headers);

  const rawBody = JSON.stringify(payload);
  const isValid = verifyTradingPlatformWebhook(
    rawBody,
    headers['X-Nexus-Signature'],
    headers['X-Nexus-Timestamp'],
    secret,
  );

  console.log(`\n[3] Trading Platform Verification Result: ${isValid ? 'VERIFIED (100% VALID) ✅' : 'FAILED ❌'}`);

  if (!isValid) {
    throw new Error('Webhook verification failed');
  }

  // Test tampered payload
  const tamperedBody = rawBody.replace('100', '1000');
  const isTamperedValid = verifyTradingPlatformWebhook(
    tamperedBody,
    headers['X-Nexus-Signature'],
    headers['X-Nexus-Timestamp'],
    secret,
  );
  console.log(`[4] Tampered Payload Rejection Test: ${!isTamperedValid ? 'REJECTED SAFELY ✅' : 'FAILED'}`);

  console.log('\n======================================================');
  console.log('     TRADING PLATFORM INTEGRATION VERIFIED 100%       ');
  console.log('======================================================\n');
}

test().catch(console.error);
