import { useRef } from 'react'

const MIN_DISTANCE = 60

export function useSwipe({ onLeft, onRight, disabled = false }) {
  const start = useRef(null)

  if (disabled) return {}

  return {
    onTouchStart: (e) => {
      const touch = e.touches[0]
      start.current = { x: touch.clientX, y: touch.clientY }
    },
    onTouchEnd: (e) => {
      if (!start.current) return
      const touch = e.changedTouches[0]
      const dx = touch.clientX - start.current.x
      const dy = touch.clientY - start.current.y
      start.current = null
      if (Math.abs(dx) < MIN_DISTANCE || Math.abs(dx) < Math.abs(dy) * 2) return
      if (dx < 0) onLeft?.()
      else onRight?.()
    },
  }
}
