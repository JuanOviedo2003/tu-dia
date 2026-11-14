// Utilidades de tiempo

import { MINUTES_PER_DAY } from './constants'

export function pad2(n) {
  return String(n).padStart(2, '0')
}

// minutos -> "HH:MM"
export function clampMinutes(mins) {
  return Math.max(0, Math.min(MINUTES_PER_DAY - 1, Math.round(mins)))
}

export function minutesToLabel(mins) {
  const clamped = clampMinutes(mins)
  const h = Math.floor(clamped / 60)
  const m = clamped % 60
  return `${pad2(h)}:${pad2(m)}`
}

// "HH:MM" -> minutos
export function labelToMinutes(label) {
  if (!label) return 0
  const [h, m] = label.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

const DURATION_STEP = 5
const DURATION_MIN = 5
const DURATION_MAX = 720

export function normalizeDuration(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null
  const stepped = Math.round(value / DURATION_STEP) * DURATION_STEP
  return Math.max(DURATION_MIN, Math.min(DURATION_MAX, stepped))
}

export function withDuration(task) {
  const { durationMinutes, ...rest } = task
  const duration = normalizeDuration(durationMinutes)
  return duration ? { ...rest, durationMinutes: duration } : rest
}

export function formatDuration(minutes) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h && m) return `${h} h ${m} min`
  return h ? `${h} h` : `${m} min`
}

// posición (%) dentro del día para una barra
export function topPercent(start) {
  return (start / MINUTES_PER_DAY) * 100
}

export function monthName(monthIdx) {
  const names = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ]
  return names[monthIdx]
}

export function weekdayShort(idx) {
  return ['L', 'M', 'X', 'J', 'V', 'S', 'D'][idx]
}
