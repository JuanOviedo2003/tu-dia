// Estado / constantes de dominio

export const STATUSES = [
  { key: 'todo', label: 'Por hacer', color: '#96ACB7', text: '#0b0f14' },
  { key: 'inprogress', label: 'En curso', color: '#FFB17A', text: '#0b0f14' },
  { key: 'review', label: 'En revisión', color: '#DCED31', text: '#0b0f14' },
  { key: 'done', label: 'Listo', color: '#6FCF73', text: '#0b0f14' },
]

export const STATUS_KEYS = STATUSES.map((s) => s.key)

export function statusMeta(key) {
  return STATUSES.find((s) => s.key === key) || STATUSES[0]
}

export const DAY_MS = 86400000
export const MINUTES_PER_DAY = 1440

export function uid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
}
