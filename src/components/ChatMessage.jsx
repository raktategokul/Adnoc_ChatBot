import React, { useState } from 'react';

export default function ChatMessage({ message, onSuggestedActionClick }) {
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState(null); // 'like' | 'dislike' | null

  const isBot = message.role === 'assistant' || message.sender === 'bot';
  const textContent = message.content || message.text || '';
  const timestamp = message.created_at
    ? new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : message.timestamp || 'Just now';

  const handleCopy = () => {
    if (textContent) {
      navigator.clipboard.writeText(textContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleFeedback = (type) => {
    setFeedback((prev) => (prev === type ? null : type));
  };

  return (
    <div className={`message-row ${isBot ? 'bot-row' : 'user-row'}`}>
      {isBot && (
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
      )}

      <div className="message-content-wrapper">
        <div className={`message-bubble ${isBot ? 'bot-bubble' : 'user-bubble'}`}>
          <div className="message-text">{textContent}</div>
        </div>

        {/* Suggested actions / buttons if present */}
        {message.suggestedActions && message.suggestedActions.length > 0 && (
          <div className="suggested-actions-container">
            {message.suggestedActions.map((action, idx) => (
              <button
                key={idx}
                className="suggested-action-chip"
                onClick={() => onSuggestedActionClick && onSuggestedActionClick(action.value || action.title)}
              >
                {action.title}
              </button>
            ))}
          </div>
        )}

        <div className="message-meta">
          <span className="message-time">{timestamp}</span>

          {isBot && (
            <div className="message-actions">
              <button
                className={`action-btn ${copied ? 'active' : ''}`}
                onClick={handleCopy}
                title={copied ? 'Copied!' : 'Copy response'}
                aria-label="Copy response"
              >
                {copied ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                )}
              </button>

              <button
                className={`action-btn ${feedback === 'like' ? 'active like' : ''}`}
                onClick={() => handleFeedback('like')}
                title="Helpful"
                aria-label="Thumb up"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                  <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
                </svg>
              </button>

              <button
                className={`action-btn ${feedback === 'dislike' ? 'active dislike' : ''}`}
                onClick={() => handleFeedback('dislike')}
                title="Not helpful"
                aria-label="Thumb down"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                  <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"></path>
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
