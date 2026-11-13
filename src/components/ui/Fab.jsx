import { cx } from '../../lib/cx'
import Icon from './Icon'

export default function Fab({ label, icon = 'plus', className, ...rest }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        'btn-filled transition-ui flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent shadow-menu hover:bg-accent-hover active:bg-accent-press',
        className,
      )}
      {...rest}
    >
      <Icon name={icon} size={24} />
    </button>
  )
}
