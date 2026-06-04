import { useState, useRef, DragEvent, ChangeEvent, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client';
import { Interview } from '../types';

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
    <div className="upload-page">
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
    </div>
  );
}

function RecentUploads({ refreshKey }: { refreshKey: number }) {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getInterviews()
      .then(data => {
        const sorted = [...data].sort(
          (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
        );
        setInterviews(sorted.slice(0, 6));
      })
      .finally(() => setLoading(false));
  }, [refreshKey]);

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}><div className="spinner" /></div>;
  if (interviews.length === 0) return null;

  return (
    <div style={{ marginTop: 36 }}>
      <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9ca3af', marginBottom: 12 }}>
        Recent Uploads
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {interviews.map(iv => {
          const date = new Date(iv.uploadedAt);
          const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
          const isAnalyzed = !!iv.aiResult;
          const themeCount = iv.aiResult?.mainThemes?.length ?? 0;
          const painCount  = iv.aiResult?.painPoints?.length ?? 0;

          return (
            <div key={iv.id} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '11px 14px',
              background: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: 10,
              transition: 'border-color 0.12s',
            }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#a5b4fc')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = '#e5e7eb')}
            >
              {/* File icon */}
              <div style={{ fontSize: '1.4rem', flexShrink: 0 }}>📄</div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {iv.title}
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 3, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{dateStr} · {timeStr}</span>
                  <span style={{ fontSize: '0.72rem', color: '#6b7280' }}>{iv.fileName}</span>
                </div>
              </div>

              {/* Stats + status */}
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {isAnalyzed ? (
                  <>
                    {themeCount > 0 && (
                      <span className="tag tag-purple">{themeCount} themes</span>
                    )}
                    {painCount > 0 && (
                      <span className="tag tag-red">{painCount} pain pts</span>
                    )}
                    <span className="tag tag-green">✓ Analyzed</span>
                  </>
                ) : (
                  <span className="tag tag-yellow">Pending</span>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <Link to={`/workspace/${iv.id}`} className="btn btn-ghost btn-sm">Workspace</Link>
                {isAnalyzed && (
                  <Link to={`/report/${iv.id}`} className="btn btn-secondary btn-sm">Report →</Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Upload() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'file' | 'text'>('file');
  const [refreshKey, setRefreshKey] = useState(0);
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
      setRefreshKey(k => k + 1);
      navigate(`/workspace/${result.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setLoading(false);
    }
  };

  if (loading) return <AnalyzingLoader />;

  return (
    <div className="upload-page">
      <h1>Upload Interview</h1>
      <p className="subtitle">Upload a transcript file or paste text to start AI-powered UX analysis</p>

      <div className="tabs" style={{ marginBottom: '24px' }}>
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
            style={{ minHeight: '180px' }}
          />
          {text.length > 0 && (
            <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 4 }}>
              {text.split(/\s+/).filter(Boolean).length} words
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: '24px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={handleSubmit} disabled={!canSubmit}>
          ✨ Analyze with AI →
        </button>
        <span style={{ fontSize: '0.78rem', color: '#9ca3af' }}>Extracts summary, quotes, pain points &amp; themes</span>
      </div>

      <div className="divider">or explore sample data</div>

      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <Link to="/workspace/mock-001" className="btn btn-ghost btn-sm">View Sample Workspace →</Link>
        <Link to="/insights" className="btn btn-ghost btn-sm">Browse Insights →</Link>
        <Link to="/synthesis" className="btn btn-ghost btn-sm">Cross-Interview Synthesis →</Link>
      </div>

      <RecentUploads refreshKey={refreshKey} />
    </div>
  );
}
