import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './Sidebar';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import QuickPrompts from './QuickPrompts';
import CopilotConfigModal from './CopilotConfigModal';
import { copilotService } from '../services/copilotService';

/**
 * Generates a short, dynamic title based on the user's chat input (like ChatGPT)
 */
function generateDynamicTitle(text) {
  if (!text) return 'New Chat';

  let clean = text
    .trim()
    .replace(
      /^(can you please|could you please|please|can you|tell me about|what is the|what is|what are the|what are|how do i|how to|show me the|show me|give me a summary of|give me|summary of)\s+/i,
      ''
    )
    .trim();

  if (!clean) clean = text.trim();
  clean = clean.replace(/[?.,!]+$/, '').trim();
  clean = clean.charAt(0).toUpperCase() + clean.slice(1);

  if (clean.length > 26) {
    const words = clean.split(' ');
    let shortTitle = '';
    for (const w of words) {
      if ((shortTitle + ' ' + w).trim().length <= 24) {
        shortTitle = (shortTitle + ' ' + w).trim();
      } else {
        break;
      }
    }
    return (shortTitle || clean.substring(0, 24)) + '...';
  }

  return clean;
}

export default function ChatContainer() {
  // Session-only conversations and messages kept exclusively in React state
  const [conversations, setConversations] = useState([
    {
      id: 'session-chat-1',
      title: 'New Chat',
      messages: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ]);
  const [activeConversationId, setActiveConversationId] = useState('session-chat-1');
  const [messages, setMessages] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isCopilotReady, setIsCopilotReady] = useState(copilotService.isConfigured());

  const messagesEndRef = useRef(null);
  const scrollAreaRef = useRef(null);

  // Auto-scroll to bottom as new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({
        top: scrollAreaRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages, isSending]);

  // Handle selecting a conversation from the sidebar history
  const handleSelectConversation = (convId) => {
    if (convId === activeConversationId) return;
    setActiveConversationId(convId);
    const target = conversations.find((c) => c.id === convId);
    setMessages(target ? target.messages || [] : []);
  };

  // Handle "+ New Chat"
  const handleNewChat = () => {
    const newId = `session-chat-${Date.now()}`;
    const newConv = {
      id: newId,
      title: 'New Chat',
      messages: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setConversations((prev) => [newConv, ...prev]);
    setActiveConversationId(newId);
    setMessages([]);
    if (typeof copilotService.resetConversation === 'function') {
      copilotService.resetConversation();
    }
  };

  // Handle user sending an input message
  const handleSendMessage = async (text) => {
    if (text === '__OPEN_SETTINGS__') {
      setIsConfigModalOpen(true);
      return;
    }

    if (!text || !text.trim() || isSending) return;

    const userText = text.trim();
    let currentId = activeConversationId;

    const userMsg = {
      id: 'user-' + Date.now(),
      role: 'user',
      content: userText,
      created_at: new Date().toISOString(),
    };

    if (!currentId || !conversations.some((c) => c.id === currentId)) {
      currentId = `session-chat-${Date.now()}`;
      const shortTitle = generateDynamicTitle(userText);
      const newConv = {
        id: currentId,
        title: shortTitle,
        messages: [userMsg],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setConversations((prev) => [newConv, ...prev]);
      setActiveConversationId(currentId);
      setMessages([userMsg]);
    } else {
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id === currentId) {
            const shortTitle = (c.title === 'New Chat' || !c.title) ? generateDynamicTitle(userText) : c.title;
            return {
              ...c,
              title: shortTitle,
              updated_at: new Date().toISOString(),
              messages: [...(c.messages || []), userMsg],
            };
          }
          return c;
        })
      );
      setMessages((prev) => [...prev, userMsg]);
    }

    setIsSending(true);

    try {
      let messageSequenceIndex = 0;
      const seenTexts = new Set();

      const handleIncomingActivity = async (resp) => {
        const outputText = (resp.text || '').trim();
        const suggestedActions = resp.suggestedActions || [];
        if (!outputText) return;

        if (seenTexts.has(outputText)) return;
        seenTexts.add(outputText);

        messageSequenceIndex++;
        const msgId = `bot-${Date.now()}-${messageSequenceIndex}`;

        const botMsg = {
          id: msgId,
          role: 'assistant',
          content: outputText,
          suggestedActions,
          created_at: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, botMsg]);
        setConversations((prev) =>
          prev.map((c) => {
            if (c.id === currentId) {
              return {
                ...c,
                updated_at: new Date().toISOString(),
                messages: [...(c.messages || []), botMsg],
              };
            }
            return c;
          })
        );
      };

      const copilotResult = await copilotService.askCopilot(userText, handleIncomingActivity);

      if (seenTexts.size === 0 && copilotResult?.responses?.length > 0) {
        for (const resp of copilotResult.responses) {
          await handleIncomingActivity(resp);
        }
      }
    } catch (err) {
      console.error('Error in chat exchange:', err);
      const errorMsg = {
        id: 'err-' + Date.now(),
        role: 'assistant',
        content: '⚠️ Failed to complete response from Copilot Studio. Please try again.',
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
      setConversations((prev) =>
        prev.map((c) =>
          c.id === currentId
            ? { ...c, updated_at: new Date().toISOString(), messages: [...(c.messages || []), errorMsg] }
            : c
        )
      );
    } finally {
      setIsSending(false);
    }
  };

  const handleSaveConfig = (newConfig) => {
    copilotService.setConfig(newConfig);
    setIsCopilotReady(copilotService.isConfigured());
  };

  // Handle renaming a conversation
  const handleRenameConversation = (convId, newTitle) => {
    if (!newTitle || !newTitle.trim()) return;
    setConversations((prev) =>
      prev.map((c) => (c.id === convId ? { ...c, title: newTitle.trim() } : c))
    );
  };

  // Handle deleting a conversation
  const handleDeleteConversation = (convId) => {
    const remaining = conversations.filter((c) => c.id !== convId);
    setConversations(remaining);

    if (activeConversationId === convId) {
      if (remaining.length > 0) {
        setActiveConversationId(remaining[0].id);
        setMessages(remaining[0].messages || []);
      } else {
        handleNewChat();
      }
    }
  };

  const activeConversation = conversations.find((c) => c.id === activeConversationId);
  const activeTitle = activeConversation ? activeConversation.title : 'New Chat';

  return (
    <main className="main-chat-area" role="main">
      {/* History Sidebar: Lists current session conversations with dynamic short titles */}
      <Sidebar
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleNewChat}
        onDeleteConversation={handleDeleteConversation}
        onRenameConversation={handleRenameConversation}
        isLoading={false}
      />

      {/* Main Card: Live Copilot Chat Window */}
      <div className="chat-card">
        {/* Chat Card Header */}
        <div className="chat-card-header">
          <div className="chat-header-info">
            <div className="chat-ai-avatar" aria-label="AI Assistant">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M12 2a4 4 0 0 1 4 4v1h1a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-8a3 3 0 0 1 3-3h1V6a4 4 0 0 1 4-4z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="9" cy="13" r="1.25" fill="currentColor" />
                <circle cx="15" cy="13" r="1.25" fill="currentColor" />
                <path d="M10 17h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <div className="chat-title-group">
              <h1 className="chat-title">{activeTitle}</h1>
              <span className="chat-subtitle">ADNOC Assistant • Live Copilot Studio</span>
            </div>
          </div>

          <div className="chat-header-actions">
            <div className="chat-header-status">
              <span className={`status-dot ${isCopilotReady ? '' : 'status-dot-warning'}`}></span>
              <span>{isCopilotReady ? 'Live' : 'Setup Required'}</span>
            </div>

            {/* Connection settings modal trigger */}
            <button
              className="header-icon-btn"
              onClick={() => setIsConfigModalOpen(true)}
              title="Copilot Studio Connection Settings"
              aria-label="Settings"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
            </button>

            <button
              className="header-icon-btn"
              onClick={handleNewChat}
              title="Start New Chat"
              aria-label="New Chat"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
          </div>
        </div>

        {/* Setup notice banner if not yet connected */}
        {!isCopilotReady && (
          <div
            className="auth-banner auth-banner-error"
            style={{ margin: '10px 16px 0 16px', borderRadius: 8, cursor: 'pointer' }}
            onClick={() => setIsConfigModalOpen(true)}
          >
            <span>
              ℹ️ To receive responses directly from your Copilot Studio agent, click here to enter your <strong>Token Endpoint</strong> (from Copilot Studio &gt; Channels &gt; Mobile app).
            </span>
          </div>
        )}

        {/* Live Copilot Chat Content Area with Full Scrollability */}
        <div className="chat-content-container">
          <div className="chat-messages-scroll-area" id="chat-messages-scroll-area" ref={scrollAreaRef}>
            <div className="messages-inner-container">
              {messages.length === 0 ? (
                <div className="chat-welcome-placeholder">
                  <div className="chat-welcome-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                    </svg>
                  </div>
                  <h3>How can I assist your ADNOC operations?</h3>
                  <p>
                    Ask about daily production rates, well telemetry, safety guidelines, or SAP work order summaries.
                  </p>
                </div>
              ) : (
                messages.map((msg, index) => (
                  <ChatMessage
                    key={msg.id || index}
                    message={msg}
                    onSuggestedActionClick={handleSendMessage}
                  />
                ))
              )}

              {/* Live Copilot Typing Indicator */}
              {isSending && (
                <div className="message-row bot-row typing-row">
                  <div className="message-avatar bot-avatar-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path
                        d="M12 2a4 4 0 0 1 4 4v1h1a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-8a3 3 0 0 1 3-3h1V6a4 4 0 0 1 4-4z"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <circle cx="9" cy="13" r="1.2" fill="currentColor" />
                      <circle cx="15" cy="13" r="1.2" fill="currentColor" />
                      <path d="M10 17h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div className="message-content-wrapper">
                    <div className="message-bubble bot-bubble typing-bubble">
                      <span className="typing-dot"></span>
                      <span className="typing-dot"></span>
                      <span className="typing-dot"></span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Quick Prompts for starting a new chat */}
          {messages.length === 0 && (
            <QuickPrompts onSelectPrompt={handleSendMessage} />
          )}

          {/* Chat Input Bar */}
          <ChatInput
            onSendMessage={handleSendMessage}
            disabled={isSending}
            placeholder="Type your message..."
          />
        </div>
      </div>

      {/* Connection Settings Modal */}
      <CopilotConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        onSave={handleSaveConfig}
      />
    </main>
  );
}
