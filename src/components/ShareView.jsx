import Button from './ui/Button'
import { Field, Input } from './ui/Field'
import Notice from './ui/Notice'
import SegmentedControl from './ui/SegmentedControl'
import StatusIcon from './ui/StatusIcon'

const STATUS_TEXT_TONE = { done: 'text-done', danger: 'text-danger', todo: 'text-todo', inprogress: 'text-doing' }

const QR_OPTIONS = [
  { value: 'editor', label: 'QR Editor' },
  { value: 'viewer', label: 'QR Espectador' },
]

function LinkRow({ title, url, copied, onCopy }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0 flex-1">
        <span className="block text-small font-semibold text-t1">{title}</span>
        <span className="block truncate text-caption text-t3">{url}</span>
      </div>
      <Button icon="copy" onClick={onCopy} className="shrink-0">
        {copied ? '¡Copiado!' : 'Copiar'}
      </Button>
    </div>
  )
}

export default function ShareView({
  currentRoom,
  hasTokens,
  editUrl,
  viewUrl,
  qrTab,
  onQrTabChange,
  canvasRef,
  copiedLabel,
  onCopy,
  creating,
  rotating,
  onCreate,
  onRotate,
  onLeaveRoom,
  input,
  onInputChange,
  onJoin,
  error,
  authError,
  roomNotFound,
  offline,
  statusText,
  statusIcon,
  onClose,
}) {
  return (
    <div className="space-y-4">
      <p className="text-small text-t2">Crea una sala para obtener links seguros, o únete con un link recibido.</p>

      {authError && <Notice tone="danger">Token inválido o expirado. Pide al anfitrión un link nuevo.</Notice>}
      {roomNotFound && <Notice tone="danger">Esta sala no existe o fue eliminada.</Notice>}
      {offline && <Notice tone="warning">Sin conexión — ediciones locales, se sincronizará al reconectar.</Notice>}
      {error && <Notice tone="danger">{error}</Notice>}

      {currentRoom ? (
        <Button variant="danger" onClick={onLeaveRoom} className="w-full">
          Olvidar este dispositivo
        </Button>
      ) : (
        <Button variant="primary" onClick={onCreate} disabled={creating} className="w-full">
          {creating ? 'Creando...' : 'Crear sala'}
        </Button>
      )}

      {currentRoom && hasTokens && (
        <>
          <div className="space-y-3 rounded-md border border-line bg-s1 p-3">
            <LinkRow title="Link Editor" url={editUrl} copied={copiedLabel === 'editor'} onCopy={() => onCopy(editUrl, 'editor')} />
            <div className="border-t border-line pt-3">
              <LinkRow title="Link Espectador" url={viewUrl} copied={copiedLabel === 'viewer'} onCopy={() => onCopy(viewUrl, 'viewer')} />
            </div>
            <div className="border-t border-line pt-3">
              <Button variant="secondary" onClick={onRotate} disabled={rotating} className="w-full">
                {rotating ? 'Rotando...' : 'Rotar tokens (revoca links anteriores)'}
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <SegmentedControl label="Tipo de QR" options={QR_OPTIONS} value={qrTab} onChange={onQrTabChange} className="w-full" />
            <div className="flex justify-center rounded-md border border-line bg-s2 p-3">
              <canvas ref={canvasRef} className="h-[240px] w-[240px]" aria-label={`Código QR del link de ${qrTab === 'editor' ? 'editor' : 'espectador'}`} />
            </div>
          </div>
        </>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          onJoin()
        }}
        className="space-y-2"
      >
        <h3 className="text-heading font-semibold text-t1">Unirse a una sala</h3>
        <Field label="Link recibido">
          <Input value={input} onChange={(e) => onInputChange(e.target.value)} placeholder="Pega el link recibido" />
        </Field>
        <Button type="submit" className="w-full">
          Unirse
        </Button>
      </form>

      <div className={`flex items-center gap-2 rounded-md border border-line bg-s1 p-3 text-small font-medium ${STATUS_TEXT_TONE[statusIcon]}`}>
        <StatusIcon status={statusIcon} size={14} />
        <span className="text-t2">{statusText}</span>
      </div>

      <div className="flex justify-end">
        <Button variant="primary" onClick={onClose}>
          Cerrar
        </Button>
      </div>
    </div>
  )
}
