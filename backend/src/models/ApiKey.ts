/**
 * src/models/ApiKey.ts
 *
 * Mongoose Schema & Model for Merchant Developer API Keys.
 * Enables trading platforms to authenticate and create invoices programmatically.
 */

import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IApiKey {
  keyId: string;
  name: string;
  keyPrefix: string;       // e.g. "nx_live_8f3a..."
  secretHash: string;      // Hashed key for validation
  rawKey?: string;         // Returned only once at creation
  scopes: string[];        // ['invoices:create', 'invoices:read', 'sweeper:trigger']
  isActive: boolean;
  totalRequests: number;
  lastUsedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IApiKeyDocument extends IApiKey, Document {}

const apiKeySchema = new Schema<IApiKeyDocument>(
  {
    keyId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    keyPrefix: {
      type: String,
      required: true,
      index: true,
    },
    secretHash: {
      type: String,
      required: true,
    },
    scopes: {
      type: [String],
      default: ['invoices:create', 'invoices:read'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    totalRequests: {
      type: Number,
      default: 0,
    },
    lastUsedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

export const ApiKey: Model<IApiKeyDocument> =
  mongoose.models['ApiKey'] || mongoose.model<IApiKeyDocument>('ApiKey', apiKeySchema);
