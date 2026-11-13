import { useMemo } from 'react'
import { groupByDay, monthGrid } from '../lib/agenda'
import { todayStr } from '../lib/storage'
import MonthGrid from '../components/MonthGrid'
import DayCell from './DayCell'
import DayRow from './DayRow'

const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const NO_TASKS = []

export default function MonthView({ dateStr, tasks, isMobile, isViewer, onSelectDay }) {
  const { leadingBlanks, days } = monthGrid(dateStr)
  const byDay = useMemo(() => groupByDay(tasks), [tasks])
  const today = todayStr()
  const common = (day) => ({
    dayStr: day.dateStr,
    dayNumber: day.dayNumber,
    dayTasks: byDay.get(day.dateStr) ?? NO_TASKS,
    today,
    isToday: day.dateStr === today,
    isViewer,
    onSelect: onSelectDay,
  })

  if (isMobile) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto">
        {days.map((day) => (
          <DayRow key={day.dateStr} {...common(day)} weekday={day.weekday} />
        ))}
      </div>
    )
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <MonthGrid leadingBlanks={leadingBlanks} weekdayLabels={WEEKDAY_LABELS}>
        {days.map((day) => (
          <DayCell key={day.dateStr} {...common(day)} />
        ))}
      </MonthGrid>
    </div>
  )
}
