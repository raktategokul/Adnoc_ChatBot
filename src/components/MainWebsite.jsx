import React, { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import OasisChatWidget from './OasisChatWidget';
import OasisLauncherButton from './OasisLauncherButton';

export default function MainWebsite() {
  const { user, logout } = useAuth();
  // Start with chat minimized so user only sees the orb launcher button
  const [isChatOpen, setIsChatOpen] = useState(false);

  const displayName = user?.name || 'Gokul';
  const displayEmail = user?.email || 'user@company.com';
  const initial = displayName.charAt(0).toUpperCase();

  const handleLogout = async () => {
    sessionStorage.removeItem('oasis_session_active_conv_id');
    sessionStorage.removeItem('oasis_session_initialized');
    await logout();
  };

  return (
    <div className="oasis-website-layout">
      {/* Top Application Bar matching ADNOC OASIS Header */}
      <header className="oasis-topbar">
        <div className="oasis-topbar-left">
          {/* ADNOC Logo Icon */}
          <div className="adnoc-brand-logo">
            <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" width="28" height="28">
              <circle cx="18" cy="18" r="17" fill="#0056b3" />
              <path
                d="M18 5C10.82 5 5 10.82 5 18C5 25.18 10.82 31 18 31C24.18 31 29.35 26.68 30.65 20.93C27.56 22.42 23.95 23.23 20.15 23.23C13.56 23.23 7.95 19.38 5.76 13.9C8.36 8.5 13.9 5 18 5Z"
                fill="white"
                opacity="0.9"
              />
              <path
                d="M18 9C13.5 9 9.7 11.5 8 15C10 12.2 13.5 10.5 17.5 10.5C22.5 10.5 26.5 13.5 28 17.5C27 12.5 23 9 18 9Z"
                fill="#38bdf8"
              />
            </svg>
          </div>

          <div className="oasis-header-branding">
            <span className="adnoc-oasis-title">ADNOC OASIS</span>
            <span className="adnoc-oasis-divider">|</span>
            <span className="adnoc-oasis-tagline">Operational Assurance System for Integrity and Safety</span>
          </div>
        </div>

        <div className="oasis-topbar-right">
          {/* Filter badges from the screenshot */}
          <div className="oasis-filter-pill">
            <span>By GC</span>
            <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </div>

          <div className="oasis-filter-pill">
            <span>By Site</span>
            <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </div>

          <div className="oasis-filter-pill">
            <span>By Plant</span>
            <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </div>

          {/* User Profile & Logout */}
          <div className="oasis-user-pill" title={`Signed in as ${displayEmail}`}>
            <div className="oasis-user-avatar">{initial}</div>
            <span className="oasis-user-name">{displayName}</span>
            <button
              className="oasis-logout-btn"
              onClick={handleLogout}
              title="Sign Out"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Main Website Plain Canvas Area */}
      <main className="oasis-main-viewport">
        {/* Left Sidebar Navigation Icons from screenshot */}
        <aside className="oasis-left-rail">
          <div className="oasis-rail-btn active" title="Dashboard">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
          </div>

          <div className="oasis-rail-btn" title="Alarms">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
              <circle cx="12" cy="13" r="8"></circle>
              <path d="M12 9v4l2 2"></path>
              <path d="M5 3L2 6"></path>
              <path d="M22 6l-3-3"></path>
            </svg>
          </div>

          <div className="oasis-rail-btn" title="Integrity & Safety">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
          </div>

          <div className="oasis-rail-btn" title="Consoles">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
              <line x1="8" y1="21" x2="16" y2="21"></line>
              <line x1="12" y1="17" x2="12" y2="21"></line>
            </svg>
          </div>

          <div className="oasis-rail-btn" title="Reports">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
              <line x1="8" y1="6" x2="21" y2="6"></line>
              <line x1="8" y1="12" x2="21" y2="12"></line>
              <line x1="8" y1="18" x2="21" y2="18"></line>
              <line x1="3" y1="6" x2="3.01" y2="6"></line>
              <line x1="3" y1="12" x2="3.01" y2="12"></line>
              <line x1="3" y1="18" x2="3.01" y2="18"></line>
            </svg>
          </div>

          <div className="oasis-rail-bottom">
            <div className="oasis-rail-btn" title="Settings">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
            </div>
            <div className="oasis-user-circle">RS</div>
          </div>
        </aside>

        {/* Dashboard Plain Background / Viewport */}
        <div className="oasis-dashboard-canvas">
          <div className="oasis-dashboard-header">
            <h1 className="oasis-dashboard-title">Alarm Champion Dashboard</h1>
            <div className="oasis-dashboard-unit-badge">Unit: Primary Command</div>
          </div>

          {/* Clean, Plain Dashboard Background Canvas */}
          <div className="oasis-plain-backdrop">
            <div className="oasis-grid-preview">
              {/* Minimal preview cards for background depth */}
              <div className="oasis-preview-card">
                <div className="oasis-card-label">Alarm Management</div>
                <div className="oasis-card-sub">Consoles Health • 03-08 Stable</div>
                <div className="oasis-card-metrics-row">
                  <div className="oasis-metric-box">
                    <span className="oasis-metric-val">05</span>
                    <span className="oasis-metric-desc">Consoles In Range</span>
                  </div>
                  <div className="oasis-metric-box">
                    <span className="oasis-metric-val">11</span>
                    <span className="oasis-metric-desc">Peak Alarm Rate</span>
                  </div>
                </div>
              </div>

              <div className="oasis-preview-card">
                <div className="oasis-card-label">Operational Integrity Envelope</div>
                <div className="oasis-card-metrics-row">
                  <div className="oasis-metric-box">
                    <span className="oasis-metric-val">00</span>
                    <span className="oasis-metric-desc">OWEL in Number</span>
                  </div>
                  <div className="oasis-metric-box">
                    <span className="oasis-metric-val">93</span>
                    <span className="oasis-metric-desc">SOL Excursion</span>
                  </div>
                  <div className="oasis-metric-box">
                    <span className="oasis-metric-val">61</span>
                    <span className="oasis-metric-desc">PRD Activation</span>
                  </div>
                </div>
              </div>

              <div className="oasis-preview-card">
                <div className="oasis-card-label">Master Alarm Database (MADB)</div>
                <div className="oasis-card-metrics-row">
                  <div className="oasis-metric-box">
                    <span className="oasis-metric-val">439</span>
                    <span className="oasis-metric-desc">Active Discrepancies</span>
                  </div>
                  <div className="oasis-metric-box">
                    <span className="oasis-metric-val">369</span>
                    <span className="oasis-metric-desc">Aging &gt; 30 Days</span>
                  </div>
                  <div className="oasis-metric-box">
                    <span className="oasis-metric-val">309</span>
                    <span className="oasis-metric-desc">Repetitive</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="oasis-backdrop-notice">
              <span>ADNOC Operational Command Center • Connected to Live AI Copilot</span>
            </div>
          </div>
        </div>
      </main>

      {/* Floating Launcher Button at Bottom Right (Always visible, click toggles open/minimize) */}
      <OasisLauncherButton
        isOpen={isChatOpen}
        onClick={() => setIsChatOpen((prev) => !prev)}
      />

      {/* OASIS AI Copilot Floating Widget Window (as shown in screenshot) */}
      <OasisChatWidget
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
      />
    </div>
  );
}
