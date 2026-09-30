import React, { useState, useEffect, useRef } from 'react';
import OasisOrb from './OasisOrb';
import CopilotConfigModal from './CopilotConfigModal';
import MarkdownRenderer from './MarkdownRenderer';
import ThinkingSection from './ThinkingSection';
import { copilotService, isIntermediateMessage } from '../services/copilotService';
import { useTheme } from '../context/ThemeContext';

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

/**
 * Parses message content to separate thoughts from final substantive content.
 * Supports <think>...</think> tags and groups older consecutive intermediate messages.
 */
function processMessagesWithThoughts(rawMessages) {
  if (!Array.isArray(rawMessages) || rawMessages.length === 0) return [];

  const processed = [];
  let pendingThoughts = [];

  for (let i = 0; i < rawMessages.length; i++) {
    const msg = rawMessages[i];
    if (msg.role !== 'assistant' && msg.sender !== 'bot') {
      if (pendingThoughts.length > 0) {
        processed.push({
          id: 'bot-thought-' + i,
          role: 'assistant',
          thoughts: pendingThoughts,
          content: '',
          isThinking: false,
          created_at: msg.created_at,
        });
        pendingThoughts = [];
      }
      processed.push(msg);
      continue;
    }

    const rawText = (msg.content || '').trim();

    // Check for <think>...</think> block
    const thinkMatch = rawText.match(/^<think>([\s\S]*?)<\/think>\s*([\s\S]*)$/i);
    if (thinkMatch) {
      const extractedThoughts = thinkMatch[1]
        .split('\n')
        .map((t) => t.trim())
        .filter(Boolean);
      const cleanContent = thinkMatch[2].trim();

      processed.push({
        ...msg,
        thoughts: extractedThoughts,
        content: cleanContent,
        isThinking: false,
      });
      pendingThoughts = [];
      continue;
    }

    // Check if this message was an intermediate announcement from an older session
    if (isIntermediateMessage(rawText)) {
      pendingThoughts.push(rawText);
      continue;
    }

    // Substantive answer with pending thoughts from preceding intermediate steps:
    if (pendingThoughts.length > 0) {
      processed.push({
        ...msg,
        thoughts: [...pendingThoughts],
        content: rawText,
        isThinking: false,
      });
      pendingThoughts = [];
    } else {
      processed.push({
        ...msg,
        thoughts: msg.thoughts || [],
        content: rawText,
        isThinking: false,
      });
    }
  }

  if (pendingThoughts.length > 0) {
    processed.push({
      id: 'bot-thought-trailing',
      role: 'assistant',
      thoughts: pendingThoughts,
      content: '',
      isThinking: false,
      created_at: new Date().toISOString(),
    });
  }

  return processed;
}

