import { cx } from '../../lib/cx'

export default function SegmentedControl({ options, value, onChange, label, className }) {
  return (
    <div role="group" aria-label={label} className={cx('inline-flex rounded-[12px] border border-line bg-app p-[3px]', className)}>
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cx(
              'transition-ui h-[38px] min-h-0 flex-auto whitespace-nowrap rounded-[9px] px-3 text-[14px]',
              active ? 'bg-s3 font-semibold text-t1' : 'bg-transparent font-medium text-t2 hover:bg-s1',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
