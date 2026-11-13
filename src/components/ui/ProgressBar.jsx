import { cx } from '../../lib/cx'

const FILL = { todo: 'bg-todo', doing: 'bg-doing', done: 'bg-done' }

export default function ProgressBar({ percent, tone = 'done', className, label }) {
  return (
    <div
      {...(label
        ? { role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': percent, 'aria-label': label }
        : { 'aria-hidden': true })}
      className={cx('h-1.5 overflow-hidden rounded-[3px] bg-s3', className)}
    >
      <div className={cx('h-full rounded-[3px]', FILL[tone])} style={{ width: `${percent}%` }} />
    </div>
  )
}
