import { cx } from '../lib/cx'
import ProgressBar from './ui/ProgressBar'

export default function DayCellView({ dayNumber, label, isToday, isOver, progress, tone, onSelect }) {
  return (
    <div
      className={cx(
        'transition-ui min-h-24 flex-1 rounded-md border p-2.5',
        isToday ? 'border-accent bg-accent-subtle' : 'border-line bg-s1 hover:bg-s3',
        isOver && 'bg-accent-subtle ring-2 ring-accent',
      )}
    >
      <button
        type="button"
        aria-label={label}
        onClick={onSelect}
        className="flex h-full min-h-0 w-full min-w-0 flex-col gap-2 rounded-sm text-left"
      >
        <span className={cx('text-small', isToday ? 'font-semibold text-accent' : 'font-medium text-t2')}>
          {dayNumber}
          {isToday && ' · Hoy'}
        </span>
        <ProgressBar percent={progress.percent} tone={tone} className="w-full" />
        <span className="text-caption font-medium text-t2">
          {progress.total === 0 ? 'Sin tareas' : `${progress.done} de ${progress.total}`}
        </span>
      </button>
    </div>
  )
}
