import React from 'react';
import OasisOrb from './OasisOrb';

export default function OasisLauncherButton({ onClick, isOpen }) {
  return (
    <button
      className={`oasis-launcher-btn ${isOpen ? 'active-open' : ''}`}
      onClick={onClick}
      title={isOpen ? 'Minimize OASIS AI Copilot' : 'Open OASIS AI Copilot'}
      aria-label={isOpen ? 'Minimize OASIS AI Copilot' : 'Open OASIS AI Copilot'}
    >
      {!isOpen && <div className="oasis-launcher-pulse" />}
      <OasisOrb size={56} />
    </button>
  );
}
