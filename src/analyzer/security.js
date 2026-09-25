// Análisis estático de seguridad por reglas (sin IA).
import semver from 'semver'
import { basename, isCodeFile, lineOf, maskStringsAndComments, snippetAt } from './files.js'

export const SEVERITIES = ['critical', 'high', 'medium', 'low', 'info']
export const SEVERITY_LABELS = { critical: 'Crítica', high: 'Alta', medium: 'Media', low: 'Baja', info: 'Info' }
const SEVERITY_PLURALS = { critical: 'críticas', high: 'altas', medium: 'medias', low: 'bajas', info: 'info' }
const SEVERITY_WEIGHT = { critical: 25, high: 10, medium: 4, low: 1, info: 0 }

// ── Secretos hardcodeados ────────────────────────────────────────────────────
const SECRET_PATTERNS = [
  { id: 'aws-access-key', re: /\b(AKIA|ASIA)[0-9A-Z]{16}\b/g, title: 'AWS Access Key', severity: 'critical' },
  { id: 'private-key', re: /-----BEGIN (RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY( BLOCK)?-----/g, title: 'Clave privada', severity: 'critical' },
  { id: 'anthropic-key', re: /\bsk-ant-[A-Za-z0-9_-]{20,}/g, title: 'API key de Anthropic', severity: 'critical' },
  { id: 'openai-key', re: /\bsk-(proj-|svcacct-)?[A-Za-z0-9_-]{20,}T3BlbkFJ[A-Za-z0-9_-]{20,}|\bsk-proj-[A-Za-z0-9_-]{40,}/g, title: 'API key de OpenAI', severity: 'critical' },
  { id: 'stripe-secret', re: /\b(sk|rk)_live_[0-9a-zA-Z]{20,}/g, title: 'Clave secreta de Stripe (live)', severity: 'critical' },
  { id: 'github-token', re: /\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36}\b|\bgithub_pat_[A-Za-z0-9_]{50,}/g, title: 'Token de GitHub', severity: 'critical' },
  { id: 'slack-token', re: /\bxox[baprs]-[0-9A-Za-z-]{10,}/g, title: 'Token de Slack', severity: 'high' },
  { id: 'slack-webhook', re: /https:\/\/hooks\.slack\.com\/services\/T[A-Z0-9]+\/B[A-Z0-9]+\/[A-Za-z0-9]+/g, title: 'Webhook de Slack', severity: 'high' },
  { id: 'google-api-key', re: /\bAIza[0-9A-Za-z_-]{35}\b/g, title: 'API key de Google', severity: 'high' },
  { id: 'sendgrid-key', re: /\bSG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}\b/g, title: 'API key de SendGrid', severity: 'high' },
  { id: 'resend-key', re: /\bre_[A-Za-z0-9]{8}_[A-Za-z0-9]{20,}/g, title: 'API key de Resend', severity: 'high' },
  { id: 'mp-token', re: /\bAPP_USR-\d{10,}-\d{6}-[a-f0-9]{32}-\d+/g, title: 'Access token de Mercado Pago', severity: 'critical' },
  { id: 'jwt', re: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, title: 'JWT hardcodeado', severity: 'medium' },
  { id: 'db-url', re: /\b(postgres(ql)?|mysql|mongodb(\+srv)?|redis|amqp):\/\/[^\s:'"`/]+:[^\s@'"`]+@[^\s'"`]+/g, title: 'Cadena de conexión con credenciales', severity: 'high' },
]

// Asignaciones genéricas tipo password = "..." (sólo en código, no en .env).
const GENERIC_SECRET_RE = /\b([A-Za-z_]*(?:password|passwd|secret|api[_-]?key|apikey|access[_-]?token|auth[_-]?token|private[_-]?key|client[_-]?secret)[A-Za-z_]*)\s*[:=]\s*['"`]([^'"`\s]{8,})['"`]/gi
const PLACEHOLDER_RE = /^(x+|\*+|\.+|your|changeme|change_me|example|placeholder|test|dummy|todo|<.*>|\$\{.*\}|process\.env|undefined|null|password|secret)/i

// ── Patrones de código inseguro ──────────────────────────────────────────────
const CODE_RULES = [
  {
    id: 'dangerously-set-inner-html',
    codeOnly: true,
    re: /dangerouslySetInnerHTML\s*=\s*\{\s*\{/g,
    severity: 'medium',
    title: 'Uso de dangerouslySetInnerHTML',
    description: 'Inyectar HTML sin sanitizar permite XSS. Sanitizá el contenido (DOMPurify) o evitá esta API.',
    downgradeIf: /DOMPurify|sanitize|xss\(/i,
  },
  {
    id: 'eval',
    codeOnly: true,
    re: /(?<![\w.])eval\s*\(/g,
    severity: 'high',
    title: 'Uso de eval()',
    description: 'eval ejecuta código arbitrario; si recibe datos del usuario es inyección de código.',
  },
  {
    id: 'new-function',
    codeOnly: true,
    re: /\bnew\s+Function\s*\(/g,
    severity: 'high',
    title: 'Uso de new Function()',
    description: 'Equivalente a eval: ejecuta strings como código.',
  },
  {
    id: 'string-timer',
    re: /\bset(Timeout|Interval)\s*\(\s*['"`]/g,
    severity: 'medium',
    title: 'setTimeout/setInterval con string',
    description: 'Pasar un string evalúa código. Usá una función.',
  },
  {
    id: 'inner-html',
    codeOnly: true,
    re: /\.(innerHTML|outerHTML)\s*=(?!=)|\.insertAdjacentHTML\s*\(|document\.write(ln)?\s*\(/g,
    severity: 'medium',
    title: 'Manipulación directa de HTML (innerHTML / document.write)',
    description: 'Riesgo de XSS si el contenido proviene de datos externos.',
    downgradeIf: /DOMPurify|sanitize/i,
  },
  {
    id: 'command-injection',
    re: /\b(exec|execSync|spawn|spawnSync|execFile)\s*\(\s*(`[^`]*\$\{|[^,)]*\+\s*\w)/g,
    severity: 'high',
    title: 'Posible inyección de comandos',
    description: 'Se construye un comando del sistema con datos interpolados. Validá/escapá o usá execFile con argumentos.',
  },
  {
    id: 'sql-injection',
    re: /\b(query|execute|raw|sql\.unsafe|\$queryRawUnsafe|\$executeRawUnsafe)\s*\(\s*`[^`]*\b(SELECT|INSERT|UPDATE|DELETE|WHERE|FROM)\b[^`]*\$\{/gi,
    severity: 'high',
    title: 'Posible inyección SQL',
    description: 'Consulta SQL armada con template string. Usá consultas parametrizadas.',
  },
  {
    id: 'prisma-unsafe',
    codeOnly: true,
    re: /\$(queryRawUnsafe|executeRawUnsafe)\s*\(/g,
    severity: 'medium',
    title: 'Prisma $queryRawUnsafe / $executeRawUnsafe',
    description: 'Estas APIs no escapan parámetros. Preferí $queryRaw con tagged template.',
  },
  {
    id: 'tls-disabled',
    re: /rejectUnauthorized\s*:\s*false|NODE_TLS_REJECT_UNAUTHORIZED\s*=?\s*['"]?0/g,
    severity: 'high',
    title: 'Verificación TLS deshabilitada',
    description: 'Permite ataques man-in-the-middle.',
  },
  {
    id: 'jwt-none',
    re: /algorithms\s*:\s*\[[^\]]*['"]none['"]/gi,
    severity: 'critical',
    title: 'JWT acepta algoritmo "none"',
    description: 'Cualquiera puede forjar tokens válidos.',
  },
  {
    id: 'jwt-ignore-exp',
    codeOnly: true,
    re: /ignoreExpiration\s*:\s*true/g,
    severity: 'medium',
    title: 'JWT ignora la expiración',
    description: 'Los tokens nunca vencen.',
  },
  {
    id: 'jwt-decode',
    codeOnly: true,
    re: /\bjwt\.decode\s*\(/g,
    severity: 'low',
    title: 'jwt.decode() no verifica la firma',
    description: 'Si se usa para autorizar, cualquiera puede forjar el token. Usá jwt.verify().',
    onlyIfFileLacks: /jwt\.verify|jwtVerify/,
  },
  {
    id: 'cors-wildcard',
    re: /['"]Access-Control-Allow-Origin['"]\s*[,:]\s*['"]\*['"]|\borigin\s*:\s*['"]\*['"]|\bcors\(\s*\)/g,
    severity: 'medium',
    title: 'CORS abierto a cualquier origen',
    description: 'Cualquier sitio puede llamar a esta API desde el navegador. Restringí los orígenes permitidos.',
  },
  {
    id: 'token-localstorage',
    re: /(localStorage|sessionStorage)\.setItem\s*\(\s*['"`][^'"`]*(token|jwt|auth|session|password|secret)[^'"`]*['"`]/gi,
    severity: 'medium',
    title: 'Token/credencial en localStorage',
    description: 'localStorage es accesible por cualquier script (XSS). Preferí cookies httpOnly.',
  },
  {
    id: 'weak-hash',
    re: /createHash\s*\(\s*['"](md5|sha1)['"]/gi,
    severity: 'low',
    title: 'Hash criptográfico débil (MD5/SHA1)',
    description: 'No usar para contraseñas ni firmas. Usá bcrypt/argon2 o SHA-256+.',
  },
  {
    id: 'insecure-random',
    re: /Math\.random\(\)[^;\n]{0,60}(token|secret|password|otp|nonce|salt)|(token|secret|password|otp|nonce|salt)\w*\s*=\s*[^;\n]{0,40}Math\.random\(\)/gi,
    severity: 'medium',
    title: 'Math.random() usado para valores sensibles',
    description: 'No es criptográficamente seguro. Usá crypto.randomUUID() / crypto.getRandomValues().',
  },
  {
    id: 'path-traversal',
    re: /\b(readFile|readFileSync|createReadStream|writeFile|writeFileSync|unlink|unlinkSync)\s*\([^)]*\b(req\.(query|body|params)|searchParams\.get|params\.)/g,
    severity: 'high',
    title: 'Posible path traversal',
    description: 'Se accede al sistema de archivos con datos del request. Normalizá y validá la ruta.',
  },
  {
    id: 'open-redirect',
    re: /\b(redirect|res\.redirect|NextResponse\.redirect|router\.push)\s*\(\s*(req\.(query|body)|searchParams\.get\(|request\.nextUrl\.searchParams\.get\()/g,
    severity: 'medium',
    title: 'Posible open redirect',
    description: 'Se redirige a una URL tomada del request sin validar.',
  },
  {
    id: 'ssrf',
    re: /\b(fetch|axios\.get|axios\.post|axios)\s*\(\s*(req\.(query|body)\.|searchParams\.get\(|body\.url|params\.url)/g,
    severity: 'medium',
    title: 'Posible SSRF',
    description: 'El servidor hace un request a una URL controlada por el usuario.',
  },
  {
    id: 'browser-ai-key',
    codeOnly: true,
    re: /dangerouslyAllowBrowser\s*:\s*true/g,
    severity: 'high',
    title: 'Cliente de IA habilitado en el navegador',
    description: 'La API key del proveedor de IA queda expuesta a cualquier visitante.',
  },
  {
    id: 'insecure-cookie',
    codeOnly: true,
    re: /\b(httpOnly|httponly)\s*:\s*false|\bsecure\s*:\s*false/g,
    severity: 'low',
    title: 'Cookie sin httpOnly / secure',
    description: 'Revisá que las cookies de sesión tengan httpOnly, secure y sameSite.',
  },
  {
    id: 'sensitive-log',
    re: /console\.(log|info|debug)\s*\([^)]*\b(password|passwd|secret|token|apiKey|api_key)\b/gi,
    severity: 'low',
    title: 'Se loguean datos sensibles',
    description: 'Los logs pueden terminar en servicios de terceros.',
  },
  {
    id: 'http-url',
    re: /['"`]http:\/\/(?!localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|www\.w3\.org|schemas\.|json-schema\.org)[^'"`\s]+['"`]/g,
    severity: 'low',
    title: 'URL sin HTTPS',
    description: 'Tráfico sin cifrar hacia un host externo.',
  },
]

const PUBLIC_ENV_PREFIX = /\b(NEXT_PUBLIC_|VITE_|REACT_APP_|EXPO_PUBLIC_|PUBLIC_)(\w+)/g
const SENSITIVE_NAME_STRONG = /(SECRET|PRIVATE|PASSWORD|PASSWD|SERVICE_ROLE|ADMIN|DATABASE_URL|DB_URL)/i
const SENSITIVE_NAME_WEAK = /(API_KEY|TOKEN|ACCESS_KEY)/i
const PUBLIC_BY_DESIGN = /(PUBLISHABLE|ANON|SITE_KEY|MEASUREMENT|GA_|GTM|POSTHOG|SENTRY_DSN|MAPBOX|FIREBASE)/i

function makeFinding(rule, file, content, index, extra = {}) {
  return {
    id: rule.id,
    severity: rule.severity,
    title: rule.title,
    description: rule.description ?? '',
    file,
    line: index != null ? lineOf(content, index) : null,
    snippet: index != null ? snippetAt(content, index) : null,
    ...extra,
  }
}

function redact(value) {
  if (value.length <= 8) return '****'
  return value.slice(0, 4) + '…' + value.slice(-2) + ` (${value.length} caracteres)`
}

// ── .gitignore ───────────────────────────────────────────────────────────────
function globToRegex(glob) {
  const esc = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '§').replace(/\*/g, '[^/]*').replace(/\?/g, '.').replace(/§/g, '.*')
  return new RegExp(`^${esc}$`)
}

export function isGitIgnored(path, gitignores) {
  let ignored = false
  for (const gi of gitignores) {
    const dir = gi.path.includes('/') ? gi.path.slice(0, gi.path.lastIndexOf('/') + 1) : ''
    if (!path.startsWith(dir)) continue
    const rel = path.slice(dir.length)
    for (let raw of gi.content.split('\n')) {
      raw = raw.trim()
      if (!raw || raw.startsWith('#')) continue
      const negate = raw.startsWith('!')
      let pattern = negate ? raw.slice(1) : raw
      pattern = pattern.replace(/\/$/, '')
      const anchored = pattern.startsWith('/') || pattern.slice(0, -1).includes('/')
      pattern = pattern.replace(/^\//, '')
      const re = globToRegex(pattern)
      const candidates = anchored ? [rel] : [rel, basename(rel), ...rel.split('/')]
      if (candidates.some((c) => re.test(c))) ignored = !negate
    }
  }
  return ignored
}

// ── Análisis principal ───────────────────────────────────────────────────────
export function analyzeSecurity(files, deps, usage) {
  const findings = []
  const gitignores = files.filter((f) => basename(f.path) === '.gitignore')

  for (const f of files) {
    const base = basename(f.path)
    const isEnv = /^\.env/.test(base)
    const isExampleEnv = /\.(example|sample|template|dist)$/.test(base)
    const isLock = /(package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$/.test(base)
    const isTest = /(\.|\/)(test|spec)\.[jt]sx?$|__tests__|__mocks__|\/fixtures?\//.test(f.path)
    if (isLock) continue

    // Archivos .env
    if (isEnv) {
      const ignored = isGitIgnored(f.path, gitignores)
      const vars = [...f.content.matchAll(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)$/gm)]
      const filled = vars.filter((v) => v[2].trim() && !/^['"]?['"]?$/.test(v[2].trim()))
      if (!isExampleEnv && !ignored && filled.length) {
        findings.push({
          id: 'env-not-ignored',
          severity: 'high',
          title: 'Archivo .env con valores no ignorado por git',
          description: `El archivo tiene ${filled.length} variable(s) con valor y no está cubierto por .gitignore: podría subirse al repositorio.`,
          file: f.path,
          line: null,
          snippet: null,
        })
      }
      for (const v of vars) {
        const name = v[1]
        const pub = name.match(/^(NEXT_PUBLIC_|VITE_|REACT_APP_|EXPO_PUBLIC_)(\w+)/)
        if (pub && SENSITIVE_NAME_STRONG.test(pub[2]) && !PUBLIC_BY_DESIGN.test(pub[2])) {
          findings.push(makeFinding({
            id: 'public-env-secret',
            severity: 'high',
            title: 'Secreto expuesto al navegador por prefijo público',
            description: `${name} se incluye en el bundle del cliente (prefijo ${pub[1]}). Cualquiera puede leerlo.`,
          }, f.path, f.content, v.index, { snippet: `${name}=…` }))
        }
      }
      // En .env de ejemplo no debería haber secretos reales
      if (isExampleEnv) scanSecrets(f, findings, { skipGeneric: true })
      continue
    }

    scanSecrets(f, findings, { skipGeneric: !isCodeFile(f.path) || isTest })

    if (!isCodeFile(f.path)) continue

    const masked = maskStringsAndComments(f.content)
    for (const rule of CODE_RULES) {
      if (rule.onlyIfFileLacks && rule.onlyIfFileLacks.test(f.content)) continue
      rule.re.lastIndex = 0
      let m
      let count = 0
      while ((m = rule.re.exec(rule.codeOnly ? masked : f.content)) && count < 5) {
        count++
        const finding = makeFinding(rule, f.path, f.content, m.index)
        if (rule.downgradeIf && rule.downgradeIf.test(f.content)) {
          finding.severity = 'low'
          finding.description += ' (El archivo parece sanitizar el contenido.)'
        }
        if (isTest && finding.severity !== 'info') finding.severity = 'info'
        findings.push(finding)
      }
    }

    // Variables públicas con nombre sensible referenciadas en el código
    PUBLIC_ENV_PREFIX.lastIndex = 0
    let m
    const seen = new Set()
    while ((m = PUBLIC_ENV_PREFIX.exec(f.content))) {
      const [full, prefix, rest] = m
      if (seen.has(full) || PUBLIC_BY_DESIGN.test(rest)) continue
      seen.add(full)
      const strong = SENSITIVE_NAME_STRONG.test(rest)
      const weak = SENSITIVE_NAME_WEAK.test(rest)
      if (!strong && !weak) continue
      findings.push(makeFinding({
        id: 'public-env-secret',
        severity: strong ? 'high' : 'medium',
        title: strong ? 'Secreto expuesto al navegador por prefijo público' : 'Posible clave expuesta al navegador',
        description: `${full} lleva el prefijo ${prefix}, por lo que su valor se incluye en el JavaScript del cliente.${strong ? '' : ' Verificá que sea una clave pública (publishable).'}`,
      }, f.path, f.content, m.index))
    }

    // SDK de IA importado en un componente cliente
    if (/^\s*['"]use client['"]/m.test(f.content.slice(0, 500)) && /from\s+['"](openai|@anthropic-ai\/sdk|@google\/generative-ai|@google\/genai|groq-sdk|@mistralai\/mistralai|cohere-ai)['"]/.test(f.content)) {
      findings.push({
        id: 'ai-sdk-client',
        severity: 'high',
        title: 'SDK de IA usado en un componente cliente',
        description: 'Llamar al proveedor de IA desde el navegador expone la API key. Movelo a un Route Handler o Server Action.',
        file: f.path,
        line: null,
        snippet: null,
      })
    }
  }

  // ── Dependencias ───────────────────────────────────────────────────────────
  for (const lib of deps.libraries) {
    if (lib.vulnerabilities.length) {
      // Un hallazgo por librería (algunas, como next, pueden tener decenas de avisos)
      const vulns = [...lib.vulnerabilities].sort((a, b) => SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity) || (b.score ?? 0) - (a.score ?? 0))
      const worst = vulns[0]
      const bySeverity = SEVERITIES.map((s) => [s, vulns.filter((v) => v.severity === s).length]).filter(([, n]) => n)
      const fixes = vulns.map((v) => v.fixVersion).filter((f) => f && semver.valid(f))
      const fixAll = fixes.length ? fixes.sort(semver.rcompare)[0] : null
      const estimated = lib.versionSource === 'rango' ? ` Versión estimada desde el rango de package.json (${deps.lockfile ? 'no figura en el lockfile' : 'no hay lockfile'}).` : ''
      findings.push({
        id: 'vulnerable-dependency',
        severity: worst.severity,
        title:
          vulns.length === 1
            ? `${lib.name}@${lib.version}: ${worst.title}`
            : `${lib.name}@${lib.version}: ${vulns.length} vulnerabilidades conocidas (${bySeverity.map(([s, n]) => `${n} ${n === 1 ? SEVERITY_LABELS[s].toLowerCase() : SEVERITY_PLURALS[s]}`).join(', ')})`,
        description:
          (vulns.length === 1 ? `${worst.id}. ${worst.fix}` : fixAll ? `Actualizar a ${fixAll} o superior corrige todas las que tienen parche.` : `La más grave: ${worst.title} (${worst.id}). ${worst.fix}`) +
          estimated +
          (lib.vulnSource === 'online' ? ' Fuente: GitHub Advisory Database (consulta online).' : ' Fuente: base offline.'),
        file: lib.declaredIn[0] ?? 'package.json',
        line: null,
        snippet: `"${lib.name}": "${lib.spec}"`,
        cve: worst.id,
        advisories: vulns.map((v) => ({ id: v.id, title: v.title, severity: v.severity, url: v.url, fixVersion: v.fixVersion, score: v.score ?? null })),
      })
    }
    if (lib.deprecated) {
      findings.push({
        id: 'deprecated-dependency',
        severity: 'low',
        title: `Dependencia deprecada: ${lib.name}`,
        description: lib.deprecated,
        file: lib.declaredIn[0] ?? 'package.json',
        line: null,
        snippet: `"${lib.name}": "${lib.spec}"`,
      })
    }
    if (lib.origin === 'git' || lib.origin === 'url') {
      findings.push({
        id: 'unpinned-source',
        severity: 'medium',
        title: `Dependencia instalada desde ${lib.origin === 'git' ? 'git' : 'una URL'}: ${lib.name}`,
        description: 'No pasa por el registry de npm ni tiene versión inmutable salvo que se fije un commit. Riesgo de supply chain.',
        file: lib.declaredIn[0] ?? 'package.json',
        line: null,
        snippet: `"${lib.name}": "${lib.spec}"`,
      })
    }
    if (lib.spec === '*' || lib.spec === 'latest') {
      findings.push({
        id: 'unbounded-version',
        severity: 'low',
        title: `Versión sin acotar: ${lib.name}@${lib.spec}`,
        description: 'Cualquier nueva versión (incluso una maliciosa o con breaking changes) se instalaría automáticamente.',
        file: lib.declaredIn[0] ?? 'package.json',
        line: null,
        snippet: `"${lib.name}": "${lib.spec}"`,
      })
    }
  }
  const seenTransitive = new Set()
  for (const v of deps.transitiveVulnerabilities) {
    const key = `${v.name}@${v.version}:${v.id}`
    if (seenTransitive.has(key)) continue
    seenTransitive.add(key)
    findings.push({
      id: 'vulnerable-transitive',
      severity: v.severity === 'critical' ? 'high' : v.severity === 'high' ? 'medium' : 'low',
      title: `Dependencia transitiva ${v.name}@${v.version}: ${v.title}`,
      description: `${v.id}. ${v.fix} (Instalada indirectamente por otra dependencia.)`,
      file: deps.lockfile?.path ?? 'lockfile',
      line: null,
      snippet: null,
      cve: v.id,
    })
  }
  if (!deps.lockfile && deps.libraries.length) {
    findings.push({
      id: 'no-lockfile',
      severity: 'low',
      title: 'No hay lockfile',
      description: 'Sin package-lock.json / pnpm-lock.yaml / yarn.lock las versiones instaladas no son reproducibles.',
      file: 'package.json',
      line: null,
      snippet: null,
    })
  }

  // Scripts de instalación
  const rootPkg = files.find((f) => f.path === deps.packageJsonPaths[0])
  for (const [name, cmd] of Object.entries(deps.scripts ?? {})) {
    if (/\b(curl|wget)\b[^|]*\|\s*(ba|z)?sh/.test(cmd)) {
      findings.push({
        id: 'curl-pipe-sh',
        severity: 'high',
        title: `Script "${name}" descarga y ejecuta código remoto`,
        description: 'curl | sh ejecuta lo que devuelva el servidor sin verificación.',
        file: rootPkg?.path ?? 'package.json',
        line: null,
        snippet: cmd,
      })
    } else if (/^(pre|post)?install$/.test(name)) {
      findings.push({
        id: 'install-script',
        severity: 'info',
        title: `Script de instalación "${name}"`,
        description: 'Se ejecuta automáticamente al instalar. Revisá qué hace.',
        file: rootPkg?.path ?? 'package.json',
        line: null,
        snippet: cmd,
      })
    }
  }

  // ── Next.js ────────────────────────────────────────────────────────────────
  if (usage?.next?.detected) {
    const cfg = files.find((f) => /(^|\/)next\.config\.[cm]?[jt]s$/.test(f.path))
    if (cfg) {
      const checks = [
        { re: /hostname\s*:\s*['"]\*\*?['"]|domains\s*:\s*\[[^\]]*['"]\*['"]/, id: 'next-image-wildcard', severity: 'medium', title: 'next/image permite cualquier host remoto', description: 'Tu servidor puede usarse como proxy/optimizador de imágenes de cualquier dominio.' },
        { re: /dangerouslyAllowSVG\s*:\s*true/, id: 'next-svg', severity: 'medium', title: 'dangerouslyAllowSVG habilitado', description: 'Los SVG pueden contener scripts. Acompañalo de contentSecurityPolicy.' },
        { re: /productionBrowserSourceMaps\s*:\s*true/, id: 'next-sourcemaps', severity: 'low', title: 'Source maps públicos en producción', description: 'Expone el código fuente original a cualquiera.' },
        { re: /ignoreBuildErrors\s*:\s*true/, id: 'next-ts-ignore', severity: 'low', title: 'Build ignora errores de TypeScript', description: 'Errores de tipos pueden llegar a producción.' },
        { re: /ignoreDuringBuilds\s*:\s*true/, id: 'next-eslint-ignore', severity: 'info', title: 'Build ignora errores de ESLint', description: 'Reglas de lint (incluidas las de seguridad) no bloquean el deploy.' },
      ]
      for (const c of checks) {
        const m = c.re.exec(cfg.content)
        if (m) findings.push(makeFinding(c, cfg.path, cfg.content, m.index))
      }
      const hasHeaders = /async\s+headers\s*\(|headers\s*:\s*async|headers\s*\(\)\s*\{/.test(cfg.content)
      const hasCSPElsewhere = files.some((f) => isCodeFile(f.path) && /Content-Security-Policy/i.test(f.content))
      if (!hasHeaders && !hasCSPElsewhere) {
        findings.push({
          id: 'next-no-security-headers',
          severity: 'low',
          title: 'No se configuran headers de seguridad',
          description: 'No se encontró headers() en next.config ni Content-Security-Policy en middleware. Considerá CSP, X-Frame-Options, HSTS, etc.',
          file: cfg.path,
          line: null,
          snippet: null,
        })
      }
      if (!/poweredByHeader\s*:\s*false/.test(cfg.content)) {
        findings.push({
          id: 'next-powered-by',
          severity: 'info',
          title: 'Header X-Powered-By habilitado',
          description: 'Revela que el sitio usa Next.js. Podés desactivarlo con poweredByHeader: false.',
          file: cfg.path,
          line: null,
          snippet: null,
        })
      }
    }

    // Middleware + versión vulnerable a CVE-2025-29927
    const nextLib = deps.libraries.find((l) => l.name === 'next')
    if (usage.next.middleware && nextLib?.vulnerabilities.some((v) => /CVE-2025-29927|GHSA-f82v-jwr5-mffw/.test(v.id) || /middleware/i.test(v.title) && /bypass/i.test(v.title))) {
      findings.push({
        id: 'middleware-bypass-exposed',
        severity: 'critical',
        title: 'El proyecto usa middleware con una versión de Next vulnerable a bypass',
        description: 'Si el middleware protege rutas (auth), un atacante puede saltearlo con el header x-middleware-subrequest. Actualizá Next.js.',
        file: usage.next.middleware,
        line: null,
        snippet: null,
      })
    }

    // Endpoints sin verificación de auth aparente
    for (const route of usage.next.apiRoutes) {
      if (route.hasAuthCheck) continue
      const mutating = route.methods.some((m) => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(m)) || route.methods.includes('handler')
      if (!mutating) continue
      findings.push({
        id: 'api-no-auth',
        severity: 'info',
        title: `Endpoint sin verificación de autenticación aparente: ${route.route}`,
        description: `Métodos ${route.methods.join(', ')}. No se encontraron llamadas típicas de auth (getServerSession, auth(), currentUser, verify…). Revisá si debe ser público.`,
        file: route.file,
        line: null,
        snippet: null,
      })
    }
    for (const action of usage.next.serverActionFiles) {
      if (action.hasAuthCheck) continue
      findings.push({
        id: 'server-action-no-auth',
        severity: 'info',
        title: 'Server Actions sin verificación de autenticación aparente',
        description: 'Las Server Actions son endpoints públicos (POST). Validá sesión y entrada en cada una.',
        file: action.file,
        line: null,
        snippet: null,
      })
    }
  }

  // Ordenar y puntuar
  findings.sort((a, b) => SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity) || a.file.localeCompare(b.file))
  const counts = Object.fromEntries(SEVERITIES.map((s) => [s, findings.filter((f) => f.severity === s).length]))
  const penalty = SEVERITIES.reduce((acc, s) => acc + Math.min(counts[s] * SEVERITY_WEIGHT[s], s === 'low' ? 10 : 60), 0)
  const score = Math.max(0, 100 - penalty)
  return {
    findings,
    counts,
    score,
    grade: score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 40 ? 'D' : 'F',
  }
}

function scanSecrets(f, findings, { skipGeneric }) {
  for (const p of SECRET_PATTERNS) {
    p.re.lastIndex = 0
    let m
    let n = 0
    while ((m = p.re.exec(f.content)) && n < 5) {
      // Claves de ejemplo documentadas (ej. AKIAIOSFODNN7EXAMPLE)
      if (/EXAMPLE|example|x{6,}|X{6,}/.test(m[0])) continue
      n++
      // Evitamos marcar ejemplos obvios dentro de la propia regla de conexión (user:password@localhost)
      if (p.id === 'db-url' && /:\/\/(user|username|USER|postgres|root)?:(password|pass|PASSWORD|\$\{)/.test(m[0])) continue
      findings.push({
        id: `secret-${p.id}`,
        severity: p.severity,
        title: `Secreto hardcodeado: ${p.title}`,
        description: `Se encontró un valor con formato de ${p.title} (${redact(m[0])}). Revocalo/rotalo y movelo a variables de entorno.`,
        file: f.path,
        line: lineOf(f.content, m.index),
        snippet: snippetAt(f.content, m.index).replace(m[0], redact(m[0])),
      })
    }
  }
  if (skipGeneric) return
  GENERIC_SECRET_RE.lastIndex = 0
  let m
  let n = 0
  while ((m = GENERIC_SECRET_RE.exec(f.content)) && n < 5) {
    const value = m[2]
    if (PLACEHOLDER_RE.test(value) || /^[A-Z_]+$/.test(value) || /^(\/|\.|https?:)/.test(value) || !/\d|[A-Z].*[a-z]|[a-z].*[A-Z]/.test(value)) continue
    // Nombres de campos de formularios (ej. type="password") no son secretos
    if (/^(type|name|id|label|placeholder|autocomplete)$/i.test(m[1])) continue
    n++
    findings.push({
      id: 'secret-generic',
      severity: 'medium',
      title: `Posible credencial hardcodeada (${m[1]})`,
      description: `Se asigna un literal a "${m[1]}". Si es un secreto real, movelo a variables de entorno.`,
      file: f.path,
      line: lineOf(f.content, m.index),
      snippet: snippetAt(f.content, m.index).replace(value, redact(value)),
    })
  }
}
