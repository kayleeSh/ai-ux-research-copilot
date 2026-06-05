import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { ProblemsAnalysis, Problem } from '../types';

// ── Config ────────────────────────────────────────────────────────────────────

const SEVERITY_CONFIG: Record<Problem['severity'], { label: string; color: string; bg: string; border: string }> = {
  critical: { label: 'Critical', color: '#dc2626', bg: '#fef2f2', border: '#dc2626' },
  moderate: { label: 'Moderate', color: '#d97706', bg: '#fffbeb', border: '#f59e0b' },
  minor:    { label: 'Minor',    color: '#6b7280', bg: '#f3f4f6', border: '#d1d5db' },
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

function LogProblemButton({ problem }: { problem: Problem }) {
  const [logged, setLogged]   = useState(false);
  const [logging, setLogging] = useState(false);
  if (logged) return <span style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 500 }}>✓ Logged to Decisions</span>;
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
          });
          setLogged(true);
        } catch { setLogging(false); }
      }}
      style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 6, padding: '3px 10px', fontSize: '0.72rem', cursor: 'pointer', color: '#6b7280', whiteSpace: 'nowrap', fontFamily: 'inherit' }}
    >
      {logging ? '…' : '+ Log Decision'}
    </button>
  );
}

// ── Problem Card ───────────────────────────────────────────────────────────────

function ProblemCard({ problem, isChild = false }: { problem: Problem; isChild?: boolean }) {
  const [showEvidence, setShowEvidence] = useState(false);
  const cfg = SEVERITY_CONFIG[problem.severity];

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

      {/* Log to Decision Log */}
      <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
        <LogProblemButton problem={problem} />
      </div>
    </div>
  );
}

// ── View Renderers ─────────────────────────────────────────────────────────────

function HierarchyView({ problems }: { problems: Problem[] }) {
  const roots    = problems.filter(p => !p.parentId);
  const children = problems.filter(p => !!p.parentId);

  return (
    <>
      {roots.map(root => (
        <div key={root.id}>
          <ProblemCard problem={root} />
          {children
            .filter(c => c.parentId === root.id || c.parentId === root.title)
            .map(child => <ProblemCard key={child.id} problem={child} isChild />)
          }
        </div>
      ))}
    </>
  );
}

function SegmentView({ problems }: { problems: Problem[] }) {
  const allRoles = [...new Set(problems.flatMap(p => p.affectedRoles))];
  return (
    <>
      {allRoles.map(role => {
        const roleProblems = problems.filter(p => p.affectedRoles.includes(role));
        if (roleProblems.length === 0) return null;
        return (
          <div key={role} style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: ROLE_COLOR[role] ?? '#9ca3af', flexShrink: 0 }} />
              <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#4b5563' }}>
                Affects: {ROLE_LABEL[role] ?? role}
              </span>
              <span style={{ fontSize: '0.72rem', color: '#9ca3af' }}>({roleProblems.length} problem{roleProblems.length !== 1 ? 's' : ''})</span>
            </div>
            {roleProblems.map(p => <ProblemCard key={`${role}-${p.id}`} problem={p} />)}
          </div>
        );
      })}
    </>
  );
}

function PriorityView({ problems }: { problems: Problem[] }) {
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
                  <ProblemCard problem={p} />
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

  const load = useCallback(async () => {
    try {
      const data = await api.getProblems();
      setAnalysis(data);
    } catch { /* no analysis yet */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

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
              <div className="sidebar-group-label">Role</div>
              <button className={`sidebar-nav-btn ${roleFilter === 'all' ? 'active' : ''}`} onClick={() => setRoleFilter('all')}>
                <span>👥</span><span>All Roles</span>
              </button>
              {allRoles.map(role => (
                <button key={role} className={`sidebar-nav-btn ${roleFilter === role ? 'active' : ''}`} onClick={() => setRoleFilter(role)}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: ROLE_COLOR[role] ?? '#9ca3af', flexShrink: 0, display: 'inline-block' }} />
                  <span style={{ flex: 1, textAlign: 'left' }}>{ROLE_LABEL[role] ?? role}</span>
                </button>
              ))}
            </>
          )}

          <div className="sidebar-divider" />
          <div className="sidebar-group-label">Actions</div>
          <button className="sidebar-nav-btn" onClick={handleGenerate} disabled={generating}>
            <span>↻</span><span>{generating ? 'Generating…' : 'Regenerate'}</span>
          </button>
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
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost" onClick={handleGenerate} disabled={generating}>
                {generating ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Generating…</> : '↻ Regenerate'}
              </button>
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
                <HierarchyView problems={filteredProblems} />
              ) : viewMode === 'segment' ? (
                <SegmentView problems={filteredProblems} />
              ) : (
                <PriorityView problems={filteredProblems} />
              )}

              {/* CTA to Briefing */}
              <div className="synthesis-section" style={{ marginTop: 24, padding: '16px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 3 }}>Ready to see what each role should do about this?</div>
                    <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                      Generate role-specific objectives, OKRs, deliverables, and more
                    </div>
                  </div>
                  <Link to="/playbook" className="btn btn-primary" style={{ flexShrink: 0 }}>
                    View Playbook →
                  </Link>
                </div>
              </div>
            </>
          )}

          <div style={{ height: 80 }} />
        </main>
      </div>
    </div>
  );
}
