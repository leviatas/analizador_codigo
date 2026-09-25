// Uso general del proyecto: estructura Next.js, rutas, componentes, hooks, estilos, métricas.
import { basename, countLines, extname, isCodeFile, isStyleFile, stripComments } from './files.js'

const AUTH_CHECK_RE = /\b(getServerSession|getSession|auth\(\)|currentUser\(|getAuth\(|getToken\(|verifyToken|jwtVerify|jwt\.verify|validateRequest|requireAuth|withAuth|clerkClient|auth\.getUser|getUser\(|session\s*\?\.\s*user|unauthorized|status:\s*401)|if\s*\(\s*!\s*session\b/i
const HOOKS = ['useState', 'useEffect', 'useContext', 'useReducer', 'useMemo', 'useCallback', 'useRef', 'useLayoutEffect', 'useTransition', 'useDeferredValue', 'useId', 'useOptimistic', 'useActionState', 'useFormStatus', 'use']
const NEXT_HOOKS = ['useRouter', 'usePathname', 'useSearchParams', 'useParams', 'useSelectedLayoutSegment']
const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']

function stripSrc(path) {
  return path.replace(/^(.*\/)?src\//, '$1')
}

function isUseClient(content) {
  return /^(\s*(\/\/[^\n]*|\/\*[\s\S]*?\*\/)?\s*)*['"]use client['"]/.test(content.slice(0, 800))
}
function isUseServer(content) {
  return /^(\s*(\/\/[^\n]*|\/\*[\s\S]*?\*\/)?\s*)*['"]use server['"]/.test(content.slice(0, 800))
}

/** Convierte una ruta de archivo del App Router en la URL: app/(shop)/blog/[slug]/page.tsx → /blog/[slug] */
export function appRouteFromPath(relPath) {
  const parts = relPath.split('/').slice(0, -1) // quitamos page.tsx / route.ts
  const segs = parts
    .filter((s) => !/^\(.*\)$/.test(s)) // grupos (marketing)
    .filter((s) => !s.startsWith('@')) // parallel routes
    .filter((s) => !s.startsWith('_')) // carpetas privadas
  return '/' + segs.join('/')
}

export function pagesRouteFromPath(relPath) {
  let r = relPath.replace(/\.(jsx?|tsx?|mdx?)$/, '')
  r = r.replace(/\/index$/, '').replace(/^index$/, '')
  return '/' + r
}

export function analyzeUsage(files, deps) {
  const code = files.filter((f) => isCodeFile(f.path))
  const paths = files.map((f) => f.path)

  // ── Lenguajes / líneas ─────────────────────────────────────────────────────
  const languages = {}
  let totalLines = 0
  for (const f of files) {
    if (!isCodeFile(f.path) && !isStyleFile(f.path)) continue
    const ext = extname(f.path)
    const lines = countLines(f.content)
    totalLines += lines
    languages[ext] ??= { files: 0, lines: 0 }
    languages[ext].files++
    languages[ext].lines += lines
  }
  const tsLines = ['.ts', '.tsx', '.mts', '.cts'].reduce((a, e) => a + (languages[e]?.lines ?? 0), 0)
  const jsLines = ['.js', '.jsx', '.mjs', '.cjs'].reduce((a, e) => a + (languages[e]?.lines ?? 0), 0)

  // ── Next.js ────────────────────────────────────────────────────────────────
  // Priorizamos lo declarado en el package.json raíz (evita que un ejemplo anidado defina el tipo);
  // en monorepos sin deps en la raíz, usamos cualquier package.json.
  const rootPath = deps.packageJsonPaths[0]
  const inRoot = deps.libraries.filter((l) => l.declaredIn.includes(rootPath))
  const typeSource = inRoot.some((l) => ['react', 'next'].includes(l.name)) ? inRoot : deps.libraries
  const nextLib = typeSource.find((l) => l.name === 'next')
  const reactLib = typeSource.find((l) => l.name === 'react')
  const appFiles = code.filter((f) => /(^|\/)app\//.test(stripSrc(f.path)) && !/node_modules/.test(f.path))
  const appDirRe = /(?:^|\/)app\/(.*)$/
  const pagesDirRe = /(?:^|\/)pages\/(.*)$/

  const pages = []
  const apiRoutes = []
  const special = { layout: 0, loading: 0, error: 0, 'not-found': 0, template: 0, 'global-error': 0 }
  let appRouter = false
  let pagesRouter = false

  for (const f of code) {
    const rel = stripSrc(f.path)
    const base = basename(rel).replace(/\.[^.]+$/, '')
    const appMatch = rel.match(appDirRe)
    if (appMatch && !rel.includes('/pages/')) {
      const inner = appMatch[1]
      if (base === 'page') {
        appRouter = true
        pages.push({ route: appRouteFromPath(inner), file: f.path, router: 'app', client: isUseClient(f.content), dynamic: /\[/.test(inner) })
      } else if (base === 'route') {
        appRouter = true
        const methods = HTTP_METHODS.filter((m) => new RegExp(`export\\s+(async\\s+)?(function|const)\\s+${m}\\b|export\\s*\\{[^}]*\\b${m}\\b`).test(f.content))
        apiRoutes.push({ route: appRouteFromPath(inner), file: f.path, router: 'app', methods, hasAuthCheck: AUTH_CHECK_RE.test(f.content) })
      } else if (base in special) {
        special[base]++
      }
      continue
    }
    const pagesMatch = rel.match(pagesDirRe)
    if (pagesMatch && (nextLib || paths.some((p) => /next\.config/.test(p)))) {
      const inner = pagesMatch[1]
      if (/^_(app|document|error)\./.test(inner)) continue
      pagesRouter = true
      if (inner.startsWith('api/')) {
        apiRoutes.push({ route: pagesRouteFromPath(inner), file: f.path, router: 'pages', methods: detectPagesApiMethods(f.content), hasAuthCheck: AUTH_CHECK_RE.test(f.content) })
      } else {
        pages.push({ route: pagesRouteFromPath(inner), file: f.path, router: 'pages', client: true, dynamic: /\[/.test(inner) })
      }
    }
  }
  pages.sort((a, b) => a.route.localeCompare(b.route))
  apiRoutes.sort((a, b) => a.route.localeCompare(b.route))

  const middlewareFile = code.find((f) => /^(src\/)?(middleware|proxy)\.[jt]s$/.test(f.path))
  const serverActionFiles = code
    .filter((f) => isUseServer(f.content) || /['"]use server['"]/.test(f.content))
    .map((f) => ({ file: f.path, hasAuthCheck: AUTH_CHECK_RE.test(f.content), fileLevel: isUseServer(f.content) }))

  const clientComponents = code.filter((f) => isUseClient(f.content))
  const nextConfig = files.find((f) => /(^|\/)next\.config\.[cm]?[jt]s$/.test(f.path))

  // Features de Next / data fetching
  const countIn = (re) => code.reduce((acc, f) => acc + (f.content.match(re)?.length ?? 0), 0)
  const dataFetching = {
    fetch: countIn(/\bfetch\s*\(/g),
    getServerSideProps: countIn(/export\s+(async\s+)?(function|const)\s+getServerSideProps/g),
    getStaticProps: countIn(/export\s+(async\s+)?(function|const)\s+getStaticProps/g),
    getStaticPaths: countIn(/export\s+(async\s+)?(function|const)\s+getStaticPaths/g),
    generateStaticParams: countIn(/export\s+(async\s+)?function\s+generateStaticParams/g),
    generateMetadata: countIn(/export\s+(async\s+)?function\s+generateMetadata/g),
    revalidate: countIn(/export\s+const\s+revalidate\s*=/g),
    forceDynamic: countIn(/export\s+const\s+dynamic\s*=\s*['"]force-dynamic['"]/g),
    unstableCache: countIn(/\b(unstable_cache|'use cache'|"use cache")/g),
  }

  const nextComponents = {
    'next/image': countIn(/from\s+['"]next\/image['"]/g),
    'next/link': countIn(/from\s+['"]next\/link['"]/g),
    'next/font': countIn(/from\s+['"]next\/font\/\w+['"]/g),
    'next/script': countIn(/from\s+['"]next\/script['"]/g),
    'next/dynamic': countIn(/from\s+['"]next\/dynamic['"]/g),
    '<img> nativo': countIn(/<img\b/g),
    '<a href> nativo': countIn(/<a\s[^>]*href=/g),
  }

  // ── React ──────────────────────────────────────────────────────────────────
  const hooks = Object.fromEntries([...HOOKS, ...NEXT_HOOKS].map((h) => [h, 0]))
  const customHooks = new Map()
  const components = []
  const contexts = []
  for (const f of code) {
    const src = stripComments(f.content)
    for (const h of [...HOOKS, ...NEXT_HOOKS]) {
      const re = new RegExp(`(?<![\\w.])(?:React\\.)?${h}\\s*[<(]`, 'g')
      hooks[h] += src.match(re)?.length ?? 0
    }
    for (const m of src.matchAll(/(?:export\s+)?(?:default\s+)?(?:function|const|let)\s+(use[A-Z]\w*)\s*[=(]/g)) {
      customHooks.set(m[1], f.path)
    }
    if (/\.(jsx|tsx)$/.test(f.path) || /<[A-Z]\w*|<\/?[a-z]+[\s>]/.test(src)) {
      for (const m of src.matchAll(/(?:export\s+)?(?:default\s+)?(?:function\s+([A-Z]\w*)\s*\(|(?:const|let)\s+([A-Z]\w*)\s*(?::\s*[\w.<>, ]+)?\s*=\s*(?:React\.)?(?:memo\(|forwardRef\(|\([^)]*\)\s*=>|\w+\s*=>|async\s*\())/g)) {
        components.push({ name: m[1] ?? m[2], file: f.path, client: isUseClient(f.content) })
      }
    }
    for (const m of src.matchAll(/(?:const|let)\s+(\w+)\s*=\s*(?:React\.)?createContext\b/g)) {
      contexts.push({ name: m[1], file: f.path })
    }
  }
  delete hooks.use
  for (const k of Object.keys(hooks)) if (!hooks[k]) delete hooks[k]

  // ── Estilos ────────────────────────────────────────────────────────────────
  const libNames = new Set(deps.libraries.map((l) => l.name))
  const styling = []
  if (libNames.has('tailwindcss') || paths.some((p) => /tailwind\.config/.test(p)) || files.some((f) => isStyleFile(f.path) && /@(import\s+['"]tailwindcss|tailwind\s+base)/.test(f.content))) styling.push('Tailwind CSS')
  if (paths.some((p) => /\.module\.(css|scss|sass)$/.test(p))) styling.push('CSS Modules')
  if (libNames.has('styled-components')) styling.push('styled-components')
  if ([...libNames].some((n) => n.startsWith('@emotion/'))) styling.push('Emotion')
  if (libNames.has('sass') || paths.some((p) => /\.s[ac]ss$/.test(p))) styling.push('Sass/SCSS')
  if (paths.some((p) => /components\.json$/.test(p)) && [...libNames].some((n) => n.startsWith('@radix-ui/'))) styling.push('shadcn/ui')
  if ([...libNames].some((n) => n.startsWith('@mui/'))) styling.push('Material UI')
  if ([...libNames].some((n) => n.startsWith('@chakra-ui/'))) styling.push('Chakra UI')
  if (!styling.length && paths.some((p) => /\.css$/.test(p))) styling.push('CSS plano')

  // ── Stack detectado por categoría ──────────────────────────────────────────
  const stack = {}
  for (const l of deps.libraries) {
    if (l.type === 'workspace' || !l.known) continue
    if (['types', 'lint'].includes(l.category)) continue
    ;(stack[l.categoryLabel] ??= []).push(l.name)
  }

  // ── Variables de entorno ───────────────────────────────────────────────────
  const envVars = new Map()
  for (const f of code) {
    for (const m of f.content.matchAll(/process\.env\.([A-Z0-9_]+)|process\.env\[['"]([A-Z0-9_]+)['"]\]|import\.meta\.env\.([A-Z0-9_]+)/g)) {
      const name = m[1] ?? m[2] ?? m[3]
      if (!envVars.has(name)) envVars.set(name, { name, public: /^(NEXT_PUBLIC_|VITE_|REACT_APP_)/.test(name), files: new Set() })
      envVars.get(name).files.add(f.path)
    }
  }

  // ── Tests / configs / calidad ──────────────────────────────────────────────
  const testFiles = code.filter((f) => /\.(test|spec)\.[cm]?[jt]sx?$/.test(f.path) || /__tests__\//.test(f.path) || /(^|\/)(e2e|cypress)\//.test(f.path))
  const configs = []
  const cfgChecks = [
    [/next\.config\./, 'next.config'],
    [/tsconfig\.json$/, 'TypeScript (tsconfig)'],
    [/tailwind\.config\./, 'Tailwind config'],
    [/postcss\.config\./, 'PostCSS'],
    [/(^|\/)(\.eslintrc|eslint\.config)/, 'ESLint'],
    [/(^|\/)(\.prettierrc|prettier\.config)/, 'Prettier'],
    [/(^|\/)biome\.jsonc?$/, 'Biome'],
    [/(^|\/)(jest|vitest|playwright|cypress)\.config/, 'Config de tests'],
    [/(^|\/)Dockerfile$/, 'Docker'],
    [/(^|\/)docker-compose\.ya?ml$/, 'Docker Compose'],
    [/(^|\/)vercel\.json$/, 'Vercel'],
    [/(^|\/)netlify\.toml$/, 'Netlify'],
    [/^\.github\/workflows\//, 'GitHub Actions'],
    [/(^|\/)\.gitlab-ci\.yml$/, 'GitLab CI'],
    [/(^|\/)prisma\/schema\.prisma$|schema\.prisma$/, 'Prisma schema'],
    [/(^|\/)drizzle\.config\./, 'Drizzle'],
    [/(^|\/)components\.json$/, 'shadcn/ui'],
    [/(^|\/)turbo\.json$/, 'Turborepo'],
    [/(^|\/)pnpm-workspace\.yaml$/, 'pnpm workspaces'],
    [/(^|\/)\.storybook\//, 'Storybook'],
    [/(^|\/)\.husky\//, 'Husky'],
    [/(^|\/)(sentry\.(client|server|edge)\.config|instrumentation)\.[jt]s$/, 'Sentry / instrumentation'],
  ]
  for (const [re, label] of cfgChecks) if (paths.some((p) => re.test(p)) && !configs.includes(label)) configs.push(label)

  const todos = []
  for (const f of code) {
    for (const m of f.content.matchAll(/\/\/\s*(TODO|FIXME|HACK|XXX)\b[:\s]*(.*)/g)) {
      todos.push({ file: f.path, tag: m[1], text: m[2].trim().slice(0, 120) })
    }
  }
  const consoleLogs = countIn(/\bconsole\.log\s*\(/g)
  const anyTypes = countIn(/:\s*any\b|as\s+any\b|<any>/g)

  const largestFiles = code
    .map((f) => ({ file: f.path, lines: countLines(f.content) }))
    .sort((a, b) => b.lines - a.lines)
    .slice(0, 10)

  const projectType = nextLib
    ? 'Next.js'
    : typeSource.some((l) => l.name === 'vite') && reactLib
      ? 'React + Vite'
      : typeSource.some((l) => l.name === 'react-scripts')
        ? 'React (Create React App)'
        : typeSource.some((l) => l.name.startsWith('@remix-run/'))
          ? 'Remix'
          : reactLib
            ? 'React'
            : deps.libraries.length
              ? 'Node.js / JavaScript'
              : 'Desconocido'

  return {
    projectType,
    isReact: Boolean(reactLib),
    reactVersion: reactLib?.version ?? null,
    typescript: tsLines > 0,
    typescriptRatio: tsLines + jsLines ? Math.round((tsLines / (tsLines + jsLines)) * 100) : 0,
    totals: {
      files: files.length,
      codeFiles: code.length,
      lines: totalLines,
      components: components.length,
      clientComponents: clientComponents.length,
      customHooks: customHooks.size,
      contexts: contexts.length,
      testFiles: testFiles.length,
      todos: todos.length,
      consoleLogs,
      anyTypes,
    },
    languages,
    next: {
      detected: Boolean(nextLib) || Boolean(nextConfig),
      version: nextLib?.version ?? null,
      router: !nextLib ? null : appRouter && pagesRouter ? 'App Router + Pages Router' : appRouter ? 'App Router' : pagesRouter ? 'Pages Router' : null,
      pages,
      apiRoutes,
      special,
      middleware: middlewareFile?.path ?? null,
      serverActionFiles,
      serverComponents: appFiles.filter((f) => /\.(jsx|tsx)$/.test(f.path) && !isUseClient(f.content)).length,
      clientComponents: appFiles.filter((f) => isUseClient(f.content)).length,
      dataFetching,
      components: nextComponents,
      config: nextConfig?.path ?? null,
    },
    hooks,
    customHooks: [...customHooks.entries()].map(([name, file]) => ({ name, file })).sort((a, b) => a.name.localeCompare(b.name)),
    components: components.slice(0, 500),
    contexts,
    styling,
    stack,
    envVars: [...envVars.values()].map((e) => ({ ...e, files: [...e.files].sort() })).sort((a, b) => a.name.localeCompare(b.name)),
    testFiles: testFiles.map((f) => f.path),
    configs,
    todos,
    largestFiles,
  }
}

function detectPagesApiMethods(content) {
  const methods = HTTP_METHODS.filter((m) => new RegExp(`method\\s*===?\\s*['"]${m}['"]|case\\s+['"]${m}['"]`).test(content))
  return methods.length ? methods : ['handler']
}
