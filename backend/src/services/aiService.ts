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

// ── Decision Generation ───────────────────────────────────────────────────────

interface RawDecision {
  title?: string;
  priority?: string;
  note?: string;
  evidenceQuotes?: string[];
}

const DECISIONS_PROMPT = (
  painPoints: string[],
  quotes: string[],
  themes: string[]
) => `You are a senior product manager. Based on these UX research findings, generate actionable product decisions.

Return ONLY a valid JSON array with no markdown, no explanation:

[
  {
    "title": "Actionable decision starting with a verb, specific, 8-15 words",
    "priority": "high",
    "note": "1-2 sentence rationale linking directly to a research finding",
    "evidenceQuotes": ["exact quote or pain point from the research"]
  }
]

Rules:
- Generate 3-5 decisions
- title: verb-first and specific (e.g. "Redesign onboarding to reduce context-switching overhead")
- priority: "high" (core workflow impact), "medium" (UX improvement), or "low" (enhancement)
- evidenceQuotes: 1-2 direct quotes or pain points as evidence

Pain Points:
${painPoints.slice(0, 8).join('\n')}

Key Quotes:
${quotes.slice(0, 6).join('\n')}

Themes: ${themes.join(', ')}`;

function mockGenerateDecisions(
  interviews: Array<{ title: string; painPoints: string[]; keyQuotes: string[]; mainThemes: string[] }>
): RawDecision[] {
  const allPain   = interviews.flatMap(iv => iv.painPoints);
  const allQuotes = interviews.flatMap(iv => iv.keyQuotes);
  return [
    {
      title: `Address core workflow friction identified across ${interviews.length} interview${interviews.length > 1 ? 's' : ''}`,
      priority: 'high',
      note: 'Research consistently surfaces workflow inefficiency as the top pain point. Immediate design iteration is recommended.',
      evidenceQuotes: allPain.slice(0, 2).filter(Boolean)
    },
    {
      title: 'Design unified information architecture to eliminate tool fragmentation',
      priority: 'high',
      note: 'Multiple participants describe managing disconnected tools as their primary daily frustration.',
      evidenceQuotes: allQuotes.slice(0, 1).filter(Boolean)
    },
    {
      title: 'Reduce manual coordination overhead through automated status updates',
      priority: 'medium',
      note: 'Context switching and manual synchronization are consuming disproportionate time across all participants.',
      evidenceQuotes: allPain.slice(2, 3).filter(Boolean)
    }
  ];
}

export async function generateDecisions(
  interviews: Array<{ title: string; painPoints: string[]; keyQuotes: string[]; mainThemes: string[] }>
): Promise<RawDecision[]> {
  const allPain   = [...new Set(interviews.flatMap(iv => iv.painPoints))];
  const allQuotes = [...new Set(interviews.flatMap(iv => iv.keyQuotes))];
  const allThemes = [...new Set(interviews.flatMap(iv => iv.mainThemes))];

  if (!process.env.GROQ_API_KEY) {
    await new Promise(r => setTimeout(r, 1200));
    return mockGenerateDecisions(interviews);
  }

  console.log('[groq] generating decisions...');
  const res = await groqFetch({
    model: 'llama-3.1-8b-instant',
    messages: [{ role: 'user', content: DECISIONS_PROMPT(allPain, allQuotes, allThemes) }],
    temperature: 0.3,
    response_format: { type: 'json_object' }
  });

  if (!res.ok) throw new Error(`Groq decisions ${res.status}: ${await res.text()}`);
  const data = await res.json() as { choices: Array<{ message: { content: string } }> };
  const content = data.choices[0]?.message?.content;
  if (!content) throw new Error('No content in Groq decisions response');

  const parsed = JSON.parse(content) as RawDecision[] | { decisions?: RawDecision[] };
  const arr = Array.isArray(parsed) ? parsed : (parsed.decisions ?? []);
  console.log(`[groq] generated ${arr.length} decisions`);
  return arr;
}

