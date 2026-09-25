import { describe, it, expect } from 'vitest'
import { fileURLToPath } from 'node:url'
import { analyzeProject } from '../src/analyzer/index.js'
import { extractImports, classifySpecifier, packageNameOf } from '../src/analyzer/imports.js'
import { findVulnerabilities, originOf } from '../src/analyzer/dependencies.js'
import { isGitIgnored } from '../src/analyzer/security.js'
import { appRouteFromPath } from '../src/analyzer/usage.js'
import { parseLockfiles } from '../src/analyzer/lockfile.js'
import { stripComments } from '../src/analyzer/files.js'
import { loadFromDisk } from '../scripts/analyze-cli.js'

const fixture = fileURLToPath(new URL('./fixtures/next-app', import.meta.url))
const { files } = loadFromDisk(fixture)
const report = analyzeProject(files)
const lib = (name) => report.dependencies.libraries.find((l) => l.name === name)
const findingIds = report.security.findings.map((f) => f.id)

describe('imports', () => {
  it('extrae import, require, import dinámico y export from', () => {
    const src = `import a from 'a'\nimport { b as c } from "@s/b/sub"\nimport 'side'\nconst d = require('d')\nconst e = await import('e')\nexport * from './f'\n// import x from 'comentado'`
    expect(extractImports(src).map((i) => i.specifier).sort()).toEqual(['./f', '@s/b/sub', 'a', 'd', 'e', 'side'])
  })
  it('clasifica especificadores', () => {
    expect(classifySpecifier('./x')).toBe('relative')
    expect(classifySpecifier('@/lib/x')).toBe('alias')
    expect(classifySpecifier('~lib/x', ['~lib'])).toBe('alias')
    expect(classifySpecifier('node:fs')).toBe('builtin')
    expect(classifySpecifier('fs/promises')).toBe('builtin')
    expect(classifySpecifier('next/link')).toBe('package')
    expect(packageNameOf('next/link')).toBe('next')
    expect(packageNameOf('@radix-ui/react-dialog')).toBe('@radix-ui/react-dialog')
  })
  it('stripComments conserva strings con //', () => {
    expect(stripComments(`const u = "http://x" // c`)).toBe(`const u = "http://x" `)
  })
})

describe('dependencias', () => {
  it('clasifica propias vs ajenas', () => {
    expect(lib('@acme/ui').ownership).toBe('propia')
    expect(lib('@acme/utils').ownership).toBe('propia')
    expect(lib('axios').ownership).toBe('ajena')
    expect(originOf('github:acme/x')).toBe('git')
    expect(originOf('workspace:*')).toBe('workspace')
    expect(originOf('file:../x')).toBe('local')
  })
  it('usa la versión del lockfile', () => {
    expect(lib('axios').version).toBe('1.6.2')
    expect(lib('axios').versionSource).toBe('lockfile')
  })
  it('detecta vulnerabilidades conocidas', () => {
    expect(lib('next').vulnerabilities.map((v) => v.id)).toContain('CVE-2025-29927')
    expect(lib('lodash').vulnerabilities.length).toBeGreaterThan(0)
    expect(findVulnerabilities('next', '15.5.7').some((v) => v.id.includes('55182'))).toBe(false)
    expect(findVulnerabilities('react-server-dom-webpack', '19.2.0').length).toBe(1)
    expect(report.dependencies.transitiveVulnerabilities.map((v) => v.name)).toContain('minimist')
  })
  it('detecta imports no declarados y posibles no usadas', () => {
    expect(report.dependencies.undeclared.map((u) => u.name)).toEqual(['dayjs'])
    expect(lib('left-pad').possiblyUnused).toBe(true)
    expect(lib('react-dom').possiblyUnused).toBe(false)
  })
  it('parsea pnpm y yarn lock', () => {
    const pnpm = parseLockfiles([{ path: 'pnpm-lock.yaml', content: `lockfileVersion: '9.0'\nimporters:\n  .:\n    dependencies:\n      next:\n        specifier: ^14.0.0\n        version: 14.1.0(react@18.2.0)\npackages:\n  next@14.1.0:\n    resolution: {}\n  '@babel/core@7.0.0':\n    resolution: {}\n` }])
    expect(pnpm.direct.get('next')).toBe('14.1.0')
    expect([...pnpm.packages.get('@babel/core')]).toEqual(['7.0.0'])
    const yarn = parseLockfiles([{ path: 'yarn.lock', content: `# yarn\n\n"axios@^1.0.0", axios@^1.1.0:\n  version "1.2.0"\n  resolved "x"\n` }])
    expect(yarn.byRange.get('axios@^1.0.0')).toBe('1.2.0')
  })
})

