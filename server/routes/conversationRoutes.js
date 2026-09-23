import express from 'express';
import {
  createConversation,
  getUserConversations,
  getConversationMessages,
  addMessage,
  deleteConversation,
  updateConversation,
} from '../controllers/conversationController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// All conversation routes are strictly protected by JWT authentication
router.use(authenticateToken);

router.post('/', createConversation);
router.get('/', getUserConversations);
router.patch('/:conversationId', updateConversation);
router.get('/:conversationId/messages', getConversationMessages);
router.post('/:conversationId/messages', addMessage);
router.delete('/:conversationId', deleteConversation);

export default router;
