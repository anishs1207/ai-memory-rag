const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';

export interface WebResearchSource { title: string; url: string }
export interface WebResearchTrack {
  task: string;
  answer: string;
  sources: WebResearchSource[];
  targetUrl: string;
}
export interface WebResearchResult {
  answer: string;
  sources: WebResearchSource[];
  targetUrl: string;
  tracks: WebResearchTrack[];
}

interface AnthropicWebResponse { content?: unknown[]; error?: { message?: string } }

function getConfig() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is missing.');
  return { apiKey, model: process.env.CLAUDE_MODEL || 'claude-sonnet-5' };
}

async function callAnthropic(body: Record<string, unknown>): Promise<AnthropicWebResponse> {
  const { apiKey, model } = getConfig();
  const response = await fetch(ANTHROPIC_MESSAGES_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, ...body }),
  });
  const payload = await response.json() as AnthropicWebResponse;
  if (!response.ok) throw new Error(payload.error?.message || `Anthropic web agent returned ${response.status}`);
  return payload;
}

function extractText(payload: AnthropicWebResponse): string {
  return (payload.content || [])
    .filter((block): block is { type: string; text: string } => {
      if (!block || typeof block !== 'object') return false;
      const candidate = block as Record<string, unknown>;
      return candidate.type === 'text' && typeof candidate.text === 'string';
    })
    .map((block) => block.text).join('\n').trim();
}

function collectSources(value: unknown, sources: Map<string, WebResearchSource>): void {
  if (Array.isArray(value)) { value.forEach((item) => collectSources(item, sources)); return; }
  if (!value || typeof value !== 'object') return;
  const record = value as Record<string, unknown>;
  if (typeof record.url === 'string' && /^https?:\/\//i.test(record.url)) {
    const title = typeof record.title === 'string' && record.title.trim() ? record.title.trim() : new URL(record.url).hostname;
    sources.set(record.url, { title, url: record.url });
  }
  Object.values(record).forEach((item) => collectSources(item, sources));
}

function fallbackTracks(goal: string): string[] {
  return [
    `${goal}\nTrack A: establish the primary facts using official and first-party sources.`,
    `${goal}\nTrack B: compare alternatives, constraints, tradeoffs, and practical options.`,
    `${goal}\nTrack C: independently verify time-sensitive claims, risks, and edge cases.`,
  ];
}

async function planResearchTracks(goal: string): Promise<string[]> {
  try {
    const payload = await callAnthropic({
      max_tokens: 900,
      system: 'Decompose a web task into exactly 3 or 4 independent research tracks that can run concurrently. Make tracks collectively exhaustive and avoid overlap. Return only a JSON array of strings.',
      messages: [{ role: 'user', content: goal }],
    });
    const match = extractText(payload).match(/\[[\s\S]*\]/);
    if (!match) return fallbackTracks(goal);
    const tracks = (JSON.parse(match[0]) as unknown[]).filter((item): item is string => typeof item === 'string' && item.trim().length > 10).slice(0, 4);
    return tracks.length >= 2 ? tracks : fallbackTracks(goal);
  } catch {
    return fallbackTracks(goal);
  }
}

async function researchTrack(task: string): Promise<WebResearchTrack> {
  const payload = await callAnthropic({
    max_tokens: 4096,
    system: `You are one worker in Blinky's parallel browser research team. Complete only your assigned track. Search repeatedly, prefer primary sources, cross-check consequential facts, and provide a concise result plus actionable next steps. Never claim to have logged in, submitted a form, paid, or changed external state.`,
    messages: [{ role: 'user', content: task }],
    tools: [{ type: 'web_search_20260318', name: 'web_search', max_uses: 8, allowed_callers: ['direct'] }],
  });
  const answer = extractText(payload);
  const sourceMap = new Map<string, WebResearchSource>();
  collectSources(payload.content, sourceMap);
  const sources = [...sourceMap.values()].slice(0, 8);
  if (!answer) throw new Error(`Research track returned no answer: ${task}`);
  return { task, answer, sources, targetUrl: sources[0]?.url || `https://www.google.com/search?q=${encodeURIComponent(task)}` };
}

async function synthesize(goal: string, tracks: WebResearchTrack[]): Promise<string> {
  const evidence = tracks.map((track, index) => `TRACK ${index + 1}: ${track.task}\n${track.answer}`).join('\n\n');
  try {
    const payload = await callAnthropic({
      max_tokens: 4096,
      system: 'Synthesize parallel research into one direct, non-repetitive answer. Lead with the result, reconcile disagreements, distinguish verified facts from uncertainty, and finish with concrete next actions. Do not claim external actions were completed.',
      messages: [{ role: 'user', content: `Original goal: ${goal}\n\nParallel findings:\n${evidence}` }],
    });
    return extractText(payload) || evidence;
  } catch {
    return evidence;
  }
}

/** Decompose, run parallel research tracks, and synthesize behind one interface. */
export async function researchWeb(goal: string): Promise<WebResearchResult> {
  const tasks = await planResearchTracks(goal);
  const settled = await Promise.allSettled(tasks.map((task) => researchTrack(task)));
  const tracks = settled.flatMap((result) => result.status === 'fulfilled' ? [result.value] : []);
  if (!tracks.length) throw new Error('All parallel browser research tracks failed.');
  const sourceMap = new Map<string, WebResearchSource>();
  tracks.forEach((track) => track.sources.forEach((source) => sourceMap.set(source.url, source)));
  const sources = [...sourceMap.values()].slice(0, 20);
  return {
    answer: await synthesize(goal, tracks),
    sources,
    targetUrl: tracks[0].targetUrl,
    tracks,
  };
}
