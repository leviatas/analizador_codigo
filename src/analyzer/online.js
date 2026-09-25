// Consulta online de vulnerabilidades en la GitHub Advisory Database, vía la API de auditoría de npm
// (la misma que usa `npm audit`). Sólo se envían nombres y versiones de paquetes, nunca código.
import semver from 'semver'

export const NPM_ADVISORIES_URL = 'https://registry.npmjs.org/-/npm/v1/security/advisories/bulk'
// En el navegador se usa un proxy del servidor de Vite (la API de npm no permite CORS).
export const BROWSER_ADVISORIES_PATH = '/api/npm-advisories'
export const ADVISORY_SOURCE = 'GitHub Advisory Database (API de npm)'

const SEVERITY_MAP = { critical: 'critical', high: 'high', moderate: 'medium', medium: 'medium', low: 'low', info: 'info' }
const CHUNK_SIZE = 150

/** Paquetes que se pueden consultar: publicados en npm y con versión conocida. */
export function queryablePackages(libraries) {
  return libraries.filter((l) => l.version && semver.valid(l.version) && ['npm', 'alias'].includes(l.origin) && l.ownership !== 'propia')
}

/**
 * Deduce la versión que corrige una vulnerabilidad a partir del rango afectado.
 * ">=15.0.0 <15.2.3 || >=14.0.0 <14.2.25" con versión 15.1.0 → "15.2.3"
 */
export function fixVersionFor(range, version) {
  for (const part of String(range).split('||')) {
    const clean = part.trim()
    if (!clean || !semver.satisfies(version, clean, { includePrerelease: true })) continue
    const lt = clean.match(/<\s*(\d+\.\d+\.\d+[\w.-]*)/)
    if (lt && !clean.includes('<=')) return lt[1]
    const lte = clean.match(/<=\s*(\d+\.\d+\.\d+[\w.-]*)/)
    if (lte) return `> ${lte[1]}`
    return null // todas las versiones afectadas
  }
  return null
}

export function normalizeAdvisory(adv, version) {
  const id = adv.github_advisory_id ?? (adv.url?.match(/GHSA-[\w-]+/)?.[0] ?? String(adv.id))
  const fix = fixVersionFor(adv.vulnerable_versions, version)
  return {
    id,
    url: adv.url ?? null,
    title: adv.title ?? 'Vulnerabilidad',
    severity: SEVERITY_MAP[adv.severity] ?? 'medium',
    score: adv.cvss?.score || null,
    range: adv.vulnerable_versions,
    cwe: adv.cwe ?? [],
    fixVersion: fix,
    fix: fix ? (fix.startsWith('>') ? `Actualizar a una versión ${fix}.` : `Actualizar a ${fix} o superior.`) : 'No hay versión corregida publicada: evaluar reemplazar la librería.',
    source: 'online',
  }
}

/**
 * Consulta las vulnerabilidades de las librerías.
 * @returns {Promise<Record<string, object[]>>} { 'nombre@versión': [advisories] }
 */
export async function fetchAdvisories(libraries, { endpoint = NPM_ADVISORIES_URL, fetchImpl = globalThis.fetch, signal } = {}) {
  const pkgs = queryablePackages(libraries)
  const result = {}
  for (let i = 0; i < pkgs.length; i += CHUNK_SIZE) {
    const chunk = pkgs.slice(i, i + CHUNK_SIZE)
    const body = Object.fromEntries(chunk.map((l) => [l.name, [l.version]]))
    const res = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      signal,
    })
    if (!res.ok) throw new Error(`El servicio de vulnerabilidades respondió ${res.status}`)
    const data = await res.json()
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Respuesta inesperada del servicio de vulnerabilidades')
    for (const l of chunk) {
      const advisories = (data[l.name] ?? [])
        .filter((a) => a.vulnerable_versions && semver.satisfies(l.version, a.vulnerable_versions, { includePrerelease: true }))
        .map((a) => normalizeAdvisory(a, l.version))
      result[`${l.name}@${l.version}`] = advisories
    }
  }
  return result
}

/**
 * Ejecuta la consulta y devuelve lo necesario para re-analizar: { onlineAdvisories, vulnCheck }.
 * Nunca lanza: si falla, vulnCheck.status = 'error' y se sigue con la base offline.
 */
export async function runOnlineCheck(libraries, options = {}) {
  const packages = queryablePackages(libraries).length
  try {
    const onlineAdvisories = await fetchAdvisories(libraries, options)
    return {
      onlineAdvisories,
      vulnCheck: { mode: 'online', status: 'ok', source: ADVISORY_SOURCE, checkedAt: new Date().toISOString(), packages },
    }
  } catch (err) {
    return {
      onlineAdvisories: null,
      vulnCheck: { mode: 'offline', status: 'error', source: ADVISORY_SOURCE, error: err?.message ?? String(err), packages },
    }
  }
}
