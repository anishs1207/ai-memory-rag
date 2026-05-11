'use client';

import React, { useState, useRef } from 'react';
import { uploadImage } from '@/lib/api';

interface UploadSectionProps {
  onUploadSuccess: () => void;
}

const UploadSection: React.FC<UploadSectionProps> = ({ onUploadSuccess }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setError(null);

    try {
      const uploadPromises = Array.from(files).map(file => uploadImage(file));
      await Promise.all(uploadPromises);
      
      onUploadSuccess();
      if (fileInputRef.current) fileInputRef.current.value = '';
      alert(`${files.length} images have been queued for background processing.`);
    } catch (err: any) {
      console.error('Upload failed:', err);
      setError(err.response?.data?.message || 'Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="glass" style={{ padding: '2rem', marginBottom: '3rem', textAlign: 'center' }}>
      <h2 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>Upload New Image</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
        Select an image to process and add to your visual memory system.
      </p>
      
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
        <input 
          type="file" 
          accept="image/*" 
          multiple
          onChange={handleFileChange}
          style={{ display: 'none' }}
          ref={fileInputRef}
          disabled={isUploading}
        />
        
        <button 
          onClick={() => fileInputRef.current?.click()}
          className={isUploading ? '' : 'glow'}
          style={{ 
            backgroundColor: isUploading ? 'var(--bg-accent)' : 'var(--accent-primary)',
            color: 'white',
            padding: '0.75rem 2rem',
            borderRadius: '8px',
            fontWeight: '600',
            fontSize: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            opacity: isUploading ? 0.7 : 1,
            cursor: isUploading ? 'not-allowed' : 'pointer'
          }}
        >
          {isUploading ? (
            <>
              <span className="spinner"></span>
              Processing...
            </>
          ) : (
            <>
              <span>↑</span>
              Select Image
            </>
          )}
        </button>
        
        {error && (
          <p style={{ color: '#ef4444', fontSize: '0.875rem', marginTop: '1rem' }}>
            {error}
          </p>
        )}
      </div>

      <style jsx>{`
        .spinner {
          width: 18px;
          height: 18px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default UploadSection;
