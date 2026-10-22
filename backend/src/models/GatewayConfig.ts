/**
 * src/models/GatewayConfig.ts
 *
 * Mongoose Schema & Model for Global Gateway Dynamic Configuration.
 * Stores admin-managed dynamic percentage fees, network gas floors, and operational thresholds.
 */

import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IGatewayConfig {
  singletonKey: string;
  bscFeePercent: number;      // e.g. 1.0 (1%)
  tronFeePercent: number;     // e.g. 2.5 (2.5%)
  minBscFeeUsd: number;       // Safety floor for gas cost (e.g. $0.30)
  minTronFeeUsd: number;      // Safety floor for energy burn (e.g. $2.00)
  autoSweepEnabled: boolean;  // Master switch for background sweeper
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IGatewayConfigDocument extends IGatewayConfig, Document {}

export interface IGatewayConfigModel extends Model<IGatewayConfigDocument> {
  getActiveConfig(): Promise<IGatewayConfigDocument>;
}

const gatewayConfigSchema = new Schema<IGatewayConfigDocument, IGatewayConfigModel>(
  {
    singletonKey: {
      type: String,
      required: true,
      unique: true,
      default: 'global_gateway_config',
    },
    bscFeePercent: {
      type: Number,
      required: true,
      default: 1.0,
      min: [0, 'Fee percent cannot be negative'],
      max: [50, 'Fee percent cannot exceed 50%'],
    },
    tronFeePercent: {
      type: Number,
      required: true,
      default: 2.5,
      min: [0, 'Fee percent cannot be negative'],
      max: [50, 'Fee percent cannot exceed 50%'],
    },
    minBscFeeUsd: {
      type: Number,
      required: true,
      default: 0.30,
      min: 0,
    },
    minTronFeeUsd: {
      type: Number,
      required: true,
      default: 2.00,
      min: 0,
    },
    autoSweepEnabled: {
      type: Boolean,
      default: true,
    },
    updatedBy: {
      type: String,
      default: 'system_admin',
    },
  },
  {
    timestamps: true,
  },
);

/**
 * Returns the singleton configuration document, initializing default parameters if none exist.
 */
gatewayConfigSchema.statics['getActiveConfig'] = async function (): Promise<IGatewayConfigDocument> {
  let config = await this.findOne({ singletonKey: 'global_gateway_config' });
  if (!config) {
    config = await this.create({
      singletonKey: 'global_gateway_config',
      bscFeePercent: 1.0,
      tronFeePercent: 2.5,
      minBscFeeUsd: 0.30,
      minTronFeeUsd: 2.00,
      autoSweepEnabled: true,
    });
  }
  return config;
};

export const GatewayConfig: IGatewayConfigModel =
  (mongoose.models['GatewayConfig'] as IGatewayConfigModel) ||
  mongoose.model<IGatewayConfigDocument, IGatewayConfigModel>('GatewayConfig', gatewayConfigSchema);
