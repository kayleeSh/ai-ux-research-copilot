export interface Interview {
  id: string;
  title: string;
  transcript: string;
  uploadedAt: string;
  fileName: string;
  aiResult?: AIResult;
}

export interface AIResult {
  id: string;
  interviewId: string;
  summary: string;
  keyQuotes: string[];
  painPoints: string[];
  mainThemes: string[];
  clusters: Cluster[];
  createdAt: string;
}

export interface Insight {
  id: string;
  interviewId: string;
  content: string;
  type: 'pain_point' | 'theme' | 'quote';
  status: 'pending' | 'approved' | 'rejected';
  clusterId?: string;
  createdAt: string;
}

export interface Cluster {
  id: string;
  name: string;
  description: string;
  themes: string[];
  insightIds: string[];
}

export interface SynthesisPattern {
  pattern: string;
  description: string;
  frequency: string;
  quotes: string[];
}

export interface SynthesisResult {
  id: string;
  interviewIds: string[];
  interviewCount: number;
  overallSummary: string;
  commonThemes: string[];
  patterns: SynthesisPattern[];
  differences: string[];
  prioritizedPainPoints: string[];
  recommendations: string[];
  createdAt: string;
}

export interface Report {
  title: string;
  fileName: string;
  uploadedAt: string;
  generatedAt: string;
  summary: string;
  keyQuotes: string[];
  painPoints: string[];
  mainThemes: string[];
  clusters: Cluster[];
}

export interface Problem {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'moderate' | 'minor';
  affectedRoles: string[];
  frequency: 'daily' | 'per_sprint' | 'occasional';
  evidenceQuotes: string[];
  parentId: string;
  sourceInterviewIds?: string[];
  sourceInterviewTitles?: string[];
  status: 'unresolved' | 'in_progress' | 'addressed';
  createdAt: string;
}

export interface ProblemsAnalysis {
  id: string;
  rootProblem: string;
  problems: Problem[];
  interviewCount: number;
  generatedAt: string;
}

export interface OKR {
  objective: string;
  keyResults: string[];
}

export interface Briefing {
  id: string;
  confidence: 'high' | 'medium' | 'low';
  problemCount: number;
  interviewCount: number;
  pm: {
    objectives: string[];
    okrs: OKR[];
    priorityStackRank: string[];
    assumptionsAndRisks: string[];
    methodsAndTools: string[];
  };
  designer: {
    userNeeds: string[];
    jobsToBeDone: string[];
    designPrinciples: string[];
    deliverables: string[];
    successCriteria: string[];
  };
  developer: {
    deliverables: string[];
    acceptanceCriteria: string[];
    technicalConstraints: string[];
    dependencies: string[];
    nonGoals: string[];
  };
  projectManager: {
    deliverables: string[];
    milestones: string[];
    dependenciesMap: string[];
    effortEstimates: string[];
    openQuestions: string[];
  };
  generatedAt: string;
}

export interface Decision {
  id: string;
  title: string;
  status: 'under_discussion' | 'decided' | 'rejected' | 'deferred';
  priority: 'high' | 'medium' | 'low';
  note: string;
  owner: string;
  dueDate: string;
  evidenceQuotes: string[];
  sourceType: 'manual' | 'ai_generated';
  sourceInterviewId: string;
  sourceInterviewTitle: string;
  sourceInsightId: string;
  sourceProblemId: string;
  sourceProblemTitle: string;
  statusHistory: Array<{ status: string; changedAt: string }>;
  createdAt: string;
  updatedAt: string;
}
