import { AIResult, Cluster, SynthesisResult, SynthesisPattern } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { recordTokenUsage } from './storageService';

// ── AI Model Configuration ────────────────────────────────────────────────────
//
// Model: llama-3.1-8b-instant via Groq
// Fast inference with good structured-output quality for JSON extraction tasks.
// To improve output quality at the cost of speed, switch to: llama-3.1-70b-versatile

const AI_MODEL = 'llama-3.1-8b-instant';

// temperature controls randomness: 0.0 = deterministic, 1.0 = highly creative.
// Research tools need factual accuracy over creativity, so we use low values.
// Each task gets its own value based on how much "interpretation" is acceptable.
const TEMPERATURE = {
  EXTRACT:    0.2, // analyze & problems — must stay faithful to what participants said
  SYNTHESIZE: 0.3, // synthesis & decisions — needs slight flexibility to connect patterns
  STRATEGIC:  0.4, // briefing — needs variation to tailor language per role
};

// max_tokens caps the response length. Set per function based on expected output
// size to prevent truncation (too low) or wasted quota (too high).
const MAX_TOKENS = {
  ANALYZE:    2500, // summary + 3-5 quotes + pain points + themes + clusters
  SYNTHESIZE: 4000, // patterns + differences + recommendations across N interviews
  DECISIONS:  2000, // 3-5 decisions with title, note, and evidence quotes
  PROBLEMS:   1500, // root problem + 3-5 problems with descriptions and metadata
  BRIEFING:   4000, // 4 roles × multiple sections = largest output in the app
};

// System prompts establish the AI's role and behavioral constraints per task.
// Separating system from user message gives the model clearer role framing
// and improves output consistency compared to embedding instructions in the user turn.
const SYSTEM_PROMPTS = {
  ANALYZE:
    'You are a UX research analyst. Extract structured insights from interview transcripts ' +
    'accurately and faithfully. Do not invent or extrapolate beyond what the participant explicitly said.',

  SYNTHESIZE:
    'You are a senior UX researcher synthesizing findings across multiple interviews. ' +
    'Identify genuine cross-participant patterns. Do not overstate consensus — ' +
    'clearly note where participants diverge.',

  DECISIONS:
    'You are a senior product manager translating UX research into actionable product decisions. ' +
    'Every decision must be directly grounded in specific evidence from the research provided.',

  PROBLEMS:
    'You are a UX researcher identifying core product problems from research data. ' +
    'Be precise, avoid duplication, and prioritize problems by frequency and user impact.',

  BRIEFING:
    'You are a product strategist writing role-specific research briefings. ' +
    'Tailor language, priorities, and framing to each role\'s specific concerns and responsibilities.',
};

