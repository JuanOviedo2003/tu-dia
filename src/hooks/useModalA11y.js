import { useEffect, useRef } from 'react'

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
const stack = []

function syncInert() {
  const top = stack[stack.length - 1]
  document.getElementById('root')?.toggleAttribute('inert', stack.length > 0)
  stack.forEach((entry) => entry.panel.parentElement?.toggleAttribute('inert', entry !== top))
}

export function hasOpenModal() {
  return stack.length > 0
}

export function useModalA11y(open, panelRef, onClose, initialFocusRef) {
  const handler = useRef(onClose)
  const origin = useRef(null)

  useEffect(() => {
    handler.current = onClose
  })

  if (open && !origin.current) origin.current = document.activeElement
  if (!open) origin.current = null

  useEffect(() => {
    if (!open) return undefined
    const panel = panelRef.current
    const entry = { panel }
    const back = origin.current
    stack.push(entry)
    syncInert()

    if (!panel.contains(document.activeElement)) {
      const target = initialFocusRef?.current ?? panel.querySelector(FOCUSABLE) ?? panel
      target.focus()
    }

    const onKey = (e) => {
      if (stack[stack.length - 1] !== entry) return
      if (e.key === 'Escape') {
        handler.current?.()
        return
      }
      if (e.key !== 'Tab') return
      const items = [...panel.querySelectorAll(FOCUSABLE)]
      if (items.length === 0) {
        e.preventDefault()
        panel.focus()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (e.shiftKey && (active === first || !panel.contains(active))) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (active === last || !panel.contains(active))) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)

    return () => {
      window.removeEventListener('keydown', onKey)
      stack.splice(stack.indexOf(entry), 1)
      syncInert()
      if (back?.isConnected) back.focus()
    }
  }, [open, panelRef, initialFocusRef])
}
