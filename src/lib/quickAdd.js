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
const MERIDIEM_SRC = String.raw`am|pm|a\.\s?m\.?|p\.\s?m\.?`
const PERIOD_SRC = 'ma[ñn]ana|tarde|noche|madrugada'
const WEEKDAY_SRC = 'lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo'
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

const TIME_RANGE_RE = new RegExp(
  String.raw`${NOT_WORD}(?:de|desde)\s+(?:las?\s+)?(\d{1,2})(?::(\d{2}))?\s*(${MERIDIEM_SRC})?\s+(?:a|hasta)\s+(?:las?\s+)?(\d{1,2})(?::(\d{2}))?\s*(${MERIDIEM_SRC})?(?![\p{L}\p{N}:])`,
  'iu'
)
const TIME_FRACTION_RE = new RegExp(
  String.raw`${NOT_WORD}(?:a\s+)?las?\s+(\d{1,2})\s+(y\s+media|y\s+cuarto|menos\s+cuarto)(?:\s+de\s+la\s+(${PERIOD_SRC})|\s+(${MERIDIEM_SRC}))?${NOT_WORD_AFTER}`,
  'iu'
)
const TIME_NOON_RE = new RegExp(String.raw`${NOT_WORD}(?:(?:a|al)\s+)?(?:(medio\s?d[ií]a)|medianoche)${NOT_WORD_AFTER}`, 'iu')
const TIME_HOUR_SUFFIX_RE = new RegExp(String.raw`${NOT_WORD}(?:a\s+)?(las?\s+)?(\d{1,2})\s*h(?:rs?|s)?(?:(\d{2})(?!\d))?${NOT_WORD_AFTER}`, 'iu')

const DATE_AFTER_TOMORROW_RE = new RegExp(String.raw`${NOT_WORD}pasado\s+ma[ñn]ana${NOT_WORD_AFTER}`, 'iu')
const DATE_MONTH_POINT_RE = new RegExp(String.raw`${NOT_WORD}(?:a\s+)?(fin|finales|principios|mediados)\s+de\s+mes${NOT_WORD_AFTER}`, 'iu')
const DATE_PERIOD_RE = new RegExp(String.raw`${NOT_WORD}esta\s+(noche|tarde|ma[ñn]ana)${NOT_WORD_AFTER}`, 'iu')
const DATE_NEXT_WEEKDAY_RE = new RegExp(
  String.raw`${NOT_WORD}(?:(?:el\s+)?pr[oó]xim[oa]\s+(${WEEKDAY_SRC})|(?:el\s+)?(${WEEKDAY_SRC})\s+(?:que\s+viene|pr[oó]xim[oa]))${NOT_WORD_AFTER}`,
  'iu'
)
const HOLIDAY_RE = new RegExp(
  String.raw`${NOT_WORD}(?:lunes\s+de\s+pascua|(?:jueves|viernes|s[aá]bado)\s+santo|domingo\s+de\s+(?:ramos|resurrecci[oó]n|pascua)|mi[eé]rcoles\s+de\s+ceniza|s[aá]bado\s+de\s+gloria)${NOT_WORD_AFTER}`,
  'giu'
)
const PERIOD_DEFAULT_MINUTES = { noche: 21 * 60, tarde: 16 * 60, mañana: 9 * 60, manana: 9 * 60 }

const TIME_CORE = String.raw`(?:(?:(?:a|de)\s+)?las?\s+)?\d{1,2}(?::\d{2})?(?:\s*(?:${MERIDIEM_SRC}|h(?:rs?|s)?))?(?:\s+de\s+la\s+(?:${PERIOD_SRC}))?`
const TIME_PIECE_RE = new RegExp(String.raw`^(?:${TIME_CORE}|(?:en|dentro\s+de)\s+\d+\s*(?:horas?|hrs?|minutos?|mins?))$`, 'iu')
const TIME_TAIL_RE = new RegExp(
  String.raw`(?<=\s)(?:(?:(?:a|de)\s+)?las?\s+\d{1,2}(?::\d{2})?(?:\s*(?:${MERIDIEM_SRC}|h(?:rs?|s)?))?|\d{1,2}:\d{2}(?:\s*(?:${MERIDIEM_SRC}))?|\d{1,2}\s*(?:${MERIDIEM_SRC}|h(?:rs?|s)?))(?:\s+de\s+la\s+(?:${PERIOD_SRC}))?$`,
  'iu'
)

