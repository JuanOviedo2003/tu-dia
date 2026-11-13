import { dayProgress, dayStatusText, formatDayLong } from '../lib/agenda'

export function useDaySummary(dayStr, dayTasks, today) {
  const progress = dayProgress(dayTasks, dayStr, today)
  return {
    progress,
    label: `${formatDayLong(dayStr)}, ${dayStatusText(progress).toLowerCase()}`,
  }
}
