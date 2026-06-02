import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { Interview } from '../types';

type Status = 'pending' | 'approved' | 'rejected';

interface FlatInsight {
  id: string;
  content: string;
  type: 'pain_point' | 'theme' | 'quote';
  interviewId: string;
}

const TYPE_LABEL: Record<string, string> = {
  pain_point: 'Pain Point',
  theme: 'Theme',
  quote: 'Key Quote'
};

const TYPE_COLOR: Record<string, string> = {
  pain_point: 'tag-red',
  theme: 'tag-purple',
  quote: 'tag-blue'
};

function buildInsights(interview: Interview): FlatInsight[] {
  if (!interview.aiResult) return [];
  const { painPoints, mainThemes, keyQuotes } = interview.aiResult;
  return [
    ...painPoints.map((p, i) => ({ id: `${interview.id}-pain-${i}`, content: p, type: 'pain_point' as const, interviewId: interview.id })),
    ...mainThemes.map((t, i) => ({ id: `${interview.id}-theme-${i}`, content: t, type: 'theme' as const, interviewId: interview.id })),
    ...keyQuotes.map((q, i) => ({ id: `${interview.id}-quote-${i}`, content: q, type: 'quote' as const, interviewId: interview.id }))
  ];
}

export default function Insights() {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [statuses, setStatuses] = useState<Record<string, Status>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  useEffect(() => {
    api.getInterviews()
      .then(data => setInterviews(data))
      .finally(() => setLoading(false));
  }, []);

  const getStatus = (id: string): Status => statuses[id] ?? 'pending';
  const setStatus = (id: string, s: Status) => setStatuses(prev => ({ ...prev, [id]: s }));

  const startEdit = (insight: FlatInsight) => {
    setEditingId(insight.id);
    setEditContent(overrides[insight.id] ?? insight.content);
  };

  const commitEdit = (id: string) => {
    setOverrides(prev => ({ ...prev, [id]: editContent }));
    setEditingId(null);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <div className="spinner" />
      </div>
    );
  }

  if (interviews.length === 0) {
    return (
      <div className="insights-page">
        <h1>Insights</h1>
        <div className="empty-state">
          <h3>No interviews yet</h3>
          <p>Upload a transcript to generate insights</p>
          <Link to="/upload" className="btn btn-primary">Upload Interview</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="insights-page">
      <div className="page-header">
        <h1>Insights</h1>
        <Link to="/upload" className="btn btn-primary btn-sm">+ New Interview</Link>
      </div>

      {interviews.map(interview => {
        const insights = buildInsights(interview);
        if (insights.length === 0) return null;

        const approvedCount = insights.filter(i => getStatus(i.id) === 'approved').length;
        const rejectedCount = insights.filter(i => getStatus(i.id) === 'rejected').length;
        const pendingCount  = insights.filter(i => getStatus(i.id) === 'pending').length;

        return (
          <div key={interview.id} className="interview-section">
            <div className="interview-section-header">
              <h2>{interview.title}</h2>
              <div className="interview-section-actions">
                {approvedCount > 0 && <span className="tag tag-green">{approvedCount} approved</span>}
                {rejectedCount > 0 && <span className="tag tag-red">{rejectedCount} rejected</span>}
                {pendingCount > 0  && <span className="tag tag-yellow">{pendingCount} pending</span>}
                <Link to={`/workspace/${interview.id}`} className="btn btn-ghost btn-sm">Workspace</Link>
                <Link to={`/report/${interview.id}`} className="btn btn-secondary btn-sm">Report →</Link>
              </div>
            </div>

            {insights.map(insight => {
              const status = getStatus(insight.id);
              const isEditing = editingId === insight.id;
              const content = overrides[insight.id] ?? insight.content;

              return (
                <div key={insight.id} className={`insight-card ${status}`}>
                  <div className="insight-body">
                    <div className="insight-meta">
                      <span className={`tag ${TYPE_COLOR[insight.type]}`}>
                        {TYPE_LABEL[insight.type]}
                      </span>
                      <span className={`tag status-${status}`}>{status}</span>
                    </div>
                    {isEditing ? (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        <textarea
                          className="edit-area"
                          value={editContent}
                          onChange={e => setEditContent(e.target.value)}
                          rows={2}
                          style={{ flex: 1 }}
                          autoFocus
                        />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <button className="btn btn-success btn-sm" onClick={() => commitEdit(insight.id)}>
                            Save
                          </button>
                          <button className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="insight-content">{content}</div>
                    )}
                  </div>

                  {!isEditing && (
                    <div className="insight-actions">
                      <button
                        className="btn btn-success btn-sm"
                        onClick={() => setStatus(insight.id, 'approved')}
                        disabled={status === 'approved'}
                        title="Approve"
                      >
                        ✓
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => setStatus(insight.id, 'rejected')}
                        disabled={status === 'rejected'}
                        title="Reject"
                      >
                        ✗
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => startEdit(insight)}
                        title="Edit"
                      >
                        ✎
                      </button>
                      {status !== 'pending' && (
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => setStatus(insight.id, 'pending')}
                          title="Reset to pending"
                        >
                          ↺
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
