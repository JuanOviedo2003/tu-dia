import { cx } from '../lib/cx'
import DayBadge, { DayDot } from './ui/DayBadge'
import ProgressBar from './ui/ProgressBar'

export default function DayRowView({ weekdayLabel, dayNumber, label, isToday, isOver, progress, onSelect }) {
  const { tone } = progress
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onSelect}
      className={cx(
        'transition-ui flex min-h-14 w-full items-center gap-3 border-b border-line px-4 text-left',
        isOver
          ? 'bg-accent-subtle'
          : isToday
            ? 'bg-accent-subtle/60'
            : tone === 'danger'
              ? 'bg-danger-bg shadow-[inset_4px_0_0_var(--color-danger)]'
              : 'bg-transparent',
      )}
    >
      <span className="flex w-10 shrink-0 flex-col items-center">
        <span className={cx('text-caption font-medium', isToday ? 'text-accent' : 'text-t2')}>{weekdayLabel}</span>
        <span
          className={cx(
            'relative flex h-8 w-8 items-center justify-center rounded-full text-body font-semibold',
            isToday ? 'bg-accent text-on-accent' : 'text-t1',
          )}
        >
          {dayNumber}
          <DayDot tone={tone} className="absolute -right-1.5 -top-1" />
        </span>
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        {progress.total > 0 && <ProgressBar percent={progress.percent} tone={tone} className="w-full" />}
        <DayBadge tone={tone} done={progress.done} total={progress.total} className="self-start text-small" />
      </span>
    </button>
  )
}
