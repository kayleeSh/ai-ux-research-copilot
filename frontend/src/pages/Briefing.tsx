import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { Briefing, OKR } from '../types';

// ── Config ────────────────────────────────────────────────────────────────────

type Role = 'pm' | 'designer' | 'developer' | 'projectManager';

const ROLES: { id: Role; label: string; icon: string; subtitle: string }[] = [
  { id: 'pm',             label: 'Product Manager', icon: '📊', subtitle: 'OKRs, objectives, priorities & risks' },
  { id: 'designer',       label: 'Designer',        icon: '🎨', subtitle: 'User needs, JTBD & deliverables' },
  { id: 'developer',      label: 'Developer',       icon: '⚡', subtitle: 'Deliverables, constraints & non-goals' },
  { id: 'projectManager', label: 'Project Manager', icon: '📋', subtitle: 'Milestones, dependencies & open questions' },
];

const CONFIDENCE_STYLE: Record<Briefing['confidence'], { label: string; color: string; bg: string }> = {
  high:   { label: 'High Confidence',   color: '#059669', bg: '#f0fdf4' },
  medium: { label: 'Medium Confidence', color: '#d97706', bg: '#fffbeb' },
  low:    { label: 'Low Confidence',    color: '#dc2626', bg: '#fef2f2' },
};

// ── Section helpers ────────────────────────────────────────────────────────────

function SectionCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="briefing-section">
      <div className="briefing-section-title">
        <span>{icon}</span> {title}
      </div>
      {children}
    </div>
  );
}

function BulletList({ items, color = '#374151' }: { items: string[]; color?: string }) {
  if (items.length === 0) return <p style={{ fontSize: '0.85rem', color: '#9ca3af' }}>None specified.</p>;
  return (
    <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((item, i) => (
        <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: '0.875rem', color, lineHeight: 1.6 }}>
          <span style={{ color: '#d1d5db', flexShrink: 0, marginTop: 3 }}>›</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function NumberedList({ items }: { items: string[] }) {
  if (items.length === 0) return <p style={{ fontSize: '0.85rem', color: '#9ca3af' }}>None specified.</p>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', fontSize: '0.875rem', color: '#374151', lineHeight: 1.6 }}>
          <span style={{ background: '#f3f4f6', color: '#6b7280', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 700, flexShrink: 0 }}>
            {i + 1}
          </span>
          <span>{item}</span>
        </div>
      ))}
    </div>
  );
}

function OKRCard({ okr }: { okr: OKR }) {
  return (
    <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 16px', marginBottom: 10 }}>
      <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#111827', marginBottom: 10 }}>
        🎯 {okr.objective}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {okr.keyResults.map((kr, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: '0.82rem', color: '#4b5563', lineHeight: 1.5 }}>
            <span style={{ color: '#059669', flexShrink: 0, fontWeight: 700 }}>KR{i + 1}</span>
            <span>{kr}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function WarningTag({ text }: { text: string }) {
  const isRisk = text.toLowerCase().startsWith('risk');
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: '0.875rem', color: '#374151', lineHeight: 1.6, padding: '8px 12px', background: isRisk ? '#fff7ed' : '#f0f9ff', borderRadius: 8, border: `1px solid ${isRisk ? '#fed7aa' : '#bae6fd'}` }}>
      <span style={{ flexShrink: 0 }}>{isRisk ? '⚠️' : '💭'}</span>
      <span>{text}</span>
    </div>
  );
}

// ── Role Tabs ──────────────────────────────────────────────────────────────────

function PMTab({ data }: { data: Briefing['pm'] }) {
  return (
    <>
      <SectionCard title="Objectives" icon="🎯">
        <NumberedList items={data.objectives} />
      </SectionCard>

      <SectionCard title="OKRs — Objectives & Key Results" icon="📈">
        {data.okrs.length === 0
          ? <p style={{ fontSize: '0.85rem', color: '#9ca3af' }}>No OKRs generated.</p>
          : data.okrs.map((okr, i) => <OKRCard key={i} okr={okr} />)
        }
      </SectionCard>

      <SectionCard title="Priority Stack Rank" icon="🔢">
        <BulletList items={data.priorityStackRank} color="#1f2937" />
      </SectionCard>

      <SectionCard title="Assumptions & Risks" icon="⚠️">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.assumptionsAndRisks.length === 0
            ? <p style={{ fontSize: '0.85rem', color: '#9ca3af' }}>None specified.</p>
            : data.assumptionsAndRisks.map((item, i) => <WarningTag key={i} text={item} />)
          }
        </div>
      </SectionCard>

      <SectionCard title="Methods & Tools to Measure KRs" icon="🔬">
        <BulletList items={data.methodsAndTools} color="#374151" />
      </SectionCard>
    </>
  );
}

