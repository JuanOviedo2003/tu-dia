import TaskBar from './TaskBar'
import { useDroppable } from '@dnd-kit/core'
// Celda de un día (rejilla escritorio). Droppable (id "day:<date>").
// Al hacer clic abre el tablero del día.
export default function DayCell({ dateStr, dayNumber, isToday, isCurrentMonth, isWeekend = false, tasks, onOpenDay, isViewer = false }) {
  const dayTasks = tasks.filter((t) => t.day === dateStr).sort((a, b) => a.startMinutes - b.startMinutes)
  const { setNodeRef, isOver } = useDroppable({ id: `day:${dateStr}`, disabled: isViewer })

  return (
    <div
      ref={setNodeRef}
      onClick={() => onOpenDay(dateStr)}
      className={[
        'relative h-[clamp(5.5rem,min(9vw,10.5vh),40rem)] w-full cursor-pointer select-none p-1 transition-colors',
        isCurrentMonth
          ? (isWeekend ? 'bg-slate-800/40' : 'bg-slate-800/70') + ' hover:bg-slate-700/70'
          : 'bg-slate-900/40 text-slate-600',
        isToday ? 'z-10 ring-2 ring-inset ring-accent' : '',
        isOver && !isViewer ? 'z-10 ring-2 ring-inset ring-brand' : '',
      ].join(' ')}
    >
      <div className="flex items-center justify-between">
        <span className={['text-[length:clamp(0.75rem,0.9vw,1.3rem)] font-bold', isToday ? 'text-accent' : 'text-slate-200'].join(' ')}>
          {dayNumber}
        </span>
        {dayTasks.length > 0 && <span className="text-[length:clamp(8px,0.7vw,12px)] text-slate-400">{dayTasks.length}</span>}
      </div>
      <div className="relative mt-0.5 h-[calc(100%-1.5rem)]">
        {dayTasks.map((t) => (
          <div key={t.id} onClick={(e) => e.stopPropagation()}>
            <TaskBar task={t} compact isViewer={isViewer} />
          </div>
        ))}
      </div>
    </div>
  )
}
