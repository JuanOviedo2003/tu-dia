import { useEffect, useState } from 'react'
import { STATUSES } from '../lib/constants'
import { minutesToLabel, labelToMinutes } from '../lib/time'
import { todayStr } from '../lib/storage'
import { generateRecurring, previewCount, clampWarning, durationLabel } from '../lib/recurring'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const normalizeDay = (d) => (typeof d === 'string' && DATE_RE.test(d) ? d : '')

function emptyForm(defaultDay) {
  return {
    title: '',
    description: '',
    day: normalizeDay(defaultDay),
    start: '09:00',
    status: 'todo',
  }
}

// Formulario de creacion/edicion de tarea.
export default function TaskModal({ open, initial, defaultDay, onSave, onDelete, onSaveRecurring, onDeleteSeries, onUpdateRule, groupCount, onClose }) {
  const [form, setForm] = useState(emptyForm(defaultDay))
  const [repeat, setRepeat] = useState('none')
  const [duration, setDuration] = useState(6)

  useEffect(() => {
    if (!open) return
    if (initial) {
      setForm({
        title: initial.title || '',
        description: initial.description || '',
        day: normalizeDay(initial.day),
        start: minutesToLabel(initial.startMinutes),
        status: initial.status || 'todo',
      })
      // Si es edición de tarea con grupo, cargar la regla existente
      if (initial.groupId && initial.pattern) {
        setRepeat(initial.pattern)
        setDuration(initial.windowMonths || 6)
      } else {
        setRepeat('none')
        setDuration(6)
      }
    } else {
      setForm(emptyForm(defaultDay))
      setRepeat('none')
      setDuration(6)
    }
  }, [open, initial, defaultDay])

  if (!open) return null

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const preview = !initial && repeat !== 'none' && form.day
    ? previewCount(form.day, repeat, Number(duration))
    : 0

  const clamp = !initial && repeat !== 'none' && form.day
    ? clampWarning(form.day)
    : null

  const handleSave = () => {
    if (!form.title.trim()) return
    const data = {
      title: form.title.trim(),
      description: form.description.trim(),
      day: form.day || null,
      startMinutes: labelToMinutes(form.start),
      status: form.status,
    }
    // Crear nueva serie recurrente
    if (!initial && repeat !== 'none') {
      if (!form.day) return
      onSaveRecurring(data, { pattern: repeat, months: Number(duration) })
      return
    }
    // Editar tarea existente: si tiene grupo y cambió la regla, actualizar
    if (initial && initial.groupId && repeat !== 'none') {
      const ruleChanged =
        initial.pattern !== repeat ||
        initial.windowMonths !== Number(duration) ||
        initial.baseDay !== form.day
      if (ruleChanged && onUpdateRule) {
        onUpdateRule(initial.id, repeat, Number(duration), form.day || initial.day)
      }
    }
    onSave(data)
  }

  const saveDisabled = !form.title.trim()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-4 text-lg font-bold text-slate-100">{initial ? 'Editar tarea' : 'Nueva tarea'}</h3>

        <label className="mb-3 block">
          <span className="mb-1 block text-xs text-slate-400">Titulo</span>
          <input
            autoFocus
            value={form.title}
            onChange={set('title')}
            className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand"
            placeholder="Ej. Reunion de equipo"
          />
        </label>

        <label className="mb-3 block">
          <span className="mb-1 block text-xs text-slate-400">Descripcion</span>
          <textarea
            value={form.description}
            onChange={set('description')}
            rows={2}
            className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand"
            placeholder="Detalles (opcional)"
          />
        </label>

        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-xs text-slate-400">Dia</span>
            <input
              type="date"
              value={form.day}
              onChange={set('day')}
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-slate-400">Estado</span>
            <select
              value={form.status}
              onChange={set('status')}
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand"
            >
              {STATUSES.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-slate-400">Inicio</span>
            <input
              type="time"
              step="60"
              value={form.start}
              onChange={set('start')}
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-2 text-sm text-slate-100 outline-none focus:border-brand"
            />
          </label>
        </div>

        {/* Selector de repetición: nueva tarea O edición con grupo */}
        {(!initial || (initial && initial.groupId)) && (
          <div className="mb-4 space-y-3">
            <div>
              <span className="mb-1 block text-xs text-slate-400">Repetir</span>
              <div className="flex gap-2">
                {[['none', 'No'], ['month', 'Cada mes'], ['week', 'Cada semana']].map(([v, l]) => (
                  <button
                    type="button"
                    key={v}
                    onClick={() => setRepeat(v)}
                    className={[
                      'flex-1 rounded-md border px-2 py-2 text-sm',
                      repeat === v ? 'border-brand bg-brand/15 text-brand' : 'border-slate-700 bg-slate-800 text-slate-200 hover:border-brand',
                    ].join(' ')}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
            {repeat !== 'none' && (
              <div>
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
              </div>
            )}
            {repeat !== 'none' && form.day && (
              <p className="text-xs text-slate-400">
                {initial && initial.groupId
                  ? `Regla: ${repeat === 'month' ? 'Cada mes' : 'Cada semana'} durante ${duration} meses`
                  : `Se crearan ${preview} tareas`}
              </p>
            )}
            {clamp && repeat !== 'none' && form.day && (
              <p className="text-xs text-amber-300">{clamp}</p>
            )}
            {repeat !== 'none' && !form.day && (
              <p className="text-xs text-amber-300">Elige un dia para repetir la tarea.</p>
            )}
          </div>
        )}

        <div className="flex items-center justify-between">
          {initial ? (
            <div className="flex items-center gap-3">
              {initial.groupId && (
                <button
                  onClick={() => onDeleteSeries(initial.groupId)}
                  className="text-sm text-rose-400 hover:text-rose-300"
                >
                  Eliminar serie ({groupCount || 1})
                </button>
              )}
              <button
                onClick={() => onDelete(initial.id)}
                className="text-sm text-rose-400 hover:text-rose-300"
              >
                Eliminar
              </button>
            </div>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-md border border-brand-2/40 px-4 py-2 text-sm text-brand-2 hover:bg-brand-2/10">
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saveDisabled}
              className={[
                'rounded-md bg-brand px-4 py-2 text-sm font-bold text-slate-900',
                saveDisabled ? 'cursor-not-allowed opacity-40' : 'hover:bg-brand/90',
              ].join(' ')}
            >
              Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
