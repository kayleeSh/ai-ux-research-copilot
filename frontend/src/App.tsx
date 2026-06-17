import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import Upload from './pages/Upload';
import Workspace from './pages/Workspace';
import Insights from './pages/Insights';
import Report from './pages/Report';
import Synthesis from './pages/Synthesis';
import Decisions from './pages/Decisions';
import Problems from './pages/Problems';
import Playbook from './pages/Briefing';

interface TokenStatus { used: number; limit: number; remaining: number }

function TokenIndicator() {
  const [status, setStatus] = useState<TokenStatus | null>(null);

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch('/api/token-status');
        if (res.ok) setStatus(await res.json() as TokenStatus);
      } catch { /* backend not ready */ }
    };
    poll();
    const id = setInterval(poll, 10000);
    return () => clearInterval(id);
  }, []);

  if (!status) return null;

  const pct = Math.min(100, (status.used / status.limit) * 100);
  const color  = pct < 60 ? '#059669' : pct < 85 ? '#d97706' : '#dc2626';
  const bg     = pct < 60 ? '#f0fdf4' : pct < 85 ? '#fffbeb' : '#fef2f2';
  const border = pct < 60 ? '#bbf7d0' : pct < 85 ? '#fde68a' : '#fca5a5';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      background: bg, border: `1px solid ${border}`,
      borderRadius: 100, padding: '4px 12px',
    }}>
      <div style={{ width: 44, height: 4, background: '#e5e7eb', borderRadius: 100, overflow: 'hidden' }}>
        <div style={{
          width: `${pct}%`, height: '100%', background: color,
          borderRadius: 100, transition: 'width 0.4s ease'
        }} />
      </div>
      <span style={{ fontSize: '0.72rem', fontWeight: 600, color, whiteSpace: 'nowrap' }}>
        {status.used.toLocaleString()} / {status.limit.toLocaleString()} TPM
      </span>
      <div className="tpm-info">
        <span className="tpm-info-icon">ⓘ</span>
        <div className="tpm-tooltip">
          <div className="tpm-tooltip-arrow" />
          <p style={{ fontWeight: 700, marginBottom: 6, fontSize: '0.78rem' }}>AI Token Usage (last 60s)</p>
          <p style={{ marginBottom: 8, lineHeight: 1.5 }}>
            Groq free tier allows <strong>6,000 tokens per minute (TPM)</strong>.
            Each AI call consumes tokens — if the limit is reached, the app waits and retries automatically.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span><span style={{ color: '#4ade80' }}>●</span> Green — plenty of capacity</span>
            <span><span style={{ color: '#fbbf24' }}>●</span> Amber — getting tight</span>
            <span><span style={{ color: '#f87171' }}>●</span> Red — near limit, AI calls may be delayed</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Nav() {
  const loc = useLocation();
  const isActive = (path: string) =>
    loc.pathname === path ||
    (path === '/upload' && loc.pathname.startsWith('/workspace')) ||
    (path !== '/upload' && loc.pathname.startsWith(path));

  return (
    <nav className="nav">
      <Link to="/upload" className="nav-brand">
        <span className="nav-logo">🔬</span>
        <span>UX Research Copilot</span>
      </Link>
      <div className="nav-links">
        <Link to="/upload" className={isActive('/upload') ? 'active' : ''}>
          Upload
        </Link>
        <Link to="/insights" className={isActive('/insights') ? 'active' : ''}>
          Insights
        </Link>
        <Link to="/synthesis" className={isActive('/synthesis') ? 'active' : ''}>
          Synthesis
        </Link>
        <Link to="/problems" className={isActive('/problems') ? 'active' : ''}>
          Problems
        </Link>
        <Link to="/playbook" className={isActive('/playbook') ? 'active' : ''}>
          Playbook
        </Link>
        <Link to="/decisions" className={isActive('/decisions') ? 'active' : ''}>
          Decisions
        </Link>
      </div>
      <TokenIndicator />
    </nav>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Nav />
      <main className="main">
        <Routes>
          <Route path="/" element={<Navigate to="/upload" replace />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/workspace/:id" element={<Workspace />} />
          <Route path="/insights" element={<Insights />} />
          <Route path="/report/:id" element={<Report />} />
          <Route path="/synthesis" element={<Synthesis />} />
          <Route path="/decisions" element={<Decisions />} />
          <Route path="/problems" element={<Problems />} />
          <Route path="/playbook" element={<Playbook />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}
