import { cx } from '../../lib/cx'
import Icon from './Icon'

const TONES = {
  ghost: 'bg-transparent text-t2 hover:bg-s3',
  surface: 'bg-s1 text-t2 hover:bg-s3',
  danger: 'bg-transparent text-danger hover:bg-danger-bg',
}

export default function IconButton({ icon, label, tone = 'ghost', size = 18, className, type = 'button', ...rest }) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cx(
        'transition-ui inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md',
        TONES[tone],
        className,
      )}
      {...rest}
    >
      <Icon name={icon} size={size} />
    </button>
  )
}
