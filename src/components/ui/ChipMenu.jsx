import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cx } from '../../lib/cx'

const GAP = 4
const MARGIN = 8
const ITEMS = '[role="menuitemradio"],input,button[type="submit"]'

function viewportHeight() {
  return window.visualViewport?.height ?? window.innerHeight
}

function place(anchor, menu) {
  const a = anchor.getBoundingClientRect()
  const height = menu.offsetHeight
  const width = menu.offsetWidth
  const below = viewportHeight() - a.bottom - GAP - MARGIN
  const above = a.top - GAP - MARGIN
  const up = height > below && above > below
  const space = Math.max(120, up ? above : below)
  const shown = Math.min(height, space)
  const top = up ? a.top - GAP - shown : a.bottom + GAP
  const left = Math.max(MARGIN, Math.min(a.left, window.innerWidth - width - MARGIN))
  return { top, left, maxHeight: space }
}

export default function ChipMenu({ open, label, options, value, onSelect, onClose, anchorRef, extra }) {
  const menuRef = useRef(null)
  const [pos, setPos] = useState(null)
  const closer = useRef(onClose)
  closer.current = onClose

  useLayoutEffect(() => {
    if (!open) {
      setPos(null)
      return undefined
    }
    const update = () => {
      if (anchorRef.current && menuRef.current) setPos(place(anchorRef.current, menuRef.current))
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    window.visualViewport?.addEventListener('resize', update)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update)
    observer?.observe(anchorRef.current)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
      window.visualViewport?.removeEventListener('resize', update)
      observer?.disconnect()
    }
  }, [open, anchorRef])

  useEffect(() => {
    if (!open) return
    const menu = menuRef.current
    const active = menu.querySelector('[aria-checked="true"]') ?? menu.querySelector(ITEMS)
    active?.focus({ preventScroll: true })
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const menu = menuRef.current
    const onDown = (e) => {
      if (menu.contains(e.target) || anchorRef.current?.contains(e.target)) return
      closer.current()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
    }
  }, [open, anchorRef])

  if (!open) return null

  const close = () => {
    anchorRef.current?.focus()
    onClose()
  }

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      e.preventDefault()
      close()
    } else if (e.key === 'Tab') {
      const items = [...menuRef.current.querySelectorAll(ITEMS)]
      const edge = e.shiftKey ? items[0] : items[items.length - 1]
      if (e.target.getAttribute('role') === 'menuitemradio' || e.target === edge) close()
    } else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && e.target.tagName !== 'INPUT') {
      e.preventDefault()
      const items = [...menuRef.current.querySelectorAll(ITEMS)]
      const i = items.indexOf(document.activeElement)
      const next = e.key === 'ArrowDown' ? (i + 1) % items.length : (i <= 0 ? items.length : i) - 1
      items[next].focus()
    }
  }

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label={label}
      onKeyDown={onKeyDown}
      style={pos ?? { top: 0, left: 0, opacity: 0 }}
      className="fixed z-[60] min-w-48 overflow-y-auto rounded-md border border-line bg-s2 py-1 shadow-menu"
    >
      {options.map((option) => {
        const checked = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="menuitemradio"
            aria-checked={checked}
            onClick={() => {
              anchorRef.current?.focus()
              onSelect(option.value)
            }}
            className={cx(
              'flex w-full items-center px-3 text-left text-body text-t1 hover:bg-s1',
              checked && 'bg-accent-subtle font-medium',
              option.reset && 'text-t2',
            )}
          >
            {option.label}
          </button>
        )
      })}
      {extra}
    </div>,
    document.body,
  )
}
