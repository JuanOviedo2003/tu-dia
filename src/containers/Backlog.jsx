import { unscheduledTasks } from '../lib/agenda'
import { cx } from '../lib/cx'
import { useEscapeKey } from '../hooks/useEscapeKey'
import BacklogPanel from '../components/BacklogPanel'
import { Droppable } from './Drag'
import TaskCard from './TaskCard'

const OVER_STYLE =
  "data-[over='1']:bg-accent-subtle data-[over='1']:ring-2 data-[over='1']:ring-inset data-[over='1']:ring-accent"

const ASIDE_CLASS = 'flex min-w-0 max-w-full flex-col gap-3 border-r border-s3 bg-s1 p-4 [flex:1_1_260px] min-[820px]:max-w-[320px]'
const DRAWER_CLASS = 'rise-in fixed inset-y-0 left-0 z-50 flex w-[86%] max-w-sm flex-col gap-3 bg-s1 p-4 shadow-menu'

export default function Backlog({ tasks, actions, isViewer, onNewTask, variant = 'aside', open = false, dragging = false, onClose }) {
  const drawer = variant === 'drawer'
  useEscapeKey(drawer && open, onClose)

  if (drawer && !open) return null

  const items = unscheduledTasks(tasks)

  return (
    <>
      {drawer && <div className={cx('fade-in fixed inset-0 z-40 bg-t1/40', dragging && 'opacity-0')} onClick={onClose} aria-hidden="true" />}
      <Droppable
        id="backlog"
        as="aside"
        aria-label="Sin programar"
        {...(drawer ? { role: 'dialog', 'aria-modal': 'true' } : {})}
        disabled={isViewer || (drawer && dragging)}
        className={cx(drawer ? DRAWER_CLASS : ASIDE_CLASS, drawer && dragging && 'opacity-0', OVER_STYLE)}
      >
        {({ isOver }) => (
          <BacklogPanel
            count={items.length}
            isOver={isOver}
            isViewer={isViewer}
            onNew={onNewTask}
            onClose={onClose}
            variant={variant}
          >
            {items.map((task) => (
              <TaskCard key={task.id} task={task} source="side" actions={actions} isViewer={isViewer} showTime={false} showStatus />
            ))}
          </BacklogPanel>
        )}
      </Droppable>
    </>
  )
}
