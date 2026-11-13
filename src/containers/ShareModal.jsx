import { useShare } from '../hooks/useShare'
import Modal from '../components/ui/Modal'
import ShareView from '../components/ShareView'
import ConfirmDialog from '../components/ConfirmDialog'

const CONFIRM_COPY = {
  leave: {
    title: 'Dejar de sincronizar este dispositivo',
    message:
      'Este dispositivo dejará de sincronizar y borrará sus credenciales. Si es el único con el link de edición, perderás el acceso.',
    confirmLabel: 'Dejar de sincronizar',
  },
  renewView: {
    title: 'Renovar link de solo ver',
    message: 'Los links de solo ver anteriores dejarán de funcionar. Los editores no se ven afectados.',
    confirmLabel: 'Renovar',
  },
  rotateEdit: {
    title: 'Renovar link de edición',
    message:
      'Los links de edición anteriores dejarán de funcionar. Los demás dispositivos editores tendrán que volver a unirse con el link nuevo.',
    confirmLabel: 'Renovar',
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
          canNativeShare={share.canNativeShare}
          onNativeShare={share.nativeShare}
          moreOpen={share.moreOpen}
          onToggleMore={share.toggleMore}
          joinOpen={share.joinOpen}
          onToggleJoin={share.toggleJoin}
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
        confirmVariant="danger"
        onConfirm={share.runConfirm}
        onCancel={share.cancelConfirm}
        busy={share.busy}
      />
    </>
  )
}
