import { cx } from '../../lib/cx'
import StatusIcon from './StatusIcon'

const TONES = {
  danger: { box: 'bg-danger-bg border-danger-border text-danger', icon: 'danger' },
  warning: { box: 'bg-doing-bg border-doing-border text-doing', icon: 'inprogress' },
  info: { box: 'bg-accent-subtle border-accent-subtle text-accent', icon: 'review' },
}

export default function Notice({ tone = 'info', children, className }) {
  const meta = TONES[tone]
  return (
    <p className={cx('flex items-start gap-2 rounded-md border p-3 text-small font-medium', meta.box, className)}>
      <span className="mt-px">
        <StatusIcon status={meta.icon} size={14} />
      </span>
      <span>{children}</span>
    </p>
  )
}
