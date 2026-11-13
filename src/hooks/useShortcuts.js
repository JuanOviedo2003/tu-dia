import { useEffect, useRef } from 'react'

const EDITABLE = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

function isTyping(target) {
  return target instanceof HTMLElement && (EDITABLE.has(target.tagName) || target.isContentEditable)
}

export function useShortcuts({ enabled, onNew, onPrev, onNext, onToday }) {
  const handlers = useRef({})
  handlers.current = { onNew, onPrev, onNext, onToday }

  useEffect(() => {
    if (!enabled) return
    const onKey = (e) => {
      if (e.defaultPrevented) return
      const key = e.key?.toLowerCase()
      if ((e.ctrlKey || e.metaKey) && key === 'k') {
        e.preventDefault()
        handlers.current.onNew()
        return
      }
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return
      if (document.querySelector('[role="dialog"]')) return
      const action = { n: 'onNew', t: 'onToday', arrowleft: 'onPrev', arrowright: 'onNext' }[key]
      if (!action) return
      e.preventDefault()
      handlers.current[action]()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled])
}
