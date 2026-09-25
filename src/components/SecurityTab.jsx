import { useState } from 'react'
import { SEVERITIES, SEVERITY_LABELS } from '../analyzer/security.js'
import { AdvisoryList, Badge, Card, Empty, SEVERITY_TONE, VulnSourceNote } from './ui.jsx'

export default function SecurityTab({ security, vulnCheck }) {
  const [active, setActive] = useState(() => new Set(SEVERITIES.filter((s) => s !== 'info')))
  const [q, setQ] = useState('')
  const toggle = (s) => {
    const next = new Set(active)
    next.has(s) ? next.delete(s) : next.add(s)
    setActive(next)
  }
  const list = security.findings.filter(
    (f) => active.has(f.severity) && (!q || `${f.title} ${f.file} ${f.description}`.toLowerCase().includes(q.toLowerCase())),
  )

  const gradeTone = { A: 'good', B: 'good', C: 'warn', D: 'bad', F: 'bad' }[security.grade]

  return (
    <div className="stack">
      <div className="score-row">
        <div className={`score ${gradeTone}`}>
          <span className="score-grade">{security.grade}</span>
          <span className="score-num">{security.score}/100</span>
        </div>
        <div className="sev-filters">
          {SEVERITIES.map((s) => (
            <button key={s} className={`sev-chip ${s} ${active.has(s) ? 'on' : ''}`} onClick={() => toggle(s)} aria-pressed={active.has(s)}>
              <strong>{security.counts[s]}</strong> {SEVERITY_LABELS[s]}
            </button>
          ))}
          <input className="search" placeholder="Filtrar hallazgos…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      <p className="muted small">
        Análisis estático por reglas: puede haber falsos positivos y no reemplaza a una auditoría manual.
      </p>
      <VulnSourceNote vulnCheck={vulnCheck} />

      {list.length ? (
        <div className="findings">
          {list.map((f, i) => (
            <article key={i} className={`finding ${f.severity}`}>
              <header>
                <Badge tone={SEVERITY_TONE[f.severity]}>{SEVERITY_LABELS[f.severity]}</Badge>
                <h4>{f.title}</h4>
              </header>
              <p>{f.description}</p>
              <div className="finding-loc mono small">
                {f.file}
                {f.line ? `:${f.line}` : ''}
              </div>
              {f.snippet && <code className="snippet block">{f.snippet}</code>}
              {f.advisories?.length > 1 && (
                <details className="adv-details">
                  <summary>Ver las {f.advisories.length} vulnerabilidades</summary>
                  <AdvisoryList advisories={f.advisories} />
                </details>
              )}
              {f.advisories?.length === 1 && f.advisories[0].url && (
                <a className="small" href={f.advisories[0].url} target="_blank" rel="noopener noreferrer">Ver aviso {f.advisories[0].id} ↗</a>
              )}
            </article>
          ))}
        </div>
      ) : (
        <Card>
          <Empty>{security.findings.length ? 'No hay hallazgos con los filtros seleccionados.' : '¡Sin hallazgos de seguridad!'}</Empty>
        </Card>
      )}
    </div>
  )
}
