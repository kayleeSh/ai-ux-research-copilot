import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { Interview, SynthesisResult } from '../types';

export default function Synthesis() {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SynthesisResult | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getInterviews()
      .then(data => {
        // Only show interviews that have been analyzed
        setInterviews(data.filter(iv => !!iv.aiResult));
      })
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
            {running ? (
              <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Synthesizing…</>
            ) : (
              `Synthesize ${selected.size > 0 ? `${selected.size} interviews` : ''} →`
            )}
          </button>
          {selected.size < 2 && (
            <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
              Select at least 2 interviews
            </span>
          )}
        </div>
      </div>

      {error && <div className="error-msg">{error}</div>}

      {/* Results */}
      {result && (
        <div className="synthesis-result">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Synthesis Results</h2>
              <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: 2 }}>
                Based on {result.interviewCount} interviews · {new Date(result.createdAt).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Overall Summary */}
          <div className="synthesis-section">
            <div className="synthesis-section-title">Overall Summary</div>
            <p style={{ lineHeight: 1.8, color: '#374151' }}>{result.overallSummary}</p>
          </div>

          {/* Common Themes */}
          <div className="synthesis-section">
            <div className="synthesis-section-title">Common Themes Across Interviews</div>
            <div className="theme-tags">
              {result.commonThemes.map((t, i) => (
                <span key={i} className="tag tag-purple" style={{ fontSize: '0.8rem', padding: '4px 12px' }}>{t}</span>
              ))}
            </div>
          </div>

          {/* Patterns */}
          <div className="synthesis-section">
            <div className="synthesis-section-title">Behavioral Patterns</div>
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
                        <div key={qi} className="report-quote" style={{ fontSize: '0.8rem', padding: '6px 12px' }}>
                          {q}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Prioritized Pain Points */}
          <div className="synthesis-section">
            <div className="synthesis-section-title">Prioritized Pain Points</div>
            <ul className="pain-list">
              {result.prioritizedPainPoints.map((p, i) => (
                <li key={i}>
                  <span className="tag tag-red" style={{ flexShrink: 0 }}>#{i + 1}</span>
                  {p}
                </li>
              ))}
            </ul>
          </div>

          {/* Differences */}
          <div className="synthesis-section">
            <div className="synthesis-section-title">Key Differences Between Participants</div>
            <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {result.differences.map((d, i) => (
                <li key={i} style={{ display: 'flex', gap: 8, fontSize: '0.875rem', color: '#374151', alignItems: 'flex-start' }}>
                  <span style={{ color: '#d97706', flexShrink: 0 }}>↔</span>
                  {d}
                </li>
              ))}
            </ul>
          </div>

          {/* Recommendations */}
          <div className="synthesis-section">
            <div className="synthesis-section-title">Design Recommendations</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {result.recommendations.map((r, i) => (
                <div key={i} className="recommendation-card">
                  <span className="rec-number">{i + 1}</span>
                  <span style={{ fontSize: '0.875rem', color: '#1f2937', lineHeight: 1.5 }}>{r}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
