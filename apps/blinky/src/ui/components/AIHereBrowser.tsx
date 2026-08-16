import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, RefreshCw, Globe, Mic, Play, Loader, Sparkles, Plus, X, LayoutGrid, LockKeyhole, Trash2, FileCheck2, ShieldAlert, Check } from 'lucide-react';
import { VoiceActionPanel, type ExecutionLog } from './VoiceActionPanel';
import type { RuntimeSnapshot, SiteCredentialSummary } from '../types';
import { TaskDashboard } from './TaskDashboard';

export interface BrowserStep {
  query: string;
  timestamp: string;
  targetUrl: string;
  summary: string;
  kind?: 'summary' | 'task' | 'source';
}

interface BrowserSession {
  id: string;
  url: string;
  goal?: string;
  partition?: string;
}

interface AIHereBrowserProps {
  currentUrl: string;
  aiHerePrompt: string;
  setAiHerePrompt: (val: string) => void;
  handleAiHereBrowse: (queryText: string) => void;
  openUrl: (url: string) => void;
  speechSupported: boolean;
  isListening: boolean;
  toggleListening: () => void;
  aiHereStatus: string;
  browserSteps: BrowserStep[];
  executionLogs: ExecutionLog[];
  clickyStatus: string;
}

function normalizeAddress(value: string): string {
  const address = value.trim();
  if (!address) return 'https://www.google.com/';
  if (/^https?:\/\//i.test(address)) return address;
  if (/^[\w.-]+\.[a-z]{2,}(?:\/.*)?$/i.test(address)) return `https://${address}`;
  return `https://www.google.com/search?q=${encodeURIComponent(address)}`;
}

function BrowserCard({
  session,
  active,
  onActivate,
  onNavigate,
  onClose,
}: {
  session: BrowserSession;
  active: boolean;
  onActivate: () => void;
  onNavigate: (url: string) => void;
  onClose: () => void;
}) {
  // Electron's webview methods are not part of React's DOM typings.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const viewRef = useRef<any>(null);
  const [address, setAddress] = useState(session.url);
  const [title, setTitle] = useState('New browser');
  const [loading, setLoading] = useState(true);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [agentStatus, setAgentStatus] = useState('');
  const [pendingPlan, setPendingPlan] = useState<Awaited<ReturnType<typeof window.electron.planBrowserActions>> | null>(null);

  useEffect(() => {
    if (session.url !== address) setAddress(session.url);
  }, [session.url]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const started = () => setLoading(true);
    const stopped = async () => {
      setLoading(false);
      const url = view.getURL?.() || session.url;
      setAddress(url);
      setTitle(view.getTitle?.() || new URL(url).hostname);
      setCanGoBack(Boolean(view.canGoBack?.()));
      setCanGoForward(Boolean(view.canGoForward?.()));
      onNavigate(url);
      try {
        await window.electron.applySiteCredential(view.getWebContentsId(), url);
      } catch (error) {
        console.warn('Credential autofill skipped:', error);
      }
    };
    const pageTitle = (event: { title?: string }) => event.title && setTitle(event.title);
    view.addEventListener('did-start-loading', started);
    view.addEventListener('did-stop-loading', stopped);
    view.addEventListener('page-title-updated', pageTitle);
    return () => {
      view.removeEventListener('did-start-loading', started);
      view.removeEventListener('did-stop-loading', stopped);
      view.removeEventListener('page-title-updated', pageTitle);
    };
  }, [onNavigate, session.url]);

  const navigate = () => {
    const target = normalizeAddress(address);
    setAddress(target);
    onNavigate(target);
    viewRef.current?.loadURL(target);
  };

  const executePlan = async (plan: NonNullable<typeof pendingPlan>) => {
    const view = viewRef.current;
    if (!view) return;
    setPendingPlan(null);
    for (let index = 0; index < plan.actions.length; index += 1) {
      const action = plan.actions[index];
      setAgentStatus(`${index + 1}/${plan.actions.length}: ${action.description}`);
      const selector = JSON.stringify(action.selector || 'body');
      const value = JSON.stringify(action.value || '');
      const result = await view.executeJavaScript(`(() => {
        const element = document.querySelector(${selector});
        if (!element) return { ok: false, error: 'Target not found' };
        const type = ${JSON.stringify(action.type)};
        const value = ${value};
        if (type === 'click') element.click();
        if (type === 'type') {
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
          setter ? setter.call(element, value) : (element.value = value);
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));
        }
        if (type === 'select') { element.value = value; element.dispatchEvent(new Event('change', { bubbles: true })); }
        if (type === 'scroll') element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (type === 'extract') return { ok: true, text: (element.innerText || element.textContent || '').slice(0, 4000) };
        return { ok: true };
      })()`);
      if (!result?.ok) { setAgentStatus(`Stopped: ${result?.error || 'verification failed'}`); return; }
      await new Promise((resolve) => window.setTimeout(resolve, 500));
    }
    setAgentStatus('Action batch completed and verified.');
  };

  const runAgent = async () => {
    const view = viewRef.current;
    if (!view || !session.goal) return;
    setAgentStatus('Inspecting page and planning actions…');
    try {
      const snapshot = await view.executeJavaScript(`(() => [...document.querySelectorAll('a,button,input:not([type="password"]),select,textarea,[role="button"]')].filter((el) => el.offsetParent !== null).slice(0,250).map((el,index) => {
        if (!el.id) el.dataset.blinkyTarget = String(index);
        const selector = el.id ? '#' + CSS.escape(el.id) : '[data-blinky-target="' + index + '"]';
        return { selector, tag: el.tagName.toLowerCase(), type: el.type || '', text: (el.innerText || el.getAttribute('aria-label') || el.placeholder || el.name || '').trim().slice(0,180) };
      }))()`);
      const plan = await window.electron.planBrowserActions(session.goal, view.getURL(), JSON.stringify(snapshot));
      if (!plan.actions.length) { setAgentStatus('No safe action was available on this page.'); return; }
      if (plan.requiresApproval) { setPendingPlan(plan); setAgentStatus('Waiting for approval before a consequential action.'); return; }
      await executePlan(plan);
    } catch (error) {
      setAgentStatus(`Agent stopped: ${(error as Error).message}`);
    }
  };

  return (
    <section className={`browser-session-card ${active ? 'active' : ''}`} onPointerDown={onActivate}>
      <div className="browser-tab-strip">
        <span className="browser-favicon"><Globe size={11} /></span>
        <span className="browser-tab-title">{title}</span>
        {session.goal && <button type="button" className="browser-agent-run" onClick={runAgent} title="Run assigned task"><Sparkles size={11} /> Run</button>}
        <button type="button" className="browser-tab-close" onClick={onClose} title="Close browser"><X size={12} /></button>
      </div>
      <form className="browser-chrome" onSubmit={(event) => { event.preventDefault(); navigate(); }}>
        <button type="button" onClick={() => viewRef.current?.goBack()} disabled={!canGoBack} title="Back"><ArrowLeft size={13} /></button>
        <button type="button" onClick={() => viewRef.current?.goForward()} disabled={!canGoForward} title="Forward"><ArrowRight size={13} /></button>
        <button type="button" onClick={() => viewRef.current?.reload()} title="Reload"><RefreshCw size={12} /></button>
        <div className="browser-address-shell">
          <LockKeyhole size={11} />
          <input value={address} onChange={(event) => setAddress(event.target.value)} aria-label="Browser address" />
        </div>
      </form>
      <div className="browser-page">
        <webview
          ref={viewRef}
          src={session.url}
          partition={session.partition || `persist:blinky-browser-${session.id}`}
          allowpopups
          className="clicky-webview"
        />
        {loading && <div className="webview-loader"><Loader className="spinner" size={22} /><span>Loading {title}…</span></div>}
        {agentStatus && <div className="browser-agent-status">{agentStatus}</div>}
        {pendingPlan && <div className="browser-approval-overlay">
          <ShieldAlert size={18} /><strong>Approval required</strong><p>{pendingPlan.summary}</p><small>{pendingPlan.riskReason}</small>
          <div><button type="button" onClick={() => executePlan(pendingPlan)}><Check size={12} /> Approve actions</button><button type="button" onClick={() => { setPendingPlan(null); setAgentStatus('Action rejected.'); }}><X size={12} /> Reject</button></div>
        </div>}
      </div>
    </section>
  );
}

