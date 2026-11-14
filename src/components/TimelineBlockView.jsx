import { cx } from '../lib/cx'
import StatusIcon from './ui/StatusIcon'

export default function TimelineBlockView({ title, timeLabel, durationLabel, compact, status, done, onClick }) {
  const titleClass = cx('truncate text-small font-semibold', done ? 'text-t2 line-through decoration-line-strong' : 'text-t1')
  return (
    <div
      onClick={onClick}
      className={cx(
        'h-full cursor-pointer overflow-hidden rounded-md border px-2.5',
        compact ? 'flex items-center gap-2 py-0' : 'py-1.5',
        done ? 'border-s3 bg-s1' : cx(status.bg, status.border),
      )}
    >
      {compact ? (
        <>
          <p className={cx(titleClass, 'min-w-0')}>{title}</p>
          <p className={cx('shrink-0 text-caption font-medium', done ? 'text-t3' : status.text)}>{timeLabel}</p>
        </>
      ) : (
        <>
          <p className={titleClass}>{title}</p>
          <p className={cx('flex items-center gap-1 text-caption font-medium', done ? 'text-t3' : status.text)}>
            <StatusIcon status={status.key} size={12} />
            {[timeLabel, durationLabel, status.label].filter(Boolean).join(' · ')}
          </p>
        </>
      )}
    </div>
  )
}