// ── JSON Schemas (Structured Output reference) ───────────────────────────────
// NOTE: json_schema response_format is NOT supported by llama-3.1-8b-instant.
// These schemas are kept as documentation of expected output structures and
// can be activated if the model is upgraded to one that supports it
// (e.g. llama-3.3-70b-versatile). Currently response_format uses json_object.
// See: https://console.groq.com/docs/structured-outputs#supported-models
const SCHEMAS = {
  ANALYZE: {
    name: 'analyze_result',
    schema: {
      type: 'object',
      properties: {
        summary:    { type: 'string' },
        keyQuotes:  { type: 'array', items: { type: 'string' } },
        painPoints: { type: 'array', items: { type: 'string' } },
        mainThemes: { type: 'array', items: { type: 'string' } },
        clusters: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name:        { type: 'string' },
              description: { type: 'string' },
              themes:      { type: 'array', items: { type: 'string' } }
            },
            required: ['name', 'description', 'themes'],
            additionalProperties: false
          }
        }
      },
      required: ['summary', 'keyQuotes', 'painPoints', 'mainThemes', 'clusters'],
      additionalProperties: false
    }
  },

  SYNTHESIS: {
    name: 'synthesis_result',
    schema: {
      type: 'object',
      properties: {
        overallSummary:       { type: 'string' },
        commonThemes:         { type: 'array', items: { type: 'string' } },
        patterns: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              pattern:     { type: 'string' },
              description: { type: 'string' },
              frequency:   { type: 'string' },
              quotes:      { type: 'array', items: { type: 'string' } }
            },
            required: ['pattern', 'description', 'frequency', 'quotes'],
            additionalProperties: false
          }
        },
        differences:           { type: 'array', items: { type: 'string' } },
        prioritizedPainPoints: { type: 'array', items: { type: 'string' } },
        recommendations:       { type: 'array', items: { type: 'string' } }
      },
      required: ['overallSummary', 'commonThemes', 'patterns', 'differences', 'prioritizedPainPoints', 'recommendations'],
      additionalProperties: false
    }
  },

  // decisions is wrapped in an object so json_schema can validate it
  // (json_schema requires a top-level object, not a bare array)
  DECISIONS: {
    name: 'decisions_result',
    schema: {
      type: 'object',
      properties: {
        decisions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title:          { type: 'string' },
              priority:       { type: 'string', enum: ['high', 'medium', 'low'] },
              note:           { type: 'string' },
              evidenceQuotes: { type: 'array', items: { type: 'string' } }
            },
            required: ['title', 'priority', 'note', 'evidenceQuotes'],
            additionalProperties: false
          }
        }
      },
      required: ['decisions'],
      additionalProperties: false
    }
  },

  PROBLEMS: {
    name: 'problems_result',
    schema: {
      type: 'object',
      properties: {
        rootProblem: { type: 'string' },
        problems: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title:                 { type: 'string' },
              description:           { type: 'string' },
              severity:              { type: 'string', enum: ['critical', 'moderate', 'minor'] },
              affectedRoles:         { type: 'array', items: { type: 'string' } },
              frequency:             { type: 'string', enum: ['daily', 'per_sprint', 'occasional'] },
              evidenceQuotes:        { type: 'array', items: { type: 'string' } },
              parentId:              { type: 'string' },
              sourceInterviewTitles: { type: 'array', items: { type: 'string' } }
            },
            required: ['title', 'description', 'severity', 'affectedRoles', 'frequency', 'evidenceQuotes', 'parentId', 'sourceInterviewTitles'],
            additionalProperties: false
          }
        }
      },
      required: ['rootProblem', 'problems'],
      additionalProperties: false
    }
  },

  BRIEFING: {
    name: 'briefing_result',
    schema: {
      type: 'object',
      properties: {
        confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        pm: {
          type: 'object',
          properties: {
            objectives:          { type: 'array', items: { type: 'string' } },
            okrs: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  objective:  { type: 'string' },
                  keyResults: { type: 'array', items: { type: 'string' } }
                },
                required: ['objective', 'keyResults'],
                additionalProperties: false
              }
            },
            priorityStackRank:   { type: 'array', items: { type: 'string' } },
            assumptionsAndRisks: { type: 'array', items: { type: 'string' } },
            methodsAndTools:     { type: 'array', items: { type: 'string' } }
          },
          required: ['objectives', 'okrs', 'priorityStackRank', 'assumptionsAndRisks', 'methodsAndTools'],
          additionalProperties: false
        },
        designer: {
          type: 'object',
          properties: {
            userNeeds:        { type: 'array', items: { type: 'string' } },
            jobsToBeDone:     { type: 'array', items: { type: 'string' } },
            designPrinciples: { type: 'array', items: { type: 'string' } },
            deliverables:     { type: 'array', items: { type: 'string' } },
            successCriteria:  { type: 'array', items: { type: 'string' } }
          },
          required: ['userNeeds', 'jobsToBeDone', 'designPrinciples', 'deliverables', 'successCriteria'],
          additionalProperties: false
        },
        developer: {
          type: 'object',
          properties: {
            deliverables:         { type: 'array', items: { type: 'string' } },
            acceptanceCriteria:   { type: 'array', items: { type: 'string' } },
            technicalConstraints: { type: 'array', items: { type: 'string' } },
            dependencies:         { type: 'array', items: { type: 'string' } },
            nonGoals:             { type: 'array', items: { type: 'string' } }
          },
          required: ['deliverables', 'acceptanceCriteria', 'technicalConstraints', 'dependencies', 'nonGoals'],
          additionalProperties: false
        },
        projectManager: {
          type: 'object',
          properties: {
            deliverables:    { type: 'array', items: { type: 'string' } },
            milestones:      { type: 'array', items: { type: 'string' } },
            dependenciesMap: { type: 'array', items: { type: 'string' } },
            effortEstimates: { type: 'array', items: { type: 'string' } },
            openQuestions:   { type: 'array', items: { type: 'string' } }
          },
          required: ['deliverables', 'milestones', 'dependenciesMap', 'effortEstimates', 'openQuestions'],
          additionalProperties: false
        }
      },
      required: ['confidence', 'pm', 'designer', 'developer', 'projectManager'],
      additionalProperties: false
    }
  }
};

