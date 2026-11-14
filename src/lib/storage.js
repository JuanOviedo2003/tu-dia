// Persistencia en localStorage

import { uid } from './constants'

const KEY = 'tu-dia-tasks-v1'
const TOMB_KEY = 'tu-dia-tombstones-v1'
const ROOM_KEY = 'tu-dia-room-v1'
const TOKEN_KEY = 'tu-dia-token-v1'
const ROLE_KEY = 'tu-dia-role-v1'
const VIEW_TOKEN_KEY = 'tu-dia-view-token-v1'
const PROFILE_KEY = 'tu-dia-profile-v1'
const OWN_ROOM_KEY = 'tu-dia-own-room-v1'
const SHARED_KEY = 'tu-dia-shared-v1'

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

function saveItem(key, value) {
  try {
    if (value == null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch { /* almacenamiento lleno o no disponible: ignorar */ }
}

function loadItem(key) {
  try {
    return localStorage.getItem(key) || null
  } catch {
    return null
  }
}

export const saveRoomCode = (code) => saveItem(ROOM_KEY, code)
export const loadRoomCode = () => loadItem(ROOM_KEY)
export const saveToken = (token) => saveItem(TOKEN_KEY, token)
export const loadToken = () => loadItem(TOKEN_KEY)
export const saveViewToken = (token) => saveItem(VIEW_TOKEN_KEY, token)
export const loadViewToken = () => loadItem(VIEW_TOKEN_KEY)
export const saveRole = (role) => saveItem(ROLE_KEY, role)
export const loadRole = () => loadItem(ROLE_KEY)
export const saveProfileName = (name) => saveItem(PROFILE_KEY, name)
export const loadProfileName = () => loadItem(PROFILE_KEY)
export const saveOwnRoom = (code) => saveItem(OWN_ROOM_KEY, code)
export const loadOwnRoom = () => loadItem(OWN_ROOM_KEY)

export function clearRoomCredentials() {
  saveRoomCode(null)
  saveToken(null)
  saveRole(null)
  saveViewToken(null)
}

export function migrateLegacyViewer() {
  if (loadRole() !== 'viewer') return false
  const code = loadRoomCode()
  const token = loadToken()
  if (code && token && !loadShared()) saveShared({ code, token, ownerName: null })
  clearRoomCredentials()
  return true
}

export function saveShared(shared) {
  saveItem(SHARED_KEY, shared ? JSON.stringify(shared) : null)
}

export function loadShared() {
  try {
    const parsed = JSON.parse(loadItem(SHARED_KEY))
    return parsed && parsed.code && parsed.token ? parsed : null
  } catch {
    return null
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
