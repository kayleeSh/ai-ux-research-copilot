import { useEffect, useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { Interview, Decision } from '../types';
import { NextStepBanner } from '../components/NextStepBanner';

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
  theme:      'tag-purple',
  quote:      'tag-blue'
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

function StatusDots({ approved, rejected, pending }: { approved: number; rejected: number; pending: number }) {
  return (
    <div style={{ display: 'flex', gap: 4, marginLeft: 'auto', flexShrink: 0 }}>
      {approved > 0 && <span style={{ fontSize: '0.62rem', background: '#f0fdf4', color: '#15803d', borderRadius: 100, padding: '1px 5px', fontWeight: 700 }}>{approved}✓</span>}
      {rejected > 0 && <span style={{ fontSize: '0.62rem', background: '#fef2f2', color: '#dc2626', borderRadius: 100, padding: '1px 5px', fontWeight: 700 }}>{rejected}✗</span>}
      {pending > 0  && <span style={{ fontSize: '0.62rem', background: '#fffbeb', color: '#b45309', borderRadius: 100, padding: '1px 5px', fontWeight: 700 }}>{pending}</span>}
    </div>
  );
}

// ── Create Decision from Insight Modal ────────────────────────────────────────

function DecisionFromInsightModal({
  insight,
  interview,
  onClose,
  onCreated,
}: {
  insight: FlatInsight;
  interview: Interview;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle]       = useState('');
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>(insight.type === 'pain_point' ? 'high' : 'medium');
  const [note, setNote]         = useState(insight.content);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  const handleCreate = async () => {
    if (!title.trim()) { setError('Title is required'); return; }
    setSaving(true);
    try {
      await api.createDecision({
        title,
        priority,
        note,
        status: 'under_discussion',
        sourceType: 'ai_generated',
        sourceInterviewId:    interview.id,
        sourceInterviewTitle: interview.title,
        sourceInsightId:      insight.id,
        evidenceQuotes:       [insight.content],
      });
      onCreated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create');
      setSaving(false);
    }
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={onClose}
    >
      <div
        style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 500, boxShadow: '0 20px 60px rgba(0,0,0,0.18)', padding: '28px 32px' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Create Decision from Insight</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#9ca3af', padding: 4, lineHeight: 1 }}>✕</button>
        </div>
        <p style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: 18 }}>
          From: <span style={{ color: '#0d9488', fontWeight: 500 }}>{interview.title}</span>
        </p>

        {/* Source insight preview */}
        <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9ca3af', marginBottom: 4 }}>
            {TYPE_LABEL[insight.type]}
          </div>
          <p style={{ fontSize: '0.85rem', color: '#374151', lineHeight: 1.5, margin: 0 }}>{insight.content}</p>
        </div>

        {error && <div className="error-msg">{error}</div>}

        <div className="form-group">
          <label>Decision Title *</label>
          <input
            type="text"
            placeholder="e.g. Address onboarding friction to reduce drop-off"
            value={title}
            onChange={e => setTitle(e.target.value)}
            autoFocus
          />
        </div>

        <div className="form-group">
          <label>Priority</label>
          <select value={priority} onChange={e => setPriority(e.target.value as 'high' | 'medium' | 'low')}
            style={{ width: '100%', padding: '9px 13px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.875rem', fontFamily: 'inherit', background: '#fff', color: '#111827' }}>
            <option value="high">High — Core workflow impact</option>
            <option value="medium">Medium — UX improvement</option>
            <option value="low">Low — Nice to have</option>
          </select>
        </div>

        <div className="form-group">
          <label>Decision Note</label>
          <textarea value={note} onChange={e => setNote(e.target.value)} style={{ minHeight: '80px' }} />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-primary" onClick={handleCreate} disabled={saving || !title.trim()}>
            {saving ? 'Creating…' : '+ Create Decision'}
          </button>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

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
    { label: 'Interviews',    value: stats.interviews,   icon: '👥', color: '#111827' },
    { label: 'Total Insights', value: stats.totalInsights, icon: '💡', color: '#111827' },
    { label: 'Pain Points',   value: stats.painPoints,   icon: '›',  color: '#111827' },
    { label: 'Themes',        value: stats.themes,       icon: '🏷️', color: '#111827' },
    { label: 'Key Quotes',    value: stats.quotes,       icon: '💬', color: '#111827' },
    { label: 'Approved',      value: stats.approved,     icon: '✓',  color: '#111827' },
    { label: 'Pending',       value: stats.pending,      icon: '○',  color: '#111827' },
    { label: 'Rejected',      value: stats.rejected,     icon: '✕',  color: '#111827' },
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

export default function Insights() {
  const [interviews, setInterviews]   = useState<Interview[]>([]);
  const [decisions, setDecisions]     = useState<Decision[]>([]);
  const [loading, setLoading]         = useState(true);
  const [statuses, setStatuses]       = useState<Record<string, Status>>({});
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [overrides, setOverrides]     = useState<Record<string, string>>({});
  const [activeId, setActiveId]       = useState<string>('all');
  const [pendingDecisionInsight, setPendingDecisionInsight] = useState<FlatInsight | null>(null);
  const [decisionCreatedFor, setDecisionCreatedFor] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<'all' | 'pain_point' | 'theme' | 'quote'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const mainRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([api.getInterviews(), api.getDecisions()])
      .then(([iv, d]) => { setInterviews(iv); setDecisions(d); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (interviews.length === 0) return;
    const observer = new IntersectionObserver(
      entries => { entries.forEach(e => { if (e.isIntersecting) setActiveId(e.target.id); }); },
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

  const handleDecisionCreated = () => {
    if (pendingDecisionInsight) {
      setDecisionCreatedFor(prev => new Set([...prev, pendingDecisionInsight.id]));
    }
    setPendingDecisionInsight(null);
    // Refresh decisions count
    api.getDecisions().then(setDecisions);
  };

  // Decision count per interview
  const decisionCountByInterview = decisions.reduce<Record<string, number>>((acc, d) => {
    if (d.sourceInterviewId) acc[d.sourceInterviewId] = (acc[d.sourceInterviewId] ?? 0) + 1;
    return acc;
  }, {});

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><div className="spinner" /></div>;
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

        {/* Sidebar */}
        <aside className="synthesis-sidebar">
          <div className="sidebar-group-label">Interviews</div>

          <button className={`sidebar-nav-btn ${activeId === 'all' ? 'active' : ''}`} onClick={() => scrollTo('all')}>
            <span>📋</span><span>All Interviews</span>
          </button>

          <div className="sidebar-divider" />

          {analyzedInterviews.map(iv => {
            const insights = buildInsights(iv);
            const approvedCount = insights.filter(i => getStatus(i.id) === 'approved').length;
            const rejectedCount = insights.filter(i => getStatus(i.id) === 'rejected').length;
            const pendingCount  = insights.filter(i => getStatus(i.id) === 'pending').length;
            const dCount        = decisionCountByInterview[iv.id] ?? 0;

            return (
              <button key={iv.id}
                className={`sidebar-nav-btn ${activeId === iv.id ? 'active' : ''}`}
                onClick={() => scrollTo(iv.id)}
                title={iv.title}>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' }}>
                  {iv.title}
                </span>
                <StatusDots approved={approvedCount} rejected={rejectedCount} pending={pendingCount} />
                {dCount > 0 && (
                  <span style={{ fontSize: '0.62rem', background: '#eff6ff', color: '#1d4ed8', borderRadius: 100, padding: '1px 5px', fontWeight: 700, marginLeft: 2 }}>
                    {dCount}D
                  </span>
                )}
              </button>
            );
          })}

          <div className="sidebar-divider" />
          <Link to="/upload" className="sidebar-nav-btn" style={{ textDecoration: 'none', color: '#6b7280' }}>
            <span>+</span><span>New Interview</span>
          </Link>
        </aside>

        {/* Main */}
        <main className="synthesis-main" ref={mainRef}>
          <div className="page-header" style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Insights</h1>
            <Link to="/upload" className="btn btn-primary btn-sm">+ New Interview</Link>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Search insights…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ flex: 1, minWidth: 180, padding: '7px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.875rem', fontFamily: 'inherit', color: '#111827' }}
            />
            {(['all', 'pain_point', 'theme', 'quote'] as const).map(type => (
              <button
                key={type}
                className={`tab-btn ${filterType === type ? 'active' : ''}`}
                onClick={() => setFilterType(type)}
              >
                {type === 'all' ? 'All' : TYPE_LABEL[type]}
              </button>
            ))}
          </div>

          {analyzedInterviews.map(interview => {
            const rawInsights = buildInsights(interview);
            const insights = rawInsights
              .filter(i => filterType === 'all' || i.type === filterType)
              .filter(i => !searchQuery.trim() || (overrides[i.id] ?? i.content).toLowerCase().includes(searchQuery.toLowerCase()));
            if (insights.length === 0) return null;
            const approvedCount = rawInsights.filter(i => getStatus(i.id) === 'approved').length;
            const rejectedCount = rawInsights.filter(i => getStatus(i.id) === 'rejected').length;
            const pendingCount  = rawInsights.filter(i => getStatus(i.id) === 'pending').length;
            const dCount        = decisionCountByInterview[interview.id] ?? 0;

            return (
              <div key={interview.id} id={interview.id} className="interview-section" style={{ scrollMarginTop: 20 }}>
                <div className="interview-section-header">
                  <h2>{interview.title}</h2>
                  <div className="interview-section-actions">
                    {approvedCount > 0 && <span className="tag tag-green">{approvedCount} approved</span>}
                    {rejectedCount > 0 && <span className="tag tag-red">{rejectedCount} rejected</span>}
                    {pendingCount  > 0 && <span className="tag tag-yellow">{pendingCount} pending</span>}
                    {dCount > 0 && (
                      <Link to="/decisions" className="tag tag-blue" style={{ textDecoration: 'none', cursor: 'pointer' }}>
                        {dCount} decision{dCount !== 1 ? 's' : ''}
                      </Link>
                    )}
                    <Link to={`/workspace/${interview.id}`} className="btn btn-ghost btn-sm">Workspace</Link>
                    <Link to={`/report/${interview.id}`} className="btn btn-secondary btn-sm">Report →</Link>
                  </div>
                </div>

                {insights.map(insight => {
                  const status    = getStatus(insight.id);
                  const isEditing = editingId === insight.id;
                  const content   = overrides[insight.id] ?? insight.content;
                  const hasDecision = decisionCreatedFor.has(insight.id);

                  return (
                    <div key={insight.id} className={`insight-card ${status}`}>
                      <div className="insight-body">
                        <div className="insight-meta">
                          <span className={`tag ${TYPE_COLOR[insight.type]}`}>{TYPE_LABEL[insight.type]}</span>
                          <span className={`tag status-${status}`}>{status}</span>
                          {hasDecision && <span className="tag tag-blue">✨ Decision created</span>}
                        </div>
                        {isEditing ? (
                          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                            <textarea className="edit-area" value={editContent} onChange={e => setEditContent(e.target.value)} rows={2} style={{ flex: 1 }} autoFocus />
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              <button className="btn btn-success btn-sm" onClick={() => commitEdit(insight.id)}>Save</button>
                              <button className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <div className="insight-content">{content}</div>
                        )}
                      </div>

                      {!isEditing && (
                        <div className="insight-actions">
                          <button className="btn btn-success btn-sm" onClick={() => setStatus(insight.id, 'approved')} disabled={status === 'approved'} title="Approve">✓</button>
                          <button className="btn btn-danger btn-sm" onClick={() => setStatus(insight.id, 'rejected')} disabled={status === 'rejected'} title="Reject">✗</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => startEdit(insight)} title="Edit">✎</button>
                          {status !== 'pending' && (
                            <button className="btn btn-ghost btn-sm" onClick={() => setStatus(insight.id, 'pending')} title="Reset">↺</button>
                          )}
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => setPendingDecisionInsight(insight)}
                            title="Create Decision from this insight"
                            style={{ color: '#0d9488', borderColor: '#99f6e4' }}
                          >
                            + Decision
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}

          {(filterType !== 'all' || searchQuery.trim()) &&
            analyzedInterviews.every(iv => {
              const raw = buildInsights(iv);
              return raw
                .filter(i => filterType === 'all' || i.type === filterType)
                .filter(i => !searchQuery.trim() || (overrides[i.id] ?? i.content).toLowerCase().includes(searchQuery.toLowerCase()))
                .length === 0;
            }) && (
              <div className="empty-state">
                <h3>No insights match</h3>
                <p>Try clearing your search or changing the filter</p>
                <button className="btn btn-ghost" style={{ marginTop: 8 }} onClick={() => { setFilterType('all'); setSearchQuery(''); }}>
                  Clear filters
                </button>
              </div>
            )}

          <NextStepBanner
            icon="🔗"
            title="Synthesize across interviews"
            description="Find patterns, shared themes, and recommendations across all your interviews"
            to="/synthesis"
            buttonText="Go to Synthesis →"
          />

          <div style={{ height: 80 }} />
        </main>
      </div>

      {pendingDecisionInsight && (
        <DecisionFromInsightModal
          insight={pendingDecisionInsight}
          interview={interviews.find(iv => iv.id === pendingDecisionInsight.interviewId)!}
          onClose={() => setPendingDecisionInsight(null)}
          onCreated={handleDecisionCreated}
        />
      )}
    </div>
  );
}
