import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client';
import { Report, Cluster } from '../types';

export default function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.getReport(id)
      .then(data => setReport(data))
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load report'))
      .finally(() => setLoading(false));
  }, [id]);

  const downloadMarkdown = async () => {
    if (!id || !report) return;
    setDownloading(true);
    try {
      const md = await api.getReportMarkdown(id);
      const blob = new Blob([md], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${report.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-report.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <div className="spinner" />
      </div>
    );
  }

  if (error) return <div style={{ padding: 24 }}><div className="error-msg">{error}</div></div>;
  if (!report) return <div style={{ padding: 24 }}>Report not found.</div>;

  return (
    <div className="report-page">
      <div className="breadcrumb">
        <Link to="/insights">Insights</Link>
        <span>/</span>
        <Link to={`/workspace/${id}`}>Workspace</Link>
        <span>/</span>
        <span>Report</span>
      </div>

      <div className="report-header">
        <div>
          <div className="report-title">{report.title}</div>
          <div className="report-meta">
            Uploaded {new Date(report.uploadedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            {' · '}
            Generated {new Date(report.generatedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
        <button
          className="btn btn-primary"
          onClick={downloadMarkdown}
          disabled={downloading}
        >
          {downloading ? 'Downloading…' : '↓ Download .md'}
        </button>
      </div>

      {/* Summary */}
      <div className="report-section">
        <h2>Executive Summary</h2>
        <p className="report-summary">{report.summary}</p>
      </div>

      {/* Pain Points */}
      <div className="report-section">
        <h2>Pain Points</h2>
        <ul className="pain-list">
          {report.painPoints.map((p, i) => <li key={i}>{p}</li>)}
        </ul>
      </div>

      {/* Key Quotes */}
      <div className="report-section">
        <h2>Key Quotes</h2>
        {report.keyQuotes.map((q, i) => (
          <div key={i} className="report-quote">{q}</div>
        ))}
      </div>

      {/* Themes */}
      <div className="report-section">
        <h2>Main Themes</h2>
        <ul className="theme-pill-list">
          {report.mainThemes.map((t, i) => <li key={i}>{t}</li>)}
        </ul>
      </div>

      {/* Clusters */}
      <div className="report-section">
        <h2>Affinity Clusters</h2>
        {report.clusters.map((cluster: Cluster) => (
          <div key={cluster.id} className="cluster-card" style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 5 }}>{cluster.name}</div>
            <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: 10, lineHeight: 1.5 }}>
              {cluster.description}
            </div>
            <div className="theme-tags">
              {cluster.themes.map((t, i) => (
                <span key={i} className="tag tag-blue">{t}</span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 40, paddingTop: 20, borderTop: '1px solid #f3f4f6', display: 'flex', gap: 10 }}>
        <Link to={`/workspace/${id}`} className="btn btn-ghost btn-sm">← Back to Workspace</Link>
        <Link to="/insights" className="btn btn-ghost btn-sm">All Insights</Link>
      </div>
    </div>
  );
}
