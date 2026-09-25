import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// La API de vulnerabilidades de npm no permite llamadas directas desde el navegador (CORS),
// así que el servidor de Vite hace de intermediario. Sólo viajan nombres y versiones de paquetes.
const advisoriesProxy = {
  '/api/npm-advisories': {
    target: 'https://registry.npmjs.org',
    changeOrigin: true,
    rewrite: () => '/-/npm/v1/security/advisories/bulk',
  },
}

export default defineConfig({
  plugins: [react()],
  worker: { format: 'es' },
  server: { proxy: advisoriesProxy },
  preview: { proxy: advisoriesProxy },
  test: { include: ['tests/**/*.test.js'] },
})
