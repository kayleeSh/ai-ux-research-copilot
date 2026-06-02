import { useState, useRef, DragEvent, ChangeEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client';

export default function Upload() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [streamText, setStreamText] = useState('');
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
    setStreamText('');

    try {
      if (mode === 'file' && file) {
        // File upload uses non-streaming path (needs multipart form)
        const result = await api.uploadFile(file, title || undefined);
        navigate(`/workspace/${result.id}`);
      } else {
        // Text uses streaming — show AI typing in real-time
        const result = await api.analyzeTextStream(
          text,
          title || 'Untitled Interview',
          (accumulated) => setStreamText(accumulated)
        );
        navigate(`/workspace/${result.id}`);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setLoading(false);
      setStreamText('');
    }
  };

  if (loading) {
    return (
      <div className="upload-page">
        <div className="stream-loading">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div className="spinner" />
            <span style={{ fontWeight: 600 }}>AI is analyzing your transcript…</span>
          </div>
          {streamText ? (
            <div className="stream-preview">
              <div className="stream-label">Live AI output</div>
              <pre className="stream-text">{streamText}<span className="stream-cursor" /></pre>
            </div>
          ) : (
            <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Connecting to AI…</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="upload-page">
      <h1>Upload Interview</h1>
      <p className="subtitle">Upload a transcript file or paste text to start AI-powered UX analysis</p>

      <div className="tabs" style={{ marginBottom: '24px' }}>
        <button className={`tab-btn ${mode === 'file' ? 'active' : ''}`} onClick={() => setMode('file')}>
          Upload File
        </button>
        <button className={`tab-btn ${mode === 'text' ? 'active' : ''}`} onClick={() => setMode('text')}>
          Paste Text
        </button>
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
          Analyze with AI →
        </button>
        <span style={{ fontSize: '0.78rem', color: '#9ca3af' }}>
          {mode === 'text' ? 'Streams results in real-time' : 'Extracts text then analyzes'}
        </span>
      </div>

      <div className="divider">or explore sample data</div>

      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <Link to="/workspace/mock-001" className="btn btn-ghost btn-sm">View Sample Workspace →</Link>
        <Link to="/insights" className="btn btn-ghost btn-sm">Browse Insights →</Link>
        <Link to="/synthesis" className="btn btn-ghost btn-sm">Cross-Interview Synthesis →</Link>
      </div>
    </div>
  );
}
