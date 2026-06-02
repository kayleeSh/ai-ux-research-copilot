import { AIResult, Cluster, SynthesisResult, SynthesisPattern } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface AnalyzeResult {
  summary: string;
  keyQuotes: string[];
  painPoints: string[];
  mainThemes: string[];
  clusters: Cluster[];
}

// ── Prompts ──────────────────────────────────────────────────────────────────

const ANALYZE_PROMPT = (transcript: string) => `You are a senior UX research analyst. Analyze the following interview transcript and return ONLY a valid JSON object with this exact structure — no markdown, no explanation:

{
  "summary": "2-3 sentence synthesis of key findings",
  "keyQuotes": ["verbatim or near-verbatim quote", "..."],
  "painPoints": ["specific pain point", "..."],
  "mainThemes": ["theme label", "..."],
  "clusters": [
    {
      "name": "Cluster Name",
      "description": "One sentence describing what unifies this cluster",
      "themes": ["theme1", "theme2"]
    }
  ]
}

Rules:
- keyQuotes: 3-5 direct quotes from the participant
- painPoints: 4-6 specific, actionable pain points
- mainThemes: 4-6 short theme labels (2-4 words each)
- clusters: 2-4 affinity clusters grouping related themes

Transcript:
${transcript}`;

const SYNTHESIS_PROMPT = (interviews: Array<{ title: string; transcript: string }>) =>
  `You are a senior UX research analyst conducting a cross-interview synthesis.
Analyze ALL the following interview transcripts together to find patterns across participants.

Return ONLY a valid JSON object — no markdown, no explanation:

{
  "overallSummary": "2-3 sentence synthesis of patterns across all interviews",
  "commonThemes": ["theme that appeared across multiple interviews"],
  "patterns": [
    {
      "pattern": "Pattern name (2-4 words)",
      "description": "One sentence explaining the pattern",
      "frequency": "X of ${interviews.length} participants",
      "quotes": ["short quote from any interview"]
    }
  ],
  "differences": ["Key difference or divergence between participants"],
  "prioritizedPainPoints": ["Pain point ranked by frequency — most common first"],
  "recommendations": ["Actionable design recommendation based on all interviews"]
}

Rules:
- commonThemes: 3-6 themes that appear in 2+ interviews
- patterns: 2-4 behavioral/attitudinal patterns across participants
- differences: 2-4 notable differences between participants
- prioritizedPainPoints: top 4-6 pain points by frequency
- recommendations: 3-5 concrete, actionable recommendations

${interviews.map((iv, i) => `--- Interview ${i + 1}: ${iv.title} ---\n${iv.transcript}`).join('\n\n')}`;

// ── Types ─────────────────────────────────────────────────────────────────────

interface RawParsed {
  summary?: string;
  keyQuotes?: string[];
  painPoints?: string[];
  mainThemes?: string[];
  clusters?: Array<{ name: string; description: string; themes: string[] }>;
}

