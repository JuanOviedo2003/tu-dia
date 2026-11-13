import { cx } from '../../lib/cx'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import IconButton from './IconButton'

const ALIGN = {
  center: 'items-end sm:items-center',
  top: 'items-start pt-16 sm:pt-24',
}

export default function Modal({ open, onClose, title, align = 'center', width = 'sm:max-w-md', children }) {
  useEscapeKey(open, onClose)

  if (!open) return null

  return (
    <div
      className={cx('fade-in fixed inset-0 z-50 flex justify-center bg-t1/40 p-0 sm:p-4', ALIGN[align])}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={cx(
          'rise-in max-h-[92dvh] w-full overflow-y-auto rounded-t-lg border border-line bg-s2 p-5 shadow-menu sm:rounded-lg',
          width,
        )}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-title font-semibold text-t1">{title}</h2>
          <IconButton icon="close" label="Cerrar" onClick={onClose} className="-mr-2" />
        </div>
        {children}
      </div>
    </div>
  )
}
