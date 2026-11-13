import { useDaySummary } from '../hooks/useDaySummary'
import DayCellView from '../components/DayCellView'
import { Droppable } from './Drag'

export default function DayCell({ dayStr, dayNumber, dayTasks, isToday, isViewer, onSelect }) {
  const { progress, tone, label } = useDaySummary(dayStr, dayTasks)

  return (
    <Droppable id={`day:${dayStr}`} disabled={isViewer} className="flex min-w-0">
      {({ isOver }) => (
        <DayCellView
          dayNumber={dayNumber}
          label={label}
          isToday={isToday}
          isOver={isOver}
          progress={progress}
          tone={tone}
          onSelect={() => onSelect(dayStr)}
        />
      )}
    </Droppable>
  )
}
