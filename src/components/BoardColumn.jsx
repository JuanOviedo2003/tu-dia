import { useDroppable } from '@dnd-kit/core'
import { statusMeta } from '../lib/constants'
import TaskCard from './TaskCard'

// Columna del tablero. Droppable (id "col:<status>"): soltar cambia el estado.
// `active` = vista de una sola columna (móvil, tab seleccionada).
export default function BoardColumn({ statusKey, tasks, onEdit, onDelete, active = false, isViewer = false }) {
  const meta = statusMeta(statusKey)
  const { setNodeRef, isOver } = useDroppable({ id: `col:${statusKey}`, disabled: isViewer })

  return (
    <div
      ref={setNodeRef}
      className={[
        'flex flex-col rounded-lg border bg-slate-900/50',
        isOver && !isViewer ? 'border-brand' : 'border-brand-2/30',
        active ? 'min-h-0 flex-1' : 'flex-1 min-w-[150px] max-w-[200px] shrink-0',
      ].join(' ')}
    >
      <div className="flex items-center gap-2 border-b border-slate-800 px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: meta.color }} />
        <span className="text-sm font-semibold text-slate-200">{meta.label}</span>
        <span className="ml-auto text-xs text-slate-500">{tasks.length}</span>
      </div>
      <div className="min-h-[120px] flex-1 space-y-2 overflow-auto p-2">
        {tasks.map((t) => (
          <TaskCard key={t.id} task={t} source="col" onEdit={onEdit} onDelete={onDelete} isViewer={isViewer} />
        ))}
        {tasks.length === 0 && (
          <p className="py-4 text-center text-xs text-slate-700">
            {isViewer ? 'Sin tareas' : 'Suelta tareas aquí'}
          </p>
        )}
      </div>
    </div>
  )
}
