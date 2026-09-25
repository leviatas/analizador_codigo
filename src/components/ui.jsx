import { useState } from 'react'

export function Badge({ tone = 'neutral', children, title }) {
  return (
    <span className={`badge ${tone}`} title={title}>
      {children}
    </span>
  )
}

export function Card({ title, subtitle, children, className = '', actions }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <header className="card-head">
          <div>
            {title && <h3>{title}</h3>}
            {subtitle && <p className="muted small">{subtitle}</p>}
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  )
}

export function Stat({ label, value, hint, tone }) {
  return (
    <div className={`stat ${tone ?? ''}`}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {hint && <span className="stat-hint muted">{hint}</span>}
    </div>
  )
}

/** Lista de barras horizontales simple. items: [{ label, value, tone? }] */
export function Bars({ items, max, format = (v) => v }) {
  const top = max ?? Math.max(1, ...items.map((i) => i.value))
  return (
    <div className="bars">
      {items.map((i) => (
        <div className="bar-row" key={i.label}>
          <span className="bar-label" title={i.label}>{i.label}</span>
          <span className="bar-track">
            <span className={`bar-fill ${i.tone ?? ''}`} style={{ width: `${Math.max(2, (i.value / top) * 100)}%` }} />
          </span>
          <span className="bar-value">{format(i.value)}</span>
        </div>
      ))}
    </div>
  )
}

export function FileList({ files, limit = 8 }) {
  const [open, setOpen] = useState(false)
  if (!files?.length) return <span className="muted">—</span>
  const shown = open ? files : files.slice(0, limit)
  return (
    <ul className="file-list">
      {shown.map((f) => (
        <li key={f} className="mono">{f}</li>
      ))}
      {files.length > limit && (
        <li>
          <button className="link" onClick={() => setOpen(!open)}>
            {open ? 'Ver menos' : `+ ${files.length - limit} más`}
          </button>
        </li>
      )}
    </ul>
  )
}

export function Empty({ children }) {
  return <p className="empty muted">{children}</p>
}

export const SEVERITY_TONE = { critical: 'critical', high: 'bad', medium: 'warn', low: 'low', info: 'neutral' }
