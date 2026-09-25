// Base de conocimiento offline: categoría y descripción de librerías conocidas.
// Clave: nombre exacto del paquete, o prefijo terminado en '*' (ej. '@radix-ui/*').

export const CATEGORIES = {
  framework: 'Framework',
  ui: 'Componentes UI',
  styling: 'Estilos',
  state: 'Manejo de estado',
  data: 'Data fetching / API',
  forms: 'Formularios y validación',
  auth: 'Autenticación',
  database: 'Base de datos / ORM',
  ai: 'Inteligencia Artificial',
  testing: 'Testing',
  tooling: 'Tooling / Build',
  lint: 'Lint / Formato',
  types: 'Tipos (TypeScript)',
  utils: 'Utilidades',
  dates: 'Fechas',
  charts: 'Gráficos',
  animation: 'Animación',
  i18n: 'Internacionalización',
  icons: 'Íconos',
  payments: 'Pagos',
  monitoring: 'Monitoreo / Analytics',
  cms: 'CMS / Contenido',
  realtime: 'Tiempo real',
  security: 'Seguridad',
  other: 'Otra',
}

export const LIBRARIES = {
  // Framework
  next: { category: 'framework', description: 'Framework React full-stack (SSR/SSG, rutas, API).' },
  react: { category: 'framework', description: 'Librería de UI.' },
  'react-dom': { category: 'framework', description: 'Renderizado de React en el DOM.' },
  'react-router': { category: 'framework', description: 'Ruteo del lado del cliente.' },
  'react-router-dom': { category: 'framework', description: 'Ruteo del lado del cliente.' },
  '@remix-run/*': { category: 'framework', description: 'Framework Remix.' },
  gatsby: { category: 'framework', description: 'Generador de sitios estáticos con React.' },
  express: { category: 'framework', description: 'Servidor HTTP para Node.' },
  fastify: { category: 'framework', description: 'Servidor HTTP para Node.' },
  hono: { category: 'framework', description: 'Framework web ligero.' },
  '@trpc/*': { category: 'data', description: 'APIs tipadas end-to-end.' },

  // UI
  '@mui/*': { category: 'ui', description: 'Material UI.' },
  '@material-ui/*': { category: 'ui', description: 'Material UI (versión legacy).' },
  '@chakra-ui/*': { category: 'ui', description: 'Chakra UI.' },
  '@radix-ui/*': { category: 'ui', description: 'Primitivas UI accesibles (base de shadcn/ui).' },
  '@headlessui/*': { category: 'ui', description: 'Componentes sin estilos de Tailwind Labs.' },
  antd: { category: 'ui', description: 'Ant Design.' },
  '@mantine/*': { category: 'ui', description: 'Mantine UI.' },
  'react-bootstrap': { category: 'ui', description: 'Bootstrap para React.' },
  '@nextui-org/*': { category: 'ui', description: 'NextUI.' },
  '@heroui/*': { category: 'ui', description: 'HeroUI (ex NextUI).' },
  'cmdk': { category: 'ui', description: 'Command menu.' },
  'sonner': { category: 'ui', description: 'Toasts.' },
  'react-hot-toast': { category: 'ui', description: 'Toasts.' },
  'react-toastify': { category: 'ui', description: 'Toasts.' },
  vaul: { category: 'ui', description: 'Drawer.' },
  'embla-carousel-react': { category: 'ui', description: 'Carrusel.' },
  swiper: { category: 'ui', description: 'Carrusel/slider.' },
  '@tanstack/react-table': { category: 'ui', description: 'Tablas headless.' },
  'react-day-picker': { category: 'ui', description: 'Selector de fechas.' },
  'next-themes': { category: 'ui', description: 'Tema claro/oscuro para Next.' },

  // Estilos
  tailwindcss: { category: 'styling', description: 'CSS utilitario.' },
  '@tailwindcss/*': { category: 'styling', description: 'Plugins de Tailwind.' },
  'tailwind-merge': { category: 'styling', description: 'Merge de clases Tailwind.' },
  'tailwindcss-animate': { category: 'styling', description: 'Animaciones para Tailwind.' },
  clsx: { category: 'styling', description: 'Composición de classNames.' },
  classnames: { category: 'styling', description: 'Composición de classNames.' },
  'class-variance-authority': { category: 'styling', description: 'Variantes de componentes (shadcn/ui).' },
  'styled-components': { category: 'styling', description: 'CSS-in-JS.' },
  '@emotion/*': { category: 'styling', description: 'CSS-in-JS.' },
  sass: { category: 'styling', description: 'Preprocesador SCSS.' },
  postcss: { category: 'styling', description: 'Procesador CSS.' },
  autoprefixer: { category: 'styling', description: 'Prefijos CSS.' },
  '@vanilla-extract/*': { category: 'styling', description: 'CSS tipado.' },
  '@stitches/*': { category: 'styling', description: 'CSS-in-JS.' },

  // Estado
  redux: { category: 'state', description: 'Estado global.' },
  '@reduxjs/toolkit': { category: 'state', description: 'Redux Toolkit.' },
  'react-redux': { category: 'state', description: 'Bindings de Redux.' },
  zustand: { category: 'state', description: 'Estado global liviano.' },
  jotai: { category: 'state', description: 'Estado atómico.' },
  recoil: { category: 'state', description: 'Estado atómico (Meta).' },
  mobx: { category: 'state', description: 'Estado reactivo.' },
  'mobx-react-lite': { category: 'state', description: 'Bindings de MobX.' },
  valtio: { category: 'state', description: 'Estado con proxies.' },
  xstate: { category: 'state', description: 'Máquinas de estado.' },
  immer: { category: 'state', description: 'Estado inmutable.' },

  // Data
  axios: { category: 'data', description: 'Cliente HTTP.' },
  swr: { category: 'data', description: 'Data fetching con caché (Vercel).' },
  '@tanstack/react-query': { category: 'data', description: 'Data fetching con caché.' },
  'react-query': { category: 'data', description: 'Data fetching con caché (legacy).' },
  '@apollo/client': { category: 'data', description: 'Cliente GraphQL.' },
  graphql: { category: 'data', description: 'GraphQL.' },
  'graphql-request': { category: 'data', description: 'Cliente GraphQL mínimo.' },
  urql: { category: 'data', description: 'Cliente GraphQL.' },
  ky: { category: 'data', description: 'Cliente HTTP.' },
  'node-fetch': { category: 'data', description: 'fetch para Node.' },
  'cross-fetch': { category: 'data', description: 'fetch universal.' },

  // Formularios
  'react-hook-form': { category: 'forms', description: 'Formularios.' },
  '@hookform/resolvers': { category: 'forms', description: 'Resolvers de validación.' },
  formik: { category: 'forms', description: 'Formularios.' },
  zod: { category: 'forms', description: 'Validación de esquemas.' },
  yup: { category: 'forms', description: 'Validación de esquemas.' },
  joi: { category: 'forms', description: 'Validación de esquemas.' },
  valibot: { category: 'forms', description: 'Validación de esquemas.' },

  // Auth
  'next-auth': { category: 'auth', description: 'Autenticación para Next.js.' },
  '@auth/*': { category: 'auth', description: 'Auth.js.' },
  '@clerk/*': { category: 'auth', description: 'Clerk (auth como servicio).' },
  '@auth0/*': { category: 'auth', description: 'Auth0.' },
  'firebase': { category: 'database', description: 'Firebase (auth, DB, storage).' },
  'firebase-admin': { category: 'database', description: 'Firebase Admin SDK.' },
  '@supabase/*': { category: 'database', description: 'Supabase (DB, auth, storage).' },
  jsonwebtoken: { category: 'auth', description: 'JWT.' },
  jose: { category: 'auth', description: 'JWT / JOSE.' },
  bcrypt: { category: 'security', description: 'Hash de contraseñas.' },
  bcryptjs: { category: 'security', description: 'Hash de contraseñas.' },
  'lucia': { category: 'auth', description: 'Autenticación.' },
  'better-auth': { category: 'auth', description: 'Autenticación.' },
  'iron-session': { category: 'auth', description: 'Sesiones cifradas.' },

  // DB
  prisma: { category: 'database', description: 'ORM Prisma (CLI).' },
  '@prisma/client': { category: 'database', description: 'ORM Prisma.' },
  'drizzle-orm': { category: 'database', description: 'ORM Drizzle.' },
  'drizzle-kit': { category: 'database', description: 'CLI de Drizzle.' },
  mongoose: { category: 'database', description: 'ODM MongoDB.' },
  mongodb: { category: 'database', description: 'Driver MongoDB.' },
  pg: { category: 'database', description: 'Driver PostgreSQL.' },
  mysql: { category: 'database', description: 'Driver MySQL.' },
  mysql2: { category: 'database', description: 'Driver MySQL.' },
  typeorm: { category: 'database', description: 'ORM.' },
  sequelize: { category: 'database', description: 'ORM.' },
  knex: { category: 'database', description: 'Query builder.' },
  kysely: { category: 'database', description: 'Query builder tipado.' },
  redis: { category: 'database', description: 'Cliente Redis.' },
  ioredis: { category: 'database', description: 'Cliente Redis.' },
  '@upstash/*': { category: 'database', description: 'Upstash (Redis/Kafka serverless).' },
  '@vercel/postgres': { category: 'database', description: 'Postgres de Vercel.' },
  '@vercel/kv': { category: 'database', description: 'KV de Vercel.' },
  '@planetscale/database': { category: 'database', description: 'PlanetScale.' },
  'better-sqlite3': { category: 'database', description: 'SQLite.' },

  // Testing
  jest: { category: 'testing', description: 'Tests unitarios.' },
  vitest: { category: 'testing', description: 'Tests unitarios.' },
  '@testing-library/*': { category: 'testing', description: 'Testing Library.' },
  cypress: { category: 'testing', description: 'Tests E2E.' },
  '@playwright/test': { category: 'testing', description: 'Tests E2E.' },
  playwright: { category: 'testing', description: 'Automatización de navegador.' },
  msw: { category: 'testing', description: 'Mock de APIs.' },
  'jest-environment-jsdom': { category: 'testing', description: 'Entorno DOM para Jest.' },
  jsdom: { category: 'testing', description: 'DOM en Node.' },
  '@storybook/*': { category: 'testing', description: 'Storybook.' },
  storybook: { category: 'testing', description: 'Storybook.' },

  // Tooling
  typescript: { category: 'tooling', description: 'TypeScript.' },
  vite: { category: 'tooling', description: 'Bundler / dev server.' },
  '@vitejs/*': { category: 'tooling', description: 'Plugins de Vite.' },
  webpack: { category: 'tooling', description: 'Bundler.' },
  turbo: { category: 'tooling', description: 'Monorepo (Turborepo).' },
  '@next/*': { category: 'tooling', description: 'Paquetes oficiales de Next.js.' },
  'cross-env': { category: 'tooling', description: 'Variables de entorno multiplataforma.' },
  dotenv: { category: 'tooling', description: 'Carga de .env.' },
  husky: { category: 'tooling', description: 'Git hooks.' },
  'lint-staged': { category: 'tooling', description: 'Lint en archivos staged.' },
  tsx: { category: 'tooling', description: 'Ejecutar TypeScript en Node.' },
  'ts-node': { category: 'tooling', description: 'Ejecutar TypeScript en Node.' },
  '@babel/*': { category: 'tooling', description: 'Babel.' },
  'sharp': { category: 'tooling', description: 'Procesamiento de imágenes.' },
  '@t3-oss/env-nextjs': { category: 'tooling', description: 'Validación de variables de entorno.' },

  // Lint
  eslint: { category: 'lint', description: 'Linter.' },
  'eslint-*': { category: 'lint', description: 'Config/plugin de ESLint.' },
  '@eslint/*': { category: 'lint', description: 'ESLint.' },
  '@typescript-eslint/*': { category: 'lint', description: 'ESLint para TypeScript.' },
  'typescript-eslint': { category: 'lint', description: 'ESLint para TypeScript.' },
  prettier: { category: 'lint', description: 'Formateador.' },
  'prettier-plugin-*': { category: 'lint', description: 'Plugin de Prettier.' },
  '@biomejs/biome': { category: 'lint', description: 'Linter/formateador.' },

  '@types/*': { category: 'types', description: 'Definiciones de tipos.' },

  // Utils
  lodash: { category: 'utils', description: 'Utilidades.' },
  'lodash-es': { category: 'utils', description: 'Utilidades.' },
  ramda: { category: 'utils', description: 'Programación funcional.' },
  uuid: { category: 'utils', description: 'Generación de UUIDs.' },
  nanoid: { category: 'utils', description: 'IDs únicos.' },
  'server-only': { category: 'utils', description: 'Marca módulos como solo-servidor.' },
  'client-only': { category: 'utils', description: 'Marca módulos como solo-cliente.' },
  'use-debounce': { category: 'utils', description: 'Hook de debounce.' },
  'usehooks-ts': { category: 'utils', description: 'Colección de hooks.' },
  'react-use': { category: 'utils', description: 'Colección de hooks.' },
  'qs': { category: 'utils', description: 'Query strings.' },
  'marked': { category: 'cms', description: 'Markdown a HTML.' },
  'react-markdown': { category: 'cms', description: 'Render de Markdown.' },
  'remark-*': { category: 'cms', description: 'Plugin de Markdown.' },
  'rehype-*': { category: 'cms', description: 'Plugin de HTML/Markdown.' },
  'gray-matter': { category: 'cms', description: 'Front-matter.' },
  '@mdx-js/*': { category: 'cms', description: 'MDX.' },
  'contentlayer': { category: 'cms', description: 'Contenido tipado.' },
  '@sanity/*': { category: 'cms', description: 'Sanity CMS.' },
  'next-sanity': { category: 'cms', description: 'Sanity para Next.' },
  contentful: { category: 'cms', description: 'Contentful CMS.' },
  'dompurify': { category: 'security', description: 'Sanitización de HTML.' },
  'isomorphic-dompurify': { category: 'security', description: 'Sanitización de HTML.' },
  'sanitize-html': { category: 'security', description: 'Sanitización de HTML.' },
  helmet: { category: 'security', description: 'Headers de seguridad.' },

  // Fechas
  'date-fns': { category: 'dates', description: 'Fechas.' },
  dayjs: { category: 'dates', description: 'Fechas.' },
  moment: { category: 'dates', description: 'Fechas (en modo mantenimiento).' },
  luxon: { category: 'dates', description: 'Fechas.' },

  // Charts
  recharts: { category: 'charts', description: 'Gráficos.' },
  'chart.js': { category: 'charts', description: 'Gráficos.' },
  'react-chartjs-2': { category: 'charts', description: 'Chart.js para React.' },
  d3: { category: 'charts', description: 'Visualización de datos.' },
  '@nivo/*': { category: 'charts', description: 'Gráficos.' },
  'apexcharts': { category: 'charts', description: 'Gráficos.' },
  'react-apexcharts': { category: 'charts', description: 'Gráficos.' },
  '@tremor/react': { category: 'charts', description: 'Dashboards.' },

  // Animación
  'framer-motion': { category: 'animation', description: 'Animaciones.' },
  motion: { category: 'animation', description: 'Animaciones (Motion).' },
  gsap: { category: 'animation', description: 'Animaciones.' },
  'react-spring': { category: 'animation', description: 'Animaciones.' },
  '@react-spring/*': { category: 'animation', description: 'Animaciones.' },
  three: { category: 'animation', description: '3D.' },
  '@react-three/*': { category: 'animation', description: '3D con React.' },
  lottie: { category: 'animation', description: 'Animaciones Lottie.' },
  'lottie-react': { category: 'animation', description: 'Animaciones Lottie.' },

  // i18n
  'next-intl': { category: 'i18n', description: 'i18n para Next.' },
  'next-i18next': { category: 'i18n', description: 'i18n para Next.' },
  i18next: { category: 'i18n', description: 'i18n.' },
  'react-i18next': { category: 'i18n', description: 'i18n para React.' },
  'react-intl': { category: 'i18n', description: 'i18n (FormatJS).' },

  // Íconos
  'lucide-react': { category: 'icons', description: 'Íconos.' },
  'react-icons': { category: 'icons', description: 'Íconos.' },
  '@heroicons/*': { category: 'icons', description: 'Íconos.' },
  '@fortawesome/*': { category: 'icons', description: 'Font Awesome.' },
  '@tabler/icons-react': { category: 'icons', description: 'Íconos.' },
  '@phosphor-icons/*': { category: 'icons', description: 'Íconos.' },

  // Pagos
  stripe: { category: 'payments', description: 'Stripe (servidor).' },
  '@stripe/*': { category: 'payments', description: 'Stripe (cliente).' },
  mercadopago: { category: 'payments', description: 'Mercado Pago.' },
  '@mercadopago/*': { category: 'payments', description: 'Mercado Pago.' },
  '@paypal/*': { category: 'payments', description: 'PayPal.' },
  '@lemonsqueezy/*': { category: 'payments', description: 'Lemon Squeezy.' },

  // Monitoreo
  '@sentry/*': { category: 'monitoring', description: 'Sentry (errores).' },
  '@vercel/analytics': { category: 'monitoring', description: 'Analytics de Vercel.' },
  '@vercel/speed-insights': { category: 'monitoring', description: 'Métricas de performance.' },
  'posthog-js': { category: 'monitoring', description: 'Analytics de producto.' },
  'posthog-node': { category: 'monitoring', description: 'Analytics de producto.' },
  'mixpanel-browser': { category: 'monitoring', description: 'Analytics.' },
  'react-ga4': { category: 'monitoring', description: 'Google Analytics.' },
  '@next/third-parties': { category: 'monitoring', description: 'Scripts de terceros (GA, GTM).' },
  'pino': { category: 'monitoring', description: 'Logging.' },
  'winston': { category: 'monitoring', description: 'Logging.' },
  '@opentelemetry/*': { category: 'monitoring', description: 'Telemetría.' },

  // Realtime
  'socket.io': { category: 'realtime', description: 'WebSockets (servidor).' },
  'socket.io-client': { category: 'realtime', description: 'WebSockets (cliente).' },
  pusher: { category: 'realtime', description: 'Pusher.' },
  'pusher-js': { category: 'realtime', description: 'Pusher (cliente).' },
  ws: { category: 'realtime', description: 'WebSockets.' },
  'ably': { category: 'realtime', description: 'Ably realtime.' },
  '@liveblocks/*': { category: 'realtime', description: 'Colaboración en tiempo real.' },

  // Otros servicios
  resend: { category: 'other', description: 'Envío de emails.' },
  nodemailer: { category: 'other', description: 'Envío de emails.' },
  '@react-email/*': { category: 'other', description: 'Emails con React.' },
  '@vercel/blob': { category: 'other', description: 'Storage de archivos de Vercel.' },
  '@aws-sdk/*': { category: 'other', description: 'SDK de AWS.' },
  'uploadthing': { category: 'other', description: 'Subida de archivos.' },
  '@uploadthing/*': { category: 'other', description: 'Subida de archivos.' },
  cloudinary: { category: 'other', description: 'Cloudinary (imágenes).' },
  'next-cloudinary': { category: 'other', description: 'Cloudinary para Next.' },
}

function matchesPattern(pattern, name) {
  if (!pattern.endsWith('*')) return pattern === name
  return name.startsWith(pattern.slice(0, -1))
}

/** Busca info de una librería en la base. */
export function lookupLibrary(name) {
  return lookupByPattern(LIBRARIES, name)
}

/** Busca en un mapa { 'nombre' | 'prefijo*': info } (match exacto primero, luego el prefijo más largo). */
export function lookupByPattern(map, name) {
  if (map[name]) return map[name]
  let best = null
  for (const [pattern, info] of Object.entries(map)) {
    if (pattern.endsWith('*') && matchesPattern(pattern, name)) {
      if (!best || pattern.length > best.pattern.length) best = { pattern, info }
    }
  }
  return best?.info ?? null
}
