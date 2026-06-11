import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { Interview, AIResult, Cluster } from '../types';
import { useToast, Toast } from '../components/Toast';

const REGEN_STEPS = [
  { label: 'Re-reading transcript',    icon: '📄' },
  { label: 'Extracting new insights',  icon: '🔍' },
  { label: 'Rebuilding analysis',      icon: '🧠' },
  { label: 'Finalizing results',       icon: '✨' },
];

function IconRefresh() {
  return (
    <svg width="11" height="13" viewBox="0 0 12 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="8,1 2.5,7.5 6.5,7.5 4.5,13" />
    </svg>
  );
}

function RegenerateLoader() {
  const [step, setStep] = useState(0);
  const [dots, setDots] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => setStep(s => Math.min(s + 1, REGEN_STEPS.length - 1)), 1800);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  useEffect(() => {
    const id = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 400);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="regen-loader">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <span style={{ fontSize: '1.4rem', animation: 'float 2s ease-in-out infinite' }}>🤖</span>
        <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Regenerating analysis{dots}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {REGEN_STEPS.map((s, i) => (
          <div key={i} className={`analyzing-step ${i < step ? 'done' : i === step ? 'active' : 'pending'}`}
            style={{ padding: '6px 10px' }}>
            <div className="analyzing-step-icon" style={{ width: 22, height: 22, fontSize: '0.8rem' }}>
              {i < step ? '✓' : i === step ? <span className="step-spinner" style={{ width: 13, height: 13 }} /> : s.icon}
            </div>
            <span style={{ fontSize: '0.8rem' }}>{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

type Tab = 'summary' | 'quotes' | 'pain_points' | 'themes' | 'clusters';

const TABS: { key: Tab; label: (counts: number[]) => string }[] = [
  { key: 'summary',     label: () => 'Summary' },
  { key: 'quotes',      label: ([n]) => `Quotes (${n})` },
  { key: 'pain_points', label: ([,n]) => `Pain Points (${n})` },
  { key: 'themes',      label: ([,,n]) => `Themes (${n})` },
  { key: 'clusters',    label: ([,,,n]) => `Clusters (${n})` }
];

export default function Workspace() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [interview, setInterview] = useState<Interview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('summary');
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const { showToast, toastMessage, toastVisible } = useToast();
  const [streamText, setStreamText] = useState('');
  const [confirmRegen, setConfirmRegen] = useState(false);

  const [editSummary, setEditSummary] = useState('');
  const [editQuotes, setEditQuotes] = useState<string[]>([]);
  const [editPainPoints, setEditPainPoints] = useState<string[]>([]);
  const [editThemes, setEditThemes] = useState<string[]>([]);
  const [editClusters, setEditClusters] = useState<Cluster[]>([]);
  const [dirty, setDirty] = useState(false);

  const hydrate = useCallback((result: AIResult) => {
    setEditSummary(result.summary ?? '');
    setEditQuotes([...(result.keyQuotes ?? [])]);
    setEditPainPoints([...(result.painPoints ?? [])]);
    setEditThemes([...(result.mainThemes ?? [])]);
    setEditClusters([...(result.clusters ?? [])]);
    setDirty(false);
  }, []);

  const loadInterview = useCallback(async () => {
    if (!id) return;
    try {
      const data = await api.getInterview(id);
      setInterview(data);
      if (data.aiResult) hydrate(data.aiResult);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [id, hydrate]);

  useEffect(() => { loadInterview(); }, [loadInterview]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);


  const handleSave = async () => {
    if (!interview?.aiResult) return;
    setSaving(true);
    try {
      const updatedResult: AIResult = {
        ...interview.aiResult,
        summary: editSummary,
        keyQuotes: editQuotes,
        painPoints: editPainPoints,
        mainThemes: editThemes,
        clusters: editClusters
      };
      await api.updateInterview(interview.id, { aiResult: updatedResult });
      setInterview(prev => prev ? { ...prev, aiResult: updatedResult } : null);
      setDirty(false);
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerate = async () => {
    if (dirty && !confirmRegen) { setConfirmRegen(true); return; }
    setConfirmRegen(false);
    if (!interview) return;
    setRegenerating(true);
    setStreamText('regenerating');
    setTab('summary');
    try {
      const { aiResult } = await api.regenerate(interview.id);
      hydrate(aiResult);
      setInterview(prev => prev ? { ...prev, aiResult } : null);
      setStreamText('');
      showToast('✓ Analysis regenerated');
    } finally {
      setRegenerating(false);
    }
  };

  const mark = () => setDirty(true);

  const updateArr = (
    arr: string[],
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    idx: number,
    val: string
  ) => { const n = [...arr]; n[idx] = val; setter(n); mark(); };

  const removeArr = (
    arr: string[],
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    idx: number
  ) => { setter(arr.filter((_, i) => i !== idx)); mark(); };

  const addArr = (
    arr: string[],
    setter: React.Dispatch<React.SetStateAction<string[]>>
  ) => { setter([...arr, '']); mark(); };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <div className="spinner" />
      </div>
    );
  }

  if (error) return (
    <div style={{ padding: 24 }}>
      <div className="error-msg">{error}</div>
      <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={loadInterview}>Try again</button>
    </div>
  );
  if (!interview) return <div style={{ padding: 24 }}>Interview not found.</div>;

  const counts = [editQuotes.length, editPainPoints.length, editThemes.length, editClusters.length];

  return (
    <div className="workspace">
      {/* ── Left Panel: Transcript ── */}
      <div className="workspace-panel">
        <div className="workspace-header">
          <div style={{ minWidth: 0 }}>
            <div className="breadcrumb">
              <Link to="/upload">Research Hub</Link>
              <span>/</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {interview.title}
              </span>
            </div>
            <h2>Transcript</h2>
          </div>
          <span className="tag tag-gray">{interview.fileName}</span>
        </div>
        <div className="transcript-text">{interview.transcript}</div>
      </div>

      {/* ── Right Panel: AI Results ── */}
      <div className="workspace-panel">
        <div className="workspace-header">
          <h2>AI Analysis</h2>
          <div className="workspace-header-actions">
            {dirty && (
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            )}
            {confirmRegen ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, padding: '4px 10px' }}>
                <span style={{ fontSize: '0.75rem', color: '#92400e' }}>Overwrite edits?</span>
                <button className="btn btn-danger btn-sm" onClick={handleRegenerate}>Yes</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setConfirmRegen(false)}>No</button>
              </div>
            ) : regenerating ? (
              <div className="btn-analyze-pill"><div className="btn-analyze-pill-spinner" /></div>
            ) : (
              <button className="btn-analyze btn-analyze-sm" onClick={handleRegenerate}>
                <IconRefresh />
                Regenerate
              </button>
            )}
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => navigate(`/report/${interview.id}`)}
            >
              Export →
            </button>
          </div>
        </div>

        {/* Animated loader shown while regenerating */}
        {regenerating && (
          <RegenerateLoader />
        )}

        {!interview.aiResult ? (
          <div className="empty-state">
            <h3>No analysis yet</h3>
            <p>Click Regenerate to run the AI analysis</p>
            <div>
              {regenerating ? (
                <div className="btn-analyze-pill"><div className="btn-analyze-pill-spinner" /></div>
              ) : (
                <button className="btn-analyze" onClick={handleRegenerate}>
                  <IconRefresh />
                  Run Analysis
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="tabs">
              {TABS.map(t => (
                <button
                  key={t.key}
                  className={`tab-btn ${tab === t.key ? 'active' : ''}`}
                  onClick={() => setTab(t.key)}
                >
                  {t.label(counts)}
                </button>
              ))}
            </div>

            {/* Summary */}
            {tab === 'summary' && (
              <div className="result-section">
                <h3>Executive Summary</h3>
                <textarea
                  className="edit-area"
                  value={editSummary}
                  onChange={e => { setEditSummary(e.target.value); mark(); }}
                  rows={7}
                />
              </div>
            )}

            {/* Quotes */}
            {tab === 'quotes' && (
              <div className="result-section">
                <h3>Key Quotes</h3>
                {editQuotes.map((q, i) => (
                  <div key={i} className="list-item quote-item">
                    <div className="list-item-content">
                      <textarea
                        className="edit-area"
                        value={q}
                        onChange={e => updateArr(editQuotes, setEditQuotes, i, e.target.value)}
                        rows={2}
                        style={{ fontStyle: 'italic', background: 'transparent', border: 'none', boxShadow: 'none', padding: 0 }}
                      />
                    </div>
                    <div className="list-item-actions">
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => removeArr(editQuotes, setEditQuotes, i)}
                      >✕</button>
                    </div>
                  </div>
                ))}
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ marginTop: 8 }}
                  onClick={() => addArr(editQuotes, setEditQuotes)}
                >
                  + Add Quote
                </button>
              </div>
            )}

            {/* Pain Points */}
            {tab === 'pain_points' && (
              <div className="result-section">
                <h3>Pain Points</h3>
                {editPainPoints.map((p, i) => (
                  <div key={i} className="list-item">
                    <div className="list-item-content">
                      <input
                        className="list-item-input"
                        type="text"
                        value={p}
                        onChange={e => updateArr(editPainPoints, setEditPainPoints, i, e.target.value)}
                      />
                    </div>
                    <div className="list-item-actions">
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => removeArr(editPainPoints, setEditPainPoints, i)}
                      >✕</button>
                    </div>
                  </div>
                ))}
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ marginTop: 8 }}
                  onClick={() => addArr(editPainPoints, setEditPainPoints)}
                >
                  + Add Pain Point
                </button>
              </div>
            )}

            {/* Themes */}
            {tab === 'themes' && (
              <div className="result-section">
                <h3>Main Themes</h3>
                <div className="theme-tags" style={{ marginBottom: 14 }}>
                  {editThemes.map((t, i) => (
                    <span
                      key={i}
                      className="tag tag-purple"
                      style={{ cursor: 'default' }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
                {editThemes.map((t, i) => (
                  <div key={i} className="list-item">
                    <div className="list-item-content">
                      <input
                        className="list-item-input"
                        type="text"
                        value={t}
                        onChange={e => updateArr(editThemes, setEditThemes, i, e.target.value)}
                      />
                    </div>
                    <div className="list-item-actions">
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => removeArr(editThemes, setEditThemes, i)}
                      >✕</button>
                    </div>
                  </div>
                ))}
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ marginTop: 8 }}
                  onClick={() => addArr(editThemes, setEditThemes)}
                >
                  + Add Theme
                </button>
              </div>
            )}

            {/* Clusters */}
            {tab === 'clusters' && (
              <div className="result-section">
                <h3>Affinity Clusters</h3>
                {editClusters.map((cluster, i) => (
                  <div key={cluster.id} className="cluster-card">
                    <input
                      className="cluster-card-name"
                      type="text"
                      value={cluster.name}
                      onChange={e => {
                        const next = [...editClusters];
                        next[i] = { ...next[i], name: e.target.value };
                        setEditClusters(next);
                        mark();
                      }}
                      placeholder="Cluster name"
                    />
                    <textarea
                      className="cluster-card-desc"
                      value={cluster.description}
                      rows={2}
                      onChange={e => {
                        const next = [...editClusters];
                        next[i] = { ...next[i], description: e.target.value };
                        setEditClusters(next);
                        mark();
                      }}
                      placeholder="Description…"
                    />
                    <div className="theme-tags">
                      {cluster.themes.map((t, ti) => (
                        <span key={ti} className="tag tag-blue">{t}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
      <Toast message={toastMessage} visible={toastVisible} />
    </div>
  );
}
