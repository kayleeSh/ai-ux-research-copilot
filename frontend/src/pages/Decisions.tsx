import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { Decision, Interview } from '../types';

// ── Config ────────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<Decision['status'], string> = {
  draft:       'Draft',
  open:        'Open',
  in_progress: 'In Progress',
  decided:     'Decided',
  rejected:    'Rejected',
  deferred:    'Deferred',
  archived:    'Archived',
};

const STATUS_BORDER: Record<Decision['status'], string> = {
  draft:       '#d1d5db',
  open:        '#f59e0b',
  in_progress: '#3b82f6',
  decided:     '#059669',
  rejected:    '#dc2626',
  deferred:    '#8b5cf6',
  archived:    '#9ca3af',
};

const STATUS_STYLE: Record<Decision['status'], React.CSSProperties> = {
  draft:       { background: '#f3f4f6', color: '#6b7280' },
  open:        { background: '#fffbeb', color: '#b45309' },
  in_progress: { background: '#eff6ff', color: '#1d4ed8' },
  decided:     { background: '#f0fdf4', color: '#166534' },
  rejected:    { background: '#fef2f2', color: '#991b1b' },
  deferred:    { background: '#f5f3ff', color: '#6d28d9' },
  archived:    { background: '#f3f4f6', color: '#9ca3af' },
};

const PRIORITY_TAG: Record<Decision['priority'], string> = {
  high:   'tag-red',
  medium: 'tag-yellow',
  low:    'tag-gray',
};

const SIDEBAR_ITEMS: { id: string; label: string; icon: string }[] = [
  { id: 'all',         label: 'All Decisions', icon: '📋' },
  { id: 'open',        label: 'Open',          icon: '🔴' },
  { id: 'in_progress', label: 'In Progress',   icon: '🔵' },
  { id: 'decided',     label: 'Decided',       icon: '🟢' },
  { id: 'deferred',    label: 'Deferred',      icon: '🟣' },
  { id: 'rejected',    label: 'Rejected',      icon: '⚫' },
  { id: 'draft',       label: 'Draft',         icon: '📝' },
  { id: 'archived',    label: 'Archived',      icon: '🗃' },
];

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)   return 'just now';
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ── Generate Modal ─────────────────────────────────────────────────────────────

