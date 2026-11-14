import { BUSY_DAY_TASKS, STATUSES } from './constants'
import { fromDateStr, toDateStr, todayStr } from './storage'
import { monthName, normalizeDuration } from './time'

const byStart = (a, b) => a.startMinutes - b.startMinutes

const FORMAT_DAY_LONG = new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'long' })
const FORMAT_DAY_MONTH = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'long' })
const FORMAT_WEEKDAY = new Intl.DateTimeFormat('es', { weekday: 'long' })
const FORMAT_DAY_CHIP = new Intl.DateTimeFormat('es', { weekday: 'short', day: 'numeric', month: 'short' })

export function tasksForDay(tasks, dateStr) {
  return tasks.filter((t) => t.day === dateStr).sort(byStart)
}

export function groupByDay(tasks) {
  const byDay = new Map()
  for (const task of tasks) {
    if (!task.day) continue
    const list = byDay.get(task.day)
    if (list) list.push(task)
    else byDay.set(task.day, [task])
  }
  for (const list of byDay.values()) list.sort(byStart)
  return byDay
}

export function unscheduledTasks(tasks) {
  return tasks.filter((t) => !t.day)
}

export function tasksByStatus(dayTasks) {
  return STATUSES.map((status) => ({ status, tasks: dayTasks.filter((t) => t.status === status.key) }))
}

const LANE_SLOT_MINUTES = 30

export function assignLanes(dayTasks) {
  const laneEnds = []
  const placed = dayTasks.map((task) => {
    let lane = laneEnds.findIndex((end) => end <= task.startMinutes)
    if (lane === -1) lane = laneEnds.length
    laneEnds[lane] = task.startMinutes + (normalizeDuration(task.durationMinutes) ?? LANE_SLOT_MINUTES)
    return { task, lane }
  })
  return { placed, laneCount: Math.max(1, laneEnds.length) }
}

function dayTone(dayTasks, dayStr, today = todayStr()) {
  if (dayTasks.length === 0) return null
  if (dayTasks.every((t) => t.status === 'done')) return 'done'
  const anyDone = dayTasks.some((t) => t.status === 'done')
  if (dayStr < today) return anyDone ? 'doing' : 'danger'
  return dayTasks.every((t) => t.status === 'todo') ? 'todo' : 'doing'
}

export function dayProgress(dayTasks, dayStr, today = todayStr()) {
  const total = dayTasks.length
  const done = dayTasks.filter((t) => t.status === 'done').length
  return {
    done,
    total,
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
    tone: dayTone(dayTasks, dayStr, today),
  }
}

export function dayStatusText({ done, total, tone }) {
  if (total === 0) return 'Sin tareas'
  if (tone === 'done') return 'Todo hecho'
  if (done === 0) return `${total} ${total === 1 ? 'pendiente' : 'pendientes'}`
  return `${done} ${done === 1 ? 'hecha' : 'hechas'} de ${total}`
}

export function dayLoad(tasks, day, startMinutes = null) {
  const dayTasks = tasksForDay(tasks, day)
  const { done, total } = dayProgress(dayTasks, day)
  const clash = startMinutes === null ? null : dayTasks.find((t) => t.startMinutes === startMinutes) ?? null
  return { done, total, busy: total >= BUSY_DAY_TASKS, clash }
}

export function dayLoadText(label, { done, total }) {
  if (total === 0) return 'Ese día está libre'
  const base = `${capitalize(label)} ya tiene ${total} ${total === 1 ? 'tarea' : 'tareas'}`
  return done ? `${base} · ${done} ${done === 1 ? 'hecha' : 'hechas'}` : base
}

export function unscheduledLoadText(count) {
  if (count === 0) return 'Aún no hay tareas sin programar'
  return `Hay ${count} ${count === 1 ? 'tarea' : 'tareas'} sin programar`
}

export function isOverdue(task, today = todayStr()) {
  return Boolean(task.day) && task.day < today && task.status !== 'done'
}

export function addDays(dateStr, delta) {
  const d = fromDateStr(dateStr) ?? new Date()
  d.setDate(d.getDate() + delta)
  return toDateStr(d)
}

export function addMonths(dateStr, delta) {
  const d = fromDateStr(dateStr) ?? new Date()
  const day = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + delta)
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(day, lastDay))
  return toDateStr(d)
}

export function formatDayLong(dateStr) {
  const d = fromDateStr(dateStr)
  if (!d) return ''
  return FORMAT_DAY_LONG.format(d).replace(',', '')
}

export function formatDayMonth(dateStr) {
  const d = fromDateStr(dateStr)
  if (!d) return ''
  return FORMAT_DAY_MONTH.format(d)
}

export function weekdayName(dateStr) {
  const d = fromDateStr(dateStr)
  if (!d) return ''
  return FORMAT_WEEKDAY.format(d)
}

export function formatDayChip(dateStr) {
  const d = fromDateStr(dateStr)
  if (!d) return ''
  return FORMAT_DAY_CHIP.format(d).replace(/\./g, '')
}

export function formatMonthTitle(dateStr) {
  const d = fromDateStr(dateStr)
  if (!d) return ''
  return `${monthName(d.getMonth())} ${d.getFullYear()}`
}

export function capitalize(text) {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text
}

export function monthGrid(dateStr) {
  const d = fromDateStr(dateStr) ?? new Date()
  const year = d.getFullYear()
  const month = d.getMonth()
  const leadingBlanks = (new Date(year, month, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const date = new Date(year, month, i + 1)
    return { dateStr: toDateStr(date), dayNumber: i + 1, weekday: (leadingBlanks + i) % 7 }
  })
  return { leadingBlanks, days }
}

const MAX_SUGGESTIONS = 5
const MIN_SUGGEST_CHARS = 2

export const foldText = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export function suggestTitles(tasks, line) {
  const query = foldText((line || '').trim())
  if (query.length < MIN_SUGGEST_CHARS) return []
  const seen = new Set()
  const out = []
  const recent = [...tasks].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
  for (const { title } of recent) {
    const folded = foldText((title || '').trim())
    if (!folded || folded === query || !folded.startsWith(query) || seen.has(folded)) continue
    seen.add(folded)
    out.push(title.trim())
    if (out.length === MAX_SUGGESTIONS) break
  }
  return out
}
