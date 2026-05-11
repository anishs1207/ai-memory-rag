'use client';

import React, { useMemo, useState, useRef, useEffect } from 'react';

interface NetworkGraphProps {
  people: any[];
  relationships: any[];
}

const NetworkGraph: React.FC<NetworkGraphProps> = ({ people, relationships }) => {
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Pan and Zoom state
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Simple Force-Directed inspired layout with better spacing
  const { nodes, links } = useMemo(() => {
    const nodeCount = people.length;
    const radius = Math.max(180, nodeCount * 30); // Dynamic radius based on crowd
    const centerX = 250;
    const centerY = 250;

    const nodesData = people.map((p, i) => {
      const angle = (i / nodeCount) * Math.PI * 2;
      return {
        ...p,
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
      };
    });

    const linksData = relationships.map((rel) => {
      const source = nodesData.find((n) => n.personId === rel.person1Id);
      const target = nodesData.find((n) => n.personId === rel.person2Id);
      return { 
        source, 
        target, 
        relation: rel.relation,
        id: `${rel.person1Id}-${rel.person2Id}-${rel.relation}`
      };
    }).filter(l => l.source && l.target);

    return { nodes: nodesData, links: linksData };
  }, [people, relationships]);

  const getProfileUrl = (p: any) => {
    if (!p || !p.profileImageUrl) return null;
    return p.profileImageUrl.startsWith('http') 
      ? p.profileImageUrl 
      : `${API_BASE_URL}${p.profileImageUrl}`;
  };

  // Interaction Handlers
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setTransform(prev => ({
      ...prev,
      scale: Math.max(0.5, Math.min(3, prev.scale * delta))
    }));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setTransform(prev => ({
      ...prev,
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    }));
  };

  const handleMouseUp = () => setIsDragging(false);

  // Prevention of overlap logic: 
  // We'll calculate a slight offset for labels if there are multiple links between same pairs
  // For this simple version, we'll just use a cleaner label placement with a background
  
  return (
    <div className="glass" style={{ 
      padding: '2rem', 
      marginBottom: '2rem', 
      overflow: 'hidden',
      position: 'relative',
      cursor: isDragging ? 'grabbing' : 'grab'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.25rem' }}>Neural Social Graph</h2>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          Scroll to Zoom • Drag to Pan
        </div>
      </div>

      <div 
        ref={containerRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ 
          width: '100%', 
          height: '500px', 
          backgroundColor: 'rgba(0,0,0,0.2)',
          borderRadius: '12px',
          border: '1px solid var(--glass-border)',
          touchAction: 'none'
        }}
      >
        <svg 
          viewBox="0 0 500 500" 
          style={{ width: '100%', height: '100%' }}
        >
          <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
            {/* Links */}
            {links.map((link, i) => {
              const dx = link.target!.x - link.source!.x;
              const dy = link.target!.y - link.source!.y;
              const angle = Math.atan2(dy, dx) * (180 / Math.PI);
              
              return (
                <g key={link.id + i}>
                  <line
                    x1={link.source!.x}
                    y1={link.source!.y}
                    x2={link.target!.x}
                    y2={link.target!.y}
                    stroke="var(--accent-primary)"
                    strokeWidth="1.5"
                    strokeOpacity="0.3"
                  />
                  {/* Label with Background to prevent overlap mess */}
                  <g transform={`translate(${(link.source!.x + link.target!.x) / 2}, ${(link.source!.y + link.target!.y) / 2})`}>
                    <rect 
                      x="-25" 
                      y="-8" 
                      width="50" 
                      height="12" 
                      rx="4" 
                      fill="var(--bg-primary)" 
                      opacity="0.8" 
                    />
                    <text
                      fill="var(--text-secondary)"
                      fontSize="8"
                      fontWeight="600"
                      textAnchor="middle"
                      dy="1"
                    >
                      {link.relation}
                    </text>
                  </g>
                </g>
              );
            })}

            {/* Nodes */}
            {nodes.map((node) => (
              <g key={node.personId}>
                <circle
                  cx={node.x}
                  cy={node.y}
                  r="25"
                  fill="var(--bg-accent)"
                  stroke="var(--accent-primary)"
                  strokeWidth="2"
                  className="glow"
                />
                <defs>
                  <clipPath id={`clip-${node.personId}`}>
                    <circle cx={node.x} cy={node.y} r="23" />
                  </clipPath>
                </defs>
                {getProfileUrl(node) ? (
                  <image
                    href={getProfileUrl(node)!}
                    x={node.x - 23}
                    y={node.y - 23}
                    width="46"
                    height="46"
                    clipPath={`url(#clip-${node.personId})`}
                  />
                ) : (
                  <text
                    x={node.x}
                    y={node.y}
                    fill="white"
                    textAnchor="middle"
                    dy="0.3em"
                    fontSize="18"
                  >
                    👤
                  </text>
                )}
                
                {/* Name Label with backdrop */}
                <rect 
                  x={node.x - 30} 
                  y={node.y + 32} 
                  width="60" 
                  height="14" 
                  rx="4" 
                  fill="var(--bg-primary)" 
                  opacity="0.9" 
                />
                <text
                  x={node.x}
                  y={node.y + 42}
                  fill="white"
                  fontSize="10"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {node.name !== 'unknown' ? node.name : node.personId.slice(0, 4)}
                </text>
              </g>
            ))}
          </g>
        </svg>
      </div>
      
      <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
         <button 
           onClick={() => setTransform({ x: 0, y: 0, scale: 1 })}
           className="glass glass-hover"
           style={{ padding: '0.4rem 0.8rem', fontSize: '0.7rem', color: 'var(--text-secondary)' }}
         >
           Reset View
         </button>
      </div>
    </div>
  );
};

export default NetworkGraph;
