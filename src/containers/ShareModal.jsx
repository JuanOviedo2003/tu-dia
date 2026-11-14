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
    message:
      'Se cortará el acceso a TODAS las personas con las que compartiste. Tendrás que enviarles el link nuevo. Tus dispositivos de edición no se ven afectados.',
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
  ownAgenda,
  agendaName,
  onJoin,
  onListViewers,
  onRevokeViewer,
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
    onListViewers,
    onRevokeViewer,
    onRenewViewToken,
    onRotateEditToken,
    onLeaveRoom,
    onJoin,
    onClose,
    syncStatus,
  })
  const confirmCopy =
    share.confirm === 'revoke'
      ? {
          title: 'Quitar acceso',
          message: `${share.revokeTarget?.name || 'Esta persona'} dejará de ver tu agenda y no podrá volver a entrar con el mismo link.`,
          confirmLabel: 'Quitar acceso',
        }
      : CONFIRM_COPY[share.confirm] || CONFIRM_COPY.leave

  return (
    <>
      <Modal open={open} onClose={share.confirm ? undefined : onClose} title="Compartir" width="sm:max-w-md">
        <ShareView
          currentRoom={currentRoom}
          isEditor={share.canManage}
          ownAgenda={ownAgenda}
          agendaName={agendaName}
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
          inviteOpen={share.inviteOpen}
          onToggleInvite={share.toggleInvite}
          people={share.people}
          peopleLoading={share.peopleLoading}
          viewersError={share.viewersError}
          activeCount={share.activeCount}
          onRevoke={share.askRevoke}
          renewing={share.renewing}
          rotatingEdit={share.rotatingEdit}
          busy={share.busy}
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
