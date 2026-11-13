import { useState } from 'react'
import {
  addDays,
  addMonths,
  capitalize,
  formatDayLong,
  formatDayMonth,
  formatMonthTitle,
  weekdayName,
} from '../lib/agenda'
import { todayStr } from '../lib/storage'

export function useAgendaNav() {
  const [view, setView] = useState('day')
  const [selectedDay, setSelectedDay] = useState(todayStr)

  const isMonth = view === 'month'
  const isToday = selectedDay === todayStr()

  const step = (delta) => setSelectedDay((day) => (isMonth ? addMonths(day, delta) : addDays(day, delta)))

  const selectDay = (dateStr) => {
    setSelectedDay(dateStr)
    setView('day')
  }

  return {
    view,
    setView,
    selectedDay,
    selectDay,
    goPrev: () => step(-1),
    goNext: () => step(1),
    goToday: () => setSelectedDay(todayStr()),
    prevLabel: isMonth ? 'Mes anterior' : 'Día anterior',
    nextLabel: isMonth ? 'Mes siguiente' : 'Día siguiente',
    titleLong: isMonth ? formatMonthTitle(selectedDay) : capitalize(formatDayLong(selectedDay)),
    titleShort: isMonth ? formatMonthTitle(selectedDay) : formatDayMonth(selectedDay),
    eyebrow: isMonth ? null : `${isToday ? 'Hoy · ' : ''}${weekdayName(selectedDay)}`,
  }
}