function DesignerTab({ data }: { data: Briefing['designer'] }) {
  return (
    <>
      <SectionCard title="User Needs" icon="👤">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.userNeeds.map((need, i) => (
            <div key={i} style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: '10px 14px', fontSize: '0.875rem', color: '#0c4a6e', lineHeight: 1.55 }}>
              {need}
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Jobs To Be Done" icon="💼">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {data.jobsToBeDone.map((jtbd, i) => (
            <div key={i} style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 8, padding: '10px 14px', fontSize: '0.875rem', color: '#3b0764', lineHeight: 1.6, fontStyle: 'italic' }}>
              {jtbd}
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Design Principles" icon="🧭">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {data.designPrinciples.map((p, i) => (
            <span key={i} style={{ background: '#f0fdf4', border: '1px solid #86efac', color: '#14532d', borderRadius: 8, padding: '6px 12px', fontSize: '0.82rem', fontWeight: 500 }}>
              {p}
            </span>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Deliverables" icon="📦">
        <NumberedList items={data.deliverables} />
      </SectionCard>

      <SectionCard title="Success Criteria for Design" icon="✅">
        <BulletList items={data.successCriteria} color="#374151" />
      </SectionCard>
    </>
  );
}

function DeveloperTab({ data }: { data: Briefing['developer'] }) {
  return (
    <>
      <SectionCard title="Deliverables" icon="📦">
        <NumberedList items={data.deliverables} />
      </SectionCard>

      <SectionCard title="Acceptance Criteria" icon="✅">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.acceptanceCriteria.map((ac, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: '0.875rem', color: '#374151', lineHeight: 1.5, padding: '8px 12px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
              <span style={{ color: '#059669', flexShrink: 0 }}>✓</span>
              <span>{ac}</span>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Technical Constraints" icon="🔒">
        <BulletList items={data.technicalConstraints} color="#92400e" />
      </SectionCard>

      <SectionCard title="Dependencies" icon="🔗">
        <BulletList items={data.dependencies} color="#374151" />
      </SectionCard>

      <SectionCard title="Non-Goals / Out of Scope" icon="🚫">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {data.nonGoals.map((ng, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: '0.875rem', color: '#6b7280', lineHeight: 1.5 }}>
              <span style={{ color: '#dc2626', flexShrink: 0 }}>✗</span>
              <span style={{ textDecoration: 'line-through' }}>{ng}</span>
            </div>
          ))}
        </div>
      </SectionCard>
    </>
  );
}

