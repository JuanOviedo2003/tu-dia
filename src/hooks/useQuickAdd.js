import { useMemo, useState } from 'react'
import { parseQuickAdd } from '../lib/quickAdd'
import { addDays, formatDayChip } from '../lib/agenda'
import { minutesToLabel } from '../lib/time'
import { DEFAULT_REPEAT_MONTHS, DEFAULT_START_MINUTES, REPEAT_LABELS } from '../lib/constants'
import { todayStr } from '../lib/storage'

const DEFAULT_PARSED = { title: '', day: null, startMinutes: DEFAULT_START_MINUTES, repeat: 'none' }

function dayLabel(day) {
  if (!day) return 'Sin programar'
  const today = todayStr()
  if (day === today) return 'Hoy'
  if (day === addDays(today, 1)) return 'Mañana'
  return formatDayChip(day)
}

export function useQuickAdd({ defaultDay, onCreate }) {
  const [text, setText] = useState('')
  const parsed = useMemo(() => parseQuickAdd(text) || DEFAULT_PARSED, [text])

  const day = parsed.day ?? defaultDay ?? null
  const repeat = parsed.repeat
  const titleOk = parsed.title.trim().length > 0
  const canCreate = titleOk && (repeat === 'none' || Boolean(day))

  const chips = text.trim()
    ? {
        titleMissing: !titleOk,
        needsDay: repeat !== 'none' && !day,
        dayLabel: dayLabel(day),
        timeLabel: minutesToLabel(parsed.startMinutes),
        repeatLabel: repeat === 'none' ? null : `${REPEAT_LABELS[repeat]} · ${DEFAULT_REPEAT_MONTHS} meses`,
      }
    : null

  const reset = () => setText('')

  const submit = () => {
    if (!canCreate) return
    const data = {
      title: parsed.title.trim(),
      description: '',
      day,
      startMinutes: parsed.startMinutes,
      status: 'todo',
    }
    onCreate(data, repeat !== 'none' ? { pattern: repeat, months: DEFAULT_REPEAT_MONTHS } : null)
    reset()
  }

  return { text, setText, canCreate, chips, submit, reset }
}
