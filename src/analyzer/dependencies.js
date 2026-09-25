// Análisis de librerías: declaradas, importadas, propias vs. ajenas, versiones y vulnerabilidades.
import semver from 'semver'
import { basename, isCodeFile } from './files.js'
import { classifySpecifier, extractImports, packageNameOf, parseJsonLoose } from './imports.js'
import { CATEGORIES, lookupByPattern, lookupLibrary } from './data/libraries.js'
import { AI_PACKAGES } from './data/ai.js'
import { DEPRECATED_PACKAGES, VULNERABILITIES } from './data/vulnerabilities.js'
import { parseLockfiles } from './lockfile.js'

const DEP_FIELDS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']

/** Lee todos los package.json del proyecto (ignora node_modules). El de menor profundidad es la raíz. */
export function readPackageJsons(files) {
  return files
    .filter((f) => basename(f.path) === 'package.json')
    .map((f) => ({ path: f.path, json: parseJsonLoose(f.content) }))
    .filter((p) => p.json)
    .sort((a, b) => a.path.split('/').length - b.path.split('/').length)
}

/** Determina el origen de una dependencia según su especificador de versión. */
export function originOf(spec = '') {
  if (/^(workspace|link|portal):/.test(spec)) return 'workspace'
  if (/^file:/.test(spec) || spec.startsWith('./') || spec.startsWith('../')) return 'local'
  if (/^(git\+|git:|github:|gitlab:|bitbucket:)/.test(spec) || /^[\w-]+\/[\w.-]+(#.*)?$/.test(spec)) return 'git'
  if (/^https?:/.test(spec)) return 'url'
  if (/^npm:/.test(spec)) return 'alias'
  return 'npm'
}

/** Resuelve la versión "efectiva" (instalada si hay lockfile; si no, la mínima del rango). */
export function resolveVersion(name, spec, lock) {
  const fromLock = lock?.direct?.get(name) ?? lock?.byRange?.get(`${name}@${spec}`)
  if (fromLock && semver.valid(fromLock)) return { version: fromLock, source: 'lockfile' }
  if (lock?.packages?.get(name)?.size === 1) {
    const only = [...lock.packages.get(name)][0]
    if (semver.valid(only)) return { version: only, source: 'lockfile' }
  }
  if (spec && semver.validRange(spec)) {
    const min = semver.minVersion(spec)
    if (min) return { version: min.version, source: 'rango' }
  }
  return { version: null, source: null }
}

export function findVulnerabilities(name, version) {
  if (!version || !semver.valid(version)) return []
  return VULNERABILITIES.filter((v) => v.pkg === name && semver.satisfies(version, v.range, { includePrerelease: true }))
}

export function analyzeDependencies(files, { ownScopes = [], aliases = [] } = {}) {
  const pkgs = readPackageJsons(files)
  const root = pkgs[0]?.json ?? null
  const lock = parseLockfiles(files)

  // Paquetes del propio monorepo / workspace
  const workspacePackages = new Set(pkgs.map((p) => p.json.name).filter(Boolean))
  const scopes = new Set(ownScopes.map((s) => s.trim()).filter(Boolean).map((s) => (s.startsWith('@') ? s : '@' + s)))
  for (const name of workspacePackages) {
    if (name.startsWith('@')) scopes.add(name.split('/')[0])
  }

  // 1) Dependencias declaradas
  const libs = new Map()
  for (const p of pkgs) {
    for (const field of DEP_FIELDS) {
      for (const [name, spec] of Object.entries(p.json[field] ?? {})) {
        let lib = libs.get(name)
        if (!lib) {
          lib = { name, spec, type: field, declaredIn: [], importCount: 0, files: new Set(), clientFiles: new Set() }
          libs.set(name, lib)
        }
        // "dependencies" tiene prioridad sobre dev/peer para el tipo mostrado
        if (field === 'dependencies') {
          lib.type = field
          lib.spec = spec
        }
        lib.declaredIn.push(p.path)
      }
    }
  }

  // 2) Imports en el código
  const internalModules = new Map()
  const builtins = new Map()
  let totalImports = 0
  const undeclared = new Map()

  for (const f of files) {
    if (!isCodeFile(f.path)) continue
    const isClient = /^\s*['"]use client['"]/m.test(f.content.slice(0, 500))
    for (const imp of extractImports(f.content)) {
      totalImports++
      const kind = classifySpecifier(imp.specifier, aliases)
      if (kind === 'relative' || kind === 'alias') {
        internalModules.set(imp.specifier, (internalModules.get(imp.specifier) ?? 0) + 1)
        continue
      }
      if (kind === 'builtin') {
        const name = imp.specifier.replace(/^node:/, '').split('/')[0]
        builtins.set(name, (builtins.get(name) ?? 0) + 1)
        continue
      }
      if (kind !== 'package') continue
      const name = packageNameOf(imp.specifier)
      let lib = libs.get(name)
      if (!lib) {
        if (workspacePackages.has(name)) {
          lib = { name, spec: 'workspace', type: 'workspace', declaredIn: [], importCount: 0, files: new Set(), clientFiles: new Set() }
          libs.set(name, lib)
        } else {
          const u = undeclared.get(name) ?? { name, count: 0, files: new Set() }
          u.count++
          u.files.add(f.path)
          undeclared.set(name, u)
          continue
        }
      }
      lib.importCount++
      lib.files.add(f.path)
      if (isClient) lib.clientFiles.add(f.path)
    }
  }

  // Texto de configs (next.config, tailwind, postcss, eslint, scripts...) para detectar uso implícito
  const configText = files
    .filter((f) => /(^|\/)[^/]*\.config\.[cm]?[jt]s$|(^|\/)\.[\w-]+rc(\.\w+)?$|(^|\/)(tsconfig|jsconfig)\.json$/.test(f.path))
    .map((f) => f.content)
    .join('\n')
  const scriptsText = pkgs.map((p) => JSON.stringify(p.json.scripts ?? {}) + JSON.stringify(p.json.prettier ?? '') + JSON.stringify(p.json.eslintConfig ?? '')).join('\n')

  // 3) Enriquecer
  const list = [...libs.values()].map((lib) => {
    const info = lookupLibrary(lib.name)
    const ai = lookupByPattern(AI_PACKAGES, lib.name)
    const origin = lib.type === 'workspace' ? 'workspace' : originOf(lib.spec)
    const scope = lib.name.startsWith('@') ? lib.name.split('/')[0] : null
    let ownership = 'ajena'
    let ownershipReason = 'Paquete de terceros publicado en npm'
    if (origin === 'workspace' || workspacePackages.has(lib.name)) {
      ownership = 'propia'
      ownershipReason = 'Paquete del mismo monorepo / workspace'
    } else if (origin === 'local') {
      ownership = 'propia'
      ownershipReason = 'Paquete local (file:)'
    } else if (scope && scopes.has(scope)) {
      ownership = 'propia'
      ownershipReason = `Pertenece al scope propio ${scope}`
    } else if (origin === 'git' || origin === 'url') {
      ownershipReason = 'Instalada desde un repositorio git / URL (podría ser interna, revisar)'
    }

    const { version, source } = resolveVersion(lib.name, lib.spec, lock)
    const vulnerabilities = findVulnerabilities(lib.name, version)
    const category = ai ? 'ai' : info?.category ?? 'other'

    const implicitlyUsed =
      lib.importCount > 0 ||
      lib.name.startsWith('@types/') ||
      configText.includes(lib.name) ||
      scriptsText.includes(lib.name) ||
      ['tooling', 'lint', 'types', 'testing'].includes(category) ||
      ['react-dom', 'next', 'react', 'sharp', 'typescript', 'postcss', 'autoprefixer', 'tailwindcss'].includes(lib.name)

    return {
      name: lib.name,
      spec: lib.spec,
      type: lib.type,
      declaredIn: lib.declaredIn,
      origin,
      ownership,
      ownershipReason,
      category,
      categoryLabel: CATEGORIES[category] ?? 'Otra',
      description: ai ? `${ai.kind} — ${ai.provider}` : info?.description ?? '',
      known: Boolean(info || ai),
      isAI: Boolean(ai),
      aiProvider: ai?.provider ?? null,
      version,
      versionSource: source,
      importCount: lib.importCount,
      files: [...lib.files].sort(),
      clientFiles: [...lib.clientFiles].sort(),
      possiblyUnused: !implicitlyUsed && lib.type === 'dependencies',
      deprecated: DEPRECATED_PACKAGES[lib.name] ?? null,
      vulnerabilities,
    }
  })

  list.sort((a, b) => b.importCount - a.importCount || a.name.localeCompare(b.name))

  // 4) Vulnerabilidades en dependencias transitivas (sólo con lockfile)
  const transitiveVulns = []
  if (lock?.packages) {
    const directNames = new Set(list.map((l) => l.name))
    for (const [name, versions] of lock.packages) {
      if (directNames.has(name)) continue
      if (!VULNERABILITIES.some((v) => v.pkg === name)) continue
      for (const version of versions) {
        for (const vuln of findVulnerabilities(name, version)) {
          transitiveVulns.push({ name, version, ...vuln })
        }
      }
    }
  }

  const byCategory = {}
  for (const l of list) byCategory[l.categoryLabel] = (byCategory[l.categoryLabel] ?? 0) + 1

  return {
    projectName: root?.name ?? null,
    projectVersion: root?.version ?? null,
    packageJsonPaths: pkgs.map((p) => p.path),
    scripts: root?.scripts ?? {},
    engines: root?.engines ?? null,
    packageManager: root?.packageManager ?? lock?.type ?? null,
    lockfile: lock ? { type: lock.type, path: lock.path, totalPackages: lock.packages.size } : null,
    ownScopes: [...scopes],
    libraries: list,
    undeclared: [...undeclared.values()].map((u) => ({ ...u, files: [...u.files].sort() })).sort((a, b) => b.count - a.count),
    internalModules: [...internalModules.entries()].map(([specifier, count]) => ({ specifier, count })).sort((a, b) => b.count - a.count),
    builtins: [...builtins.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    transitiveVulnerabilities: transitiveVulns,
    totals: {
      declared: list.filter((l) => l.type !== 'workspace').length,
      dependencies: list.filter((l) => l.type === 'dependencies').length,
      devDependencies: list.filter((l) => l.type === 'devDependencies').length,
      own: list.filter((l) => l.ownership === 'propia').length,
      external: list.filter((l) => l.ownership === 'ajena').length,
      imports: totalImports,
      internalImports: [...internalModules.values()].reduce((a, b) => a + b, 0),
      vulnerable: list.filter((l) => l.vulnerabilities.length).length,
      possiblyUnused: list.filter((l) => l.possiblyUnused).length,
    },
    byCategory,
  }
}
