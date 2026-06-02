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