// ── Decisions from Synthesis ──────────────────────────────────────────────────

const DECISIONS_FROM_SYNTHESIS_PROMPT = (
  recommendations: string[],
  painPoints: string[],
  themes: string[]
) => `You are a senior product manager converting synthesis recommendations into trackable product decisions.

Return ONLY a valid JSON array with no markdown:

[
  {
    "title": "Actionable decision starting with a verb (8-15 words)",
    "priority": "high|medium|low",
    "note": "1-2 sentence rationale based on the recommendation",
    "evidenceQuotes": ["the recommendation or pain point this is based on"]
  }
]

Rules:
- Generate exactly one decision per recommendation
- title: verb-first and specific
- priority: high (core workflow), medium (UX improvement), low (enhancement)

Recommendations to convert:
${recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n')}

Supporting Pain Points:
${painPoints.slice(0, 5).join('\n')}

Themes: ${themes.join(', ')}`;

export async function generateDecisionsFromSynthesis(data: {
  recommendations: string[];
  prioritizedPainPoints: string[];
  commonThemes: string[];
}): Promise<RawDecision[]> {
  const { recommendations, prioritizedPainPoints, commonThemes } = data;

  if (!process.env.GROQ_API_KEY) {
    await new Promise(r => setTimeout(r, 1000));
    return recommendations.slice(0, 5).map((rec, i) => ({
      title: rec.length > 80 ? rec.slice(0, rec.lastIndexOf(' ', 80)) + '…' : rec,
      priority: (i === 0 ? 'high' : i <= 2 ? 'medium' : 'low') as 'high' | 'medium' | 'low',
      note: `Based on cross-interview synthesis: ${rec}`,
      evidenceQuotes: [rec],
    }));
  }

  console.log('[groq] generating decisions from synthesis...');
  const res = await groqFetch({
    model: 'llama-3.1-8b-instant',
    messages: [{ role: 'user', content: DECISIONS_FROM_SYNTHESIS_PROMPT(recommendations, prioritizedPainPoints, commonThemes) }],
    temperature: 0.3,
    response_format: { type: 'json_object' }
  });

  if (!res.ok) throw new Error(`Groq decisions-from-synthesis ${res.status}: ${await res.text()}`);
  const responseData = await res.json() as { choices: Array<{ message: { content: string } }> };
  const content = responseData.choices[0]?.message?.content;
  if (!content) throw new Error('No content in response');

  const parsed = JSON.parse(content) as RawDecision[] | { decisions?: RawDecision[] };
  const arr = Array.isArray(parsed) ? parsed : (parsed.decisions ?? []);
  console.log(`[groq] generated ${arr.length} decisions from synthesis`);
  return arr;
}

// ── Problem Analysis ──────────────────────────────────────────────────────────

interface RawProblem {
  title?: string;
  description?: string;
  severity?: string;
  affectedRoles?: string[];
  frequency?: string;
  evidenceQuotes?: string[];
  parentId?: string;
}

interface RawProblemsResult {
  rootProblem?: string;
  problems?: RawProblem[];
}

const PROBLEMS_PROMPT = (painPoints: string[], quotes: string[], themes: string[]) =>
  `You are a senior UX researcher. Identify core product problems from these research findings.

Return ONLY a valid JSON object:
{
  "rootProblem": "One sentence systemic root cause underlying all specific problems",
  "problems": [
    {
      "title": "Problem title (5-8 words)",
      "description": "2-3 sentence description of the problem and its impact",
      "severity": "critical",
      "affectedRoles": ["researcher", "pm", "designer", "developer", "project_manager"],
      "frequency": "daily",
      "evidenceQuotes": ["direct quote supporting this problem"],
      "parentId": ""
    }
  ]
}

Rules:
- Generate 3-5 problems maximum
- severity: "critical" (blocks core workflow) | "moderate" (significant friction) | "minor" (nice to fix)
- affectedRoles: include only roles genuinely impacted
- frequency: "daily" | "per_sprint" | "occasional"
- parentId: if a problem is a sub-problem, set to the parent problem's title; otherwise leave empty
- evidenceQuotes: 1-2 direct quotes from research

Pain Points:\n${painPoints.slice(0, 8).join('\n')}
Key Quotes:\n${quotes.slice(0, 6).join('\n')}
Themes: ${themes.join(', ')}`;