const isPm = (mer) => /^(p|tarde|noche)/i.test(mer)
const isAm = (mer) => /^(a|ma[ñn]ana|madrugada)/i.test(mer)

function to24(hour, mer) {
  if (!mer) return hour
  if (isPm(mer) && hour < 12) return hour + 12
  if (isAm(mer) && hour === 12) return 0
  return hour
}

function addDays(date, n) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  d.setDate(d.getDate() + n)
  return d
}

function extractDuration(text) {
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
  if (!found) return null
  return { minutes: found.minutes, start: found.m.index, end: found.m.index + found.m[0].length }
}

function findTimeRange(text) {
  const m = text.match(TIME_RANGE_RE)
  if (!m) return null
  const [, h1s, m1s, mer1, h2s, m2s, mer2] = m
  const h1 = parseInt(h1s, 10)
  const h2 = parseInt(h2s, 10)
  const min1 = m1s ? parseInt(m1s, 10) : 0
  const min2 = m2s ? parseInt(m2s, 10) : 0
  if (h1 > 23 || h2 > 23 || min1 > 59 || min2 > 59) return null
  const hint = Boolean(mer1 || mer2 || m1s || m2s)
  if (!hint && h1 < 8) return null
  const end = to24(h2, mer2 || mer1) * 60 + min2
  const candidates = [to24(h1, mer1 || mer2) * 60 + min1, to24(h1, mer1) * 60 + min1]
  const start = candidates.find((s) => s < end)
  return {
    start: m.index,
    end: m.index + m[0].length,
    minutes: start ?? candidates[0],
    hint,
    durationMinutes: start === undefined ? null : end - start,
    isRange: true,
  }
}

function findTimeFraction(text) {
  const m = text.match(TIME_FRACTION_RE)
  if (!m) return null
  const hour = parseInt(m[1], 10)
  const mer = m[3] || m[4]
  if (hour > 23) return null
  const delta = /media/i.test(m[2]) ? 30 : /menos/i.test(m[2]) ? -15 : 15
  return {
    start: m.index,
    end: m.index + m[0].length,
    minutes: to24(hour, mer) * 60 + delta,
    hint: Boolean(mer),
  }
}

function findTimeNoon(text) {
  const m = text.match(TIME_NOON_RE)
  if (!m) return null
  return { start: m.index, end: m.index + m[0].length, minutes: m[1] ? 12 * 60 : 23 * 60 + 59, hint: true }
}

function findTimeHourSuffix(text) {
  const re = new RegExp(TIME_HOUR_SUFFIX_RE.source, 'giu')
  for (const m of text.matchAll(re)) {
    const hour = parseInt(m[2], 10)
    const minute = m[3] ? parseInt(m[3], 10) : 0
    if (hour > 23 || minute > 59) continue
    if (!m[1] && hour < 13 && !m[2].startsWith('0')) continue
    return { start: m.index, end: m.index + m[0].length, minutes: hour * 60 + minute, hint: true }
  }
  return null
}

function findCustomTime(text) {
  return findTimeRange(text) || findTimeFraction(text) || findTimeNoon(text) || findTimeHourSuffix(text)
}

function findCustomDate(text, ref) {
  let m = text.match(DATE_AFTER_TOMORROW_RE)
  if (m) return { start: m.index, end: m.index + m[0].length, date: addDays(ref, 2) }

  m = text.match(DATE_MONTH_POINT_RE)
  if (m) {
    const point = m[1].toLowerCase()
    const y = ref.getFullYear()
    const mo = ref.getMonth()
    let date
    if (point === 'fin' || point === 'finales') date = new Date(y, mo + 1, 0)
    else if (point === 'principios') date = ref.getDate() === 1 ? new Date(y, mo, 1) : new Date(y, mo + 1, 1)
    else date = ref.getDate() <= 15 ? new Date(y, mo, 15) : new Date(y, mo + 1, 15)
    return { start: m.index, end: m.index + m[0].length, date }
  }

  m = text.match(DATE_PERIOD_RE)
  if (m) {
    const period = m[1].toLowerCase()
    return { start: m.index, end: m.index + m[0].length, date: addDays(ref, 0), period, defaultMinutes: PERIOD_DEFAULT_MINUTES[period] }
  }

  m = text.match(DATE_NEXT_WEEKDAY_RE)
  if (m) {
    const name = (m[1] || m[2]).toLowerCase()
    const target = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'].findIndex(
      (w) => w === name || w.normalize('NFD').replace(/[̀-ͯ]/g, '') === name
    )
    const diff = (target - ref.getDay() + 7) % 7 || 7
    return { start: m.index, end: m.index + m[0].length, date: addDays(ref, diff) }
  }
  return null
}

