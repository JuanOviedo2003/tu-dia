import Button from './ui/Button'
import { Field, Input } from './ui/Field'
import Notice from './ui/Notice'
import StatusIcon from './ui/StatusIcon'

const STATUS_TEXT_TONE = { done: 'text-done', danger: 'text-danger', todo: 'text-todo', inprogress: 'text-doing' }

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
  currentRole,
  editUrl,
  viewUrl,
  canvasEditRef,
  canvasViewRef,
  showQr,
  onToggleQr,
  copiedLabel,
  onCopy,
  creating,
  renewing,
  rotatingEdit,
  busy,
  onCreate,
  onAskConfirm,
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
  const isEditor = Boolean(currentRoom) && currentRole === 'editor'
  const isViewer = Boolean(currentRoom) && currentRole === 'viewer'

  return (
    <div className="space-y-4">
      {authError && <Notice tone="danger">Token inválido o revocado. Pide un link nuevo al anfitrión.</Notice>}
      {roomNotFound && <Notice tone="danger">Esta sala no existe o fue eliminada.</Notice>}
      {offline && <Notice tone="warning">Sin conexión — ediciones locales, se sincronizará al reconectar.</Notice>}
      {error && <Notice tone="danger">{error}</Notice>}

      {!currentRoom && (
        <>
          <p className="text-small text-t2">Crea una sala para obtener links seguros, o únete con un link recibido.</p>
          <Button variant="primary" onClick={onCreate} disabled={busy} className="w-full">
            {creating ? 'Creando...' : 'Crear sala'}
          </Button>
        </>
      )}

      {isEditor && (
        <>
          <section className="space-y-3 rounded-md border border-line bg-s1 p-3">
            <h3 className="text-heading font-semibold text-t1">Enlace de edición</h3>
            <p className="text-small text-t2">
              Para usar tu agenda en otro dispositivo tuyo. Da control total: quien lo tenga puede editar y borrar tareas.
            </p>
            {editUrl ? (
              <>
                <LinkRow title="Link de edición" url={editUrl} copied={copiedLabel === 'editor'} onCopy={() => onCopy(editUrl, 'editor')} />
                <Button variant="secondary" onClick={() => onToggleQr('editor')} className="w-full">
                  {showQr.editor ? 'Ocultar QR' : 'Mostrar QR'}
                </Button>
                {showQr.editor && (
                  <div className="flex justify-center rounded-md border border-line bg-s2 p-3">
                    <canvas ref={canvasEditRef} className="h-[240px] w-[240px]" aria-label="Código QR del link de edición" />
                  </div>
                )}
              </>
            ) : (
              <Notice tone="info">Este dispositivo no conoce el link de edición actual.</Notice>
            )}
            <Button variant="secondary" onClick={() => onAskConfirm('rotateEdit')} disabled={busy} className="w-full">
              {rotatingEdit ? 'Rotando...' : 'Rotar token de editor'}
            </Button>
          </section>

          <section className="space-y-3 rounded-md border border-line bg-s1 p-3">
            <h3 className="text-heading font-semibold text-t1">Enlace de solo ver</h3>
            <p className="text-small text-t2">
              Para compartir tu agenda con otras personas. Solo pueden verla, no editarla.
            </p>
            {viewUrl ? (
              <>
                <LinkRow title="Link de solo ver" url={viewUrl} copied={copiedLabel === 'viewer'} onCopy={() => onCopy(viewUrl, 'viewer')} />
                <Button variant="secondary" onClick={() => onToggleQr('viewer')} className="w-full">
                  {showQr.viewer ? 'Ocultar QR' : 'Mostrar QR'}
                </Button>
                {showQr.viewer && (
                  <div className="flex justify-center rounded-md border border-line bg-s2 p-3">
                    <canvas ref={canvasViewRef} className="h-[240px] w-[240px]" aria-label="Código QR del link de solo ver" />
                  </div>
                )}
              </>
            ) : (
              <Notice tone="info">Este dispositivo no conoce el link actual de solo ver. Renueva para generar uno nuevo.</Notice>
            )}
            <Button variant="secondary" onClick={() => onAskConfirm('renewView')} disabled={busy} className="w-full">
              {renewing ? 'Renovando...' : 'Renovar link de solo ver'}
            </Button>
          </section>

          <Button variant="danger" onClick={() => onAskConfirm('leave')} disabled={busy} className="w-full">
            Olvidar este dispositivo
          </Button>
        </>
      )}

      {isViewer && (
        <>
          <Notice tone="info">Estás viendo esta agenda en modo solo lectura.</Notice>
          <Button variant="danger" onClick={() => onAskConfirm('leave')} disabled={busy} className="w-full">
            Olvidar este dispositivo
          </Button>
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
        <Field label="Pegar link">
          <Input
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder="Pega el link completo de edición o de solo ver"
          />
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
