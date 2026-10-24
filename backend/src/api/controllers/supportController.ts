/**
 * src/api/controllers/supportController.ts
 *
 * Controller managing Real-Time Customer Support channels.
 * Seamless bidirectional communication between end-users / payers and the Admin Command Center.
 */

import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { v4 as uuidv4 } from 'uuid';
import { SupportConversation, ISupportMessage } from '../../models/SupportConversation';
import { Invoice } from '../../models/Invoice';
import { sendSuccess } from '../../utils/responseHelper';
import { AppError } from '../middlewares/errorHandler';
import { logger } from '../../utils/logger';

/**
 * POST /api/v1/support/messages
 * Public endpoint for end-users on checkout/portal to send a message.
 */
export async function postUserMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { sessionId, text, userName, userEmail, invoiceId } = req.body;

    if (!sessionId || typeof sessionId !== 'string' || !sessionId.trim()) {
      throw new AppError('sessionId is required to maintain chat context', StatusCodes.BAD_REQUEST, 'MISSING_SESSION_ID');
    }

    if (!text || typeof text !== 'string' || !text.trim()) {
      throw new AppError('Message text cannot be empty', StatusCodes.BAD_REQUEST, 'EMPTY_MESSAGE');
    }

    const trimmedText = text.trim();
    const cleanSession = sessionId.trim();

    // Find or create conversation by sessionId
    let conv = await SupportConversation.findOne({ sessionId: cleanSession });

    if (!conv) {
      conv = new SupportConversation({
        conversationId: `conv_${uuidv4().replace(/-/g, '').substring(0, 16)}`,
        sessionId: cleanSession,
        userName: (userName && String(userName).trim()) || 'Customer',
        userEmail: (userEmail && String(userEmail).trim()) || '',
        invoiceId: (invoiceId && String(invoiceId).trim()) || '',
        status: 'OPEN',
        unreadCountAdmin: 0,
        unreadCountUser: 0,
        messages: [],
      });
    } else {
      // Re-open if it was marked resolved
      conv.status = 'OPEN';
      if (invoiceId && !conv.invoiceId) {
        conv.invoiceId = String(invoiceId).trim();
      }
      if (userName && conv.userName === 'Customer') {
        conv.userName = String(userName).trim();
      }
      if (userEmail && !conv.userEmail) {
        conv.userEmail = String(userEmail).trim();
      }
    }

    const newMessage: ISupportMessage = {
      messageId: `msg_${uuidv4().replace(/-/g, '').substring(0, 16)}`,
      sender: 'user',
      senderName: conv.userName || 'Customer',
      text: trimmedText,
      createdAt: new Date(),
      isRead: false,
    };

    conv.messages.push(newMessage);
    conv.lastMessageText = trimmedText;
    conv.lastMessageSender = 'user';
    conv.lastMessageAt = new Date();
    conv.unreadCountAdmin = (conv.unreadCountAdmin || 0) + 1;

    await conv.save();

    logger.info(`[Support] 💬 New user message in conversation ${conv.conversationId} (session: ${cleanSession})`);

    sendSuccess(
      res,
      {
        conversationId: conv.conversationId,
        sessionId: conv.sessionId,
        status: conv.status,
        sentMessage: newMessage,
        messages: conv.messages,
      },
      StatusCodes.CREATED,
    );
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/support/conversations/:sessionId
 * Public endpoint for end-users to poll their conversation history & replies in real-time.
 */
