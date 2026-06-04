import { useEffect, useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { Interview } from '../types';

type Status = 'pending' | 'approved' | 'rejected';

interface FlatInsight {
  id: string;
  content: string;
  type: 'pain_point' | 'theme' | 'quote';
  interviewId: string;
}

const TYPE_LABEL: Record<string, string> = {
  pain_point: 'Pain Point',
  theme: 'Theme',
  quote: 'Key Quote'
};

const TYPE_COLOR: Record<string, string> = {
  pain_point: 'tag-red',
  theme: 'tag-purple',
  quote: 'tag-blue'
};

function buildInsights(interview: Interview): FlatInsight[] {
  if (!interview.aiResult) return [];
  const { painPoints, mainThemes, keyQuotes } = interview.aiResult;
  return [
    ...painPoints.map((p, i) => ({ id: `${interview.id}-pain-${i}`, content: p, type: 'pain_point' as const, interviewId: interview.id })),
    ...mainThemes.map((t, i) => ({ id: `${interview.id}-theme-${i}`, content: t, type: 'theme' as const, interviewId: interview.id })),
    ...keyQuotes.map((q, i) => ({ id: `${interview.id}-quote-${i}`, content: q, type: 'quote' as const, interviewId: interview.id }))
  ];
}

interface DashboardStats {
  interviews: number;
  totalInsights: number;
  painPoints: number;
  themes: number;
  quotes: number;
  approved: number;
  pending: number;
  rejected: number;
}

function InsightsStatsBar({ stats }: { stats: DashboardStats }) {
  const cards = [
    { label: 'Interviews',   value: stats.interviews,   icon: '👥', color: '#4f46e5' },
    { label: 'Total Insights', value: stats.totalInsights, icon: '💡', color: '#0369a1' },
    { label: 'Pain Points',  value: stats.painPoints,   icon: '⚡', color: '#dc2626' },
    { label: 'Themes',       value: stats.themes,       icon: '🏷️', color: '#7c3aed' },
    { label: 'Key Quotes',   value: stats.quotes,       icon: '💬', color: '#0891b2' },
    { label: 'Approved',     value: stats.approved,     icon: '✓',  color: '#059669' },
    { label: 'Pending',      value: stats.pending,      icon: '⏳', color: '#d97706' },
    { label: 'Rejected',     value: stats.rejected,     icon: '✗',  color: '#dc2626' },
  ];

  return (
    <div className="synthesis-stats-bar">
      {cards.map((c, i) => (
        <div key={i} className="stat-card">
          <div className="stat-icon-wrap">{c.icon}</div>
          <div className="stat-value" style={{ color: c.color }}>{c.value}</div>
          <div className="stat-label">{c.label}</div>
        </div>
      ))}
    </div>
  );
}

function StatusDots({ approved, rejected, pending }: { approved: number; rejected: number; pending: number }) {
  return (
    <div style={{ display: 'flex', gap: 4, marginLeft: 'auto', flexShrink: 0 }}>
      {approved > 0 && (
        <span style={{ fontSize: '0.62rem', background: '#f0fdf4', color: '#15803d', borderRadius: 100, padding: '1px 5px', fontWeight: 700 }}>
          {approved}✓
        </span>
      )}
      {rejected > 0 && (
        <span style={{ fontSize: '0.62rem', background: '#fef2f2', color: '#dc2626', borderRadius: 100, padding: '1px 5px', fontWeight: 700 }}>
          {rejected}✗
        </span>
      )}
      {pending > 0 && (
        <span style={{ fontSize: '0.62rem', background: '#fffbeb', color: '#b45309', borderRadius: 100, padding: '1px 5px', fontWeight: 700 }}>
          {pending}
        </span>
      )}
    </div>
  );
}

export default function Insights() {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [statuses, setStatuses] = useState<Record<string, Status>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [activeId, setActiveId] = useState<string>('all');
  const mainRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.getInterviews()
      .then(data => setInterviews(data))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (interviews.length === 0) return;
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(e => { if (e.isIntersecting) setActiveId(e.target.id); });
      },
      { root: mainRef.current, threshold: 0.25 }
    );
    interviews.forEach(iv => {
      const el = document.getElementById(iv.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [interviews]);

  const scrollTo = useCallback((id: string) => {
    if (id === 'all') {
      mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      setActiveId('all');
    } else {
      const el = document.getElementById(id);
      if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); setActiveId(id); }
    }
  }, []);

  const getStatus = (id: string): Status => statuses[id] ?? 'pending';
  const setStatus = (id: string, s: Status) => setStatuses(prev => ({ ...prev, [id]: s }));

  const startEdit = (insight: FlatInsight) => {
    setEditingId(insight.id);
    setEditContent(overrides[insight.id] ?? insight.content);
  };

  const commitEdit = (id: string) => {
    setOverrides(prev => ({ ...prev, [id]: editContent }));
    setEditingId(null);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <div className="spinner" />
      </div>
    );
  }

  if (interviews.length === 0) {
    return (
      <div className="insights-page">
        <h1>Insights</h1>
        <div className="empty-state">
          <h3>No interviews yet</h3>
          <p>Upload a transcript to generate insights</p>
          <Link to="/upload" className="btn btn-primary">Upload Interview</Link>
        </div>
      </div>
    );
  }

  const analyzedInterviews = interviews.filter(iv => !!iv.aiResult && buildInsights(iv).length > 0);

  const allInsights = analyzedInterviews.flatMap(iv => buildInsights(iv));
  const stats: DashboardStats = {
    interviews:    analyzedInterviews.length,
    totalInsights: allInsights.length,
    painPoints:    allInsights.filter(i => i.type === 'pain_point').length,
    themes:        allInsights.filter(i => i.type === 'theme').length,
    quotes:        allInsights.filter(i => i.type === 'quote').length,
    approved:      allInsights.filter(i => getStatus(i.id) === 'approved').length,
    pending:       allInsights.filter(i => getStatus(i.id) === 'pending').length,
    rejected:      allInsights.filter(i => getStatus(i.id) === 'rejected').length,
  };

  return (
    <div className="synthesis-full-page">
      <InsightsStatsBar stats={stats} />
      <div className="synthesis-layout">

        {/* ── Sidebar ── */}
        <aside className="synthesis-sidebar">
          <div className="sidebar-group-label">Interviews</div>

          <button
            className={`sidebar-nav-btn ${activeId === 'all' ? 'active' : ''}`}
            onClick={() => scrollTo('all')}
          >
            <span>📋</span>
            <span>All Interviews</span>
          </button>

          <div className="sidebar-divider" />

          {analyzedInterviews.map(iv => {
            const insights = buildInsights(iv);
            const approvedCount = insights.filter(i => getStatus(i.id) === 'approved').length;
            const rejectedCount = insights.filter(i => getStatus(i.id) === 'rejected').length;
            const pendingCount  = insights.filter(i => getStatus(i.id) === 'pending').length;

            return (
              <button
                key={iv.id}
                className={`sidebar-nav-btn ${activeId === iv.id ? 'active' : ''}`}
                onClick={() => scrollTo(iv.id)}
                title={iv.title}
              >
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' }}>
                  {iv.title}
                </span>
                <StatusDots approved={approvedCount} rejected={rejectedCount} pending={pendingCount} />
              </button>
            );
          })}

          <div className="sidebar-divider" />

          <Link
            to="/upload"
            className="sidebar-nav-btn"
            style={{ textDecoration: 'none', color: '#6b7280' }}
          >
            <span>+</span><span>New Interview</span>
          </Link>
        </aside>

        {/* ── Main content ── */}
        <main className="synthesis-main" ref={mainRef}>
          <div className="page-header" style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Insights</h1>
            <Link to="/upload" className="btn btn-primary btn-sm">+ New Interview</Link>
          </div>

          {analyzedInterviews.map(interview => {
            const insights = buildInsights(interview);
            const approvedCount = insights.filter(i => getStatus(i.id) === 'approved').length;
            const rejectedCount = insights.filter(i => getStatus(i.id) === 'rejected').length;
            const pendingCount  = insights.filter(i => getStatus(i.id) === 'pending').length;

            return (
              <div key={interview.id} id={interview.id} className="interview-section" style={{ scrollMarginTop: 20 }}>
                <div className="interview-section-header">
                  <h2>{interview.title}</h2>
                  <div className="interview-section-actions">
                    {approvedCount > 0 && <span className="tag tag-green">{approvedCount} approved</span>}
                    {rejectedCount > 0 && <span className="tag tag-red">{rejectedCount} rejected</span>}
                    {pendingCount > 0  && <span className="tag tag-yellow">{pendingCount} pending</span>}
                    <Link to={`/workspace/${interview.id}`} className="btn btn-ghost btn-sm">Workspace</Link>
                    <Link to={`/report/${interview.id}`} className="btn btn-secondary btn-sm">Report →</Link>
                  </div>
                </div>

                {insights.map(insight => {
                  const status = getStatus(insight.id);
                  const isEditing = editingId === insight.id;
                  const content = overrides[insight.id] ?? insight.content;

                  return (
                    <div key={insight.id} className={`insight-card ${status}`}>
                      <div className="insight-body">
                        <div className="insight-meta">
                          <span className={`tag ${TYPE_COLOR[insight.type]}`}>
                            {TYPE_LABEL[insight.type]}
                          </span>
                          <span className={`tag status-${status}`}>{status}</span>
                        </div>
                        {isEditing ? (
                          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                            <textarea
                              className="edit-area"
                              value={editContent}
                              onChange={e => setEditContent(e.target.value)}
                              rows={2}
                              style={{ flex: 1 }}
                              autoFocus
                            />
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              <button className="btn btn-success btn-sm" onClick={() => commitEdit(insight.id)}>
                                Save
                              </button>
                              <button className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)}>
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="insight-content">{content}</div>
                        )}
                      </div>

                      {!isEditing && (
                        <div className="insight-actions">
                          <button
                            className="btn btn-success btn-sm"
                            onClick={() => setStatus(insight.id, 'approved')}
                            disabled={status === 'approved'}
                            title="Approve"
                          >
                            ✓
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => setStatus(insight.id, 'rejected')}
                            disabled={status === 'rejected'}
                            title="Reject"
                          >
                            ✗
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => startEdit(insight)}
                            title="Edit"
                          >
                            ✎
                          </button>
                          {status !== 'pending' && (
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => setStatus(insight.id, 'pending')}
                              title="Reset to pending"
                            >
                              ↺
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}

          <div style={{ height: 80 }} />
        </main>
      </div>
    </div>
  );
}
