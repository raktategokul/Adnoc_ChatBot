import React, { useState } from 'react';
import { COPILOT_CONFIG } from '../services/copilotService';

export default function CopilotConfigModal({ isOpen, onClose, onSave }) {
  const [tokenEndpoint, setTokenEndpoint] = useState(COPILOT_CONFIG.tokenEndpoint || '');
  const [directLineSecret, setDirectLineSecret] = useState(COPILOT_CONFIG.directLineSecret || '');
  const [showSecret, setShowSecret] = useState(false);
  const [status, setStatus] = useState('');

  if (!isOpen) return null;

  const handleSave = (e) => {
    e.preventDefault();
    onSave({
      tokenEndpoint: tokenEndpoint.trim(),
      directLineSecret: directLineSecret.trim(),
    });
    setStatus('Connection settings saved successfully!');
    setTimeout(() => {
      setStatus('');
      onClose();
    }, 900);
  };

  return (
    <div className="oasis-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="oasis-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="oasis-modal-header">
          <div className="oasis-modal-header-left">
            <div className="oasis-modal-icon-badge">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
            </div>
            <div>
              <h2 className="oasis-modal-title">Copilot Studio Connection</h2>
              <div className="oasis-modal-subtitle">ADNOC Command Center Agent Integration</div>
            </div>
          </div>
          <button
            type="button"
            className="oasis-modal-close-btn"
            onClick={onClose}
            aria-label="Close settings"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="16" height="16">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSave} className="oasis-modal-form">
          {/* Info callout */}
          <div className="oasis-modal-notice">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16" className="oasis-notice-icon">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
            <span>
              Connect directly to your Microsoft Copilot Studio agent by entering either the <strong>Token Endpoint</strong> or <strong>Direct Line Secret</strong>.
            </span>
          </div>

          {/* Option 1: Token Endpoint URL */}
          <div className="oasis-form-field">
            <div className="oasis-field-label-row">
              <label htmlFor="copilot-token-endpoint" className="oasis-field-label">
                Option 1: Token Endpoint URL
              </label>
              <span className="oasis-recommended-tag">Recommended</span>
            </div>
            <div className="oasis-input-wrapper">
              <input
                id="copilot-token-endpoint"
                type="text"
                className="oasis-modal-text-input"
                placeholder="https://...api.botframework.com/powervirtualagents/.../directline/token?api-version=..."
                value={tokenEndpoint}
                onChange={(e) => setTokenEndpoint(e.target.value)}
                autoComplete="off"
                spellCheck="false"
              />
            </div>
            <span className="oasis-field-help">
              Copilot Studio: <em>Settings &gt; Channels &gt; Mobile app &gt; Token Endpoint</em>
            </span>
          </div>

          {/* Divider */}
          <div className="oasis-form-divider">
            <span className="oasis-divider-line"></span>
            <span className="oasis-divider-text">OR</span>
            <span className="oasis-divider-line"></span>
          </div>

          {/* Option 2: Direct Line Secret Key */}
          <div className="oasis-form-field">
            <div className="oasis-field-label-row">
              <label htmlFor="copilot-directline-secret" className="oasis-field-label">
                Option 2: Direct Line Secret Key
              </label>
            </div>
            <div className="oasis-input-wrapper with-icon">
              <input
                id="copilot-directline-secret"
                type={showSecret ? 'text' : 'password'}
                className="oasis-modal-text-input"
                placeholder="Enter Direct Line Secret Key..."
                value={directLineSecret}
                onChange={(e) => setDirectLineSecret(e.target.value)}
                autoComplete="off"
                spellCheck="false"
              />
              <button
                type="button"
                className="oasis-input-icon-btn"
                onClick={() => setShowSecret(!showSecret)}
                title={showSecret ? 'Hide secret' : 'Show secret'}
              >
                {showSecret ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                )}
              </button>
            </div>
            <span className="oasis-field-help">
              Azure Bot / Copilot Studio: <em>Channels &gt; Direct Line &gt; Secret Keys</em>
            </span>
          </div>

          {/* Success Banner */}
          {status && (
            <div className="oasis-modal-success-banner">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
              <span>{status}</span>
            </div>
          )}

          {/* Modal Footer */}
          <div className="oasis-modal-footer">
            <button type="button" className="oasis-btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="oasis-btn-primary">
              Save &amp; Connect
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
