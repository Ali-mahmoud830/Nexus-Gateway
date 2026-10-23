/**
 * src/models/Invoice.ts
 *
 * Mongoose Schema & Typed Model for Cryptocurrency Invoices.
 *
 * Core Privacy Architecture:
 * - Each invoice links to a unique, dynamically derived temporary deposit address (`depositAddress`).
 * - Derivation index (`derivationIndex`) is tracked for BIP-44 key derivation during forwarding.
 * - Decoupled state lifecycle:
 *     PENDING -> DETECTED (on-chain confirmation in progress) -> CONFIRMED (credited)
 *     -> FORWARDING (sweeper sweeping to cold wallet) -> FORWARDED (privacy cycle complete).
 *
 * Precision Notice:
 * - All cryptocurrency amounts (`expectedCryptoAmount`, `paidCryptoAmount`, `actualForwardedAmount`)
 *   are stored as STRINGS to prevent IEEE-754 floating-point rounding inaccuracies.
 */

import mongoose, { Document, Schema, Model } from 'mongoose';

// ---------------------------------------------------------------------------
// Enums & Constants
// ---------------------------------------------------------------------------

export enum InvoiceStatus {
  PENDING = 'PENDING',         // Created, awaiting incoming transaction on blockchain
  DETECTED = 'DETECTED',       // Tx spotted in mempool/block; waiting for required confirmations
  CONFIRMED = 'CONFIRMED',     // Reached required confirmations; balance credited to binary options platform
  FORWARDING = 'FORWARDING',   // Sweeper cron started transfer from temp address to main cold wallet
  FORWARDED = 'FORWARDED',     // Successfully swept to main cold wallet; cycle complete
  EXPIRED = 'EXPIRED',         // 15-minute checkout window lapsed without full payment
  UNDERPAID = 'UNDERPAID',     // Insufficient funds deposited before expiry
  OVERPAID = 'OVERPAID',       // Customer sent more than expected
  FAILED = 'FAILED',           // Unrecoverable error during forwarding or verification
}

export enum CryptoNetwork {
  BSC = 'BSC',                 // BNB Smart Chain (BEP-20)
  TRON = 'TRON',               // TRON Network (TRC-20)
}

export enum CryptoCurrency {
  USDT = 'USDT',               // Tether USD
}

// ---------------------------------------------------------------------------
// Subdocument Interfaces
// ---------------------------------------------------------------------------

export interface IPaymentDetails {
  txHash?: string;             // Incoming transaction hash on blockchain
  fromAddress?: string;        // Payer's source wallet address
  blockNumber?: number;        // Block number where tx was included
  confirmations: number;       // Current block confirmation count
  paidAt?: Date;               // Exact timestamp when payment was validated
}

export interface IForwardingDetails {
  forwardTxHash?: string;      // Sweeper transaction hash sending principal to main cold wallet
  forwardToAddress?: string;   // Main / cold wallet address destination
  forwardedAt?: Date;          // Timestamp when sweep completed
  gasFeeUsed?: string;         // Network fee spent for sweeping (in BNB or TRX)
  actualForwardedAmount?: string; // Exact USDT principal amount delivered to cold wallet
  failureReason?: string;      // Recorded if forward operation fails
  feeForwardTxHash?: string;   // Sweeper transaction hash routing customer fee surcharge to gas station wallet
  feeForwardToAddress?: string;// Gas station hot wallet address destination
  actualFeeForwardedAmount?: string; // Exact USDT fee surcharge amount delivered to gas station
}

// ---------------------------------------------------------------------------
// Document Interface
// ---------------------------------------------------------------------------

export interface IInvoice {
  invoiceId: string;           // Unique public identifier (e.g. inv_xxxxxxxxxxxx)
  userId: string;              // External User ID from binary options platform
  fiatAmount: number;          // Nominal requested amount in USD (e.g. 50.00)
  baseAmount?: number;         // Base trading deposit amount in USD
  feeAmount?: number;          // Network gas fee surcharge in USD/USDT
  fiatCurrency: string;        // Fiat currency reference (default: 'USD')
  cryptoCurrency: CryptoCurrency;
  network: CryptoNetwork;
  expectedCryptoAmount: string;// Exact crypto token amount expected (e.g. "52.500000")
  paidCryptoAmount: string;    // Actual verified crypto token amount received
  depositAddress: string;      // Unique derived temporary wallet address
  derivationIndex: number;     // BIP-44 key derivation index used to derive depositAddress
  status: InvoiceStatus;
  paymentDetails: IPaymentDetails;
  forwardingDetails: IForwardingDetails;
  expiresAt: Date;             // Expiry deadline (created_at + 15 minutes)
  metadata?: Record<string, unknown>; // Custom platform metadata (orderId, callbackUrl, etc.)
  webhookUrl?: string;         // Webhook endpoint to notify binary options system
  webhookDelivered: boolean;   // Delivery status flag for webhook notification
  webhookAttempts: number;     // Number of webhook delivery attempts
  createdAt: Date;
  updatedAt: Date;
}

export interface IInvoiceDocument extends IInvoice, Document {
  isExpired(): boolean;
}

export interface IInvoiceModel extends Model<IInvoiceDocument> {
  findByAddressAndNetwork(
    depositAddress: string,
    network: CryptoNetwork,
  ): Promise<IInvoiceDocument | null>;
  findPendingExpired(): Promise<IInvoiceDocument[]>;
  findReadyForForwarding(): Promise<IInvoiceDocument[]>;
}

// ---------------------------------------------------------------------------
// Subschemas
// ---------------------------------------------------------------------------

