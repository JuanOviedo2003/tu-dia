import { useEffect, useRef } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { statusMeta, MINUTES_PER_DAY } from '../lib/constants'
import { todayStr } from '../lib/storage'
import { minutesToLabel } from '../lib/time'
import { useIsMobile } from '../hooks/useMediaQuery'
import { Draggable } from './Drag'

const PX_PER_MIN = 2
const BLOCK_H_DESKTOP = 32
const BLOCK_H_MOBILE = 44

// Carriles para evitar solapamiento visual (slot fijo de 30' solo para colision).
function assignLanes(tasks) {
  const SLOT = 30
  const sorted = [...tasks].sort((a, b) => a.startMinutes - b.startMinutes)
  const lanes = []
  const placed = []
  for (const t of sorted) {
    let laneIdx = lanes.findIndex((end) => end <= t.startMinutes)
    if (laneIdx === -1) {
      laneIdx = lanes.length
      lanes.push(t.startMinutes + SLOT)
    } else {
      lanes[laneIdx] = t.startMinutes + SLOT
    }
    placed.push({ task: t, lane: laneIdx })
  }
  return { placed, laneCount: Math.max(1, lanes.length) }
}

export default function DayTimeline({ dayTasks, containerRef, dateStr, isViewer = false }) {
  const { placed, laneCount } = assignLanes(dayTasks)
  const { setNodeRef, isOver } = useDroppable({ id: 'timeline', disabled: isViewer })
  const innerRef = useRef(null)
  const sigRef = useRef('')
  const isMobile = useIsMobile()
  const isToday = dateStr === todayStr()

  const blockH = isMobile ? BLOCK_H_MOBILE : BLOCK_H_DESKTOP

  // Track siempre de dia completo con densidad fija: 24h legibles y
  // scrolleables en cualquier viewport.
  const trackHeight = MINUTES_PER_DAY * PX_PER_MIN

  // Auto-scroll inicial solo cuando cambia la firma dia+viewport, no por
  // ediciones de tareas (borrar/mover la primera no debe jalar la vista).
  useEffect(() => {
    const el = innerRef.current
    if (!el) return
    const sig = `${dateStr ?? ''}|${isMobile ? 'm' : 'd'}`
    if (sigRef.current === sig) return
    sigRef.current = sig
    const target = isToday
      ? new Date().getHours() * 60 + new Date().getMinutes()
      : dayTasks[0]?.startMinutes ?? 0
    el.scrollTop = Math.max(0, target * PX_PER_MIN - 120)
  }, [isMobile, isToday, dayTasks, dateStr])

  const setRefs = (el) => {
    setNodeRef(el)
    innerRef.current = el
    if (containerRef) containerRef.current = el
  }

  const posTop = (mins) => `${mins * PX_PER_MIN}px`

  const hours = []
  for (let m = 0; m < MINUTES_PER_DAY; m += 60) hours.push(m)

  const nowMin = new Date().getHours() * 60 + new Date().getMinutes()
  const showNow = isToday

  return (
    <div className="flex w-full min-h-0 flex-none flex-col border-b border-slate-800 bg-slate-900/40 sm:w-56 sm:shrink-0 sm:border-b-0 sm:border-r max-w-[240px] min-w-[200px]">
      <div className="border-b border-slate-800 px-2 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Linea de tiempo {isViewer && <span className="ml-2 text-sky-300">(solo lectura)</span>}
      </div>
      <div
        ref={setRefs}
        data-range-start={0}
        data-range-end={MINUTES_PER_DAY}
        className={[
          'relative min-h-0 flex-1 overflow-y-auto text-[10px] text-slate-500',
          isOver && !isViewer ? 'ring-2 ring-inset ring-brand' : '',
        ].join(' ')}
      >
        <div className="relative" style={{ height: trackHeight }}>
          {hours.map((h) => (
            <div
              key={h}
              className="absolute left-0 right-0 border-t border-slate-800/60"
              style={{ top: posTop(h) }}
            >
              <span className="absolute -top-1.5 left-1 bg-slate-900/80 px-1 text-xs text-slate-400">
                {String(Math.floor(h / 60)).padStart(2, '0')}:00
              </span>
            </div>
          ))}

          {showNow && (
            <div
              className="absolute left-0 right-0 z-10 border-t-2 border-rose-400"
              style={{ top: posTop(nowMin) }}
            >
              <span className="absolute -top-2 left-1 rounded bg-rose-400 px-1 text-[9px] font-bold text-slate-900">
                ahora
              </span>
            </div>
          )}

          {placed.map(({ task, lane }) => {
            const meta = statusMeta(task.status)
            const laneW = 100 / laneCount
            return (
              <Draggable
                key={task.id}
                id={`tl:${task.id}`}
                data={{ task, from: 'timeline' }}
                disabled={isViewer}
                className="absolute rounded border border-black/10 px-1 py-0.5 text-xs leading-tight"
                style={{
                  top: posTop(task.startMinutes),
                  height: `${blockH}px`,
                  left: `${lane * laneW}%`,
                  width: `${laneW - 1}%`,
                  background: meta.color,
                  color: meta.text,
                }}
              >
                <span className="block truncate font-medium">{task.title}</span>
                <span className="block text-[10px] opacity-80">
                  {minutesToLabel(task.startMinutes)}
                </span>
              </Draggable>
            )
          })}

          {dayTasks.length === 0 && (
            <p className="absolute inset-0 flex items-center justify-center px-2 text-center text-xs text-slate-600">
              {isViewer ? 'Sin tareas' : 'Sin tareas. Arrastra una desde el tablero o la barra lateral.'}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
