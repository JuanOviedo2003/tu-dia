import { useRef } from 'react'
import { cx } from '../lib/cx'
import Chip from './ui/Chip'
import ChipMenu from './ui/ChipMenu'
import Icon from './ui/Icon'
import StatusIcon from './ui/StatusIcon'

function CustomInput({ custom }) {
  const submit = (e) => {
    e.preventDefault()
    const value = new FormData(e.currentTarget).get('value')
    if (value) custom.onApply(value)
  }
  return (
    <form onSubmit={submit} className="mt-1 flex items-center gap-2 border-t border-line px-3 pt-2">
      <label className="sr-only" htmlFor={`chip-custom-${custom.type}`}>
        {custom.label}
      </label>
      <input
        id={`chip-custom-${custom.type}`}
        name="value"
        type={custom.type}
        defaultValue={custom.initial}
        className="min-h-11 min-w-0 flex-1 rounded-sm border border-line-strong bg-s1 px-2 text-body text-t1"
      />
      <button type="submit" className="rounded-sm px-3 text-body font-medium text-accent hover:bg-accent-subtle">
        Aplicar
      </button>
    </form>
  )
}

function FieldChip({ field, open, onToggle, onClose }) {
  const anchorRef = useRef(null)
  return (
    <span className="inline-flex">
      <button
        ref={anchorRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${field.name}: ${field.label}${field.edited ? ' (editado)' : ''}`}
        onClick={onToggle}
        className="-my-2 inline-flex items-center rounded-sm"
      >
        <span
          className={cx(
            'inline-flex items-center gap-1 rounded-sm border px-2 py-1 text-small font-medium',
            field.tone ?? 'border-line bg-s1 text-t1',
          )}
        >
          {field.status && <StatusIcon status={field.status} size={12} />}
          {field.repeat && <Icon name="repeat" size={12} />}
          {field.label}
          {field.edited && <span aria-hidden="true" className="ml-0.5 size-1.5 rounded-full bg-accent" />}
        </span>
      </button>
      <ChipMenu
        open={open}
        label={field.name}
        options={field.options}
        value={field.value}
        onSelect={field.onSelect}
        onClose={onClose}
        anchorRef={anchorRef}
        extra={field.custom && <CustomInput custom={field.custom} />}
      />
    </span>
  )
}

export default function QuickAddPreviewCard({ card, showHint }) {
  return (
    <div className="mt-2 rounded-md border border-line bg-s2 px-3.5 py-2.5" aria-label="Vista previa de la tarea" role="group">
      <div className="flex flex-wrap items-center gap-2">
        {card.titleMissing ? (
          <>
            <p className="text-body font-medium text-t3">Sin título</p>
            <Chip tone="danger" icon={<StatusIcon status="danger" size={12} />}>
              Falta el título
            </Chip>
          </>
        ) : (
          <p className="min-w-0 break-words text-body font-medium text-t1">{card.title}</p>
        )}
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-3">
        {card.fields.map((field) => (
          <FieldChip
            key={field.key}
            field={field}
            open={card.openField === field.key}
            onToggle={() => card.onOpenField(card.openField === field.key ? null : field.key)}
            onClose={() => card.onOpenField(null)}
          />
        ))}
        {card.needsDay && (
          <Chip tone="danger" icon={<StatusIcon status="danger" size={12} />}>
            Falta el día para repetir
          </Chip>
        )}
        {card.doubts.map((doubt) => (
          <Chip key={doubt} tone="warning">
            {doubt}
          </Chip>
        ))}
      </div>
      {showHint && <p className="mt-2 text-caption text-t3">Enter para guardar, Shift+Enter para otra tarea</p>}
    </div>
  )
}
