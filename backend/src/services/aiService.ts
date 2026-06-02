import { AIResult, Cluster } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface AnalyzeResult {
  summary: string;
  keyQuotes: string[];
  painPoints: string[];
  mainThemes: string[];
  clusters: Cluster[];
}

async function analyzeWithOpenAI(transcript: string): Promise<AnalyzeResult> {
  const { default: OpenAI } = await import('openai');
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const prompt = `You are a senior UX research analyst. Analyze the following interview transcript and return ONLY a valid JSON object with this exact structure — no markdown, no explanation:

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

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    response_format: { type: 'json_object' }
  });

  const content = response.choices[0].message.content;
  if (!content) throw new Error('No response from OpenAI');

  const parsed = JSON.parse(content) as {
    summary?: string;
    keyQuotes?: string[];
    painPoints?: string[];
    mainThemes?: string[];
    clusters?: Array<{ name: string; description: string; themes: string[] }>;
  };

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

  if (process.env.OPENAI_API_KEY) {
    result = await analyzeWithOpenAI(transcript);
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
