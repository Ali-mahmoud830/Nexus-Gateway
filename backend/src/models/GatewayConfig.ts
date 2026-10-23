/**
 * src/models/GatewayConfig.ts
 *
 * Mongoose Schema & Model for Global Gateway Dynamic Configuration.
 * Stores admin-managed dynamic percentage fees, network gas floors, and operational thresholds.
 */

import mongoose, { Document, Schema, Model } from 'mongoose';

export interface ICustomWallet {
  id: string;
  name: string;             // e.g. 'JazzCash', 'EasyPaisa', 'Bank Transfer'
  accountNumber: string;    // e.g. '03001234567'
  accountTitle: string;     // e.g. 'Ali Mahmoud'
  instructions?: string;    // e.g. 'Transfer to account and submit transaction ID'
  isActive: boolean;
}

export interface IGatewayConfig {
  singletonKey: string;
  bscFeePercent: number;      // e.g. 1.0 (1%)
  tronFeePercent: number;     // e.g. 2.5 (2.5%)
  minBscFeeUsd: number;       // Safety floor for gas cost (e.g. $0.30)
  minTronFeeUsd: number;      // Safety floor for energy burn (e.g. $2.00)
  autoSweepEnabled: boolean;  // Master switch for background sweeper
  tronMainWallet?: string;    // Configurable TRON Cold Receiving Address
  bscMainWallet?: string;     // Configurable BSC Cold Receiving Address
  customWallets?: ICustomWallet[]; // Configurable digital wallets (JazzCash, EasyPaisa, etc.)
  presetAmounts: number[];    // Configurable preset deposit buttons, e.g. [25, 50, 100, 250, 500, 1000]
  defaultDepositAmount: number; // e.g. 100
  minDepositAmount: number;     // e.g. 10
  maxDepositAmount: number;     // e.g. 10000
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IGatewayConfigDocument extends IGatewayConfig, Document {}

export interface IGatewayConfigModel extends Model<IGatewayConfigDocument> {
  getActiveConfig(): Promise<IGatewayConfigDocument>;
}

const customWalletSchema = new Schema<ICustomWallet>(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    accountNumber: { type: String, required: true },
    accountTitle: { type: String, required: true },
    instructions: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { _id: false },
);

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
    tronMainWallet: {
      type: String,
      trim: true,
      default: '',
    },
    bscMainWallet: {
      type: String,
      trim: true,
      default: '',
    },
    customWallets: {
      type: [customWalletSchema],
      default: [],
    },
    presetAmounts: {
      type: [Number],
      default: [25, 50, 100, 250, 500, 1000],
    },
    defaultDepositAmount: {
      type: Number,
      default: 100,
      min: 1,
    },
    minDepositAmount: {
      type: Number,
      default: 10,
      min: 1,
    },
    maxDepositAmount: {
      type: Number,
      default: 10000,
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
      presetAmounts: [25, 50, 100, 250, 500, 1000],
      defaultDepositAmount: 100,
      minDepositAmount: 10,
      maxDepositAmount: 10000,
      customWallets: [],
    });
  }
  return config;
};

export const GatewayConfig: IGatewayConfigModel =
  (mongoose.models['GatewayConfig'] as IGatewayConfigModel) ||
  mongoose.model<IGatewayConfigDocument, IGatewayConfigModel>('GatewayConfig', gatewayConfigSchema);
