'use client';

import React, { useState, useRef } from 'react';
import { searchImages, searchByImage } from '@/lib/api';
import ImageCard from './ImageCard';

const SearchSection: React.FC<{ people: any[] }> = ({ people }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [visualResults, setVisualResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsSearching(true);
    setVisualResults([]);
    try {
      const data = await searchImages(query);
      setResults(data);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleVisualSearch = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsSearching(true);
    setResults([]);
    try {
      const data = await searchByImage(file);
      setVisualResults(data);
    } catch (err) {
      console.error('Visual search failed:', err);
      alert('Visual search failed. Ensure someone is in the photo.');
    } finally {
      setIsSearching(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div style={{ marginBottom: '2rem' }}>
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Semantic search: 'the boy in blue' or 'mountain view'..."
          className="glass"
          style={{
            flex: 1,
            padding: '1rem 1.5rem',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid var(--glass-border)',
            borderRadius: '100px',
            color: 'white',
            outline: 'none',
            fontSize: '1rem'
          }}
        />
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          accept="image/*"
          onChange={handleVisualSearch}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="glass"
          disabled={isSearching}
          title="Search by Person Image"
          style={{
            padding: '0 1rem',
            borderRadius: '100px',
            border: '1px solid var(--glass-border)',
            fontSize: '1.2rem',
            cursor: 'pointer',
            opacity: isSearching ? 0.7 : 1
          }}
        >
          📷
        </button>
        <button
          type="submit"
          className="tab-active"
          disabled={isSearching}
          style={{
            padding: '0 2rem',
            borderRadius: '100px',
            fontWeight: '600',
            opacity: isSearching ? 0.7 : 1
          }}
        >
          {isSearching ? '...' : 'Search'}
        </button>
      </form>

      {/* Visual results display */}
      {visualResults.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <h3 style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>Found People Matches</h3>
          {visualResults.map((match, idx) => (
            <div key={idx} className="glass" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
                <div style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>
                  👤
                </div>
                <div>
                  <h4 style={{ margin: 0 }}>{match.match.name || 'Unknown Person'}</h4>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>Confidence: {Math.round(match.confidence * 100)}%</p>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                {match.images.map((img: any) => (
                  <ImageCard key={img.imageId} image={img} people={people} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Text results display */}
      {results.length > 0 && (
        <div style={{ marginTop: '2rem', animation: 'fadeIn 0.5s ease' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ color: 'var(--text-secondary)' }}>
              Top {results.length} semantic matches
            </h3>
            <button 
              onClick={() => setResults([])}
              style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}
            >
              Clear Results
            </button>
          </div>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', 
            gap: '1.5rem' 
          }}>
            {results.map((res) => (
              <div key={res.imageId} style={{ position: 'relative' }}>
                <ImageCard image={res} people={people} />
                <div style={{ 
                  position: 'absolute', 
                  top: '10px', 
                  right: '10px', 
                  backgroundColor: 'var(--accent-primary)',
                  color: 'white',
                  padding: '2px 8px',
                  borderRadius: '100px',
                  fontSize: '0.7rem',
                  fontWeight: 'bold',
                  zIndex: 10
                }}>
                  {Math.round(res.score * 100)}% Match
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchSection;
