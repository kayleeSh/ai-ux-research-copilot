import { Interview, Insight, Decision, Problem, ProblemsAnalysis, Briefing } from '../types';

const interviews = new Map<string, Interview>();
const insights   = new Map<string, Insight>();
const decisions  = new Map<string, Decision>();


// ── Problems & Briefing (singleton — replaced on each generation) ─────────────

let currentProblemsAnalysis: ProblemsAnalysis | null = null;

let currentBriefing: Briefing | null = null;

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
