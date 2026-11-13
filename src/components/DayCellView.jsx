import { cx } from '../lib/cx'
import DayBadge, { DayDot } from './ui/DayBadge'
import ProgressBar from './ui/ProgressBar'

export default function DayCellView({ dayNumber, label, isToday, isOver, progress, onSelect }) {
  const { tone } = progress
  return (
    <div
      className={cx(
        'transition-ui min-h-24 flex-1 rounded-md border p-2.5',
        isOver
          ? 'border-accent bg-accent-subtle ring-2 ring-accent'
          : isToday
            ? 'border-accent bg-accent-subtle'
            : tone === 'danger'
              ? 'border-danger bg-danger-bg hover:bg-danger-border'
              : 'border-line bg-s1 hover:bg-s3',
      )}
    >
      <button
        type="button"
        aria-label={label}
        onClick={onSelect}
        className="flex h-full min-h-0 w-full min-w-0 flex-col gap-2 rounded-sm text-left"
      >
        <span
          className={cx('flex items-center gap-1.5 text-small', isToday ? 'font-semibold text-accent' : 'font-medium text-t2')}
        >
          {dayNumber}
          {isToday && ' · Hoy'}
          <DayDot tone={tone} />
        </span>
        <ProgressBar percent={progress.percent} tone={tone} className="w-full" />
        <DayBadge tone={tone} done={progress.done} total={progress.total} className="max-w-full self-start text-caption" />
      </button>
    </div>
  )
}
