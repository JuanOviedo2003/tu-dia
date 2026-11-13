import { cx } from '../../lib/cx'

export default function StatusButton({ status, active, className, inactiveClassName, children, ...rest }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cx('transition-ui', className, active ? cx(status.bg, status.border, status.text, 'font-semibold') : inactiveClassName)}
      {...rest}
    >
      {children}
    </button>
  )
}
