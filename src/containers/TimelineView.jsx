import { useCallback, useEffect, useRef } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { assignLanes, tasksForDay } from '../lib/agenda'
import { MINUTES_PER_DAY, statusMeta } from '../lib/constants'
import { todayStr } from '../lib/storage'
import { minutesToLabel } from '../lib/time'
import TimelineBlockView from '../components/TimelineBlockView'
import TimelineTrack from '../components/TimelineTrack'
import { Draggable } from './Drag'

const PX_PER_MIN = 2
const BLOCK_HEIGHT = 56
const HOURS = Array.from({ length: 24 }, (_, h) => ({
  label: minutesToLabel(h * 60),
  top: h * 60 * PX_PER_MIN,
}))

export default function TimelineView({ dateStr, tasks, actions, isViewer, timelineRef }) {
  const dayTasks = tasksForDay(tasks, dateStr)
  const { placed, laneCount } = assignLanes(dayTasks)
  const { setNodeRef, isOver } = useDroppable({ id: 'timeline', disabled: isViewer })
  const scrollRef = useRef(null)
  const signature = useRef('')
  const isToday = dateStr === todayStr()
  const now = new Date()
  const nowMinutes = now.getHours() * 60 + now.getMinutes()

  const setRefs = useCallback(
    (el) => {
      setNodeRef(el)
      scrollRef.current = el
      if (timelineRef) timelineRef.current = el
    },
    [setNodeRef, timelineRef],
  )

  useEffect(() => {
    const el = scrollRef.current
    if (!el || signature.current === dateStr) return
    signature.current = dateStr
    const target = isToday ? nowMinutes : dayTasks[0]?.startMinutes ?? 0
    el.scrollTop = Math.max(0, target * PX_PER_MIN - 120)
  }, [dateStr, isToday, nowMinutes, dayTasks])

  return (
    <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-4 md:px-5">
      <TimelineTrack
        scrollRef={setRefs}
        height={MINUTES_PER_DAY * PX_PER_MIN}
        isOver={isOver && !isViewer}
        hours={HOURS}
        nowTop={isToday ? nowMinutes * PX_PER_MIN : null}
        empty={dayTasks.length === 0 ? (isViewer ? 'Sin tareas' : 'Sin tareas este día. Arrastra una desde Sin programar.') : null}
      >
        {placed.map(({ task, lane }) => {
          const width = 100 / laneCount
          return (
            <Draggable
              key={task.id}
              id={`tl:${task.id}`}
              data={{ task, from: 'timeline' }}
              disabled={isViewer}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && event.target === event.currentTarget) {
                  event.preventDefault()
                  actions.open(task)
                }
              }}
              className="absolute"
              style={{ top: task.startMinutes * PX_PER_MIN, height: BLOCK_HEIGHT, left: `${lane * width}%`, width: `${width - 1}%` }}
            >
              <TimelineBlockView
                title={task.title}
                timeLabel={minutesToLabel(task.startMinutes)}
                status={statusMeta(task.status)}
                done={task.status === 'done'}
                onClick={isViewer ? undefined : () => actions.open(task)}
              />
            </Draggable>
          )
        })}
      </TimelineTrack>
    </div>
  )
}
