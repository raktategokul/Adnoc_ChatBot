import React from 'react';

const DEFAULT_PROMPTS = [
  'What can you help me with?',
  'Tell me about ADNOC services',
  'Summary of safety guidelines',
  'Help with technical support',
];

export default function QuickPrompts({ onSelectPrompt }) {
  return (
    <div className="quick-prompts-wrapper">
      <span className="quick-prompts-label">Suggested queries:</span>
      <div className="quick-prompts-list">
        {DEFAULT_PROMPTS.map((prompt, index) => (
          <button
            key={index}
            className="quick-prompt-chip"
            onClick={() => onSelectPrompt(prompt)}
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}
