import { cx } from '../lib/cx'
import Button from './ui/Button'
import { Field, Input } from './ui/Field'
import Icon from './ui/Icon'
import Notice from './ui/Notice'
import StatusIcon from './ui/StatusIcon'

const STATUS_TEXT_TONE = { done: 'text-done', danger: 'text-danger', todo: 'text-todo', inprogress: 'text-doing' }

function Disclosure({ id, label, open, onToggle, children }) {
  return (
    <div className="rounded-md border border-line bg-s1">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={onToggle}
        className="transition-ui flex w-full items-center justify-between gap-2 rounded-md px-3 text-body font-medium text-t1 hover:bg-s2"
      >
        {label}
        <Icon name="chevron-right" className={cx('transition-ui', open && 'rotate-90')} />
      </button>
      <div id={id} hidden={!open} className="space-y-3 border-t border-line p-3">
        {children}
      </div>
    </div>
  )
}

function JoinForm({ input, onInputChange, onJoin }) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onJoin()
      }}
      className="space-y-2"
    >
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
  )
}

function ShareCard({ heading, description, url, copied, onCopy, onShare, qrVisible, onToggleQr, canvasRef, qrLabel, fallback }) {
  const copyLabel = copied ? '¡Copiado!' : 'Copiar link'
  return (
    <section className="space-y-3 rounded-md border border-line bg-s1 p-4">
      <h3 className="text-heading font-semibold text-t1">{heading}</h3>
      <p className="text-small text-t2">{description}</p>
      {url ? (
        <>
          {onShare ? (
            <Button variant="primary" icon="share" onClick={onShare} className="w-full">
              Compartir…
            </Button>
          ) : (
            <Button variant="primary" icon="copy" onClick={onCopy} className="w-full">
              {copyLabel}
            </Button>
          )}
          <div className={cx('grid gap-2', onShare && 'grid-cols-2')}>
            {onShare && (
              <Button icon="copy" onClick={onCopy}>
                {copyLabel}
              </Button>
            )}
            <Button onClick={onToggleQr}>{qrVisible ? 'Ocultar QR' : 'Mostrar QR'}</Button>
          </div>
          {qrVisible && (
            <div className="flex justify-center rounded-md border border-line bg-s2 p-3">
              <canvas ref={canvasRef} className="h-[240px] w-[240px]" aria-label={qrLabel} />
            </div>
          )}
        </>
      ) : (
        fallback
      )}
    </section>
  )
}

function MissingLink({ text, label, pendingLabel, pending, busy, onAction }) {
  return (
    <>
      <Notice tone="info">{text}</Notice>
      <Button variant="primary" onClick={onAction} disabled={busy} className="w-full">
        {pending ? pendingLabel : label}
      </Button>
    </>
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
  canNativeShare,
  onNativeShare,
  moreOpen,
  onToggleMore,
  joinOpen,
  onToggleJoin,
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

  const join = (
    <Disclosure id="share-join" label="¿Tienes un link?" open={joinOpen} onToggle={onToggleJoin}>
      <JoinForm input={input} onInputChange={onInputChange} onJoin={onJoin} />
    </Disclosure>
  )

  const leaveButton = (
    <Button variant="danger" onClick={() => onAskConfirm('leave')} disabled={busy} className="w-full">
      Dejar de sincronizar este dispositivo
    </Button>
  )

  return (
    <div className="space-y-4">
      {authError && <Notice tone="danger">El link ya no es válido. Pide uno nuevo a quien te lo compartió.</Notice>}
      {roomNotFound && <Notice tone="danger">Esta agenda compartida ya no existe.</Notice>}
      {offline && <Notice tone="warning">Sin conexión — ediciones locales, se sincronizará al reconectar.</Notice>}
      {error && <Notice tone="danger">{error}</Notice>}

      {!currentRoom && (
        <>
          <section className="space-y-3 rounded-md border border-line bg-s1 p-4">
            <h3 className="text-heading font-semibold text-t1">Comparte tu agenda</h3>
            <p className="text-small text-t2">
              Activa compartir para usar tu agenda en otro dispositivo o dejar que otras personas la vean.
            </p>
            <Button variant="primary" onClick={onCreate} disabled={busy} className="w-full">
              {creating ? 'Activando…' : 'Activar compartir'}
            </Button>
          </section>
          {join}
        </>
      )}

      {isEditor && (
        <>
          <ShareCard
            heading="Usar en otro dispositivo mío"
            description="Quien abra este link podrá editar tu agenda."
            url={editUrl}
            copied={copiedLabel === 'editor'}
            onCopy={() => onCopy(editUrl, 'editor')}
            qrVisible={showQr.editor}
            onToggleQr={() => onToggleQr('editor')}
            canvasRef={canvasEditRef}
            qrLabel="Código QR del link de edición"
            fallback={
              <MissingLink
                text="Este dispositivo no conoce el link de edición actual."
                label="Crear link de edición"
                pendingLabel="Creando…"
                pending={rotatingEdit}
                busy={busy}
                onAction={() => onAskConfirm('rotateEdit')}
              />
            }
          />

          <ShareCard
            heading="Compartir para que otros vean"
            description="Solo podrán ver tu agenda, no editarla."
            url={viewUrl}
            copied={copiedLabel === 'viewer'}
            onCopy={() => onCopy(viewUrl, 'viewer')}
            onShare={canNativeShare ? () => onNativeShare(viewUrl) : undefined}
            qrVisible={showQr.viewer}
            onToggleQr={() => onToggleQr('viewer')}
            canvasRef={canvasViewRef}
            qrLabel="Código QR del link de solo ver"
            fallback={
              <MissingLink
                text="Este dispositivo no conoce el link actual de solo ver. Crea uno nuevo para compartir."
                label="Crear link de solo ver"
                pendingLabel="Creando…"
                pending={renewing}
                busy={busy}
                onAction={() => onAskConfirm('renewView')}
              />
            }
          />
        </>
      )}

      {isViewer && <Notice tone="info">Estás viendo esta agenda en modo solo lectura.</Notice>}

      {currentRoom && (
        <Disclosure id="share-more" label="Más opciones" open={moreOpen} onToggle={onToggleMore}>
          {isEditor && (
            <>
              {viewUrl && (
                <Button onClick={() => onAskConfirm('renewView')} disabled={busy} className="w-full">
                  {renewing ? 'Renovando…' : 'Renovar link de solo ver'}
                </Button>
              )}
              <Button onClick={() => onAskConfirm('rotateEdit')} disabled={busy} className="w-full">
                {rotatingEdit ? 'Renovando…' : 'Renovar link de edición'}
              </Button>
            </>
          )}
          {leaveButton}
          {join}
          <div className={cx('flex items-center gap-2 text-small font-medium', STATUS_TEXT_TONE[statusIcon])}>
            <StatusIcon status={statusIcon} size={14} />
            <span className="text-t2">{statusText}</span>
          </div>
        </Disclosure>
      )}

      <div className="flex justify-end">
        <Button onClick={onClose}>Cerrar</Button>
      </div>
    </div>
  )
}
