/**
 * src/api/routes/supportRoutes.ts
 *
 * Route definitions for Real-Time Customer Support.
 * Connects checkout users and Admin support representatives.
 */

import { Router } from 'express';
import {
  postUserMessage,
  getUserConversation,
  getAdminConversations,
  getAdminConversationDetails,
  postAdminReply,
  updateConversationStatus,
} from '../controllers/supportController';
import { requireAdminAuth } from '../middlewares/adminAuth';

const router = Router();

// ==========================================
// Public Endpoints (User-facing checkout & portal)
// ==========================================
router.post('/messages', postUserMessage);
router.get('/conversations/:sessionId', getUserConversation);

// ==========================================
// Admin Command Center Endpoints (Protected by JWT)
// ==========================================
router.get('/admin/conversations', requireAdminAuth, getAdminConversations);
router.get('/admin/conversations/:conversationId', requireAdminAuth, getAdminConversationDetails);
router.post('/admin/conversations/:conversationId/reply', requireAdminAuth, postAdminReply);
router.patch('/admin/conversations/:conversationId/status', requireAdminAuth, updateConversationStatus);

export default router;
