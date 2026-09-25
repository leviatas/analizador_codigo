// Corre el análisis fuera del hilo principal para no congelar la UI.
import { analyzeProject } from '../analyzer/index.js'

self.onmessage = (e) => {
  const { files, options } = e.data
  try {
    self.postMessage({ ok: true, report: analyzeProject(files, options) })
  } catch (err) {
    self.postMessage({ ok: false, error: err?.message ?? String(err) })
  }
}
