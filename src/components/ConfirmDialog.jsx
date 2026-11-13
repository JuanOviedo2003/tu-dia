import Button from './ui/Button'
import Modal from './ui/Modal'

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  confirmVariant = 'primary',
  onConfirm,
  secondaryLabel,
  onSecondary,
  cancelLabel = 'Cancelar',
  onCancel,
  busy = false,
}) {
  return (
    <Modal open={open} onClose={onCancel} title={title}>
      <p className="text-body text-t2">{message}</p>
      <div className="mt-5 flex flex-col gap-2">
        <Button variant={confirmVariant} onClick={onConfirm} disabled={busy} className="w-full">
          {confirmLabel}
        </Button>
        {secondaryLabel && (
          <Button variant="secondary" onClick={onSecondary} disabled={busy} className="w-full">
            {secondaryLabel}
          </Button>
        )}
        <Button variant="text" onClick={onCancel} disabled={busy} className="w-full">
          {cancelLabel}
        </Button>
      </div>
    </Modal>
  )
}
