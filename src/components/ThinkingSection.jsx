import React, { useState } from 'react';

/**
 * ThinkingSection Component
 * Displays intermediate agent thoughts / database queries in a modern collapsible section.
 * - Expanded during active reasoning so user sees live query progress
 * - Collapsed once final substantive answer arrives, with option to toggle
 */
export default function ThinkingSection({ thoughts, isThinking }) {
  // If user explicitly toggles the section, remember their choice; otherwise auto-expand while thinking and auto-collapse when done
  const [userToggled, setUserToggled] = useState(null);

  if (!thoughts || thoughts.length === 0) return null;

  const isExpanded = userToggled !== null ? userToggled : Boolean(isThinking);

  return (
    <div className={`oasis-thinking-box ${isThinking ? 'in-progress' : 'completed'}`}>
      <button
        type="button"
        className="oasis-thinking-toggle"
        onClick={() => setUserToggled(!isExpanded)}
        aria-expanded={isExpanded}
      >
        <div className="oasis-thinking-toggle-left">
          {isThinking ? (
            <span className="oasis-thinking-spinner-icon" aria-hidden="true">
              <svg className="oasis-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="13" height="13">
                <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                <path d="M12 2a10 10 0 0 1 10 10" />
              </svg>
            </span>
          ) : (
            <span className="oasis-thinking-brain-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
                <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24A2.5 2.5 0 0 1 9.5 2Z" />
                <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24A2.5 2.5 0 0 0 14.5 2Z" />
              </svg>
            </span>
          )}
          <span className="oasis-thinking-label">
            {isThinking
              ? 'Searching database & reasoning...'
              : `Thought process (${thoughts.length} step${thoughts.length > 1 ? 's' : ''})`}
          </span>
        </div>
        <span className={`oasis-thinking-chevron ${isExpanded ? 'open' : ''}`} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>

      {isExpanded && (
        <div className="oasis-thinking-content">
          {thoughts.map((step, idx) => (
            <div key={idx} className="oasis-thinking-step-row">
              <span className="oasis-thinking-step-bullet">✓</span>
              <span className="oasis-thinking-step-text">{step}</span>
            </div>
          ))}
          {isThinking && (
            <div className="oasis-thinking-active-indicator">
              <span className="oasis-thinking-mini-dot"></span>
              <span className="oasis-thinking-mini-dot"></span>
              <span className="oasis-thinking-mini-dot"></span>
              <span className="oasis-thinking-status-text">Querying operational database...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
