/**
 * src/models/Counter.ts
 *
 * Atomic sequence counter for thread-safe HD wallet address derivation.
 *
 * Prevents race conditions where two concurrent invoice requests could
 * derive the exact same address index.
 *
 * Uses MongoDB's atomic `findOneAndUpdate({ $inc: { seq: 1 } })`.
 */

import mongoose, { Schema, Model } from 'mongoose';

export interface ICounter {
  _id: string; // Identifier for the counter (e.g. 'derivation_index_bsc', 'derivation_index_tron')
  seq: number;
  updatedAt?: Date;
}

export type ICounterDocument = mongoose.HydratedDocument<ICounter>;

export interface ICounterModel extends Model<ICounter> {
  getNextSequence(counterName: string, startOffset?: number): Promise<number>;
}

const counterSchema = new Schema<ICounter, ICounterModel>(
  {
    _id: {
      type: String,
      required: true,
    },
    seq: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

/**
 * Atomically increments and returns the next integer in the sequence.
 * Safe across clustered server instances and concurrent web requests.
 */
counterSchema.statics['getNextSequence'] = async function (
  counterName: string,
  startOffset: number = 0,
): Promise<number> {
  const result = await this.findOneAndUpdate(
    { _id: counterName },
    { $inc: { seq: 1 } },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    },
  );

  // If newly created and startOffset is provided, initialize from offset
  if (result.seq === 1 && startOffset > 0) {
    result.seq = startOffset + 1;
    await result.save();
    return result.seq;
  }

  return result.seq + startOffset;
};

export const Counter = mongoose.model<ICounter, ICounterModel>('Counter', counterSchema);
