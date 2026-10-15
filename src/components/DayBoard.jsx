import { useEffect, useState } from 'react'
import { fromDateStr } from '../lib/storage'
import { STATUSES } from '../lib/constants'
import DayTimeline from './DayTimeline'
import BoardColumn from './BoardColumn'

function useIsMobile() {
  const [mobile, setMobile] = useState(
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 767px)').matches : false,
  )
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const onChange = () => setMobile(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return mobile
}

// Modal del día. Escritorio: línea de tiempo + 4 columnas. Móvil: una sola
// columna a la vez con tabs (un único scroll principal, sin scroll horizontal).
export default function DayBoard({ dateStr, tasks, onClose, onNewTask, onEdit, onDelete, timelineRef, isViewer = false }) {
  const [tab, setTab] = useState('timeline')
  const isMobile = useIsMobile()
  if (!dateStr) return null

  const date = fromDateStr(dateStr)
  if (!date) return null
  const dayTasks = tasks.filter((t) => t.day === dateStr)
  const title = date.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const columnsView = (
    <div className="flex flex-1 gap-3 overflow-x-auto p-3">
      {STATUSES.map((s) => (
        <BoardColumn
          key={s.key}
          statusKey={s.key}
          tasks={dayTasks.filter((t) => t.status === s.key)}
          onEdit={onEdit}
          onDelete={onDelete}
          isViewer={isViewer}
        />
      ))}
    </div>
  )

  const mobileView =
    tab === 'timeline' ? (
      <DayTimeline dayTasks={dayTasks} containerRef={timelineRef} dateStr={dateStr} isViewer={isViewer} />
    ) : (
      <BoardColumn
        statusKey={tab}
        tasks={dayTasks.filter((t) => t.status === tab)}
        onEdit={onEdit}
        onDelete={onDelete}
        active
        isViewer={isViewer}
      />
    )

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-slate-950">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-900/80 px-4 py-3">
        <div className="flex items-baseline gap-3">
          <h2 className="text-base font-bold capitalize text-slate-100 sm:text-lg">{title}</h2>
          <span className="text-xs text-slate-400">{dayTasks.length} tareas</span>
          {isViewer && <span className="ml-2 rounded bg-sky-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-sky-300">Solo lectura</span>}
        </div>
        <div className="flex items-center gap-2">
          {!isViewer && (
            <button
              onClick={() => onNewTask(dateStr)}
              className="rounded-md bg-brand px-3 py-1.5 text-sm font-bold text-slate-900 hover:bg-brand/90"
            >
              + Nueva tarea
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded-md border border-brand-2/40 px-3 py-1.5 text-sm text-brand-2 hover:bg-brand-2/10"
          >
            Cerrar
          </button>
        </div>
      </div>

      {isMobile && (
        <nav className="flex gap-1 overflow-x-auto border-b border-slate-800 bg-slate-900/60 px-2 py-2">
          <TabButton label="Línea" active={tab === 'timeline'} onClick={() => setTab('timeline')} />
          {STATUSES.map((s) => (
            <TabButton
              key={s.key}
              label={s.label}
              active={tab === s.key}
              color={s.color}
              onClick={() => setTab(s.key)}
            />
          ))}
        </nav>
      )}

      <div className="flex min-h-0 flex-1 flex-col">
        {isMobile ? (
          mobileView
        ) : (
          <div className="flex flex-1 overflow-hidden">
            <DayTimeline dayTasks={dayTasks} containerRef={timelineRef} dateStr={dateStr} isViewer={isViewer} />
            {columnsView}
          </div>
        )}
      </div>
    </div>
  )
}

function TabButton({ label, active, color, onClick }) {
  return (
    <button
      onClick={onClick}
      className={[
        'flex h-11 shrink-0 items-center gap-1.5 rounded-md px-3 text-sm font-semibold transition-colors',
        active ? 'bg-brand text-slate-900' : 'bg-slate-800 text-slate-300 hover:bg-slate-700',
      ].join(' ')}
    >
      {color && <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />}
      {label}
    </button>
  )
}
