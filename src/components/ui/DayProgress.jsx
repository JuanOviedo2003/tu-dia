import { cx } from '../../lib/cx'
import DayBadge from './DayBadge'
import ProgressBar from './ProgressBar'

export default function DayProgress({ done, total, percent, tone, className, barClassName = 'flex-1' }) {
  return (
    <div className={cx('flex items-center gap-3', className)}>
      <ProgressBar percent={percent} tone={tone} label="Progreso del día" className={barClassName} />
      <DayBadge tone={tone} done={done} total={total} className="whitespace-nowrap text-small" />
    </div>
  )
}
