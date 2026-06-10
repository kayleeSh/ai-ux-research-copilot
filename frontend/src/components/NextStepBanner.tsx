import { Link } from 'react-router-dom';

interface NextStepBannerProps {
  icon: string;
  title: string;
  description: string;
  to: string;
  buttonText: string;
}

export function NextStepBanner({ icon, title, description, to, buttonText }: NextStepBannerProps) {
  return (
    <div
      className="synthesis-section"
      style={{ marginTop: 32, padding: '18px 24px', borderLeft: '3px solid #0d9488', background: '#f0fdfa' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <span style={{ fontSize: '1.4rem', flexShrink: 0 }}>{icon}</span>
          <div>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#0d9488', marginBottom: 4 }}>
              Next Step
            </div>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#111827', marginBottom: 3 }}>{title}</div>
            <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{description}</div>
          </div>
        </div>
        <Link to={to} className="btn btn-primary" style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
          {buttonText}
        </Link>
      </div>
    </div>
  );
}
