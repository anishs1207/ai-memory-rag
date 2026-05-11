import React, { useState, useEffect } from 'react';
import { getImageUrl, getPredictions } from '@/lib/api';

interface MapViewProps {
  images: any[];
}

const MapView: React.FC<MapViewProps> = ({ images }) => {
  const [predictions, setPredictions] = useState<any[]>([]);
  const geoImages = images.filter(img => img.gps);

  useEffect(() => {
    const fetchPredictions = async () => {
      try {
        const data = await getPredictions();
        setPredictions(data);
      } catch (err) {
        console.error('Failed to fetch predictions:', err);
      }
    };
    fetchPredictions();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div className="glass" style={{ padding: '2rem', border: '1px solid var(--accent-primary)' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Geographic Memory Intelligence</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Visualizing your physical path through captured coordinates.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '2rem', minHeight: '600px' }}>
        {/* Mock Map / Visualization Area */}
        <div className="glass" style={{ 
          position: 'relative', 
          backgroundColor: '#0f172a', 
          borderRadius: '16px', 
          overflow: 'hidden',
          backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.05) 1px, transparent 0)',
          backgroundSize: '40px 40px'
        }}>
          {geoImages.length === 0 ? (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              No GPS data found in current memories.
            </div>
          ) : (
            <div style={{ padding: '2rem', height: '100%' }}>
              {/* This is a symbolic visualization of coordinates */}
              <div style={{ 
                width: '100%', 
                height: '100%', 
                position: 'relative',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px'
              }}>
                {geoImages.map((img, i) => {
                  // Normalize coordinates for a simple symbolic map placement
                  // This is a placeholder for a real map component
                  const left = ((img.gps.lng + 180) / 360) * 100;
                  const top = ((90 - img.gps.lat) / 180) * 100;
                  
                  return (
                    <div 
                      key={img.imageId}
                      style={{ 
                        position: 'absolute', 
                        left: `${left}%`, 
                        top: `${top}%`,
                        transform: 'translate(-50%, -50%)'
                      }}
                    >
                      <div className="pin-container" style={{ position: 'relative' }}>
                        <div style={{ 
                          width: '12px', 
                          height: '12px', 
                          backgroundColor: 'var(--accent-primary)', 
                          borderRadius: '50%',
                          border: '2px solid white',
                          boxShadow: '0 0 10px var(--accent-primary)'
                        }} />
                        <div className="tooltip" style={{
                           position: 'absolute',
                           bottom: '20px',
                           left: '50%',
                           transform: 'translateX(-50%)',
                           padding: '0.5rem',
                           backgroundColor: 'rgba(0,0,0,0.8)',
                           color: 'white',
                           fontSize: '0.7rem',
                           borderRadius: '4px',
                           whiteSpace: 'nowrap',
                           display: 'none',
                           zIndex: 10
                        }}>
                          {img.filename}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar: Location List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ fontSize: '1.2rem' }}>Captured Locations</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', overflowY: 'auto', maxHeight: '500px' }}>
            {geoImages.map(img => (
              <div key={img.imageId} className="glass" style={{ padding: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <img 
                  src={getImageUrl(img.imageId)} 
                  style={{ width: '50px', height: '50px', borderRadius: '8px', objectFit: 'cover' }} 
                />
                <div style={{ fontSize: '0.8rem' }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '0.2rem' }}>{img.analysis.locationContext}</div>
                  <div style={{ color: 'var(--text-muted)' }}>{img.gps.lat.toFixed(4)}, {img.gps.lng.toFixed(4)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {predictions.length > 0 && (
        <div className="glass" style={{ padding: '2rem', border: '1px dashed var(--accent-primary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <span style={{ fontSize: '1.5rem' }}>🔮</span>
            <div>
              <h3 style={{ fontSize: '1.2rem', margin: 0 }}>Neural Future Path</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                Predictive Chronology based on historic geospatial patterns.
              </p>
            </div>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
            {predictions.map((p, i) => (
              <div key={i} style={{ 
                padding: '1.5rem', 
                backgroundColor: 'rgba(59, 130, 246, 0.05)', 
                borderRadius: '12px', 
                border: '1px solid rgba(59, 130, 246, 0.1)' 
              }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--accent-primary)', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                  {p.predictedTimeRange}
                </div>
                <div style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                  📍 {p.locationContext}
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                  {p.reasoning}
                </p>
                <div style={{ marginTop: '1rem', width: '100%', height: '4px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '2px' }}>
                  <div style={{ width: `${p.confidence * 100}%`, height: '100%', backgroundColor: 'var(--accent-primary)', borderRadius: '2px' }} />
                </div>
                <div style={{ fontSize: '0.7rem', marginTop: '0.2rem', color: 'var(--text-muted)' }}>
                  Confidence: {Math.round(p.confidence * 100)}%
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <style jsx>{`
        .pin-container:hover .tooltip {
          display: block;
        }
      `}</style>
    </div>
  );
};

export default MapView;
