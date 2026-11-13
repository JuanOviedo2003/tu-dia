import { cx } from '../../lib/cx'

export const TONE_FILL = { todo: 'bg-todo', doing: 'bg-doing', done: 'bg-done', danger: 'bg-danger' }

export default function ProgressBar({ percent, tone, className, label }) {
  return (
    <div
      {...(label
        ? { role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': percent, 'aria-label': label }
        : { 'aria-hidden': true })}
      className={cx('h-1.5 overflow-hidden rounded-[3px] bg-s3', className)}
    >
      <div className={cx('h-full rounded-[3px]', TONE_FILL[tone ?? 'done'])} style={{ width: `${percent}%` }} />
    </div>
  )
}
