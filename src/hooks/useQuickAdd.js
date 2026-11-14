import { useCallback, useId, useMemo, useState } from 'react'
import { parseQuickAddLines, splitQuickAddLines } from '../lib/quickAdd'
import { addDays, formatDayChip, suggestTitles } from '../lib/agenda'
import { formatDuration, minutesToLabel } from '../lib/time'
import { DEFAULT_REPEAT_MONTHS, MAX_QUICK_ADD_LINES, QUICK_ADD_DOUBT_LABELS, REPEAT_LABELS, statusMeta } from '../lib/constants'
import { todayStr } from '../lib/storage'

const PREVIEW_MAX = 5
const NO_TASKS = []
const TITLE_EMPTY_LABEL = QUICK_ADD_DOUBT_LABELS['title-empty']

function dayLabel(day) {
  if (!day) return 'Sin programar'
  const today = todayStr()
  if (day === today) return 'Hoy'
  if (day === addDays(today, 1)) return 'Mañana'
  return formatDayChip(day)
}

function toEntry(parsed, defaultDay) {
  const day = parsed.unscheduled ? null : parsed.day ?? defaultDay ?? null
  const ok = parsed.title.length > 0 && (parsed.repeat === 'none' || Boolean(day))
  return { parsed, day, ok }
}

function describe({ parsed, day }) {
  return {
    dayLabel: dayLabel(day),
    timeLabel: minutesToLabel(parsed.startMinutes),
    repeatLabel: parsed.repeat === 'none' ? null : `${REPEAT_LABELS[parsed.repeat]} · ${DEFAULT_REPEAT_MONTHS} meses`,
    statusLabel: parsed.status === 'todo' ? null : statusMeta(parsed.status).label,
    durationLabel: parsed.durationMinutes ? formatDuration(parsed.durationMinutes) : null,
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

export function useQuickAdd({ defaultDay, tasks = NO_TASKS, onCreate }) {
  const listId = useId()
  const [text, setTextState] = useState('')
  const [activeIndex, setActiveIndex] = useState(-1)
  const [listClosed, setListClosed] = useState(false)

  const entries = useMemo(() => parseQuickAddLines(text).map((p) => toEntry(p, defaultDay)), [text, defaultDay])
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
  }, [])

  const chips =
    entries.length === 1
      ? {
          titleMissing: entries[0].parsed.title.length === 0,
          needsDay: entries[0].parsed.repeat !== 'none' && !entries[0].day,
          ...describe(entries[0]),
          doubts: describe(entries[0]).doubts.filter((d) => d !== TITLE_EMPTY_LABEL),
        }
      : null

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
    setText,
    canCreate,
    chips,
    preview,
    submit,
    reset,
    suggestions: { listId, items: suggestions, activeIndex },
    moveActive,
    pick,
    closeList,
  }
}
