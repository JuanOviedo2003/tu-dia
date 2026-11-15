import { useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { cx } from '../../lib/cx'
import { useModalA11y } from '../../hooks/useModalA11y'
import IconButton from './IconButton'

const ALIGN = {
  center: 'items-end sm:items-center',
  top: 'items-start pt-16 sm:pt-24',
}

export default function Modal({
  open,
  onClose,
  title,
  align = 'center',
  width = 'sm:max-w-md',
  role = 'dialog',
  describedBy,
  initialFocusRef,
  children,
}) {
  const panelRef = useRef(null)
  const titleId = useId()
  useModalA11y(open, panelRef, onClose, initialFocusRef)

  if (!open) return null

  return createPortal(
    <div
      className={cx('fade-in fixed inset-0 z-50 flex justify-center bg-t1/40 p-0 sm:p-4', ALIGN[align])}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={describedBy}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={cx(
          'rise-in flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-lg border border-line bg-s2 shadow-menu outline-none sm:max-h-[85dvh] sm:rounded-lg',
          width,
        )}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 px-4 pb-3 pt-4 sm:px-5 sm:pt-5">
          <h2 id={titleId} className="min-w-0 text-title font-semibold text-t1">{title}</h2>
          <IconButton icon="close" label="Cerrar" onClick={onClose} className="-mr-2" />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-5 sm:pb-5">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
}
