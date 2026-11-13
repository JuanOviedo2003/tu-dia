import { forwardRef } from 'react'
import { cx } from '../../lib/cx'

const CONTROL =
  'transition-ui w-full rounded-md border border-line-strong bg-s2 px-3 text-body-m text-t1 placeholder:text-t3 sm:text-body'

export function Field({ label, hint, children, className }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1 block text-small font-medium text-t2">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-caption text-t3">{hint}</span>}
    </label>
  )
}

export const Input = forwardRef(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cx(CONTROL, 'h-11', className)} {...rest} />
})

export const Select = forwardRef(function Select({ className, children, ...rest }, ref) {
  return (
    <select ref={ref} className={cx(CONTROL, 'h-11', className)} {...rest}>
      {children}
    </select>
  )
})

export const Textarea = forwardRef(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cx(CONTROL, 'py-2', className)} {...rest} />
})
