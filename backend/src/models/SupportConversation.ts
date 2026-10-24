/**
 * src/models/SupportConversation.ts
 *
 * Mongoose Schema & Typed Model for Real-Time Customer Support Messages.
 * Bridges customer issues on payment invoices with the Admin Command Center.
 */

import mongoose, { Document, Schema, Model } from 'mongoose';

export interface ISupportMessage {
  messageId: string;
  sender: 'user' | 'admin';
  senderName: string;
  text: string;
  createdAt: Date;
  isRead: boolean;
}

export interface ISupportConversation {
  conversationId: string;
  sessionId: string;
  userName?: string;
  userEmail?: string;
  invoiceId?: string;
  status: 'OPEN' | 'RESOLVED';
  unreadCountAdmin: number;
  unreadCountUser: number;
  lastMessageText: string;
  lastMessageSender: 'user' | 'admin';
  lastMessageAt: Date;
  messages: ISupportMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ISupportConversationDocument extends ISupportConversation, Document {}

const supportMessageSchema = new Schema<ISupportMessage>(
  {
    messageId: { type: String, required: true },
    sender: { type: String, enum: ['user', 'admin'], required: true },
    senderName: { type: String, default: 'Customer' },
    text: { type: String, required: true, trim: true },
    createdAt: { type: Date, default: Date.now },
    isRead: { type: Boolean, default: false },
  },
  { _id: false },
);

const supportConversationSchema = new Schema<ISupportConversationDocument>(
  {
    conversationId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    sessionId: {
      type: String,
      required: true,
      index: true,
    },
    userName: {
      type: String,
      default: 'Customer',
      trim: true,
    },
    userEmail: {
      type: String,
      default: '',
      trim: true,
    },
    invoiceId: {
      type: String,
      default: '',
      index: true,
    },
    status: {
      type: String,
      enum: ['OPEN', 'RESOLVED'],
      default: 'OPEN',
      index: true,
    },
    unreadCountAdmin: {
      type: Number,
      default: 0,
    },
    unreadCountUser: {
      type: Number,
      default: 0,
    },
    lastMessageText: {
      type: String,
      default: '',
    },
    lastMessageSender: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    messages: {
      type: [supportMessageSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

export const SupportConversation: Model<ISupportConversationDocument> =
  mongoose.models['SupportConversation'] ||
  mongoose.model<ISupportConversationDocument>('SupportConversation', supportConversationSchema);