function mockGenerateProblems(painPoints: string[], quotes: string[]): RawProblemsResult {
  return {
    rootProblem: 'Teams lack a unified research-to-decision pipeline, causing insights to be lost between research, design, and development handoffs.',
    problems: [
      { title: 'Research insights fail to reach decision-makers', description: 'Research findings exist but never surface when decisions are being made. Teams proceed without evidence that already exists.', severity: 'critical', affectedRoles: ['researcher', 'pm'], frequency: 'per_sprint', evidenceQuotes: [painPoints[0] ?? ''].filter(Boolean), parentId: '' },
      { title: 'Tool fragmentation breaks daily focus', description: 'Users context-switch between 10+ tools daily, spending more time managing tools than doing actual work.', severity: 'critical', affectedRoles: ['researcher', 'designer', 'pm'], frequency: 'daily', evidenceQuotes: [quotes[0] ?? ''].filter(Boolean), parentId: '' },
      { title: 'No single source of truth causes misalignment', description: 'Research, specs, and decisions live in different tools with no sync. Teams discover misalignment at launch — too late to fix cheaply.', severity: 'critical', affectedRoles: ['pm', 'designer', 'developer', 'project_manager'], frequency: 'per_sprint', evidenceQuotes: [painPoints[1] ?? ''].filter(Boolean), parentId: '' },
      { title: 'Research share-out takes 8x longer than necessary', description: 'Preparing findings for stakeholders takes 2 hours for a 15-minute task. Manual copying degrades quality and discourages sharing.', severity: 'moderate', affectedRoles: ['researcher'], frequency: 'per_sprint', evidenceQuotes: [quotes[1] ?? ''].filter(Boolean), parentId: 'Research insights fail to reach decision-makers' }
    ]
  };
}

export async function generateProblems(data: {
  painPoints: string[];
  keyQuotes: string[];
  mainThemes: string[];
}): Promise<RawProblemsResult> {
  if (!process.env.GROQ_API_KEY) {
    await new Promise(r => setTimeout(r, 1200));
    return mockGenerateProblems(data.painPoints, data.keyQuotes);
  }

  console.log('[groq] generating problem analysis...');
  const res = await groqFetch({
    model: 'llama-3.1-8b-instant',
    messages: [{ role: 'user', content: PROBLEMS_PROMPT(data.painPoints, data.keyQuotes, data.mainThemes) }],
    temperature: 0.3,
    response_format: { type: 'json_object' }
  });

  if (!res.ok) throw new Error(`Groq problems ${res.status}: ${await res.text()}`);
  const responseData = await res.json() as { choices: Array<{ message: { content: string } }> };
  const content = responseData.choices[0]?.message?.content;
  if (!content) throw new Error('No content in response');
  console.log('[groq] problem analysis complete');
  return JSON.parse(content) as RawProblemsResult;
}

// ── Role Briefing ─────────────────────────────────────────────────────────────

interface RawBriefing {
  confidence?: string;
  pm?: {
    objectives?: string[];
    okrs?: Array<{ objective: string; keyResults: string[] }>;
    priorityStackRank?: string[];
    assumptionsAndRisks?: string[];
    methodsAndTools?: string[];
  };
  designer?: {
    userNeeds?: string[];
    jobsToBeDone?: string[];
    designPrinciples?: string[];
    deliverables?: string[];
    successCriteria?: string[];
  };
  developer?: {
    deliverables?: string[];
    acceptanceCriteria?: string[];
    technicalConstraints?: string[];
    dependencies?: string[];
    nonGoals?: string[];
  };
  projectManager?: {
    deliverables?: string[];
    milestones?: string[];
    dependenciesMap?: string[];
    effortEstimates?: string[];
    openQuestions?: string[];
  };
}

