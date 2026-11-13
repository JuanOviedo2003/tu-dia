import { cx } from '../../lib/cx'
import { DANGER_TONE, statusMeta } from '../../lib/constants'
import StatusIcon from './StatusIcon'

export default function StatusBadge({ status, overdue = false, className }) {
  const meta = overdue ? DANGER_TONE : statusMeta(status)
  const label = overdue ? 'Vencida' : meta.label
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-sm px-2 py-1 text-caption font-medium',
        meta.bg,
        meta.text,
        className,
      )}
    >
      <StatusIcon status={overdue ? 'danger' : status} size={12} />
      {label}
    </span>
  )
}
