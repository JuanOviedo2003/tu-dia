import IconButton from './ui/IconButton'

export default function BacklogPanel({ count, isOver, isViewer, onNew, onClose, variant = 'aside', children }) {
  return (
    <>
      <div className="flex min-h-11 items-center gap-2">
        <h2 className="text-heading font-semibold text-t1">Sin programar</h2>
        <span className="text-small font-medium text-t2">{count}</span>
        <div className="flex-1" />
        {!isViewer && onNew && <IconButton icon="plus" label="Añadir sin programar" onClick={onNew} />}
        {variant === 'drawer' && <IconButton icon="close" label="Cerrar" onClick={onClose} />}
      </div>
      <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto">
        {count === 0 && (
          <p className="py-3 text-center text-small font-medium text-t2">
            {isOver ? 'Suelta aquí para desprogramar' : 'Sin tareas'}
          </p>
        )}
        {children}
      </div>
      {!isViewer && <p className="text-caption font-medium text-t3">Arrastra a una columna para programarla hoy</p>}
    </>
  )
}
