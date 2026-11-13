import { cx } from '../../lib/cx'

const TONES = {
  neutral: 'bg-s1 border border-line text-t2',
  accent: 'bg-accent-subtle text-accent',
  danger: 'bg-danger-bg border border-danger-border text-danger',
}

export default function Chip({ tone = 'neutral', icon, className, children }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-sm px-2 py-1 text-small font-medium',
        TONES[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  )
}
