import { useDaySummary } from '../hooks/useDaySummary'
import { weekdayShort } from '../lib/time'
import DayRowView from '../components/DayRowView'
import { Droppable } from './Drag'

export default function DayRow({ dayStr, dayNumber, weekday, dayTasks, today, isToday, isViewer, onSelect }) {
  const { progress, label } = useDaySummary(dayStr, dayTasks, today)

  return (
    <Droppable id={`day:${dayStr}`} disabled={isViewer}>
      {({ isOver }) => (
        <DayRowView
          weekdayLabel={weekdayShort(weekday)}
          dayNumber={dayNumber}
          label={label}
          isToday={isToday}
          isOver={isOver}
          progress={progress}
          onSelect={() => onSelect(dayStr)}
        />
      )}
    </Droppable>
  )
}