const BRIEFING_PROMPT = (rootProblem: string, problems: string, painPoints: string[], themes: string[], decisions: string[]) =>
  `You are a senior product strategist. Generate role-specific strategic outputs from UX research findings.

Return ONLY a valid JSON object with these exact keys:
{
  "confidence": "high|medium|low",
  "pm": {
    "objectives": ["qualitative action-oriented objective"],
    "okrs": [{"objective": "...", "keyResults": ["Increase X from A to B"]}],
    "priorityStackRank": ["#1: reason"],
    "assumptionsAndRisks": ["assumption or risk"],
    "methodsAndTools": ["how to measure a specific KR"]
  },
  "designer": {
    "userNeeds": ["Users need to be able to..."],
    "jobsToBeDone": ["When [situation], I want to [motivation], so I can [outcome]"],
    "designPrinciples": ["design constraint or guardrail"],
    "deliverables": ["specific design deliverable"],
    "successCriteria": ["measurable design success criterion"]
  },
  "developer": {
    "deliverables": ["specific technical deliverable"],
    "acceptanceCriteria": ["Feature X: user can do Y in < Z steps"],
    "technicalConstraints": ["system constraint"],
    "dependencies": ["external dependency"],
    "nonGoals": ["explicitly NOT building this"]
  },
  "projectManager": {
    "deliverables": ["deliverable item"],
    "milestones": ["Phase N (Week X-Y): description"],
    "dependenciesMap": ["A must complete before B"],
    "effortEstimates": ["Feature X: S/M/L/XL (~timeframe)"],
    "openQuestions": ["unresolved question blocking execution"]
  }
}

Root Problem: ${rootProblem}
Problems:\n${problems}
Pain Points:\n${painPoints.slice(0, 6).join('\n')}
Themes: ${themes.join(', ')}
Decisions:\n${decisions.slice(0, 5).join('\n')}`;

