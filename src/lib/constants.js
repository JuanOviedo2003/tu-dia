export const STATUSES = [
  { key: 'todo', label: 'Pendiente', shortcut: '1', text: 'text-todo', bg: 'bg-todo-bg', border: 'border-todo-border', solid: 'border-todo', dropOver: 'bg-todo-border' },
  { key: 'inprogress', label: 'En curso', shortcut: '2', text: 'text-doing', bg: 'bg-doing-bg', border: 'border-doing-border', solid: 'border-doing', dropOver: 'bg-doing-drop' },
  { key: 'review', label: 'En revisión', shortcut: '3', text: 'text-review', bg: 'bg-review-bg', border: 'border-review-border', solid: 'border-review', dropOver: 'bg-review-border' },
  { key: 'done', label: 'Hecho', shortcut: '4', text: 'text-done', bg: 'bg-done-bg', border: 'border-done-border', solid: 'border-done', dropOver: 'bg-done-border' },
]

export const DANGER_TONE = { text: 'text-danger', bg: 'bg-danger-bg', border: 'border-danger-border' }

export function statusMeta(key) {
  return STATUSES.find((s) => s.key === key) || STATUSES[0]
}

export function statusByShortcut(char) {
  return STATUSES.find((s) => s.shortcut === char) || null
}

export const MINUTES_PER_DAY = 1440
export const DEFAULT_START_MINUTES = 9 * 60
export const DEFAULT_REPEAT_MONTHS = 6

export const REPEAT_LABELS = { week: 'Cada semana', month: 'Cada mes' }

export const VIEWS = [
  { value: 'day', label: 'Día', short: 'Día' },
  { value: 'timeline', label: 'Línea de tiempo', short: 'Línea' },
  { value: 'month', label: 'Mes', short: 'Mes' },
]

export function uid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
}
