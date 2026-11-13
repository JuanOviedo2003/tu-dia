import StatusIcon from './ui/StatusIcon'

function resolve(status, room) {
  if (!room) return { icon: 'todo', tone: 'text-todo', label: 'Solo en este dispositivo' }
  if (status === 'online') return { icon: 'done', tone: 'text-done', label: 'Sincronizado' }
  if (status === 'offline') return { icon: 'todo', tone: 'text-todo', label: 'Sin conexión' }
  if (status === 'auth-error' || status === 'room-not-found') {
    return { icon: 'danger', tone: 'text-danger', label: 'Error al sincronizar' }
  }
  return { icon: 'inprogress', tone: 'text-doing', label: 'Sincronizando…' }
}

export default function SyncIndicator({ status, room }) {
  const { icon, tone, label } = resolve(status, room)
  return (
    <span className="inline-flex items-center gap-1.5 text-small font-medium text-t2" role="status">
      <span className={tone}>
        <StatusIcon status={icon} size={14} />
      </span>
      {label}
    </span>
  )
}
