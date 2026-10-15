import { monthName } from '../lib/time'

function statusLabel(syncStatus, room) {
  if (!room) return 'Sync'
  switch (syncStatus) {
    case 'online': return 'Sincronizado'
    case 'auth-error': return 'Token inválido'
    case 'room-not-found': return 'Sala no encontrada'
    case 'offline': return 'Sin conexión'
    default: return 'Conectando...'
  }
}

function statusColor(syncStatus) {
  switch (syncStatus) {
    case 'online': return { dot: 'bg-emerald-400', border: 'border-emerald-500/50', text: 'text-emerald-400' }
    case 'auth-error': return { dot: 'bg-rose-400', border: 'border-rose-500/50', text: 'text-rose-400' }
    case 'room-not-found': return { dot: 'bg-rose-400', border: 'border-rose-500/50', text: 'text-rose-400' }
    case 'offline': return { dot: 'bg-amber-400', border: 'border-amber-500/50', text: 'text-amber-400' }
    default: return { dot: 'bg-amber-400', border: 'border-brand/50', text: 'text-brand' }
  }
}

export default function Toolbar({ year, month, onPrev, onNext, onToday, onQR, onMenu, onSync, syncStatus, room, roomRole, onQuickAdd }) {
  const label = statusLabel(syncStatus, room)
  const colors = statusColor(syncStatus)
  return (
    <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-900/80 px-3 py-2 sm:px-4 sm:py-3">
      <div className="flex items-baseline gap-2 sm:gap-3">
        <button
          onClick={onMenu}
          className="rounded-md border border-brand-2/40 px-2 py-1 text-brand-2 hover:bg-brand-2/10"
          title="Menú"
        >
          ☰
        </button>
        <h1 className="text-[length:clamp(1rem,1.2vw,1.5rem)] font-bold text-brand">Tu Día</h1>
        <span className="hidden text-[length:clamp(0.7rem,0.8vw,1rem)] font-light text-brand-2 sm:block">Planifica tu tiempo, visualízalo y ejecuta.</span>
      </div>
      <div className="flex items-center gap-1.5 sm:gap-2">
        {room && (
          <span className={[
            'rounded-md border px-2 py-0.5 text-[length:clamp(7px,0.6vw,10px)] font-bold uppercase',
            roomRole === 'viewer'
              ? 'border-sky-500/50 text-sky-400'
              : 'border-emerald-500/50 text-emerald-400',
          ].join(' ')}>
            {roomRole === 'viewer' ? 'Solo lectura' : 'Editor'}
          </span>
        )}
        <button
          onClick={onSync}
          className={[
            'flex items-center gap-1.5 rounded-md border px-2 py-1 text-[length:clamp(0.65rem,0.7vw,0.9rem)] font-bold sm:text-sm',
            colors.border, colors.text, 'hover:bg-white/5',
          ].join(' ')}
          title={room ? `Sala ${room} · ${label}` : 'Sincronizar dispositivos'}
        >
          <span className={`h-2 w-2 rounded-full ${colors.dot}`} />
          {room || 'Sync'}
        </button>
        {onQuickAdd && (
          <button
            onClick={onQuickAdd}
            className="hidden rounded-md border border-brand px-2 py-1 text-[length:clamp(0.65rem,0.7vw,0.9rem)] font-bold text-brand hover:bg-brand/10 sm:block"
            title="Tarea rápida (Ctrl+K)"
          >
            + Rápida
          </button>
        )}
        <button
          onClick={onQR}
          className="rounded-md border border-brand/50 px-2 py-1 text-[length:clamp(0.65rem,0.7vw,0.9rem)] font-bold text-brand hover:bg-brand/10 sm:text-sm"
          title="Ver QR"
        >
          QR
        </button>
        <button onClick={onPrev} className="rounded-md border border-brand-2/40 px-2 py-1 text-brand-2 hover:bg-brand-2/10">
          ‹
        </button>
        <span className="w-28 text-center text-[length:clamp(0.75rem,0.9vw,1.2rem)] font-semibold text-slate-200 sm:w-32">
          {monthName(month)} {year}
        </span>
        <button onClick={onNext} className="rounded-md border border-brand-2/40 px-2 py-1 text-brand-2 hover:bg-brand-2/10">
          ›
        </button>
        <button onClick={onToday} className="hidden rounded-md border border-brand-2/40 px-2 py-1 text-[length:clamp(0.65rem,0.7vw,0.9rem)] text-brand-2 hover:bg-brand-2/10 sm:block">
          Hoy
        </button>
      </div>
    </header>
  )
}
