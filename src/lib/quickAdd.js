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
import { MAX_QUICK_ADD_LINES } from './constants'

const RECUR_RE = /\bcada\s+(semana|semanas|mes|meses)\b/i
const LEADING_CONNECTOR_RE = /^(a\s+las?|el|de|en|con)\s+/i
const TRAILING_CONNECTOR_RE = /\s+(a\s+las?|el|de|en|con)$/i

const DEFAULT_MINUTES = 9 * 60
const MIN_DURATION = 5
const MAX_DURATION = 12 * 60
const NOT_WORD = String.raw`(?<![\p{L}\p{N}])`
const NOT_WORD_AFTER = String.raw`(?![\p{L}\p{N}])`
const DONE_WORDS = '(?:hecha|hecho|terminada|terminado|completada|completado|lista|listo)'
const STATUS_RULES = [
  ['done', new RegExp(String.raw`${NOT_WORD}ya\s+${DONE_WORDS}${NOT_WORD_AFTER}`, 'giu')],
  ['done', new RegExp(String.raw`(?:\s*[,;]\s*|\s+-+\s*)${DONE_WORDS}\s*[.!]?\s*$`, 'giu')],
  ['review', new RegExp(String.raw`${NOT_WORD}en\s+revisi[oó]n${NOT_WORD_AFTER}`, 'giu')],
  ['inprogress', new RegExp(String.raw`${NOT_WORD}(?:en\s+progreso|en\s+curso)${NOT_WORD_AFTER}`, 'giu')],
]
const NOT_RELATIVE = String.raw`(?<!\b(?:en|dentro(?:\s+de)?)\s)`
const DURATION_PREFIX = String.raw`${NOT_RELATIVE}(?:${NOT_WORD}(?:por|durante|de)\s+)?`
const DURATION_HALF_HOUR_RE = new RegExp(String.raw`${DURATION_PREFIX}${NOT_WORD}media\s+hora${NOT_WORD_AFTER}`, 'iu')
const DURATION_ONE_HOUR_RE = new RegExp(String.raw`${DURATION_PREFIX}${NOT_WORD}una\s+hora${NOT_WORD_AFTER}`, 'iu')
const DURATION_HOURS_RE = new RegExp(
  String.raw`(?<!\bcada\s)(?<!\blas?\s)${DURATION_PREFIX}${NOT_WORD}(\d+(?:[.,]\d+)?)\s*(?:horas?|hrs?|hs|h)(?![\p{L}])(?:(?:\s*y)?\s*(\d{1,2})\s*min(?:utos?)?${NOT_WORD_AFTER}|(\d{2})(?!\d))?`,
  'iu'
)
const DURATION_MINUTES_RE = new RegExp(
  String.raw`(?<!\bcada\s)${DURATION_PREFIX}${NOT_WORD}(\d+)\s*(?:minutos?|mins?)${NOT_WORD_AFTER}`,
  'iu'
)
const MERIDIEM_HINT_RE = /\b(am|pm|a\.\s?m\.?|p\.\s?m\.?)(?![\p{L}])|de la (mañana|tarde|noche|madrugada)|\bh(s|rs?)?\b|:\d\d|\b0\d/iu
const BARE_DAY_RE = /(?<![\p{L}\p{N}])el\s+(\d{1,2})(?=\s*[,;.]|\s*$|\s+(?:a\s+las?|de\s+las|en)(?![\p{L}]))/iu
const DAY_ONLY_RE = /^(?:el\s+)?(?:d[ií]a\s+)?\d{1,2}$/i
const UNSCHEDULED_RE = new RegExp(String.raw`${NOT_WORD}(?:sin\s+fecha|sin\s+programar|alg[uú]n\s+d[ií]a)${NOT_WORD_AFTER}`, 'iu')

function extractStatus(text) {
  let status = 'todo'
  let rest = text
  for (const [value, re] of STATUS_RULES) {
    re.lastIndex = 0
    if (!re.test(rest)) continue
    if (status === 'todo') status = value
    re.lastIndex = 0
    rest = rest.replace(re, ' ')
  }
  return { status, rest }
}

