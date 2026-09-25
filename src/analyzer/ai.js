// Detección de uso de Inteligencia Artificial por firmas (paquetes, endpoints, modelos, APIs).
import { isCodeFile, basename, lineOf, snippetAt } from './files.js'
import { AI_CODE_PATTERNS } from './data/ai.js'

const MAX_EVIDENCE_PER_PATTERN_PER_FILE = 3

export function analyzeAI(files, deps) {
  const aiLibs = deps.libraries.filter((l) => l.isAI)
  const evidences = []

  for (const f of files) {
    const isEnv = /^\.env/.test(basename(f.path))
    if (!isCodeFile(f.path) && !isEnv) continue
    for (const pattern of AI_CODE_PATTERNS) {
      pattern.re.lastIndex = 0
      let m
      let n = 0
      while ((m = pattern.re.exec(f.content)) && n < MAX_EVIDENCE_PER_PATTERN_PER_FILE) {
        n++
        evidences.push({
          file: f.path,
          line: lineOf(f.content, m.index),
          provider: pattern.provider,
          what: pattern.what,
          match: m[0].replace(/['"`]/g, ''),
          // No mostramos el valor de variables en .env para no filtrar claves
          snippet: isEnv ? m[0] + '=…' : snippetAt(f.content, m.index),
        })
      }
    }
  }

  // Proveedores detectados (paquetes + evidencias de código)
  const providers = new Map()
  const touch = (name) => {
    if (!providers.has(name)) providers.set(name, { name, packages: new Set(), files: new Set(), evidenceCount: 0 })
    return providers.get(name)
  }
  for (const lib of aiLibs) {
    const p = touch(lib.aiProvider)
    p.packages.add(lib.name)
    lib.files.forEach((file) => p.files.add(file))
  }
  for (const ev of evidences) {
    if (!ev.provider) continue
    const p = touch(ev.provider)
    p.files.add(ev.file)
    p.evidenceCount++
  }

  // Heurística de confianza
  const strongEvidence = evidences.filter((e) => e.provider && !/^Nombre de modelo/.test(e.what))
  const usedAILibs = aiLibs.filter((l) => l.importCount > 0)
  let level = 'none'
  if (usedAILibs.length > 0 || strongEvidence.length > 0) level = 'high'
  else if (aiLibs.length > 0 || evidences.length > 0) level = 'low'

  const aiFiles = new Set([...evidences.map((e) => e.file), ...aiLibs.flatMap((l) => l.files)])
  const clientSideAI = aiLibs.filter((l) => l.clientFiles.length > 0 && !['ML local', 'UI de IA'].some((k) => l.description.includes(k)))

  return {
    usesAI: level !== 'none',
    confidence: level,
    summary:
      level === 'high'
        ? 'El proyecto usa Inteligencia Artificial.'
        : level === 'low'
          ? 'Hay indicios débiles de IA (paquetes declarados sin uso o menciones sueltas).'
          : 'No se detectó uso de Inteligencia Artificial.',
    libraries: aiLibs.map((l) => ({
      name: l.name,
      provider: l.aiProvider,
      kind: l.description,
      version: l.version,
      importCount: l.importCount,
      files: l.files,
      clientFiles: l.clientFiles,
    })),
    providers: [...providers.values()]
      .map((p) => ({ ...p, packages: [...p.packages], files: [...p.files].sort() }))
      .sort((a, b) => b.files.length - a.files.length),
    evidences,
    files: [...aiFiles].sort(),
    clientSideAI: clientSideAI.map((l) => ({ name: l.name, files: l.clientFiles })),
  }
}
