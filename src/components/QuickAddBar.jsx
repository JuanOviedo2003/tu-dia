import { useEffect, useMemo, useRef, useState } from 'react'
import { STATUSES } from '../lib/constants'
import { parseQuickAdd } from '../lib/quickAdd'
import { minutesToLabel } from '../lib/time'
import { fromDateStr, todayStr } from '../lib/storage'
import { durationLabel, previewCount } from '../lib/recurring'

const REPEAT_OPTS = [
  ['none', 'No'],
  ['week', 'Cada semana'],
  ['month', 'Cada mes'],
]

// Etiqueta corta del día detectado: Hoy / Mañana / fecha relativa / inbox.
function dayChipLabel(dayStr) {
  if (!dayStr) return 'Sin programar'
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`
  if (dayStr === todayStr()) return 'Hoy'
  if (dayStr === tomorrowStr) return 'Mañana'
  const d = fromDateStr(dayStr)
  return d ? d.toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' }) : dayStr
}

// Barra de captura rápida (Ctrl+K / botón "+ Rápida" / FAB móvil).
// Parsea texto natural con chrono-node (es): día/hora/recurrencia.
// Título, Estado y Repetir son obligatorios de confirmar (defaults: todo / No).
export default function QuickAddBar({ open, onClose, onCreate }) {
  const [text, setText] = useState('')
  const [status, setStatus] = useState('todo')
  const [repeat, setRepeat] = useState('none')
  const [duration, setDuration] = useState(6)
  const inputRef = useRef(null)

  const parsedFactory = useMemo(() => parseQuickAdd(text), [text])
  const parsed = parsedFactory || { title: '', day: null, startMinutes: 540, repeat: 'none' }

  useEffect(() => {
    if (!open) return
    setText('')
    setStatus('todo')
    setRepeat('none')
    setDuration(6)
  }, [open])

  // Si el parser detecta "cada semana/mes", preseleccionar el chip Repetir.
  useEffect(() => {
    if (parsed.repeat !== 'none') setRepeat(parsed.repeat)
  }, [parsed.repeat])

  if (!open) return null

  const titleOk = parsed.title.trim().length > 0
  const canCreate = titleOk && (repeat === 'none' || !!parsed.day)
  const preview =
    repeat !== 'none' && parsed.day ? previewCount(parsed.day, repeat, Number(duration)) : 0

  const handleCreate = () => {
    if (!canCreate) return
    const data = {
      title: parsed.title.trim(),
      description: '',
      day: parsed.day,
      startMinutes: parsed.startMinutes,
      status,
    }
    onCreate(data, repeat !== 'none' ? { pattern: repeat, months: Number(duration) } : null)
    onClose()
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter') handleCreate()
    if (e.key === 'Escape') onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-16 sm:pt-24" onClick={onClose}>
      <div
        className="w-full rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-2xl sm:max-w-md sm:p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[length:clamp(0.8rem,0.9vw,1.1rem)] font-bold text-slate-100">Tarea rápida</h3>
          <span className="hidden text-[10px] text-slate-500 sm:block">Ctrl+K</span>
        </div>

        <input
          ref={inputRef}
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          className="mb-3 w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand"
          placeholder='Ej. "mañana 15:00 dentista"'
        />

        {/* Vista previa del parseo */}
        {text.trim() && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            <span className={['rounded border px-2 py-0.5 text-xs', titleOk ? 'border-brand/50 text-brand' : 'border-rose-500/50 text-rose-400']}>
              {titleOk ? parsed.title : 'Falta el título'}
            </span>
            <span className="rounded border border-slate-700 px-2 py-0.5 text-xs text-slate-300">
              {dayChipLabel(parsed.day)}
            </span>
            <span className="rounded border border-slate-700 px-2 py-0.5 text-xs text-slate-300">
              {minutesToLabel(parsed.startMinutes)}
            </span>
          </div>
        )}

        {/* Estado (obligatorio, default: Por hacer) */}
        <div className="mb-3">
          <span className="mb-1 block text-xs text-slate-400">Estado</span>
          <div className="flex flex-wrap gap-1.5">
            {STATUSES.map((s) => (
              <button
                type="button"
                key={s.key}
                onClick={() => setStatus(s.key)}
                className={[
                  'flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs',
                  status === s.key
                    ? 'border-brand bg-brand/15 text-brand'
                    : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-brand',
                ].join(' ')}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Repetir (obligatorio confirmar, default: No) */}
        <div className="mb-3">
          <span className="mb-1 block text-xs text-slate-400">Repetir</span>
          <div className="flex gap-2">
            {REPEAT_OPTS.map(([v, l]) => (
              <button
                type="button"
                key={v}
                onClick={() => setRepeat(v)}
                className={[
                  'flex-1 rounded-md border px-2 py-1.5 text-xs',
                  repeat === v
                    ? 'border-brand bg-brand/15 text-brand'
                    : 'border-slate-700 bg-slate-800 text-slate-200 hover:border-brand',
                ].join(' ')}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {repeat !== 'none' && (
          <div className="mb-3">
            <span className="mb-1 block text-xs text-slate-400">Duracion</span>
            <select
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand"
            >
              {[2, 3, 4, 6, 12].map((m) => (
                <option key={m} value={m}>{durationLabel(repeat, m)}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-400">
              {parsed.day ? `Se crearan ${preview} tareas` : 'Elige texto con un dia para repetir la tarea.'}
            </p>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-brand-2/40 px-4 py-2 text-sm text-brand-2 hover:bg-brand-2/10">
            Cancelar
          </button>
          <button
            onClick={handleCreate}
            disabled={!canCreate}
            className={[
              'rounded-md bg-brand px-4 py-2 text-sm font-bold text-slate-900',
              !canCreate ? 'cursor-not-allowed opacity-40' : 'hover:bg-brand/90',
            ].join(' ')}
          >
            Crear
          </button>
        </div>
      </div>
    </div>
  )
}
