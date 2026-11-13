import { useCallback, useEffect, useRef, useState } from 'react'

const TOAST_MS = 5000

export function useToast() {
  const [toast, setToast] = useState(null)
  const onUndo = useRef(null)

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), TOAST_MS)
    return () => clearTimeout(timer)
  }, [toast])

  const show = useCallback((label, undoFn) => {
    onUndo.current = undoFn
    setToast({ label })
  }, [])

  const undo = useCallback(() => {
    onUndo.current?.()
    setToast(null)
  }, [])

  return { toast, show, undo }
}
