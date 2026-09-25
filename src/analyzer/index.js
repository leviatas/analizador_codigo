// Punto de entrada del analizador. Recibe [{ path, content }] y devuelve el reporte completo.
import { analyzeDependencies } from './dependencies.js'
import { analyzeAI } from './ai.js'
import { analyzeSecurity } from './security.js'
import { analyzeUsage } from './usage.js'
import { extractPathAliases } from './imports.js'

export { SEVERITIES, SEVERITY_LABELS } from './security.js'

/**
 * @param {{path: string, content: string}[]} files  rutas relativas a la raíz del proyecto (con '/')
 * @param {{ ownScopes?: string[], projectName?: string, skipped?: number }} options
 */
export function analyzeProject(files, options = {}) {
  const started = Date.now()
  const aliases = extractPathAliases(files)
  const dependencies = analyzeDependencies(files, { ownScopes: options.ownScopes ?? [], aliases })
  const usage = analyzeUsage(files, dependencies)
  const ai = analyzeAI(files, dependencies)
  const security = analyzeSecurity(files, dependencies, usage)

  return {
    meta: {
      name: dependencies.projectName ?? options.projectName ?? 'proyecto',
      folder: options.projectName ?? null,
      version: dependencies.projectVersion,
      analyzedAt: new Date().toISOString(),
      durationMs: Date.now() - started,
      filesAnalyzed: files.length,
      filesSkipped: options.skipped ?? 0,
      aliases,
    },
    dependencies,
    usage,
    ai,
    security,
    highlights: buildHighlights({ dependencies, usage, ai, security }),
  }
}

function buildHighlights({ dependencies, usage, ai, security }) {
  const h = []
  h.push({ tone: 'neutral', text: `Tipo de proyecto: ${usage.projectType}${usage.next.router ? ` (${usage.next.router})` : ''}.` })
  if (!usage.isReact) h.push({ tone: 'warn', text: 'No se detectó React en las dependencias: el análisis puede ser parcial.' })
  h.push({
    tone: 'neutral',
    text: `${dependencies.totals.declared} librerías declaradas: ${dependencies.totals.external} ajenas y ${dependencies.totals.own} propias.`,
  })
  h.push({ tone: ai.usesAI ? 'info' : 'neutral', text: ai.summary + (ai.providers.length ? ` Proveedores: ${ai.providers.map((p) => p.name).join(', ')}.` : '') })
  const serious = security.counts.critical + security.counts.high
  h.push({
    tone: serious ? 'bad' : security.counts.medium ? 'warn' : 'good',
    text: serious
      ? `${serious} hallazgo(s) de seguridad crítico(s) o alto(s).`
      : security.counts.medium
        ? `Sin hallazgos críticos; ${security.counts.medium} de severidad media.`
        : 'Sin hallazgos de seguridad relevantes.',
  })
  if (dependencies.totals.vulnerable) h.push({ tone: 'bad', text: `${dependencies.totals.vulnerable} dependencia(s) directa(s) con vulnerabilidades conocidas.` })
  if (dependencies.undeclared.length) h.push({ tone: 'warn', text: `${dependencies.undeclared.length} paquete(s) importado(s) pero no declarado(s) en package.json.` })
  if (dependencies.totals.possiblyUnused) h.push({ tone: 'warn', text: `${dependencies.totals.possiblyUnused} dependencia(s) posiblemente sin uso.` })
  if (!usage.totals.testFiles) h.push({ tone: 'warn', text: 'No se encontraron archivos de tests.' })
  return h
}