interface AnalyzeResult {
  summary: string;
  keyQuotes: string[];
  painPoints: string[];
  mainThemes: string[];
  clusters: Cluster[];
}

// ── Prompts ──────────────────────────────────────────────────────────────────

// Few-Shot example teaches the model what "good" output looks like before it sees real data.
// Chain-of-Thought step 1 asks the model to reason about quality before extracting,
// reducing generic/vague outputs (a common failure mode for this task).
const ANALYZE_PROMPT = (transcript: string) => `## Step 1 — Reason before extracting (Chain-of-Thought)
Briefly identify before writing JSON:
1. What is the participant's PRIMARY frustration? → anchors the summary
2. Which quotes are verbatim vs paraphrased? → only verbatim belong in keyQuotes
3. Are the pain points specific and actionable, or still generic? → make them specific

## Step 2 — Reference example (Few-Shot)
Input excerpt:
"I open five different apps just to figure out what changed — Slack, Jira, Notion, email...
By the time I've caught up I've lost an hour. And the Notion docs are out of date anyway.
I just want one place where I can see everything that matters to me."

Expected output:
{
  "summary": "Participant loses 1+ hour daily aggregating information across 5 disconnected tools. Core desire is a single unified workspace surfacing only what is relevant.",
  "keyQuotes": [
    "I open five different apps just to figure out what changed",
    "by the time I've caught up I've lost an hour",
    "I just want one place where I can see everything that matters to me"
  ],
  "painPoints": [
    "Morning catch-up requires opening 5+ apps before any productive work begins",
    "Notion documentation is frequently stale, forcing manual cross-referencing",
    "No unified view causes 1-hour daily productivity loss"
  ],
  "mainThemes": ["Tool fragmentation", "Morning overhead", "Information reliability", "Unified workspace"],
  "clusters": [
    {
      "name": "Daily Overhead Tax",
      "description": "Time lost to tool-switching before productive work can begin",
      "themes": ["Tool fragmentation", "Morning overhead"]
    },
    {
      "name": "Information Reliability Gap",
      "description": "Stale documentation forces manual verification at every decision point",
      "themes": ["Information reliability", "Unified workspace"]
    }
  ]
}

## Step 3 — Analyze this transcript
Return ONLY valid JSON — no markdown, no explanation, no reasoning text.

Rules:
- keyQuotes: 3-5 direct quotes from the participant
- painPoints: 4-6 specific, actionable pain points
- mainThemes: 4-6 short theme labels (2-4 words each)
- clusters: 2-4 affinity clusters grouping related themes

Transcript:
${transcript}`;

// Synthesis uses extracted aiResult fields (summary, quotes, pain points, themes) instead of
// raw transcripts. This reduces tokens per interview from ~1500 to ~250, preventing rate limit
// errors on Groq's free tier and making synthesis much faster regardless of transcript length.
interface SynthesisInput {
  id: string;
  title: string;
  summary: string;
  keyQuotes: string[];
  painPoints: string[];
  mainThemes: string[];
}

