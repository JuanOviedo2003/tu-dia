import { useRef, useState } from 'react'
import {
  KeyboardSensor,
  MeasuringStrategy,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { MINUTES_PER_DAY } from '../lib/constants'
import { clampMinutes } from '../lib/time'

const MOUSE_OPTIONS = { activationConstraint: { distance: 8 } }
const TOUCH_OPTIONS = { activationConstraint: { delay: 250, tolerance: 8 } }
const KEYBOARD_OPTIONS = { keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space', 'Enter'] } }
const MEASURING = { droppable: { strategy: MeasuringStrategy.Always } }

function collisionDetection(args) {
  if (args.active?.data?.current?.from === 'timeline') {
    const containers = args.droppableContainers.filter((c) => c.id === 'timeline')
    return pointerWithin({ ...args, droppableContainers: containers })
  }
  const underPointer = pointerWithin(args)
  return underPointer.length > 0 ? underPointer : rectIntersection(args)
}

function minutesFromDrop(el, translated) {
  const trackRect = el.getBoundingClientRect()
  const yWithin = translated.top - trackRect.top + el.scrollTop
  return clampMinutes((yWithin / el.scrollHeight) * MINUTES_PER_DAY)
}

export function useAgendaDnd({ isViewer, selectedDay, scheduleOnDrop, api }) {
  const [activeDrag, setActiveDrag] = useState(null)
  const timelineRef = useRef(null)

  const sensors = useSensors(
    useSensor(MouseSensor, MOUSE_OPTIONS),
    useSensor(TouchSensor, TOUCH_OPTIONS),
    useSensor(KeyboardSensor, KEYBOARD_OPTIONS),
  )

  const onDragStart = (event) => {
    if (isViewer) return
    const task = event.active.data.current?.task ?? null
    if (task) setActiveDrag({ id: String(event.active.id), task })
  }

  const onDragEnd = ({ active, over }) => {
    setActiveDrag(null)
    if (isViewer || !over) return
    const task = active.data.current?.task
    if (!task) return
    const overId = String(over.id)
    if (active.data.current?.from === 'timeline' && overId !== 'timeline') return

    if (overId.startsWith('col:')) {
      const status = overId.slice(4)
      if (scheduleOnDrop && task.day !== selectedDay) api.updateTask(task.id, { status, day: selectedDay })
      else if (status !== task.status) api.setStatus(task.id, status)
    } else if (overId === 'backlog') {
      api.moveTaskDay(task.id, null)
    } else if (overId.startsWith('day:')) {
      api.moveTaskDay(task.id, overId.slice(4))
    } else if (overId === 'timeline') {
      const el = timelineRef.current
      const translated = active.rect.current?.translated
      if (!el || !translated) return
      const patch = { startMinutes: minutesFromDrop(el, translated) }
      if (task.day !== selectedDay) patch.day = selectedDay
      api.updateTask(task.id, patch)
    }
  }

  return {
    activeDrag,
    timelineRef,
    dndProps: {
      sensors,
      collisionDetection,
      measuring: MEASURING,
      onDragStart,
      onDragEnd,
      onDragCancel: () => setActiveDrag(null),
    },
  }
}
