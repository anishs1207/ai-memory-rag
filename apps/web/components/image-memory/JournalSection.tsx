import React, { useState, useRef } from 'react';
import { generateJournal } from '@/lib/api';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface JournalSectionProps {
  journals: any[];
  onRefresh: () => void;
}

const JournalSection: React.FC<JournalSectionProps> = ({ journals, onRefresh }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const journalListRef = useRef<HTMLDivElement>(null);

  const handleExportPDF = async () => {
    if (!journalListRef.current) return;
    setIsExporting(true);
    
    try {
      const canvas = await html2canvas(journalListRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#0f172a' // Match dark theme for "Physical" look
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Identity-Vault-Life-Book-${new Date().toLocaleDateString()}.pdf`);
    } catch (err) {
      console.error('PDF Export failed:', err);
      alert('Failed to export Life Book.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      await generateJournal(selectedDate);
      onRefresh();
    } catch (err) {
      console.error('Failed to generate journal:', err);
      alert('Failed to generate journal. Ensure images exist for this date.');
    } finally {
      setIsGenerating(false);
    }
  };

  const sortedJournals = [...journals].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div className="glass" style={{ padding: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--accent-primary)' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Neural Daily Journals</h2>
          <p style={{ color: 'var(--text-secondary)' }}>AI-driven reflections of your life's captured moments.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <input 
            type="date" 
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{ 
              padding: '0.5rem', 
              borderRadius: '8px', 
              backgroundColor: 'rgba(255,255,255,0.05)', 
              color: 'white', 
              border: '1px solid var(--glass-border)' 
            }}
          />
          <button 
            onClick={handleGenerate}
            disabled={isGenerating}
            className="glow"
            style={{ 
              backgroundColor: 'var(--accent-primary)', 
              color: 'white', 
              padding: '0.75rem 1.5rem', 
              borderRadius: '8px',
              opacity: isGenerating ? 0.5 : 1
            }}
          >
            {isGenerating ? 'Reflecting...' : 'Generate Reflection'}
          </button>
          <button 
            onClick={handleExportPDF}
            disabled={isExporting || sortedJournals.length === 0}
            style={{ 
              backgroundColor: 'rgba(255,255,255,0.05)', 
              color: 'white', 
              padding: '0.75rem 1.5rem', 
              borderRadius: '8px',
              border: '1px solid var(--glass-border)',
              opacity: isExporting || sortedJournals.length === 0 ? 0.5 : 1
            }}
          >
            {isExporting ? 'Exporting...' : '📖 Export Life Book'}
          </button>
        </div>
      </div>

      <div ref={journalListRef} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '10px' }}>
        {sortedJournals.length === 0 ? (
          <div className="glass" style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            No journal entries yet. Generate your first reflection above!
          </div>
        ) : (
          sortedJournals.map((entry) => (
            <div key={entry.entryId} className="glass" style={{ padding: '2rem', position: 'relative', overflow: 'hidden' }}>
              <div style={{ 
                position: 'absolute', 
                top: 0, 
                left: 0, 
                width: '4px', 
                height: '100%', 
                backgroundColor: 'var(--accent-primary)' 
              }} />
              
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', fontWeight: 'bold', textTransform: 'uppercase' }}>
                  {new Date(entry.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Mood: {entry.mood}
                </span>
              </div>
              
              <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>{entry.title}</h3>
              <p style={{ lineHeight: '1.7', color: 'var(--text-secondary)', fontSize: '1.05rem', whiteSpace: 'pre-wrap' }}>
                {entry.summary}
              </p>
              
              <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <span>Included {entry.imageIds.length} memories</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default JournalSection;
