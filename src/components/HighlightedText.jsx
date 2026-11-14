import { cx } from '../lib/cx'

const KIND_TONE = {
  date: 'bg-accent-subtle',
  time: 'bg-accent-subtle',
  duration: 'bg-review-bg',
  repeat: 'bg-done-bg',
  status: 'bg-doing-bg',
  unscheduled: 'bg-s3',
}

export default function HighlightedText({ segments, className, backdropRef }) {
  return (
    <div
      ref={backdropRef}
      aria-hidden="true"
      data-testid="quick-add-backdrop"
      className={cx('pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words text-transparent', className)}
    >
      {segments.map((s, i) =>
        s.kind ? (
          <mark key={i} className={cx('rounded-[3px] text-transparent', KIND_TONE[s.kind])}>
            {s.text}
          </mark>
        ) : (
          s.text
        ),
      )}
      {'​'}
    </div>
  )
}
