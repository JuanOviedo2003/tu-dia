import { statusMeta } from '../lib/constants'
import { minutesToLabel } from '../lib/time'
import { Draggable } from './Drag'

// Tarjeta de tarea reutilizable (sidebar y tablero). Arrastrable (touch/mouse).
// Toca para editar; botón para eliminar.
export default function TaskCard({ task, onEdit, onDelete, showTime = true, source = 'col', isViewer = false }) {
  const meta = statusMeta(task.status)
  return (
    <Draggable id={`${source}:${task.id}`} data={{ task }} disabled={isViewer} className="group">
      <div
        onClick={() => !isViewer && onEdit?.(task)}
        className={[
          'relative rounded-md border border-slate-700 bg-slate-800/80 p-2 text-xs shadow-sm',
          isViewer ? 'cursor-default' : 'cursor-pointer hover:border-slate-500',
        ].join(' ')}
      >
        <div className={['flex items-start gap-2', isViewer ? 'pr-2' : 'pr-10'].join(' ')}>
          <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: meta.color }} />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-slate-100 truncate">{task.title}</p>
            {task.description && <p className="text-slate-400 truncate">{task.description}</p>}
            {showTime && task.day && (
              <p className="mt-0.5 text-[10px] text-slate-500">{minutesToLabel(task.startMinutes)}</p>
            )}
          </div>
        </div>
        {!isViewer && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete?.(task.id)
            }}
            className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-md text-slate-400 hover:bg-rose-500/10 hover:text-rose-400"
            title="Eliminar"
          >
            ✕
          </button>
        )}
      </div>
    </Draggable>
  )
}
