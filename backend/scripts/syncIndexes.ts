/**
 * scripts/syncIndexes.ts
 * One-time script to push all Mongoose indexes to MongoDB Atlas.
 * Run with: npx tsx scripts/syncIndexes.ts
 */
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import mongoose from 'mongoose';
import { Invoice } from '../src/models/Invoice';
import { Counter } from '../src/models/Counter';

async function main(): Promise<void> {
  const uri = process.env['MONGODB_URI'];
  const dbName = process.env['MONGODB_DB_NAME'];
  if (!uri || !dbName) throw new Error('MONGODB_URI or MONGODB_DB_NAME not set in .env');

  console.log('\n[SyncIndexes] Connecting to Atlas...');
  await mongoose.connect(uri, {
    dbName,
    serverSelectionTimeoutMS: 15000,
    tls: true,
  });
  console.log(`[SyncIndexes] Connected to: ${dbName}\n`);

  console.log('[SyncIndexes] Syncing Invoice indexes...');
  await Invoice.syncIndexes();

  const invoiceIdxs = await Invoice.collection.listIndexes().toArray();
  console.log(`[SyncIndexes] Invoice collection has ${invoiceIdxs.length} index(es):`);
  invoiceIdxs.forEach((idx) => {
    const unique = idx.unique ? ' [UNIQUE]' : '';
    console.log(`  • ${JSON.stringify(idx.key)}${unique} → "${idx.name}"`);
  });

  console.log('\n[SyncIndexes] Syncing Counter indexes...');
  await Counter.syncIndexes();

  const counterIdxs = await Counter.collection.listIndexes().toArray();
  console.log(`[SyncIndexes] Counter collection has ${counterIdxs.length} index(es):`);
  counterIdxs.forEach((idx) => {
    console.log(`  • ${JSON.stringify(idx.key)} → "${idx.name}"`);
  });

  await mongoose.disconnect();
  console.log('\n[SyncIndexes] ✅ All indexes synced successfully. Atlas is ready.\n');
}

main().catch((err: unknown) => {
  console.error('[SyncIndexes] FAILED:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
