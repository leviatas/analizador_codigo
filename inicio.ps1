<#
.SYNOPSIS
  Instala las dependencias del Analizador de Código y levanta la web.

.DESCRIPTION
  1. Verifica que Node.js y npm estén instalados (y que la versión sirva).
  2. Instala las librerías del proyecto (npm install) si hace falta.
  3. Busca un puerto libre, avisa en qué dirección queda la web y la abre en el navegador.

.EXAMPLE
  .\inicio.ps1
  .\inicio.ps1 -Puerto 3000
  .\inicio.ps1 -NoAbrir
  .\inicio.ps1 -Produccion     # compila y sirve la versión optimizada
  .\inicio.ps1 -Reinstalar     # fuerza npm install aunque ya esté instalado
#>
param(
  [int]$Puerto = 5173,
  [switch]$NoAbrir,
  [switch]$Produccion,
  [switch]$Reinstalar
)

$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot

function Escribir-Paso($texto) { Write-Host "`n==> $texto" -ForegroundColor Cyan }
function Escribir-Ok($texto) { Write-Host "    $texto" -ForegroundColor Green }
function Salir-ConError($texto) {
  Write-Host "`n[ERROR] $texto" -ForegroundColor Red
  exit 1
}

Write-Host ''
Write-Host '  Analizador de Código - React / Next.js' -ForegroundColor Magenta
Write-Host '  ---------------------------------------' -ForegroundColor Magenta

# ── 1. Node.js y npm ─────────────────────────────────────────────────────────
Escribir-Paso 'Verificando Node.js y npm...'
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Salir-ConError ("No se encontró Node.js. Instalalo desde https://nodejs.org (versión LTS) " +
    "o con:  winget install OpenJS.NodeJS.LTS   y volvé a abrir la terminal.")
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Salir-ConError 'Se encontró Node.js pero no npm. Reinstalá Node.js desde https://nodejs.org'
}

$versionNode = (& node -v).Trim().TrimStart('v')
$partes = $versionNode.Split('.') | ForEach-Object { [int]$_ }
# Vite 8 requiere Node 20.19+ o 22.12+
$nodeOk = ($partes[0] -gt 22) -or
          ($partes[0] -eq 22 -and $partes[1] -ge 12) -or
          ($partes[0] -eq 21) -or
          ($partes[0] -eq 20 -and $partes[1] -ge 19)
if (-not $nodeOk) {
  Salir-ConError "Tenés Node.js $versionNode y se necesita 20.19 o superior (recomendado 22 LTS). Actualizalo desde https://nodejs.org"
}
Escribir-Ok "Node.js $versionNode  /  npm $((& npm -v).Trim())"

# ── 2. Librerías ─────────────────────────────────────────────────────────────
Escribir-Paso 'Instalando librerías del proyecto...'
$marcaInstalacion = Join-Path (Join-Path $PSScriptRoot 'node_modules') '.package-lock.json'
$lock = Join-Path $PSScriptRoot 'package-lock.json'
$hayQueInstalar = $Reinstalar -or -not (Test-Path -LiteralPath $marcaInstalacion)
if (-not $hayQueInstalar -and (Test-Path $lock)) {
  # Si el package-lock.json cambió después de la última instalación, reinstalamos
  $hayQueInstalar = (Get-Item -Force $lock).LastWriteTime -gt (Get-Item -Force $marcaInstalacion).LastWriteTime
}

if ($hayQueInstalar) {
  & npm install --no-fund --no-audit
  if ($LASTEXITCODE -ne 0) { Salir-ConError 'Falló npm install. Revisá los mensajes de arriba (¿conexión a internet?).' }
  Escribir-Ok 'Librerías instaladas.'
} else {
  Escribir-Ok 'Las librerías ya estaban instaladas (usá -Reinstalar para forzar).'
}

# ── 3. Puerto libre ──────────────────────────────────────────────────────────
function Probar-Puerto([int]$p) {
  try {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $p)
    $listener.Start()
    $listener.Stop()
    return $true
  } catch {
    return $false
  }
}

$puertoElegido = $Puerto
while (-not (Probar-Puerto $puertoElegido)) {
  if ($puertoElegido -ge $Puerto + 50) { Salir-ConError "No se encontró un puerto libre entre $Puerto y $($Puerto + 50)." }
  $puertoElegido++
}
if ($puertoElegido -ne $Puerto) { Escribir-Ok "El puerto $Puerto está ocupado; se usa el $puertoElegido." }

# ── 4. Compilar (sólo modo producción) ───────────────────────────────────────
if ($Produccion) {
  Escribir-Paso 'Compilando la versión de producción...'
  & npm run build
  if ($LASTEXITCODE -ne 0) { Salir-ConError 'Falló la compilación.' }
}

# ── 5. Aviso de dónde está la web y arranque ─────────────────────────────────
$url = "http://localhost:$puertoElegido/"
Write-Host ''
Write-Host '  ==============================================================' -ForegroundColor Green
Write-Host '    La web del Analizador de Código queda disponible en:' -ForegroundColor Green
Write-Host ''
Write-Host "        $url" -ForegroundColor Yellow
Write-Host ''
Write-Host "    Carpeta del proyecto: $PSScriptRoot" -ForegroundColor Green
Write-Host '    Para detenerla presioná Ctrl + C en esta ventana.' -ForegroundColor Green
Write-Host '  ==============================================================' -ForegroundColor Green
Write-Host ''

$argumentos = @('--port', "$puertoElegido", '--strictPort')
if (-not $NoAbrir) { $argumentos += '--open' }

if ($Produccion) {
  & npx vite preview @argumentos
} else {
  & npx vite @argumentos
}
exit $LASTEXITCODE
