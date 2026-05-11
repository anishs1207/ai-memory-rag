import React, { useEffect, useState } from 'react';
import { getFlashbacks, getImageUrl } from '@/lib/api';

const FlashbackSection: React.FC = () => {
  const [flashbacks, setFlashbacks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getFlashbacks();
        setFlashbacks(data || []);
      } catch (err) {
        console.error('Failed to load flashbacks:', err);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  if (isLoading || flashbacks.length === 0) return null;

  return (
    <div className="glass" style={{ padding: '2rem', marginBottom: '2rem', animation: 'fadeIn 0.8s ease-out', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <span style={{ fontSize: '1.5rem' }}>🕰️</span>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>Today in History</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>Relive your memories from this day in previous years.</p>
        </div>
      </div>

      <div style={{ 
        display: 'flex', 
        gap: '1.5rem', 
        overflowX: 'auto', 
        paddingBottom: '1rem',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none'
      }}>
        {flashbacks.map((img) => {
          const yearsAgo = new Date().getFullYear() - new Date(img.uploadedAt).getFullYear();
          return (
            <div key={img.imageId} style={{ minWidth: '240px', position: 'relative' }}>
              <div style={{ 
                width: '100%', 
                aspectRatio: '1', 
                borderRadius: '16px', 
                overflow: 'hidden',
                border: '1px solid var(--glass-border)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
              }}>
                <img 
                  src={getImageUrl(img.imageId)} 
                  alt={img.filename}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
              <div style={{ 
                position: 'absolute', 
                top: '0.75rem', 
                right: '0.75rem',
                backgroundColor: 'var(--accent-primary)',
                color: 'white',
                padding: '0.25rem 0.75rem',
                borderRadius: '100px',
                fontSize: '0.75rem',
                fontWeight: '700',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
              }}>
                {yearsAgo} {yearsAgo === 1 ? 'Year' : 'Years'} Ago
              </div>
              <div style={{ marginTop: '0.75rem' }}>
                <p style={{ 
                  fontSize: '0.85rem', 
                  fontWeight: '600', 
                  margin: 0, 
                  color: 'var(--text-primary)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>{img.analysis.scene}</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Captured in {new Date(img.uploadedAt).getFullYear()}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FlashbackSection;