function mockGenerateBriefing(rootProblem: string, interviewCount: number): RawBriefing {
  return {
    confidence: interviewCount >= 5 ? 'high' : interviewCount >= 2 ? 'medium' : 'low',
    pm: {
      objectives: ['Eliminate research-to-decision lag so teams act on evidence within 48 hours', 'Reduce tool fragmentation overhead to free 30% more time for actual product thinking'],
      okrs: [{ objective: 'Make research immediately actionable', keyResults: ['Reduce research-to-decision time from 2 weeks to 48 hours', 'Increase research utilization to 70% per sprint', 'Cut share-out prep from 2 hours to 15 minutes'] }],
      priorityStackRank: ['#1: Unified workspace — highest frequency, affects all roles', '#2: Automated share-out — directly recoverable time', '#3: Research traceability — reduces rework at handoff'],
      assumptionsAndRisks: ['Assumption: teams adopt tools that reduce switching, not add to it', 'Risk: AI summaries may not meet researcher accuracy standards', 'Risk: PMs may not change habits without a forcing function'],
      methodsAndTools: ['Track research-to-decision time via timestamp delta in Decisions Hub', 'Measure share-out prep via monthly user survey', 'Monitor research utilization via sourceInsightId count per sprint']
    },
    designer: {
      userNeeds: ['Users need to find relevant research without leaving their design tool', 'Users need to trace every design decision to a user need', 'Users need to share findings in a format stakeholders will read'],
      jobsToBeDone: ['When starting a sprint, I want all relevant research in one place, so I can design without hunting 5 tools', 'When presenting work, I want to share a single link, so I can stop building slide decks manually'],
      designPrinciples: ['Zero context-switching: research accessible without leaving the design canvas', 'Evidence-first: every decision traceable to a user quote', 'Progressive disclosure: show minimum, reveal depth on demand'],
      deliverables: ['Unified research panel for design tools', 'Stakeholder briefing auto-generated from synthesis', 'Design decision log with evidence links'],
      successCriteria: ['Designers cite evidence in 80% of critiques without prompting', 'Stakeholder prep time under 20 minutes', 'Zero "where does this come from?" questions in review']
    },
    developer: {
      deliverables: ['Transcript ingestion + AI analysis API', 'Cross-interview synthesis engine', 'Research evidence traceability system', 'Role-based briefing generator endpoint'],
      acceptanceCriteria: ['Transcript API: processes 10k words in under 30 seconds', 'Synthesis: pattern detection across 3+ interviews', 'Traceability: every Decision stores sourceInsightId', 'Briefing: complete role outputs in under 20 seconds'],
      technicalConstraints: ['Must not change researcher recording workflow', 'Handles transcripts 500–20,000 words', 'All data stays within the organization'],
      dependencies: ['AI provider API for analysis', 'Auth system before multi-user features', 'Persistent storage to replace in-memory store'],
      nonGoals: ['NOT real-time collaborative editing this phase', 'NOT Jira/Linear integration in MVP', 'NOT custom AI model — using LLMs via API']
    },
    projectManager: {
      deliverables: ['Upload + AI analysis pipeline', 'Insights validation workspace', 'Cross-interview synthesis', 'Decisions Hub', 'Role briefing generator', 'Deploy with auth + persistence'],
      milestones: ['Phase 1 (Week 1-2): Core AI pipeline', 'Phase 2 (Week 3-4): Synthesis + Decisions', 'Phase 3 (Week 5-6): Problem analysis + Briefing', 'Phase 4 (Week 7-8): Auth + deploy'],
      dependenciesMap: ['Upload must complete before Insights', 'Insights before Synthesis', 'Synthesis feeds Decisions', 'Problems must exist before Briefing'],
      effortEstimates: ['Upload + analysis: M (1-2 weeks)', 'Insights UI: S (3-5 days)', 'Synthesis: L (2-3 weeks)', 'Briefing: L (2-3 weeks)', 'Auth + storage: XL (3-4 weeks)'],
      openQuestions: ['Who owns research data — individual or team account?', 'What happens to decisions when transcripts are updated?', 'Do we need role-based access before first enterprise customer?']
    }
  };
}

export async function generateBriefing(data: {
  rootProblem: string;
  problems: Array<{ title: string; description: string }>;
  painPoints: string[];
  mainThemes: string[];
  decisionTitles: string[];
  interviewCount: number;
}): Promise<RawBriefing> {
  if (!process.env.GROQ_API_KEY) {
    await new Promise(r => setTimeout(r, 1500));
    return mockGenerateBriefing(data.rootProblem, data.interviewCount);
  }

  const problemsStr = data.problems.map(p => `- ${p.title}: ${p.description}`).join('\n');
  console.log('[groq] generating role briefing...');
  const res = await groqFetch({
    model: 'llama-3.1-8b-instant',
    messages: [{ role: 'user', content: BRIEFING_PROMPT(data.rootProblem, problemsStr, data.painPoints, data.mainThemes, data.decisionTitles) }],
    temperature: 0.3,
    response_format: { type: 'json_object' }
  }, 90000);

  if (!res.ok) throw new Error(`Groq briefing ${res.status}: ${await res.text()}`);
  const responseData = await res.json() as { choices: Array<{ message: { content: string } }> };
  const content = responseData.choices[0]?.message?.content;
  if (!content) throw new Error('No content in briefing response');
  console.log('[groq] briefing complete');
  return JSON.parse(content) as RawBriefing;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function analyzeTranscript(transcript: string, interviewId: string): Promise<AIResult> {
  const result = process.env.GROQ_API_KEY
    ? await analyzeWithGroq(transcript)
    : (await new Promise<AnalyzeResult>(r => setTimeout(() => r(mockAnalyze(transcript)), 1400)));
  return { id: uuidv4(), interviewId, ...result, createdAt: new Date().toISOString() };
}
