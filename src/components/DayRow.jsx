import { useDroppable } from '@dnd-kit/core'
import { statusMeta } from '../lib/constants'
import { minutesToLabel, weekdayShort } from '../lib/time'
import { Draggable } from './Drag'

// Fila de día en lista vertical móvil (estilo Google Calendar).
// Columna delgada con día de semana + número; a la derecha tareas
// ordenadas por hora (título arriba, hora debajo). Droppable por fila.
export default function DayRow({ dateStr, dayNumber, weekday, isToday, tasks, onOpenDay, isViewer = false }) {
  const dayTasks = tasks.filter((t) => t.day === dateStr).sort((a, b) => a.startMinutes - b.startMinutes)
  const { setNodeRef, isOver } = useDroppable({ id: `day:${dateStr}`, disabled: isViewer })

  return (
    <div
      ref={setNodeRef}
      onClick={() => onOpenDay(dateStr)}
      className={[
        'flex cursor-pointer select-none gap-3 border-b border-slate-800 px-1 py-2 transition-colors',
        isOver && !isViewer ? 'bg-brand/10' : '',
      ].join(' ')}
    >
      {/* Columna delgada: letra día encima del número */}
      <div className="flex w-9 shrink-0 flex-col items-center pt-0.5">
        <span className={['text-[10px] font-bold text-slate-400', isToday ? 'text-accent' : ''].join(' ')}>
          {weekdayShort(weekday)}
        </span>
        <span
          className={[
            'flex h-7 w-7 items-center justify-center rounded-full text-[length:clamp(0.7rem,0.8vw,1.2rem)] font-semibold',
            isToday ? 'bg-accent text-slate-900' : 'text-slate-200',
          ].join(' ')}
        >
          {dayNumber}
        </span>
      </div>
      {/* Espacio del día: tareas ordenadas por hora */}
      <div className="flex min-h-[2.5rem] flex-1 flex-col gap-1">
        {dayTasks.length === 0 && <span className="text-[length:clamp(0.65rem,0.7vw,0.9rem)] text-slate-700">Sin tareas</span>}
        {dayTasks.map((t) => {
          const meta = statusMeta(t.status)
          return (
            <div key={t.id} onClick={(e) => e.stopPropagation()}>
              <Draggable
                id={`row:${t.id}`}
                data={{ task: t }}
                disabled={isViewer}
                className="rounded-md border-l-2 px-2 py-1"
                style={{ borderColor: meta.color, background: `${meta.color}1a` }}
              >
                <div className="truncate text-[length:clamp(0.65rem,0.7vw,0.9rem)] font-medium" style={{ color: meta.color }} title={t.title}>
                  {t.title}
                </div>
                <div className="text-[length:clamp(7px,0.6vw,10px)] text-slate-400">{minutesToLabel(t.startMinutes)}</div>
              </Draggable>
            </div>
          )
        })}
      </div>
    </div>
  )
}
