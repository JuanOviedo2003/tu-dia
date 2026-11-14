import { useEffect, useRef } from 'react'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import QuickAdd from './QuickAdd'

export default function QuickAddSheet({ open, defaultDay, tasks, onCreate, onMoreDetails, onClose }) {
  const inputRef = useRef(null)

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const create = (entries, meta) => {
    const result = onCreate(entries, meta)
    if (result !== false && !meta?.keepOpen) onClose()
    return result
  }

  return (
    <Modal open={open} onClose={onClose} title="Añadir tarea">
      <QuickAdd defaultDay={defaultDay} tasks={tasks} onCreate={create} size="mobile" inputRef={inputRef} />
      <Button variant="secondary" onClick={onMoreDetails} className="mt-4 h-12 w-full">
        Más detalles
      </Button>
    </Modal>
  )
}
