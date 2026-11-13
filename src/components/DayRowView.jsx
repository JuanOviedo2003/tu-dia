import { cx } from '../lib/cx'
import ProgressBar from './ui/ProgressBar'

export default function DayRowView({ weekdayLabel, dayNumber, label, isToday, isOver, progress, tone, onSelect }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onSelect}
      className={cx(
        'transition-ui flex min-h-14 w-full items-center gap-3 border-b border-line px-4 text-left',
        isOver ? 'bg-accent-subtle' : isToday ? 'bg-accent-subtle/60' : 'bg-transparent',
      )}
    >
      <span className="flex w-10 shrink-0 flex-col items-center">
        <span className={cx('text-caption font-medium', isToday ? 'text-accent' : 'text-t2')}>{weekdayLabel}</span>
        <span
          className={cx(
            'flex h-8 w-8 items-center justify-center rounded-full text-body font-semibold',
            isToday ? 'bg-accent text-on-accent' : 'text-t1',
          )}
        >
          {dayNumber}
        </span>
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <ProgressBar percent={progress.percent} tone={tone} className="w-full" />
        <span className="text-small font-medium text-t2">
          {progress.total === 0 ? 'Sin tareas' : `${progress.done} de ${progress.total} hechas`}
        </span>
      </span>
    </button>
  )
}
