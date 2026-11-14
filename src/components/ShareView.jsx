import { cx } from '../lib/cx'
import { MAX_VIEWERS } from '../lib/constants'
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
      <Field label="Unirme a otra agenda con un link">
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

function LinkActions({ copied, onCopy, onShare, qrVisible, onToggleQr, canvasRef, qrLabel, copyText }) {
  const copyLabel = copied ? '¡Copiado!' : copyText
  return (
    <>
      <div className={cx('grid gap-2', onShare ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-2')}>
        {onShare && (
          <Button variant="primary" icon="share" onClick={onShare}>
            Compartir…
          </Button>
        )}
        <Button variant={onShare ? 'secondary' : 'primary'} icon="copy" onClick={onCopy}>
          {copyLabel}
        </Button>
        <Button onClick={onToggleQr}>{qrVisible ? 'Ocultar QR' : 'Mostrar QR'}</Button>
      </div>
      {qrVisible && (
        <div className="flex justify-center rounded-md border border-line bg-s2 p-3">
          <canvas ref={canvasRef} className="h-[240px] w-[240px]" aria-label={qrLabel} />
        </div>
      )}
    </>
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

function PersonRow({ person, busy, onRevoke }) {
  return (
    <li className={cx('flex min-h-11 items-center justify-between gap-3 py-2', person.revoked && 'opacity-60')}>
      <div className="min-w-0">
        <p className="truncate text-body font-medium text-t1">{person.name || 'Sin nombre'}</p>
        <p className="text-small text-t2">
          {person.revoked ? 'Acceso retirado' : person.joinedLabel ? `Desde el ${person.joinedLabel}` : 'Con acceso'}
        </p>
      </div>
      {!person.revoked && (
        <Button
          variant="danger"
          disabled={busy}
          onClick={() => onRevoke(person)}
          aria-label={`Quitar acceso a ${person.name || 'esta persona'}`}
        >
          Quitar acceso
        </Button>
      )}
    </li>
  )
}

function PeopleList({ people, loading, failed, busy, onRevoke }) {
  if (failed) return <Notice tone="warning">No se pudo cargar la lista de personas.</Notice>
  if (loading) return <p className="text-small text-t2">Cargando…</p>
  if (!people.length) return <p className="text-small text-t2">Todavía no has compartido tu agenda con nadie.</p>
  return (
    <ul className="divide-y divide-line">
      {people.map((person) => (
        <PersonRow key={person.uid} person={person} busy={busy} onRevoke={onRevoke} />
      ))}
    </ul>
  )
}

export default function ShareView({
  currentRoom,
  isEditor,
  ownAgenda,
  agendaName,
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
  inviteOpen,
  onToggleInvite,
  people,
  peopleLoading,
  viewersError,
  activeCount,
  onRevoke,
  renewing,
  rotatingEdit,
  busy,
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
  const atLimit = activeCount >= MAX_VIEWERS

  return (
    <div className="space-y-4">
      {agendaName && <p className="text-body font-medium text-t2">{agendaName}</p>}

      {authError && <Notice tone="danger">El link ya no es válido. Pide uno nuevo a quien te lo compartió.</Notice>}
      {roomNotFound && <Notice tone="danger">Esta agenda compartida ya no existe.</Notice>}
      {offline && <Notice tone="warning">Sin conexión — ediciones locales, se sincronizará al reconectar.</Notice>}
      {error && <Notice tone="danger">{error}</Notice>}

      {!currentRoom && (
        <Notice tone={ownAgenda === 'error' ? 'warning' : 'info'}>
          {ownAgenda === 'error' ? 'Sin conexión: se creará cuando haya red.' : 'Creando tu agenda…'}
        </Notice>
      )}

      {isEditor && (
        <>
          <section className="space-y-3 rounded-md border border-line bg-s1 p-4">
            <h3 className="text-heading font-semibold text-t1">Mis dispositivos</h3>
            <p className="text-small text-t2">Abre tu agenda en otro dispositivo tuyo.</p>
            {editUrl ? (
              <LinkActions
                copyText="Copiar link de edición"
                copied={copiedLabel === 'editor'}
                onCopy={() => onCopy(editUrl, 'editor')}
                qrVisible={showQr.editor}
                onToggleQr={() => onToggleQr('editor')}
                canvasRef={canvasEditRef}
                qrLabel="Código QR del link de edición"
              />
            ) : (
              <MissingLink
                text="Este dispositivo no conoce el link de edición actual."
                label="Crear link de edición"
                pendingLabel="Creando…"
                pending={rotatingEdit}
                busy={busy}
                onAction={() => onAskConfirm('rotateEdit')}
              />
            )}
            <p className="text-small text-t3">Este link da control total sobre tu agenda: no lo compartas con otras personas.</p>
          </section>

          <section className="space-y-3 rounded-md border border-line bg-s1 p-4">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-heading font-semibold text-t1">Personas con acceso</h3>
              <span className="text-small text-t2">
                {activeCount} de {MAX_VIEWERS} personas
              </span>
            </div>
            <Button
              variant="primary"
              icon="plus"
              aria-expanded={inviteOpen}
              aria-controls="share-invite"
              onClick={onToggleInvite}
              disabled={atLimit}
              className="w-full"
            >
              Invitar a alguien
            </Button>
            {atLimit && (
              <Notice tone="warning">
                Has llegado al límite de {MAX_VIEWERS} personas. Quita el acceso a alguien para invitar a otra.
              </Notice>
            )}
            <div id="share-invite" hidden={!inviteOpen || atLimit} className="space-y-3 rounded-md bg-s2 p-3">
              <p className="text-small text-t2">
                Quien abra este link verá tu agenda sin poder editarla y te pedirá su nombre.
              </p>
              {viewUrl ? (
                <LinkActions
                  copyText="Copiar link"
                  copied={copiedLabel === 'viewer'}
                  onCopy={() => onCopy(viewUrl, 'viewer')}
                  onShare={canNativeShare ? () => onNativeShare(viewUrl) : undefined}
                  qrVisible={showQr.viewer}
                  onToggleQr={() => onToggleQr('viewer')}
                  canvasRef={canvasViewRef}
                  qrLabel="Código QR del link de solo ver"
                />
              ) : (
                <MissingLink
                  text="Este dispositivo no conoce el link actual de solo ver. Crear uno nuevo cortará el acceso a las personas actuales."
                  label="Crear link nuevo"
                  pendingLabel="Creando…"
                  pending={renewing}
                  busy={busy}
                  onAction={() => onAskConfirm('renewView')}
                />
              )}
            </div>
            <PeopleList people={people} loading={peopleLoading} failed={viewersError} busy={busy} onRevoke={onRevoke} />
          </section>
        </>
      )}

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
            <Button variant="danger" onClick={() => onAskConfirm('leave')} disabled={busy} className="w-full">
              Dejar de sincronizar este dispositivo
            </Button>
          </>
        )}
        <JoinForm input={input} onInputChange={onInputChange} onJoin={onJoin} />
        {isEditor && (
          <div className={cx('flex items-center gap-2 text-small font-medium', STATUS_TEXT_TONE[statusIcon])}>
            <StatusIcon status={statusIcon} size={14} />
            <span className="text-t2">{statusText}</span>
          </div>
        )}
      </Disclosure>

      <div className="flex justify-end">
        <Button onClick={onClose}>Cerrar</Button>
      </div>
    </div>
  )
}
