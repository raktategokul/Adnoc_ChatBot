import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';

export default function Header() {
  const { user, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const displayName = user?.name || 'Gokul';
  const displayEmail = user?.email || 'user@company.com';
  const initial = displayName.charAt(0).toUpperCase();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setDropdownOpen(false);
    await logout();
  };

  return (
    <header className="app-header">
      <div className="header-left">
        <div className="brand-wrapper">
          <div className="brand-logo-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M12 2L2 7L12 12L22 7L12 2Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M2 17L12 22L22 17"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M2 12L12 17L22 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <span className="brand-title">NexusAI</span>
        </div>
        <span className="brand-badge">AI Assistant</span>
      </div>

      <div className="header-right">
        <div className="status-badge" title="Service operational">
          <span className="status-dot"></span>
          <span>Online</span>
        </div>
        
        <div className="header-divider" aria-hidden="true"></div>

        {/* User profile with dropdown menu */}
        <div className="user-menu-container" ref={dropdownRef}>
          <button
            className="user-profile-button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            aria-expanded={dropdownOpen}
            aria-haspopup="true"
          >
            <div className="user-avatar" title={displayName}>
              {initial}
            </div>
            <span className="user-name">{displayName}</span>
            <svg
              className={`dropdown-chevron ${dropdownOpen ? 'rotated' : ''}`}
              viewBox="0 0 20 20"
              fill="currentColor"
              width="14"
              height="14"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>

          {dropdownOpen && (
            <div className="user-dropdown-menu" role="menu">
              <div className="user-dropdown-info">
                <span className="dropdown-user-name">{displayName}</span>
                <span className="dropdown-user-email">{displayEmail}</span>
              </div>
              <div className="dropdown-divider"></div>
              <button
                className="dropdown-item"
                onClick={() => setDropdownOpen(false)}
                role="menuitem"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
                <span>Profile</span>
              </button>
              <button
                className="dropdown-item dropdown-logout-item"
                onClick={handleLogout}
                role="menuitem"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <polyline points="16 17 21 12 16 7"></polyline>
                  <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
