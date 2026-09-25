import { Fragment, useMemo, useState } from 'react'
import { Badge, Bars, Card, Empty, FileList, Stat } from './ui.jsx'

const TYPE_LABELS = {
  dependencies: 'prod',
  devDependencies: 'dev',
  peerDependencies: 'peer',
  optionalDependencies: 'opcional',
  workspace: 'workspace',
}

export default function LibrariesTab({ deps }) {
  const [q, setQ] = useState('')
  const [owner, setOwner] = useState('all')
  const [type, setType] = useState('all')
  const [category, setCategory] = useState('all')
  const [expanded, setExpanded] = useState(null)

  const categories = useMemo(() => [...new Set(deps.libraries.map((l) => l.categoryLabel))].sort(), [deps])
  const list = deps.libraries.filter(
    (l) =>
      (!q || l.name.toLowerCase().includes(q.toLowerCase())) &&
      (owner === 'all' || l.ownership === owner) &&
      (type === 'all' || l.type === type) &&
      (category === 'all' || l.categoryLabel === category),
  )
  const t = deps.totals

  return (
    <div className="stack">
      <div className="grid-4">
        <div className="card"><Stat label="Declaradas" value={t.declared} hint={`${t.dependencies} prod · ${t.devDependencies} dev`} /></div>
        <div className="card"><Stat label="Ajenas / Propias" value={`${t.external} / ${t.own}`} hint="terceros vs. propias del proyecto u org" /></div>
        <div className="card"><Stat label="Imports" value={t.imports} hint={`${t.internalImports} a módulos internos`} /></div>
        <div className="card">
          <Stat label="Con vulnerabilidades" value={t.vulnerable} tone={t.vulnerable ? 'bad' : 'good'} hint={deps.lockfile ? `lockfile: ${deps.lockfile.type}` : 'sin lockfile (versión estimada)'} />
        </div>
      </div>

      <div className="grid-2">
        <Card title="Por categoría">
          <Bars items={Object.entries(deps.byCategory).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)} />
        </Card>
        <Card title="Más importadas">
          {deps.libraries.some((l) => l.importCount) ? (
            <Bars items={deps.libraries.filter((l) => l.importCount).slice(0, 10).map((l) => ({ label: l.name, value: l.importCount, tone: l.ownership === 'propia' ? 'own' : '' }))} />
          ) : (
            <Empty>No se encontraron imports de paquetes.</Empty>
          )}
        </Card>
      </div>

      <Card
        title="Todas las librerías"
        subtitle="Hacé clic en una fila para ver en qué archivos se usa."
        actions={
          <div className="filters">
            <input placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} />
            <select value={owner} onChange={(e) => setOwner(e.target.value)}>
              <option value="all">Propias y ajenas</option>
              <option value="ajena">Ajenas</option>
              <option value="propia">Propias</option>
            </select>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="all">Todo tipo</option>
              {Object.entries(TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="all">Toda categoría</option>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
        }
      >
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Librería</th>
                <th>Versión</th>
                <th>Tipo</th>
                <th>Origen</th>
                <th>Categoría</th>
                <th className="num">Imports</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {list.map((l) => (
                <Fragment key={l.name}>
                  <tr className="clickable" onClick={() => setExpanded(expanded === l.name ? null : l.name)}>
                    <td>
                      <strong className="mono">{l.name}</strong>
                      {l.description && <div className="muted small">{l.description}</div>}
                    </td>
                    <td className="mono">
                      {l.version ?? l.spec}
                      {l.versionSource === 'rango' && <span className="muted small" title={`Rango declarado: ${l.spec}`}> ~</span>}
                    </td>
                    <td><Badge>{TYPE_LABELS[l.type] ?? l.type}</Badge></td>
                    <td>
                      <Badge tone={l.ownership === 'propia' ? 'own' : 'neutral'} title={l.ownershipReason}>{l.ownership}</Badge>
                    </td>
                    <td>{l.isAI ? <Badge tone="info">IA</Badge> : null} {l.categoryLabel}</td>
                    <td className="num">{l.importCount}</td>
                    <td className="status-cell">
                      {l.vulnerabilities.length > 0 && <Badge tone="bad">{l.vulnerabilities.length} CVE</Badge>}
                      {l.deprecated && <Badge tone="warn" title={l.deprecated}>deprecada</Badge>}
                      {l.possiblyUnused && <Badge tone="low" title="No se encontraron imports ni referencias en configs">¿sin uso?</Badge>}
                      {l.clientFiles.length > 0 && <Badge tone="neutral" title="Se importa en componentes 'use client'">cliente</Badge>}
                    </td>
                  </tr>
                  {expanded === l.name && (
                    <tr className="expanded">
                      <td colSpan={7}>
                        <div className="grid-2">
                          <div>
                            <h4>Propiedad</h4>
                            <p>{l.ownershipReason}</p>
                            <h4>Declarada en</h4>
                            <FileList files={l.declaredIn} />
                            {l.versionSource && (
                              <p className="muted small">
                                Rango declarado <code>{l.spec}</code>; versión {l.versionSource === 'lockfile' ? 'instalada según lockfile' : 'mínima del rango'}.
                              </p>
                            )}
                            {l.vulnerabilities.map((v) => (
                              <div key={v.id} className="alert bad small">
                                <strong>{v.id}</strong> — {v.title}. {v.fix}
                              </div>
                            ))}
                            {l.deprecated && <div className="alert warn small">{l.deprecated}</div>}
                          </div>
                          <div>
                            <h4>Usada en ({l.files.length})</h4>
                            <FileList files={l.files} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
          {!list.length && <Empty>No hay librerías que coincidan con el filtro.</Empty>}
        </div>
      </Card>

      <div className="grid-2">
        <Card title="Importadas pero no declaradas" subtitle="Funcionan por ser dependencias transitivas o de otro workspace: conviene declararlas.">
          {deps.undeclared.length ? (
            <ul className="plain">
              {deps.undeclared.map((u) => (
                <li key={u.name}>
                  <strong className="mono">{u.name}</strong> <span className="muted">· {u.count} import(s)</span>
                  <FileList files={u.files} limit={3} />
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Todas las librerías importadas están declaradas.</Empty>
          )}
        </Card>
        <Card title="Código propio más reutilizado" subtitle="Módulos internos (imports relativos o con alias) más importados.">
          {deps.internalModules.length ? (
            <Bars items={deps.internalModules.slice(0, 10).map((m) => ({ label: m.specifier, value: m.count, tone: 'own' }))} />
          ) : (
            <Empty>Sin imports internos.</Empty>
          )}
          {deps.builtins.length > 0 && (
            <p className="muted small">
              Módulos nativos de Node: {deps.builtins.map((b) => `${b.name} (${b.count})`).join(', ')}
            </p>
          )}
        </Card>
      </div>
    </div>
  )
}
