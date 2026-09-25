// Utilidades para decidir qué archivos leer y cómo clasificarlos.

export const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  '.nuxt',
  '.turbo',
  '.vercel',
  '.cache',
  '.parcel-cache',
  '.svelte-kit',
  '.output',
  'dist',
  'build',
  'out',
  'coverage',
  '.idea',
  '.vscode',
  '.yarn',
  '.pnpm-store',
  'storybook-static',
])

export const CODE_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.mts', '.cts']
export const STYLE_EXTENSIONS = ['.css', '.scss', '.sass', '.less']
const OTHER_TEXT_EXTENSIONS = ['.json', '.md', '.mdx', '.yml', '.yaml', '.html', '.svg', '.txt', '.toml']

// Archivos sin extensión (o especiales) que igual interesa leer.
const SPECIAL_FILES = [/^\.env(\..+)?$/, /^\.gitignore$/, /^\.npmrc$/, /^yarn\.lock$/, /^Dockerfile$/, /^\.nvmrc$/]

// Máximo tamaño de archivo a leer (evita bundles minificados gigantes).
export const MAX_FILE_SIZE = 1024 * 1024 // 1 MB

export function extname(path) {
  const base = basename(path)
  const i = base.lastIndexOf('.')
  return i > 0 ? base.slice(i).toLowerCase() : ''
}

export function basename(path) {
  const i = path.lastIndexOf('/')
  return i >= 0 ? path.slice(i + 1) : path
}

export function isIgnoredPath(path) {
  return path.split('/').some((part) => IGNORED_DIRS.has(part))
}

export function isCodeFile(path) {
  return CODE_EXTENSIONS.includes(extname(path))
}

export function isStyleFile(path) {
  return STYLE_EXTENSIONS.includes(extname(path))
}

export function shouldReadFile(path, size = 0) {
  if (isIgnoredPath(path)) return false
  if (size > MAX_FILE_SIZE) return false
  const base = basename(path)
  if (/\.min\.(js|css)$/.test(base)) return false
  if (SPECIAL_FILES.some((re) => re.test(base))) return true
  const ext = extname(path)
  return CODE_EXTENSIONS.includes(ext) || STYLE_EXTENSIONS.includes(ext) || OTHER_TEXT_EXTENSIONS.includes(ext)
}

/** Número de línea (1-based) de un índice dentro de un texto. */
export function lineOf(content, index) {
  let line = 1
  for (let i = 0; i < index && i < content.length; i++) {
    if (content.charCodeAt(i) === 10) line++
  }
  return line
}

/** Devuelve la línea recortada donde está el índice, para mostrar como evidencia. */
export function snippetAt(content, index, max = 160) {
  const start = content.lastIndexOf('\n', index - 1) + 1
  let end = content.indexOf('\n', index)
  if (end === -1) end = content.length
  let text = content.slice(start, end).trim()
  if (text.length > max) text = text.slice(0, max) + '…'
  return text
}

/**
 * Quita comentarios de JS/TS de forma aproximada (sin tocar strings),
 * conservando los saltos de línea para que los números de línea sigan siendo válidos.
 */
export function stripComments(src) {
  let out = ''
  let i = 0
  const n = src.length
  let quote = null
  while (i < n) {
    const c = src[i]
    const next = src[i + 1]
    if (quote) {
      out += c
      if (c === '\\') {
        out += next ?? ''
        i += 2
        continue
      }
      if (c === quote) quote = null
      i++
      continue
    }
    if (c === '"' || c === "'" || c === '`') {
      quote = c
      out += c
      i++
      continue
    }
    if (c === '/' && next === '/') {
      while (i < n && src[i] !== '\n') i++
      continue
    }
    if (c === '/' && next === '*') {
      i += 2
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) {
        if (src[i] === '\n') out += '\n'
        i++
      }
      i += 2
      continue
    }
    out += c
    i++
  }
  return out
}

export function countLines(content) {
  if (!content) return 0
  let lines = 1
  for (let i = 0; i < content.length; i++) if (content.charCodeAt(i) === 10) lines++
  return lines
}

/**
 * Reemplaza por espacios el contenido de comentarios y strings '...' / "..." (no templates),
 * conservando longitud y saltos de línea: sirve para buscar patrones sólo en código real.
 */
export function maskStringsAndComments(src) {
  const out = src.split('')
  let i = 0
  const n = src.length
  const blank = (from, to) => {
    for (let k = from; k < to && k < n; k++) if (out[k] !== '\n') out[k] = ' '
  }
  while (i < n) {
    const c = src[i]
    const next = src[i + 1]
    if (c === '/' && next === '/') {
      const end = src.indexOf('\n', i)
      const stop = end === -1 ? n : end
      blank(i, stop)
      i = stop
    } else if (c === '/' && next === '*') {
      const end = src.indexOf('*/', i + 2)
      const stop = end === -1 ? n : end + 2
      blank(i, stop)
      i = stop
    } else if (c === '"' || c === "'") {
      let j = i + 1
      while (j < n && src[j] !== c && src[j] !== '\n') j += src[j] === '\\' ? 2 : 1
      blank(i + 1, j)
      i = j + 1
    } else if (c === '`') {
      // Saltamos el template sin enmascarar (puede contener código en ${})
      let j = i + 1
      while (j < n && src[j] !== '`') j += src[j] === '\\' ? 2 : 1
      i = j + 1
    } else {
      i++
    }
  }
  return out.join('')
}
