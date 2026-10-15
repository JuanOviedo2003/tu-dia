// Persistencia en localStorage

import { uid } from './constants'

const KEY = 'tu-dia-tasks-v1'
const TOMB_KEY = 'tu-dia-tombstones-v1'

function seed() {
  const today = toDateStr(new Date())
  return [
    {
      id: uid(),
      title: 'Planificar sprint',
      description: 'Definir objetivos de la semana',
      day: today,
      startMinutes: 9 * 60,
      status: 'inprogress',
      updatedAt: Date.now(),
    },
    {
      id: uid(),
      title: 'Revisión de código',
      description: 'PR del equipo',
      day: today,
      startMinutes: 14 * 60 + 30,
      status: 'review',
      updatedAt: Date.now(),
    },
    {
      id: uid(),
      title: 'Leer correo',
      day: today,
      startMinutes: 8 * 60,
      status: 'done',
      updatedAt: Date.now(),
    },
    {
      id: uid(),
      title: 'Preparar presentación',
      description: 'Sin fecha asignada',
      day: null,
      startMinutes: 16 * 60,
      status: 'todo',
      updatedAt: Date.now(),
    },
  ]
}

export function loadTasks() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return seed()
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return seed()
    // Migración: se añadió updatedAt al modelo.
    return parsed.map((t) => ({
      ...t,
      updatedAt: t.updatedAt || Date.now(),
    }))
  } catch {
    return seed()
  }
}

export function saveTasks(tasks) {
  try {
    localStorage.setItem(KEY, JSON.stringify(tasks))
  } catch {
    /* almacenamiento lleno o no disponible: ignorar */
  }
}

export function loadTombstones() {
  try {
    const raw = localStorage.getItem(TOMB_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function saveTombstones(tombstones) {
  try {
    localStorage.setItem(TOMB_KEY, JSON.stringify(tombstones || {}))
  } catch {
    /* almacenamiento lleno o no disponible: ignorar */
  }
}

export function toDateStr(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function fromDateStr(s) {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return null
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function todayStr() {
  return toDateStr(new Date())
}
