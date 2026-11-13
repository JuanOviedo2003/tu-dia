import { useEffect, useState } from 'react'
import { minutesToLabel, labelToMinutes } from '../lib/time'
import { DEFAULT_REPEAT_MONTHS, DEFAULT_START_MINUTES, REPEAT_LABELS } from '../lib/constants'
import { previewCount, clampWarning } from '../lib/recurring'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const normalizeDay = (d) => (typeof d === 'string' && DATE_RE.test(d) ? d : '')

function emptyForm(defaultDay, defaultStatus) {
  return {
    title: '',
    description: '',
    day: normalizeDay(defaultDay),
    start: minutesToLabel(DEFAULT_START_MINUTES),
    status: defaultStatus || 'todo',
  }
}

export function useTaskForm({ open, initial, defaultDay, defaultStatus, onSave, onSaveRecurring, onUpdateRule }) {
  const [form, setForm] = useState(() => emptyForm(defaultDay, defaultStatus))
  const [repeat, setRepeat] = useState('none')
  const [duration, setDuration] = useState(DEFAULT_REPEAT_MONTHS)

  useEffect(() => {
    if (!open) return
    if (initial) {
      setForm({
        title: initial.title || '',
        description: initial.description || '',
        day: normalizeDay(initial.day),
        start: minutesToLabel(initial.startMinutes),
        status: initial.status || 'todo',
      })
    } else {
      setForm(emptyForm(defaultDay, defaultStatus))
    }
    const series = Boolean(initial?.groupId && initial?.pattern)
    setRepeat(series ? initial.pattern : 'none')
    setDuration(series ? initial.windowMonths || DEFAULT_REPEAT_MONTHS : DEFAULT_REPEAT_MONTHS)
  }, [open, initial, defaultDay, defaultStatus])

  const isEditing = Boolean(initial)
  const hasSeries = Boolean(initial && initial.groupId)
  const showRepeat = !isEditing || hasSeries
  const repeating = repeat !== 'none' && Boolean(form.day)

  const setField = (key) => (value) => setForm((f) => ({ ...f, [key]: value }))

  const preview = !isEditing && repeating ? previewCount(form.day, repeat, Number(duration)) : 0
  const clamp = !isEditing && repeating ? clampWarning(form.day) : null

  let ruleHint = null
  if (repeating) {
    ruleHint = hasSeries
      ? `Regla: ${REPEAT_LABELS[repeat]} durante ${duration} meses`
      : `Se crearán ${preview} tareas`
  }
  const repeatWarning = repeat !== 'none' && !form.day ? 'Elige un día para repetir la tarea.' : clamp

  const saveDisabled = !form.title.trim()

  const submit = () => {
    if (!form.title.trim()) return
    const data = {
      title: form.title.trim(),
      description: form.description.trim(),
      day: form.day || null,
      startMinutes: labelToMinutes(form.start),
      status: form.status,
    }
    if (!isEditing && repeat !== 'none') {
      if (!form.day) return
      onSaveRecurring(data, { pattern: repeat, months: Number(duration) })
      return
    }
    if (hasSeries && repeat !== 'none') {
      const ruleChanged =
        initial.pattern !== repeat ||
        initial.windowMonths !== Number(duration) ||
        initial.baseDay !== form.day
      if (ruleChanged && onUpdateRule) {
        onUpdateRule(initial.id, repeat, Number(duration), form.day || initial.day)
      }
    }
    onSave(data)
  }

  return {
    form,
    setField,
    repeat,
    setRepeat,
    duration,
    setDuration,
    isEditing,
    hasSeries,
    showRepeat,
    ruleHint,
    repeatWarning,
    saveDisabled,
    submit,
  }
}