interface RawSynthesis {
  overallSummary?: string;
  commonThemes?: string[];
  patterns?: Array<{ pattern: string; description: string; frequency: string; quotes: string[] }>;
  differences?: string[];
  prioritizedPainPoints?: string[];
  recommendations?: string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildResult(parsed: RawParsed): AnalyzeResult {
  return {
    summary: parsed.summary ?? '',
    keyQuotes: parsed.keyQuotes ?? [],
    painPoints: parsed.painPoints ?? [],
    mainThemes: parsed.mainThemes ?? [],
    clusters: (parsed.clusters ?? []).map(c => ({
      id: uuidv4(),
      name: c.name,
      description: c.description,
      themes: c.themes ?? [],
      insightIds: []
    }))
  };
}

async function groqFetch(body: object, timeoutMs = 60000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

// ── Single Interview Analysis (non-streaming) ─────────────────────────────────

async function analyzeWithGroq(transcript: string): Promise<AnalyzeResult> {
  console.log('[groq] analyzing transcript...');
  const res = await groqFetch({
    model: 'llama-3.1-8b-instant',
    messages: [{ role: 'user', content: ANALYZE_PROMPT(transcript) }],
    temperature: 0.3,
    response_format: { type: 'json_object' }
  });

  if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text()}`);
  const data = await res.json() as { choices: Array<{ message: { content: string } }> };
  const content = data.choices[0]?.message?.content;
  if (!content) throw new Error('No content in Groq response');
  console.log('[groq] response received');
  return buildResult(JSON.parse(content) as RawParsed);
}

// ── Streaming Analysis ────────────────────────────────────────────────────────

export async function analyzeTranscriptStream(
  transcript: string,
  interviewId: string,
  onChunk: (accumulated: string) => void,
  onDone: (result: AIResult) => void
): Promise<void> {
  if (!process.env.GROQ_API_KEY) {
    // Simulate streaming with mock data
    const mock = mockAnalyze(transcript);
    const text = JSON.stringify(mock, null, 2);
    let accumulated = '';
    for (const char of text) {
      accumulated += char;
      onChunk(accumulated);
      await new Promise(r => setTimeout(r, 8));
    }
    onDone({ id: uuidv4(), interviewId, ...mock, createdAt: new Date().toISOString() });
    return;
  }

  console.log('[groq] streaming request...');
  const res = await groqFetch({
    model: 'llama-3.1-8b-instant',
    messages: [{ role: 'user', content: ANALYZE_PROMPT(transcript) }],
    temperature: 0.3,
    response_format: { type: 'json_object' },
    stream: true
  });

  if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text()}`);
  if (!res.body) throw new Error('No response body');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let accumulated = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data: ') || line.includes('[DONE]')) continue;
      try {
        const data = JSON.parse(line.slice(6)) as { choices: Array<{ delta: { content?: string } }> };
        const delta = data.choices[0]?.delta?.content ?? '';
        if (delta) {
          accumulated += delta;
          onChunk(accumulated);
        }
      } catch { /* skip malformed chunks */ }
    }
  }

  console.log('[groq] stream complete, parsing...');
  const result = buildResult(JSON.parse(accumulated) as RawParsed);
  onDone({ id: uuidv4(), interviewId, ...result, createdAt: new Date().toISOString() });
}

// ── Cross-Interview Synthesis ─────────────────────────────────────────────────

export async function synthesizeInterviews(
  interviews: Array<{ id: string; title: string; transcript: string }>
): Promise<SynthesisResult> {
  const n = interviews.length;

  if (!process.env.GROQ_API_KEY) {
    await new Promise(r => setTimeout(r, 1800));
    return mockSynthesis(interviews);
  }

  console.log(`[groq] synthesizing ${n} interviews...`);
  const res = await groqFetch({
    model: 'llama-3.1-8b-instant',
    messages: [{ role: 'user', content: SYNTHESIS_PROMPT(interviews) }],
    temperature: 0.3,
    response_format: { type: 'json_object' }
  }, 90000);

  if (!res.ok) throw new Error(`Groq synthesis ${res.status}: ${await res.text()}`);
  const data = await res.json() as { choices: Array<{ message: { content: string } }> };
  const content = data.choices[0]?.message?.content;
  if (!content) throw new Error('No content in Groq synthesis response');

  console.log('[groq] synthesis complete');
  const parsed = JSON.parse(content) as RawSynthesis;

  return {
    id: uuidv4(),
    interviewIds: interviews.map(i => i.id),
    interviewCount: n,
    overallSummary: parsed.overallSummary ?? '',
    commonThemes: parsed.commonThemes ?? [],
    patterns: (parsed.patterns ?? []).map(p => ({
      pattern: p.pattern,
      description: p.description,
      frequency: p.frequency,
      quotes: p.quotes ?? []
    })) as SynthesisPattern[],
    differences: parsed.differences ?? [],
    prioritizedPainPoints: parsed.prioritizedPainPoints ?? [],
    recommendations: parsed.recommendations ?? [],
    createdAt: new Date().toISOString()
  };
}

// ── Mock Helpers ──────────────────────────────────────────────────────────────