const SYNTHESIS_PROMPT = (interviews: SynthesisInput[]) =>
  `Analyze these extracted research findings from ${interviews.length} interviews to find cross-participant patterns.

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

${interviews.map((iv, i) => `--- Interview ${i + 1}: ${iv.title} ---
Summary: ${iv.summary}
Pain Points:
${iv.painPoints.slice(0, 6).map(p => `• ${p}`).join('\n')}
Key Quotes:
${iv.keyQuotes.slice(0, 4).map(q => `• ${q}`).join('\n')}
Themes: ${iv.mainThemes.join(', ')}`).join('\n\n')}`;

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

// Parses a non-streaming Groq response, records token usage, and returns the text content.
async function parseGroqJson(res: Response): Promise<string> {
  const data = await res.json() as {
    choices: Array<{ message: { content: string } }>;
    usage?: { total_tokens?: number };
  };
  if (data.usage?.total_tokens) recordTokenUsage(data.usage.total_tokens);
  const content = data.choices[0]?.message?.content;
  if (!content) throw new Error('No content in response');
  return content;
}

async function groqFetch(body: object, timeoutMs = 150000): Promise<Response> {
  const controller = new AbortController();
  // 150s covers up to 3 rate-limit waits (~30s each) plus actual API response time
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const doFetch = () => fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
    },
    body: JSON.stringify(body),
    signal: controller.signal
  });

  try {
    let res = await doFetch();

    // Retry up to 3 times on rate limit (429).
    // Each response tells us exactly how long to wait via "try again in X.XXs".
    // We use that value + 2s buffer so the window is clear before the next attempt.
    for (let attempt = 1; attempt <= 3 && res.status === 429; attempt++) {
      const errBody = await res.json() as { error?: { message?: string } };
      const msg = errBody.error?.message ?? '';
      const match = msg.match(/try again in ([\d.]+)s/);
      const waitMs = match ? (parseFloat(match[1]) + 2) * 1000 : (15 + attempt * 10) * 1000;
      console.log(`[groq] rate limited (attempt ${attempt}/3) — retrying in ${(waitMs / 1000).toFixed(1)}s...`);
      await new Promise(r => setTimeout(r, waitMs));
      res = await doFetch();
    }

    return res;
  } finally {
    clearTimeout(timer);
  }
}

// ── Single Interview Analysis (non-streaming) ─────────────────────────────────

async function analyzeWithGroq(transcript: string): Promise<AnalyzeResult> {
  console.log('[groq] analyzing transcript...');
  const res = await groqFetch({
    model: AI_MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPTS.ANALYZE },
      { role: 'user',   content: ANALYZE_PROMPT(transcript) },
    ],
    temperature:  TEMPERATURE.EXTRACT,   // low: must be faithful to participant's words
    max_tokens:   MAX_TOKENS.ANALYZE,
    response_format: { type: 'json_object' }
  });

  if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text()}`);
  const content = await parseGroqJson(res);
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
    model: AI_MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPTS.ANALYZE },
      { role: 'user',   content: ANALYZE_PROMPT(transcript) },
    ],
    temperature:  TEMPERATURE.EXTRACT,   // low: must be faithful to participant's words
    max_tokens:   MAX_TOKENS.ANALYZE,
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
  interviews: SynthesisInput[]
): Promise<SynthesisResult> {
  const n = interviews.length;

  if (!process.env.GROQ_API_KEY) {
    await new Promise(r => setTimeout(r, 1800));
    return mockSynthesis(interviews);
  }

  console.log(`[groq] synthesizing ${n} interviews...`);
  const res = await groqFetch({
    model: AI_MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPTS.SYNTHESIZE },
      { role: 'user',   content: SYNTHESIS_PROMPT(interviews) },
    ],
    temperature:  TEMPERATURE.SYNTHESIZE, // slightly higher: needs flexibility to connect patterns across interviews
    max_tokens:   MAX_TOKENS.SYNTHESIZE,
    response_format: { type: 'json_object' }
  }, 120000);

  if (!res.ok) throw new Error(`Groq synthesis ${res.status}: ${await res.text()}`);
  const content = await parseGroqJson(res);
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

// Few-Shot example shows the model what a high-quality decision looks like vs a vague one.
// Prompts now return { decisions: [...] } to match the DECISIONS json_schema (top-level object required).
const DECISIONS_PROMPT = (
  painPoints: string[],
  quotes: string[],
  themes: string[]
) => `## Quality standard for decision titles (Few-Shot)
Good: "Build unified morning briefing view to eliminate multi-tool catch-up overhead"
  → Verb-first, specific solution, directly linked to a concrete pain point