function extractDuration(text) {
  const doubts = []
  const found = [
    [DURATION_HALF_HOUR_RE, () => 30],
    [DURATION_ONE_HOUR_RE, () => 60],
    [DURATION_HOURS_RE, (m) => {
      const h = parseFloat(m[1].replace(',', '.'))
      const extra = m[2] || m[3] ? parseInt(m[2] || m[3], 10) : 0
      return Math.round(h * 60) + extra
    }],
    [DURATION_MINUTES_RE, (m) => parseInt(m[1], 10)],
  ]
    .map(([re, toMinutes]) => {
      const m = text.match(re)
      return m ? { m, minutes: toMinutes(m) } : null
    })
    .filter(Boolean)
    .sort((a, b) => a.m.index - b.m.index)[0]
  if (!found) return { durationMinutes: null, rest: text, doubts }
  if (found.minutes < MIN_DURATION || found.minutes > MAX_DURATION) {
    doubts.push('duration-ignored')
    return { durationMinutes: null, rest: text, doubts }
  }
  const { m } = found
  const rest = text.slice(0, m.index) + ' ' + text.slice(m.index + m[0].length)
  return { durationMinutes: found.minutes, rest, doubts }
}

export function parseQuickAdd(raw) {
  const normalized = (raw || '').replace(/\s+/g, ' ').trim()
  if (!normalized) return null

  const doubts = []
  const { status, rest: withoutStatus } = extractStatus(normalized)
  const duration = extractDuration(withoutStatus)
  doubts.push(...duration.doubts)
  const unscheduled = UNSCHEDULED_RE.test(duration.rest)
  const text = (unscheduled ? duration.rest.replace(UNSCHEDULED_RE, ' ') : duration.rest).replace(/\s+/g, ' ').trim()

  let repeat = 'none'
  /** @type {Array<[number, number]>} rangos [start, end) a quitar del título */
  const ranges = []

  const recur = text.match(RECUR_RE)
  if (recur) {
    repeat = recur[1].toLowerCase().startsWith('semana') ? 'week' : 'month'
    ranges.push([recur.index, recur.index + recur[0].length])
  }

  // chrono: de pasar en el futuro (forwardDate) implícito con 'refDate' ahora.
  const results = unscheduled ? [] : es.parse(text, new Date(), { forwardDate: true })
  let day = null
  let startMinutes = DEFAULT_MINUTES
  if (results.length > 0) {
    const r = results[0]
    const d = r.start.date()
    day = toDateStr(d)
    if (r.start.isCertain('hour')) {
      const hour = r.start.get('hour')
      startMinutes = hour * 60 + (r.start.get('minute') || 0)
      if (hour >= 1 && hour <= 7 && !r.start.isCertain('meridiem') && !MERIDIEM_HINT_RE.test(r.text)) {
        doubts.push('time-without-meridiem')
      }
    }
    if (
      r.start.isCertain('day') &&
      !r.start.isCertain('month') &&
      DAY_ONLY_RE.test(r.text.trim()) &&
      d.getMonth() !== new Date().getMonth()
    ) {
      doubts.push('ambiguous-date')
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
  } else if (!unscheduled) {
    const bare = text.match(BARE_DAY_RE)
    const dayOfMonth = bare ? parseInt(bare[1], 10) : 0
    if (dayOfMonth >= 1 && dayOfMonth <= 31) {
      const now = new Date()
      const target = new Date(now.getFullYear(), now.getMonth(), dayOfMonth)
      const passed = dayOfMonth < now.getDate()
      if (passed) target.setMonth(target.getMonth() + 1, dayOfMonth)
      if (target.getDate() === dayOfMonth) {
        day = toDateStr(target)
        if (passed) doubts.push('ambiguous-date')
        ranges.push([bare.index, bare.index + bare[0].length])
      }
    }
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
  title = title.replace(/^[\s,;-]+|[\s,;-]+$/g, '')
  title = title.replace(LEADING_CONNECTOR_RE, '').replace(TRAILING_CONNECTOR_RE, '').trim()
  if (!title) doubts.push('title-empty')

  return {
    title,
    day,
    unscheduled,
    startMinutes,
    repeat,
    status,
    durationMinutes: duration.durationMinutes,
    doubts,
  }
}

export function splitQuickAddLines(raw) {
  return (raw || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

export function parseQuickAddLines(raw) {
  return splitQuickAddLines(raw).slice(0, MAX_QUICK_ADD_LINES).map(parseQuickAdd)
}
