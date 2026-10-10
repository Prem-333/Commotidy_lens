import type { ReactNode } from 'react';
import { ArrowUpRight, ChevronDown, Info, RefreshCw, ShieldCheck, Telescope } from 'lucide-react';
import { Button } from './ui/button';
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand">
      <span className="lens-mark">
        <span />
      </span>
      {!compact && (
        <span>
          Commodity<span className="gold-text">Lens</span>
          <small>GOLD. IN PERSPECTIVE.</small>
        </span>
      )}
    </span>
  );
}
export function Method({ children }: { children: ReactNode }) {
  return (
    <details className="method">
      <summary>
        <Info size={15} /> How is this calculated?
        <ChevronDown size={15} />
      </summary>
      <div>{children}</div>
    </details>
  );
}
export function Kpi({
  label,
  value,
  detail,
  tone = '',
  tip,
}: {
  label: string;
  value: ReactNode;
  detail: ReactNode;
  tone?: string;
  tip: string;
}) {
  return (
    <div className="kpi" title={tip}>
      <div className="kpi-label">
        {label}
        <Info size={12} />
      </div>
      <div className={`kpi-value ${tone}`}>{value}</div>
      <div className="kpi-detail">{detail}</div>
    </div>
  );
}
export function Loading() {
  return (
    <div role="status" aria-label="Loading analytics" className="loading-grid">
      {[0, 1, 2, 3].map((v) => (
        <div key={v} className="skeleton" />
      ))}
      <span className="sr-only">Loading analytics…</span>
    </div>
  );
}
export function ErrorState({ error, retry }: { error: Error; retry?: () => void }) {
  return (
    <div className="empty error-state" role="alert">
      <Info />
      <h3>We couldn’t load this view</h3>
      <p>{error.message}</p>
      {retry && (
        <Button variant="outline" onClick={retry}>
          <RefreshCw size={14} />
          Try again
        </Button>
      )}
    </div>
  );
}
export function Empty({
  text = 'No meaningful dislocation. Markets are fairly priced.',
  detail = 'We stay quiet when there’s nothing to say.',
}: {
  text?: string;
  detail?: string;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Telescope size={25} />
      </span>
      <h3>{text}</h3>
      <p>{detail}</p>
    </div>
  );
}
export function Panel({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h3>{title}</h3>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
export function IntegrityNote() {
  return (
    <div className="integrity-note">
      <ShieldCheck size={16} />
      <span>
        Evidence before conviction. Every value comes from the selected dataset. Research only; not investment
        advice.
      </span>
      <ArrowUpRight size={15} />
    </div>
  );
}
