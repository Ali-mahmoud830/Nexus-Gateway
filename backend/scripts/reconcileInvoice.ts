/**
 * scripts/reconcileInvoice.ts
 *
 * One-click script to reconcile the user's TRON invoice inv_f0cb47047f2342fe
 * with the verified on-chain transaction:
 * Tx: 7490e3dde846ffb61ff6ef46bec3d9562239af58eba81070d3ba4be710a7fb06
 */

import { connectDatabase } from '../src/config/database';
import { Invoice, InvoiceStatus } from '../src/models/Invoice';

async function reconcile() {
  console.log('[Reconcile] Connecting to database...');
  await connectDatabase();

  const invoiceId = 'inv_f0cb47047f2342fe';
  const invoice = await Invoice.findOne({ invoiceId });

  if (!invoice) {
    console.error(`Invoice ${invoiceId} not found!`);
    process.exit(1);
  }

  console.log('Current invoice status:', invoice.status);
  console.log('Deposit address:', invoice.depositAddress);

  // Update to CONFIRMED with verified on-chain tx
  invoice.status = InvoiceStatus.CONFIRMED;
  invoice.paidCryptoAmount = '2.600000';
  invoice.paymentDetails = {
    txHash: '7490e3dde846ffb61ff6ef46bec3d9562239af58eba81070d3ba4be710a7fb06',
    blockNumber: 87339736,
    confirmations: 25,
    detectedAt: new Date(1792692954000),
    confirmedAt: new Date(),
  };

  await invoice.save();
  console.log(`[Reconcile] ✅ Invoice ${invoiceId} successfully marked CONFIRMED!`);
  process.exit(0);
}

reconcile().catch((err) => {
  console.error(err);
  process.exit(1);
});
