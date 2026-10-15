import { useDraggable, useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'

export function Draggable({ id, data, children, className = '', style, disabled = false }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id, data, disabled })
  // Solo timeline mueve su propio bloque (re-tiempo vertical dentro del carril).
  // Calendario/columnas/backlog: elemento queda quieto (tenue); el clon visual
  // lo lleva DragOverlay -> no se recorta por overflow de columnas ni pasa
  // por debajo del kanban.
  const isTimeline = data?.from === 'timeline'
  // Timeline: solo movimiento vertical dentro del carril (x bloqueado, sin
  // salir del contenedor). Resto: elemento quieto, DragOverlay clona.
  const dragStyle = isTimeline && transform ? CSS.Translate.toString({ ...transform, x: 0 }) : undefined
  return (
    <div
      ref={setNodeRef}
      {...(disabled ? {} : attributes)}
      {...(disabled ? {} : listeners)}
      className={className}
      style={{
        ...style,
        opacity: isDragging && !isTimeline ? 0.3 : 1,
        transform: dragStyle,
        touchAction: disabled ? 'auto' : 'none',
        cursor: disabled ? 'default' : 'grab',
      }}
    >
      {children}
    </div>
  )
}

export function Droppable({ id, children, className = '', style, disabled = false }) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled })
  return (
    <div ref={setNodeRef} className={className} style={style} data-over={disabled ? '0' : (isOver ? '1' : '0')}>
      {children}
    </div>
  )
}
