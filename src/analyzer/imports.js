// Extracción y clasificación de imports / requires.
import { lineOf, stripComments } from './files.js'

const NODE_BUILTINS = new Set([
  'assert', 'async_hooks', 'buffer', 'child_process', 'cluster', 'console', 'constants', 'crypto',
  'dgram', 'diagnostics_channel', 'dns', 'domain', 'events', 'fs', 'fs/promises', 'http', 'http2',
  'https', 'inspector', 'module', 'net', 'os', 'path', 'perf_hooks', 'process', 'punycode',
  'querystring', 'readline', 'repl', 'stream', 'string_decoder', 'sys', 'timers', 'tls',
  'trace_events', 'tty', 'url', 'util', 'v8', 'vm', 'wasi', 'worker_threads', 'zlib', 'test',
])

const IMPORT_PATTERNS = [
  // import x from 'y' / import {a} from "y" / export * from 'y' / import type X from 'y'
  /\b(?:import|export)\s+(?:type\s+)?[\w*{}\s,$]*?\s*from\s*['"]([^'"]+)['"]/g,
  // import 'y' (side effects)
  /\bimport\s*['"]([^'"]+)['"]/g,
  // import('y') dinámico
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  // require('y')
  /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
]

/** Extrae todos los especificadores importados en un archivo de código. */
export function extractImports(content) {
  const code = stripComments(content)
  const found = []
  const seen = new Set()
  for (const re of IMPORT_PATTERNS) {
    re.lastIndex = 0
    let m
    while ((m = re.exec(code))) {
      const key = `${m[1]}@${m.index}`
      if (seen.has(key)) continue
      seen.add(key)
      found.push({ specifier: m[1], line: lineOf(code, m.index) })
    }
  }
  return found
}

/** 'lodash/merge' -> 'lodash', '@scope/pkg/sub' -> '@scope/pkg' */
export function packageNameOf(specifier) {
  if (specifier.startsWith('@')) {
    const [scope, name] = specifier.split('/')
    return name ? `${scope}/${name}` : scope
  }
  return specifier.split('/')[0]
}

/**
 * Clasifica un especificador:
 *  - 'relative'  → './x', '../x', '/x'
 *  - 'alias'     → '@/x', '~/x' o alias definidos en tsconfig/jsconfig
 *  - 'builtin'   → módulos nativos de Node
 *  - 'asset'     → imports de css / imágenes sin paquete
 *  - 'package'   → paquete npm
 */
export function classifySpecifier(specifier, aliases = []) {
  if (specifier.startsWith('.') || specifier.startsWith('/')) return 'relative'
  if (specifier.startsWith('node:')) return 'builtin'
  if (NODE_BUILTINS.has(specifier) || NODE_BUILTINS.has(specifier.split('/')[0])) return 'builtin'
  for (const alias of aliases) {
    if (specifier === alias || specifier.startsWith(alias.endsWith('/') ? alias : alias + '/')) return 'alias'
  }
  if (specifier.startsWith('@/') || specifier.startsWith('~/') || specifier.startsWith('#')) return 'alias'
  if (/^(https?:|data:|virtual:)/.test(specifier)) return 'asset'
  return 'package'
}

/** Lee los alias de "paths" en tsconfig.json / jsconfig.json (formato JSON con comentarios). */
export function extractPathAliases(files) {
  const aliases = new Set()
  for (const f of files) {
    if (!/(^|\/)(tsconfig|jsconfig)(\.[\w-]+)?\.json$/.test(f.path)) continue
    const json = parseJsonLoose(f.content)
    const paths = json?.compilerOptions?.paths
    if (!paths) continue
    for (const key of Object.keys(paths)) {
      aliases.add(key.replace(/\/?\*$/, ''))
    }
  }
  return [...aliases].filter(Boolean)
}

/** JSON.parse tolerante a comentarios y comas finales (tsconfig). */
export function parseJsonLoose(text) {
  try {
    return JSON.parse(text)
  } catch {
    try {
      const noComments = stripComments(text).replace(/,(\s*[}\]])/g, '$1')
      return JSON.parse(noComments)
    } catch {
      return null
    }
  }
}