export function AIHereBrowser({
  currentUrl,
  aiHerePrompt,
  setAiHerePrompt,
  handleAiHereBrowse,
  speechSupported,
  isListening,
  toggleListening,
  aiHereStatus,
  browserSteps,
  executionLogs,
  clickyStatus,
}: AIHereBrowserProps) {
  const commandInputRef = useRef<HTMLInputElement>(null);
  const nextId = useRef(2);
  const lastAutoGridRef = useRef('');
  const [sessions, setSessions] = useState<BrowserSession[]>([{ id: '1', url: currentUrl }]);
  const [activeId, setActiveId] = useState('1');
  const [showCredentials, setShowCredentials] = useState(false);
  const [showTasks, setShowTasks] = useState(true);
  const [credentials, setCredentials] = useState<SiteCredentialSummary[]>([]);
  const [credentialForm, setCredentialForm] = useState({ domain: '', username: '', password: '', autoFill: true });
  const [credentialStatus, setCredentialStatus] = useState('');
  const [profiles, setProfiles] = useState<RuntimeSnapshot['profiles']>([]);
  const [activeProfile, setActiveProfile] = useState('research');

  useEffect(() => {
    setSessions((items) => items.map((item) => item.id === activeId ? { ...item, url: currentUrl } : item));
  }, [currentUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshCredentials = useCallback(async () => {
    setCredentials(await window.electron.listSiteCredentials());
  }, []);

  useEffect(() => {
    void refreshCredentials();
    void window.electron.getRuntimeSnapshot().then((runtime) => setProfiles(runtime.profiles));
  }, [refreshCredentials]);

  useEffect(() => {
    const taskSteps = browserSteps.filter((step) => step.kind === 'task').slice(0, 6);
    if (taskSteps.length < 2) return;
    const signature = taskSteps.map((step) => `${step.timestamp}:${step.targetUrl}`).join('|');
    if (signature === lastAutoGridRef.current) return;
    lastAutoGridRef.current = signature;
    const partition = profiles.find((profile) => profile.id === activeProfile)?.partition;
    const nextSessions = taskSteps.map((step) => ({ id: String(nextId.current++), url: step.targetUrl, goal: step.query, partition }));
    setSessions(nextSessions);
    setActiveId(nextSessions[0].id);
  }, [browserSteps, profiles, activeProfile]);

  const updateSession = useCallback((id: string, url: string) => {
    setSessions((items) => items.map((item) => item.id === id ? { ...item, url } : item));
  }, []);

  const addSession = useCallback((url = 'https://www.google.com/', goal?: string) => {
    setSessions((items) => {
      if (items.length >= 6) return items;
      const id = String(nextId.current++);
      setActiveId(id);
      const partition = profiles.find((profile) => profile.id === activeProfile)?.partition;
      return [...items, { id, url, goal, partition }];
    });
  }, [profiles, activeProfile]);

  const closeSession = (id: string) => {
    setSessions((items) => {
      if (items.length === 1) return items;
      const remaining = items.filter((item) => item.id !== id);
      if (activeId === id) setActiveId(remaining[0].id);
      return remaining;
    });
  };

  const openResearchGrid = () => {
    const urls = [...new Set(browserSteps.map((step) => step.targetUrl).filter((url) => /^https?:\/\//.test(url)))].slice(0, 6);
    if (!urls.length) return;
    setSessions(urls.map((url) => ({ id: String(nextId.current++), url })));
    setActiveId(String(nextId.current - urls.length));
  };

  const submitBrowserPrompt = () => {
    const query = aiHerePrompt.trim();
    if (!query) return;
    handleAiHereBrowse(query);
    setAiHerePrompt('');
  };

  const saveCredential = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await window.electron.saveSiteCredential(credentialForm);
      setCredentialForm({ domain: '', username: '', password: '', autoFill: true });
      setCredentialStatus('Encrypted credential saved. It will autofill only on the matching domain.');
      await refreshCredentials();
    } catch (error) {
      setCredentialStatus((error as Error).message);
    }
  };

  return (
    <div className="clicky-container aihere-container">
      <div className="browser-workspace-header">
        <div className="aihere-side-header"><Sparkles size={14} /> Blinky Browser Workspace</div>
        <div className="browser-workspace-actions">
          <span className="browser-count"><LayoutGrid size={12} /> {sessions.length} session{sessions.length === 1 ? '' : 's'}</span>
          <select className="browser-profile-select" value={activeProfile} onChange={(event) => setActiveProfile(event.target.value)} title="Browser profile">{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select>
          <button type="button" onClick={() => addSession()}><Plus size={12} /> New browser</button>
          <button type="button" onClick={openResearchGrid} disabled={!browserSteps.length}><LayoutGrid size={12} /> Sources grid</button>
          <button type="button" onClick={() => setShowCredentials((value) => !value)}><LockKeyhole size={12} /> Credentials</button>
          <button type="button" onClick={() => setShowTasks((value) => !value)}><FileCheck2 size={12} /> Tasks</button>
        </div>
      </div>

      <div className="aihere-workspace">
        <main className={`browser-session-grid grid-${Math.min(sessions.length, 4)}`}>
          {sessions.map((session) => (
            <BrowserCard
              key={session.id}
              session={session}
              active={session.id === activeId}
              onActivate={() => setActiveId(session.id)}
              onNavigate={(url) => updateSession(session.id, url)}
              onClose={() => closeSession(session.id)}
            />
          ))}
        </main>

        <aside className="aihere-side-panel">
          <form
            className="aihere-command-bar"
            onPointerDownCapture={() => { window.electron?.setIgnoreMouseEvents(false); commandInputRef.current?.focus(); }}
            onSubmit={(event) => { event.preventDefault(); submitBrowserPrompt(); }}
          >
            <input ref={commandInputRef} className="input-field" aria-label="Give the browser agent a task" placeholder="Research or complete a web task…" value={aiHerePrompt} onChange={(event) => setAiHerePrompt(event.target.value)} />
            {speechSupported && <button className={`chat-mic-btn ${isListening ? 'active' : ''}`} onClick={toggleListening} type="button"><Mic size={14} /></button>}
            <button type="submit" className="play-btn" disabled={!aiHerePrompt.trim()}><Play size={12} fill="currentColor" /></button>
          </form>

          {showTasks && <TaskDashboard onUseTemplate={(prompt) => setAiHerePrompt(prompt)} />}

          {showCredentials && (
            <div className="credential-vault-panel">
              <strong><LockKeyhole size={12} /> Secure credential vault</strong>
              <p>Passwords are encrypted by Windows and never sent to Claude. Blinky fills matching login forms but does not submit them.</p>
              <form onSubmit={saveCredential}>
                <input placeholder="Website domain (example.com)" value={credentialForm.domain} onChange={(event) => setCredentialForm({ ...credentialForm, domain: event.target.value })} />
                <input placeholder="Username or email" autoComplete="off" value={credentialForm.username} onChange={(event) => setCredentialForm({ ...credentialForm, username: event.target.value })} />
                <input placeholder="Password" type="password" autoComplete="new-password" value={credentialForm.password} onChange={(event) => setCredentialForm({ ...credentialForm, password: event.target.value })} />
                <label><input type="checkbox" checked={credentialForm.autoFill} onChange={(event) => setCredentialForm({ ...credentialForm, autoFill: event.target.checked })} /> Autofill matching login pages</label>
                <button type="submit">Save encrypted credential</button>
              </form>
              {credentialStatus && <span className="credential-status">{credentialStatus}</span>}
              {credentials.map((credential) => (
                <div className="credential-row" key={credential.domain}>
                  <span><b>{credential.domain}</b><small>{credential.username}</small></span>
                  <button type="button" onClick={async () => { await window.electron.deleteSiteCredential(credential.domain); await refreshCredentials(); }} title="Delete credential"><Trash2 size={12} /></button>
                </div>
              ))}
            </div>
          )}

          <div className="aihere-status-text">{aiHereStatus}</div>
          <div className="aihere-step-list">
            {browserSteps.length === 0 ? <div className="cly-log-empty">Give Blinky a goal. Research sources can open together in the grid.</div> : browserSteps.slice(0, 10).map((step, index) => (
              <button type="button" className="aihere-step" key={`${step.timestamp}-${index}`} onClick={() => addSession(step.targetUrl, step.query)}>
                <span className="cly-log-timestamp">{step.timestamp}</span><strong>{step.query}</strong><span>{step.summary}</span>
              </button>
            ))}
          </div>
          <VoiceActionPanel isListening={isListening} clickyStatus={clickyStatus} toggleListening={toggleListening} executionLogs={executionLogs} />
        </aside>
      </div>
    </div>
  );
}