const paymentDetailsSchema = new Schema<IPaymentDetails>(
  {
    txHash: {
      type: String,
      trim: true,
      default: null,
    },
    fromAddress: {
      type: String,
      trim: true,
      default: null,
    },
    blockNumber: {
      type: Number,
      default: null,
    },
    confirmations: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    paidAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false },
);

const forwardingDetailsSchema = new Schema<IForwardingDetails>(
  {
    forwardTxHash: {
      type: String,
      trim: true,
      default: null,
    },
    forwardToAddress: {
      type: String,
      trim: true,
      default: null,
    },
    forwardedAt: {
      type: Date,
      default: null,
    },
    gasFeeUsed: {
      type: String,
      default: null,
    },
    actualForwardedAmount: {
      type: String,
      default: null,
    },
    failureReason: {
      type: String,
      default: null,
    },
    feeForwardTxHash: {
      type: String,
      trim: true,
      default: null,
    },
    feeForwardToAddress: {
      type: String,
      trim: true,
      default: null,
    },
    actualFeeForwardedAmount: {
      type: String,
      default: null,
    },
  },
  { _id: false },
);

// ---------------------------------------------------------------------------
// Main Invoice Schema
// ---------------------------------------------------------------------------

const invoiceSchema = new Schema<IInvoiceDocument, IInvoiceModel>(
  {
    invoiceId: {
      type: String,
      required: [true, 'Invoice ID is required'],
      unique: true,
      index: true,
      trim: true,
    },
    userId: {
      type: String,
      required: [true, 'User ID is required'],
      index: true,
      trim: true,
    },
    fiatAmount: {
      type: Number,
      required: [true, 'Fiat amount is required'],
      min: [0.01, 'Fiat amount must be greater than 0'],
    },
    baseAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    feeAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    fiatCurrency: {
      type: String,
      required: true,
      default: 'USD',
      trim: true,
      uppercase: true,
    },
    cryptoCurrency: {
      type: String,
      enum: Object.values(CryptoCurrency),
      required: true,
      default: CryptoCurrency.USDT,
    },
    network: {
      type: String,
      enum: Object.values(CryptoNetwork),
      required: true,
    },
    expectedCryptoAmount: {
      type: String,
      required: [true, 'Expected crypto amount is required'],
      trim: true,
    },
    paidCryptoAmount: {
      type: String,
      required: true,
      default: '0',
      trim: true,
    },
    depositAddress: {
      type: String,
      required: [true, 'Deposit address is required'],
      trim: true,
      index: true,
    },
    derivationIndex: {
      type: Number,
      required: [true, 'Derivation index is required'],
      min: 0,
    },
    status: {
      type: String,
      enum: Object.values(InvoiceStatus),
      required: true,
      default: InvoiceStatus.PENDING,
      index: true,
    },
    paymentDetails: {
      type: paymentDetailsSchema,
      default: () => ({ confirmations: 0 }),
    },
    forwardingDetails: {
      type: forwardingDetailsSchema,
      default: () => ({}),
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    webhookUrl: {
      type: String,
      trim: true,
      default: null,
    },
    webhookDelivered: {
      type: Boolean,
      default: false,
    },
    webhookAttempts: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret['_id'];
        return ret;
      },
    },
  },
);

// ---------------------------------------------------------------------------
// Performance & Concurrency Indexes
// ---------------------------------------------------------------------------

// 1. Critical for real-time blockchain listener lookup:
invoiceSchema.index({ depositAddress: 1, network: 1 });

// 2. Critical for listener searching only active invoices:
invoiceSchema.index({ depositAddress: 1, status: 1 });

// 3. For expiry background workers:
invoiceSchema.index({ status: 1, expiresAt: 1 });

// 4. For sweeper/forwarding workers:
invoiceSchema.index({ status: 1, network: 1 });

// 5. For user transaction history:
invoiceSchema.index({ userId: 1, createdAt: -1 });

// 6. Prevent duplicate derivation index per network:
invoiceSchema.index({ network: 1, derivationIndex: 1 }, { unique: true });

// ---------------------------------------------------------------------------
// Document Instance Methods
// ---------------------------------------------------------------------------

invoiceSchema.methods.isExpired = function (): boolean {
  return new Date() > this.expiresAt && this.status === InvoiceStatus.PENDING;
};

// ---------------------------------------------------------------------------
// Model Static Methods
// ---------------------------------------------------------------------------

/**
 * Finds an active (PENDING or DETECTED) invoice for a given deposit address on a specific chain.
 */
invoiceSchema.statics.findByAddressAndNetwork = async function (
  depositAddress: string,
  network: CryptoNetwork,
): Promise<IInvoiceDocument | null> {
  const normalized = network === CryptoNetwork.BSC ? depositAddress.toLowerCase() : depositAddress;
  return this.findOne({
    depositAddress: { $regex: new RegExp(`^${normalized}$`, 'i') },
    network,
    status: { $in: [InvoiceStatus.PENDING, InvoiceStatus.DETECTED] },
  });
};

/**
 * Finds all unpaid invoices that have exceeded their 15-minute expiration window.
 */
invoiceSchema.statics.findPendingExpired = async function (): Promise<IInvoiceDocument[]> {
  return this.find({
    status: InvoiceStatus.PENDING,
    expiresAt: { $lte: new Date() },
  });
};

/**
 * Finds all invoices that are CONFIRMED and waiting to be swept/forwarded to the cold wallet.
 */
invoiceSchema.statics.findReadyForForwarding = async function (): Promise<IInvoiceDocument[]> {
  return this.find({
    status: InvoiceStatus.CONFIRMED,
  }).sort({ createdAt: 1 });
};

export const Invoice = mongoose.model<IInvoiceDocument, IInvoiceModel>('Invoice', invoiceSchema);
