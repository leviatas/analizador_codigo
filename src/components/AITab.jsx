import { useState } from 'react'
import { Badge, Card, Empty, FileList } from './ui.jsx'

export default function AITab({ ai }) {
  const [showAll, setShowAll] = useState(false)
  const evidences = showAll ? ai.evidences : ai.evidences.slice(0, 30)
  const tone = ai.confidence === 'high' ? 'info' : ai.confidence === 'low' ? 'warn' : 'good'

  return (
    <div className="stack">
      <div className={`verdict ${tone}`}>
        <div className="verdict-big">{ai.usesAI ? (ai.confidence === 'high' ? 'Sí usa IA' : 'Posible uso de IA') : 'No usa IA'}</div>
        <p>{ai.summary}</p>
        <p className="muted small">
          Detección por firmas: paquetes conocidos, endpoints de APIs, nombres de modelos, variables de entorno y funciones típicas. No se usa ninguna IA para analizar.
        </p>
      </div>

      {ai.clientSideAI.length > 0 && (
        <div className="alert bad">
          <strong>Atención:</strong> se importa un SDK de IA desde componentes cliente ({ai.clientSideAI.map((c) => c.name).join(', ')}). Esto suele exponer la API key al navegador.
        </div>
      )}

      {ai.providers.length > 0 && (
        <div className="grid-3">
          {ai.providers.map((p) => (
            <Card key={p.name} title={p.name} subtitle={`${p.files.length} archivo(s) · ${p.evidenceCount} evidencia(s) en código`}>
              {p.packages.length > 0 && (
                <p>
                  {p.packages.map((pkg) => (
                    <Badge key={pkg} tone="info">{pkg}</Badge>
                  ))}
                </p>
              )}
              <FileList files={p.files} limit={4} />
            </Card>
          ))}
        </div>
      )}

      <Card title="Librerías de IA declaradas">
        {ai.libraries.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Paquete</th>
                  <th>Proveedor</th>
                  <th>Tipo</th>
                  <th>Versión</th>
                  <th className="num">Imports</th>
                </tr>
              </thead>
              <tbody>
                {ai.libraries.map((l) => (
                  <tr key={l.name}>
                    <td className="mono">{l.name}</td>
                    <td>{l.provider}</td>
                    <td className="muted">{l.kind.split(' — ')[0]}</td>
                    <td className="mono">{l.version ?? '—'}</td>
                    <td className="num">
                      {l.importCount}
                      {l.importCount === 0 && <Badge tone="low">sin uso</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>No hay paquetes de IA en package.json.</Empty>
        )}
      </Card>

      <Card title="Evidencias en el código" subtitle={`${ai.evidences.length} coincidencia(s)`}>
        {ai.evidences.length ? (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Archivo</th>
                    <th>Qué se encontró</th>
                    <th>Código</th>
                  </tr>
                </thead>
                <tbody>
                  {evidences.map((e, i) => (
                    <tr key={i}>
                      <td className="mono small">{e.file}:{e.line}</td>
                      <td>
                        {e.what}
                        {e.provider && <div className="muted small">{e.provider}</div>}
                      </td>
                      <td><code className="snippet">{e.snippet}</code></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {ai.evidences.length > 30 && (
              <button className="link" onClick={() => setShowAll(!showAll)}>
                {showAll ? 'Ver menos' : `Ver las ${ai.evidences.length}`}
              </button>
            )}
          </>
        ) : (
          <Empty>Sin evidencias de IA en el código.</Empty>
        )}
      </Card>
    </div>
  )
}