describe('IA', () => {
  it('detecta uso de IA y proveedores', () => {
    expect(report.ai.usesAI).toBe(true)
    expect(report.ai.confidence).toBe('high')
    expect(report.ai.providers.map((p) => p.name)).toEqual(expect.arrayContaining(['OpenAI', 'Vercel AI SDK']))
    expect(report.ai.clientSideAI.map((c) => c.name)).toContain('openai')
  })
  it('no detecta IA en un proyecto sin IA', () => {
    const r = analyzeProject([
      { path: 'package.json', content: JSON.stringify({ dependencies: { react: '^19.0.0' } }) },
      { path: 'src/App.jsx', content: `import { useState } from 'react'\nexport function App() { return <div /> }` },
    ])
    expect(r.ai.usesAI).toBe(false)
    expect(r.usage.projectType).toBe('React')
  })
})

describe('seguridad', () => {
  it('detecta patrones inseguros', () => {
    for (const id of ['eval', 'command-injection', 'dangerously-set-inner-html', 'token-localstorage', 'browser-ai-key', 'env-not-ignored', 'public-env-secret', 'secret-generic', 'next-image-wildcard', 'middleware-bypass-exposed', 'unpinned-source', 'api-no-auth']) {
      expect(findingIds, id).toContain(id)
    }
  })
  it('respeta .gitignore', () => {
    const gi = [{ path: '.gitignore', content: '.env*.local\n/secret\n!keep.env.local' }]
    expect(isGitIgnored('.env.local', gi)).toBe(true)
    expect(isGitIgnored('apps/web/.env.production.local', gi)).toBe(true)
    expect(isGitIgnored('.env', gi)).toBe(false)
    expect(isGitIgnored('keep.env.local', gi)).toBe(false)
    expect(isGitIgnored('secret', gi)).toBe(true)
  })
  it('detecta secretos hardcodeados y los oculta', () => {
    const key = 'AKIA' + 'Z7QW3RT5YU8IO2PL'
    const r = analyzeProject([{ path: 'src/aws.js', content: `const k = "${key}"` }])
    const f = r.security.findings.find((x) => x.id === 'secret-aws-access-key')
    expect(f).toBeTruthy()
    expect(f.snippet).not.toContain(key)
  })
})

describe('uso', () => {
  it('reconoce rutas del App Router', () => {
    expect(appRouteFromPath('(auth)/login/page.tsx')).toBe('/login')
    expect(report.usage.next.router).toBe('App Router')
    expect(report.usage.next.pages.map((p) => p.route)).toEqual(['/', '/blog/[slug]', '/login'])
    expect(report.usage.next.apiRoutes[0]).toMatchObject({ route: '/api/chat', methods: ['GET', 'POST'] })
    expect(report.usage.next.middleware).toBe('src/middleware.ts')
    expect(report.usage.styling).toContain('Tailwind CSS')
    expect(report.usage.customHooks.map((h) => h.name)).toEqual(expect.arrayContaining(['useChatStore', 'useFormat']))
  })
})

describe('falsos positivos', () => {
  it('ignora patrones dentro de strings y comentarios', () => {
    const r = analyzeProject([{ path: 'src/x.js', content: `const t = 'Uso de eval()'\n// new Function()\nconst k = "AKIAIOSFODNN7EXAMPLE"` }])
    expect(r.security.findings.filter((f) => ['eval', 'new-function'].includes(f.id) || f.id.startsWith('secret-'))).toEqual([])
  })
  it('el tipo de proyecto sale del package.json raíz', () => {
    const r = analyzeProject([
      { path: 'package.json', content: JSON.stringify({ dependencies: { react: '^19.0.0' }, devDependencies: { vite: '^8.0.0' } }) },
      { path: 'examples/app/package.json', content: JSON.stringify({ dependencies: { next: '15.0.0' } }) },
    ])
    expect(r.usage.projectType).toBe('React + Vite')
  })
})
