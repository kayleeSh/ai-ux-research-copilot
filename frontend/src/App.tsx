import { BrowserRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import Upload from './pages/Upload';
import Workspace from './pages/Workspace';
import Insights from './pages/Insights';
import Report from './pages/Report';
import Synthesis from './pages/Synthesis';

function Nav() {
  const loc = useLocation();
  const isActive = (path: string) =>
    loc.pathname === path || (path !== '/upload' && loc.pathname.startsWith(path));

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
      </div>
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
        </Routes>
      </main>
    </BrowserRouter>
  );
}
