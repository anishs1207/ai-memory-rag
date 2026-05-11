'use client';

import React, { useState } from 'react';
import { mergePeople } from '@/lib/api';

interface MergePeopleSectionProps {
  people: any[];
  onSuccess: () => void;
}

const MergePeopleSection: React.FC<MergePeopleSectionProps> = ({ people, onSuccess }) => {
  const [targetId, setTargetId] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [isMerging, setIsMerging] = useState(false);
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  const handleMerge = async () => {
    if (!targetId || !sourceId || targetId === sourceId) {
      setMessage({ text: 'Please select two different people to merge.', type: 'error' });
      return;
    }

    if (!window.confirm('Are you sure you want to merge these identities? This will migrate all images and relationships to the keeping identity and delete the other one.')) {
      return;
    }

    setIsMerging(true);
    setMessage(null);

    try {
      await mergePeople(targetId, sourceId);
      setMessage({ text: 'Identities successfully merged!', type: 'success' });
      setSourceId('');
      onSuccess();
    } catch (err: any) {
      console.error('Merge failed:', err);
      setMessage({ text: err.response?.data?.message || 'Failed to merge identities.', type: 'error' });
    } finally {
      setIsMerging(false);
    }
  };

  return (
    <div className="glass" style={{ padding: '1.5rem', marginBottom: '2rem', border: '1px dashed var(--accent-primary)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '0.2rem' }}>Identity Consolidation Tool</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Merge duplicate identities into a single record.</p>
        </div>
        <div style={{ color: 'var(--accent-primary)', fontSize: '1.2rem' }}>🧬</div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.4rem', fontWeight: 'bold' }}>KEEP THIS IDENTITY (PRIMARY)</label>
          <select 
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            style={{ 
              width: '100%', 
              padding: '0.75rem', 
              borderRadius: '8px', 
              backgroundColor: 'rgba(255, 255, 255, 0.05)', 
              color: 'white', 
              border: '1px solid var(--glass-border)',
              outline: 'none'
            }}
          >
            <option value="">Select Identity...</option>
            {people.map(p => (
              <option key={p.personId} value={p.personId}>
                {p.name && p.name !== 'unknown' ? p.name : p.personId.slice(0, 8)} ({p.imageIds.length} images)
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingBottom: '0.75rem' }}>
          <span style={{ fontSize: '1.2rem' }}>←</span>
        </div>

        <div style={{ flex: 1, minWidth: '200px' }}>
          <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.4rem', fontWeight: 'bold' }}>MERGE THIS IDENTITIY (WILL BE DELETED)</label>
          <select 
            value={sourceId}
            onChange={(e) => setSourceId(e.target.value)}
            style={{ 
              width: '100%', 
              padding: '0.75rem', 
              borderRadius: '8px', 
              backgroundColor: 'rgba(255, 255, 255, 0.05)', 
              color: 'white', 
              border: '1px solid var(--glass-border)',
              outline: 'none'
            }}
          >
            <option value="">Select Identity...</option>
            {people.map(p => (
              <option key={p.personId} value={p.personId}>
                {p.name && p.name !== 'unknown' ? p.name : p.personId.slice(0, 8)} ({p.imageIds.length} images)
              </option>
            ))}
          </select>
        </div>

        <button 
          onClick={handleMerge}
          disabled={isMerging || !targetId || !sourceId}
          style={{ 
            backgroundColor: 'var(--accent-primary)', 
            color: 'white', 
            padding: '0.75rem 2rem', 
            borderRadius: '8px', 
            fontWeight: 'bold',
            opacity: isMerging || !targetId || !sourceId ? 0.5 : 1,
            cursor: isMerging || !targetId || !sourceId ? 'not-allowed' : 'pointer',
            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
            height: '45px'
          }}
        >
          {isMerging ? 'Merging...' : 'Merge Identities'}
        </button>
      </div>

      {message && (
        <div style={{ 
          marginTop: '1rem', 
          fontSize: '0.85rem', 
          color: message.type === 'success' ? '#22c55e' : '#ef4444',
          padding: '0.5rem',
          backgroundColor: message.type === 'success' ? 'rgba(34, 197, 94, 0.05)' : 'rgba(239, 68, 68, 0.05)',
          borderRadius: '4px',
          border: `1px solid ${message.type === 'success' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)'}`
        }}>
          {message.text}
        </div>
      )}
    </div>
  );
};

export default MergePeopleSection;
