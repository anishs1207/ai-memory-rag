import { useCallback, useEffect, useState } from 'react';
import { Check, ChevronDown, ChevronRight, Clock3, FileCheck2, Pause, Play, RefreshCw, ShieldAlert, Trash2, UserRoundCog, X } from 'lucide-react';
import type { RuntimeSnapshot, TaskStatus } from '../types';

const statusLabel: Record<TaskStatus, string> = {
  planned: 'Planned', running: 'Running', 'waiting-approval': 'Needs approval', paused: 'Paused', completed: 'Completed', failed: 'Failed',
};

export function TaskDashboard({ onUseTemplate }: { onUseTemplate: (prompt: string) => void }) {
  const [snapshot, setSnapshot] = useState<RuntimeSnapshot | null>(null);
  const [expanded, setExpanded] = useState<string>('');
  const [section, setSection] = useState<'tasks' | 'templates' | 'memory' | 'schedules' | 'profiles'>('tasks');
  const [draft, setDraft] = useState({ name: '', value: '' });

  const refresh = useCallback(async () => setSnapshot(await window.electron.getRuntimeSnapshot()), []);
  useEffect(() => { void refresh(); const timer = window.setInterval(refresh, 2500); return () => window.clearInterval(timer); }, [refresh]);
  const dispatch = async (command: unknown) => setSnapshot(await window.electron.dispatchTaskCommand(command));
  if (!snapshot) return <div className="task-dashboard-empty">Loading task runtime…</div>;

  return (
    <div className="task-dashboard">
      <div className="task-dashboard-tabs">
        {(['tasks', 'templates', 'memory', 'schedules', 'profiles'] as const).map((item) => <button key={item} className={section === item ? 'active' : ''} onClick={() => setSection(item)}>{item}</button>)}
        <button onClick={refresh} title="Refresh"><RefreshCw size={11} /></button>
      </div>
      {section === 'tasks' && <div className="task-list">
        {!snapshot.tasks.length && <div className="task-dashboard-empty">Large browser tasks will appear here with workers, evidence, retries, and approvals.</div>}
        {snapshot.tasks.map((task) => <div className="task-card" key={task.id}>
          <button className="task-card-head" onClick={() => setExpanded(expanded === task.id ? '' : task.id)}>
            {expanded === task.id ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <span className={`task-status ${task.status}`}>{statusLabel[task.status]}</span>
            <strong>{task.goal}</strong><small>{task.progress}%</small>
          </button>
          {expanded === task.id && <div className="task-card-body">
            <div className="task-progress"><i style={{ width: `${task.progress}%` }} /></div>
            <p>{task.message}</p>
            {task.workers.map((worker) => <div className="task-worker" key={worker.id}><UserRoundCog size={11} /><span><b>{worker.goal}</b><small>{statusLabel[worker.status]} · {worker.message}</small></span></div>)}
            {task.approvals.filter((approval) => approval.status === 'pending').map((approval) => <div className={`task-approval risk-${approval.risk}`} key={approval.id}>
              <ShieldAlert size={13} /><span><b>{approval.title}</b><small>{approval.description}</small></span>
              <button onClick={() => dispatch({ type: 'approve', taskId: task.id, approvalId: approval.id, decision: 'approved' })}><Check size={11} /> Approve</button>
              <button onClick={() => dispatch({ type: 'approve', taskId: task.id, approvalId: approval.id, decision: 'rejected' })}><X size={11} /></button>
            </div>)}
            {!!task.evidence.length && <div className="task-evidence"><b><FileCheck2 size={11} /> Evidence ({task.evidence.length})</b>{task.evidence.map((item) => <a href={item.url} key={item.id} title={item.excerpt}>{item.title} <small>{Math.round(item.confidence * 100)}%</small></a>)}</div>}
            <div className="task-controls">
              {task.status === 'paused' ? <button onClick={() => dispatch({ type: 'status', taskId: task.id, status: 'running', message: 'Resumed' })}><Play size={11} /> Resume</button> : <button onClick={() => dispatch({ type: 'status', taskId: task.id, status: 'paused', message: 'Paused by user' })}><Pause size={11} /> Pause</button>}
              {(task.status === 'failed' || task.status === 'completed') && <button onClick={() => dispatch({ type: 'retry', taskId: task.id })}><RefreshCw size={11} /> Retry</button>}
            </div>
          </div>}
        </div>)}
      </div>}
      {section === 'templates' && <div className="runtime-list"><form className="runtime-add" onSubmit={(event) => { event.preventDefault(); if (!draft.name || !draft.value) return; void dispatch({ type: 'template-save', template: { id: `template-${Date.now()}`, name: draft.name, prompt: draft.value, category: 'Custom' } }); setDraft({ name: '', value: '' }); }}><input placeholder="Template name" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })}/><input placeholder="Reusable task prompt" value={draft.value} onChange={(event) => setDraft({ ...draft, value: event.target.value })}/><button>Add</button></form>{snapshot.templates.map((template) => <button key={template.id} onClick={() => onUseTemplate(template.prompt)}><b>{template.name}</b><small>{template.category}</small></button>)}</div>}
      {section === 'memory' && <div className="runtime-list"><form className="runtime-add" onSubmit={(event) => { event.preventDefault(); if (!draft.name || !draft.value) return; void dispatch({ type: 'memory-save', memory: { id: `memory-${Date.now()}`, label: draft.name, value: draft.value, createdAt: new Date().toISOString() } }); setDraft({ name: '', value: '' }); }}><input placeholder="Preference name" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })}/><input placeholder="What Blinky should remember" value={draft.value} onChange={(event) => setDraft({ ...draft, value: event.target.value })}/><button>Add</button></form>{snapshot.memories.map((memory) => <div key={memory.id}><span><b>{memory.label}</b><small>{memory.value}</small></span><button onClick={() => dispatch({ type: 'delete-memory', memoryId: memory.id })}><Trash2 size={11} /></button></div>)}</div>}
      {section === 'schedules' && <div className="runtime-list"><form className="runtime-add" onSubmit={(event) => { event.preventDefault(); if (!draft.name || !draft.value) return; void dispatch({ type: 'schedule-save', schedule: { id: `schedule-${Date.now()}`, name: draft.name, prompt: draft.value, intervalMinutes: 1440, enabled: true, nextRunAt: new Date(Date.now() + 86_400_000).toISOString() } }); setDraft({ name: '', value: '' }); }}><input placeholder="Daily schedule name" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })}/><input placeholder="Task to run every day" value={draft.value} onChange={(event) => setDraft({ ...draft, value: event.target.value })}/><button>Add</button></form>{snapshot.schedules.map((schedule) => <div key={schedule.id}><Clock3 size={11} /><span><b>{schedule.name}</b><small>Every {schedule.intervalMinutes} min · next {new Date(schedule.nextRunAt).toLocaleString()}</small></span></div>)}</div>}
      {section === 'profiles' && <div className="runtime-list">{snapshot.profiles.map((profile) => <div key={profile.id}><i className="profile-dot" style={{ background: profile.color }} /><span><b>{profile.name}</b><small>Isolated cookies · {profile.partition}</small></span></div>)}</div>}
    </div>
  );
}
