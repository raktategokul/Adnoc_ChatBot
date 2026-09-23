import { authService } from '../auth/authService';

/**
 * Conversation Service Client
 * 
 * Handles API calls to /api/conversations with automatic Bearer token authentication.
 */
export const conversationService = {
  getHeaders() {
    const token = authService.getToken();
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  },

  async getConversations() {
    const res = await fetch('/api/conversations', {
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to fetch conversations.');
    }
    return res.json();
  },

  async createConversation(title = 'New Chat') {
    const res = await fetch('/api/conversations', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ title }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to create conversation.');
    }
    return res.json();
  },

  async getMessages(conversationId) {
    const res = await fetch(`/api/conversations/${conversationId}/messages`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to fetch messages.');
    }
    return res.json();
  },

  async addMessage(conversationId, role, content) {
    const res = await fetch(`/api/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ role, content }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to save message.');
    }
    return res.json();
  },

  async deleteConversation(conversationId) {
    const res = await fetch(`/api/conversations/${conversationId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to delete conversation.');
    }
    return res.json();
  },

  async updateConversation(conversationId, title) {
    const res = await fetch(`/api/conversations/${conversationId}`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify({ title }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to update conversation.');
    }
    return res.json();
  },
};
