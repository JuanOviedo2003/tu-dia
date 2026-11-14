import { useCallback, useId, useMemo, useState } from 'react'
import { highlightSegments, parseQuickAddLines, splitQuickAddLines } from '../lib/quickAdd'
import { addDays, formatDayChip, suggestTitles } from '../lib/agenda'
import { formatDuration, labelToMinutes, minutesToLabel } from '../lib/time'
import {
  DEFAULT_REPEAT_MONTHS,
  DURATION_OPTIONS,
  MAX_QUICK_ADD_LINES,
  QUICK_ADD_DOUBT_LABELS,
  REPEAT_LABELS,
  STATUSES,
  statusMeta,
} from '../lib/constants'
import { todayStr } from '../lib/storage'

const PREVIEW_MAX = 5
const NO_TASKS = []
const NO_OVERRIDES = {}
const TITLE_EMPTY_LABEL = QUICK_ADD_DOUBT_LABELS['title-empty']
const RESET = '__reset'
const UNSCHEDULED = '__none'
const START_OPTIONS = [480, 540, 720, 900, 1080, 1260]
const DOUBT_FIELD = {
  'time-without-meridiem': 'startMinutes',
  'ambiguous-date': 'day',
  'duration-ignored': 'durationMinutes',
}
const FIELD_NAMES = {
  day: 'Día',
  startMinutes: 'Hora',
  durationMinutes: 'Duración',
  status: 'Estado',
  repeat: 'Repetir',
}
const RESET_OPTION = { value: RESET, label: 'Volver a lo escrito', reset: true }

function dayLabel(day) {
  if (!day) return 'Sin programar'
  const today = todayStr()
  if (day === today) return 'Hoy'
  if (day === addDays(today, 1)) return 'Mañana'
  return formatDayChip(day)
}

function toEntry(source, defaultDay, overrides) {
  const parsed = {
    ...source,
    ...overrides,
    doubts: source.doubts.filter((d) => !(DOUBT_FIELD[d] in overrides)),
  }
  const day = 'day' in overrides ? overrides.day : source.unscheduled ? null : source.day ?? defaultDay ?? null
  const ok = parsed.title.length > 0 && (parsed.repeat === 'none' || Boolean(day))
  return { parsed, day, ok }
}

function describe({ parsed, day }) {
  return {
    dayLabel: dayLabel(day),
    timeLabel: minutesToLabel(parsed.startMinutes),
    doubts: [...new Set(parsed.doubts.map((d) => QUICK_ADD_DOUBT_LABELS[d]).filter(Boolean))],
  }
}

function toCreation({ parsed, day }) {
  const data = {
    title: parsed.title,
    description: '',
    day,
    startMinutes: parsed.startMinutes,
    status: parsed.status,
    durationMinutes: parsed.durationMinutes,
  }
  return { data, repeatOpts: parsed.repeat !== 'none' ? { pattern: parsed.repeat, months: DEFAULT_REPEAT_MONTHS } : null }
}

function fieldOptions(key, options, current, edited) {
  return { key, name: FIELD_NAMES[key], value: current, edited, options: edited ? [...options, RESET_OPTION] : options }
}

function buildCard({ parsed, day }, overrides, { select, openField, setOpenField }) {
  const today = todayStr()
  const meta = statusMeta(parsed.status)
  const edited = (key) => key in overrides
  const pick = (key) => (value) => select(key, value)
  const dayOptions = [
    { value: today, label: 'Hoy' },
    { value: addDays(today, 1), label: 'Mañana' },
    { value: addDays(today, 2), label: 'Pasado mañana' },
    { value: UNSCHEDULED, label: 'Sin programar' },
  ]
  const fields = [
    {
      ...fieldOptions('day', dayOptions, day ?? UNSCHEDULED, edited('day')),
      label: dayLabel(day),
      onSelect: (v) => select('day', v === UNSCHEDULED ? null : v),
      custom: { type: 'date', label: 'Elegir fecha…', initial: day ?? '', onApply: pick('day') },
    },
    {
      ...fieldOptions(
        'startMinutes',
        START_OPTIONS.map((m) => ({ value: m, label: minutesToLabel(m) })),
        parsed.startMinutes,
        edited('startMinutes'),
      ),
      label: minutesToLabel(parsed.startMinutes),
      onSelect: pick('startMinutes'),
      custom: { type: 'time', label: 'Otra hora…', initial: minutesToLabel(parsed.startMinutes), onApply: (v) => select('startMinutes', labelToMinutes(v)) },
    },
    {
      ...fieldOptions(
        'durationMinutes',
        [{ value: 0, label: 'Sin duración' }, ...DURATION_OPTIONS.map((m) => ({ value: m, label: formatDuration(m) }))],
        parsed.durationMinutes || 0,
        edited('durationMinutes'),
      ),
      label: parsed.durationMinutes ? formatDuration(parsed.durationMinutes) : 'Sin duración',
      onSelect: (v) => select('durationMinutes', v || null),
    },
    {
      ...fieldOptions('status', STATUSES.map((s) => ({ value: s.key, label: s.label })), parsed.status, edited('status')),
      label: meta.label,
      status: parsed.status,
      tone: `${meta.border} ${meta.bg} ${meta.text}`,
      onSelect: pick('status'),
    },
    {
      ...fieldOptions(
        'repeat',
        [{ value: 'none', label: 'No se repite' }, ...Object.entries(REPEAT_LABELS).map(([value, label]) => ({ value, label }))],
        parsed.repeat,
        edited('repeat'),
      ),
      label: parsed.repeat === 'none' ? 'No se repite' : `${REPEAT_LABELS[parsed.repeat]} · ${DEFAULT_REPEAT_MONTHS} meses`,
      repeat: true,
      onSelect: pick('repeat'),
    },
  ]
  return {
    title: parsed.title,
    titleMissing: parsed.title.length === 0,
    needsDay: parsed.repeat !== 'none' && !day,
    fields,
    doubts: describe({ parsed, day }).doubts.filter((d) => d !== TITLE_EMPTY_LABEL),
    openField,
    onOpenField: setOpenField,
  }
}

