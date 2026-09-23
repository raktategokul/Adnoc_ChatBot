import React, { useState } from 'react';
import { COPILOT_CONFIG } from '../services/copilotService';

export default function CopilotConfigModal({ isOpen, onClose, onSave }) {
  const [tokenEndpoint, setTokenEndpoint] = useState(COPILOT_CONFIG.tokenEndpoint);
  const [directLineSecret, setDirectLineSecret] = useState(COPILOT_CONFIG.directLineSecret);
  const [status, setStatus] = useState('');

  if (!isOpen) return null;

  const handleSave = (e) => {
    e.preventDefault();
    onSave({ tokenEndpoint: tokenEndpoint.trim(), directLineSecret: directLineSecret.trim() });
    setStatus('Configuration saved!');
    setTimeout(() => {
      setStatus('');
      onClose();
    }, 800);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-wrap">
            <div className="modal-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
            </div>
            <h3>Copilot Studio Connection</h3>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>

        <form onSubmit={handleSave} className="modal-body">
          <p className="modal-desc">
            To connect this custom UI directly to your Copilot Studio bot (<strong>Adnoc Chatbot test</strong>),
            enter either the <strong>Token Endpoint URL</strong> or <strong>Direct Line Secret</strong>.
          </p>

          <div className="form-group">
            <label htmlFor="token-endpoint">Option 1: Token Endpoint URL (Recommended)</label>
            <input
              id="token-endpoint"
              type="text"
              className="modal-input"
              placeholder="https://...api.botframework.com/powervirtualagents/.../directline/token?api-version=..."
              value={tokenEndpoint}
              onChange={(e) => setTokenEndpoint(e.target.value)}
            />
            <span className="field-hint">
              Found in Copilot Studio: <em>Settings &gt; Channels &gt; Mobile app &gt; Token Endpoint</em>
            </span>
          </div>

          <div className="form-divider">
            <span>OR</span>
          </div>

          <div className="form-group">
            <label htmlFor="directline-secret">Option 2: Direct Line Secret Key</label>
            <input
              id="directline-secret"
              type="password"
              className="modal-input"
              placeholder="Enter Direct Line Secret Key"
              value={directLineSecret}
              onChange={(e) => setDirectLineSecret(e.target.value)}
            />
            <span className="field-hint">
              Found in Copilot Studio / Azure Bot: <em>Channels &gt; Direct Line &gt; Secret Keys</em>
            </span>
          </div>

          {status && <div className="modal-success-banner">{status}</div>}

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Save &amp; Connect
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