export default function OasisChatWidget({ isOpen, onClose }) {
  // Theme context for dark/light appearance
  const { theme, toggleTheme, isDark } = useTheme();

  // Session-only conversations and messages kept exclusively in React state
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isCopilotReady, setIsCopilotReady] = useState(copilotService.isConfigured());
  const [copiedId, setCopiedId] = useState(null);

  // Draggable and maximize window state
  const [position, setPosition] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  const widgetRef = useRef(null);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, startX: 0, startY: 0, width: 0, height: 0 });
  const messagesEndRef = useRef(null);
  const scrollAreaRef = useRef(null);
  const inputRef = useRef(null);

  // Keep widget clamped within viewport if browser window is resized
  useEffect(() => {
    const handleResize = () => {
      if (position && widgetRef.current && !isMaximized) {
        const rect = widgetRef.current.getBoundingClientRect();
        const maxX = Math.max(10, window.innerWidth - rect.width - 10);
        const maxY = Math.max(10, window.innerHeight - rect.height - 10);
        setPosition((prev) => {
          if (!prev) return null;
          return {
            x: Math.max(10, Math.min(maxX, prev.x)),
            y: Math.max(10, Math.min(maxY, prev.y)),
          };
        });
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [position, isMaximized]);

  const handleDragStart = (e) => {
    if (isMaximized) return;
    if (e.button !== undefined && e.button !== 0) return;

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    if (!widgetRef.current) return;
    const rect = widgetRef.current.getBoundingClientRect();

    dragStartRef.current = {
      mouseX: clientX,
      mouseY: clientY,
      startX: rect.left,
      startY: rect.top,
      width: rect.width,
      height: rect.height,
    };

    setIsDragging(true);

    const onMouseMove = (moveEvt) => {
      const curX = moveEvt.touches ? moveEvt.touches[0].clientX : moveEvt.clientX;
      const curY = moveEvt.touches ? moveEvt.touches[0].clientY : moveEvt.clientY;

      const deltaX = curX - dragStartRef.current.mouseX;
      const deltaY = curY - dragStartRef.current.mouseY;

      let nextX = dragStartRef.current.startX + deltaX;
      let nextY = dragStartRef.current.startY + deltaY;

      const maxX = Math.max(10, window.innerWidth - dragStartRef.current.width - 10);
      const maxY = Math.max(10, window.innerHeight - dragStartRef.current.height - 10);

      nextX = Math.max(10, Math.min(maxX, nextX));
      nextY = Math.max(10, Math.min(maxY, nextY));

      setPosition({ x: nextX, y: nextY });
    };

    const onMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchmove', onMouseMove);
      window.removeEventListener('touchend', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('touchmove', onMouseMove, { passive: false });
    window.addEventListener('touchend', onMouseUp);
  };

  const handleHeaderMouseDown = (e) => {
    if (e.target.closest('button') || e.target.closest('.oasis-header-actions')) {
      return;
    }
    handleDragStart(e);
  };

  const getWidgetStyle = () => {
    if (isMaximized) {
      return {
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        right: 'auto',
        bottom: 'auto',
        width: 'min(1080px, calc(100vw - 32px))',
        height: 'calc(100vh - 40px)',
        maxWidth: 'none',
        maxHeight: 'none',
        transition: isDragging ? 'none' : 'width 0.22s ease, height 0.22s ease, transform 0.22s ease',
      };
    }

    if (position) {
      return {
        left: `${position.x}px`,
        top: `${position.y}px`,
        right: 'auto',
        bottom: 'auto',
        transition: isDragging ? 'none' : 'width 0.22s ease, height 0.22s ease',
      };
    }

    return {
      transition: isDragging ? 'none' : 'width 0.22s ease, height 0.22s ease',
    };
  };

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

  const handleSelectConversation = (convId) => {
    if (convId !== activeConversationId) {
      setActiveConversationId(convId);
      const targetConv = conversations.find((c) => c.id === convId);
      setMessages(targetConv ? processMessagesWithThoughts(targetConv.messages || []) : []);
    }
    setIsHistoryOpen(false);
  };

  const handleNewChat = () => {
    setActiveConversationId(null);
    setMessages([]);
    setInputText('');
    setIsHistoryOpen(false);
    if (typeof copilotService.resetConversation === 'function') {
      copilotService.resetConversation();
    }
  };

  const handleDeleteConversation = (e, convId) => {
    e.stopPropagation();
    const remaining = conversations.filter((c) => c.id !== convId);
    setConversations(remaining);

    if (activeConversationId === convId) {
      if (remaining.length > 0) {
        setActiveConversationId(remaining[0].id);
        setMessages(processMessagesWithThoughts(remaining[0].messages || []));
      } else {
        handleNewChat();
      }
    }
  };

  const handleSendMessage = async (textToSend) => {
    const text = (textToSend || inputText).trim();
    if (!text || isSending) return;

    setInputText('');

    let convId = activeConversationId;
    const userMsg = {
      id: 'user-' + Date.now(),
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };

    // If no active conversation in the current browser session, initialize a new session chat
    if (!convId || !conversations.some((c) => c.id === convId)) {
      convId = `session-chat-${Date.now()}`;
      const shortTitle = generateDynamicTitle(text);
      const newConv = {
        id: convId,
        title: shortTitle,
        messages: [userMsg],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setActiveConversationId(convId);
      setConversations((prev) => [newConv, ...prev.filter((c) => c.id !== convId)]);
      setMessages([userMsg]);
    } else {
      // Immediately append user message to active conversation in React state
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id === convId) {
            const shortTitle = (c.title === 'New Chat' || !c.title) ? generateDynamicTitle(text) : c.title;
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

    // Send message to Copilot Studio chatbot
    const currentBotMsgId = `bot-${Date.now()}`;
    const accumulatedThoughts = [];
    let finalContent = '';
    let finalSuggestedActions = [];

    const syncBotMessage = (isThinking, content, actions) => {
      const botMsg = {
        id: currentBotMsgId,
        role: 'assistant',
        thoughts: [...accumulatedThoughts],
        isThinking,
        content,
        suggestedActions: actions,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => {
        const copy = [...prev];
        const botIdx = copy.findIndex((m) => m.id === currentBotMsgId);
        if (botIdx >= 0) {
          copy[botIdx] = botMsg;
        } else {
          copy.push(botMsg);
        }
        return copy;
      });

      // Maintain assistant message in session conversation React state
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id === convId) {
            const msgs = [...(c.messages || [])];
            const bIdx = msgs.findIndex((m) => m.id === currentBotMsgId);
            if (bIdx >= 0) {
              msgs[bIdx] = botMsg;
            } else {
              msgs.push(botMsg);
            }
            return {
              ...c,
              updated_at: new Date().toISOString(),
              messages: msgs,
            };
          }
          return c;
        })
      );
    };

    const handleIncomingActivity = async (resp) => {
      const outputText = (resp.text || '').trim();
      const suggestedActions = resp.suggestedActions || [];
      if (!outputText) return;

      if (resp.isIntermediate) {
        if (!accumulatedThoughts.includes(outputText)) {
          accumulatedThoughts.push(outputText);
        }
        syncBotMessage(true, finalContent, finalSuggestedActions);
      } else {
        finalContent = outputText;
        finalSuggestedActions = suggestedActions;
        setIsSending(false);
        syncBotMessage(false, finalContent, finalSuggestedActions);
      }
    };

    try {
      const copilotResult = await copilotService.askCopilot(text, handleIncomingActivity);

      if (!finalContent && copilotResult?.responses?.length > 0) {
        for (const resp of copilotResult.responses) {
          await handleIncomingActivity(resp);
        }
      }
    } catch (err) {
      console.error('Error from Copilot Studio:', err);
      const errorMsg = {
        id: 'err-' + Date.now(),
        role: 'assistant',
        content: '⚠️ Unable to reach Copilot Studio. Please verify configuration or try again.',
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId
            ? { ...c, messages: [...(c.messages || []), errorMsg], updated_at: new Date().toISOString() }
            : c
        )
      );
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
    <div
      ref={widgetRef}
      className={`oasis-widget-popup ${theme}-theme ${isDragging ? 'is-dragging' : ''} ${isMaximized ? 'is-maximized' : ''}`}
      style={getWidgetStyle()}
      role="dialog"
      aria-label="OASIS AI Copilot"
    >
      {/* Widget Header */}
      <div
        className={`oasis-widget-header ${isDragging ? 'is-dragging' : ''}`}
        onMouseDown={handleHeaderMouseDown}
        onTouchStart={handleHeaderMouseDown}
        onDoubleClick={() => setIsMaximized((prev) => !prev)}
        title="Double-click to toggle maximize/restore"
      >
        <div className="oasis-header-left">
          {/* Copilot-style 6-dot Drag Handle Button */}
          <button
            type="button"
            className="oasis-drag-handle-btn"
            onMouseDown={handleDragStart}
            onTouchStart={handleDragStart}
            title="Drag to move chatbot window anywhere on screen"
            aria-label="Drag to move"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
              <circle cx="8" cy="6" r="1.6" />
              <circle cx="16" cy="6" r="1.6" />
              <circle cx="8" cy="12" r="1.6" />
              <circle cx="16" cy="12" r="1.6" />
              <circle cx="8" cy="18" r="1.6" />
              <circle cx="16" cy="18" r="1.6" />
            </svg>
          </button>

          <OasisOrb size={36} showStatus={true} isOnline={isCopilotReady} />
          <div className="oasis-header-titles">
            <div className="oasis-title">OASIS AI Copilot</div>
            <div className="oasis-subtitle">
              <span className="oasis-status-indicator"></span>
              <span>Online • Operational Assistant</span>
            </div>
          </div>
        </div>

        <div className="oasis-header-actions" onMouseDown={(e) => e.stopPropagation()}>
          {/* + New Chat Button */}
          <button
            type="button"
            className="oasis-icon-btn"
            onClick={handleNewChat}
            title="New Chat (+)"
            aria-label="New Chat"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" width="15" height="15">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>

          {/* History Button at Top Right as Requested */}
          <button
            type="button"
            className={`oasis-icon-btn oasis-history-toggle-btn ${isHistoryOpen ? 'active' : ''}`}
            onClick={() => setIsHistoryOpen((prev) => !prev)}
            title={isHistoryOpen ? 'Back to Chat' : 'Current Session Chat History'}
            aria-label="Current Session History"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </button>

          {/* Settings Trigger */}
          <button
            type="button"
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

          {/* Theme Option for Chatbot (Dark / Light) */}
          <button
            type="button"
            className="oasis-icon-btn oasis-theme-btn"
            onClick={toggleTheme}
            title={isDark ? 'Switch Copilot to Light Theme' : 'Switch Copilot to Dark Theme'}
            aria-label={isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
          >
            {isDark ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14" className="oasis-theme-icon sun">
                <circle cx="12" cy="12" r="5"></circle>
                <line x1="12" y1="1" x2="12" y2="3"></line>
                <line x1="12" y1="21" x2="12" y2="23"></line>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                <line x1="1" y1="12" x2="3" y2="12"></line>
                <line x1="21" y1="12" x2="23" y2="12"></line>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14" className="oasis-theme-icon moon">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
              </svg>
            )}
          </button>

          {/* Window Control Divider */}
          <span className="oasis-window-divider"></span>

          {/* Minimize Button */}
          <button
            type="button"
            className="oasis-icon-btn oasis-minimize-btn"
            onClick={onClose}
            title="Minimize window"
            aria-label="Minimize window"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14">
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>

          {/* Maximize / Restore Button */}
          <button
            type="button"
            className={`oasis-icon-btn oasis-maximize-btn ${isMaximized ? 'active' : ''}`}
            onClick={() => setIsMaximized((prev) => !prev)}
            title={isMaximized ? "Restore window size" : "Maximize window size"}
            aria-label={isMaximized ? "Restore window size" : "Maximize window size"}
          >
            {isMaximized ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                <rect x="8" y="4" width="12" height="12" rx="1.5"></rect>
                <path d="M4 8v12a1.5 1.5 0 0 0 1.5 1.5H16"></path>
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                <rect x="4" y="4" width="16" height="16" rx="2"></rect>
              </svg>
            )}
          </button>

          {/* Close Button */}
          <button
            type="button"
            className="oasis-icon-btn oasis-close-btn"
            onClick={onClose}
            title="Close"
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="15" height="15">
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
              <span className="oasis-history-title">Session Chat History</span>
              <button className="oasis-new-chat-pill" onClick={handleNewChat}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                <span>New Chat</span>
              </button>
            </div>

            <div className="oasis-history-list">
              {conversations.length === 0 ? (
                <div className="oasis-history-empty">No conversations in current session.</div>
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
                          ? new Date(conv.updated_at).toLocaleTimeString([], {
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
            {/* Always show the welcome banner matching the screenshot if no messages in active conversation */}
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
                        {/* Thinking Section if this assistant message has intermediate steps */}
                        {isAssistant && msg.thoughts && msg.thoughts.length > 0 && (
                          <ThinkingSection
                            thoughts={msg.thoughts}
                            isThinking={msg.isThinking}
                          />
                        )}

                        {/* Message Content: Rich Markdown & Table rendering for Assistant, clean text for User */}
                        {isAssistant ? (
                          msg.content ? (
                            <MarkdownRenderer content={msg.content} />
                          ) : msg.isThinking ? null : (
                            <div className="oasis-msg-text">{msg.content}</div>
                          )
                        ) : (
                          <div className="oasis-msg-text">{msg.content}</div>
                        )}

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
                        {isAssistant && msg.content && (
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
            {isSending &&
              (!messages.length ||
                messages[messages.length - 1].role !== 'assistant' ||
                !messages[messages.length - 1].isThinking) && (
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

      {/* Quick Action Chips Row */}
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
