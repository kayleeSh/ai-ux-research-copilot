import { Interview, AIResult, Report, SynthesisResult, Decision, ProblemsAnalysis, Briefing, Problem } from '../types';

const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
    throw new Error(err.error ?? 'Request failed');
  }
  return res.json() as Promise<T>;
}

// Read an SSE stream — calls onChunk with accumulated text, resolves when done
async function readStream(
  res: Response,
  onChunk: (accumulated: string) => void
): Promise<{ id: string; aiResult: AIResult }> {
  if (!res.body) throw new Error('No response body');
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  return new Promise((resolve, reject) => {
    const pump = async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6)) as {
              type: string;
              accumulated?: string;
              id?: string;
              aiResult?: AIResult;
              message?: string;
            };
            if (event.type === 'chunk' && event.accumulated) {
              onChunk(event.accumulated);
            } else if (event.type === 'done' && event.id && event.aiResult) {
              resolve({ id: event.id, aiResult: event.aiResult });
            } else if (event.type === 'error') {
              reject(new Error(event.message ?? 'Stream error'));
            }
          } catch { /* skip malformed */ }
        }
      }
    };
    pump().catch(reject);
  });
}

export const api = {
  // ── File upload (non-streaming) ───────────────────────────────────────────
  uploadFile: async (file: File, title?: string): Promise<{ id: string; interview: Interview }> => {
    const form = new FormData();
    form.append('file', file);
    if (title) form.append('title', title);
    const res = await fetch(`${BASE}/analyze/upload`, { method: 'POST', body: form });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
      throw new Error(err.error ?? 'Upload failed');
    }
    return res.json() as Promise<{ id: string; interview: Interview }>;
  },

  // ── Non-streaming analyze (kept for file upload path) ─────────────────────
  analyzeText: (transcript: string, title?: string) =>
    request<{ id: string; interview: Interview }>('/analyze/text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript, title })
    }),

  // ── Streaming analyze — shows AI typing in real-time ──────────────────────
  analyzeTextStream: async (
    transcript: string,
    title: string | undefined,
    onChunk: (accumulated: string) => void
  ): Promise<{ id: string; aiResult: AIResult }> => {
    const res = await fetch(`${BASE}/analyze/text/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript, title })
    });
    if (!res.ok) throw new Error('Stream request failed');
    return readStream(res, onChunk);
  },

  // ── Streaming regenerate ──────────────────────────────────────────────────
  regenerateStream: async (
    id: string,
    onChunk: (accumulated: string) => void
  ): Promise<{ id: string; aiResult: AIResult }> => {
    const res = await fetch(`${BASE}/analyze/regenerate/${id}/stream`, { method: 'POST' });
    if (!res.ok) throw new Error('Regenerate stream failed');
    return readStream(res, onChunk);
  },

  // ── Non-streaming regenerate (fallback) ───────────────────────────────────
  regenerate: (id: string) =>
    request<{ aiResult: AIResult }>(`/analyze/regenerate/${id}`, { method: 'POST' }),

  // ── Interviews CRUD ───────────────────────────────────────────────────────
  getInterviews: () => request<Interview[]>('/interviews'),
  getInterview: (id: string) => request<Interview>(`/interviews/${id}`),
  updateInterview: (id: string, data: Partial<Interview>) =>
    request<Interview>(`/interviews/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }),

  // ── Cross-interview synthesis ─────────────────────────────────────────────
  synthesize: (interviewIds: string[]) =>
    request<SynthesisResult>('/analyze/synthesize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ interviewIds })
    }),

  // ── Report ────────────────────────────────────────────────────────────────
  getReport: (id: string) => request<Report>(`/report/${id}`),
  getReportMarkdown: async (id: string): Promise<string> => {
    const res = await fetch(`${BASE}/report/${id}/markdown`);
    if (!res.ok) throw new Error('Failed to download report');
    return res.text();
  },

  // ── Decisions ─────────────────────────────────────────────────────────────
  getDecisions: () =>
    request<Decision[]>('/decisions'),

  createDecision: (data: Partial<Decision>) =>
    request<Decision>('/decisions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }),

  updateDecision: (id: string, data: Partial<Decision>) =>
    request<Decision>(`/decisions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }),

  deleteDecision: (id: string) =>
    request<{ success: boolean }>(`/decisions/${id}`, { method: 'DELETE' }),

  // ── Problems ──────────────────────────────────────────────────────────────
  getProblems: () => request<ProblemsAnalysis>('/problems'),
  generateProblems: () =>
    request<ProblemsAnalysis>('/problems/generate', { method: 'POST' }),
  updateProblemStatus: (id: string, status: Problem['status']) =>
    request<Problem>(`/problems/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    }),

  // ── Briefing ──────────────────────────────────────────────────────────────
  getBriefing: () => request<Briefing>('/briefing'),
  generateBriefing: () =>
    request<Briefing>('/briefing/generate', { method: 'POST' })
};
