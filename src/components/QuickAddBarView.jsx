import { cx } from '../lib/cx'
import Button from './ui/Button'
import Chip from './ui/Chip'
import Fab from './ui/Fab'
import Icon from './ui/Icon'
import Kbd from './ui/Kbd'
import StatusIcon from './ui/StatusIcon'

export default function QuickAddBarView({ size = 'desktop', text, onTextChange, onSubmit, onKeyDown, inputRef, placeholder, canCreate, chips, showHint }) {
  const mobile = size === 'mobile'
  return (
    <div>
      <div className="flex items-center gap-3">
        <div
          className={cx(
            'flex flex-1 items-center gap-2 border border-line-strong bg-s2 px-3 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent',
            mobile ? 'h-[52px] rounded-[12px]' : 'h-12 rounded-md',
          )}
        >
          <span className="text-t2">
            <Icon name="plus" size={18} />
          </span>
          <label htmlFor="quick-add-input" className="sr-only">
            Añadir tarea rápida
          </label>
          <input
            id="quick-add-input"
            ref={inputRef}
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            enterKeyHint="done"
            autoComplete="off"
            className={cx(
              'h-full min-w-0 flex-1 border-0 bg-transparent text-t1 outline-none placeholder:text-t3',
              mobile ? 'text-body-m' : 'text-body',
            )}
          />
          {!mobile && !text && <Kbd>N</Kbd>}
        </div>
        {mobile ? (
          <Fab label="Añadir tarea" onClick={onSubmit} />
        ) : (
          <Button variant="primary" icon="plus" onClick={onSubmit} disabled={!canCreate}>
            Añadir
          </Button>
        )}
      </div>
      {chips && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {chips.titleMissing && (
            <Chip tone="danger" icon={<StatusIcon status="danger" size={12} />}>
              Falta el título
            </Chip>
          )}
          <Chip tone="accent">{chips.dayLabel}</Chip>
          <Chip tone="accent">{chips.timeLabel}</Chip>
          {chips.repeatLabel && (
            <Chip tone="accent" icon={<Icon name="repeat" size={12} />}>
              {chips.repeatLabel}
            </Chip>
          )}
          {chips.needsDay && (
            <Chip tone="danger" icon={<StatusIcon status="danger" size={12} />}>
              Falta el día para repetir
            </Chip>
          )}
          {showHint && <span className="text-caption text-t3">Enter para guardar, sin abrir el modal</span>}
        </div>
      )}
    </div>
  )
}
