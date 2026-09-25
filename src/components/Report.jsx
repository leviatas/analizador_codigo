import { useState } from 'react'
import { Badge, Card, Stat, SEVERITY_TONE } from './ui.jsx'
import { SEVERITY_LABELS } from '../analyzer/security.js'
import LibrariesTab from './LibrariesTab.jsx'
import AITab from './AITab.jsx'
import SecurityTab from './SecurityTab.jsx'
import UsageTab from './UsageTab.jsx'

const TABS = [
  { id: 'summary', label: 'Resumen' },
  { id: 'libraries', label: 'Librerías' },
  { id: 'ai', label: 'IA' },
  { id: 'security', label: 'Seguridad' },
  { id: 'usage', label: 'Uso general' },
]

export default function Report({ report }) {
  const [tab, setTab] = useState('summary')
  const { meta, dependencies: d, ai, security: s, usage: u } = report

  const counts = {
    libraries: d.totals.declared,
    ai: ai.usesAI ? ai.providers.length || '✓' : null,
    security: s.counts.critical + s.counts.high + s.counts.medium || null,
  }

  return (
    <main className="report">
      <div className="report-head">
        <div>
          <h1>{meta.name}</h1>
          <p className="muted">
            {u.projectType}
            {u.next.router ? ` · ${u.next.router}` : ''}
            {meta.version ? ` · v${meta.version}` : ''} · {meta.filesAnalyzed} archivos analizados
            {meta.filesSkipped ? ` (${meta.filesSkipped} omitidos)` : ''} · {meta.durationMs} ms
          </p>
        </div>
      </div>

      <nav className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
            {t.label}
            {counts[t.id] ? <span className="tab-count">{counts[t.id]}</span> : null}
          </button>
        ))}
      </nav>

      {tab === 'summary' && <Summary report={report} go={setTab} />}
      {tab === 'libraries' && <LibrariesTab deps={d} vulnCheck={meta.vulnCheck} />}
      {tab === 'ai' && <AITab ai={ai} />}
      {tab === 'security' && <SecurityTab security={s} vulnCheck={meta.vulnCheck} />}
      {tab === 'usage' && <UsageTab usage={u} deps={d} />}
    </main>
  )
}

function Summary({ report, go }) {
  const { dependencies: d, ai, security: s, usage: u } = report
  const gradeTone = { A: 'good', B: 'good', C: 'warn', D: 'bad', F: 'bad' }[s.grade]
  return (
    <div className="stack">
      <div className="grid-4">
        <button className="card clickable" onClick={() => go('libraries')}>
          <Stat label="Librerías" value={d.totals.declared} hint={`${d.totals.external} ajenas · ${d.totals.own} propias`} />
        </button>
        <button className="card clickable" onClick={() => go('ai')}>
          <Stat
            label="Usa IA"
            value={ai.usesAI ? (ai.confidence === 'high' ? 'Sí' : 'Posible') : 'No'}
            tone={ai.usesAI ? 'info' : ''}
            hint={ai.providers.map((p) => p.name).join(', ') || 'Sin proveedores detectados'}
          />
        </button>
        <button className="card clickable" onClick={() => go('security')}>
          <Stat label="Seguridad" value={`${s.score}/100`} tone={gradeTone} hint={`Nota ${s.grade} · ${s.findings.length} hallazgos`} />
        </button>
        <button className="card clickable" onClick={() => go('usage')}>
          <Stat
            label="Tamaño"
            value={u.totals.lines.toLocaleString('es-AR')}
            hint={`líneas · ${u.totals.codeFiles} archivos de código`}
          />
        </button>
      </div>

      <Card title="Conclusiones">
        <ul className="highlights">
          {report.highlights.map((h, i) => (
            <li key={i} className={h.tone}>
              {h.text}
            </li>
          ))}
        </ul>
      </Card>

      <div className="grid-2">
        <Card title="Stack detectado">
          <dl className="kv">
            {Object.entries(u.stack).map(([cat, libs]) => (
              <div key={cat}>
                <dt>{cat}</dt>
                <dd>{libs.join(', ')}</dd>
              </div>
            ))}
            {u.styling.length > 0 && (
              <div>
                <dt>Enfoque de estilos</dt>
                <dd>{u.styling.join(', ')}</dd>
              </div>
            )}
          </dl>
        </Card>
        <Card title="Seguridad por severidad" actions={<button className="link" onClick={() => go('security')}>Ver detalle →</button>}>
          <div className="sev-grid">
            {[
              ['critical', 'Críticas'],
              ['high', 'Altas'],
              ['medium', 'Medias'],
              ['low', 'Bajas'],
              ['info', 'Info'],
            ].map(([k, label]) => (
              <div key={k} className={`sev-box ${k} ${s.counts[k] ? '' : 'zero'}`}>
                <span className="sev-num">{s.counts[k]}</span>
                <span>{label}</span>
              </div>
            ))}
          </div>
          {s.findings.slice(0, 5).map((f, i) => (
            <div key={i} className="mini-finding">
              <Badge tone={SEVERITY_TONE[f.severity]}>{SEVERITY_LABELS[f.severity]}</Badge>
              <span>{f.title}</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  )
}
