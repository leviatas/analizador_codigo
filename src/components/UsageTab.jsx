import { Badge, Bars, Card, Empty, FileList, Stat } from './ui.jsx'

const DATA_FETCHING_LABELS = {
  fetch: 'fetch()',
  getServerSideProps: 'getServerSideProps',
  getStaticProps: 'getStaticProps',
  getStaticPaths: 'getStaticPaths',
  generateStaticParams: 'generateStaticParams',
  generateMetadata: 'generateMetadata',
  revalidate: 'export revalidate',
  forceDynamic: "dynamic = 'force-dynamic'",
  unstableCache: 'cache / use cache',
}

export default function UsageTab({ usage: u, deps }) {
  const n = u.next
  const langs = Object.entries(u.languages).map(([ext, v]) => ({ label: ext, value: v.lines })).sort((a, b) => b.value - a.value)
  const hooks = Object.entries(u.hooks).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
  const fetching = Object.entries(n.dataFetching).filter(([, v]) => v).map(([k, v]) => ({ label: DATA_FETCHING_LABELS[k], value: v }))
  const nextComps = Object.entries(n.components).filter(([, v]) => v).map(([label, value]) => ({ label, value }))

  return (
    <div className="stack">
      <div className="grid-4">
        <div className="card"><Stat label="Archivos de código" value={u.totals.codeFiles} hint={`${u.totals.lines.toLocaleString('es-AR')} líneas totales`} /></div>
        <div className="card"><Stat label="Componentes" value={u.totals.components} hint={`${u.totals.clientComponents} archivos 'use client'`} /></div>
        <div className="card"><Stat label="TypeScript" value={u.typescript ? `${u.typescriptRatio}%` : 'No'} hint="del código JS/TS" /></div>
        <div className="card"><Stat label="Tests" value={u.totals.testFiles} tone={u.totals.testFiles ? 'good' : 'warn'} hint="archivos de test" /></div>
      </div>

      {n.detected && (
        <Card title={`Next.js ${n.version ?? ''}`} subtitle={n.router ?? 'No se detectaron rutas'}>
          <div className="grid-4 compact">
            <Stat label="Páginas" value={n.pages.length} hint={`${n.pages.filter((p) => p.dynamic).length} dinámicas`} />
            <Stat label="Endpoints API" value={n.apiRoutes.length} hint={`${n.apiRoutes.filter((a) => !a.hasAuthCheck).length} sin auth aparente`} />
            <Stat label="Server / Client (app/)" value={`${n.serverComponents} / ${n.clientComponents}`} hint="componentes en app/" />
            <Stat label="Server Actions" value={n.serverActionFiles.length} hint={n.middleware ? `middleware: ${n.middleware}` : 'sin middleware'} />
          </div>
          <p className="muted small">
            Layouts: {n.special.layout} · loading: {n.special.loading} · error: {n.special.error} · not-found: {n.special['not-found']}
          </p>
        </Card>
      )}

      {n.detected && (
        <div className="grid-2">
          <Card title="Rutas / páginas">
            {n.pages.length ? (
              <div className="table-wrap tall">
                <table>
                  <tbody>
                    {n.pages.map((p) => (
                      <tr key={p.file}>
                        <td className="mono">{p.route}</td>
                        <td>
                          {p.dynamic && <Badge>dinámica</Badge>}
                          {p.router === 'app' && <Badge tone={p.client ? 'warn' : 'own'}>{p.client ? 'cliente' : 'servidor'}</Badge>}
                        </td>
                        <td className="mono small muted">{p.file}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty>No se encontraron páginas.</Empty>
            )}
          </Card>
          <Card title="Endpoints (API)">
            {n.apiRoutes.length ? (
              <div className="table-wrap tall">
                <table>
                  <tbody>
                    {n.apiRoutes.map((a) => (
                      <tr key={a.file}>
                        <td>
                          {a.methods.map((m) => (
                            <Badge key={m} tone="info">{m}</Badge>
                          ))}
                        </td>
                        <td className="mono">{a.route}</td>
                        <td>{a.hasAuthCheck ? <Badge tone="good">auth</Badge> : <Badge tone="low">sin auth aparente</Badge>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty>No se encontraron endpoints.</Empty>
            )}
          </Card>
        </div>
      )}

      <div className="grid-2">
        <Card title="Hooks de React más usados">
          {hooks.length ? <Bars items={hooks.slice(0, 12)} /> : <Empty>No se usan hooks.</Empty>}
          {u.customHooks.length > 0 && (
            <p className="small">
              <strong>Hooks propios ({u.customHooks.length}):</strong>{' '}
              <span className="mono">{u.customHooks.map((h) => h.name).join(', ')}</span>
            </p>
          )}
          {u.contexts.length > 0 && (
            <p className="small">
              <strong>Contextos:</strong> <span className="mono">{u.contexts.map((c) => c.name).join(', ')}</span>
            </p>
          )}
        </Card>
        <Card title="Líneas por lenguaje">
          <Bars items={langs} format={(v) => v.toLocaleString('es-AR')} />
        </Card>
      </div>

      <div className="grid-2">
        {n.detected && (
          <Card title="Data fetching y rendering">
            {fetching.length ? <Bars items={fetching} /> : <Empty>Sin patrones de data fetching.</Empty>}
            {nextComps.length > 0 && (
              <>
                <h4>Componentes de Next vs. nativos</h4>
                <Bars items={nextComps} />
              </>
            )}
          </Card>
        )}
        <Card title="Configuración y herramientas">
          <p>
            {u.configs.map((c) => (
              <Badge key={c}>{c}</Badge>
            ))}
            {!u.configs.length && <span className="muted">—</span>}
          </p>
          <dl className="kv">
            <div><dt>Estilos</dt><dd>{u.styling.join(', ') || '—'}</dd></div>
            <div><dt>Gestor de paquetes</dt><dd>{deps.packageManager ?? '—'}</dd></div>
            {deps.engines && <div><dt>Engines</dt><dd className="mono">{JSON.stringify(deps.engines)}</dd></div>}
            {deps.packageJsonPaths.length > 1 && <div><dt>Monorepo</dt><dd>{deps.packageJsonPaths.length} package.json</dd></div>}
          </dl>
          {Object.keys(deps.scripts).length > 0 && (
            <>
              <h4>Scripts</h4>
              <ul className="plain small">
                {Object.entries(deps.scripts).map(([k, v]) => (
                  <li key={k}>
                    <strong className="mono">{k}</strong>: <code>{v}</code>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </div>

      <div className="grid-2">
        <Card title="Variables de entorno usadas" subtitle="Las públicas se incluyen en el bundle del navegador.">
          {u.envVars.length ? (
            <ul className="plain">
              {u.envVars.map((e) => (
                <li key={e.name}>
                  <span className="mono">{e.name}</span> {e.public && <Badge tone="warn">pública</Badge>}{' '}
                  <span className="muted small">({e.files.length} archivo/s)</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No se referencian variables de entorno.</Empty>
          )}
        </Card>
        <Card title="Calidad de código">
          <dl className="kv">
            <div><dt>TODO / FIXME</dt><dd>{u.totals.todos}</dd></div>
            <div><dt>console.log</dt><dd>{u.totals.consoleLogs}</dd></div>
            <div><dt>Tipos <code>any</code></dt><dd>{u.totals.anyTypes}</dd></div>
          </dl>
          <h4>Archivos más grandes</h4>
          <Bars items={u.largestFiles.map((f) => ({ label: f.file, value: f.lines }))} format={(v) => `${v} l.`} />
          {u.todos.length > 0 && (
            <>
              <h4>Pendientes</h4>
              <FileList files={u.todos.map((t) => `${t.tag}: ${t.text || '(sin texto)'} — ${t.file}`)} limit={5} />
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
