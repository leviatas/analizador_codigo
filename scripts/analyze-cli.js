#!/usr/bin/env node
// Uso: npm run analyze -- <carpeta> [--json] [--scope @miorg]
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, basename, resolve } from 'node:path'
import { analyzeProject } from '../src/analyzer/index.js'
import { toMarkdown } from '../src/analyzer/report.js'
import { IGNORED_DIRS, shouldReadFile } from '../src/analyzer/files.js'

export function loadFromDisk(root) {
  const files = []
  let skipped = 0
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name)) walk(full)
        continue
      }
      const rel = relative(root, full).split('\\').join('/')
      const size = statSync(full).size
      if (!shouldReadFile(rel, size)) {
        skipped++
        continue
      }
      files.push({ path: rel, content: readFileSync(full, 'utf8') })
    }
  }
  walk(root)
  return { files, skipped }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2)
  const dir = args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--scope')
  if (!dir) {
    console.error('Uso: npm run analyze -- <carpeta-del-proyecto> [--json] [--scope @miorg]')
    process.exit(1)
  }
  const root = resolve(dir)
  const scopeIdx = args.indexOf('--scope')
  const ownScopes = scopeIdx >= 0 ? args[scopeIdx + 1].split(',') : []
  const { files, skipped } = loadFromDisk(root)
  const report = analyzeProject(files, { projectName: basename(root), skipped, ownScopes })
  console.log(args.includes('--json') ? JSON.stringify(report, null, 2) : toMarkdown(report))
}