Bad: "Fix the dashboard" or "Improve information access"
  → Too vague, no solution direction, not actionable

## Example output
{
  "decisions": [
    {
      "title": "Build unified morning briefing view to eliminate multi-tool catch-up overhead",
      "priority": "high",
      "note": "Participants consistently report losing 1+ hour daily to information aggregation. A consolidated view directly addresses the highest-frequency pain point.",
      "evidenceQuotes": ["I open five different apps just to figure out what changed", "by the time I've caught up I've lost an hour"]
    },
    {
      "title": "Implement real-time documentation sync to prevent stale information drift",
      "priority": "medium",
      "note": "Multiple participants treat documentation as untrustworthy, adding a manual verification step to every cross-team interaction.",
      "evidenceQuotes": ["the Notion docs are out of date anyway"]
    }
  ]
}

## Generate decisions from these findings
Return ONLY valid JSON with a "decisions" array — no markdown, no explanation.

Rules:
- Generate 3-5 decisions
- title: verb-first and specific (8-15 words)
- priority: "high" (core workflow impact) | "medium" (UX improvement) | "low" (enhancement)
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
    model: AI_MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPTS.DECISIONS },
      { role: 'user',   content: DECISIONS_PROMPT(allPain, allQuotes, allThemes) },
    ],
    temperature:  TEMPERATURE.SYNTHESIZE, // moderate: decisions need evidence grounding but some interpretive flexibility
    max_tokens:   MAX_TOKENS.DECISIONS,
    response_format: { type: 'json_object' }
  });

  if (!res.ok) throw new Error(`Groq decisions ${res.status}: ${await res.text()}`);
  const content = await parseGroqJson(res);
  const parsed = JSON.parse(content) as RawDecision[] | { decisions?: RawDecision[] };
  const arr = Array.isArray(parsed) ? parsed : (parsed.decisions ?? []);
  console.log(`[groq] generated ${arr.length} decisions`);
  return arr;
}

// ── Decisions from Synthesis ──────────────────────────────────────────────────

// Chain-of-Thought asks the model to reason about priority before assigning it,
// reducing "everything is high priority" collapse that's common without this step.
// Also wrapped in { decisions: [...] } to match the DECISIONS json_schema.
const DECISIONS_FROM_SYNTHESIS_PROMPT = (
  recommendations: string[],
  painPoints: string[],
  themes: string[]
) => `## Step 1 — Reason before converting (Chain-of-Thought)
For each recommendation, consider:
- What specific outcome does this recommendation enable for the user?
- Is the impact "high" (blocks core workflow), "medium" (UX improvement), or "low" (enhancement)?
- What is the single most compelling evidence point from the pain points below?

## Step 2 — Convert recommendations to decisions
Return ONLY valid JSON with a "decisions" array — no markdown, no explanation.

Rules:
- Generate exactly one decision per recommendation
- title: verb-first and specific (8-15 words)
- priority: "high" | "medium" | "low"

{
  "decisions": [
    {
      "title": "Actionable decision starting with a verb (8-15 words)",
      "priority": "high|medium|low",
      "note": "1-2 sentence rationale based on the recommendation",
      "evidenceQuotes": ["the recommendation or pain point this is based on"]
    }
  ]
}

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
    model: AI_MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPTS.DECISIONS },
      { role: 'user',   content: DECISIONS_FROM_SYNTHESIS_PROMPT(recommendations, prioritizedPainPoints, commonThemes) },
    ],
    temperature:  TEMPERATURE.SYNTHESIZE, // moderate: converting synthesis recommendations into decisions
    max_tokens:   MAX_TOKENS.DECISIONS,
    response_format: { type: 'json_object' }
  });

  if (!res.ok) throw new Error(`Groq decisions-from-synthesis ${res.status}: ${await res.text()}`);
  const content = await parseGroqJson(res);
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
  sourceInterviewTitles?: string[];
}

interface RawProblemsResult {
  rootProblem?: string;
  problems?: RawProblem[];
}

type InterviewInput = { title: string; painPoints: string[]; keyQuotes: string[]; mainThemes: string[] };

// Chain-of-Thought guides the model to distinguish root causes from symptoms before writing JSON —
// the most common failure mode is listing symptoms (e.g. "can't find file") as top-level problems.
// Few-Shot example shows what a good vs bad problem entry looks like.
const PROBLEMS_PROMPT = (interviews: InterviewInput[]) =>
  `Analyze the UX research data below and return a JSON object with exactly these two keys:
