import { cx } from '../lib/cx'
import StatusBadge from './ui/StatusBadge'

const REPEAT_LABEL = { week: 'Recurrente · semanal', month: 'Recurrente · mensual' }

function borderClass(dragging, done) {
  if (dragging) return 'border-accent'
  return done ? 'border-s3' : 'border-line'
}

export default function TaskCardView({
  task,
  timeLabel,
  overdue = false,
  showStatus = false,
  isViewer = false,
  dragging = false,
  isMobile = false,
  onClick,
  className,
}) {
  const done = task.status === 'done'
  const meta = [task.description, task.groupId ? REPEAT_LABEL[task.pattern] ?? 'Recurrente' : null].filter(Boolean)

  return (
    <div
      onClick={onClick}
      className={cx(
        'transition-ui flex items-start gap-3 rounded-md border px-3.5 py-3',
        isMobile ? 'min-h-[68px]' : 'min-h-16',
        borderClass(dragging, done),
        done ? 'bg-s1' : 'bg-s2',
        dragging && cx('cursor-grabbing', isMobile ? 'rotate-[-2deg] shadow-drag-mobile' : 'rotate-[-1.5deg] shadow-drag'),
        !dragging && !isViewer && 'hover:border-line-strong',
        className,
      )}
    >
      {timeLabel && (
        <span className={cx('w-11 shrink-0 pt-px text-small font-medium', done ? 'text-t3' : 'text-t2')}>{timeLabel}</span>
      )}
      <div className="min-w-0 flex-1">
        <p
          className={cx(
            'line-clamp-2 break-words font-medium',
            isMobile ? 'text-body-m' : 'text-body',
            done ? 'text-t2 line-through decoration-line-strong' : 'text-t1',
          )}
        >
          {task.title}
        </p>
        {meta.length > 0 && <p className="mt-0.5 truncate text-small font-medium text-t2">{meta.join(' · ')}</p>}
      </div>
      {(overdue || showStatus) && (
        <div className="flex shrink-0 flex-col items-end gap-1">
          {overdue && <StatusBadge overdue />}
          {showStatus && <StatusBadge status={task.status} />}
        </div>
      )}
    </div>
  )
}
