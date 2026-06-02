// [UPDATED] Switched AI provider from Google Gemini to Groq (llama-3.1-8b-instant).
// Groq is free with no billing required — get a key at https://console.groq.com
// Falls back to mockAnalyze() when GROQ_API_KEY is not set.
import { AIResult, Cluster } from '../types';
import { v4 as uuidv4 } from 'uuid';
// [UPDATED] Removed openai SDK — using native fetch directly for simpler Groq integration

interface AnalyzeResult {
  summary: string;
  keyQuotes: string[];
  painPoints: string[];
  mainThemes: string[];
  clusters: Cluster[];
}

const PROMPT = (transcript: string) => `You are a senior UX research analyst. Analyze the following interview transcript and return ONLY a valid JSON object with this exact structure — no markdown, no explanation:

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

interface RawParsed {
  summary?: string;
  keyQuotes?: string[];
  painPoints?: string[];
  mainThemes?: string[];
  clusters?: Array<{ name: string; description: string; themes: string[] }>;
}

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

// [UPDATED] Uses native fetch instead of openai SDK — simpler, fewer moving parts
async function analyzeWithGroq(transcript: string): Promise<AnalyzeResult> {
  console.log('[groq] starting request, key present:', !!process.env.GROQ_API_KEY);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000); // 60s timeout

  let httpRes: Response;
  try {
    httpRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: PROMPT(transcript) }],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      }),
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }

  console.log('[groq] HTTP status:', httpRes.status);

  if (!httpRes.ok) {
    const errText = await httpRes.text();
    throw new Error(`Groq ${httpRes.status}: ${errText}`);
  }

  const data = await httpRes.json() as { choices: Array<{ message: { content: string } }> };
  const content = data.choices[0]?.message?.content;
  if (!content) throw new Error('No content in Groq response');

  console.log('[groq] response received, parsing JSON...');
  return buildResult(JSON.parse(content) as RawParsed);
}

function mockAnalyze(transcript: string): AnalyzeResult {
  const lines = transcript.split('\n').filter(l => l.trim().length > 30);
  const participantLines = lines.filter(l => !l.toLowerCase().startsWith('interviewer'));

  const pickQuote = (idx: number): string => {
    const line = participantLines[idx % Math.max(participantLines.length, 1)] ?? '';
    const cleaned = line.replace(/^[^:]+:\s*/, '').trim();
    return `"${cleaned.slice(0, 120)}${cleaned.length > 120 ? '...' : ''}"`;
  };

  return {
    summary: `This interview reveals significant workflow challenges experienced by the participant, particularly around tool fragmentation and process inefficiency. Key themes include context switching overhead, lack of integrated systems, and the burden of manual coordination between teams. The participant expressed a strong desire for more streamlined solutions that reduce friction and allow focus on high-value work.`,
    keyQuotes: [
      pickQuote(0),
      pickQuote(1),
      pickQuote(2)
    ].filter(q => q.length > 5),
    painPoints: [
      'Excessive manual steps required in core daily workflows',
      'Lack of integration between key tools creates information silos',
      'Context switching between tools breaks focus and wastes time',
      'Critical information becomes stale due to manual sync requirements',
      'Unclear ownership of cross-team processes causes repeated rework'
    ],
    mainThemes: [
      'Workflow friction',
      'Tool integration gaps',
      'Information discoverability',
      'Cognitive overhead',
      'Cross-team alignment'
    ],
    clusters: [
      {
        id: uuidv4(),
        name: 'Productivity Barriers',
        description: 'Factors that interrupt flow and prevent sustained productive work',
        themes: ['Workflow friction', 'Cognitive overhead'],
        insightIds: []
      },
      {
        id: uuidv4(),
        name: 'System & Tool Gaps',
        description: 'Missing integrations and tool limitations that force manual workarounds',
        themes: ['Tool integration gaps', 'Information discoverability'],
        insightIds: []
      },
      {
        id: uuidv4(),
        name: 'Collaboration & Alignment',
        description: 'Challenges keeping teams informed and working toward shared goals',
        themes: ['Cross-team alignment'],
        insightIds: []
      }
    ]
  };
}

export async function analyzeTranscript(
  transcript: string,
  interviewId: string
): Promise<AIResult> {
  let result: AnalyzeResult;

  if (process.env.GROQ_API_KEY) {              // [UPDATED] was: process.env.GEMINI_API_KEY
    result = await analyzeWithGroq(transcript); // [UPDATED] was: analyzeWithGemini(transcript)
  } else {
    await new Promise(resolve => setTimeout(resolve, 1400));
    result = mockAnalyze(transcript);
  }

  return {
    id: uuidv4(),
    interviewId,
    ...result,
    createdAt: new Date().toISOString()
  };
}
