'use client';

import React from 'react';

interface Relationship {
  person1Id: string;
  person2Id: string;
  relation: string;
  confidence: number;
  evidence: string;
}

interface RelationshipSectionProps {
  relationships: Relationship[];
  people: any[];
}

const RelationshipSection: React.FC<RelationshipSectionProps> = ({ relationships, people }) => {
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  const getPerson = (id: string) => {
    return people.find(p => p.personId === id);
  };

  const getPersonName = (id: string) => {
    const person = getPerson(id);
    if (!person) return id.slice(0, 6);
    return person.name && person.name !== 'unknown' ? person.name : `ID ${id.slice(0, 4)}`;
  };

  const getProfileUrl = (id: string) => {
    const person = getPerson(id);
    if (!person || !person.profileImageUrl) return null;
    return person.profileImageUrl.startsWith('http') 
      ? person.profileImageUrl 
      : `${API_BASE_URL}${person.profileImageUrl}`;
  };

  if (relationships.length === 0) {
    return (
      <div className="glass" style={{ padding: '3rem', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)' }}>No relationships discovered yet.</p>
      </div>
    );
  }

  return (
    <div className="glass" style={{ padding: '2rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Network Explorer</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          Visualizing derived social connections and evidence-based relationships.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '1.5rem' }}>
        {relationships.map((rel, i) => (
          <div key={i} className="glass" style={{ 
            padding: '1.5rem', 
            backgroundColor: 'rgba(255, 255, 255, 0.02)', 
            borderRadius: '16px',
            border: '1px solid var(--glass-border)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
              {/* Person 1 */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                <div style={{ 
                  width: '60px', 
                  height: '60px', 
                  borderRadius: '50%', 
                  overflow: 'hidden', 
                  border: '2px solid var(--accent-primary)',
                  backgroundColor: 'var(--bg-accent)'
                }}>
                  {getProfileUrl(rel.person1Id) ? (
                    <img src={getProfileUrl(rel.person1Id)!} alt="p1" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>👤</div>
                  )}
                </div>
                <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-primary)', textAlign: 'center' }}>
                  {getPersonName(rel.person1Id)}
                </span>
              </div>

              {/* Relationship Label */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', flex: 1 }}>
                <div style={{ height: '2px', width: '100%', background: 'linear-gradient(90deg, transparent, var(--accent-primary), transparent)' }}></div>
                <span style={{ 
                  fontSize: '0.75rem', 
                  color: 'var(--accent-primary)', 
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  backgroundColor: 'rgba(59, 130, 246, 0.1)',
                  padding: '2px 8px',
                  borderRadius: '4px'
                }}>
                  {rel.relation}
                </span>
                <div style={{ height: '2px', width: '100%', background: 'linear-gradient(90deg, transparent, var(--accent-primary), transparent)' }}></div>
              </div>

              {/* Person 2 */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                <div style={{ 
                  width: '60px', 
                  height: '60px', 
                  borderRadius: '50%', 
                  overflow: 'hidden', 
                  border: '2px solid var(--accent-primary)',
                  backgroundColor: 'var(--bg-accent)'
                }}>
                  {getProfileUrl(rel.person2Id) ? (
                    <img src={getProfileUrl(rel.person2Id)!} alt="p2" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>👤</div>
                  )}
                </div>
                <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-primary)', textAlign: 'center' }}>
                  {getPersonName(rel.person2Id)}
                </span>
              </div>
            </div>

            <div style={{ 
              padding: '1rem', 
              backgroundColor: 'rgba(0, 0, 0, 0.2)', 
              borderRadius: '8px',
              fontSize: '0.85rem',
              color: 'var(--text-secondary)',
              lineHeight: '1.5',
              border: '1px solid rgba(255, 255, 255, 0.05)'
            }}>
              <strong style={{ color: 'var(--text-primary)', fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem' }}>AI EVIDENCE:</strong>
              "{rel.evidence}"
            </div>

            <div style={{ position: 'absolute', top: '10px', right: '15px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              {Math.round(rel.confidence * 100)}% Confidence
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RelationshipSection;