function subtract(start, end, spans) {
  return spans.reduce(
    (pieces, sp) =>
      pieces.flatMap(([a, b]) =>
        sp.end <= a || sp.start >= b ? [[a, b]] : [[a, sp.start], [sp.end, b]].filter(([x, y]) => y > x)
      ),
    [[start, end]]
  )
}

export function parseQuickAdd(raw, refDate = new Date()) {
  const source = raw || ''
  if (!source.trim()) return null

  const ref = refDate
  let text = source.replace(/\s/g, ' ')
  const spans = []
  const doubts = []

  const take = (start, end, kind) => {
    let s = start
    let e = end
    while (s < e && text[s] === ' ') s++
    while (e > s && text[e - 1] === ' ') e--
    if (e <= s) return
    spans.push({ start: s, end: e, kind })
    text = text.slice(0, s) + ' '.repeat(e - s) + text.slice(e)
  }

  let status = 'todo'
  for (const [value, re] of STATUS_RULES) {
    re.lastIndex = 0
    const found = [...text.matchAll(re)]
    if (found.length === 0) continue
    if (status === 'todo') status = value
    for (const m of found) take(m.index, m.index + m[0].length, 'status')
  }

  const unscheduledMatch = text.match(UNSCHEDULED_RE)
  const unscheduled = Boolean(unscheduledMatch)
  if (unscheduledMatch) take(unscheduledMatch.index, unscheduledMatch.index + unscheduledMatch[0].length, 'unscheduled')

  let customTime = null
  if (!unscheduled) {
    customTime = findCustomTime(text)
    if (customTime) take(customTime.start, customTime.end, 'time')
  }

  let durationMinutes = null
  if (customTime?.isRange) {
    if (customTime.durationMinutes !== null && customTime.durationMinutes >= MIN_DURATION && customTime.durationMinutes <= MAX_DURATION) {
      durationMinutes = customTime.durationMinutes
    } else {
      doubts.push('duration-ignored')
    }
  } else {
    const duration = extractDuration(text)
    if (duration) {
      if (duration.minutes < MIN_DURATION || duration.minutes > MAX_DURATION) {
        doubts.push('duration-ignored')
      } else {
        durationMinutes = duration.minutes
        take(duration.start, duration.end, 'duration')
      }
    }
  }

  let repeat = 'none'
  const recur = text.match(RECUR_RE)
  if (recur) {
    repeat = recur[1].toLowerCase().startsWith('semana') ? 'week' : 'month'
    take(recur.index, recur.index + recur[0].length, 'repeat')
  }

  let day = null
  let startMinutes = DEFAULT_MINUTES
  let period = null

  const finalizeTime = (minutes, hint) => {
    let total = minutes
    const hour = Math.floor(total / 60)
    if (period && !hint && hour >= 1 && hour <= 11 && (period === 'tarde' || period === 'noche')) {
      total += 12 * 60
    } else if (!hint && hour >= 1 && hour <= 7) {
      doubts.push('time-without-meridiem')
    }
    startMinutes = total
  }

  if (!unscheduled) {
    const customDate = findCustomDate(text, ref)
    if (customDate) {
      day = toDateStr(customDate.date)
      period = customDate.period || null
      if (customDate.defaultMinutes !== undefined) startMinutes = customDate.defaultMinutes
      take(customDate.start, customDate.end, 'date')
    }

    if (customTime) {
      finalizeTime(customTime.minutes, customTime.hint)
    }

    const chronoText = text.replace(HOLIDAY_RE, (h) => 'x'.repeat(h.length))
    const results = es.parse(chronoText, ref, { forwardDate: true })
    const r = results.filter((x) => !/^de\s+\d{1,2}\s+a$/i.test(x.text))[0]
    const hourCertain = Boolean(r?.start.isCertain('hour'))
    if (r && (!customDate || hourCertain)) {
      let start = r.index
      const end = r.index + r.text.length
      let usable = true
      if (start > 0 && /[\p{L}\p{N}]/u.test(text[start - 1])) {
        const ws = r.text.search(/\s/)
        if (ws === -1) usable = false
        else start += ws + 1
      }
      if (usable) {
        const lead = text.slice(0, start).match(/(?<![\p{L}\p{N}])(?:a|de)\s+$/iu)
        if (lead && /^las?\s/i.test(text.slice(start))) start -= lead[0].length
        const d = r.start.date()
        if (!customDate) day = toDateStr(d)
        if (hourCertain && !customTime) {
          const hint =
            r.start.isCertain('meridiem') ||
            MERIDIEM_HINT_RE.test(r.text) ||
            /^(?:en|dentro\s+de)\s/i.test(r.text)
          finalizeTime(r.start.get('hour') * 60 + (r.start.get('minute') || 0), hint)
        }
        if (
          !customDate &&
          r.start.isCertain('day') &&
          !r.start.isCertain('month') &&
          DAY_ONLY_RE.test(r.text.trim()) &&
          d.getMonth() !== ref.getMonth()
        ) {
          doubts.push('ambiguous-date')
        }
        for (const [a, b] of subtract(start, end, spans)) {
          const piece = text.slice(a, b).trim()
          if (!piece) continue
          if (!hourCertain || customDate || customTime) {
            take(a, b, hourCertain && TIME_PIECE_RE.test(piece) ? 'time' : 'date')
            continue
          }
          if (TIME_PIECE_RE.test(piece)) {
            take(a, b, 'time')
            continue
          }
          const tail = text.slice(a, b).match(TIME_TAIL_RE)
          if (tail && tail.index > 0) {
            take(a + tail.index, b, 'time')
            take(a, a + tail.index, 'date')
          } else {
            take(a, b, 'date')
          }
        }
      }
    } else if (!r) {
      const bare = text.match(BARE_DAY_RE)
      const dayOfMonth = bare ? parseInt(bare[1], 10) : 0
      if (!customDate && dayOfMonth >= 1 && dayOfMonth <= 31) {
        const target = new Date(ref.getFullYear(), ref.getMonth(), dayOfMonth)
        const passed = dayOfMonth < ref.getDate()
        if (passed) target.setMonth(target.getMonth() + 1, dayOfMonth)
        if (target.getDate() === dayOfMonth) {
          day = toDateStr(target)
          if (passed) doubts.push('ambiguous-date')
          take(bare.index, bare.index + bare[0].length, 'date')
        }
      }
    }

    if (customTime && day === null) day = toDateStr(ref)
  }

  spans.sort((a, b) => a.start - b.start)
  let title = ''
  let cursor = 0
  for (const { start, end } of spans) {
    title += source.slice(cursor, start) + ' '
    cursor = end
  }
  title += source.slice(cursor)
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
    durationMinutes,
    doubts,
    spans,
  }
}