function ProjectManagerTab({ data }: { data: Briefing['projectManager'] }) {
  return (
    <>
      <SectionCard title="Deliverables" icon="📦">
        <NumberedList items={data.deliverables} />
      </SectionCard>

      <SectionCard title="Milestones" icon="🏁">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.milestones.map((m, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', fontSize: '0.875rem', color: '#374151', lineHeight: 1.5 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#eef2ff', border: '2px solid #818cf8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 700, color: '#4f46e5', flexShrink: 0 }}>
                {i + 1}
              </div>
              <span style={{ paddingTop: 4 }}>{m}</span>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Dependencies Map" icon="🔗">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {data.dependenciesMap.map((dep, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.875rem', color: '#374151', lineHeight: 1.5 }}>
              <span style={{ color: '#d97706' }}>→</span>
              <span>{dep}</span>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Effort Estimates" icon="⏱️">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {data.effortEstimates.map((est, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: '0.875rem', color: '#374151', lineHeight: 1.5 }}>
              <span style={{ color: '#6b7280' }}>◷</span>
              <span>{est}</span>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Open Questions" icon="❓">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.openQuestions.map((q, i) => (
            <div key={i} style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', fontSize: '0.875rem', color: '#78350f', lineHeight: 1.55 }}>
              {q}
            </div>
          ))}
        </div>
      </SectionCard>
    </>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function BriefingPage() {
  const [briefing, setBriefing]   = useState<Briefing | null>(null);
  const [loading, setLoading]     = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError]         = useState('');
  const [activeRole, setActiveRole] = useState<Role>('pm');

  const load = useCallback(async () => {
    try {
      const data = await api.getBriefing();
      setBriefing(data);
    } catch { /* no briefing yet */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleGenerate = async () => {
    setGenerating(true); setError('');
    try {
      const data = await api.generateBriefing();
      setBriefing(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><div className="spinner" /></div>;
  }

  const activeRoleData = ROLES.find(r => r.id === activeRole)!;
  const confStyle = briefing ? CONFIDENCE_STYLE[briefing.confidence] : null;

  return (
    <div className="synthesis-full-page">

      {/* Confidence bar */}
      {briefing && confStyle && (
        <div style={{ background: confStyle.bg, borderBottom: '1px solid #e5e7eb', padding: '8px 24px', display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: confStyle.color }}>
            {confStyle.label}
          </span>
          <span style={{ fontSize: '0.78rem', color: '#6b7280' }}>
            Based on {briefing.problemCount} problem{briefing.problemCount !== 1 ? 's' : ''} · {briefing.interviewCount} interview{briefing.interviewCount !== 1 ? 's' : ''}
          </span>
          <span style={{ fontSize: '0.78rem', color: '#9ca3af' }}>
            Generated {new Date(briefing.generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
          <Link to="/problems" style={{ fontSize: '0.78rem', color: '#4f46e5', textDecoration: 'none', fontWeight: 500, marginLeft: 'auto' }}>
            ← View Problem Analysis
          </Link>
        </div>
      )}

      <div className="synthesis-layout">

        {/* Sidebar — role switcher */}
        <aside className="synthesis-sidebar">
          <div className="sidebar-group-label">Select Role</div>
          {ROLES.map(role => (
            <button
              key={role.id}
              className={`sidebar-nav-btn ${activeRole === role.id ? 'active' : ''}`}
              onClick={() => setActiveRole(role.id)}
              style={{ height: 'auto', paddingTop: 10, paddingBottom: 10 }}
            >
              <span style={{ fontSize: '1rem' }}>{role.icon}</span>
              <div style={{ textAlign: 'left', flex: 1 }}>
                <div style={{ fontWeight: activeRole === role.id ? 700 : 500 }}>{role.label}</div>
                <div style={{ fontSize: '0.68rem', color: '#9ca3af', marginTop: 1, fontWeight: 400 }}>{role.subtitle}</div>
              </div>
            </button>
          ))}

          <div className="sidebar-divider" />
          <div className="sidebar-group-label">Actions</div>
          <button className="sidebar-nav-btn" onClick={handleGenerate} disabled={generating}>
            <span>↻</span><span>{generating ? 'Generating…' : 'Regenerate'}</span>
          </button>
          <Link to="/problems" className="sidebar-nav-btn" style={{ textDecoration: 'none', color: '#6b7280' }}>
            <span>←</span><span>Problem Analysis</span>
          </Link>
          <Link to="/decisions" className="sidebar-nav-btn" style={{ textDecoration: 'none', color: '#6b7280' }}>
            <span>◈</span><span>Decisions Hub</span>
          </Link>
        </aside>

        {/* Main */}
        <main className="synthesis-main">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
            <div>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 4 }}>
                {activeRoleData.icon} {activeRoleData.label} Briefing
              </h1>
              <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>{activeRoleData.subtitle}</p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost" onClick={handleGenerate} disabled={generating}>
                {generating ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Generating…</> : '↻ Regenerate'}
              </button>
            </div>
          </div>

          {error && <div className="error-msg">{error}</div>}

          {!briefing ? (
            <div className="empty-state">
              <h3>No briefing yet</h3>
              <p>Generate a role briefing from your problem analysis</p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 12 }}>
                <button className="btn btn-primary" onClick={handleGenerate} disabled={generating}>
                  {generating ? 'Generating…' : '✨ Generate Role Briefing'}
                </button>
                <Link to="/problems" className="btn btn-ghost">← View Problems First</Link>
              </div>
            </div>
          ) : (
            <>
              {activeRole === 'pm'             && <PMTab            data={briefing.pm} />}
              {activeRole === 'designer'        && <DesignerTab      data={briefing.designer} />}
              {activeRole === 'developer'       && <DeveloperTab     data={briefing.developer} />}
              {activeRole === 'projectManager'  && <ProjectManagerTab data={briefing.projectManager} />}
            </>
          )}

          <div style={{ height: 80 }} />
        </main>
      </div>
    </div>
  );
}
