import { statusByShortcut } from '../lib/constants'
import { isOverdue } from '../lib/agenda'
import { minutesToLabel } from '../lib/time'
import TaskCardView from '../components/TaskCardView'
import { Draggable } from './Drag'

function refocusTask(id, source) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => document.querySelector(`[data-task-id="${id}"][data-source="${source}"]`)?.focus())
  })
}

export default function TaskCard({ task, source = 'col', actions, isViewer = false, showTime = true, showStatus = false }) {
  const onKeyDown = (event) => {
    if (isViewer || event.target !== event.currentTarget) return
    if (event.key === 'Enter') {
      event.preventDefault()
      actions.open(task)
      return
    }
    const status = statusByShortcut(event.key)
    if (status && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault()
      if (status.key !== task.status) {
        actions.setStatus(task.id, status.key)
        refocusTask(task.id, source)
      }
    }
  }

  return (
    <Draggable id={`${source}:${task.id}`} data={{ task }} disabled={isViewer} onKeyDown={onKeyDown} className="rounded-md" data-task-id={task.id} data-source={source}>
      <TaskCardView
        task={task}
        timeLabel={showTime && task.day ? minutesToLabel(task.startMinutes) : null}
        overdue={isOverdue(task)}
        showStatus={showStatus}
        isViewer={isViewer}
        onClick={isViewer ? undefined : () => actions.open(task)}
      />
    </Draggable>
  )
}
