/**
 * src/models/BlockCursor.ts
 *
 * Persists the latest processed block height for each blockchain network.
 *
 * Critical Resilience Feature:
 *   If the gateway server restarts, crashes, or is redeployed, the block
 *   scanners resume from the exact block where they left off, ensuring
 *   zero dropped deposit events or missed confirmations.
 */

import mongoose, { Schema, Model } from 'mongoose';
import { CryptoNetwork } from './Invoice';

export interface IBlockCursor {
  _id: CryptoNetwork;            // 'BSC' | 'TRON'
  lastScannedBlock: number;      // Latest processed block height
  lastScanTimestamp: Date;       // Timestamp of the latest scan iteration
  updatedAt?: Date;
}

export type IBlockCursorDocument = mongoose.HydratedDocument<IBlockCursor>;

export interface IBlockCursorModel extends Model<IBlockCursor> {
  getCursor(network: CryptoNetwork, fallbackBlock?: number): Promise<number>;
  setCursor(network: CryptoNetwork, blockNumber: number): Promise<void>;
}

const blockCursorSchema = new Schema<IBlockCursor, IBlockCursorModel>(
  {
    _id: {
      type: String,
      enum: Object.values(CryptoNetwork),
      required: true,
    },
    lastScannedBlock: {
      type: Number,
      required: true,
      min: 0,
    },
    lastScanTimestamp: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

/**
 * Retrieves the last scanned block number for a network.
 * If no record exists, initializes with the fallbackBlock (or current chain tip - 10).
 */
blockCursorSchema.statics.getCursor = async function (
  network: CryptoNetwork,
  fallbackBlock: number = 0,
): Promise<number> {
  const cursor = await this.findById(network);
  if (!cursor) {
    if (fallbackBlock > 0) {
      await this.create({
        _id: network,
        lastScannedBlock: fallbackBlock,
        lastScanTimestamp: new Date(),
      });
      return fallbackBlock;
    }
    return 0;
  }
  return cursor.lastScannedBlock;
};

/**
 * Updates the last scanned block number atomically.
 */
blockCursorSchema.statics.setCursor = async function (
  network: CryptoNetwork,
  blockNumber: number,
): Promise<void> {
  await this.findByIdAndUpdate(
    network,
    {
      $set: {
        lastScannedBlock: blockNumber,
        lastScanTimestamp: new Date(),
      },
    },
    { upsert: true, new: true },
  );
};

export const BlockCursor = mongoose.model<IBlockCursor, IBlockCursorModel>(
  'BlockCursor',
  blockCursorSchema,
);
