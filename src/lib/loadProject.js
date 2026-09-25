// Lectura de la carpeta seleccionada en el navegador. Nada sale de la máquina del usuario.
import { IGNORED_DIRS, shouldReadFile } from '../analyzer/files.js'

export const supportsDirectoryPicker = typeof window !== 'undefined' && 'showDirectoryPicker' in window

async function readText(file) {
  try {
    return await file.text()
  } catch {
    return null
  }
}

/** File System Access API (Chrome/Edge): permite saltear node_modules sin siquiera listarlo. */
export async function loadFromDirectoryHandle(handle, onProgress) {
  const files = []
  let skipped = 0
  async function walk(dir, prefix) {
    for await (const entry of dir.values()) {
      const path = prefix + entry.name
      if (entry.kind === 'directory') {
        if (!IGNORED_DIRS.has(entry.name)) await walk(entry, path + '/')
        continue
      }
      const file = await entry.getFile()
      if (!shouldReadFile(path, file.size)) {
        skipped++
        continue
      }
      const content = await readText(file)
      if (content != null) files.push({ path, content })
      onProgress?.(files.length, path)
    }
  }
  await walk(handle, '')
  return { name: handle.name, files, skipped }
}

/** <input type="file" webkitdirectory>: funciona en todos los navegadores modernos. */
export async function loadFromFileList(fileList, onProgress) {
  const all = [...fileList]
  const name = all[0]?.webkitRelativePath.split('/')[0] ?? 'proyecto'
  const files = []
  let skipped = 0
  for (const file of all) {
    const path = file.webkitRelativePath.split('/').slice(1).join('/')
    if (!shouldReadFile(path, file.size)) {
      skipped++
      continue
    }
    const content = await readText(file)
    if (content != null) files.push({ path, content })
    onProgress?.(files.length, path)
  }
  return { name, files, skipped }
}

/** Drag & drop de una carpeta. */
export async function loadFromDataTransfer(items, onProgress) {
  const entry = [...items].map((i) => i.webkitGetAsEntry?.()).find((e) => e?.isDirectory)
  if (!entry) throw new Error('Soltá una carpeta (no archivos sueltos).')
  const files = []
  let skipped = 0
  const readEntries = (reader) => new Promise((res, rej) => reader.readEntries(res, rej))
  const getFile = (fileEntry) => new Promise((res, rej) => fileEntry.file(res, rej))
  async function walk(dirEntry, prefix) {
    const reader = dirEntry.createReader()
    let batch
    do {
      batch = await readEntries(reader)
      for (const e of batch) {
        const path = prefix + e.name
        if (e.isDirectory) {
          if (!IGNORED_DIRS.has(e.name)) await walk(e, path + '/')
          continue
        }
        const file = await getFile(e)
        if (!shouldReadFile(path, file.size)) {
          skipped++
          continue
        }
        const content = await readText(file)
        if (content != null) files.push({ path, content })
        onProgress?.(files.length, path)
      }
    } while (batch.length)
  }
  await walk(entry, '')
  return { name: entry.name, files, skipped }
}

export function runAnalysis(files, options) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./analyzer.worker.js', import.meta.url), { type: 'module' })
    worker.onmessage = (e) => {
      worker.terminate()
      e.data.ok ? resolve(e.data.report) : reject(new Error(e.data.error))
    }
    worker.onerror = (e) => {
      worker.terminate()
      reject(new Error(e.message))
    }
    worker.postMessage({ files, options })
  })
}

export function download(filename, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
