'use client';

import React from 'react';

interface TimelineEvent {
  eventId: string;
  name: string;
  description: string;
  startTime: string;
  endTime: string;
  imageIds: string[];
  personIds: string[];
}

interface EventTimelineProps {
  events: TimelineEvent[];
}

const EventTimeline: React.FC<EventTimelineProps> = ({ events }) => {
  if (events.length === 0) {
    return (
      <div className="glass" style={{ padding: '3rem', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)' }}>No events clustered yet. Upload more photos to see temporal patterns.</p>
      </div>
    );
  }

  // Sort events by start time
  const sortedEvents = [...events].sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

  return (
    <div className="glass" style={{ padding: '2rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Memory Timeline</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          AI-clustered events discovered from your visual history.
        </p>
      </div>

      <div style={{ position: 'relative', paddingLeft: '2rem' }}>
        {/* Vertical line */}
        <div style={{ 
          position: 'absolute', 
          left: '7px', 
          top: '0', 
          bottom: '0', 
          width: '2px', 
          background: 'linear-gradient(180deg, var(--accent-primary), transparent)',
          opacity: 0.3
        }}></div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
          {sortedEvents.map((event, i) => (
            <div key={event.eventId} style={{ position: 'relative' }}>
              {/* Dot */}
              <div style={{ 
                position: 'absolute', 
                left: '-26px', 
                top: '6px', 
                width: '14px', 
                height: '14px', 
                borderRadius: '50%', 
                backgroundColor: 'var(--accent-primary)',
                border: '3px solid var(--bg-primary)',
                zIndex: 2,
                boxShadow: '0 0 10px var(--accent-primary)'
              }}></div>

              <div className="glass-hover" style={{ 
                padding: '1.5rem', 
                borderRadius: '16px', 
                border: '1px solid var(--glass-border)',
                backgroundColor: 'rgba(255, 255, 255, 0.02)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <h3 style={{ fontSize: '1.25rem', color: 'var(--accent-primary)', margin: 0 }}>
                    {event.name}
                  </h3>
                  <span style={{ 
                    fontSize: '0.75rem', 
                    color: 'var(--text-muted)',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    padding: '4px 10px',
                    borderRadius: '100px'
                  }}>
                    {new Date(event.startTime).toLocaleDateString()}
                  </span>
                </div>

                <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '1.25rem' }}>
                  {event.description}
                </p>

                <div style={{ display: 'flex', gap: '2rem' }}>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', display: 'block', marginBottom: '0.5rem' }}>
                      Visual Evidence
                    </span>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                       <span style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                         {event.imageIds.length} Photos
                       </span>
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', display: 'block', marginBottom: '0.5rem' }}>
                      Participants
                    </span>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                       <span style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                         {event.personIds.length} People Identified
                       </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default EventTimeline;
