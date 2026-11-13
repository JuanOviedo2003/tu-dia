import { cx } from '../../lib/cx'
import ProgressBar from './ProgressBar'

export default function DayProgress({ done, total, percent, className, barClassName = 'flex-1' }) {
  return (
    <div className={cx('flex items-center gap-3', className)}>
      <ProgressBar percent={percent} label="Progreso del día" className={barClassName} />
      <span className="whitespace-nowrap text-small font-medium text-t2">
        {done} de {total} hechas
      </span>
    </div>
  )
}
