import { useState } from 'react'

const CLOSED_MODAL = { open: false, initial: null, defaultDay: null, defaultStatus: 'todo', groupCount: 0 }

function withoutIdentity(task) {
  const { id, updatedAt, ...rest } = task
  return rest
}

export function useTaskActions({ api, isViewer, isMobile, selectedDay, toast }) {
  const { tasks, addTask, updateTask, removeTask, setStatus, addRecurringTasks, removeAllInGroup } = api
  const [modal, setModal] = useState(CLOSED_MODAL)
  const [sheetId, setSheetId] = useState(null)

  const editable = (fn) => (...args) => {
    if (!isViewer) return fn(...args)
  }

  const closeModal = () => setModal(CLOSED_MODAL)

  const openNew = editable(({ day = selectedDay, status = 'todo' } = {}) => {
    setModal({ ...CLOSED_MODAL, open: true, defaultDay: day, defaultStatus: status })
  })

  const openEdit = editable((task) => {
    setModal({
      open: true,
      initial: task,
      defaultDay: task.day,
      defaultStatus: task.status,
      groupCount: task.groupId ? tasks.filter((t) => t.groupId === task.groupId).length : 0,
    })
  })

  const save = editable((data) => {
    if (modal.initial) updateTask(modal.initial.id, data)
    else addTask(data)
    closeModal()
  })

  const saveRecurring = editable((data, opts) => {
    addRecurringTasks(data, opts)
    closeModal()
  })

  const remove = editable((id) => {
    const task = tasks.find((t) => t.id === id)
    removeTask(id)
    closeModal()
    if (task) toast.show('Tarea eliminada', () => addTask(withoutIdentity(task)))
  })

  const removeSeries = editable((groupId) => {
    const removed = tasks.filter((t) => t.groupId === groupId)
    removeAllInGroup(groupId)
    closeModal()
    toast.show(`Serie eliminada (${removed.length} tareas)`, () => removed.forEach((t) => addTask(withoutIdentity(t))))
  })

  const quickCreate = editable((data, repeatOpts) => {
    if (repeatOpts) {
      const created = addRecurringTasks(data, repeatOpts)
      if (created.length > 0) {
        const groupId = created[0].groupId
        toast.show(`Serie creada (${created.length} tareas)`, () => removeAllInGroup(groupId))
      }
      return
    }
    const task = addTask(data)
    toast.show('Tarea creada', () => removeTask(task.id))
  })

  const sheetTask = sheetId ? tasks.find((t) => t.id === sheetId) ?? null : null

  const actions = {
    open: (task) => (isMobile ? setSheetId(task.id) : openEdit(task)),
    setStatus,
  }

  return {
    actions,
    modal,
    openNew,
    closeModal,
    save,
    saveRecurring,
    remove,
    removeSeries,
    quickCreate,
    sheet: {
      task: sheetTask,
      close: () => setSheetId(null),
      setStatus: (status) => {
        if (sheetTask) setStatus(sheetTask.id, status)
        setSheetId(null)
      },
      edit: () => {
        const task = sheetTask
        setSheetId(null)
        if (task) openEdit(task)
      },
    },
  }
}