export function useQuickAdd({ defaultDay, tasks = NO_TASKS, onCreate }) {
  const listId = useId()
  const [text, setTextState] = useState('')
  const [activeIndex, setActiveIndex] = useState(-1)
  const [listClosed, setListClosed] = useState(false)

  const [overrides, setOverrides] = useState(NO_OVERRIDES)
  const [openField, setOpenField] = useState(null)

  const parsedLines = useMemo(() => parseQuickAddLines(text), [text])
  const segments = useMemo(() => highlightSegments(text, parsedLines), [text, parsedLines])
  const entries = useMemo(() => {
    const applied = parsedLines.length === 1 ? overrides : NO_OVERRIDES
    return parsedLines.map((p) => toEntry(p, defaultDay, applied))
  }, [parsedLines, defaultDay, overrides])
  const valid = useMemo(() => entries.filter((e) => e.ok), [entries])
  const canCreate = valid.length > 0
  const totalLines = useMemo(() => splitQuickAddLines(text).length, [text])

  const lines = text.split(/\r?\n/)
  const currentLine = lines[lines.length - 1]
  const suggestions = useMemo(
    () => (listClosed ? NO_TASKS : suggestTitles(tasks, currentLine)),
    [tasks, currentLine, listClosed],
  )

  const setText = useCallback((value) => {
    setTextState(value)
    setActiveIndex(-1)
    setListClosed(false)
    if (!value.trim()) {
      setOverrides(NO_OVERRIDES)
      setOpenField(null)
    }
  }, [])

  const select = (key, value) => {
    setOpenField(null)
    if (value === RESET) {
      setOverrides(({ [key]: _removed, ...rest }) => rest)
      return
    }
    const next = { [key]: value }
    if (key === 'repeat' && value !== 'none' && !entries[0].day) next.day = defaultDay ?? todayStr()
    setOverrides((current) => ({ ...current, ...next }))
  }

  const card = entries.length === 1 ? buildCard(entries[0], overrides, { select, openField, setOpenField }) : null

  const preview =
    entries.length > 1
      ? {
          count: valid.length,
          invalid: entries.length - valid.length,
          overflow: totalLines - entries.length,
          maxLines: MAX_QUICK_ADD_LINES,
          items: entries.slice(0, PREVIEW_MAX).map((e) => {
            const { dayLabel: day, timeLabel, doubts } = describe(e)
            return {
              title: e.parsed.title,
              dayLabel: day,
              timeLabel,
              review: !e.ok || doubts.length > 0,
              problem: e.parsed.title.length === 0 ? TITLE_EMPTY_LABEL : !e.ok ? 'Falta el día para repetir' : null,
            }
          }),
          more: Math.max(0, entries.length - PREVIEW_MAX),
        }
      : null

  const reset = () => setText('')

  const submit = () => {
    if (!canCreate) return
    const ignored = totalLines - valid.length
    if (onCreate(valid.map(toCreation), { ignored }) !== false) reset()
  }

  const moveActive = (delta) => {
    const n = suggestions.length
    setActiveIndex((i) => (i < 0 ? (delta > 0 ? 0 : n - 1) : (i + delta + n) % n))
  }

  const pick = (index) => {
    const title = suggestions[index]
    if (!title) return
    setText([...lines.slice(0, -1), title].join('\n'))
  }

  const closeList = () => setListClosed(true)

  return {
    text,
    segments,
    setText,
    canCreate,
    card,
    preview,
    submit,
    reset,
    suggestions: { listId, items: suggestions, activeIndex },
    moveActive,
    pick,
    closeList,
  }
}
