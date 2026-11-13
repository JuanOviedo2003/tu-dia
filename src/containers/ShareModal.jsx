import { useShare } from '../hooks/useShare'
import Modal from '../components/ui/Modal'
import ShareView from '../components/ShareView'
import ConfirmDialog from '../components/ConfirmDialog'

const CONFIRM_COPY = {
  leave: {
    title: 'Olvidar este dispositivo',
    message:
      'Este dispositivo saldrá de la sala y borrará sus credenciales. Si es el único con el link de edición, perderás el acceso.',
    confirmLabel: 'Olvidar',
    confirmVariant: 'danger',
  },
  renewView: {
    title: 'Renovar link de solo ver',
    message: 'Los links de solo ver anteriores dejarán de funcionar. Los editores no se ven afectados.',
    confirmLabel: 'Renovar',
    confirmVariant: 'danger',
  },
  rotateEdit: {
    title: 'Rotar token de editor',
    message:
      'Los links de edición anteriores dejarán de funcionar. Los demás dispositivos editores tendrán que volver a unirse con el link nuevo.',
    confirmLabel: 'Rotar',
    confirmVariant: 'danger',
  },
}

export default function ShareModal({
  open,
  onClose,
  currentRoom,
  currentRole,
  tokens,
  onJoin,
  onCreateRoom,
  onRenewViewToken,
  onRotateEditToken,
  onLeaveRoom,
  syncStatus,
}) {
  const share = useShare({
    open,
    currentRoom,
    currentRole,
    tokens,
    onCreateRoom,
    onRenewViewToken,
    onRotateEditToken,
    onLeaveRoom,
    onJoin,
    onClose,
    syncStatus,
  })
  const confirmCopy = CONFIRM_COPY[share.confirm] || CONFIRM_COPY.leave

  return (
    <>
      <Modal open={open} onClose={share.confirm ? undefined : onClose} title="Compartir" width="sm:max-w-md">
        <ShareView
          currentRoom={currentRoom}
          currentRole={currentRole}
          editUrl={share.editUrl}
          viewUrl={share.viewUrl}
          canvasEditRef={share.canvasEditRef}
          canvasViewRef={share.canvasViewRef}
          showQr={share.showQr}
          onToggleQr={share.toggleQr}
          copiedLabel={share.copied}
          onCopy={share.copyToClipboard}
          creating={share.creating}
          renewing={share.renewing}
          rotatingEdit={share.rotatingEdit}
          busy={share.busy}
          onCreate={share.handleCreate}
          onAskConfirm={share.askConfirm}
          input={share.input}
          onInputChange={share.setInput}
          onJoin={share.join}
          error={share.error}
          authError={share.authError}
          roomNotFound={share.roomNotFound}
          offline={share.offline}
          statusText={share.statusText}
          statusIcon={share.statusIcon}
          onClose={onClose}
        />
      </Modal>

      <ConfirmDialog
        open={open && Boolean(share.confirm)}
        title={confirmCopy.title}
        message={confirmCopy.message}
        confirmLabel={confirmCopy.confirmLabel}
        confirmVariant={confirmCopy.confirmVariant}
        onConfirm={share.runConfirm}
        onCancel={share.cancelConfirm}
        busy={share.busy}
      />
    </>
  )
}
