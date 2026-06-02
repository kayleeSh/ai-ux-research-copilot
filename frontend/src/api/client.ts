import { Interview, AIResult, Report } from '../types';

const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
    throw new Error(err.error ?? 'Request failed');
  }
  return res.json() as Promise<T>;
}

export const api = {
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

  analyzeText: (transcript: string, title?: string) =>
    request<{ id: string; interview: Interview }>('/analyze/text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript, title })
    }),

  regenerate: (id: string) =>
    request<{ aiResult: AIResult }>(`/analyze/regenerate/${id}`, { method: 'POST' }),

  getInterviews: () => request<Interview[]>('/interviews'),
  getInterview: (id: string) => request<Interview>(`/interviews/${id}`),

  updateInterview: (id: string, data: Partial<Interview>) =>
    request<Interview>(`/interviews/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }),

  getReport: (id: string) => request<Report>(`/report/${id}`),

  getReportMarkdown: async (id: string): Promise<string> => {
    const res = await fetch(`${BASE}/report/${id}/markdown`);
    if (!res.ok) throw new Error('Failed to download report');
    return res.text();
  }
};
