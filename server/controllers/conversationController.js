import { getDbPool, sql } from '../db/db.js';

/**
 * POST /api/conversations
 * Create a new conversation for the authenticated user
 */
export async function createConversation(req, res) {
  try {
    const userId = req.user.id;
    const title = (req.body.title || 'New Chat').trim();

    const pool = await getDbPool();
    const result = await pool
      .request()
      .input('userId', sql.Int, userId)
      .input('title', sql.NVarChar, title)
      .query(`
        INSERT INTO Conversations (user_id, title)
        OUTPUT INSERTED.id, INSERTED.title, INSERTED.created_at, INSERTED.updated_at
        VALUES (@userId, @title)
      `);

    const newConversation = result.recordset[0];
    return res.status(201).json(newConversation);
  } catch (error) {
    console.error('[conversationController.createConversation] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create conversation.',
      error: error.message,
    });
  }
}

/**
 * GET /api/conversations
 * Fetch all conversations for the authenticated user, newest first
 */
export async function getUserConversations(req, res) {
  try {
    const userId = req.user.id;
    const pool = await getDbPool();

    const result = await pool
      .request()
      .input('userId', sql.Int, userId)
      .query(`
        -- Clean up any empty conversations with no messages
        DELETE FROM Conversations
        WHERE user_id = @userId
          AND id NOT IN (SELECT DISTINCT conversation_id FROM Messages);

        SELECT id, title, created_at, updated_at
        FROM Conversations
        WHERE user_id = @userId
        ORDER BY updated_at DESC
      `);

    return res.status(200).json(result.recordset);
  } catch (error) {
    console.error('[conversationController.getUserConversations] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch conversations.',
      error: error.message,
    });
  }
}

/**
 * GET /api/conversations/:conversationId/messages
 * Fetch messages for a specific conversation, strictly checking user ownership
 */
export async function getConversationMessages(req, res) {
  try {
    const userId = req.user.id;
    const conversationId = parseInt(req.params.conversationId, 10);

    if (isNaN(conversationId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid conversation ID.',
      });
    }

    const pool = await getDbPool();

    // 1. Verify that the requested conversation exists and belongs to the authenticated user
    const convResult = await pool
      .request()
      .input('convId', sql.Int, conversationId)
      .query('SELECT id, user_id, title FROM Conversations WHERE id = @convId');

    if (convResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found.',
      });
    }

    const conversation = convResult.recordset[0];
    if (conversation.user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not have permission to view this conversation.',
      });
    }

    // 2. Fetch all messages ordered chronologically
    const messagesResult = await pool
      .request()
      .input('convId', sql.Int, conversationId)
      .query(`
        SELECT id, conversation_id, role, content, created_at
        FROM Messages
        WHERE conversation_id = @convId
        ORDER BY created_at ASC
      `);

    return res.status(200).json(messagesResult.recordset);
  } catch (error) {
    console.error('[conversationController.getConversationMessages] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch messages.',
      error: error.message,
    });
  }
}

/**
 * POST /api/conversations/:conversationId/messages
 * Add a message (user or assistant) to an authenticated user's conversation
 */
export async function addMessage(req, res) {
  try {
    const userId = req.user.id;
    const conversationId = parseInt(req.params.conversationId, 10);
    const { role, content } = req.body;

    if (isNaN(conversationId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid conversation ID.',
      });
    }

    if (!role || !['user', 'assistant'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Message role must be either 'user' or 'assistant'.",
      });
    }

    if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Message content cannot be empty.',
      });
    }

    const pool = await getDbPool();

    // 1. Verify conversation ownership
    const convResult = await pool
      .request()
      .input('convId', sql.Int, conversationId)
      .query('SELECT id, user_id, title FROM Conversations WHERE id = @convId');

    if (convResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found.',
      });
    }

    const conversation = convResult.recordset[0];
    if (conversation.user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not have permission to modify this conversation.',
      });
    }

    // 2. Insert message
    const insertResult = await pool
      .request()
      .input('convId', sql.Int, conversationId)
      .input('role', sql.NVarChar, role)
      .input('content', sql.NVarChar, content.trim())
      .query(`
        INSERT INTO Messages (conversation_id, role, content)
        OUTPUT INSERTED.id, INSERTED.conversation_id, INSERTED.role, INSERTED.content, INSERTED.created_at
        VALUES (@convId, @role, @content)
      `);

    const createdMessage = insertResult.recordset[0];

    // 3. Update updated_at on conversation, and rename title if default 'New Chat'
    if (role === 'user' && conversation.title === 'New Chat') {
      const generatedTitle = content.trim().length > 36
        ? content.trim().substring(0, 36) + '...'
        : content.trim();

      await pool
        .request()
        .input('convId', sql.Int, conversationId)
        .input('title', sql.NVarChar, generatedTitle)
        .query(`
          UPDATE Conversations
          SET title = @title, updated_at = GETDATE()
          WHERE id = @convId
        `);
    } else {
      await pool
        .request()
        .input('convId', sql.Int, conversationId)
        .query('UPDATE Conversations SET updated_at = GETDATE() WHERE id = @convId');
    }

    return res.status(201).json(createdMessage);
  } catch (error) {
    console.error('[conversationController.addMessage] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to save message.',
      error: error.message,
    });
  }
}

/**
 * DELETE /api/conversations/:conversationId
 * Delete a conversation (cascades to all messages)
 */
export async function deleteConversation(req, res) {
  try {
    const userId = req.user.id;
    const conversationId = parseInt(req.params.conversationId, 10);

    if (isNaN(conversationId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid conversation ID.',
      });
    }

    const pool = await getDbPool();

    // Verify ownership
    const convResult = await pool
      .request()
      .input('convId', sql.Int, conversationId)
      .query('SELECT id, user_id FROM Conversations WHERE id = @convId');

    if (convResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found.',
      });
    }

    if (convResult.recordset[0].user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not own this conversation.',
      });
    }

    await pool
      .request()
      .input('convId', sql.Int, conversationId)
      .query('DELETE FROM Conversations WHERE id = @convId');

    return res.status(200).json({
      success: true,
      message: 'Conversation deleted successfully.',
    });
  } catch (error) {
    console.error('[conversationController.deleteConversation] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete conversation.',
      error: error.message,
    });
  }
}

/**
 * PATCH /api/conversations/:conversationId
 * Update conversation title
 */
export async function updateConversation(req, res) {
  try {
    const userId = req.user.id;
    const conversationId = parseInt(req.params.conversationId, 10);
    const { title } = req.body;

    if (isNaN(conversationId)) {
      return res.status(400).json({ success: false, message: 'Invalid conversation ID.' });
    }

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Title cannot be empty.' });
    }

    const pool = await getDbPool();

    // Verify ownership
    const convResult = await pool
      .request()
      .input('convId', sql.Int, conversationId)
      .query('SELECT id, user_id FROM Conversations WHERE id = @convId');

    if (convResult.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Conversation not found.' });
    }

    if (convResult.recordset[0].user_id !== userId) {
      return res.status(403).json({ success: false, message: 'Access denied. You do not own this conversation.' });
    }

    await pool
      .request()
      .input('convId', sql.Int, conversationId)
      .input('title', sql.NVarChar, title.trim())
      .query('UPDATE Conversations SET title = @title, updated_at = GETDATE() WHERE id = @convId');

    return res.status(200).json({
      success: true,
      message: 'Conversation updated successfully.',
      title: title.trim(),
    });
  } catch (error) {
    console.error('[conversationController.updateConversation] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update conversation.',
      error: error.message,
    });
  }
}