export async function getUserConversation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      throw new AppError('sessionId parameter is required', StatusCodes.BAD_REQUEST, 'MISSING_SESSION_ID');
    }

    const conv = await SupportConversation.findOne({ sessionId: sessionId.trim() });

    if (!conv) {
      sendSuccess(res, {
        conversation: null,
        messages: [],
        unreadCountUser: 0,
      });
      return;
    }

    // Mark admin messages as read by user
    let updated = false;
    if (conv.unreadCountUser > 0) {
      conv.unreadCountUser = 0;
      conv.messages.forEach((m) => {
        if (m.sender === 'admin' && !m.isRead) {
          m.isRead = true;
          updated = true;
        }
      });
      if (updated) {
        await conv.save();
      }
    }

    sendSuccess(res, {
      conversation: {
        conversationId: conv.conversationId,
        sessionId: conv.sessionId,
        status: conv.status,
        userName: conv.userName,
        invoiceId: conv.invoiceId,
        lastMessageAt: conv.lastMessageAt,
      },
      messages: conv.messages,
      unreadCountUser: 0,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/support/admin/conversations
 * Admin endpoint: lists all conversations with unread indicators and search.
 */
export async function getAdminConversations(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const status = req.query['status'] as string; // 'OPEN' | 'RESOLVED' | 'ALL'
    const search = req.query['search'] as string;
    const page = Math.max(1, parseInt((req.query['page'] as string) || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt((req.query['limit'] as string) || '50', 10)));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};

    if (status && status !== 'ALL') {
      filter['status'] = status.toUpperCase();
    }

    if (search && search.trim()) {
      const q = search.trim();
      filter['$or'] = [
        { userName: { $regex: q, $options: 'i' } },
        { userEmail: { $regex: q, $options: 'i' } },
        { invoiceId: { $regex: q, $options: 'i' } },
        { lastMessageText: { $regex: q, $options: 'i' } },
        { sessionId: { $regex: q, $options: 'i' } },
      ];
    }

    const [conversations, total, unreadAgg] = await Promise.all([
      SupportConversation.find(filter)
        .sort({ lastMessageAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-messages') // Omit full message array in list view for rapid bandwidth
        .lean(),
      SupportConversation.countDocuments(filter),
      SupportConversation.aggregate([
        { $group: { _id: null, totalUnreadAdmin: { $sum: '$unreadCountAdmin' } } },
      ]),
    ]);

    const totalUnreadAdmin = unreadAgg.length > 0 ? (unreadAgg[0].totalUnreadAdmin || 0) : 0;

    sendSuccess(res, {
      conversations,
      total,
      totalUnreadAdmin,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/support/admin/conversations/:conversationId
 * Admin endpoint: retrieves full thread details, resets unread count, and enriches with invoice telemetry.
 */
export async function getAdminConversationDetails(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { conversationId } = req.params;

    const conv = await SupportConversation.findOne({ conversationId });
    if (!conv) {
      throw new AppError('Support conversation not found', StatusCodes.NOT_FOUND, 'CONVERSATION_NOT_FOUND');
    }

    // Reset admin unread count and mark user messages as read
    let updated = false;
    if (conv.unreadCountAdmin > 0) {
      conv.unreadCountAdmin = 0;
      updated = true;
    }
    conv.messages.forEach((m) => {
      if (m.sender === 'user' && !m.isRead) {
        m.isRead = true;
        updated = true;
      }
    });
    if (updated) {
      await conv.save();
    }

    // If invoiceId is linked, fetch live invoice status
    let invoiceData = null;
    if (conv.invoiceId) {
      invoiceData = await Invoice.findOne({ invoiceId: conv.invoiceId }).lean();
    }

    sendSuccess(res, {
      conversation: conv,
      invoice: invoiceData,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/support/admin/conversations/:conversationId/reply
 * Admin endpoint: post a live response into the customer thread.
 */
export async function postAdminReply(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { conversationId } = req.params;
    const { text, adminName } = req.body;

    if (!text || typeof text !== 'string' || !text.trim()) {
      throw new AppError('Reply text cannot be empty', StatusCodes.BAD_REQUEST, 'EMPTY_REPLY');
    }

    const conv = await SupportConversation.findOne({ conversationId });
    if (!conv) {
      throw new AppError('Support conversation not found', StatusCodes.NOT_FOUND, 'CONVERSATION_NOT_FOUND');
    }

    const trimmedText = text.trim();
    const replyMessage: ISupportMessage = {
      messageId: `msg_${uuidv4().replace(/-/g, '').substring(0, 16)}`,
      sender: 'admin',
      senderName: (adminName && String(adminName).trim()) || 'Nexus Support',
      text: trimmedText,
      createdAt: new Date(),
      isRead: false,
    };

    conv.messages.push(replyMessage);
    conv.lastMessageText = trimmedText;
    conv.lastMessageSender = 'admin';
    conv.lastMessageAt = new Date();
    conv.unreadCountUser = (conv.unreadCountUser || 0) + 1;

    await conv.save();

    logger.info(`[Support] 🛡️ Admin responded in conversation ${conv.conversationId}: "${trimmedText.substring(0, 40)}..."`);

    sendSuccess(res, {
      sentMessage: replyMessage,
      conversation: conv,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/support/admin/conversations/:conversationId/status
 * Admin endpoint: toggle conversation status between OPEN and RESOLVED.
 */
export async function updateConversationStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { conversationId } = req.params;
    const { status } = req.body;

    if (!status || !['OPEN', 'RESOLVED'].includes(status.toUpperCase())) {
      throw new AppError('Status must be either OPEN or RESOLVED', StatusCodes.BAD_REQUEST, 'INVALID_STATUS');
    }

    const conv = await SupportConversation.findOne({ conversationId });
    if (!conv) {
      throw new AppError('Support conversation not found', StatusCodes.NOT_FOUND, 'CONVERSATION_NOT_FOUND');
    }

    conv.status = status.toUpperCase() as 'OPEN' | 'RESOLVED';
    await conv.save();

    logger.info(`[Support] 🔄 Conversation ${conv.conversationId} marked as ${conv.status}`);

    sendSuccess(res, {
      conversation: conv,
    });
  } catch (err) {
    next(err);
  }
}
