import { STATUSES } from '../lib/constants'
import { formatDuration } from '../lib/time'
import RepeatField from './RepeatField'
import Button from './ui/Button'
import { Field, Input, Select, Textarea } from './ui/Field'
import StatusButton from './ui/StatusButton'
import StatusIcon from './ui/StatusIcon'

export default function TaskFormView({
  form,
  onFieldChange,
  showRepeat,
  repeat,
  onRepeatChange,
  duration,
  onDurationChange,
  ruleHint,
  repeatWarning,
  durationOptions,
  isEditing,
  hasSeries,
  seriesCount,
  saveDisabled,
  onSubmit,
  onCancel,
  onDelete,
  onDeleteSeries,
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
      className="space-y-4"
    >
      <Field label="Título">
        <Input autoFocus value={form.title} onChange={(e) => onFieldChange('title')(e.target.value)} placeholder="Ej. Reunión de equipo" />
      </Field>

      <Field label="Descripción">
        <Textarea rows={2} value={form.description} onChange={(e) => onFieldChange('description')(e.target.value)} placeholder="Detalles (opcional)" />
      </Field>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Día">
          <Input type="date" value={form.day} onChange={(e) => onFieldChange('day')(e.target.value)} />
        </Field>
        <Field label="Inicio">
          <Input type="time" step="60" value={form.start} onChange={(e) => onFieldChange('start')(e.target.value)} />
        </Field>
      </div>

      <Field label="Duración" hint="Se ve en la línea de tiempo">
        <Select value={form.durationMinutes} onChange={(e) => onFieldChange('durationMinutes')(e.target.value)}>
          <option value="">Sin duración</option>
          {durationOptions.map((m) => (
            <option key={m} value={m}>
              {formatDuration(m)}
            </option>
          ))}
        </Select>
      </Field>

      <div>
        <span className="mb-1 block text-small font-medium text-t2">Estado</span>
        <div role="group" aria-label="Estado" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {STATUSES.map((s) => (
            <StatusButton
              key={s.key}
              status={s}
              active={form.status === s.key}
              onClick={() => onFieldChange('status')(s.key)}
              className="flex h-11 items-center justify-center gap-1.5 rounded-md border px-2 text-small"
              inactiveClassName="border-line-strong bg-s2 font-medium text-t2 hover:bg-s3"
            >
              <StatusIcon status={s.key} size={14} />
              {s.label}
            </StatusButton>
          ))}
        </div>
      </div>

      {showRepeat && (
        <RepeatField
          repeat={repeat}
          onRepeatChange={onRepeatChange}
          duration={duration}
          onDurationChange={onDurationChange}
          hint={ruleHint}
          warning={repeatWarning}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex flex-wrap items-center gap-2">
          {isEditing && hasSeries && (
            <Button variant="danger" onClick={onDeleteSeries}>
              Eliminar serie ({seriesCount || 1})
            </Button>
          )}
          {isEditing && (
            <Button variant="danger" onClick={onDelete}>
              Eliminar
            </Button>
          )}
        </div>
        <div className="ml-auto flex gap-2">
          <Button onClick={onCancel}>Cancelar</Button>
          <Button type="submit" variant="primary" disabled={saveDisabled}>
            Guardar
          </Button>
        </div>
      </div>
    </form>
  )
}
