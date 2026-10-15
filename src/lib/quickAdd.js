// Parser de captura rápida (sin modelos): chrono-node locale 'es' + regex
// de recurrencia. Extrae día/hora/recurrencia de texto libre en español.
// Reglas propias:
//   - Sin fecha explícita → day: null (va a "Sin programar")... salvo si tiene
//     hora: chrono imputa el día actual, que es justo lo que pedimos
//     (hora sin día → hoy).
//   - "cada semana/mes" → repeat week/month (chrono no detecta recurrencia).
//   - Título = texto con las frases de fecha/hora/recurrencia removidas,
//     con conectores residuales ("a las", "el", "de", "en") limpiados.
import { es } from 'chrono-node'
import { toDateStr } from './storage'

const RECUR_RE = /\bcada\s+(semana|semanas|mes|meses)\b/i
const LEADING_CONNECTOR_RE = /^(a\s+las?|el|de|en|con)\s+/i
const TRAILING_CONNECTOR_RE = /\s+(a\s+las?|el|de|en|con)$/i

const DEFAULT_MINUTES = 9 * 60

export function parseQuickAdd(raw) {
  const text = (raw || '').replace(/\s+/g, ' ').trim()
  if (!text) return null

  let repeat = 'none'
  /** @type {Array<[number, number]>} rangos [start, end) a quitar del título */
  const ranges = []

  const recur = text.match(RECUR_RE)
  if (recur) {
    repeat = recur[1].toLowerCase().startsWith('semana') ? 'week' : 'month'
    ranges.push([recur.index, recur.index + recur[0].length])
  }

  // chrono: de pasar en el futuro (forwardDate) implícito con 'refDate' ahora.
  const results = es.parse(text, new Date(), { forwardDate: true })
  let day = null
  let startMinutes = DEFAULT_MINUTES
  if (results.length > 0) {
    const r = results[0]
    const d = r.start.date()
    day = toDateStr(d)
    if (r.start.isCertain('hour')) {
      startMinutes = r.start.get('hour') * 60 + (r.start.get('minute') || 0)
    }
    // Guarda contra match a mitad de palabra: chrono 'es' a veces se traga
    // la letra final del título como conector ("dentistA 15:00" → "a 15:00").
    // Si el match empieza pegado a una letra, cortar desde el primer token
    // completo dentro del match (espacio siguiente).
    let start = r.index
    let end = r.index + r.text.length
    if (start > 0 && /[\p{L}\p{N}]/u.test(text[start - 1])) {
      const ws = r.text.search(/\s/)
      if (ws === -1) {
        start = -1 // match completamente pegado a una palabra: no quitar
      } else {
        start += ws + 1
      }
    }
    if (start >= 0) ranges.push([start, end])
  }

  // Título: quitar rangos detectados (ordenados), colapsar espacios, limpiar
  // conectores huérfanos al inicio/fin (ex: "a las" queda tras quitar hora).
  ranges.sort((a, b) => a[0] - b[0])
  let title = ''
  let cursor = 0
  for (const [s, e] of ranges) {
    title += text.slice(cursor, s) + ' '
    cursor = e
  }
  title += text.slice(cursor)
  title = title.replace(/\s+/g, ' ').trim()
  title = title.replace(LEADING_CONNECTOR_RE, '').replace(TRAILING_CONNECTOR_RE, '').trim()

  return { title, day, startMinutes, repeat }
}
