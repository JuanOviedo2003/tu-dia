// Utilidades de tiempo

import { MINUTES_PER_DAY } from './constants'

export function pad2(n) {
  return String(n).padStart(2, '0')
}

// minutos -> "HH:MM"
export function minutesToLabel(mins) {
  const clamped = Math.max(0, Math.min(MINUTES_PER_DAY - 1, Math.round(mins)))
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
