import { fromDateStr, toDateStr } from './storage'

// ── Utilidades de fecha ──────────────────────────────────────────────────────
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** Normaliza día a último día válido del mes (sin rollover JS). */
function clampDay(y, m, day) {
  const last = new Date(y, m + 1, 0).getDate()
  return Math.min(day, last)
}

/** Calcula la fecha final de la ventana (misma lógica que clampDay). */
export function windowEnd(baseDay, windowMonths) {
  const base = fromDateStr(baseDay)
  if (!base) return null
  const y = base.getFullYear()
  const m = base.getMonth() + windowMonths
  const d = clampDay(y, m, base.getDate())
  return new Date(y, m, d)
}

// ── Generación inicial de la serie ───────────────────────────────────────────
// Genera todas las fechas de la serie dentro de la ventana. Incluye la base.
// pattern: 'month' (misma fecha-de-mes) | 'week' (mismo día-de-semana).
// windowMonths: duración de la ventana en meses.
// Retorna array de strings YYYY-MM-DD.
export function generateRecurring(baseDay, pattern, windowMonths) {
  if (typeof baseDay !== 'string' || !DATE_RE.test(baseDay)) return []
  if (pattern !== 'month' && pattern !== 'week') return []
  const base = fromDateStr(baseDay)
  if (!base) return []
  const end = windowEnd(baseDay, windowMonths)
  if (!end) return []

  const dates = []
  if (pattern === 'month') {
    const y0 = base.getFullYear()
    const m0 = base.getMonth()
    for (let i = 0; i < windowMonths; i++) {
      const y = y0
      const m = m0 + i
      const day = clampDay(y, m, base.getDate())
      const d = new Date(y, m, day)
      if (d > end) break
      dates.push(d)
    }
  } else {
    // week: cada 7 días desde base hasta fin de ventana
    const cur = new Date(base.getFullYear(), base.getMonth(), base.getDate())
    while (cur <= end) {
      dates.push(new Date(cur))
      cur.setDate(cur.getDate() + 7)
    }
  }
  return dates.map(toDateStr)
}

// ── Siguiente ocurrencia ─────────────────────────────────────────────────────
// Dada la última fecha de la serie, calcula la siguiente.
// Retorna string YYYY-MM-DD o null si excede la ventana.
//
// Contraejemplos:
//   base 31-ene, windowMonths=1 → end = 28/29-feb (clamp). 31-ene + 1 mes = 28-feb → OK.
//   base 31-ago, windowMonths=3 → end = 30-nov. 31-ago → 30-sep (clamp) → 31-oct → 30-nov → null.
//   base 29-ene, windowMonths=6 → end = 29-jul. 29-ene → 28-feb → 29-mar → 29-abr → 29-may → 29-jun → 29-jul → null.
//   base 15, pattern=week, windowMonths=1 → end ~15 del mes siguiente. 15 + 7*4 = 15+28 = dentro.
export function nextOccurrence(lastDay, pattern, windowMonths, baseDay) {
  if (typeof lastDay !== 'string' || !DATE_RE.test(lastDay)) return null
  if (typeof baseDay !== 'string' || !DATE_RE.test(baseDay)) return null
  if (pattern !== 'month' && pattern !== 'week') return null

  const last = fromDateStr(lastDay)
  const base = fromDateStr(baseDay)
  const end = windowEnd(baseDay, windowMonths)
  if (!last || !base || !end) return null

  let next
  if (pattern === 'month') {
    const y = last.getFullYear()
    const m = last.getMonth() + 1
    const day = clampDay(y, m, base.getDate())
    next = new Date(y, m, day)
  } else {
    next = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 7)
  }
  if (next > end) return null
  return toDateStr(next)
}

// ── Preview: contar ocurrencias ──────────────────────────────────────────────
// Mismo comportamiento que generateRecurring pero retorna count.
export function previewCount(baseDay, pattern, windowMonths) {
  return generateRecurring(baseDay, pattern, windowMonths).length
}

// ── Detectar si un día base cae en clamp de mes corto ────────────────────────
// Retorna null si no hay clamp, o el string "cae el último día del mes" si sí.
export function clampWarning(baseDay) {
  if (typeof baseDay !== 'string' || !DATE_RE.test(baseDay)) return null
  const base = fromDateStr(baseDay)
  if (!base) return null
  const y = base.getFullYear()
  const m = base.getMonth()
  const realLast = new Date(y, m + 1, 0).getDate()
  if (base.getDate() < realLast) return null
  // El día base ES el último día del mes → en meses cortos se clampa
  const febLast = new Date(y, 1, 0).getDate() // 28 o 29
  if (realLast === 28 || realLast === 29 || realLast === 30) {
    return 'cae el último día del mes'
  }
  return null
}

// ── Label dinámico de duración ───────────────────────────────────────────────
export function durationLabel(pattern, months) {
  if (pattern === 'month') {
    return months === 12 ? '1 año (12 ocurrencias)' : `${months} meses (${months} ocurrencias)`
  }
  // week: ventana en meses
  return `repetir cada semana durante ${months} ${months === 1 ? 'mes' : 'meses'}`
}
