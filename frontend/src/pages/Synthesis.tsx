import { useEffect, useState, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { Interview, SynthesisResult } from '../types';
import { NextStepBanner } from '../components/NextStepBanner';

// ── Constants ────────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: 'Reading transcripts',        icon: '📄', duration: 1200 },
  { id: 2, label: 'Finding common patterns',    icon: '🔍', duration: 2000 },
  { id: 3, label: 'Analyzing differences',      icon: '⚖️',  duration: 1800 },
  { id: 4, label: 'Generating recommendations', icon: '💡', duration: 1500 },
];

const NAV_ITEMS = [
  { id: 'selector',        label: 'Interviews',      icon: '📋', group: 'setup'   },
  { id: 'summary',         label: 'Summary',         icon: '📝', group: 'results' },
  { id: 'themes',          label: 'Common Themes',   icon: '🏷️', group: 'results' },
  { id: 'patterns',        label: 'Patterns',        icon: '🔍', group: 'results' },
  { id: 'pain-points',     label: 'Pain Points',     icon: '⚡', group: 'results' },
  { id: 'differences',     label: 'Differences',     icon: '↔️', group: 'results' },
  { id: 'recommendations', label: 'Recommendations', icon: '💡', group: 'results' },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function StatsBar({ result }: { result: SynthesisResult }) {
  const stats = [
    { label: 'Interviews Analyzed', value: result.interviewCount,                    icon: '👥', color: '#111827' },
    { label: 'Common Themes',       value: result.commonThemes.length,               icon: '🏷️', color: '#111827' },
    { label: 'Patterns Found',      value: result.patterns.length,                   icon: '🔍', color: '#111827' },
    { label: 'Pain Points',         value: result.prioritizedPainPoints.length,      icon: '›',  color: '#111827' },
    { label: 'Recommendations',     value: result.recommendations.length,            icon: '💡', color: '#111827' },
  ];

  return (
    <div className="synthesis-stats-bar">
      {stats.map((s, i) => (
        <div key={i} className="stat-card">
          <div className="stat-icon-wrap">{s.icon}</div>
          <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
          <div className="stat-label">{s.label}</div>
        </div>
      ))}
      <div className="stat-card stat-meta">
        <div className="stat-icon-wrap">✅</div>
        <div className="stat-value" style={{ color: '#374151', fontSize: '0.75rem', fontWeight: 600 }}>
          {new Date(result.createdAt).toLocaleDateString()}
        </div>
        <div className="stat-label">Generated</div>
      </div>
    </div>
  );
}

function SynthesisLoader({ count }: { count: number }) {
  const [step, setStep] = useState(0);
  const [dots, setDots] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let current = 0;
    const advance = () => {
      if (current < STEPS.length - 1) {
        current++;
        setStep(current);
        timerRef.current = setTimeout(advance, STEPS[current].duration);
      }
    };
    timerRef.current = setTimeout(advance, STEPS[0].duration);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  useEffect(() => {
    const id = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 400);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="synthesis-loader">
      <div className="synthesis-loader-header">
        <div className="synthesis-ai-icon">🧠</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: '1rem' }}>AI is synthesizing {count} interviews</div>
          <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: 2 }}>Finding patterns across participants{dots}</div>
        </div>
      </div>
      <div className="synthesis-steps">
        {STEPS.map((s, i) => {
          const isDone   = i < step;
          const isActive = i === step;
          return (
            <div key={s.id} className={`synthesis-step ${isDone ? 'done' : isActive ? 'active' : 'pending'}`}>
              <div className="synthesis-step-icon">
                {isDone ? '✓' : isActive ? <span className="step-spinner" /> : s.icon}
              </div>
              <div className="synthesis-step-label">
                {s.label}{isActive && <span className="step-dots">{dots}</span>}
              </div>
            </div>
          );
        })}
      </div>
      <div className="synthesis-progress-track">
        <div className="synthesis-progress-bar" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
      </div>
      <div style={{ fontSize: '0.75rem', color: '#9ca3af', textAlign: 'right', marginTop: 4 }}>
        Step {step + 1} of {STEPS.length}
      </div>
    </div>
  );
}

