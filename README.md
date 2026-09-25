# Analizador de Código (React / Next.js)

Aplicación **React + Vite** que analiza un proyecto React o Next.js a partir de una carpeta local y genera un reporte de:

- **Librerías**: dependencias declaradas (prod/dev/peer), versión instalada (desde el lockfile o estimada del rango), categoría, cantidad de imports y archivos donde se usan, si son **propias o ajenas**, cuáles están posiblemente sin uso, cuáles se importan sin declararse y qué código interno es el más reutilizado.
- **Inteligencia Artificial**: si el proyecto usa IA y con qué proveedores (OpenAI, Anthropic, Gemini, Vercel AI SDK, LangChain, Mistral, Groq, Ollama, bases vectoriales, ML local, etc.), con evidencias archivo:línea.
- **Seguridad**: secretos hardcodeados, `.env` no ignorados por git, variables `NEXT_PUBLIC_*` sensibles, XSS (`dangerouslySetInnerHTML`, `innerHTML`), `eval`, inyección SQL / de comandos, path traversal, open redirect, SSRF, CORS abierto, JWT inseguros, TLS deshabilitado, SDKs de IA en componentes cliente, configuración riesgosa de `next.config`, endpoints y Server Actions sin verificación de auth aparente, y **CVEs conocidos** en dependencias directas y transitivas. Incluye un puntaje (0–100) y nota.
- **Uso general**: tipo de proyecto, App Router / Pages Router, rutas, endpoints y métodos, middleware, componentes cliente/servidor, hooks (nativos y propios), contextos, data fetching, estilos, variables de entorno, TypeScript, tests, configuraciones, archivos más grandes, TODOs.

**No usa IA para analizar**: todo es análisis estático con reglas, expresiones regulares y una base de conocimiento offline. El código **nunca sale del navegador**.

## Uso

```bash
npm install
npm run dev        # abre http://localhost:5173
```

1. Hacé clic en **Seleccionar carpeta** (o arrastrá la carpeta del proyecto).
2. Opcional: indicá *scopes propios* (ej. `@miempresa`) para que esos paquetes cuenten como librerías propias.
3. Navegá el reporte por pestañas y exportalo en **Markdown** o **JSON**.

Se ignoran `node_modules`, `.next`, `.git`, `dist`, `build`, `coverage` y similares. En Chrome/Edge se usa la File System Access API (no lista `node_modules`); en otros navegadores, `<input webkitdirectory>`.

### Línea de comandos

```bash
npm run analyze -- ../mi-proyecto            # reporte en Markdown
npm run analyze -- ../mi-proyecto --json     # reporte en JSON
npm run analyze -- ../mi-proyecto --scope @miorg
```

## Cómo decide "propia" vs "ajena"

Una librería es **propia** si: se declara con `workspace:`/`link:`/`file:`, es un paquete del mismo monorepo, o pertenece al mismo scope npm que el proyecto (ej. `@acme/ui` en `@acme/web`) o a un scope indicado por el usuario. Las instaladas desde git/URL se marcan como ajenas con aviso para revisar.

## Limitaciones

- El análisis es heurístico: puede haber falsos positivos/negativos.
- La base de vulnerabilidades (`src/analyzer/data/vulnerabilities.js`) es **offline y acotada** a los casos más notorios; complementala con `npm audit` u OSV.
- Se leen archivos de hasta 1 MB y se omiten los `.min.js`.

## Estructura

```
src/analyzer/          # motor de análisis (JS puro, corre en navegador y Node)
  dependencies.js      # librerías, propias/ajenas, versiones, CVEs
  ai.js                # detección de IA
  security.js          # reglas de seguridad
  usage.js             # uso general / estructura Next.js
  lockfile.js          # npm / pnpm / yarn lockfiles
  data/                # bases de conocimiento (librerías, IA, CVEs)
src/components/        # UI del reporte
src/lib/               # lectura de carpeta + Web Worker
scripts/analyze-cli.js # versión CLI
tests/                 # tests (vitest) + proyecto Next.js de ejemplo
```

```bash
npm test
```