function GenerateModal({
  interviews, onClose, onGenerated,
}: {
  interviews: Interview[];
  onClose: () => void;
  onGenerated: (d: Decision[]) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [running, setRunning]   = useState(false);
  const [error, setError]       = useState('');

  const toggle = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const handleGenerate = async () => {
    if (selected.size === 0) return;
    setRunning(true); setError('');
    try {
      const result = await api.generateDecisions(Array.from(selected));
      onGenerated(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Generation failed');
      setRunning(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={running ? undefined : onClose}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 520, boxShadow: '0 20px 60px rgba(0,0,0,0.18)', padding: '28px 32px', maxHeight: '85vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Generate Decisions from Research</h2>
            <p style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: 3 }}>AI will analyze your research and create actionable decision drafts</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#9ca3af', padding: 4, lineHeight: 1 }}>✕</button>
        </div>
        {error && <div className="error-msg">{error}</div>}
        <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#4b5563', marginBottom: 10 }}>Select Interviews</div>
        {interviews.length === 0 ? (
          <div className="empty-state" style={{ padding: '24px 0' }}>
            <p>No analyzed interviews found.</p>
            <Link to="/upload" className="btn btn-primary btn-sm" style={{ marginTop: 8 }}>Go to Research Hub</Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {interviews.map(iv => (
              <label key={iv.id} className={`interview-checkbox ${selected.has(iv.id) ? 'selected' : ''}`}>
                <input type="checkbox" checked={selected.has(iv.id)} onChange={() => toggle(iv.id)} style={{ accentColor: '#4f46e5' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{iv.title}</div>
                  <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: 2 }}>
                    {iv.aiResult?.mainThemes?.length ?? 0} themes · {iv.aiResult?.painPoints?.length ?? 0} pain points
                  </div>
                </div>
              </label>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="btn btn-primary" onClick={handleGenerate} disabled={selected.size === 0 || running}>
            {running ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Generating…</> : `✨ Generate from ${selected.size > 0 ? selected.size : ''} Interview${selected.size !== 1 ? 's' : ''} →`}
          </button>
          <button className="btn btn-ghost" onClick={onClose} disabled={running}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── New Decision Modal ─────────────────────────────────────────────────────────

function NewDecisionModal({ onClose, onCreated }: { onClose: () => void; onCreated: (d: Decision) => void }) {
  const [title, setTitle]       = useState('');
  const [priority, setPriority] = useState<Decision['priority']>('medium');
  const [note, setNote]         = useState('');
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  const handleCreate = async () => {
    if (!title.trim()) { setError('Title is required'); return; }
    setSaving(true);
    try {
      const d = await api.createDecision({ title, priority, note, status: 'open', sourceType: 'manual' });
      onCreated(d);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create');
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.18)', padding: '28px 32px' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>New Decision</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#9ca3af', padding: 4, lineHeight: 1 }}>✕</button>
        </div>
        {error && <div className="error-msg">{error}</div>}
        <div className="form-group">
          <label>Decision Title *</label>
          <input type="text" placeholder="e.g. Redesign onboarding to reduce context switching" value={title} onChange={e => setTitle(e.target.value)} autoFocus />
        </div>
        <div className="form-group">
          <label>Priority</label>
          <select value={priority} onChange={e => setPriority(e.target.value as Decision['priority'])}
            style={{ width: '100%', padding: '9px 13px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.875rem', fontFamily: 'inherit', background: '#fff', color: '#111827' }}>
            <option value="high">High — Core workflow impact</option>
            <option value="medium">Medium — UX improvement</option>
            <option value="low">Low — Nice to have</option>
          </select>
        </div>
        <div className="form-group">
          <label>Context / Rationale</label>
          <textarea placeholder="What research finding led to this decision?" value={note} onChange={e => setNote(e.target.value)} style={{ minHeight: '90px' }} />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-primary" onClick={handleCreate} disabled={saving || !title.trim()}>{saving ? 'Creating…' : 'Create Decision'}</button>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Decision Card ──────────────────────────────────────────────────────────────

function DecisionCard({
  decision, onUpdate, onDelete,
}: {
  decision: Decision;
  onUpdate: (id: string, updates: Partial<Decision>) => Promise<void>;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing]           = useState(false);
  const [editTitle, setEditTitle]       = useState(decision.title);
  const [editNote, setEditNote]         = useState(decision.note);
  const [editOwner, setEditOwner]       = useState(decision.owner);
  const [editDue, setEditDue]           = useState(decision.dueDate);
  const [editPriority, setEditPriority] = useState(decision.priority);
  const [showEvidence, setShowEvidence] = useState(false);
  const [saving, setSaving]             = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onUpdate(decision.id, { title: editTitle, note: editNote, owner: editOwner, dueDate: editDue, priority: editPriority });
    setEditing(false);
    setSaving(false);
  };

  const handleCancel = () => {
    setEditTitle(decision.title); setEditNote(decision.note);
    setEditOwner(decision.owner); setEditDue(decision.dueDate);
    setEditPriority(decision.priority); setEditing(false);
  };

  const setStatus = (status: Decision['status']) => onUpdate(decision.id, { status });

  const lastChange = decision.statusHistory?.length > 0
    ? decision.statusHistory[decision.statusHistory.length - 1]
    : null;

  return (
    <div className="decision-card" style={{ borderLeftColor: STATUS_BORDER[decision.status], opacity: ['rejected', 'archived'].includes(decision.status) ? 0.65 : 1 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 12 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className={`tag ${PRIORITY_TAG[editing ? editPriority : decision.priority]}`}>
            {(editing ? editPriority : decision.priority).charAt(0).toUpperCase() + (editing ? editPriority : decision.priority).slice(1)}
          </span>
          <span className="tag" style={{ ...STATUS_STYLE[decision.status], borderRadius: 100, fontSize: '0.72rem', fontWeight: 600, padding: '2px 9px' }}>
            {STATUS_LABEL[decision.status]}
          </span>
          {decision.sourceType === 'ai_generated' && <span className="tag tag-blue">✨ AI</span>}
        </div>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          {!editing && <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>✎ Edit</button>}
          <button className="btn btn-ghost btn-sm" style={{ color: '#dc2626' }} onClick={() => onDelete(decision.id)}>✕</button>
        </div>
      </div>

      {/* Source context */}
      {decision.sourceInterviewTitle && (
        <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>From:</span>
          {decision.sourceInterviewId ? (
            <Link
              to={`/workspace/${decision.sourceInterviewId}`}
              style={{ color: '#4f46e5', textDecoration: 'none', fontWeight: 500 }}
            >
              {decision.sourceInterviewTitle} →
            </Link>
          ) : (
            <span style={{ color: '#6b7280', fontWeight: 500 }}>{decision.sourceInterviewTitle}</span>
          )}
        </div>
      )}

      {/* Title */}
      {editing ? (
        <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
          style={{ width: '100%', fontWeight: 600, fontSize: '0.95rem', marginBottom: 10, border: '1px solid #d1d5db', borderRadius: 6, padding: '6px 10px', fontFamily: 'inherit', color: '#111827' }} />
      ) : (
        <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#111827', marginBottom: 8, lineHeight: 1.45 }}>{decision.title}</h3>
      )}

      {/* Note */}
      {editing ? (
        <textarea className="edit-area" value={editNote} onChange={e => setEditNote(e.target.value)} rows={3} placeholder="Add rationale or context…" style={{ marginBottom: 10 }} />
      ) : decision.note ? (
        <p style={{ fontSize: '0.875rem', color: '#4b5563', lineHeight: 1.65, marginBottom: 10 }}>{decision.note}</p>
      ) : null}

      {/* Evidence quotes */}
      {decision.evidenceQuotes.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <button onClick={() => setShowEvidence(v => !v)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.78rem', color: '#6b7280', padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
            💬 {decision.evidenceQuotes.length} evidence quote{decision.evidenceQuotes.length !== 1 ? 's' : ''} {showEvidence ? '▲' : '▼'}
          </button>
          {showEvidence && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {decision.evidenceQuotes.map((q, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div className="report-quote" style={{ fontSize: '0.8rem', padding: '6px 12px', flex: 1 }}>{q}</div>
                  {decision.sourceInterviewId && (
                    <Link to={`/workspace/${decision.sourceInterviewId}`} className="btn btn-ghost btn-sm" style={{ flexShrink: 0, fontSize: '0.72rem' }}>
                      View →
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Owner · Due · Priority (edit mode) */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: '0.7rem', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Owner</span>
          {editing ? (
            <input type="text" value={editOwner} onChange={e => setEditOwner(e.target.value)} placeholder="Assignee"
              style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '3px 8px', fontSize: '0.8rem', width: 120, fontFamily: 'inherit' }} />
          ) : (
            <span style={{ fontSize: '0.8rem', color: decision.owner ? '#374151' : '#9ca3af' }}>{decision.owner || 'Unassigned'}</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: '0.7rem', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Due</span>
          {editing ? (
            <input type="date" value={editDue} onChange={e => setEditDue(e.target.value)}
              style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '3px 8px', fontSize: '0.8rem', fontFamily: 'inherit' }} />
          ) : (
            <span style={{ fontSize: '0.8rem', color: decision.dueDate ? '#374151' : '#9ca3af' }}>
              {decision.dueDate ? new Date(decision.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'No due date'}
            </span>
          )}
        </div>
        {editing && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: '0.7rem', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Priority</span>
            <select value={editPriority} onChange={e => setEditPriority(e.target.value as Decision['priority'])}
              style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '3px 8px', fontSize: '0.8rem', fontFamily: 'inherit' }}>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        )}
      </div>

      {/* Action buttons */}
      {editing ? (
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
          <button className="btn btn-ghost btn-sm" onClick={handleCancel}>Cancel</button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {decision.status === 'draft' && <button className="btn btn-ghost btn-sm" onClick={() => setStatus('open')}>→ Open</button>}
          {['open', 'in_progress'].includes(decision.status) && (
            <>
              <button className="btn btn-success btn-sm" onClick={() => setStatus('decided')}>✓ Decide</button>
              <button className="btn btn-warning btn-sm" onClick={() => setStatus('deferred')}>⏸ Defer</button>
              <button className="btn btn-danger btn-sm" onClick={() => setStatus('rejected')}>✗ Reject</button>
            </>
          )}
          {decision.status === 'open' && <button className="btn btn-secondary btn-sm" onClick={() => setStatus('in_progress')}>→ In Progress</button>}
          {['decided', 'rejected'].includes(decision.status) && <button className="btn btn-ghost btn-sm" onClick={() => setStatus('open')}>↺ Reopen</button>}
          {decision.status === 'deferred' && (
            <>
              <button className="btn btn-success btn-sm" onClick={() => setStatus('decided')}>✓ Decide</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setStatus('open')}>↺ Reopen</button>
            </>
          )}
          {['decided', 'rejected', 'deferred'].includes(decision.status) && (
            <button className="btn btn-ghost btn-sm" style={{ color: '#9ca3af' }} onClick={() => setStatus('archived')}>🗃 Archive</button>
          )}
          {decision.status === 'archived' && <button className="btn btn-ghost btn-sm" onClick={() => setStatus('open')}>↺ Restore</button>}

          {/* Status history timestamp */}
          {lastChange && (
            <span style={{ fontSize: '0.72rem', color: '#9ca3af', marginLeft: 'auto' }}>
              {STATUS_LABEL[lastChange.status as Decision['status']]} · {timeAgo(lastChange.changedAt)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function Decisions() {
  const [decisions, setDecisions]       = useState<Decision[]>([]);
  const [interviews, setInterviews]     = useState<Interview[]>([]);
  const [loading, setLoading]           = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');
  const [showGenerate, setShowGenerate] = useState(false);
  const [showNew, setShowNew]           = useState(false);

  const load = useCallback(async () => {
    const [d, iv] = await Promise.all([api.getDecisions(), api.getInterviews()]);
    setDecisions(d);
    setInterviews(iv.filter(i => !!i.aiResult));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleUpdate = async (id: string, updates: Partial<Decision>) => {
    const updated = await api.updateDecision(id, updates);
    setDecisions(prev => prev.map(d => d.id === id ? updated : d));
  };

  const handleDelete = async (id: string) => {
    await api.deleteDecision(id);
    setDecisions(prev => prev.filter(d => d.id !== id));
  };

  const handleGenerated = (newDecisions: Decision[]) => {
    setDecisions(prev => [...newDecisions, ...prev]);
    setShowGenerate(false);
  };

  const handleCreated = (decision: Decision) => {
    setDecisions(prev => [decision, ...prev]);
    setShowNew(false);
  };

  // Stats
  const total    = decisions.length;
  const open     = decisions.filter(d => d.status === 'open').length;
  const inProg   = decisions.filter(d => d.status === 'in_progress').length;
  const decided  = decisions.filter(d => d.status === 'decided').length;
  const deferred = decisions.filter(d => d.status === 'deferred').length;

  // Insight coverage: insights that have a corresponding decision
  const totalInsights   = interviews.reduce((sum, iv) => {
    if (!iv.aiResult) return sum;
    return sum + iv.aiResult.painPoints.length + iv.aiResult.mainThemes.length + iv.aiResult.keyQuotes.length;
  }, 0);
  const coveredInsights = new Set(decisions.map(d => d.sourceInsightId).filter(Boolean)).size;
  const coveragePct     = totalInsights > 0 ? Math.round((coveredInsights / totalInsights) * 100) : 0;

  const countFor = (f: string) =>
    f === 'all' ? total : decisions.filter(d => d.status === f).length;

  const filtered = activeFilter === 'all'
    ? decisions
    : decisions.filter(d => d.status === activeFilter);

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><div className="spinner" /></div>;
  }

  return (
    <div className="synthesis-full-page">

      {/* Stats bar */}
      <div className="synthesis-stats-bar">
        {[
          { label: 'Total',            value: total,         icon: '📋', color: '#4f46e5' },
          { label: 'Open',             value: open,          icon: '🔴', color: '#d97706' },
          { label: 'In Progress',      value: inProg,        icon: '🔵', color: '#2563eb' },
          { label: 'Decided',          value: decided,       icon: '🟢', color: '#059669' },
          { label: 'Deferred',         value: deferred,      icon: '🟣', color: '#7c3aed' },
          { label: 'Insight Coverage', value: `${coveragePct}%`, icon: '🎯', color: '#0891b2' },
        ].map((s, i) => (
          <div key={i} className="stat-card" title={s.label === 'Insight Coverage' ? `${coveredInsights} of ${totalInsights} insights have decisions` : undefined}>
            <div className="stat-icon-wrap">{s.icon}</div>
            <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="synthesis-layout">

        {/* Sidebar */}
        <aside className="synthesis-sidebar">
          <div className="sidebar-group-label">Filter by Status</div>
          {SIDEBAR_ITEMS.map(item => {
            const count = countFor(item.id);
            return (
              <button key={item.id}
                className={`sidebar-nav-btn ${activeFilter === item.id ? 'active' : ''}`}
                onClick={() => setActiveFilter(item.id)}>
                <span>{item.icon}</span>
                <span style={{ flex: 1, textAlign: 'left' }}>{item.label}</span>
                {count > 0 && (
                  <span style={{ fontSize: '0.68rem', background: '#f3f4f6', color: '#6b7280', borderRadius: 100, padding: '1px 6px', fontWeight: 700 }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}

          <div className="sidebar-divider" />
          <button className="sidebar-nav-btn" onClick={() => setShowNew(true)}>
            <span>+</span><span>New Decision</span>
          </button>
          <div className="sidebar-divider" />
          <div className="sidebar-group-label">Navigate</div>
          <Link to="/insights" className="sidebar-nav-btn" style={{ textDecoration: 'none', color: '#6b7280' }}>
            <span>◈</span><span>Insights</span>
          </Link>
          <Link to="/synthesis" className="sidebar-nav-btn" style={{ textDecoration: 'none', color: '#6b7280' }}>
            <span>⚡</span><span>Synthesis</span>
          </Link>
        </aside>

        {/* Main */}
        <main className="synthesis-main">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
            <div>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 4 }}>Decisions Hub</h1>
              <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                Track product decisions driven by research — from insight to resolved action
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost" onClick={() => setShowGenerate(true)}>✨ Generate from Research</button>
              <button className="btn btn-primary" onClick={() => setShowNew(true)}>+ New Decision</button>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="empty-state">
              <h3>{activeFilter === 'all' ? 'No decisions yet' : `No ${STATUS_LABEL[activeFilter as Decision['status']]} decisions`}</h3>
              <p>{activeFilter === 'all' ? 'Generate decisions from your research or create one manually' : 'Try a different filter'}</p>
              {activeFilter === 'all' && (
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 12 }}>
                  <button className="btn btn-primary" onClick={() => setShowGenerate(true)}>✨ Generate from Research</button>
                  <button className="btn btn-ghost" onClick={() => setShowNew(true)}>+ New Decision</button>
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {filtered.map(d => (
                <DecisionCard key={d.id} decision={d} onUpdate={handleUpdate} onDelete={handleDelete} />
              ))}
            </div>
          )}
          <div style={{ height: 80 }} />
        </main>
      </div>

      {showGenerate && <GenerateModal interviews={interviews} onClose={() => setShowGenerate(false)} onGenerated={handleGenerated} />}
      {showNew && <NewDecisionModal onClose={() => setShowNew(false)} onCreated={handleCreated} />}
    </div>
  );
}
