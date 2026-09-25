// Parseo liviano de lockfiles (npm, pnpm, yarn) para conocer versiones instaladas.
import { basename } from './files.js'

/**
 * Devuelve { type, path, packages: Map<nombre, Set<versión>>, direct: Map<nombre, versión> }
 * `direct` son las versiones resueltas de dependencias directas del proyecto raíz (cuando se puede saber).
 */
export function parseLockfiles(files) {
  const lock = files
    .filter((f) => ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'npm-shrinkwrap.json'].includes(basename(f.path)))
    .sort((a, b) => a.path.split('/').length - b.path.split('/').length)[0]
  if (!lock) return null
  const name = basename(lock.path)
  try {
    if (name.endsWith('.json')) return { type: 'npm', path: lock.path, ...parseNpm(lock.content) }
    if (name === 'pnpm-lock.yaml') return { type: 'pnpm', path: lock.path, ...parsePnpm(lock.content) }
    return { type: 'yarn', path: lock.path, ...parseYarn(lock.content) }
  } catch {
    return { type: 'unknown', path: lock.path, packages: new Map(), direct: new Map() }
  }
}

function add(map, name, version) {
  if (!name || !version) return
  if (!map.has(name)) map.set(name, new Set())
  map.get(name).add(version)
}

function parseNpm(content) {
  const json = JSON.parse(content)
  const packages = new Map()
  const direct = new Map()
  if (json.packages) {
    for (const [key, info] of Object.entries(json.packages)) {
      if (!key) continue
      const idx = key.lastIndexOf('node_modules/')
      if (idx === -1) continue
      const name = key.slice(idx + 'node_modules/'.length)
      add(packages, name, info.version)
      if (key === `node_modules/${name}`) direct.set(name, info.version)
    }
  } else if (json.dependencies) {
    const walk = (deps, top) => {
      for (const [name, info] of Object.entries(deps)) {
        add(packages, name, info.version)
        if (top) direct.set(name, info.version)
        if (info.dependencies) walk(info.dependencies, false)
      }
    }
    walk(json.dependencies, true)
  }
  return { packages, direct }
}

function parsePnpm(content) {
  const packages = new Map()
  const direct = new Map()
  const lines = content.split('\n')
  let section = null
  let inRootImporter = false
  let current = null
  for (const line of lines) {
    if (/^\S/.test(line)) {
      section = line.replace(/:.*$/, '').trim()
      inRootImporter = section === 'dependencies' || section === 'devDependencies' || section === 'optionalDependencies'
      continue
    }
    if (section === 'importers') {
      const imp = line.match(/^ {2}(\S.*):\s*$/)
      if (imp) {
        inRootImporter = imp[1].replace(/['"]/g, '') === '.'
        continue
      }
    }
    if (section === 'packages') {
      // v6: "  /next@14.2.3:" | v9: "  next@14.2.3:" | "  '@scope/pkg@1.0.0(react@18)':"
      const m = line.match(/^ {2}['"]?\/?((?:@[^/\s]+\/)?[^@\s'"/]+)[@/]([^(:'"\s]+)/)
      if (m) add(packages, m[1], m[2])
      continue
    }
    if (inRootImporter) {
      const dep = line.match(/^ {2,6}['"]?((?:@[^/\s]+\/)?[^:\s'"]+)['"]?:\s*(\S+)?\s*$/)
      if (dep && !['specifier', 'version', 'dependencies', 'devDependencies', 'optionalDependencies'].includes(dep[1])) {
        current = dep[1]
        // formato v5: "  next: 14.2.3"
        if (dep[2] && /^\d/.test(dep[2])) direct.set(current, dep[2].replace(/\(.*$/, ''))
        continue
      }
      const ver = line.match(/^\s+version:\s*['"]?([^\s('"]+)/)
      if (ver && current) direct.set(current, ver[1])
    }
  }
  return { packages, direct }
}

function parseYarn(content) {
  const packages = new Map()
  const direct = new Map()
  const byRange = new Map() // 'next@^14.0.0' -> '14.2.3'
  const blocks = content.split(/\n(?=\S)/)
  for (const block of blocks) {
    const header = block.split('\n')[0]
    if (header.startsWith('#') || !header.includes('@')) continue
    const ver = block.match(/\n\s+version:?\s+"?([^"\s]+)"?/)
    if (!ver) continue
    for (let entry of header.replace(/:$/, '').split(',')) {
      entry = entry.trim().replace(/^"|"$/g, '')
      const at = entry.indexOf('@', 1)
      if (at === -1) continue
      const name = entry.slice(0, at)
      add(packages, name, ver[1])
      byRange.set(entry.replace('@npm:', '@'), ver[1])
    }
  }
  return { packages, direct, byRange }
}