- "rootProblem": one sentence naming the single underlying cause connecting most problems
- "problems": array of 3-5 problem objects

Each problem object must have exactly these keys:
- "title": short name (under 10 words)
- "description": 2-3 sentences explaining the problem and its downstream impact
- "severity": "critical" | "moderate" | "minor"
- "affectedRoles": array using only these values: "researcher" | "pm" | "designer" | "developer" | "project_manager"
- "frequency": "daily" | "per_sprint" | "occasional"
- "evidenceQuotes": array of 1-2 direct quotes from the research data below
- "parentId": empty string "" (unless this is a sub-problem of another listed problem, then use that problem's title)
- "sourceInterviewTitles": array of exact interview title(s) this problem comes from

Good problem description example:
"Teams maintain parallel copies across Slack, Jira, and Notion. This creates version conflicts and forces manual reconciliation before every meeting. The result is decisions made on stale data."

Bad problem description (too vague — do not do this):
"Users have issues finding information."

Severity guide: critical = blocks core workflow | moderate = significant friction | minor = improvement opportunity

Research data:
${interviews.map(iv => `=== ${iv.title} ===
Pain points: ${iv.painPoints.slice(0, 5).join(' | ')}
Quotes: ${iv.keyQuotes.slice(0, 4).join(' | ')}
Themes: ${iv.mainThemes.join(', ')}`).join('\n\n')}

Return ONLY the JSON object. No explanation, no markdown, no extra keys.`;

function mockGenerateProblems(interviews: InterviewInput[]): RawProblemsResult {
  const allThemes = [...new Set(interviews.flatMap(iv => iv.mainThemes))];
  const topThemes = allThemes.slice(0, 3);
  const rootProblem = topThemes.length > 0
    ? `Users face compounding friction from ${topThemes.join(', ').toLowerCase()}, preventing effective work and informed decision-making across teams.`
    : 'Users face significant workflow friction that blocks productivity and cross-team alignment.';

  const severities:  Array<'critical' | 'moderate' | 'minor'>    = ['critical', 'moderate', 'minor'];
  const frequencies: Array<'daily' | 'per_sprint' | 'occasional'> = ['daily', 'per_sprint', 'occasional'];
  const roleSets = [['researcher', 'pm'], ['pm', 'designer', 'developer'], ['researcher']];

  const problems: RawProblem[] = [];

  for (const iv of interviews) {
    const usablePains  = iv.painPoints.filter(p => p.trim().length > 10).slice(0, 2);
    const usableQuotes = iv.keyQuotes.filter(q => q.trim().length > 10);

    usablePains.forEach((pain, i) => {
      const words = pain.split(' ');
      const title = words.length <= 8 ? pain : words.slice(0, 8).join(' ') + '…';
      problems.push({
        title,
        description: `${pain} This creates downstream friction affecting team workflows and outcomes across roles.`,
        severity:      severities[i]  ?? 'moderate',
        affectedRoles: roleSets[i]    ?? ['researcher'],
        frequency:     frequencies[i] ?? 'per_sprint',
        evidenceQuotes: [usableQuotes[i] ?? pain].filter(Boolean),
        parentId:      '',
        sourceInterviewTitles: [iv.title]
      });
    });
  }

  return {
    rootProblem,
    problems: problems.length > 0 ? problems : [{
      title: 'No pain points found in analyzed interviews',
      description: 'Upload and analyze at least one interview to generate a real problem analysis.',
      severity: 'minor', affectedRoles: [], frequency: 'occasional', evidenceQuotes: [], parentId: '',
      sourceInterviewTitles: []
    }]
  };
}

export async function generateProblems(data: {
  interviews: InterviewInput[];
}): Promise<RawProblemsResult> {
  if (!process.env.GROQ_API_KEY) {
    await new Promise(r => setTimeout(r, 1200));
    return mockGenerateProblems(data.interviews);
  }

  console.log('[groq] generating problem analysis...');
  const res = await groqFetch({
    model: AI_MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPTS.PROBLEMS },
      { role: 'user',   content: PROBLEMS_PROMPT(data.interviews) },
    ],
    temperature:  TEMPERATURE.EXTRACT,   // low: problems must be grounded in actual research data
    max_tokens:   MAX_TOKENS.PROBLEMS,
    response_format: { type: 'json_object' }
  });

  if (!res.ok) throw new Error(`Groq problems ${res.status}: ${await res.text()}`);
  const content = await parseGroqJson(res);
  console.log('[groq] problem analysis complete');
  console.log('[groq] raw problems JSON:', content.slice(0, 300));
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

// Chain-of-Thought asks the model to reason about each role's distinct concerns before generating,
// preventing outputs where every role gets generic identical-sounding content.
const BRIEFING_PROMPT = (rootProblem: string, problems: string, painPoints: string[], themes: string[], decisions: string[]) =>
  `## Step 1 — Role-based reasoning (Chain-of-Thought)
Before generating outputs, reason through each role's distinct concerns:
- PM: What measurable outcomes matter? What should ship first and why does order matter?
- Designer: What must the user be able to do? What friction must be eliminated entirely?
- Developer: What specifically needs to be built? What must NOT be built to prevent scope creep?
- Project Manager: What is the realistic sequence? What blocks what?
Generate each role's section independently with these concerns in mind.

## Step 2 — Generate the role briefing
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

function mockGenerateBriefing(
  rootProblem: string,
  problems: Array<{ title: string; description: string }>,
  painPoints: string[],
  interviewCount: number
): RawBriefing {
  const conf = interviewCount >= 5 ? 'high' : interviewCount >= 2 ? 'medium' : 'low';
  const p0    = problems[0]?.title     ?? 'core workflow friction';
  const p1    = problems[1]?.title     ?? 'information fragmentation';
  const pain0 = painPoints[0]?.slice(0, 60) ?? 'key pain point identified in research';
  const pain1 = painPoints[1]?.slice(0, 60) ?? 'secondary pain point identified in research';

  return {
    confidence: conf,
    pm: {
      objectives: [
        `Resolve "${p0}" to restore productive daily workflows across all roles`,
        `Address "${p1}" to enable cross-team alignment at critical decision points`
      ],
      okrs: [{
        objective: `Eliminate root cause: ${rootProblem.slice(0, 80)}`,
        keyResults: [
          `Reduce time lost to "${pain0.slice(0, 40)}" by 50% within 2 sprints`,
          `Increase team satisfaction score related to workflow by 30%`,
          `Reduce manual workarounds from ${problems.length} identified patterns to zero`
        ]
      }],
      priorityStackRank: problems.slice(0, 3).map((p, i) =>
        `#${i + 1}: ${p.title} — ${i === 0 ? 'highest frequency, affects most roles' : i === 1 ? 'directly recoverable time' : 'reduces rework at handoff'}`
      ),
      assumptionsAndRisks: [
        `Assumption: solving "${p0}" will unblock downstream workflow issues`,
        `Risk: users may resist change if existing workarounds feel "good enough"`,
        `Risk: addressing all ${problems.length} problems simultaneously may dilute execution focus`
      ],
      methodsAndTools: [
        `Track "${pain0.slice(0, 40)}" resolution via pre/post task completion survey`,
        `Measure workflow efficiency via session recording before and after deployment`,
        `Monitor support requests related to identified pain points week-over-week`
      ]
    },
    designer: {
      userNeeds: [
        `Users need to accomplish their core workflow without encountering "${pain0.slice(0, 50)}"`,
        `Users need clear feedback when the system resolves "${p0}"`,
        `Users need a workflow that doesn't require manual workarounds for "${p1}"`
      ],
      jobsToBeDone: [
        `When I encounter "${pain0.slice(0, 40)}", I want an automated solution, so I can focus on high-value work`,
        `When I collaborate across teams, I want a single source of truth, so I can avoid duplicating effort`
      ],
      designPrinciples: [
        `Eliminate the need for workarounds surfaced in research`,
        `Make the right action the easiest action for every identified pain point`,
        `Surface information at the moment of need, not retrospectively`
      ],
      deliverables: problems.slice(0, 3).map(p => `Design solution addressing: ${p.title}`),
      successCriteria: [
        `Users complete core tasks without triggering "${pain0.slice(0, 40)}"`,
        `Zero workarounds required for ${problems.length} identified problem scenarios`,
        `User satisfaction with workflow improves measurably post-deployment`
      ]
    },
    developer: {
      deliverables: problems.slice(0, 4).map(p => `Implement fix for: ${p.title}`),
      acceptanceCriteria: problems.slice(0, 3).map(p =>
        `"${p.title.slice(0, 50)}": user can complete task without the identified friction`
      ),
      technicalConstraints: [
        `Solution must not introduce new steps to resolve "${p0}"`,
        `Must handle all ${problems.length} identified problem scenarios without regression`,
        `Performance must not degrade — existing workflows must remain at current speed or faster`
      ],
      dependencies: [
        `Design specs for "${p0}" must be finalized before development begins`,
        `User validation of proposed solution for "${p1}" required before full build`,
        `Analytics instrumentation must be in place to measure KR attainment`
      ],
      nonGoals: [
        `NOT solving problems outside the ${problems.length} identified in this research cycle`,
        `NOT rebuilding features unrelated to identified pain points`,
        `NOT optimizing for edge cases not represented in research`
      ]
    },
    projectManager: {
      deliverables: problems.map(p => p.title),
      milestones: [
        `Phase 1 (Week 1-2): Design + validate solution for "${p0}"`,
        `Phase 2 (Week 3-4): Build + test core fixes for top ${Math.min(problems.length, 2)} problems`,
        `Phase 3 (Week 5-6): Ship remaining fixes + measure KRs against baseline`
      ],
      dependenciesMap: problems.slice(0, 3).map((p, i) =>
        i === 0
          ? `Research sign-off required before "${p.title}" design begins`
          : `"${problems[i - 1].title}" must be validated before "${p.title}" build starts`
      ),
      effortEstimates: problems.map((p, i) =>
        `${p.title.slice(0, 40)}: ${i === 0 ? 'L (2-3 weeks)' : i === 1 ? 'M (1-2 weeks)' : 'S (3-5 days)'}`
      ),
      openQuestions: [
        `Which of the ${problems.length} problems has the highest user impact and should ship first?`,
        `How do we validate that the solution for "${p0}" is working before full rollout?`,
        `Who is the decision-maker if "${p1}" solution conflicts with existing product direction?`
      ]
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
    return mockGenerateBriefing(data.rootProblem, data.problems, data.painPoints, data.interviewCount);
  }

  const problemsStr = data.problems.map(p => `- ${p.title}: ${p.description}`).join('\n');
  console.log('[groq] generating role briefing...');
  const res = await groqFetch({
    model: AI_MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPTS.BRIEFING },
      { role: 'user',   content: BRIEFING_PROMPT(data.rootProblem, problemsStr, data.painPoints, data.mainThemes, data.decisionTitles) },
    ],
    temperature:  TEMPERATURE.STRATEGIC, // higher: briefing needs varied language tailored to each role
    max_tokens:   MAX_TOKENS.BRIEFING,
    response_format: { type: 'json_object' }
  }, 120000);

  if (!res.ok) throw new Error(`Groq briefing ${res.status}: ${await res.text()}`);
  const content = await parseGroqJson(res);
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
