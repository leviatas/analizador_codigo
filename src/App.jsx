import { useRef, useState } from 'react'
import {
  download,
  loadFromDataTransfer,
  loadFromDirectoryHandle,
  loadFromFileList,
  runAnalysis,
  supportsDirectoryPicker,
} from './lib/loadProject.js'
import { toMarkdown } from './analyzer/report.js'
import { BROWSER_ADVISORIES_PATH, runOnlineCheck } from './analyzer/online.js'
import Report from './components/Report.jsx'

export default function App() {
  const [status, setStatus] = useState('idle') // idle | reading | analyzing | checking | done | error
  const [progress, setProgress] = useState({ count: 0, path: '' })
  const [report, setReport] = useState(null)
  const [error, setError] = useState(null)
  const [scopes, setScopes] = useState('')
  const [dragging, setDragging] = useState(false)
  const [online, setOnline] = useState(true)
  const inputRef = useRef(null)

  const onProgress = (count, path) => {
    if (count % 25 === 0) setProgress({ count, path })
  }

  async function analyze(loader) {
    setError(null)
    setStatus('reading')
    setProgress({ count: 0, path: '' })
    try {
      const { name, files, skipped } = await loader()
      if (!files.length) throw new Error('La carpeta no contiene archivos de código legibles.')
      setStatus('analyzing')
      const ownScopes = scopes.split(/[\s,]+/).filter(Boolean)
      const options = { projectName: name, skipped, ownScopes }
      let result = await runAnalysis(files, options)
      if (online) {
        // Se envían sólo nombres y versiones de paquetes al servicio de vulnerabilidades
        setStatus('checking')
        const check = await runOnlineCheck(result.dependencies.libraries, { endpoint: BROWSER_ADVISORIES_PATH })
        result = await runAnalysis(files, { ...options, ...check })
      }
      setReport(result)
      setStatus('done')
    } catch (err) {
      if (err?.name === 'AbortError') {
        setStatus(report ? 'done' : 'idle')
        return
      }
      setError(err.message ?? String(err))
      setStatus('error')
    }
  }

  async function pickFolder() {
    if (supportsDirectoryPicker) {
      await analyze(async () => loadFromDirectoryHandle(await window.showDirectoryPicker({ mode: 'read' }), onProgress))
    } else {
      inputRef.current?.click()
    }
  }

  function onDrop(e) {
    e.preventDefault()
    setDragging(false)
    const items = e.dataTransfer.items
    analyze(() => loadFromDataTransfer(items, onProgress))
  }

  const reset = () => {
    setReport(null)
    setStatus('idle')
  }

  const busy = ['reading', 'analyzing', 'checking'].includes(status)

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand" onClick={reset} role="button" tabIndex={0}>
          <img src="/icon.svg" alt="" width="28" height="28" />
          <div>
            <strong>Analizador de Código</strong>
            <span>React · Next.js · análisis estático, sin IA</span>
          </div>
        </div>
        {report && status === 'done' && (
          <div className="actions">
            <button className="btn ghost" onClick={() => download(`${slug(report.meta.name)}-analisis.md`, toMarkdown(report), 'text/markdown')}>
              Exportar Markdown
            </button>
            <button className="btn ghost" onClick={() => download(`${slug(report.meta.name)}-analisis.json`, JSON.stringify(report, null, 2), 'application/json')}>
              Exportar JSON
            </button>
            <button className="btn" onClick={pickFolder}>Analizar otra carpeta</button>
          </div>
        )}
      </header>

      <input
        ref={inputRef}
        type="file"
        webkitdirectory=""
        directory=""
        multiple
        hidden
        onChange={(e) => {
          const list = e.target.files
          if (list?.length) analyze(() => loadFromFileList(list, onProgress))
          e.target.value = ''
        }}
      />

      {status === 'done' && report ? (
        <Report report={report} />
      ) : (
        <main className="landing">
          <div
            className={`dropzone ${dragging ? 'dragging' : ''} ${busy ? 'busy' : ''}`}
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            {busy ? (
              <div className="loading">
                <div className="spinner" />
                <strong>
                  {status === 'reading' ? 'Leyendo archivos…' : status === 'checking' ? 'Consultando vulnerabilidades en la GitHub Advisory Database…' : 'Analizando…'}
                </strong>
                {status === 'reading' && (
                  <span className="muted mono">
                    {progress.count} archivos · {progress.path}
                  </span>
                )}
              </div>
            ) : (
              <>
                <div className="drop-icon" aria-hidden>
                  <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <path d="M12 11v5M9.5 13.5 12 11l2.5 2.5" />
                  </svg>
                </div>
                <h1>Seleccioná la carpeta de tu proyecto</h1>
                <p className="muted">Proyectos React o Next.js. También podés arrastrar la carpeta acá.</p>
                <button className="btn big" onClick={pickFolder}>Seleccionar carpeta</button>
                <label className="scopes">
                  <span>Scopes propios (opcional)</span>
                  <input
                    value={scopes}
                    onChange={(e) => setScopes(e.target.value)}
                    placeholder="@miempresa, @mi-org"
                  />
                  <small className="muted">Los paquetes de estos scopes se cuentan como librerías propias.</small>
                </label>
                <label className="check">
                  <input type="checkbox" checked={online} onChange={(e) => setOnline(e.target.checked)} />
                  <span>
                    Consultar vulnerabilidades online (GitHub Advisory Database)
                    <small className="muted">Sólo se envían nombres y versiones de las librerías, nunca tu código.</small>
                  </span>
                </label>
              </>
            )}
          </div>

          {error && <div className="alert bad">{error}</div>}

          <section className="features">
            <Feature title="Librerías" text="Qué usa, versiones, si son propias o de terceros, cuáles no se usan y cuáles faltan declarar." />
            <Feature title="Inteligencia Artificial" text="Detecta SDKs (OpenAI, Anthropic, Gemini, Vercel AI…), llamadas a APIs y nombres de modelos." />
            <Feature title="Seguridad" text="Secretos expuestos, .env sin ignorar, XSS, inyecciones, configuración de Next.js y vulnerabilidades de cada librería consultadas online." />
            <Feature title="Uso general" text="Rutas, endpoints, componentes cliente/servidor, hooks, estilos, TypeScript y métricas." />
          </section>
          <p className="privacy muted">
            El análisis corre en tu navegador: el código nunca sale de tu máquina (la consulta online sólo envía nombres y versiones de librerías). Se ignoran <code>node_modules</code>, <code>.next</code>, <code>.git</code> y carpetas de build.
          </p>
        </main>
      )}
    </div>
  )
}

function Feature({ title, text }) {
  return (
    <div className="feature">
      <strong>{title}</strong>
      <p className="muted">{text}</p>
    </div>
  )
}

function slug(s) {
  return String(s).replace(/[^\w-]+/g, '-').replace(/^-|-$/g, '') || 'proyecto'
}
