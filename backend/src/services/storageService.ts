import { Interview, Insight, Decision, Problem, ProblemsAnalysis, Briefing } from '../types';

const interviews = new Map<string, Interview>();
const insights   = new Map<string, Insight>();
const decisions  = new Map<string, Decision>();

const mockDecisions: Decision[] = [
  {
    id: 'decision-001',
    title: 'Redesign morning workflow to eliminate 30-minute daily catch-up overhead',
    status: 'open',
    priority: 'high',
    note: 'Participants report losing 30-40 minutes every morning catching up on Slack and email before starting productive work. A unified notification digest or async-first protocol could directly address this.',
    owner: '',
    dueDate: '',
    evidenceQuotes: ['"I start by checking Slack and email, which honestly takes about 30-40 minutes just to catch up."'],
    sourceType: 'ai_generated',
    sourceInterviewId: 'mock-001',
    sourceInterviewTitle: 'User Interview — Sarah (Product Manager)',
    sourceInsightId: '',
    statusHistory: [{ status: 'open', changedAt: new Date().toISOString() }],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'decision-002',
    title: 'Build unified workspace consolidating research, specs, and product decisions',
    status: 'in_progress',
    priority: 'high',
    note: 'The single most requested capability across interviews. Users context-switch between 12+ tools and spend more time managing tools than doing actual work.',
    owner: 'Product Team',
    dueDate: '',
    evidenceQuotes: [
      '"I just want one place where research, design decisions, and product specs all live together."',
      '"I spend more time managing tools than actually doing work."'
    ],
    sourceType: 'ai_generated',
    sourceInterviewId: 'mock-001',
    sourceInterviewTitle: 'User Interview — Sarah (Product Manager)',
    sourceInsightId: '',
    statusHistory: [
      { status: 'open',        changedAt: new Date(Date.now() - 86400000 * 2).toISOString() },
      { status: 'in_progress', changedAt: new Date().toISOString() }
    ],
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'decision-003',
    title: 'Automate research share-out pipeline to cut prep time from 2 hours to 15 minutes',
    status: 'draft',
    priority: 'medium',
    note: 'Research share-out preparation consumes disproportionate time — copying findings across tools, formatting summaries, scheduling walkthroughs. An AI-assisted pipeline would address this directly.',
    owner: '',
    dueDate: '',
    evidenceQuotes: ['"It takes me two hours to prep a research share-out that should take fifteen minutes."'],
    sourceType: 'ai_generated',
    sourceInterviewId: 'mock-001',
    sourceInterviewTitle: 'User Interview — Sarah (Product Manager)',
    sourceInsightId: '',
    statusHistory: [{ status: 'draft', changedAt: new Date().toISOString() }],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

mockDecisions.forEach(d => decisions.set(d.id, d));

// ── Problems & Briefing (singleton — replaced on each generation) ─────────────

let currentProblemsAnalysis: ProblemsAnalysis | null = {
  id: 'problems-001',
  rootProblem: 'Teams lack a unified research-to-decision pipeline, causing insights to be lost between research, design, and development handoffs.',
  problems: [
    {
      id: 'prob-001',
      title: 'Research insights fail to reach decision-makers in time',
      description: 'Research findings are stored in disconnected tools and never surface at the moment decisions are made. PMs proceed without evidence that already exists in the system.',
      severity: 'critical',
      affectedRoles: ['researcher', 'pm'],
      frequency: 'per_sprint',
      evidenceQuotes: ['"Half the team was working from outdated docs because nobody had time to sync everything."', '"We shipped with three known bugs because the feedback loop was broken."'],
      parentId: '',
      createdAt: new Date().toISOString()
    },
    {
      id: 'prob-002',
      title: 'Tool fragmentation breaks daily focus and wastes productive hours',
      description: 'Users context-switch between 12+ tools daily, spending more time managing tools than doing actual work. The overhead is cumulative, invisible, and growing.',
      severity: 'critical',
      affectedRoles: ['researcher', 'designer', 'pm'],
      frequency: 'daily',
      evidenceQuotes: ['"I spend more time managing tools than actually doing work."', '"I have like 12 different tabs open at all times."'],
      parentId: '',
      createdAt: new Date().toISOString()
    },
    {
      id: 'prob-003',
      title: 'Research share-out preparation consumes disproportionate time',
      description: 'Preparing research for stakeholders takes 2 hours for what should be a 15-minute task. Manual copying and formatting degrades quality and discourages sharing.',
      severity: 'moderate',
      affectedRoles: ['researcher'],
      frequency: 'per_sprint',
      evidenceQuotes: ['"It takes me two hours to prep a research share-out that should take fifteen minutes."', '"Half the stakeholders don\'t read it anyway because it\'s not in the system they use."'],
      parentId: 'prob-001',
      createdAt: new Date().toISOString()
    },
    {
      id: 'prob-004',
      title: 'No single source of truth causes misalignment at critical moments',
      description: 'Research, design specs, and product decisions live in different tools with no automatic sync. Teams discover misalignment at launch — too late to fix without cost.',
      severity: 'critical',
      affectedRoles: ['pm', 'designer', 'developer', 'project_manager'],
      frequency: 'per_sprint',
      evidenceQuotes: ['"I just want one place where research, design decisions, and product specs all live together."'],
      parentId: '',
      createdAt: new Date().toISOString()
    }
  ] as Problem[],
  interviewCount: 1,
  generatedAt: new Date().toISOString()
};

let currentBriefing: Briefing | null = {
  id: 'briefing-001',
  confidence: 'high',
  problemCount: 4,
  interviewCount: 1,
  pm: {
    objectives: [
      'Eliminate research-to-decision lag so product teams act on evidence within 48 hours',
      'Reduce tool fragmentation overhead to free 30% more time for actual product thinking',
      'Establish a traceable research-to-product pipeline that survives team handoffs'
    ],
    okrs: [
      {
        objective: 'Make research insights immediately actionable for all roles',
        keyResults: [
          'Reduce research-to-decision time from 2 weeks to 48 hours',
          'Increase research utilization rate from ~20% to 70% per sprint',
          'Reduce research share-out prep time from 2 hours to 15 minutes'
        ]
      },
      {
        objective: 'Eliminate context-switching as a productivity drain',
        keyResults: [
          'Reduce number of tools in daily workflow from 12+ to 3 or fewer',
          'Increase deep work blocks (90+ min uninterrupted) by 40%'
        ]
      }
    ],
    priorityStackRank: [
      '#1: Unified research workspace — highest frequency pain, affects all roles daily, highest ROI',
      '#2: Automated share-out pipeline — directly recoverable time, low technical risk',
      '#3: Research-to-decision traceability — enables accountability, reduces rework at handoff'
    ],
    assumptionsAndRisks: [
      'Assumption: teams will adopt a new tool if it reduces switching rather than adding to it',
      'Assumption: AI-generated summaries are accurate enough for PM decision-making',
      'Risk: researchers may resist AI outputs if they feel accuracy is compromised',
      'Risk: PMs may not change decision habits without a forcing function at sprint planning'
    ],
    methodsAndTools: [
      'Track research-to-decision time via timestamp delta in the Decisions Hub',
      'Measure share-out prep time via user self-report in onboarding survey + monthly check-in',
      'Track research utilization rate by counting decisions with sourceInsightId per sprint',
      'Monitor context-switching via tool integration logs or user diary study'
    ]
  },
  designer: {
    userNeeds: [
      'Users need to be able to find relevant research without leaving their current design tool',
      'Users need to see the user context and evidence behind every requirement they receive',
      'Users need to share research findings in a format stakeholders will actually read before the meeting',
      'Users need to trace every design decision back to a specific user need or pain point'
    ],
    jobsToBeDone: [
      'When I start a new design sprint, I want to see all relevant research in one place, so I can make informed design decisions without hunting through 5 different tools',
      'When I present work to stakeholders, I want to share a single link, so I can stop rebuilding slide decks from scratch for every review',
      'When I finish a design, I want to trace it back to a user need, so I can defend my decisions under pushback with evidence rather than opinion'
    ],
    designPrinciples: [
      'Zero context-switching: research must be accessible without leaving the design canvas',
      'Evidence-first: every design decision must be traceable to a user quote or pain point',
      'One source of truth: never show the same information in two different places',
      'Progressive disclosure: show the minimum needed, reveal depth on demand'
    ],
    deliverables: [
      'Unified research sidebar embeddable in design tools (Figma plugin)',
      'Stakeholder-ready one-page briefing auto-generated from synthesis',
      'Design decision log with linked research evidence',
      'Insight-to-design traceability matrix'
    ],
    successCriteria: [
      'Designers reference research evidence in 80% of design critiques without being prompted',
      'Stakeholder review prep time reduced from 2 hours to under 20 minutes',
      'Zero "where did this come from?" questions in design review within 2 sprints of adoption'
    ]
  },
  developer: {
    deliverables: [
      'Transcript ingestion + structured AI analysis API',
      'Cross-interview synthesis engine with pattern detection',
      'Research evidence traceability system (insight → decision → feature)',
      'Role-based briefing generator endpoint',
      'Stakeholder report export (markdown + PDF)'
    ],
    acceptanceCriteria: [
      'Transcript API: processes a 10,000-word transcript in under 30 seconds end-to-end',
      'Synthesis: correctly identifies patterns across 3+ interviews with 80%+ researcher agreement',
      'Traceability: every Decision record stores sourceInsightId and sourceInterviewId',
      'Briefing API: generates complete role outputs in under 20 seconds',
      'Export: markdown report renders correctly in GitHub, Notion, and Confluence'
    ],
    technicalConstraints: [
      'Must not require researchers to change their existing interview recording workflow',
      'AI analysis must handle transcripts of 500–20,000 words without truncation',
      'All interview data must remain within the organization — no third-party model training',
      'API response times must stay under 500ms for all non-AI endpoints'
    ],
    dependencies: [
      'AI provider API (Groq or OpenAI) for transcript analysis and synthesis',
      'Authentication system before any multi-user or team features can ship',
      'Persistent storage (PostgreSQL or SQLite) to replace in-memory store',
      'File storage service (S3 or equivalent) for transcript uploads at scale'
    ],
    nonGoals: [
      'NOT building real-time collaborative editing in this phase',
      'NOT integrating with Jira, Linear, or Confluence in MVP',
      'NOT building a mobile app or native desktop client',
      'NOT building a custom AI model — using off-the-shelf LLMs via API'
    ]
  },
  projectManager: {
    deliverables: [
      'Transcript upload + AI analysis pipeline',
      'Insights validation workspace with approve/reject/edit',
      'Cross-interview synthesis engine',
      'Decisions Hub with status tracking and traceability',
      'Role-based stakeholder briefing generator',
      'Problem analysis with hierarchy, segment, and priority views',
      'Deploy to production with auth and persistent storage'
    ],
    milestones: [
      'Phase 1 (Week 1-2): Core pipeline — upload, analyze, workspace ✅',
      'Phase 2 (Week 3-4): Synthesis + Decisions Hub ✅',
      'Phase 3 (Week 5-6): Problem analysis + Role briefing',
      'Phase 4 (Week 7-8): Auth + persistent storage + deploy',
      'Phase 5 (Week 9-10): Figma plugin + integrations'
    ],
    dependenciesMap: [
      'Upload pipeline must complete before Insights workspace can begin',
      'Insights must be complete before Synthesis can aggregate across interviews',
      'Synthesis recommendations feed the Decisions Hub generator',
      'Problem analysis must be generated before Briefing can be created',
      'Auth must ship before any team/sharing features can be enabled'
    ],
    effortEstimates: [
      'Transcript upload + AI analysis: M (1-2 weeks)',
      'Insights validation UI: S (3-5 days)',
      'Synthesis engine: L (2-3 weeks)',
      'Decisions Hub: L (2-3 weeks)',
      'Problem analysis page: M (1-2 weeks)',
      'Role briefing page: L (2-3 weeks)',
      'Auth + persistent storage: XL (3-4 weeks)'
    ],
    openQuestions: [
      'Who owns the research data — individual researcher or the team account?',
      'What happens to decisions when the underlying interview transcript is updated or deleted?',
      'Do we need role-based access control before the first enterprise customer?',
      'Should the briefing be regenerated automatically when new interviews are added?'
    ]
  },
  generatedAt: new Date().toISOString()
};

const mockInterview: Interview = {
  id: 'mock-001',
  title: 'User Interview — Sarah (Product Manager)',
  fileName: 'sarah_interview.txt',
  uploadedAt: new Date().toISOString(),
  transcript: `Interviewer: Can you walk me through your typical morning workflow?

Sarah: Sure. So I start by checking Slack and email, which honestly takes about 30-40 minutes just to catch up. Then I try to get to my actual work, but I'm constantly being pulled back into messages and meetings.

Interviewer: What's the most frustrating part about your current tools?

Sarah: Honestly? The context switching. I have like 12 different tabs open at all times — Jira, Notion, Slack, Google Docs, Figma. Every tool solves one problem but creates three new ones. I spend more time managing tools than actually doing work.

Interviewer: Tell me about a recent project that went particularly well or poorly.

Sarah: We had this product launch last month. The research was done in one tool, designs in another, specs in another. By launch day, half the team was working from outdated docs because nobody had time to sync everything. We shipped with three known bugs because the feedback loop was broken.

Interviewer: If you could wave a magic wand and fix one thing about your workflow, what would it be?

Sarah: One source of truth. Seriously. I just want one place where research, design decisions, and product specs all live together and stay in sync automatically. Right now I'm the human glue between all these tools and it's exhausting.

Interviewer: How do you currently share research findings with stakeholders?

Sarah: Manually. I copy stuff from Dovetail into a Notion doc, then paste a summary into Slack, then schedule a meeting to walk through it. It takes me two hours to prep a research share-out that should take fifteen minutes. And half the stakeholders don't read it anyway because it's not in the system they use.

Interviewer: What would success look like for you six months from now?

Sarah: Honestly? I want to spend 80% of my time on actual product thinking, not tool wrangling. I want research to flow naturally into the places where decisions get made. I want to stop being the bottleneck.`,
  aiResult: {
    id: 'result-001',
    interviewId: 'mock-001',
    summary: 'Sarah is a Product Manager experiencing significant friction from tool fragmentation and context switching. She spends 30-40 minutes each morning just catching up, and wastes hours manually bridging disconnected tools. A recent product launch failure highlighted how the lack of a single source of truth leads to team misalignment and shipping with known bugs. Her core need is a unified workspace where research flows directly into decision-making.',
    keyQuotes: [
      '"I spend more time managing tools than actually doing work."',
      '"I\'m the human glue between all these tools and it\'s exhausting."',
      '"We shipped with three known bugs because the feedback loop was broken."',
      '"I just want one place where research, design decisions, and product specs all live together."',
      '"I want to stop being the bottleneck."'
    ],
    painPoints: [
      'Excessive context switching between 12+ tabs and tools daily',
      'No single source of truth for research, design specs, and decisions',
      'Manual synchronization causing outdated documentation at critical moments',
      'Morning catch-up ritual consumes 30-40 minutes before productive work begins',
      'Research share-out prep takes 2 hours instead of 15 minutes',
      'Broken feedback loops causing known defects to ship'
    ],
    mainThemes: [
      'Tool fragmentation',
      'Information silos',
      'Context switching overhead',
      'Manual coordination burden',
      'Research-to-decision gap'
    ],
    clusters: [
      {
        id: 'cluster-001',
        name: 'Productivity & Focus Loss',
        description: 'Recurring interruptions and overhead that prevent deep work',
        themes: ['Context switching overhead', 'Manual coordination burden'],
        insightIds: []
      },
      {
        id: 'cluster-002',
        name: 'Tool & Data Fragmentation',
        description: 'Disconnected systems leading to scattered, stale information',
        themes: ['Tool fragmentation', 'Information silos'],
        insightIds: []
      },
      {
        id: 'cluster-003',
        name: 'Research Impact Gap',
        description: 'Research is not reaching decision-makers in time or format',
        themes: ['Research-to-decision gap'],
        insightIds: []
      }
    ],
    createdAt: new Date().toISOString()
  }
};

interviews.set('mock-001', mockInterview);

export const storage = {
  getInterview: (id: string): Interview | undefined => interviews.get(id),
  getAllInterviews: (): Interview[] => Array.from(interviews.values()),
  saveInterview: (interview: Interview): Interview => {
    interviews.set(interview.id, interview);
    return interview;
  },
  updateInterview: (id: string, updates: Partial<Interview>): Interview | null => {
    const existing = interviews.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates };
    interviews.set(id, updated);
    return updated;
  },
  deleteInterview: (id: string): boolean => interviews.delete(id),

  getInsight: (id: string): Insight | undefined => insights.get(id),
  getAllInsights: (): Insight[] => Array.from(insights.values()),
  getInsightsByInterview: (interviewId: string): Insight[] =>
    Array.from(insights.values()).filter(i => i.interviewId === interviewId),
  saveInsight: (insight: Insight): Insight => {
    insights.set(insight.id, insight);
    return insight;
  },
  updateInsight: (id: string, updates: Partial<Insight>): Insight | null => {
    const existing = insights.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates };
    insights.set(id, updated);
    return updated;
  },

  getProblemsAnalysis: (): ProblemsAnalysis | null => currentProblemsAnalysis,
  saveProblemsAnalysis: (analysis: ProblemsAnalysis): ProblemsAnalysis => {
    currentProblemsAnalysis = analysis;
    return analysis;
  },

  getBriefing: (): Briefing | null => currentBriefing,
  saveBriefing: (briefing: Briefing): Briefing => {
    currentBriefing = briefing;
    return briefing;
  },

  getDecision: (id: string): Decision | undefined => decisions.get(id),
  getAllDecisions: (): Decision[] =>
    Array.from(decisions.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ),
  saveDecision: (decision: Decision): Decision => {
    decisions.set(decision.id, decision);
    return decision;
  },
  updateDecision: (id: string, updates: Partial<Decision>): Decision | null => {
    const existing = decisions.get(id);
    if (!existing) return null;
    const now = new Date().toISOString();
    const updated: Decision = { ...existing, ...updates, updatedAt: now };
    if (updates.status && updates.status !== existing.status) {
      updated.statusHistory = [
        ...(existing.statusHistory ?? []),
        { status: updates.status, changedAt: now }
      ];
    }
    decisions.set(id, updated);
    return updated;
  },
  deleteDecision: (id: string): boolean => decisions.delete(id)
};
