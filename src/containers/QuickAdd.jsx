import { useLayoutEffect, useRef } from 'react'
import { useQuickAdd } from '../hooks/useQuickAdd'
import { useSpeechInput } from '../hooks/useSpeechInput'
import QuickAddBarView from '../components/QuickAddBarView'

const PLACEHOLDERS = {
  desktop: 'llamar a Ana mañana 15:00',
  mobile: 'Añadir… «gym 7pm»',
}
const MAX_LINES = 5
const FALLBACK_LINE_HEIGHT = 24

export default function QuickAdd({ defaultDay, tasks, onCreate, size = 'desktop', inputRef }) {
  const localRef = useRef(null)
  const fieldRef = inputRef ?? localRef
  const quick = useQuickAdd({ defaultDay, tasks, onCreate, onFieldSelected: () => fieldRef.current?.focus() })
  const speech = useSpeechInput({ text: quick.text, onText: quick.setText })
  const backdropRef = useRef(null)

  useLayoutEffect(() => {
    const el = fieldRef.current
    if (!el) return
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || FALLBACK_LINE_HEIGHT
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, lineHeight * MAX_LINES)}px`
  }, [quick.text, fieldRef])

  const submit = (keepOpen = false) => {
    speech.cancel()
    quick.submit(keepOpen)
    if (keepOpen) fieldRef.current?.focus()
  }

  const onRootKeyDown = (e) => {
    if (e.nativeEvent.isComposing) return
    if (e.key === 'Escape' && speech.listening) {
      e.preventDefault()
      e.stopPropagation()
      speech.stop()
      return
    }
    if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || !quick.card) return
    const match = /^Digit([1-5])$/.exec(e.code)
    const field = match && e.key === match[1] && quick.card.fields[Number(match[1]) - 1]
    if (!field) return
    e.preventDefault()
    const closing = quick.card.openField === field.key
    quick.card.onOpenField(closing ? null : field.key)
    if (closing) fieldRef.current?.focus()
  }

  const onKeyDown = (e) => {
    if (e.nativeEvent.isComposing) return
    if (e.key === 'Escape' && speech.listening) return
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
      submit(e.ctrlKey || e.metaKey)
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
      segments={quick.segments}
      onTextChange={quick.setText}
      onSubmit={() => (quick.canCreate ? submit(false) : fieldRef.current?.focus())}
      onSubmitKeep={() => submit(true)}
      onRootKeyDown={onRootKeyDown}
      speech={speech.supported ? speech : null}
      onKeyDown={onKeyDown}
      inputRef={fieldRef}
      backdropRef={backdropRef}
      placeholder={PLACEHOLDERS[size]}
      canCreate={quick.canCreate}
      card={quick.card}
      preview={quick.preview}
      suggestions={quick.suggestions}
      onPickSuggestion={quick.pick}
      showHint={size === 'desktop'}
    />
  )
}
