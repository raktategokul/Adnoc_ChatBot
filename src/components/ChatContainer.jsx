import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './Sidebar';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import QuickPrompts from './QuickPrompts';
import CopilotConfigModal from './CopilotConfigModal';
import { conversationService } from '../services/conversationService';
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
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isCopilotReady, setIsCopilotReady] = useState(copilotService.isConfigured());

  const messagesEndRef = useRef(null);
  const scrollAreaRef = useRef(null);

  // Load user conversations from SQL Server on mount
  useEffect(() => {
    loadUserConversations();
  }, []);

  // Auto-scroll to bottom as new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({
        top: scrollAreaRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages, isSending]);

  async function loadUserConversations() {
    setIsLoadingConversations(true);
    try {
      const data = await conversationService.getConversations();
      setConversations(data);

      if (data.length > 0) {
        const firstConvId = data[0].id;
        setActiveConversationId(firstConvId);
        await loadMessages(firstConvId);
      } else {
        const newConv = await conversationService.createConversation('New Chat');
        setConversations([newConv]);
        setActiveConversationId(newConv.id);
        setMessages([]);
      }
    } catch (err) {
      console.error('Error fetching conversations from SQL Server:', err);
    } finally {
      setIsLoadingConversations(false);
    }
  }

  async function loadMessages(convId) {
    if (!convId) return;
    setIsLoadingMessages(true);
    try {
      const history = await conversationService.getMessages(convId);
      setMessages(history);
    } catch (err) {
      console.error('Error fetching messages from SQL Server:', err);
      setMessages([]);
    } finally {
      setIsLoadingMessages(false);
    }
  }

  // Handle selecting a conversation from the sidebar history
  const handleSelectConversation = async (convId) => {
    if (convId === activeConversationId) return;
    setActiveConversationId(convId);
    await loadMessages(convId);
  };

  // Handle "+ New Chat"
  const handleNewChat = async () => {
    try {
      const newConv = await conversationService.createConversation('New Chat');
      setConversations((prev) => [newConv, ...prev]);
      setActiveConversationId(newConv.id);
      setMessages([]);
    } catch (err) {
      console.error('Error creating new conversation in SQL Server:', err);
    }
  };

  // Handle user sending an input message
  const handleSendMessage = async (text) => {
    if (text === '__OPEN_SETTINGS__') {
      setIsConfigModalOpen(true);
      return;
    }

    if (!text.trim() || isSending || !activeConversationId) return;

    const userText = text.trim();
    const tempUserMsg = {
      id: 'temp-' + Date.now(),
      conversation_id: activeConversationId,
      role: 'user',
      content: userText,
      created_at: new Date().toISOString(),
    };

    // 1. Optimistically display user input message in chat window
    setMessages((prev) => [...prev, tempUserMsg]);
    setIsSending(true);

    try {
      // 2. Store input message in SQL Server database
      await conversationService.addMessage(activeConversationId, 'user', userText);

      // 3. Dynamic short title for the chat as per user interaction
      const currentConv = conversations.find((c) => c.id === activeConversationId);
      if (currentConv && currentConv.title === 'New Chat') {
        const shortTitle = generateDynamicTitle(userText);
        try {
          await conversationService.updateConversation(activeConversationId, shortTitle);
          setConversations((prev) =>
            prev.map((c) => (c.id === activeConversationId ? { ...c, title: shortTitle } : c))
          );
        } catch (titleErr) {
          console.warn('Could not update dynamic title:', titleErr);
        }
      }

      // 4. Send message to Live Copilot Studio agent and collect all responses
      const copilotResult = await copilotService.askCopilot(userText);
      const responsesList =
        copilotResult.responses && Array.isArray(copilotResult.responses)
          ? copilotResult.responses
          : [copilotResult];

      // 5. Store and display EACH response in SQL Server and chat window
      const newBotMessages = [];
      for (let i = 0; i < responsesList.length; i++) {
        const resp = responsesList[i];
        const outputText = resp.text || '';
        const suggestedActions = resp.suggestedActions || [];

        if (outputText) {
          // Store each output message in SQL Server database
          await conversationService.addMessage(activeConversationId, 'assistant', outputText);

          // Add to local state
          newBotMessages.push({
            id: 'bot-' + Date.now() + '-' + i,
            conversation_id: activeConversationId,
            role: 'assistant',
            content: outputText,
            suggestedActions,
            created_at: new Date().toISOString(),
          });
        }
      }

      if (newBotMessages.length > 0) {
        setMessages((prev) => [...prev, ...newBotMessages]);
      }
    } catch (err) {
      console.error('Error in chat exchange:', err);
      const errorMsg = {
        id: 'err-' + Date.now(),
        conversation_id: activeConversationId,
        role: 'assistant',
        content: '⚠️ Failed to complete response from Copilot Studio. Please try again.',
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsSending(false);
    }
  };

  const handleSaveConfig = (newConfig) => {
    copilotService.setConfig(newConfig);
    setIsCopilotReady(copilotService.isConfigured());
  };

  // Handle renaming a conversation
  const handleRenameConversation = async (convId, newTitle) => {
    if (!newTitle || !newTitle.trim()) return;
    try {
      await conversationService.updateConversation(convId, newTitle.trim());
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, title: newTitle.trim() } : c))
      );
    } catch (err) {
      console.error('Error renaming conversation:', err);
    }
  };

  // Handle deleting a conversation
  const handleDeleteConversation = async (convId) => {
    try {
      await conversationService.deleteConversation(convId);
      const remaining = conversations.filter((c) => c.id !== convId);
      setConversations(remaining);

      if (activeConversationId === convId) {
        if (remaining.length > 0) {
          setActiveConversationId(remaining[0].id);
          await loadMessages(remaining[0].id);
        } else {
          await handleNewChat();
        }
      }
    } catch (err) {
      console.error('Error deleting conversation:', err);
    }
  };

  const activeConversation = conversations.find((c) => c.id === activeConversationId);
  const activeTitle = activeConversation ? activeConversation.title : 'New Chat';

  return (
    <main className="main-chat-area" role="main">
      {/* History Sidebar: Lists all past conversations with dynamic short titles like ChatGPT */}
      <Sidebar
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleNewChat}
        onDeleteConversation={handleDeleteConversation}
        onRenameConversation={handleRenameConversation}
        isLoading={isLoadingConversations}
      />

      {/* Main Card: Live Copilot Chat Window */}
      <div className="chat-card">
        {/* Chat Card Header: Clean, unified without any extra tabs */}
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
              {isLoadingMessages ? (
                <div className="chat-welcome-placeholder">
                  <div className="sidebar-mini-spinner" style={{ width: 28, height: 28, marginBottom: 12 }}></div>
                  <p>Loading conversation history from database...</p>
                </div>
              ) : messages.length === 0 ? (
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
          {messages.length === 0 && !isLoadingMessages && (
            <QuickPrompts onSelectPrompt={handleSendMessage} />
          )}

          {/* Chat Input Bar */}
          <ChatInput
            onSendMessage={handleSendMessage}
            disabled={isSending || isLoadingMessages}
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
