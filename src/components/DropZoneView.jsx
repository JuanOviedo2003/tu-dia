import { cx } from '../lib/cx'
import StatusIcon from './ui/StatusIcon'

export default function DropZoneView({ status, isOver }) {
  return (
    <div
      className={cx(
        'flex h-24 flex-col items-center justify-center gap-1.5 rounded-[12px] border-2',
        status.text,
        isOver ? cx('border-solid', status.solid, status.dropOver) : cx('border-dashed', status.border, status.bg),
      )}
    >
      <StatusIcon status={status.key} size={20} />
      <span className="text-[14px] font-semibold">{status.label}</span>
    </div>
  )
}
