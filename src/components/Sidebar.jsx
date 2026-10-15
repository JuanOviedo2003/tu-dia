import TaskCard from './TaskCard'
import { useDroppable } from '@dnd-kit/core'

// Panel lateral: tareas sin día asignado (backlog). Droppable (id "backlog")
// para recibir tareas y desprogramarlas. Es un menú desplegable (drawer)
// que se abre con el botón ☰ y se cierra con la ✕ o tocando fuera.
export default function Sidebar({ tasks, onNewTask, onEdit, onDelete, open, onClose, isViewer = false }) {
  const unscheduled = tasks.filter((t) => !t.day)
  const { setNodeRef, isOver } = useDroppable({ id: 'backlog', disabled: isViewer })

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/50"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        ref={setNodeRef}
        className={[
          'fixed inset-y-0 left-0 z-40 w-64 flex-col border-r border-slate-800 bg-slate-900/95 backdrop-blur transition-transform duration-200',
          open ? 'translate-x-0' : '-translate-x-full',
          'flex',
          isOver && !isViewer ? 'ring-2 ring-brand' : '',
        ].join(' ')}
      >
        <div className="flex items-center justify-between border-b border-slate-800 p-3">
          {!isViewer ? (
            <button
              onClick={() => onNewTask()}
              className="flex-1 rounded-md bg-brand py-2 text-sm font-bold text-slate-900 transition-colors hover:bg-brand/90"
            >
              + Nueva tarea
            </button>
          ) : (
            <div className="flex-1 rounded-md bg-slate-800 py-2 text-center text-sm font-bold text-slate-500">
              Solo lectura
            </div>
          )}
          <button
            onClick={onClose}
            className="ml-2 rounded-md border border-brand-2/40 px-2 py-1 text-brand-2 hover:bg-brand-2/10"
            title="Cerrar"
          >
            ✕
          </button>
        </div>
      <div className="border-b border-slate-800 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Sin programar ({unscheduled.length})
      </div>
      <div className="flex-1 space-y-2 overflow-auto px-3 pb-3">
        {unscheduled.length === 0 && (
          <p className="text-xs text-slate-600">
            {isViewer ? 'Sin tareas' : 'Arrastra tareas aquí para desprogramarlas.'}
          </p>
        )}
        {unscheduled.map((t) => (
          <TaskCard key={t.id} task={t} source="side" onEdit={onEdit} onDelete={onDelete} showTime={false} isViewer={isViewer} />
        ))}
      </div>
      </aside>
    </>
  )
}
