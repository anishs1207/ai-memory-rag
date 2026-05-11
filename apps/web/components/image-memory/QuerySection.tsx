'use client';

import React, { useState, useRef, useEffect } from 'react';
import { chatWithMemory, searchImages } from '@/lib/api';
import api from '@/lib/api';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const QuerySection: React.FC = () => {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isQuerying, setIsQuerying] = useState(false);
  const [mode, setMode] = useState<'chat' | 'search'>('chat');
  const [error, setError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    const currentQuery = query;
    setQuery('');
    setError(null);

    setIsQuerying(true);

    try {
      if (mode === 'chat') {
        const newUserMessage: Message = { role: 'user', content: currentQuery };
        setMessages(prev => [...prev, newUserMessage]);
        
        const data = await chatWithMemory(currentQuery, messages);
        setMessages(prev => [...prev, { role: 'assistant', content: data.answer }]);
      } else {
        setSearchResults([]);
        const data = await searchImages(currentQuery);
        setSearchResults(data || []);
      }
    } catch (err: any) {
      console.error('Action failed:', err);
      setError(err.response?.data?.message || 'Action failed. Please try again.');
    } finally {
      setIsQuerying(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setSearchResults([]);
    setError(null);
  };

  return (
    <div className="glass" style={{ padding: '2rem', marginBottom: '3rem', animation: 'fadeIn 0.5s ease-out' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ color: 'var(--text-primary)', marginBottom: '0.25rem', fontSize: '1.5rem', fontWeight: '800' }}>
            {mode === 'chat' ? 'Neural Memory Assistant' : 'Visual Search Engine'}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            {mode === 'chat' ? 'Converse with your memories and discover deep insights.' : 'Find specific visual patterns and concepts across your vault.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button 
            onClick={clearChat}
            style={{ fontSize: '0.7rem', color: 'var(--text-muted)', cursor: 'pointer', background: 'none', border: 'none' }}
          >
            Clear
          </button>
          <div style={{ 
            display: 'flex', 
            backgroundColor: 'rgba(255, 255, 255, 0.05)', 
            padding: '4px', 
            borderRadius: '100px',
            border: '1px solid var(--glass-border)'
          }}>
            <button 
              onClick={() => setMode('chat')}
              className={mode === 'chat' ? 'tab-active' : 'tab-inactive'}
              style={{ padding: '0.4rem 1.25rem', borderRadius: '100px', border: 'none', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer',
                backgroundColor: mode === 'chat' ? 'var(--accent-primary)' : 'transparent',
                color: mode === 'chat' ? 'white' : 'var(--text-muted)'
              }}
            >
              CHAT
            </button>
            <button 
              onClick={() => setMode('search')}
              className={mode === 'search' ? 'tab-active' : 'tab-inactive'}
              style={{ padding: '0.4rem 1.25rem', borderRadius: '100px', border: 'none', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer',
                backgroundColor: mode === 'search' ? 'var(--accent-primary)' : 'transparent',
                color: mode === 'search' ? 'white' : 'var(--text-muted)'
              }}
            >
              SEARCH
            </button>
          </div>
        </div>
      </div>

      {mode === 'chat' && messages.length > 0 && (
        <div style={{ 
          maxHeight: '450px', 
          overflowY: 'auto', 
          marginBottom: '1.5rem', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '1.25rem',
          padding: '1.5rem',
          backgroundColor: 'rgba(0, 0, 0, 0.2)',
          borderRadius: '16px',
          border: '1px solid var(--glass-border)',
          scrollBehavior: 'smooth'
        }}>
          {messages.map((m, i) => (
            <div key={i} style={{ 
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '85%',
              padding: '1rem 1.5rem',
              borderRadius: m.role === 'user' ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
              backgroundColor: m.role === 'user' ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.08)',
              color: 'white',
              fontSize: '1rem',
              lineHeight: '1.6',
              boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
              animation: 'slideUp 0.3s ease-out'
            }}>
              <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem', opacity: 0.6, fontWeight: '800' }}>
                {m.role === 'user' ? 'You' : 'Assistant'}
              </div>
              {m.content}
            </div>
          ))}
          {isQuerying && (
            <div style={{ alignSelf: 'flex-start', color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <div className="pulse" style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--accent-primary)' }}></div>
              Assistant is delving into your memories...
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
      )}
      
      <form onSubmit={handleAction} style={{ display: 'flex', gap: '1rem', position: 'relative' }}>
        <input 
          type="text" 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={mode === 'chat' ? "Ask about your journey, connections, or specific events..." : "Search for visual concepts like 'beach', 'smiling face', 'nature'..."}
          style={{ 
            flexGrow: 1,
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid var(--glass-border)',
            padding: '1.25rem 1.5rem',
            borderRadius: '14px',
            color: 'white',
            outline: 'none',
            fontSize: '1rem',
            boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.1)'
          }}
          disabled={isQuerying}
        />
        <button 
          type="submit"
          disabled={isQuerying}
          style={{ 
            backgroundColor: 'var(--accent-primary)',
            color: 'white',
            padding: '0.75rem 2.5rem',
            borderRadius: '14px',
            fontWeight: '800',
            opacity: isQuerying ? 0.7 : 1,
            cursor: isQuerying ? 'not-allowed' : 'pointer',
            boxShadow: '0 4px 20px rgba(59, 130, 246, 0.4)',
            transition: 'all 0.2s',
            border: 'none',
            textTransform: 'uppercase',
            letterSpacing: '0.025em'
          }}
        >
          {isQuerying ? 'Thinking...' : mode === 'chat' ? 'Chat' : 'Search'}
        </button>
      </form>

      {error && (
        <div style={{ 
          marginTop: '1.5rem', 
          padding: '1rem', 
          borderRadius: '10px', 
          backgroundColor: 'rgba(239, 68, 68, 0.1)', 
          border: '1px solid rgba(239, 68, 68, 0.2)',
          color: '#ef4444', 
          fontSize: '0.875rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          ⚠️ {error}
        </div>
      )}

      {searchResults.length > 0 && mode === 'search' && (
        <div style={{ marginTop: '2.5rem' }}>
          <h3 style={{ fontSize: '0.75rem', marginBottom: '1.5rem', color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '800' }}>
            Discovery: Found {searchResults.length} Match{searchResults.length === 1 ? '' : 'es'}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1.5rem' }}>
            {searchResults.map((img) => (
              <div key={img.imageId} className="glass glass-hover" style={{ overflow: 'hidden', borderRadius: '16px', border: '1px solid var(--glass-border)' }}>
                <div style={{ position: 'relative', width: '100%', aspectRatio: '4/3' }}>
                   <img 
                    src={`${api.defaults.baseURL}/images/${img.imageId}/file`} 
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }} 
                   />
                </div>
                <div style={{ padding: '1rem' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>{img.analysis.scene}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                     <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{new Date(img.uploadedAt).toLocaleDateString()}</span>
                     {img.score && <span style={{ fontSize: '0.7rem', fontWeight: '800', color: 'var(--accent-primary)' }}>{Math.round(img.score * 100)}%</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default QuerySection;