export function splitQuickAddLines(raw) {
  return (raw || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

export function parseQuickAddLines(raw, refDate = new Date()) {
  const lines = []
  let lineStart = 0
  for (const part of (raw || '').split(/(\r?\n)/)) {
    const trimmed = part.trim()
    if (trimmed) lines.push({ line: trimmed, lineStart, trimOffset: part.indexOf(trimmed) })
    lineStart += part.length
  }
  return lines
    .slice(0, MAX_QUICK_ADD_LINES)
    .map(({ line, lineStart: start, trimOffset }) => ({ ...parseQuickAdd(line, refDate), lineStart: start, trimOffset }))
}

export function highlightSegments(raw, lineResults) {
  const marks = lineResults.flatMap((r) =>
    r.spans.map((s) => ({ start: r.lineStart + r.trimOffset + s.start, end: r.lineStart + r.trimOffset + s.end, kind: s.kind })),
  )
  if (marks.length === 0) return []
  const segments = []
  let cursor = 0
  for (const { start, end, kind } of marks) {
    if (start > cursor) segments.push({ text: raw.slice(cursor, start), kind: null })
    segments.push({ text: raw.slice(start, end), kind })
    cursor = end
  }
  if (cursor < raw.length) segments.push({ text: raw.slice(cursor), kind: null })
  return segments
}
