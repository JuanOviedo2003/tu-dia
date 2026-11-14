import { foldText } from './agenda'
import { tidyTitle } from './quickAdd'
import { normalizeDuration } from './time'

const MIN_HABIT_TASKS = 2
const NO_MATCHES = []

export const titleKey = (title) => foldText(tidyTitle(title))

function mostFrequent(values) {
  const counts = new Map()
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1)
  let best = null
  let bestCount = MIN_HABIT_TASKS - 1
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value
      bestCount = count
    }
  }
  return best
}

const byRecent = (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)

function onePerSeries(sorted) {
  const seen = new Set()
  return sorted.filter((t) => {
    if (!t.groupId) return true
    if (seen.has(t.groupId)) return false
    seen.add(t.groupId)
    return true
  })
}

function habitFrom(matches) {
  const scheduled = onePerSeries(matches.filter((t) => t.day).sort(byRecent))
  if (scheduled.length < MIN_HABIT_TASKS) return null
  const startMinutes = mostFrequent(scheduled.map((t) => t.startMinutes).filter(Number.isFinite))
  const durationMinutes = mostFrequent(scheduled.map((t) => normalizeDuration(t.durationMinutes)).filter(Boolean))
  return startMinutes === null && durationMinutes === null ? null : { startMinutes, durationMinutes }
}

function templateFrom(matches) {
  let latest = null
  for (const t of matches) if (!latest || (t.updatedAt || 0) > (latest.updatedAt || 0)) latest = t
  const values = {}
  if (!latest) return values
  if (latest.day && Number.isFinite(latest.startMinutes)) values.startMinutes = latest.startMinutes
  const duration = normalizeDuration(latest.durationMinutes)
  if (duration) values.durationMinutes = duration
  if (latest.status !== 'done' && latest.status !== 'todo' && latest.status) values.status = latest.status
  return values
}

export function buildTitleIndex(tasks) {
  const groups = new Map()
  for (const t of tasks) {
    const key = titleKey(t.title)
    if (!key) continue
    const list = groups.get(key)
    if (list) list.push(t)
    else groups.set(key, [t])
  }
  const index = new Map()
  for (const [key, matches] of groups) index.set(key, { habit: habitFrom(matches), template: templateFrom(matches) })
  return index
}

export function habitFor(tasks, title) {
  const key = titleKey(title)
  return key ? habitFrom(tasks.filter((t) => titleKey(t.title) === key)) : null
}

export function templateFor(tasks, title) {
  const key = titleKey(title)
  return key ? templateFrom(tasks.filter((t) => titleKey(t.title) === key)) : templateFrom(NO_MATCHES)
}
