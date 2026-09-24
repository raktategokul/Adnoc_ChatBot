import React, { useState, useEffect, useRef } from 'react';
import OasisOrb from './OasisOrb';
import CopilotConfigModal from './CopilotConfigModal';
import { conversationService } from '../services/conversationService';
import { copilotService } from '../services/copilotService';

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
  if (clean.length > 24) {
    const words = clean.split(' ');
    let shortTitle = '';
    for (const w of words) {
      if ((shortTitle + ' ' + w).trim().length <= 22) {
        shortTitle = (shortTitle + ' ' + w).trim();
      } else {
        break;
      }
    }
    return (shortTitle || clean.substring(0, 22)) + '...';
  }
  return clean;
}

export default function OasisChatWidget({ isOpen, onClose }) {
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isCopilotReady, setIsCopilotReady] = useState(copilotService.isConfigured());
  const [copiedId, setCopiedId] = useState(null);

  const messagesEndRef = useRef(null);
  const scrollAreaRef = useRef(null);
  const inputRef = useRef(null);

  // Load user conversations on mount
  useEffect(() => {
    loadUserConversations();
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({
        top: scrollAreaRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages, isSending, isHistoryOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && !isHistoryOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, isHistoryOpen]);

  async function loadUserConversations() {
    setIsLoadingConversations(true);
    try {
      const data = await conversationService.getConversations();
      setConversations(data);

      const savedSessionConvId = sessionStorage.getItem('oasis_session_active_conv_id');

      if (savedSessionConvId) {
        // Current session has an active conversation: restore it if present in data
        const found = data.find((c) => String(c.id) === String(savedSessionConvId));
        if (found) {
          setActiveConversationId(found.id);
          await loadMessages(found.id);
        } else {
          setActiveConversationId(null);
          setMessages([]);
        }
      } else {
        // New session: start on fresh new chat with initial welcome greeting without creating DB record
        setActiveConversationId(null);
        setMessages([]);
      }
    } catch (err) {
      console.error('Error fetching conversations:', err);
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
      console.error('Error fetching messages:', err);
      setMessages([]);
    } finally {
      setIsLoadingMessages(false);
    }
  }

  const handleSelectConversation = async (convId) => {
    if (convId !== activeConversationId) {
      setActiveConversationId(convId);
      sessionStorage.setItem('oasis_session_active_conv_id', String(convId));
      await loadMessages(convId);
    }
    setIsHistoryOpen(false);
  };

  const handleNewChat = () => {
    setActiveConversationId(null);
    setMessages([]);
    setInputText('');
    sessionStorage.removeItem('oasis_session_active_conv_id');
    setIsHistoryOpen(false);
    if (typeof copilotService.resetConversation === 'function') {
      copilotService.resetConversation();
    }
  };

  const handleDeleteConversation = async (e, convId) => {
    e.stopPropagation();
    try {
      await conversationService.deleteConversation(convId);
      const remaining = conversations.filter((c) => c.id !== convId);
      setConversations(remaining);

      if (activeConversationId === convId) {
        if (remaining.length > 0) {
          setActiveConversationId(remaining[0].id);
          await loadMessages(remaining[0].id);
        } else {
          handleNewChat();
        }
      }
    } catch (err) {
      console.error('Error deleting conversation:', err);
    }
  };

  const handleSendMessage = async (textToSend) => {
    const text = (textToSend || inputText).trim();
    if (!text || isSending) return;

    setInputText('');

    let convId = activeConversationId;
    if (!convId) {
      try {
        const shortTitle = generateDynamicTitle(text);
        const newConv = await conversationService.createConversation(shortTitle);
        convId = newConv.id;
        setActiveConversationId(convId);
        setConversations((prev) => [newConv, ...prev.filter((c) => c.id !== convId)]);
        sessionStorage.setItem('oasis_session_active_conv_id', String(convId));
      } catch (e) {
        console.error('Could not create conversation:', e);
        return;
      }
    }

    const tempUserMsg = {
      id: 'temp-' + Date.now(),
      conversation_id: convId,
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, tempUserMsg]);
    setIsSending(true);

    try {
      // 1. Store user message in SQL Server
      await conversationService.addMessage(convId, 'user', text);

      // 2. Dynamic short title for the chat
      const currentConv = conversations.find((c) => c.id === convId);
      if (currentConv && currentConv.title === 'New Chat') {
        const shortTitle = generateDynamicTitle(text);
        try {
          await conversationService.updateConversation(convId, shortTitle);
          setConversations((prev) =>
            prev.map((c) => (c.id === convId ? { ...c, title: shortTitle } : c))
          );
        } catch (titleErr) {
          console.warn('Could not update title:', titleErr);
        }
      }

      // 3. Send message to Copilot Studio agent (SOURCE UNCHANGED)
      const copilotResult = await copilotService.askCopilot(text);
      const responsesList =
        copilotResult.responses && Array.isArray(copilotResult.responses)
          ? copilotResult.responses
          : [copilotResult];

      const newBotMessages = [];
      for (let i = 0; i < responsesList.length; i++) {
        const resp = responsesList[i];
        const outputText = resp.text || '';
        const suggestedActions = resp.suggestedActions || [];

        if (outputText) {
          await conversationService.addMessage(convId, 'assistant', outputText);
          newBotMessages.push({
            id: 'bot-' + Date.now() + '-' + i,
            conversation_id: convId,
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
      console.error('Error from Copilot Studio:', err);
      const errorMsg = {
        id: 'err-' + Date.now(),
        conversation_id: convId,
        role: 'assistant',
        content: '⚠️ Unable to reach Copilot Studio. Please verify configuration or try again.',
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsSending(false);
    }
  };

  const handleCopyText = (msgId, text) => {
    if (text) {
      navigator.clipboard.writeText(text);
      setCopiedId(msgId);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleSaveConfig = (newConfig) => {
    copilotService.setConfig(newConfig);
    setIsCopilotReady(copilotService.isConfigured());
  };

  if (!isOpen) return null;

  const quickPills = [
    'Dashboard Summary',
    'Total Risk Exposure',
    'Severity Red Items',
    'Spurious Trip Cost',
  ];

  return (
    <div className="oasis-widget-popup" role="dialog" aria-label="OASIS AI Copilot">
      {/* Widget Header */}
      <div className="oasis-widget-header">
        <div className="oasis-header-left">
          <OasisOrb size={38} showStatus={true} isOnline={isCopilotReady} />
          <div className="oasis-header-titles">
            <div className="oasis-title">OASIS AI Copilot</div>
            <div className="oasis-subtitle">
              <span className="oasis-status-indicator"></span>
              <span>Online • Operational Assistant</span>
            </div>
          </div>
        </div>

        <div className="oasis-header-actions">
          {/* + New Chat Button */}
          <button
            className="oasis-icon-btn"
            onClick={handleNewChat}
            title="New Chat (+)"
            aria-label="New Chat"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" width="16" height="16">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>


          {/* History Button at Top Right as Requested */}
          <button
            className={`oasis-icon-btn oasis-history-toggle-btn ${isHistoryOpen ? 'active' : ''}`}
            onClick={() => setIsHistoryOpen((prev) => !prev)}
            title={isHistoryOpen ? 'Back to Chat' : 'Previous Chat History'}
            aria-label="Previous History"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </button>

          {/* Settings Trigger */}
          <button
            className="oasis-icon-btn"
            onClick={() => setIsConfigModalOpen(true)}
            title="Copilot Connection Settings"
            aria-label="Settings"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </button>

          {/* Close / Minimize Button */}
          <button
            className="oasis-icon-btn oasis-close-btn"
            onClick={onClose}
            title="Minimize"
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="16" height="16">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="oasis-widget-body">
        {/* Previous History Slide-over View */}
        {isHistoryOpen ? (
          <div className="oasis-history-view">
            <div className="oasis-history-header">
              <span className="oasis-history-title">Chat History</span>
              <button className="oasis-new-chat-pill" onClick={handleNewChat}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                <span>New Chat</span>
              </button>
            </div>

            <div className="oasis-history-list">
              {isLoadingConversations ? (
                <div className="oasis-history-empty">Loading history...</div>
              ) : conversations.length === 0 ? (
                <div className="oasis-history-empty">No previous conversations.</div>
              ) : (
                conversations.map((conv) => (
                  <div
                    key={conv.id}
                    className={`oasis-history-item ${conv.id === activeConversationId ? 'active' : ''}`}
                    onClick={() => handleSelectConversation(conv.id)}
                  >
                    <div className="oasis-history-item-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                      </svg>
                    </div>
                    <div className="oasis-history-item-details">
                      <div className="oasis-history-item-title">{conv.title || 'Untitled Chat'}</div>
                      <div className="oasis-history-item-time">
                        {conv.updated_at
                          ? new Date(conv.updated_at).toLocaleDateString([], {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : ''}
                      </div>
                    </div>
                    <button
                      className="oasis-history-delete-btn"
                      onClick={(e) => handleDeleteConversation(e, conv.id)}
                      title="Delete Conversation"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="oasis-history-footer">
              <button
                className="oasis-back-to-chat-btn"
                onClick={() => setIsHistoryOpen(false)}
              >
                ← Return to Conversation
              </button>
            </div>
          </div>
        ) : (
          /* Live Chat Messages Scroll Area */
          <div className="oasis-messages-scroll" ref={scrollAreaRef}>
            {/* Always show the exact welcome banner matching the screenshot if no messages, or at the start */}
            {messages.length === 0 ? (
              <div className="oasis-welcome-message-block">
                <div className="oasis-msg-row assistant">
                  <div className="oasis-msg-avatar">
                    <OasisOrb size={28} />
                  </div>
                  <div className="oasis-msg-content-col">
                    <div className="oasis-msg-bubble assistant">
                      <p>
                        Hello! 👋 I am <strong>OASIS Copilot</strong>, your operational AI assistant for the ADNOC Command Center.
                      </p>
                      <p style={{ marginTop: '10px' }}>
                        Ask me about a specific KPI (e.g.{' '}
                        <button
                          type="button"
                          className="oasis-kpi-link"
                          onClick={() => handleSendMessage('Total Risk Exposure')}
                        >
                          Total Risk Exposure
                        </button>
                        ,{' '}
                        <button
                          type="button"
                          className="oasis-kpi-link"
                          onClick={() => handleSendMessage('Severity Red Items')}
                        >
                          Severity Red Items
                        </button>
                        ,{' '}
                        <button
                          type="button"
                          className="oasis-kpi-link"
                          onClick={() => handleSendMessage('Spurious Trip Cost')}
                        >
                          Spurious Trip Cost
                        </button>
                        ,{' '}
                        <button
                          type="button"
                          className="oasis-kpi-link"
                          onClick={() => handleSendMessage('Savings Realized')}
                        >
                          Savings Realized
                        </button>
                        ), ask for a{' '}
                        <button
                          type="button"
                          className="oasis-kpi-link"
                          onClick={() => handleSendMessage('Dashboard Summary')}
                        >
                          Dashboard Summary
                        </button>
                        , or ask about this project!
                      </p>
                    </div>
                    <span className="oasis-msg-timestamp">Just now</span>
                  </div>
                </div>
              </div>
            ) : (
              messages.map((msg, index) => {
                const isAssistant = msg.role === 'assistant' || msg.sender === 'bot';
                const timeString = msg.created_at
                  ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : 'Just now';

                return (
                  <div
                    key={msg.id || index}
                    className={`oasis-msg-row ${isAssistant ? 'assistant' : 'user'}`}
                  >
                    {isAssistant && (
                      <div className="oasis-msg-avatar">
                        <OasisOrb size={28} />
                      </div>
                    )}

                    <div className="oasis-msg-content-col">
                      <div className={`oasis-msg-bubble ${isAssistant ? 'assistant' : 'user'}`}>
                        <div className="oasis-msg-text">{msg.content}</div>

                        {/* Suggested action chips from Copilot */}
                        {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                          <div className="oasis-suggested-actions-row">
                            {msg.suggestedActions.map((action, idx) => (
                              <button
                                key={idx}
                                className="oasis-action-chip"
                                onClick={() => handleSendMessage(action.value || action.title)}
                              >
                                {action.title}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="oasis-msg-meta">
                        <span className="oasis-msg-timestamp">{timeString}</span>
                        {isAssistant && (
                          <button
                            className="oasis-msg-action-btn"
                            onClick={() => handleCopyText(msg.id || index, msg.content)}
                            title="Copy message"
                          >
                            {copiedId === (msg.id || index) ? (
                              <span style={{ color: '#10b981', fontSize: '11px' }}>Copied</span>
                            ) : (
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                              </svg>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {/* Typing Indicator */}
            {isSending && (
              <div className="oasis-msg-row assistant typing-row">
                <div className="oasis-msg-avatar">
                  <OasisOrb size={28} />
                </div>
                <div className="oasis-msg-content-col">
                  <div className="oasis-msg-bubble assistant typing-bubble">
                    <span className="oasis-typing-dot"></span>
                    <span className="oasis-typing-dot"></span>
                    <span className="oasis-typing-dot"></span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Quick Action Chips Row (Always visible right above input) */}
      {!isHistoryOpen && (
        <div className="oasis-quick-chips-row">
          {quickPills.map((pill, idx) => (
            <button
              key={idx}
              className="oasis-quick-pill"
              onClick={() => handleSendMessage(pill)}
              disabled={isSending}
            >
              {pill}
            </button>
          ))}
        </div>
      )}

      {/* Input Field Capsule & Footer */}
      {!isHistoryOpen && (
        <div className="oasis-widget-footer">
          <form
            className="oasis-input-capsule-form"
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
          >
            <div className="oasis-input-capsule">
              <input
                ref={inputRef}
                type="text"
                className="oasis-chat-input"
                placeholder="Ask about this project, facilities, alarms... (or say 'Hi"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                disabled={isSending}
              />
              <button
                type="submit"
                className={`oasis-send-btn ${inputText.trim() ? 'active' : ''}`}
                disabled={!inputText.trim() || isSending}
                title="Send"
                aria-label="Send"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="16" height="16">
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
              </button>
            </div>
          </form>

          {/* Subtitle Footer matching screenshot */}
          <div className="oasis-capsule-subfooter">
            <span className="oasis-subfooter-left">Press Enter ↵ to send</span>
            <span className="oasis-subfooter-right">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
              </svg>
              <span>Operational Assurance Core</span>
            </span>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      <CopilotConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        onSave={handleSaveConfig}
      />
    </div>
  );
}
