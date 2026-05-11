'use client';

import React from 'react';

interface PersonCardProps {
  person: {
    personId: string;
    name?: string;
    age?: string;
    gender?: string;
    mood?: string;
    profileImageUrl?: string;
    canonicalDescriptors: string[];
    imageIds: string[];
    embedText: string;
    biography?: string;
  };
  relationships?: any[];
  people?: any[];
  onRename?: () => void;
  onClick?: () => void;
}

const PersonCard: React.FC<PersonCardProps> = ({ person, relationships = [], people = [], onRename, onClick }) => {
  const [isEditing, setIsEditing] = React.useState(false);
  const [newName, setNewName] = React.useState(person.name || '');
  const [isSaving, setIsSaving] = React.useState(false);
  const [highlight, setHighlight] = React.useState<any>(null);
  const [isGeneratingHighlight, setIsGeneratingHighlight] = React.useState(false);

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  const profileUrl = person.profileImageUrl 
    ? (person.profileImageUrl.startsWith('http') ? person.profileImageUrl : `${API_BASE_URL}${person.profileImageUrl}`)
    : null;

  const handleSaveName = async () => {
    if (!newName.trim()) return;
    setIsSaving(true);
    try {
      const { renamePerson } = await import('@/lib/api');
      await renamePerson(person.personId, newName);
      setIsEditing(false);
      if (onRename) onRename();
    } catch (err) {
      console.error('Failed to rename:', err);
      alert('Failed to rename person');
    } finally {
      setIsSaving(false);
    }
  };

  const fetchHighlight = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsGeneratingHighlight(true);
    try {
      const { getPersonHighlight } = await import('@/lib/api');
      const data = await getPersonHighlight(person.personId);
      setHighlight(data);
    } catch (err) {
      console.error('Failed to get highlight:', err);
    } finally {
      setIsGeneratingHighlight(false);
    }
  };

  const myRelationships = relationships.filter(
    rel => rel.person1Id === person.personId || rel.person2Id === person.personId
  );

  const getOtherPersonInfo = (rel: any) => {
    const otherId = rel.person1Id === person.personId ? rel.person2Id : rel.person1Id;
    const other = people.find(p => p.personId === otherId);
    return {
      name: other?.name && other.name !== 'unknown' ? other.name : `ID ${otherId.slice(0, 4)}`,
      profileUrl: other?.profileImageUrl 
        ? (other.profileImageUrl.startsWith('http') ? other.profileImageUrl : `${API_BASE_URL}${other.profileImageUrl}`)
        : null
    };
  };

  return (
    <div 
      className="glass glass-hover animate-fade-in" 
      style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%', position: 'relative', cursor: onClick ? 'pointer' : 'default' }}
      onClick={onClick}
    >
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <div style={{ 
          width: '80px', 
          height: '80px', 
          borderRadius: '12px', 
          overflow: 'hidden', 
          backgroundColor: 'var(--bg-accent)',
          flexShrink: 0,
          border: '1px solid var(--glass-border)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
        }}>
          {profileUrl ? (
            <img 
              src={profileUrl} 
              alt={person.name || person.personId} 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => {
                console.warn(`Failed to load profile image for ${person.personId}: ${profileUrl}`);
                (e.target as any).style.display = 'none';
                (e.target as any).parentElement.innerHTML = '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:1.5rem;color:var(--text-muted)">👤</div>';
              }}
            />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', backgroundColor: 'var(--bg-muted)', color: 'var(--text-muted)' }}>
              👤
            </div>
          )}
        </div>
        <div style={{ flexGrow: 1 }}>
          {isEditing ? (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input 
                type="text" 
                value={newName} 
                onChange={(e) => setNewName(e.target.value)}
                style={{ 
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--glass-border)',
                  color: 'white',
                  padding: '0.25rem 0.5rem',
                  borderRadius: '4px',
                  width: '100%',
                  fontSize: '0.9rem'
                }}
                disabled={isSaving}
                autoFocus
              />
              <button onClick={handleSaveName} disabled={isSaving} style={{ color: 'var(--accent-primary)', background: 'none', border: 'none', cursor: 'pointer' }}>✓</button>
              <button onClick={() => setIsEditing(false)} disabled={isSaving} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h3 style={{ fontSize: '1.125rem', color: 'var(--text-primary)' }}>
                {person.name && person.name !== 'unknown' ? person.name : `Identity ${person.personId.slice(0, 6)}`}
              </h3>
              <button 
                onClick={() => setIsEditing(true)} 
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  cursor: 'pointer', 
                  fontSize: '0.8rem', 
                  opacity: 0.5 
                }}
              >
                ✏️
              </button>
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
            {person.gender && (
              <span style={{ 
                fontSize: '0.7rem', 
                color: 'var(--accent-primary)', 
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                padding: '1px 6px',
                borderRadius: '4px',
                fontWeight: '600'
              }}>
                {person.gender}
              </span>
            )}
            {person.age && <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{person.age}y</span>}
          </div>
        </div>
      </div>

      {highlight ? (
        <div style={{ 
          margin: '0.5rem 0',
          padding: '1rem',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderRadius: '12px',
          border: '1px solid rgba(59, 130, 246, 0.2)',
          animation: 'fadeIn 0.5s ease-out'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.65rem', fontWeight: '800', color: 'var(--accent-primary)', textTransform: 'uppercase' }}>{highlight.title}</span>
            <span style={{ fontSize: '0.6rem', padding: '1px 6px', backgroundColor: 'var(--accent-primary)', color: 'white', borderRadius: '4px' }}>{highlight.vibe}</span>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontStyle: 'italic', lineHeight: '1.5', margin: 0 }}>
            "{highlight.content}"
          </p>
          <button 
            onClick={(e) => { e.stopPropagation(); setHighlight(null); }}
            style={{ marginTop: '0.5rem', fontSize: '0.65rem', color: 'var(--text-muted)', cursor: 'pointer', background: 'none', border: 'none' }}
          >
            ← Back to Bio
          </button>
        </div>
      ) : (
        <p style={{ 
          fontSize: '0.85rem', 
          color: 'var(--text-secondary)', 
          lineHeight: '1.6', 
          flexGrow: 1,
          backgroundColor: 'rgba(255, 255, 255, 0.02)',
          padding: '0.75rem',
          borderRadius: '8px',
          border: '1px solid rgba(255, 255, 255, 0.03)'
        }}>
          {person.biography || person.embedText}
        </p>
      )}

      {!highlight && (
        <button 
          onClick={fetchHighlight} 
          disabled={isGeneratingHighlight}
          style={{ 
            marginTop: '0.25rem',
            padding: '0.4rem 0.75rem', 
            borderRadius: '6px', 
            border: '1px solid var(--accent-primary)',
            backgroundColor: 'transparent',
            color: 'var(--accent-primary)',
            fontSize: '0.75rem',
            fontWeight: '600',
            cursor: 'pointer',
            textAlign: 'center'
          }}
        >
          {isGeneratingHighlight ? '📽️ Synthesizing...' : '🎬 Show My Story'}
        </button>
      )}

      {myRelationships.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>Connections</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {myRelationships.slice(0, 3).map((rel, i) => {
              const other = getOtherPersonInfo(rel);
              return (
                <div key={i} style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.4rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  padding: '2px 8px 2px 4px',
                  borderRadius: '100px',
                  border: '1px solid rgba(255, 255, 255, 0.1)'
                }}>
                  <div style={{ width: '18px', height: '18px', borderRadius: '50%', overflow: 'hidden', backgroundColor: 'var(--bg-accent)' }}>
                    {other.profileUrl ? (
                      <img src={other.profileUrl} alt="p" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.4rem' }}>👤</div>
                    )}
                  </div>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                    {rel.relation} of <strong>{other.name}</strong>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ marginTop: 'auto', paddingTop: '0.5rem', borderTop: '1px solid var(--glass-border)' }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
          Manifested in {person.imageIds.length} observations
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
          {person.canonicalDescriptors.slice(0, 4).map((desc, i) => (
            <span 
              key={i} 
              style={{ 
                fontSize: '0.65rem', 
                padding: '2px 8px', 
                backgroundColor: 'rgba(255, 255, 255, 0.03)', 
                borderRadius: '4px',
                color: 'var(--text-muted)',
                border: '1px solid rgba(255, 255, 255, 0.05)'
              }}
            >
              #{desc}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PersonCard;
