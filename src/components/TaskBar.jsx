import { statusMeta } from '../lib/constants'
import { minutesToLabel, topPercent } from '../lib/time'
import { Draggable } from './Drag'

// Barra de tiempo dentro de una celda del calendario.
export default function TaskBar({ task, compact = false, isViewer = false }) {
  const meta = statusMeta(task.status)
  return (
    <Draggable
      id={`cal:${task.id}`}
      data={{ task }}
      disabled={isViewer}
      className="absolute left-0.5 right-0.5"
      style={{
        top: `${topPercent(task.startMinutes)}%`,
        height: 'clamp(14px,1.15vw,30px)',
        background: meta.color,
        color: meta.text,
        opacity: 0.95,
      }}
    >
      <div
        className="truncate rounded px-1 text-[length:clamp(10px,0.7vw,16px)] leading-tight border border-black/10"
        title={`${task.title} · ${minutesToLabel(task.startMinutes)}`}
      >
        {task.title}
      </div>
    </Draggable>
  )
}
