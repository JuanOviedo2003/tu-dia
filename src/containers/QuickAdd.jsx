import { useLayoutEffect, useRef } from 'react'
import { useQuickAdd } from '../hooks/useQuickAdd'
import QuickAddBarView from '../components/QuickAddBarView'

const PLACEHOLDERS = {
  desktop: 'llamar a Ana mañana 15:00',
  mobile: 'Añadir… «gym 7pm»',
}
const MAX_LINES = 5
const FALLBACK_LINE_HEIGHT = 24

export default function QuickAdd({ defaultDay, tasks, onCreate, size = 'desktop', inputRef }) {
  const quick = useQuickAdd({ defaultDay, tasks, onCreate })
  const localRef = useRef(null)
  const fieldRef = inputRef ?? localRef

  useLayoutEffect(() => {
    const el = fieldRef.current
    if (!el) return
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || FALLBACK_LINE_HEIGHT
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, lineHeight * MAX_LINES)}px`
  }, [quick.text, fieldRef])

  const onKeyDown = (e) => {
    if (e.nativeEvent.isComposing) return
    const { items, activeIndex } = quick.suggestions
    const listOpen = items.length > 0
    if (listOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault()
      quick.moveActive(e.key === 'ArrowDown' ? 1 : -1)
    } else if (listOpen && activeIndex >= 0 && (e.key === 'Enter' || e.key === 'Tab')) {
      e.preventDefault()
      e.stopPropagation()
      quick.pick(activeIndex)
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      quick.submit()
    } else if (e.key === 'Escape') {
      if (listOpen) {
        e.stopPropagation()
        quick.closeList()
      } else {
        quick.reset()
        e.currentTarget.blur()
      }
    }
  }

  return (
    <QuickAddBarView
      size={size}
      text={quick.text}
      onTextChange={quick.setText}
      onSubmit={quick.canCreate ? quick.submit : () => fieldRef.current?.focus()}
      onKeyDown={onKeyDown}
      inputRef={fieldRef}
      placeholder={PLACEHOLDERS[size]}
      canCreate={quick.canCreate}
      chips={quick.chips}
      preview={quick.preview}
      suggestions={quick.suggestions}
      onPickSuggestion={quick.pick}
      showHint={size === 'desktop'}
    />
  )
}
