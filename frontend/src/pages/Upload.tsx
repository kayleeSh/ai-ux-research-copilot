import { useState, useRef, DragEvent, ChangeEvent, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client';
import { Interview } from '../types';
import { NextStepBanner } from '../components/NextStepBanner';

// ── Analyzing Loader ──────────────────────────────────────────────────────────

const UPLOAD_STEPS = [
  { label: 'Reading transcript',       icon: '📄', duration: 800  },
  { label: 'Extracting key quotes',    icon: '💬', duration: 1200 },
  { label: 'Identifying pain points',  icon: '⚡', duration: 1000 },
  { label: 'Building affinity map',    icon: '🗂️', duration: 900  },
  { label: 'Generating summary',       icon: '✍️', duration: 800  },
];

function AnalyzingLoader() {
  const [step, setStep] = useState(0);
  const [dots, setDots] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let current = 0;
    const advance = () => {
      if (current < UPLOAD_STEPS.length - 1) {
        current++;
        setStep(current);
        timerRef.current = setTimeout(advance, UPLOAD_STEPS[current].duration);
      }
    };
    timerRef.current = setTimeout(advance, UPLOAD_STEPS[0].duration);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  useEffect(() => {
    const id = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 400);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="analyzing-loader">
      <div className="analyzing-header">
        <div className="analyzing-icon">🤖</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>AI is analyzing your transcript{dots}</div>
          <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: 2 }}>This usually takes 5–15 seconds</div>
        </div>
      </div>
      <div className="analyzing-steps">
        {UPLOAD_STEPS.map((s, i) => {
          const isDone   = i < step;
          const isActive = i === step;
          return (
            <div key={i} className={`analyzing-step ${isDone ? 'done' : isActive ? 'active' : 'pending'}`}>
              <div className="analyzing-step-icon">
                {isDone ? '✓' : isActive ? <span className="step-spinner" /> : s.icon}
              </div>
              <span>{s.label}{isActive && <span className="step-dots">{dots}</span>}</span>
            </div>
          );
        })}
      </div>
      <div className="synthesis-progress-track" style={{ marginTop: 20 }}>
        <div
          className="synthesis-progress-bar"
          style={{ width: `${((step + 1) / UPLOAD_STEPS.length) * 100}%` }}
        />
      </div>
    </div>
  );
}

// ── Table action icons (inline SVG, stroke-based) ────────────────────────────

function IconWorkspace() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="1" width="5" height="5" rx="1" />
      <rect x="8" y="1" width="5" height="5" rx="1" />
      <rect x="1" y="8" width="5" height="5" rx="1" />
      <rect x="8" y="8" width="5" height="5" rx="1" />
    </svg>
  );
}

function IconInsights() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1"   y="7" width="3" height="6" rx="0.5" />
      <rect x="5.5" y="4" width="3" height="9" rx="0.5" />
      <rect x="10"  y="1" width="3" height="12" rx="0.5" />
    </svg>
  );
}

function IconReport() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 1h5l3 3v9a1 1 0 01-1 1H3a1 1 0 01-1-1V2a1 1 0 011-1z" />
      <polyline points="8,1 8,4 11,4" />
      <line x1="3.5" y1="7"  x2="10.5" y2="7"  />
      <line x1="3.5" y1="10" x2="7.5"  y2="10" />
    </svg>
  );
}

// ── Upload Modal ──────────────────────────────────────────────────────────────

interface UploadModalProps {
  onClose: () => void;
  onSuccess: (id: string) => void;
}

