'use client';

import React from 'react';
import { getImageUrl } from '@/lib/api';

interface ImageCardProps {
  image: {
    imageId: string;
    filename: string;
    uploadedAt: string;
    detectedPersonIds?: string[];
    analysis: {
      rawDescription: string;
      tags: string[];
      [key: string]: any;
    };
    [key: string]: any;
  };
  people?: any[];
  onClick?: () => void;
}

const ImageCard: React.FC<ImageCardProps> = ({ image, people = [], onClick }) => {
  const [isPrivacyMode, setIsPrivacyMode] = React.useState(false);
  const analysis = image.analysis || {};
  const description = analysis.rawDescription || "No description available";
  const tags = analysis.tags || [];
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  const currentImageUrl = isPrivacyMode 
    ? `${API_BASE_URL}/images/${image.imageId}/privacy` 
    : getImageUrl(image.imageId);

  const getPersonProfile = (personId: string) => {
    const person = people.find(p => p.personId === personId);
    if (!person || !person.profileImageUrl) return null;
    return person.profileImageUrl.startsWith('http') 
      ? person.profileImageUrl 
      : `${API_BASE_URL}${person.profileImageUrl}`;
  };
  
  return (
    <div 
      className="glass glass-hover animate-fade-in"
      style={{ 
        cursor: 'pointer',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        position: 'relative',
        border: isPrivacyMode ? '1px solid var(--accent-primary)' : '1px solid var(--glass-border)'
      }}
      onClick={onClick}
    >
      <div style={{ position: 'relative', width: '100%', paddingTop: '66.6%' }}>
        <img 
          src={currentImageUrl} 
          alt={description}
          style={{ 
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transition: 'filter 0.3s ease'
          }}
        />

        {/* Privacy Toggle */}
        <button 
          onClick={(e) => { e.stopPropagation(); setIsPrivacyMode(!isPrivacyMode); }}
          title={isPrivacyMode ? 'Disable Privacy Mode' : 'Enable Privacy Mode (Blur Strangers)'}
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            zIndex: 10,
            backgroundColor: isPrivacyMode ? 'var(--accent-primary)' : 'rgba(0,0,0,0.5)',
            border: 'none',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            cursor: 'pointer',
            backdropFilter: 'blur(4px)',
            transition: 'all 0.2s ease'
          }}
        >
          {isPrivacyMode ? '🛡️' : '👤'}
        </button>
        
        {/* Person Avatars Overlay */}
        <div style={{ 
          position: 'absolute', 
          bottom: '10px', 
          right: '10px', 
          display: 'flex', 
          flexDirection: 'row-reverse',
          gap: '-10px' // Negative gap for overlapping effect
        }}>
          {image.detectedPersonIds?.slice(0, 5).map((pId, i) => {
            const profileUrl = getPersonProfile(pId);
            return (
              <div key={pId} style={{ 
                width: '32px', 
                height: '32px', 
                borderRadius: '50%', 
                border: '2px solid white', 
                overflow: 'hidden',
                backgroundColor: 'var(--bg-accent)',
                marginLeft: i > 0 ? '-10px' : '0',
                zIndex: 5 + (5 - i),
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
              }}>
                {profileUrl ? (
                  <img src={profileUrl} alt="Person" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem' }}>👤</div>
                )}
              </div>
            );
          })}
          {image.detectedPersonIds && image.detectedPersonIds.length > 5 && (
            <div style={{ 
              width: '32px', 
              height: '32px', 
              borderRadius: '50%', 
              border: '2px solid white', 
              backgroundColor: 'var(--accent-primary)',
              color: 'white',
              fontSize: '0.6rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: '-10px',
              zIndex: 1,
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }}>
              +{image.detectedPersonIds.length - 5}
            </div>
          )}
        </div>
      </div>
      <div style={{ padding: '1.25rem', flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
          <h3 style={{ fontSize: '1rem', color: 'var(--text-primary)', margin: 0 }}>
            {image.filename}
          </h3>
        </div>
        <p style={{ 
          fontSize: '0.875rem', 
          color: 'var(--text-secondary)', 
          marginBottom: '1rem',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          lineHeight: '1.5'
        }}>
          {description}
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: 'auto' }}>
          {analysis.locationContext && (
            <span 
              style={{ 
                fontSize: '0.7rem', 
                padding: '2px 8px', 
                backgroundColor: 'rgba(255, 255, 255, 0.05)', 
                color: 'var(--text-secondary)',
                borderRadius: '100px',
                border: '1px solid var(--glass-border)'
              }}
            >
              📍 {analysis.locationContext}
            </span>
          )}
          {tags.slice(0, 3).map((tag: string, i: number) => (
            <span 
              key={i} 
              style={{ 
                fontSize: '0.7rem', 
                padding: '2px 8px', 
                backgroundColor: 'rgba(59, 130, 246, 0.1)', 
                color: 'var(--accent-primary)',
                borderRadius: '100px',
                border: '1px solid rgba(59, 130, 246, 0.2)'
              }}
            >
              {tag}
            </span>
          ))}
          {tags.length > 3 && (
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              +{tags.length - 3}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImageCard;
