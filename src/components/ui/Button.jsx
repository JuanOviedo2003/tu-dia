import { cx } from '../../lib/cx'
import Icon from './Icon'

const VARIANTS = {
  primary: 'btn-filled bg-accent text-on-accent font-semibold hover:bg-accent-hover active:bg-accent-press',
  secondary: 'bg-s2 border border-line-strong text-t1 hover:bg-s3',
  text: 'text-accent hover:text-accent-hover',
  danger: 'bg-danger-bg border border-danger-border text-danger hover:brightness-95',
}

export default function Button({ variant = 'secondary', icon, className, children, type = 'button', ...rest }) {
  return (
    <button
      type={type}
      className={cx(
        'transition-ui inline-flex h-11 items-center justify-center gap-2 rounded-md px-4 text-body font-medium',
        VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {icon && <Icon name={icon} />}
      {children}
    </button>
  )
}
