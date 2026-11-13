import { dayStatusText } from '../../lib/agenda'
import { cx } from '../../lib/cx'
import { TONE_FILL } from './ProgressBar'

const CHIP = {
  todo: 'bg-todo-bg text-todo',
  doing: 'bg-doing-bg text-doing',
  done: 'bg-done-bg text-done',
  danger: 'border border-danger-border bg-danger-bg text-danger',
}

export function DayDot({ tone, className }) {
  if (!tone) return null
  return <span aria-hidden="true" className={cx('inline-block size-2 shrink-0 rounded-full', TONE_FILL[tone], className)} />
}

export default function DayBadge({ tone, done, total, className }) {
  const text = dayStatusText({ done, total, tone })
  if (total === 0) return <span className={cx('font-medium text-t2', className)}>{text}</span>
  return (
    <span className={cx('inline-flex items-center rounded-sm px-2 py-0.5 font-semibold', CHIP[tone], className)}>
      {tone === 'done' && <span aria-hidden="true">✓ </span>}
      {text}
    </span>
  )
}
