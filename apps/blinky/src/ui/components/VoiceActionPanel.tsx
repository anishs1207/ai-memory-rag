import { Mic } from 'lucide-react';

export interface ExecutionLog {
  command: string;
  timestamp: string;
  status: 'success' | 'failed';
  details: string;
}

interface VoiceActionPanelProps {
  isListening: boolean;
  clickyStatus: string;
  toggleListening: () => void;
  executionLogs: ExecutionLog[];
}

/**
 * VoiceActionPanel renders the voice status orb and the list of system action execution logs.
 */
export function VoiceActionPanel({
  isListening,
  clickyStatus,
  toggleListening,
  executionLogs
}: VoiceActionPanelProps) {
  return (
    <div className="aihere-agent-panel">
      {/* Orb representing active speech status with pulsing animation */}
      <div className="cly-orb-section">
        <div className="cly-orb-wrapper">
          <div className="cly-orb-pulse-ring" />
          <div className="cly-orb-pulse-ring" />
          <div className="cly-orb-pulse-ring" />

          <div
            className={`cly-orb ${isListening ? 'listening' : ''} ${clickyStatus.startsWith('Thinking') ? 'thinking' : ''} ${clickyStatus.startsWith('Executing') ? 'executing' : ''}`}
            onClick={toggleListening}
            title={isListening ? "Listening... Click to stop" : "Click to speak"}
          >
            <Mic size={24} color="#fff" />
          </div>
        </div>

        {/* Dynamic status badge reflecting exact stage of automation execution */}
        <div className={`cly-status-badge ${isListening ? 'listening' : ''} ${clickyStatus.startsWith('Thinking') ? 'thinking' : ''} ${clickyStatus.startsWith('Executing') ? 'executing' : ''}`}>
          {clickyStatus}
        </div>
      </div>

      {/* History panel logging recent commands and execution states */}
      <div className="cly-log-panel">
        <div className="cly-log-header">Desktop Action History</div>
        <div className="cly-log-list">
          {executionLogs.length === 0 ? (
            <div className="cly-log-empty">
              Local app actions will appear here.
            </div>
          ) : (
            executionLogs.map((log, idx) => (
              <div className="cly-log-item" key={idx}>
                <div className="cly-log-left">
                  <span className="cly-log-timestamp">{log.timestamp}</span>
                  <span className="cly-log-command">"{log.command}"</span>
                </div>
                <span className={`cly-log-status ${log.status}`}>
                  {log.status === 'success' ? 'Executed' : 'Failed'}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