function ResultSection({
  id, title, children, delay = 0
}: { id: string; title: string; children: React.ReactNode; delay?: number }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <section id={id} className={`synthesis-section fade-in-up ${visible ? 'visible' : ''}`}>
      <div className="synthesis-section-title">{title}</div>
      {children}
    </section>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Synthesis() {
  const navigate = useNavigate();
  const [interviews, setInterviews]     = useState<Interview[]>([]);
  const [selected, setSelected]         = useState<Set<string>>(new Set());
  const [loading, setLoading]           = useState(true);
  const [running, setRunning]           = useState(false);
  const [result, setResult]             = useState<SynthesisResult | null>(null);
  const [error, setError]               = useState('');
  const [activeSection, setActiveSection] = useState('selector');
  const [generatingDecisions, setGeneratingDecisions] = useState(false);
  const mainRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.getInterviews()
      .then(data => setInterviews(data.filter(iv => !!iv.aiResult)))
      .finally(() => setLoading(false));
  }, []);

  // Track active section via IntersectionObserver on the main scroll container
  useEffect(() => {
    if (!result) return;
    const ids = ['selector', 'summary', 'themes', 'patterns', 'pain-points', 'differences', 'recommendations'];
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(e => { if (e.isIntersecting) setActiveSection(e.target.id); });
      },
      { root: mainRef.current, threshold: 0.3 }
    );
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [result]);

  const scrollToSection = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveSection(id);
    }
  }, []);

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSynthesize = async () => {
    if (selected.size < 2) return;
    setRunning(true);
    setError('');
    setResult(null);
    try {
      const synthesis = await api.synthesize(Array.from(selected));
      setResult(synthesis);
      setTimeout(() => scrollToSection('summary'), 400);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Synthesis failed');
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="synthesis-full-page">

      {/* Stats bar — only when results exist */}
      {result && !running && <StatsBar result={result} />}

      <div className="synthesis-layout">

        {/* ── Left Sidebar ── */}
        <aside className="synthesis-sidebar">
          <div className="sidebar-group-label">Setup</div>
          <button
            className={`sidebar-nav-btn ${activeSection === 'selector' ? 'active' : ''}`}
            onClick={() => scrollToSection('selector')}
          >
            <span>📋</span><span>Interviews</span>
          </button>

          <div className="sidebar-divider" />
          <div className={`sidebar-group-label ${!result ? 'disabled' : ''}`}>Results</div>

          {NAV_ITEMS.filter(n => n.group === 'results').map(item => (
            <button
              key={item.id}
              className={`sidebar-nav-btn ${activeSection === item.id ? 'active' : ''} ${!result ? 'pending-nav' : ''}`}
              onClick={() => result && scrollToSection(item.id)}
              disabled={!result}
            >
              <span>{item.icon}</span><span>{item.label}</span>
              {!result && <span className="sidebar-lock">🔒</span>}
            </button>
          ))}

          {result && (
            <>
              <div className="sidebar-divider" />
              <button
                className="sidebar-nav-btn"
                onClick={() => { setResult(null); scrollToSection('selector'); }}
                style={{ color: '#6b7280', fontSize: '0.78rem' }}
              >
                <span>↺</span><span>New Synthesis</span>
              </button>
            </>
          )}
        </aside>

        {/* ── Main scrollable content ── */}
        <main className="synthesis-main" ref={mainRef}>

          {/* Interview selector */}
          <div id="selector" style={{ scrollMarginTop: 20 }}>
            <div className="synth-section-header">
              <div>
                <h1 style={{ fontSize: '1.3rem', fontWeight: 700 }}>Cross-Interview Synthesis</h1>
                <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: 4 }}>
                  Select 2 or more interviews — AI finds patterns, differences, and recommendations across all participants
                </p>
              </div>
              <Link to="/upload" className="btn btn-primary btn-sm">+ New Interview</Link>
            </div>

            <div className="card" style={{ marginBottom: 24 }}>
              <div style={{ fontWeight: 600, marginBottom: 14, fontSize: '0.875rem' }}>
                Select Interviews to Synthesize
              </div>

              {interviews.length === 0 ? (
                <div className="empty-state" style={{ padding: '24px 0' }}>
                  <h3>No analyzed interviews yet</h3>
                  <p>Upload and analyze at least 2 interviews first</p>
                  <Link to="/upload" className="btn btn-primary" style={{ marginTop: 12 }}>Upload Interview</Link>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {interviews.map(iv => (
                    <label key={iv.id} className={`interview-checkbox ${selected.has(iv.id) ? 'selected' : ''}`}>
                      <input
                        type="checkbox"
                        checked={selected.has(iv.id)}
                        onChange={() => toggle(iv.id)}
                        style={{ accentColor: '#4f46e5' }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{iv.title}</div>
                        <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                          {new Date(iv.uploadedAt).toLocaleDateString()} · {iv.aiResult?.mainThemes?.slice(0, 3).join(', ')}
                        </div>
                      </div>
                      <Link
                        to={`/workspace/${iv.id}`}
                        onClick={e => e.stopPropagation()}
                        className="btn btn-ghost btn-sm"
                        style={{ flexShrink: 0 }}
                      >
                        View
                      </Link>
                    </label>
                  ))}
                </div>
              )}

              <div style={{ marginTop: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
                <button
                  className="btn btn-primary"
                  onClick={handleSynthesize}
                  disabled={selected.size < 2 || running}
                >
                  {running
                    ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Synthesizing…</>
                    : `✨ Synthesize ${selected.size > 0 ? `${selected.size} interviews` : ''} →`
                  }
                </button>
                {selected.size < 2 && (
                  <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>Select at least 2 interviews</span>
                )}
                {selected.size >= 2 && !running && (
                  <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                    {selected.size} selected · AI will cross-analyze all transcripts
                  </span>
                )}
              </div>
            </div>
          </div>

          {error && <div className="error-msg">{error}</div>}

          {/* Animated loader */}
          {running && <SynthesisLoader count={selected.size} />}

          {/* Results */}
          {result && !running && (
            <>
              <ResultSection id="summary" title="Overall Summary" delay={0}>
                <p style={{ lineHeight: 1.85, color: '#374151', fontSize: '0.95rem' }}>{result.overallSummary}</p>
              </ResultSection>

              <ResultSection id="themes" title="Common Themes Across Interviews" delay={100}>
                <div className="theme-tags">
                  {result.commonThemes.map((t, i) => (
                    <span key={i} className="tag tag-purple" style={{ fontSize: '0.8rem', padding: '4px 12px' }}>{t}</span>
                  ))}
                </div>
              </ResultSection>

              <ResultSection id="patterns" title="Behavioral Patterns" delay={200}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {result.patterns.map((p, i) => (
                    <div key={i} className="pattern-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{p.pattern}</div>
                        <span className="tag tag-blue">{p.frequency}</span>
                      </div>
                      <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: 10, lineHeight: 1.5 }}>{p.description}</p>
                      {p.quotes.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {p.quotes.slice(0, 2).map((q, qi) => (
                            <div key={qi} className="report-quote" style={{ fontSize: '0.8rem', padding: '6px 12px' }}>{q}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ResultSection>

              <ResultSection id="pain-points" title="Prioritized Pain Points" delay={300}>
                <ul className="pain-list">
                  {result.prioritizedPainPoints.map((p, i) => (
                    <li key={i}>
                      <span className="tag tag-red" style={{ flexShrink: 0 }}>#{i + 1}</span>{p}
                    </li>
                  ))}
                </ul>
              </ResultSection>

              <ResultSection id="differences" title="Key Differences Between Participants" delay={400}>
                <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {result.differences.map((d, i) => (
                    <li key={i} style={{ display: 'flex', gap: 8, fontSize: '0.875rem', color: '#374151', alignItems: 'flex-start' }}>
                      <span style={{ color: '#d97706', flexShrink: 0 }}>↔</span>{d}
                    </li>
                  ))}
                </ul>
              </ResultSection>

              <ResultSection id="recommendations" title="Design Recommendations" delay={500}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {result.recommendations.map((r, i) => (
                    <div key={i} className="recommendation-card">
                      <span className="rec-number">{i + 1}</span>
                      <span style={{ fontSize: '0.875rem', color: '#1f2937', lineHeight: 1.5 }}>{r}</span>
                    </div>
                  ))}
                </div>
              </ResultSection>

              <NextStepBanner
                icon="🔍"
                title="Identify core problems"
                description="Turn these findings into a structured problem analysis with severity, frequency, and role attribution"
                to="/problems"
                buttonText="Go to Problems →"
              />
            </>
          )}

          <div style={{ height: 80 }} />
        </main>
      </div>
    </div>
  );
}
