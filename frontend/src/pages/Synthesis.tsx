import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { Interview, SynthesisResult } from '../types';

const STEPS = [
  { id: 1, label: 'Reading transcripts',        icon: '📄', duration: 1200 },
  { id: 2, label: 'Finding common patterns',    icon: '🔍', duration: 2000 },
  { id: 3, label: 'Analyzing differences',      icon: '⚖️',  duration: 1800 },
  { id: 4, label: 'Generating recommendations', icon: '💡', duration: 1500 },
];

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
          <div style={{ fontWeight: 700, fontSize: '1rem' }}>
            AI is synthesizing {count} interviews
          </div>
          <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: 2 }}>
            Finding patterns across participants{dots}
          </div>
        </div>
      </div>

      <div className="synthesis-steps">
        {STEPS.map((s, i) => {
          const isDone    = i < step;
          const isActive  = i === step;
          const isPending = i > step;
          return (
            <div key={s.id} className={`synthesis-step ${isDone ? 'done' : isActive ? 'active' : 'pending'}`}>
              <div className="synthesis-step-icon">
                {isDone ? '✓' : isActive ? <span className="step-spinner" /> : s.icon}
              </div>
              <div className="synthesis-step-label">
                {s.label}
                {isActive && <span className="step-dots">{dots}</span>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="synthesis-progress-track">
        <div
          className="synthesis-progress-bar"
          style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
        />
      </div>
      <div style={{ fontSize: '0.75rem', color: '#9ca3af', textAlign: 'right', marginTop: 4 }}>
        Step {step + 1} of {STEPS.length}
      </div>
    </div>
  );
}

function ResultSection({ title, children, delay = 0 }: { title: string; children: React.ReactNode; delay?: number }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <div className={`synthesis-section fade-in-up ${visible ? 'visible' : ''}`}>
      <div className="synthesis-section-title">{title}</div>
      {children}
    </div>
  );
}

export default function Synthesis() {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SynthesisResult | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getInterviews()
      .then(data => setInterviews(data.filter(iv => !!iv.aiResult)))
      .finally(() => setLoading(false));
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
    <div className="synthesis-page">
      <div className="page-header">
        <div>
          <h1>Cross-Interview Synthesis</h1>
          <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: 4 }}>
            Select 2 or more interviews — AI finds patterns, differences, and recommendations across all participants
          </p>
        </div>
        <Link to="/upload" className="btn btn-primary btn-sm">+ New Interview</Link>
      </div>

      {/* Interview selector */}
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
            <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
              Select at least 2 interviews
            </span>
          )}
          {selected.size >= 2 && !running && (
            <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>
              {selected.size} selected · AI will cross-analyze all transcripts
            </span>
          )}
        </div>
      </div>

      {error && <div className="error-msg">{error}</div>}

      {/* Animated loader */}
      {running && <SynthesisLoader count={selected.size} />}

      {/* Results with staggered fade-in */}
      {result && !running && (
        <div className="synthesis-result">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                ✅ Synthesis Complete
              </h2>
              <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: 2 }}>
                {result.interviewCount} interviews · {new Date(result.createdAt).toLocaleString()}
              </div>
            </div>
          </div>

          <ResultSection title="Overall Summary" delay={0}>
            <p style={{ lineHeight: 1.8, color: '#374151' }}>{result.overallSummary}</p>
          </ResultSection>

          <ResultSection title="Common Themes Across Interviews" delay={100}>
            <div className="theme-tags">
              {result.commonThemes.map((t, i) => (
                <span key={i} className="tag tag-purple" style={{ fontSize: '0.8rem', padding: '4px 12px' }}>{t}</span>
              ))}
            </div>
          </ResultSection>

          <ResultSection title="Behavioral Patterns" delay={200}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {result.patterns.map((p, i) => (
                <div key={i} className="pattern-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{p.pattern}</div>
                    <span className="tag tag-blue">{p.frequency}</span>
                  </div>
                  <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: 10, lineHeight: 1.5 }}>
                    {p.description}
                  </p>
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

          <ResultSection title="Prioritized Pain Points" delay={300}>
            <ul className="pain-list">
              {result.prioritizedPainPoints.map((p, i) => (
                <li key={i}>
                  <span className="tag tag-red" style={{ flexShrink: 0 }}>#{i + 1}</span>
                  {p}
                </li>
              ))}
            </ul>
          </ResultSection>

          <ResultSection title="Key Differences Between Participants" delay={400}>
            <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {result.differences.map((d, i) => (
                <li key={i} style={{ display: 'flex', gap: 8, fontSize: '0.875rem', color: '#374151', alignItems: 'flex-start' }}>
                  <span style={{ color: '#d97706', flexShrink: 0 }}>↔</span>{d}
                </li>
              ))}
            </ul>
          </ResultSection>

          <ResultSection title="Design Recommendations" delay={500}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {result.recommendations.map((r, i) => (
                <div key={i} className="recommendation-card">
                  <span className="rec-number">{i + 1}</span>
                  <span style={{ fontSize: '0.875rem', color: '#1f2937', lineHeight: 1.5 }}>{r}</span>
                </div>
              ))}
            </div>
          </ResultSection>
        </div>
      )}
    </div>
  );
}
