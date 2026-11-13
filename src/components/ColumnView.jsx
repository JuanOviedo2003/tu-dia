import { cx } from '../lib/cx'
import IconButton from './ui/IconButton'
import StatusIcon from './ui/StatusIcon'

export default function ColumnView({ status, count, isOver, isViewer, onAdd, children }) {
  return (
    <section
      aria-label={status.label}
      className={cx(
        'transition-ui flex min-h-80 flex-1 flex-col rounded-lg border p-3',
        isOver ? 'border-accent bg-accent-subtle' : 'border-line bg-s1',
      )}
    >
      <header className="flex h-11 items-center gap-2">
        <span className={cx('flex items-center gap-2', status.text)}>
          <StatusIcon status={status.key} size={16} />
          <h3 className="text-heading font-semibold">{status.label}</h3>
        </span>
        <span className="text-heading font-medium text-t2">· {count}</span>
        {!isViewer && (
          <IconButton icon="plus" label={`Añadir a ${status.label}`} onClick={onAdd} className="ml-auto -mr-2" />
        )}
      </header>
      <div className="flex flex-1 flex-col gap-2.5">
        {children}
        {isOver ? (
          <div className="flex min-h-16 flex-1 items-center justify-center rounded-md border-2 border-dashed border-accent px-3 text-center text-body font-medium text-accent">
            Suelta aquí · toda la columna acepta
          </div>
        ) : (
          count === 0 && <p className="py-4 text-center text-small font-medium text-t3">Sin tareas</p>
        )}
      </div>
    </section>
  )
}