function UploadModal({ onClose, onSuccess }: UploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'file' | 'text'>('file');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setFile(e.target.files[0]);
  };

  const canSubmit = mode === 'file' ? !!file : text.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setError('');
    setLoading(true);
    try {
      let result: { id: string };
      if (mode === 'file' && file) {
        result = await api.uploadFile(file, title || undefined);
      } else {
        result = await api.analyzeText(text, title || 'Untitled Interview');
      }
      onSuccess(result.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
        zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
      onClick={loading ? undefined : onClose}
    >
      <div
        style={{
          background: '#fff', borderRadius: 16, width: '100%', maxWidth: 560,
          boxShadow: '0 20px 60px rgba(0,0,0,0.18)', maxHeight: '90vh', overflowY: 'auto',
          padding: '28px 32px',
        }}
        onClick={e => e.stopPropagation()}
      >
        {loading ? (
          <AnalyzingLoader />
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>New Interview</h2>
                <p style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: 3 }}>
                  Upload a transcript to start AI-powered analysis
                </p>
              </div>
              <button
                onClick={onClose}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#9ca3af', padding: 4, lineHeight: 1 }}
              >✕</button>
            </div>

            <div className="tabs" style={{ marginBottom: '20px' }}>
              <button className={`tab-btn ${mode === 'file' ? 'active' : ''}`} onClick={() => setMode('file')}>Upload File</button>
              <button className={`tab-btn ${mode === 'text' ? 'active' : ''}`} onClick={() => setMode('text')}>Paste Text</button>
            </div>

            {error && <div className="error-msg">{error}</div>}

            <div className="form-group">
              <label>Interview Title</label>
              <input
                type="text"
                placeholder="e.g. User Interview — Sarah, PM — Jan 2024"
                value={title}
                onChange={e => setTitle(e.target.value)}
              />
            </div>

            {mode === 'file' ? (
              <>
                <div
                  className={`dropzone ${dragging ? 'active' : ''}`}
                  onClick={() => inputRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                >
                  <div className="dropzone-icon">📄</div>
                  <div className="dropzone-title">Drop your transcript here</div>
                  <div className="dropzone-sub">Click to browse · .txt, .pdf, .docx supported</div>
                  <input ref={inputRef} type="file" accept=".txt,.pdf,.docx" style={{ display: 'none' }} onChange={handleFileChange} />
                </div>
                {file && (
                  <div className="file-selected">
                    <span>📎</span>
                    <span className="name">{file.name}</span>
                    <span className="size">{(file.size / 1024).toFixed(1)} KB</span>
                    <button className="file-clear" onClick={e => { e.stopPropagation(); setFile(null); }}>✕</button>
                  </div>
                )}
              </>
            ) : (
              <div className="form-group">
                <label>Transcript Text</label>
                <textarea
                  placeholder={`Paste your full interview transcript here…\n\nExample:\nInterviewer: How do you manage your workflow?\nParticipant: Well, I usually start by…`}
                  value={text}
                  onChange={e => setText(e.target.value)}
                  style={{ minHeight: '160px' }}
                />
                {text.length > 0 && (
                  <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 4 }}>
                    {text.split(/\s+/).filter(Boolean).length} words
                  </div>
                )}
              </div>
            )}

            <div style={{ marginTop: '20px', display: 'flex', gap: '12px', alignItems: 'center' }}>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={!canSubmit}>
                ✨ Analyze with AI →
              </button>
              <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Research Hub ──────────────────────────────────────────────────────────────

export default function Upload() {
  const navigate = useNavigate();
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loadingTable, setLoadingTable] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const fetchInterviews = useCallback(() => {
    api.getInterviews()
      .then(data => {
        const sorted = [...data].sort(
          (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
        );
        setInterviews(sorted);
      })
      .finally(() => setLoadingTable(false));
  }, []);

  useEffect(() => { fetchInterviews(); }, [fetchInterviews]);

  const handleSuccess = (id: string) => {
    setShowModal(false);
    fetchInterviews();
    navigate(`/workspace/${id}`);
  };

  const analyzed      = interviews.filter(iv => !!iv.aiResult);
  const pending       = interviews.filter(iv => !iv.aiResult);
  const totalInsights = analyzed.reduce((sum, iv) => {
    const r = iv.aiResult!;
    return sum + r.painPoints.length + r.mainThemes.length + r.keyQuotes.length;
  }, 0);

  const STATS = [
    { label: 'Total Interviews', value: interviews.length, icon: '👥', color: '#111827' },
    { label: 'Analyzed',         value: analyzed.length,   icon: '✓',  color: '#111827' },
    { label: 'Pending',          value: pending.length,    icon: '○',  color: '#111827' },
    { label: 'Total Insights',   value: totalInsights,     icon: '💡', color: '#111827' },
  ];

  return (
    <div style={{ padding: '28px 36px', maxWidth: 1140, margin: '0 auto' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 4 }}>Research Hub</h1>
          <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
            Manage your interview transcripts and AI-generated insights
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + New Interview
        </button>
      </div>

      {/* ── Stats bar ── */}
      <div
        className="synthesis-stats-bar"
        style={{ borderRadius: 12, marginBottom: 24, border: '1px solid #e5e7eb' }}
      >
        {STATS.map((c, i) => (
          <div key={i} className="stat-card">
            <div className="stat-icon-wrap">{c.icon}</div>
            <div className="stat-value" style={{ color: c.color }}>{c.value}</div>
            <div className="stat-label">{c.label}</div>
          </div>
        ))}
      </div>

      {/* ── Table ── */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>

        {/* Table header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '36px 1fr 130px 90px 60px 70px 100px 280px',
          padding: '10px 20px',
          background: '#f9fafb',
          borderBottom: '1px solid #e5e7eb',
          fontSize: '0.7rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: '#4b5563',
          gap: 8,
          alignItems: 'center',
        }}>
          <span>#</span>
          <span>Title</span>
          <span>Date Uploaded</span>
          <span>File</span>
          <span>Themes</span>
          <span>Pain Pts</span>
          <span>Status</span>
          <span>Actions</span>
        </div>

        {/* Body */}
        {loadingTable ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
            <div className="spinner" />
          </div>
        ) : interviews.length === 0 ? (
          <div className="empty-state">
            <h3>No interviews yet</h3>
            <p>Upload your first transcript to get started</p>
            <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={() => setShowModal(true)}>
              + New Interview
            </button>
          </div>
        ) : (
          interviews.map((iv, idx) => {
            const isAnalyzed = !!iv.aiResult;
            const themeCount = iv.aiResult?.mainThemes?.length ?? 0;
            const painCount  = iv.aiResult?.painPoints?.length ?? 0;
            const date       = new Date(iv.uploadedAt);
            const dateStr    = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            const timeStr    = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

            return (
              <div
                key={iv.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '36px 1fr 130px 90px 60px 70px 100px 280px',
                  padding: '13px 20px',
                  borderBottom: '1px solid #f3f4f6',
                  fontSize: '0.875rem',
                  gap: 8,
                  alignItems: 'center',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {/* # */}
                <span style={{ color: '#9ca3af', fontSize: '0.75rem', fontWeight: 600 }}>
                  {idx + 1}
                </span>

                {/* Title */}
                <div
                  style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  title={iv.title}
                >
                  {iv.title}
                </div>

                {/* Date */}
                <div>
                  <div style={{ fontSize: '0.8rem', color: '#374151' }}>{dateStr}</div>
                  <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>{timeStr}</div>
                </div>

                {/* File */}
                <div
                  style={{ fontSize: '0.75rem', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  title={iv.fileName}
                >
                  {iv.fileName}
                </div>

                {/* Themes */}
                <div>
                  {isAnalyzed
                    ? <span className="tag tag-purple">{themeCount}</span>
                    : <span style={{ color: '#d1d5db' }}>—</span>
                  }
                </div>

                {/* Pain Points */}
                <div>
                  {isAnalyzed
                    ? <span className="tag tag-red">{painCount}</span>
                    : <span style={{ color: '#d1d5db' }}>—</span>
                  }
                </div>

                {/* Status */}
                <div>
                  {isAnalyzed
                    ? <span className="tag tag-green">✓ Analyzed</span>
                    : <span className="tag tag-yellow">Pending</span>
                  }
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <Link to={`/workspace/${iv.id}`} className="btn-wired">
                    <span className="wired-icon"><IconWorkspace /></span>
                    Workspace
                  </Link>
                  <Link to="/insights" className="btn-wired">
                    <span className="wired-icon"><IconInsights /></span>
                    Insights
                  </Link>
                  {isAnalyzed ? (
                    <Link to={`/report/${iv.id}`} className="btn-wired">
                      <span className="wired-icon"><IconReport /></span>
                      Report
                    </Link>
                  ) : (
                    <button className="btn-wired" disabled title="Analyze first to generate report">
                      <span className="wired-icon"><IconReport /></span>
                      Report
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {analyzed.length > 0 && (
        <NextStepBanner
          icon="💡"
          title="Review your insights"
          description="Browse AI-extracted pain points, themes, and quotes from your interviews"
          to="/insights"
          buttonText="View Insights →"
        />
      )}

      {/* ── Modal ── */}
      {showModal && (
        <UploadModal
          onClose={() => setShowModal(false)}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}
