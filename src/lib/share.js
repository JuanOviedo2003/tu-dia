import LZString from 'lz-string'
import { uid } from './constants'

// Serialización compacta: tuplas en vez de objetos con claves con nombre.
// Reduce drásticamente el tamaño del QR.
function serialize(tasks) {
  return tasks.map((t) => [
    t.title,
    t.description || '',
    t.day || null,
    t.startMinutes,
    t.status,
  ])
}

// Comprime las tareas en un string seguro para URL (compacto para QR).
export function compressTasks(tasks) {
  return LZString.compressToEncodedURIComponent(JSON.stringify(serialize(tasks)))
}

// Construye la URL completa de la página con los datos compartidos.
// `baseUrl` permite usar la IP LAN detectada en lugar de window.location.
export function buildShareUrl(tasks, baseUrl) {
  const compressed = compressTasks(tasks)
  const url = new URL(baseUrl || window.location.href)
  url.searchParams.set('d', compressed) // searchParams codifica automáticamente
  return url.toString()
}

// Construye la URL para un host concreto (IP local + puerto).
export function buildHostUrl(d, host) {
  // encodeURIComponent evita que '+' (válido en lz-string) se lea como espacio.
  return `http://${host}/?d=${encodeURIComponent(d)}`
}

// Lee tareas compartidas desde ?d= al abrir la página (p.ej. desde el móvil).
export function readShareTasks() {
  const params = new URLSearchParams(window.location.search)
  const d = params.get('d')
  if (!d) return null
  try {
    const json = LZString.decompressFromEncodedURIComponent(d)
    const arr = JSON.parse(json)
    if (!Array.isArray(arr)) return null
    if (arr.length === 0) return []
    // Formato compacto (array de tuplas)
    if (Array.isArray(arr[0])) {
      return arr.map(([title, description, day, startMinutes, status]) => ({
        id: uid(),
        title,
        description: description || '',
        day: day || null,
        startMinutes: Number(startMinutes) || 0,
        status: status || 'todo',
        updatedAt: Date.now(),
      }))
    }
    // Formato legacy (objetos)
    return arr
  } catch {
    /* datos corruptos: ignorar */
  }
  return null
}

// Limpia el parámetro ?d= de la URL tras importar (ya quedó en localStorage).
export function clearShareParam() {
  const url = new URL(window.location.href)
  if (!url.searchParams.has('d')) return
  url.searchParams.delete('d')
  window.history.replaceState({}, '', url.toString())
}
