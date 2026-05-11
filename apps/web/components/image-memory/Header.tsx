'use client';

import React from 'react';

const Header: React.FC = () => {
  return (
    <header style={{ marginBottom: '4rem', textAlign: 'center' }}>
      <div style={{ display: 'inline-block', marginBottom: '1rem' }}>
        <span style={{
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          color: 'var(--accent-primary)',
          padding: '0.5rem 1rem',
          borderRadius: '100px',
          fontSize: '0.75rem',
          fontWeight: '600',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          border: '1px solid rgba(59, 130, 246, 0.2)'
        }}>
          Visual Intelligence System
        </span>
      </div>
      <h1 style={{ fontSize: '3.5rem', marginBottom: '1rem', background: 'linear-gradient(to bottom, #ffffff, #a0a0a0)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
        Memory
      </h1>
      <p style={{ fontSize: '1.25rem', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto' }}>
        Connect your visual experiences with advanced VLM analysis and retrieval.
      </p>
    </header>
  );
};

export default Header;
