import { useState } from 'react'
import { dayProgress, tasksByStatus, tasksForDay } from '../lib/agenda'
import { useSwipe } from '../hooks/useSwipe'
import DayBoardDesktop from '../components/DayBoardDesktop'
import DayBoardMobile from '../components/DayBoardMobile'
import StatusTabs from '../components/StatusTabs'
import BoardColumn from './BoardColumn'
import DropBar from './DropBar'
import TaskCard from './TaskCard'

export default function DayView({ dateStr, tasks, actions, isViewer, isMobile, dragging, onNewTask, onPrev, onNext }) {
  const [tab, setTab] = useState('todo')
  const dayTasks = tasksForDay(tasks, dateStr)
  const groups = tasksByStatus(dayTasks)
  const swipeHandlers = useSwipe({ onLeft: onNext, onRight: onPrev, disabled: dragging })

  if (isMobile) {
    const active = groups.find((g) => g.status.key === tab)
    return (
      <DayBoardMobile
        swipeHandlers={swipeHandlers}
        list={
          active.tasks.length > 0 ? (
            active.tasks.map((task) => <TaskCard key={task.id} task={task} source="col" actions={actions} isViewer={isViewer} />)
          ) : (
            <p className="py-8 text-center text-body font-medium text-t3">Sin tareas en {active.status.label}</p>
          )
        }
        bottom={dragging ? <DropBar /> : <StatusTabs groups={groups} value={tab} onChange={setTab} />}
      />
    )
  }

  return (
    <DayBoardDesktop
      progress={dayProgress(dayTasks, dateStr)}
      columns={groups.map(({ status, tasks: columnTasks }) => (
        <BoardColumn key={status.key} status={status} tasks={columnTasks} actions={actions} isViewer={isViewer} onAdd={(key) => onNewTask({ day: dateStr, status: key })} />
      ))}
    />
  )
}
