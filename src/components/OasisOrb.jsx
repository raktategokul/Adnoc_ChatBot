import React from 'react';
import orbImg from '../assets/oasis_orb.jpg';

export default function OasisOrb({ size = 40, className = '', showStatus = false, isOnline = true }) {
  return (
    <div
      className={`oasis-orb-container ${className}`}
      style={{
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        className="oasis-orb-glow"
        style={{
          position: 'absolute',
          inset: '-2px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(168, 85, 247, 0.45) 0%, rgba(56, 189, 248, 0.25) 50%, transparent 70%)',
          filter: 'blur(4px)',
          pointerEvents: 'none',
        }}
      />
      <img
        src={orbImg}
        alt="OASIS AI Copilot"
        className="oasis-orb-media"
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          objectFit: 'cover',
          display: 'block',
          position: 'relative',
          zIndex: 1,
          border: '1px solid rgba(255, 255, 255, 0.18)',
          boxShadow: 'inset 0 0 8px rgba(0, 0, 0, 0.4)',
        }}
      />
      {showStatus && (
        <span
          className="oasis-orb-badge"
          style={{
            position: 'absolute',
            bottom: -1,
            right: -1,
            width: Math.max(9, Math.round(size * 0.26)),
            height: Math.max(9, Math.round(size * 0.26)),
            borderRadius: '50%',
            backgroundColor: isOnline ? '#10b981' : '#f59e0b',
            border: '2px solid #0d1520',
            boxShadow: isOnline ? '0 0 6px #10b981' : 'none',
            zIndex: 2,
          }}
          title={isOnline ? 'Online' : 'Offline'}
        />
      )}
    </div>
  );
}
