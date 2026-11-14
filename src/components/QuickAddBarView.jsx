import { cx } from '../lib/cx'
import Button from './ui/Button'
import Chip from './ui/Chip'
import Icon from './ui/Icon'
import Kbd from './ui/Kbd'
import StatusIcon from './ui/StatusIcon'

export default function QuickAddBarView({
  size = 'desktop',
  text,
  onTextChange,
  onSubmit,
  onKeyDown,
  inputRef,
  placeholder,
  canCreate,
  chips,
  preview,
  suggestions,
  onPickSuggestion,
  showHint,
}) {
  const mobile = size === 'mobile'
  const listOpen = suggestions.items.length > 0
  const optionId = (i) => `${suggestions.listId}-${i}`
  return (
    <div>
      <div className="flex items-start gap-3">
        <div className="relative min-w-0 flex-1">
          <div
            className={cx(
              'flex items-start gap-2 border border-line-strong bg-s2 px-3 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent',
              mobile ? 'min-h-[52px] rounded-[12px] py-3.5' : 'min-h-12 rounded-md py-3',
            )}
          >
            <span className="flex h-6 items-center text-t2">
              <Icon name="plus" size={18} />
            </span>
            <label htmlFor="quick-add-input" className="sr-only">
              Añadir tarea rápida
            </label>
            <textarea
              id="quick-add-input"
              ref={inputRef}
              rows={1}
              value={text}
              onChange={(e) => onTextChange(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={placeholder}
              enterKeyHint="done"
              autoComplete="off"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={listOpen}
              aria-controls={suggestions.listId}
              aria-activedescendant={listOpen && suggestions.activeIndex >= 0 ? optionId(suggestions.activeIndex) : undefined}
              className={cx(
                'block min-w-0 flex-1 resize-none border-0 bg-transparent p-0 text-t1 outline-none placeholder:text-t3',
                mobile ? 'text-body-m' : 'text-body',
              )}
            />
            {!mobile && !text && (
              <span className="flex h-6 items-center">
                <Kbd>N</Kbd>
              </span>
            )}
          </div>
          <ul
            id={suggestions.listId}
            role="listbox"
            aria-label="Sugerencias"
            hidden={!listOpen}
            className={cx(
              'mt-1 overflow-hidden rounded-md border border-line bg-s2 shadow-menu',
              !mobile && 'absolute inset-x-0 top-full z-20',
            )}
          >
            {suggestions.items.map((title, i) => (
              <li
                key={title}
                id={optionId(i)}
                role="option"
                aria-selected={i === suggestions.activeIndex}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onPickSuggestion(i)}
                className={cx(
                  'flex min-h-11 cursor-pointer items-center truncate px-3 text-body text-t1',
                  i === suggestions.activeIndex ? 'bg-accent-subtle' : 'hover:bg-s1',
                )}
              >
                {title}
              </li>
            ))}
          </ul>
        </div>
        <Button variant="primary" icon="plus" onClick={onSubmit} disabled={!canCreate} className={mobile ? 'h-[52px]' : 'h-12'}>
          Añadir
        </Button>
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
          {chips.statusLabel && <Chip tone="accent">{chips.statusLabel}</Chip>}
          {chips.durationLabel && <Chip tone="accent">{chips.durationLabel}</Chip>}
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
          {chips.doubts.map((doubt) => (
            <Chip key={doubt} tone="warning">
              {doubt}
            </Chip>
          ))}
          {showHint && <span className="text-caption text-t3">Enter para guardar, Shift+Enter para otra tarea</span>}
        </div>
      )}
      {preview && (
        <div className="mt-2">
          <p className="text-small font-medium text-t2">{preview.count === 1 ? '1 tarea' : `${preview.count} tareas`}</p>
          <ul className="mt-1 flex flex-col gap-1">
            {preview.items.map((item, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 truncate text-small text-t1">{item.title || 'Sin título'}</span>
                <Chip tone="accent">{item.dayLabel}</Chip>
                <Chip tone="accent">{item.timeLabel}</Chip>
                {item.review && <Chip tone="warning">Revisar</Chip>}
                {item.problem && <Chip tone="danger">{item.problem}</Chip>}
              </li>
            ))}
          </ul>
          {preview.more > 0 && <p className="mt-1 text-small text-t3">{`+${preview.more} más`}</p>}
          {preview.overflow > 0 && (
            <p className="mt-1 text-small text-doing">
              {`Máx. ${preview.maxLines} tareas por vez: se ignorarán ${preview.overflow} ${preview.overflow === 1 ? 'línea' : 'líneas'}`}
            </p>
          )}
          {preview.invalid > 0 && (
            <p className="mt-1 text-small text-doing">
              {preview.invalid === 1 ? '1 línea se ignorará' : `${preview.invalid} líneas se ignorarán`}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
