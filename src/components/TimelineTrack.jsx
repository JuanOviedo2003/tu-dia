import { cx } from '../lib/cx'

export default function TimelineTrack({ scrollRef, height, isOver, hours, nowTop, empty, children }) {
  return (
    <div
      ref={scrollRef}
      className={cx(
        'relative min-h-0 flex-1 overflow-y-auto rounded-lg border bg-s1',
        isOver ? 'border-accent bg-accent-subtle' : 'border-line',
      )}
    >
      <div className="relative" style={{ height }}>
        {hours.map(({ label, top }) => (
          <div key={label} className="absolute left-0 right-0 border-t border-line" style={{ top }}>
            <span className={cx('absolute left-3 bg-s1 px-1 text-small font-medium text-t2', top === 0 ? 'top-1' : '-top-2.5')}>
              {label}
            </span>
          </div>
        ))}
        {nowTop !== null && (
          <div className="absolute left-0 right-0 z-10 border-t-2 border-danger" style={{ top: nowTop }}>
            <span className="absolute -top-3 right-2 rounded-sm bg-danger-bg px-2 py-0.5 text-caption font-medium text-danger">
              Ahora
            </span>
          </div>
        )}
        <div className="absolute bottom-0 left-16 right-3 top-0">{children}</div>
        {empty && (
          <p className="absolute inset-x-0 top-10 px-4 text-center text-body font-medium text-t3">{empty}</p>
        )}
      </div>
    </div>
  )
}
