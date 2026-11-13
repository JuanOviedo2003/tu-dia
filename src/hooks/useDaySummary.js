import { dayProgress, formatDayLong, progressTone } from '../lib/agenda'

export function useDaySummary(dayStr, dayTasks) {
  const progress = dayProgress(dayTasks)
  return {
    progress,
    tone: progressTone(progress.percent),
    label: `${formatDayLong(dayStr)}, ${progress.done} de ${progress.total} hechas`,
  }
}
