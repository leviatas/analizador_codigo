// Exportación del reporte a Markdown.
import { SEVERITY_LABELS } from './security.js'

const esc = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')

export function toMarkdown(r) {
  const L = []
  const d = r.dependencies
  const u = r.usage
  L.push(`# Análisis de código: ${r.meta.name}`)
  L.push('')
  L.push(`_Generado el ${new Date(r.meta.analyzedAt).toLocaleString('es-AR')} · ${r.meta.filesAnalyzed} archivos analizados · análisis estático sin IA_`)
  L.push('')
  L.push('## Resumen')
  for (const h of r.highlights) L.push(`- ${h.text}`)
  L.push('')
  L.push(`**Puntaje de seguridad:** ${r.security.score}/100 (${r.security.grade})`)
  const vc = r.meta.vulnCheck ?? { mode: 'offline' }
  L.push('')
  L.push(
    vc.status === 'ok'
      ? `_Vulnerabilidades consultadas online en ${vc.source} (${new Date(vc.checkedAt).toLocaleString('es-AR')})._`
      : vc.status === 'error'
        ? `_No se pudo consultar online (${vc.error}); se usó la base offline._`
        : '_Vulnerabilidades según la base offline incluida._',
  )
  L.push('')

  L.push('## Librerías')
  L.push('')
  L.push('| Librería | Versión | Tipo | Propia/Ajena | Categoría | Imports | Vulnerabilidades |')
  L.push('|---|---|---|---|---|---|---|')
  for (const l of d.libraries) {
    L.push(`| ${esc(l.name)} | ${esc(l.version ?? l.spec)} | ${l.type} | ${l.ownership} | ${esc(l.categoryLabel)} | ${l.importCount} | ${l.vulnerabilities.length ? `${l.vulnerabilities.length} (${l.vulnSource})` : '—'} |`)
  }
  if (d.undeclared.length) {
    L.push('')
    L.push('**Importadas pero no declaradas:** ' + d.undeclared.map((x) => x.name).join(', '))
  }
  L.push('')

  L.push('## Inteligencia Artificial')
  L.push('')
  L.push(r.ai.summary)
  for (const p of r.ai.providers) L.push(`- **${p.name}** — paquetes: ${p.packages.join(', ') || '—'}; archivos: ${p.files.length}`)
  L.push('')

  L.push('## Seguridad')
  L.push('')
  L.push(Object.entries(r.security.counts).map(([k, v]) => `${SEVERITY_LABELS[k]}: ${v}`).join(' · '))
  L.push('')
  for (const f of r.security.findings) {
    L.push(`- **[${SEVERITY_LABELS[f.severity]}] ${esc(f.title)}** — \`${f.file}${f.line ? ':' + f.line : ''}\`  `)
    L.push(`  ${esc(f.description)}`)
    for (const a of f.advisories ?? []) {
      L.push(`  - [${SEVERITY_LABELS[a.severity]}] [${a.id}](${a.url ?? ''}) ${esc(a.title)}${a.fixVersion ? ` — corregido en ${a.fixVersion}` : ''}`)
    }
  }
  L.push('')

  L.push('## Uso general')
  L.push('')
  L.push(`- Tipo: ${u.projectType}${u.next.router ? ` (${u.next.router})` : ''}`)
  if (u.next.version) L.push(`- Next.js ${u.next.version}`)
  if (u.reactVersion) L.push(`- React ${u.reactVersion}`)
  L.push(`- TypeScript: ${u.typescript ? `sí (${u.typescriptRatio}% del código)` : 'no'}`)
  L.push(`- Archivos de código: ${u.totals.codeFiles} · Líneas: ${u.totals.lines}`)
  L.push(`- Componentes: ${u.totals.components} (cliente: ${u.totals.clientComponents}) · Hooks propios: ${u.totals.customHooks}`)
  L.push(`- Páginas: ${u.next.pages.length} · Endpoints API: ${u.next.apiRoutes.length}${u.next.middleware ? ' · Middleware: sí' : ''}`)
  L.push(`- Estilos: ${u.styling.join(', ') || '—'}`)
  L.push(`- Tests: ${u.totals.testFiles} archivo(s)`)
  if (u.next.pages.length) {
    L.push('')
    L.push('### Rutas')
    for (const p of u.next.pages) L.push(`- \`${p.route}\` (${p.file})`)
  }
  if (u.next.apiRoutes.length) {
    L.push('')
    L.push('### Endpoints')
    for (const a of u.next.apiRoutes) L.push(`- \`${a.methods.join(',')} ${a.route}\` (${a.file})${a.hasAuthCheck ? '' : ' — sin auth aparente'}`)
  }
  L.push('')
  return L.join('\n')
}