function mockAnalyze(transcript: string): AnalyzeResult {
  const lines = transcript.split('\n').filter(l => l.trim().length > 30);
  const participantLines = lines.filter(l => !l.toLowerCase().startsWith('interviewer'));
  const pickQuote = (idx: number) => {
    const line = participantLines[idx % Math.max(participantLines.length, 1)] ?? '';
    const cleaned = line.replace(/^[^:]+:\s*/, '').trim();
    return `"${cleaned.slice(0, 120)}${cleaned.length > 120 ? '...' : ''}"`;
  };
  return {
    summary: 'This interview reveals significant workflow challenges, particularly around tool fragmentation and process inefficiency. Key themes include context switching overhead and the burden of manual coordination. The participant expressed a strong desire for more streamlined, integrated solutions.',
    keyQuotes: [pickQuote(0), pickQuote(1), pickQuote(2)].filter(q => q.length > 5),
    painPoints: [
      'Excessive manual steps required in core daily workflows',
      'Lack of integration between key tools creates information silos',
      'Context switching between tools breaks focus and wastes time',
      'Critical information becomes stale due to manual sync requirements',
      'Unclear ownership of cross-team processes causes repeated rework'
    ],
    mainThemes: ['Workflow friction', 'Tool integration gaps', 'Information discoverability', 'Cognitive overhead', 'Cross-team alignment'],
    clusters: [
      { id: uuidv4(), name: 'Productivity Barriers', description: 'Factors that interrupt flow and prevent sustained productive work', themes: ['Workflow friction', 'Cognitive overhead'], insightIds: [] },
      { id: uuidv4(), name: 'System & Tool Gaps', description: 'Missing integrations and tool limitations that force manual workarounds', themes: ['Tool integration gaps', 'Information discoverability'], insightIds: [] },
      { id: uuidv4(), name: 'Collaboration & Alignment', description: 'Challenges keeping teams informed and working toward shared goals', themes: ['Cross-team alignment'], insightIds: [] }
    ]
  };
}

function mockSynthesis(interviews: Array<{ id: string; title: string }>): SynthesisResult {
  const n = interviews.length;
  return {
    id: uuidv4(),
    interviewIds: interviews.map(i => i.id),
    interviewCount: n,
    overallSummary: `Synthesis of ${n} interviews reveals consistent patterns around tool complexity, workflow inefficiency, and the desire for integrated solutions. Multiple participants expressed frustration with context switching and manual coordination overhead, pointing to a systemic gap in how teams manage information flow.`,
    commonThemes: ['Tool fragmentation', 'Workflow inefficiency', 'Manual coordination burden', 'Desire for single source of truth'],
    patterns: [
      { pattern: 'Context Switching Fatigue', description: 'Participants spend significant unproductive time moving between disconnected tools', frequency: `${n} of ${n} participants`, quotes: interviews.map(iv => `"I waste time switching apps" — ${iv.title}`) },
      { pattern: 'Information Silo Problem', description: 'Critical knowledge is scattered and hard to find when needed', frequency: `${Math.ceil(n * 0.8)} of ${n} participants`, quotes: ['"Nothing is ever in one place"'] }
    ],
    differences: ['Senior participants focus on strategic alignment issues; junior participants struggle more with day-to-day tool complexity', 'Remote workers experience coordination problems more acutely than office-based participants'],
    prioritizedPainPoints: ['No single source of truth for project information', 'Excessive time spent on tool management vs actual work', 'Broken feedback loops between research, design, and development', 'Manual reporting consumes disproportionate time'],
    recommendations: ['Design a unified workspace consolidating research, design specs, and decisions', 'Reduce required context-switching with smart cross-tool integrations', 'Automate status updates and sync mechanisms to prevent information drift', 'Create role-based views so each team member sees what matters most to them'],
    createdAt: new Date().toISOString()
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function analyzeTranscript(transcript: string, interviewId: string): Promise<AIResult> {
  const result = process.env.GROQ_API_KEY
    ? await analyzeWithGroq(transcript)
    : (await new Promise<AnalyzeResult>(r => setTimeout(() => r(mockAnalyze(transcript)), 1400)));
  return { id: uuidv4(), interviewId, ...result, createdAt: new Date().toISOString() };
}
