import { useShare } from '../hooks/useShare'
import Modal from '../components/ui/Modal'
import ShareView from '../components/ShareView'

export default function ShareModal({ open, onClose, currentRoom, currentRole, onJoin, onCreateRoom, onRotateTokens, onLeaveRoom, syncStatus }) {
  const share = useShare({ open, currentRoom, currentRole, onCreateRoom, onRotateTokens, onJoin, onClose, syncStatus })

  return (
    <Modal open={open} onClose={onClose} title="Compartir" width="sm:max-w-md">
      <ShareView
        currentRoom={currentRoom}
        hasTokens={Boolean(share.tokens)}
        editUrl={share.editUrl}
        viewUrl={share.viewUrl}
        qrTab={share.qrTab}
        onQrTabChange={share.setQrTab}
        canvasRef={share.canvasRef}
        copiedLabel={share.copied}
        onCopy={share.copyToClipboard}
        creating={share.creating}
        rotating={share.rotating}
        onCreate={share.handleCreate}
        onRotate={share.handleRotate}
        onLeaveRoom={onLeaveRoom}
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
  )
}
