import { app } from 'electron';
import fs from 'fs';
import path from 'path';

export type TaskStatus = 'planned' | 'running' | 'waiting-approval' | 'paused' | 'completed' | 'failed';
export type TaskCommand =
  | { type: 'create'; goal: string; workerGoals?: string[] }
  | { type: 'status'; taskId: string; status: TaskStatus; message?: string }
  | { type: 'approve'; taskId: string; approvalId: string; decision: 'approved' | 'rejected' }
  | { type: 'evidence'; taskId: string; evidence: Omit<EvidenceRecord, 'id' | 'capturedAt'> }
  | { type: 'profile-save'; profile: BrowserProfile }
  | { type: 'template-save'; template: TaskTemplate }
  | { type: 'schedule-save'; schedule: TaskSchedule }
  | { type: 'memory-save'; memory: MemoryRecord }
  | { type: 'delete-memory'; memoryId: string };

export interface WorkerRecord { id: string; goal: string; status: TaskStatus; progress: number; message: string }
export interface ApprovalRecord { id: string; title: string; description: string; risk: 'low' | 'medium' | 'high'; status: 'pending' | 'approved' | 'rejected'; payload?: unknown }
export interface EvidenceRecord { id: string; title: string; url: string; excerpt?: string; screenshot?: string; confidence: number; capturedAt: string; workerId?: string }
export interface TaskRecord { id: string; goal: string; status: TaskStatus; progress: number; createdAt: string; updatedAt: string; message: string; workers: WorkerRecord[]; approvals: ApprovalRecord[]; evidence: EvidenceRecord[]; retries: number }
export interface BrowserProfile { id: string; name: string; color: string; partition: string; createdAt: string }
export interface TaskTemplate { id: string; name: string; prompt: string; category: string }
export interface TaskSchedule { id: string; name: string; prompt: string; intervalMinutes: number; enabled: boolean; nextRunAt: string }
export interface MemoryRecord { id: string; label: string; value: string; createdAt: string }
export interface RuntimeSnapshot { tasks: TaskRecord[]; profiles: BrowserProfile[]; templates: TaskTemplate[]; schedules: TaskSchedule[]; memories: MemoryRecord[] }

const now = () => new Date().toISOString();
const id = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function defaults(): RuntimeSnapshot {
  return {
    tasks: [],
    profiles: [
      { id: 'work', name: 'Work', color: '#22d3ee', partition: 'persist:blinky-work', createdAt: now() },
      { id: 'personal', name: 'Personal', color: '#a78bfa', partition: 'persist:blinky-personal', createdAt: now() },
      { id: 'research', name: 'Research', color: '#34d399', partition: 'persist:blinky-research', createdAt: now() },
    ],
    templates: [
      { id: 'company-research', name: 'Research a company', category: 'Research', prompt: 'Research this company, its product, leadership, traction, competitors, risks, and recent developments.' },
      { id: 'product-compare', name: 'Compare products', category: 'Research', prompt: 'Compare these products using current pricing, capabilities, limitations, and credible reviews. Recommend the best fit.' },
      { id: 'meeting-prep', name: 'Prepare for meeting', category: 'Meeting', prompt: 'Prepare a concise meeting brief with participants, company context, likely priorities, questions, and risks.' },
    ],
    schedules: [],
    memories: [],
  };
}

function storePath(): string { return path.join(app.getPath('userData'), 'blinky-runtime.json'); }
function read(): RuntimeSnapshot {
  try { return { ...defaults(), ...JSON.parse(fs.readFileSync(storePath(), 'utf8')) as RuntimeSnapshot }; }
  catch { return defaults(); }
}
function write(snapshot: RuntimeSnapshot): RuntimeSnapshot {
  fs.writeFileSync(storePath(), JSON.stringify(snapshot, null, 2), 'utf8');
  return snapshot;
}

export function getRuntimeSnapshot(): RuntimeSnapshot { return read(); }

export function dispatchTaskCommand(command: TaskCommand): RuntimeSnapshot {
  const state = read();
  if (command.type === 'create') {
    const taskId = id('task');
    const workerGoals = command.workerGoals?.length ? command.workerGoals : [command.goal];
    state.tasks.unshift({
      id: taskId, goal: command.goal, status: 'planned', progress: 0, createdAt: now(), updatedAt: now(),
      message: 'Task planned', retries: 0, approvals: [], evidence: [],
      workers: workerGoals.map((goal, index) => ({ id: `${taskId}-worker-${index + 1}`, goal, status: 'planned', progress: 0, message: 'Queued' })),
    });
  } else if (command.type === 'status') {
    state.tasks = state.tasks.map((task) => task.id === command.taskId ? { ...task, status: command.status, message: command.message || task.message, updatedAt: now(), progress: command.status === 'completed' ? 100 : task.progress } : task);
  } else if (command.type === 'approve') {
    state.tasks = state.tasks.map((task) => task.id === command.taskId ? { ...task, status: command.decision === 'approved' ? 'running' : 'paused', updatedAt: now(), approvals: task.approvals.map((approval) => approval.id === command.approvalId ? { ...approval, status: command.decision } : approval) } : task);
  } else if (command.type === 'evidence') {
    state.tasks = state.tasks.map((task) => task.id === command.taskId ? { ...task, updatedAt: now(), evidence: [...task.evidence, { ...command.evidence, id: id('evidence'), capturedAt: now() }] } : task);
  } else if (command.type === 'profile-save') {
    state.profiles = [...state.profiles.filter((item) => item.id !== command.profile.id), command.profile];
  } else if (command.type === 'template-save') {
    state.templates = [...state.templates.filter((item) => item.id !== command.template.id), command.template];
  } else if (command.type === 'schedule-save') {
    state.schedules = [...state.schedules.filter((item) => item.id !== command.schedule.id), command.schedule];
  } else if (command.type === 'memory-save') {
    state.memories = [...state.memories.filter((item) => item.id !== command.memory.id), command.memory];
  } else if (command.type === 'delete-memory') {
    state.memories = state.memories.filter((item) => item.id !== command.memoryId);
  }
  return write(state);
}

export function addTaskApproval(taskId: string, approval: Omit<ApprovalRecord, 'id' | 'status'>): RuntimeSnapshot {
  const state = read();
  state.tasks = state.tasks.map((task) => task.id === taskId ? { ...task, status: 'waiting-approval', updatedAt: now(), approvals: [...task.approvals, { ...approval, id: id('approval'), status: 'pending' }] } : task);
  return write(state);
}
