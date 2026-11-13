import { useDraggable, useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'

export function Draggable({ id, data, disabled = false, className, style, onKeyDown, children, ...rest }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id, data, disabled })
  const lockedToTimeline = data?.from === 'timeline'
  const dragStyle = lockedToTimeline && transform ? CSS.Translate.toString({ ...transform, x: 0 }) : undefined

  const handleKeyDown = (event) => {
    if (!isDragging) onKeyDown?.(event)
    if (!event.defaultPrevented) listeners?.onKeyDown?.(event)
  }

  return (
    <div
      ref={setNodeRef}
      {...(disabled ? {} : attributes)}
      {...(disabled ? {} : listeners)}
      {...rest}
      onKeyDown={disabled ? onKeyDown : handleKeyDown}
      className={className}
      style={{
        ...style,
        opacity: isDragging && !lockedToTimeline ? 0.35 : 1,
        transform: dragStyle,
        touchAction: disabled ? 'auto' : lockedToTimeline ? 'none' : 'manipulation',
        cursor: disabled ? 'default' : 'grab',
      }}
    >
      {typeof children === 'function' ? children({ isDragging }) : children}
    </div>
  )
}

export function Droppable({ id, disabled = false, as: Tag = 'div', className, style, children, ...rest }) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled })
  const over = isOver && !disabled
  return (
    <Tag ref={setNodeRef} className={className} style={style} data-over={over ? '1' : '0'} {...rest}>
      {typeof children === 'function' ? children({ isOver: over }) : children}
    </Tag>
  )
}
