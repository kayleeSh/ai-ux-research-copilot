import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { ProblemsAnalysis, Problem } from '../types';
import { NextStepBanner } from '../components/NextStepBanner';

// ── Config ────────────────────────────────────────────────────────────────────

const SEVERITY_CONFIG: Record<Problem['severity'], { label: string; color: string; bg: string; border: string }> = {
  critical: { label: 'Critical', color: '#dc2626', bg: '#fef2f2', border: '#dc2626' },
  moderate: { label: 'Moderate', color: '#d97706', bg: '#fffbeb', border: '#f59e0b' },
  minor:    { label: 'Minor',    color: '#6b7280', bg: '#f3f4f6', border: '#d1d5db' },
};

const PROBLEM_STATUS_CONFIG: Record<Problem['status'], { label: string; color: string; bg: string; border: string }> = {
  unresolved: { label: 'Unresolved', color: '#6b7280', bg: '#f3f4f6', border: '#d1d5db' },
  in_progress: { label: 'In Progress', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  addressed:   { label: 'Addressed',   color: '#059669', bg: '#f0fdf4', border: '#bbf7d0' },
};

const FREQUENCY_LABEL: Record<Problem['frequency'], string> = {
  daily:      'Daily',
  per_sprint: 'Per Sprint',
  occasional: 'Occasional',
};

const ROLE_LABEL: Record<string, string> = {
  researcher:      'Researcher',
  pm:              'Product Manager',
  designer:        'Designer',
  developer:       'Developer',
  project_manager: 'Project Manager',
};

const ROLE_COLOR: Record<string, string> = {
  researcher:      '#4f46e5',
  pm:              '#059669',
  designer:        '#d97706',
  developer:       '#0891b2',
  project_manager: '#7c3aed',
};

type ViewMode = 'hierarchy' | 'segment' | 'priority';

// ── Log Decision Button ────────────────────────────────────────────────────────

function LogProblemButton({ problem, onStatusChange }: { problem: Problem; onStatusChange: (id: string, status: Problem['status']) => void }) {
  const [logged, setLogged]   = useState(false);
  const [logging, setLogging] = useState(false);

  if (logged) return (
    <span style={{ fontSize: '0.8rem', color: '#059669', fontWeight: 600 }}>✓ Added to Decision Log</span>
  );

  return (
    <button
      disabled={logging}
      onClick={async () => {
        setLogging(true);
        try {
          await api.createDecision({
            title:                problem.title.length > 120 ? problem.title.slice(0, 120) + '…' : problem.title,
            status:               'under_discussion',
            priority:             problem.severity === 'critical' ? 'high' : problem.severity === 'moderate' ? 'medium' : 'low',
            note:                 problem.description,
            evidenceQuotes:       problem.evidenceQuotes,
            sourceType:           'ai_generated',
            sourceInterviewTitle: problem.sourceInterviewTitles?.[0] ?? '',
            sourceProblemId:      problem.id,
            sourceProblemTitle:   problem.title,
          });
          await api.updateProblemStatus(problem.id, 'in_progress');
          onStatusChange(problem.id, 'in_progress');
          setLogged(true);
        } catch { setLogging(false); }
      }}
      style={{
        background: '#eef2ff', color: '#4f46e5', border: '1px solid #c7d2fe',
        borderRadius: 8, padding: '7px 16px', fontSize: '0.8rem', fontWeight: 600,
        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
        fontFamily: 'inherit', whiteSpace: 'nowrap',
      }}
    >
      {logging ? '…' : '◈ Log as Decision'}
    </button>
  );
}

// ── Problem Card ───────────────────────────────────────────────────────────────

function ProblemCard({ problem, isChild = false, onStatusChange }: { problem: Problem; isChild?: boolean; onStatusChange: (id: string, status: Problem['status']) => void }) {
  const [showEvidence, setShowEvidence] = useState(false);
  const cfg  = SEVERITY_CONFIG[problem.severity];
  const scfg = PROBLEM_STATUS_CONFIG[problem.status ?? 'unresolved'];

  return (
    <div
      className="problem-card"
      style={{
        borderLeftColor: cfg.border,
        marginLeft: isChild ? 28 : 0,
        marginBottom: 10,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 12 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="tag" style={{ background: cfg.bg, color: cfg.color, borderRadius: 100, fontSize: '0.72rem', fontWeight: 700, padding: '2px 9px' }}>
            {cfg.label}
          </span>
          <span className="tag tag-gray" style={{ fontSize: '0.72rem' }}>
            {FREQUENCY_LABEL[problem.frequency]}
          </span>
          {(problem.status ?? 'unresolved') !== 'unresolved' && (
            <span style={{ background: scfg.bg, color: scfg.color, border: `1px solid ${scfg.border}`, borderRadius: 100, fontSize: '0.72rem', fontWeight: 700, padding: '2px 9px' }}>
              {scfg.label}
            </span>
          )}
          {problem.affectedRoles.map(role => (
            <span key={role} className="tag" style={{ background: `${ROLE_COLOR[role]}15`, color: ROLE_COLOR[role], fontSize: '0.68rem', fontWeight: 600, padding: '2px 8px', borderRadius: 100 }}>
              {ROLE_LABEL[role] ?? role}
            </span>
          ))}
        </div>
        {isChild && (
          <span style={{ fontSize: '0.68rem', color: '#9ca3af', flexShrink: 0 }}>↳ sub-problem</span>
        )}
      </div>

      {/* Title */}
      <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#111827', marginBottom: 6, lineHeight: 1.4 }}>
        {problem.title}
      </h3>

      {/* Description */}
      <p style={{ fontSize: '0.875rem', color: '#4b5563', lineHeight: 1.65, marginBottom: 8 }}>
        {problem.description}
      </p>

      {/* Source interviews */}
      {problem.sourceInterviewTitles && problem.sourceInterviewTitles.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: '0.72rem', color: '#9ca3af', flexShrink: 0 }}>Source:</span>
          {problem.sourceInterviewTitles.map((title, i) => (
            <span
              key={i}
              style={{
                fontSize: '0.7rem',
                background: '#f0f9ff',
                color: '#0369a1',
                padding: '2px 8px',
                borderRadius: 100,
                border: '1px solid #bae6fd',
                fontWeight: 500,
              }}
            >
              📋 {title}
            </span>
          ))}
        </div>
      )}

      {/* Evidence */}
      {problem.evidenceQuotes.length > 0 && (
        <div>
          <button
            onClick={() => setShowEvidence(v => !v)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.78rem', color: '#6b7280', padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}
          >
            💬 {problem.evidenceQuotes.length} research quote{problem.evidenceQuotes.length !== 1 ? 's' : ''} {showEvidence ? '▲' : '▼'}
          </button>
          {showEvidence && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {problem.evidenceQuotes.map((q, i) => (
                <div key={i} className="report-quote" style={{ fontSize: '0.8rem', padding: '6px 12px' }}>{q}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Card footer: status actions + log button */}
      <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <div>
          {(problem.status ?? 'unresolved') === 'in_progress' && (
            <button
              onClick={async () => { await api.updateProblemStatus(problem.id, 'addressed'); onStatusChange(problem.id, 'addressed'); }}
              style={{ background: '#f0fdf4', color: '#059669', border: '1px solid #bbf7d0', borderRadius: 8, padding: '7px 14px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              ✓ Mark as Addressed
            </button>
          )}
          {(problem.status ?? 'unresolved') === 'addressed' && (
            <button
              onClick={async () => { await api.updateProblemStatus(problem.id, 'unresolved'); onStatusChange(problem.id, 'unresolved'); }}
              style={{ background: '#f3f4f6', color: '#6b7280', border: '1px solid #d1d5db', borderRadius: 8, padding: '7px 14px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              ↺ Reopen
            </button>
          )}
        </div>
        <LogProblemButton problem={problem} onStatusChange={onStatusChange} />
      </div>
    </div>
  );
}

// ── View Renderers ─────────────────────────────────────────────────────────────

type OnStatusChange = (id: string, status: Problem['status']) => void;

function HierarchyView({ problems, onStatusChange }: { problems: Problem[]; onStatusChange: OnStatusChange }) {
  const roots    = problems.filter(p => !p.parentId);
  const children = problems.filter(p => !!p.parentId);

  return (
    <>
      {roots.map(root => (
        <div key={root.id}>
          <ProblemCard problem={root} onStatusChange={onStatusChange} />
          {children
            .filter(c => c.parentId === root.id || c.parentId === root.title)
            .map(child => <ProblemCard key={child.id} problem={child} isChild onStatusChange={onStatusChange} />)
          }
        </div>
      ))}
    </>
  );
}

function SegmentView({ problems, onStatusChange }: { problems: Problem[]; onStatusChange: OnStatusChange }) {
  const allRoles = [...new Set(problems.flatMap(p => p.affectedRoles))];
  return (
    <>
      {allRoles.map(role => {
        const roleProblems = problems.filter(p => p.affectedRoles.includes(role));
        if (roleProblems.length === 0) return null;
        return (
          <div key={role} id={`role-${role}`} style={{ marginBottom: 28, scrollMarginTop: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: ROLE_COLOR[role] ?? '#9ca3af', flexShrink: 0 }} />
              <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#4b5563' }}>
                Affects: {ROLE_LABEL[role] ?? role}
              </span>
              <span style={{ fontSize: '0.72rem', color: '#9ca3af' }}>({roleProblems.length} problem{roleProblems.length !== 1 ? 's' : ''})</span>
            </div>
            {roleProblems.map(p => <ProblemCard key={`${role}-${p.id}`} problem={p} onStatusChange={onStatusChange} />)}
          </div>
        );
      })}
    </>
  );
}

function PriorityView({ problems, onStatusChange }: { problems: Problem[]; onStatusChange: OnStatusChange }) {
  const severities: Problem['severity'][] = ['critical', 'moderate', 'minor'];
  return (
    <>
      {severities.map(sev => {
        const sevProblems = problems.filter(p => p.severity === sev);
        if (sevProblems.length === 0) return null;
        const cfg = SEVERITY_CONFIG[sev];
        return (
          <div key={sev} style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, paddingBottom: 8, borderBottom: `2px solid ${cfg.border}` }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: cfg.color }}>
                {cfg.label}
              </span>
              <span style={{ fontSize: '0.72rem', color: '#9ca3af' }}>({sevProblems.length} problem{sevProblems.length !== 1 ? 's' : ''})</span>
            </div>
            {sevProblems.map((p, i) => (
              <div key={p.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: cfg.bg, border: `2px solid ${cfg.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 700, fontSize: '0.78rem', color: cfg.color }}>
                  {i + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <ProblemCard problem={p} onStatusChange={onStatusChange} />
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function Problems() {
  const [analysis, setAnalysis]   = useState<ProblemsAnalysis | null>(null);
  const [loading, setLoading]     = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError]         = useState('');
  const [viewMode, setViewMode]   = useState<ViewMode>('hierarchy');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter]         = useState<string>('all');
  const [confirmRegen, setConfirmRegen]     = useState(false);
  const [scrollTargetRole, setScrollTargetRole] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.getProblems();
      setAnalysis(data);
    } catch { /* no analysis yet */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!scrollTargetRole || viewMode !== 'segment') return;
    const timer = setTimeout(() => {
      const el = document.getElementById(`role-${scrollTargetRole}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setScrollTargetRole(null);
    }, 50);
    return () => clearTimeout(timer);
  }, [viewMode, scrollTargetRole]);

  const handleStatusChange = useCallback((id: string, status: Problem['status']) => {
    setAnalysis(prev => prev ? {
      ...prev,
      problems: prev.problems.map(p => p.id === id ? { ...p, status } : p)
    } : prev);
  }, []);

  const handleGenerate = async () => {
    setGenerating(true); setError('');
    try {
      const data = await api.generateProblems();
      setAnalysis(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><div className="spinner" /></div>;
  }

  const allRoles = analysis
    ? [...new Set(analysis.problems.flatMap(p => p.affectedRoles))]
    : [];

  const filteredProblems = (analysis?.problems ?? []).filter(p => {
    if (severityFilter !== 'all' && p.severity !== severityFilter) return false;
    if (roleFilter !== 'all' && !p.affectedRoles.includes(roleFilter)) return false;
    return true;
  });

  const criticalCount = analysis?.problems.filter(p => p.severity === 'critical').length ?? 0;
  const moderateCount = analysis?.problems.filter(p => p.severity === 'moderate').length ?? 0;

  return (
    <div className="synthesis-full-page">

      {/* Stats bar */}
      {analysis && (
        <div className="synthesis-stats-bar">
          {[
            { label: 'Total Problems', value: analysis.problems.length, icon: '🔍', color: '#4f46e5' },
            { label: 'Critical',       value: criticalCount,            icon: '🔴', color: '#dc2626' },
            { label: 'Moderate',       value: moderateCount,            icon: '🟡', color: '#d97706' },
            { label: 'Interviews',     value: analysis.interviewCount,  icon: '👥', color: '#059669' },
            { label: 'Roles Affected', value: allRoles.length,          icon: '👤', color: '#7c3aed' },
          ].map((s, i) => (
            <div key={i} className="stat-card">
              <div className="stat-icon-wrap">{s.icon}</div>
              <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      <div className="synthesis-layout">

        {/* Sidebar */}
        <aside className="synthesis-sidebar">
          <div className="sidebar-group-label">View Mode</div>
          {([['hierarchy', '🌳', 'Hierarchy'], ['segment', '👤', 'By Segment'], ['priority', '🎯', 'By Priority']] as const).map(([mode, icon, label]) => (
            <button
              key={mode}
              className={`sidebar-nav-btn ${viewMode === mode ? 'active' : ''}`}
              onClick={() => setViewMode(mode)}
            >
              <span>{icon}</span><span>{label}</span>
            </button>
          ))}

          <div className="sidebar-divider" />
          <div className="sidebar-group-label">Severity</div>
          {(['all', 'critical', 'moderate', 'minor'] as const).map(sev => (
            <button
              key={sev}
              className={`sidebar-nav-btn ${severityFilter === sev ? 'active' : ''}`}
              onClick={() => setSeverityFilter(sev)}
            >
              <span>{sev === 'all' ? '📋' : sev === 'critical' ? '🔴' : sev === 'moderate' ? '🟡' : '⚪'}</span>
              <span style={{ flex: 1, textAlign: 'left', textTransform: sev === 'all' ? 'none' : 'capitalize' }}>{sev === 'all' ? 'All Severities' : sev}</span>
              {sev !== 'all' && (
                <span style={{ fontSize: '0.68rem', background: '#f3f4f6', color: '#6b7280', borderRadius: 100, padding: '1px 6px', fontWeight: 700 }}>
                  {analysis?.problems.filter(p => p.severity === sev).length ?? 0}
                </span>
              )}
            </button>
          ))}

          {allRoles.length > 0 && (
            <>
              <div className="sidebar-divider" />
              <div className="sidebar-group-label">Jump to Role</div>
              <button
                className={`sidebar-nav-btn ${viewMode === 'segment' && !scrollTargetRole ? 'active' : ''}`}
                onClick={() => { setViewMode('segment'); setRoleFilter('all'); setScrollTargetRole(null); }}
              >
                <span>👥</span><span>All Roles</span>
              </button>
              {allRoles.map(role => (
                <button
                  key={role}
                  className="sidebar-nav-btn"
                  onClick={() => { setViewMode('segment'); setRoleFilter('all'); setScrollTargetRole(role); }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: ROLE_COLOR[role] ?? '#9ca3af', flexShrink: 0, display: 'inline-block' }} />
                  <span style={{ flex: 1, textAlign: 'left' }}>{ROLE_LABEL[role] ?? role}</span>
                  <span style={{ fontSize: '0.65rem', color: '#9ca3af' }}>↓</span>
                </button>
              ))}
            </>
          )}

          <div className="sidebar-divider" />
          <div className="sidebar-group-label">Actions</div>
          {confirmRegen ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '4px 0' }}>
              <span style={{ fontSize: '0.72rem', color: '#6b7280', padding: '0 8px' }}>Replace current analysis?</span>
              <div style={{ display: 'flex', gap: 4 }}>
                <button className="btn btn-danger btn-sm" style={{ flex: 1, fontSize: '0.72rem' }} onClick={() => { setConfirmRegen(false); handleGenerate(); }}>Yes, replace</button>
                <button className="btn btn-ghost btn-sm" style={{ flex: 1, fontSize: '0.72rem' }} onClick={() => setConfirmRegen(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <button className="sidebar-nav-btn" onClick={() => analysis ? setConfirmRegen(true) : handleGenerate()} disabled={generating}>
              <span>↻</span><span>{generating ? 'Generating…' : 'Regenerate'}</span>
            </button>
          )}
          <Link to="/playbook" className="sidebar-nav-btn" style={{ textDecoration: 'none', color: '#4f46e5', fontWeight: 600 }}>
            <span>→</span><span>View Playbook</span>
          </Link>
        </aside>

        {/* Main */}
        <main className="synthesis-main">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
            <div>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 4 }}>Problem Analysis</h1>
              <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                Synthesized problems from your research — the foundation for role-specific briefings
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {confirmRegen ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, padding: '6px 12px' }}>
                  <span style={{ fontSize: '0.78rem', color: '#92400e' }}>Replace current analysis?</span>
                  <button className="btn btn-danger btn-sm" onClick={() => { setConfirmRegen(false); handleGenerate(); }}>Yes</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setConfirmRegen(false)}>Cancel</button>
                </div>
              ) : (
                <button className="btn btn-ghost" onClick={() => analysis ? setConfirmRegen(true) : handleGenerate()} disabled={generating}>
                  {generating ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Generating…</> : '↻ Regenerate'}
                </button>
              )}
              <Link to="/playbook" className="btn btn-primary">View Playbook →</Link>
            </div>
          </div>

          {error && <div className="error-msg">{error}</div>}

          {!analysis ? (
            <div className="empty-state">
              <h3>No problem analysis yet</h3>
              <p>Generate a problem analysis from your research interviews</p>
              <button className="btn btn-primary" onClick={handleGenerate} disabled={generating} style={{ marginTop: 12 }}>
                {generating ? 'Generating…' : '✨ Generate Problem Analysis'}
              </button>
            </div>
          ) : (
            <>
              {/* Root Problem */}
              <div className="root-problem-card" style={{ marginBottom: 24 }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#4f46e5', marginBottom: 8 }}>
                  Root Problem
                </div>
                <p style={{ fontSize: '1rem', fontWeight: 600, color: '#1e1b4b', lineHeight: 1.55, margin: 0 }}>
                  {analysis.rootProblem}
                </p>
                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 10 }}>
                  Based on {analysis.interviewCount} interview{analysis.interviewCount !== 1 ? 's' : ''} ·
                  Generated {new Date(analysis.generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
              </div>

              {/* View toggle chips */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
                {([['hierarchy', '🌳 Hierarchy'], ['segment', '👤 By Segment'], ['priority', '🎯 By Priority']] as const).map(([mode, label]) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    style={{
                      padding: '5px 14px', borderRadius: 100, fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer', border: 'none',
                      background: viewMode === mode ? '#4f46e5' : '#f3f4f6',
                      color: viewMode === mode ? '#fff' : '#6b7280',
                      transition: 'all 0.12s',
                      fontFamily: 'inherit',
                    }}
                  >
                    {label}
                  </button>
                ))}
                {filteredProblems.length !== analysis.problems.length && (
                  <span style={{ fontSize: '0.78rem', color: '#9ca3af', display: 'flex', alignItems: 'center', marginLeft: 8 }}>
                    Showing {filteredProblems.length} of {analysis.problems.length}
                  </span>
                )}
              </div>

              {/* Problems */}
              {filteredProblems.length === 0 ? (
                <div className="empty-state" style={{ padding: '32px 0' }}>
                  <p>No problems match the current filters</p>
                  <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => { setSeverityFilter('all'); setRoleFilter('all'); }}>Clear Filters</button>
                </div>
              ) : viewMode === 'hierarchy' ? (
                <HierarchyView problems={filteredProblems} onStatusChange={handleStatusChange} />
              ) : viewMode === 'segment' ? (
                <SegmentView problems={filteredProblems} onStatusChange={handleStatusChange} />
              ) : (
                <PriorityView problems={filteredProblems} onStatusChange={handleStatusChange} />
              )}

              <NextStepBanner
                icon="📖"
                title="Generate your Research Playbook"
                description="Get role-specific objectives, OKRs, deliverables, and success criteria for PM, Designer, Developer, and Project Manager"
                to="/playbook"
                buttonText="View Playbook →"
              />
            </>
          )}

          <div style={{ height: 80 }} />
        </main>
      </div>
    </div>
  );
}
