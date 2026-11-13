import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { loadTasks, saveTasks, loadTombstones, saveTombstones } from '../lib/storage'
import { uid } from '../lib/constants'
import { createSync } from '../lib/sync'
import { generateRecurring, nextOccurrence } from '../lib/recurring'
import { generateRoomTokens, generateToken, sha256Hash } from '../lib/tokens'

const stamp = () => Date.now()

export function useTasks(roomRole) {
  const [tasks, setTasks] = useState(loadTasks)
  const [tombstones, setTombstones] = useState(loadTombstones)
  const [syncStatus, setSyncStatus] = useState('offline')

  const tasksRef = useRef(tasks)
  const tombRef = useRef(tombstones)
  tasksRef.current = tasks
  tombRef.current = tombstones

  const applyingRemote = useRef(false)

  const sync = useMemo(
    () => {
      const s = createSync({
        getState: () => ({ tasks: tasksRef.current, tombstones: tombRef.current }),
        onState: (next) => {
          applyingRemote.current = true
          setTasks(next.tasks)
          setTombstones(next.tombstones)
          applyingRemote.current = false
        },
        onStatus: (s) => setSyncStatus(s),
      })
      return s
    },
    [],
  )

  useEffect(() => {
    saveTasks(tasks)
  }, [tasks])

  useEffect(() => {
    saveTombstones(tombstones)
  }, [tombstones])

  // Empuja cambios al servidor (debounced dentro del sync). Al aplicar estado
  // remoto se marca applyingRemote; el efecto lo consume y omite el push para
  // no crear un bucle de eco (el servidor ya difundió ese estado).
  useEffect(() => {
    if (applyingRemote.current) {
      applyingRemote.current = false
      return
    }
    sync.push({ tasks, tombstones })
  }, [tasks, tombstones, sync])

  const addTask = useCallback((data) => {
    const task = { id: uid(), updatedAt: stamp(), ...data }
    setTasks((prev) => [...prev, task])
    return task
  }, [])

  const updateTask = useCallback((id, patch) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch, updatedAt: stamp() } : t)))
  }, [])

  const removeTask = useCallback((id) => {
    setTasks((prev) => prev.filter((t) => t.id !== id))
    const ts = stamp()
    setTombstones((prev) => ({ ...prev, [id]: ts }))
  }, [])

  const moveTaskDay = useCallback(
    (id, day) => {
      updateTask(id, { day })
    },
    [updateTask],
  )

  // setStatus con auto-avance de serie recurrente.
  const setStatus = useCallback(
    (id, status) => {
      const current = tasksRef.current
      const task = current.find((t) => t.id === id)
      if (!task) {
        updateTask(id, { status })
        return
      }

      // Si cambia a 'done' y es parte de una serie, intentar avanzar.
      if (status === 'done' && task.groupId) {
        const group = current.filter((t) => t.groupId === task.groupId)
        // Encontrar la tarea más reciente (mayor day) del grupo
        const sorted = group
          .filter((t) => t.day)
          .sort((a, b) => (a.day > b.day ? 1 : a.day < b.day ? -1 : 0))
        const latest = sorted[sorted.length - 1]

        // Solo avanzar si la tarea completada ES la más reciente del grupo
        if (latest && latest.id === task.id) {
          const pattern = task.pattern || 'month'
          const windowMonths = task.windowMonths || 6
          const baseDay = task.baseDay || task.day
          const next = nextOccurrence(task.day, pattern, windowMonths, baseDay)

          // Marcar la tarea actual como done primero
          updateTask(id, { status })

          // Crear la siguiente si existe
          if (next) {
            const newTask = {
              id: uid(),
              title: task.title,
              description: task.description || '',
              day: next,
              startMinutes: task.startMinutes,
              status: 'todo',
              updatedAt: stamp(),
              groupId: task.groupId,
              pattern,
              windowMonths,
              baseDay,
            }
            setTasks((prev) => [...prev, newTask])
          }
          // Si next es null, la serie se cierra (no se genera más)
          return
        }
        // Si no es la más reciente, solo marcar done sin avanzar
      }

      updateTask(id, { status })
    },
    [updateTask],
  )

  const setStartTime = useCallback(
    (id, startMinutes) => {
      updateTask(id, { startMinutes })
    },
    [updateTask],
  )

  const replaceTasks = useCallback((next) => {
    setTombstones({})
    setTasks(Array.isArray(next) ? next.map((t) => ({ ...t, updatedAt: t.updatedAt || stamp() })) : [])
  }, [])

  // Crea la serie recurrente (incluida la base) con groupId compartido.
  // Cada tarea lleva pattern, windowMonths, baseDay para auto-avance.
  const addRecurringTasks = useCallback((base, { pattern, months }) => {
    const days = generateRecurring(base.day, pattern, months)
    const groupId = uid()
    const created = days.map((day) => ({
      id: uid(),
      title: base.title,
      description: base.description || '',
      day,
      startMinutes: base.startMinutes,
      status: base.status,
      updatedAt: stamp(),
      groupId,
      pattern,
      windowMonths: months,
      baseDay: base.day,
    }))
    setTasks((prev) => [...prev, ...created])
    return created
  }, [])

  // Borra toda la serie: filtra y registra tombstone por cada id del grupo.
  const removeAllInGroup = useCallback((groupId) => {
    const ts = stamp()
    const removed = tasksRef.current.filter((t) => t.groupId === groupId)
    setTasks((prev) => prev.filter((t) => t.groupId !== groupId))
    setTombstones((prev) => {
      const next = { ...prev }
      for (const t of removed) next[t.id] = ts
      return next
    })
  }, [])

  // Edición de regla: al cambiar pattern/windowMonths/baseDay en una tarea de grupo,
  // elimina pendientes futuras y crea la siguiente con la nueva regla.
  const updateRecurringRule = useCallback((id, newPattern, newWindowMonths, newBaseDay) => {
    const current = tasksRef.current
    const task = current.find((t) => t.id === id)
    if (!task || !task.groupId) return

    const groupId = task.groupId
    const group = current.filter((t) => t.groupId === groupId)

    // Encontrar la última tarea completada (o base si ninguna está hecha)
    const doneTasks = group.filter((t) => t.status === 'done' && t.day)
    const sorted = [...doneTasks].sort((a, b) => (a.day > b.day ? 1 : a.day < b.day ? -1 : 0))
    const lastDone = sorted[sorted.length - 1]

    // La referencia para calcular la siguiente es la última hecha, o la base
    const refDay = lastDone ? lastDone.day : newBaseDay

    // Calcular la siguiente ocurrencia con la nueva regla
    const next = nextOccurrence(refDay, newPattern, newWindowMonths, newBaseDay)

    // Tombstone de todas las pendientes (status != done) del grupo
    const ts = stamp()
    const pending = group.filter((t) => t.status !== 'done')
    setTasks((prev) => {
      // Eliminar pendientes
      let filtered = prev.filter((t) => !(t.groupId === groupId && t.status !== 'done'))

      // Crear nueva pendiente si existe siguiente
      if (next) {
        const baseTask = lastDone || task
        filtered = [
          ...filtered,
          {
            id: uid(),
            title: baseTask.title,
            description: baseTask.description || '',
            day: next,
            startMinutes: baseTask.startMinutes,
            status: 'todo',
            updatedAt: stamp(),
            groupId,
            pattern: newPattern,
            windowMonths: newWindowMonths,
            baseDay: newBaseDay,
          },
        ]
      }

      return filtered
    })

    // Registrar tombstones
    if (pending.length > 0) {
      setTombstones((prev) => {
        const next = { ...prev }
        for (const t of pending) next[t.id] = ts
        return next
      })
    }
  }, [])

  const initSync = useCallback(
    (roomId, token, role, discardLocal = false) => {
      if (discardLocal) {
        tasksRef.current = []
        tombRef.current = {}
        setTasks([])
        setTombstones({})
      }
      return sync.start(roomId, token, role)
    },
    [sync],
  )

  // Crea sala nueva: genera código + tokens, crea doc en Firestore
  // con el snapshot completo de tareas y tombstones locales.
  const createRoomSync = useCallback(async () => {
    const roomCode = uid().slice(0, 10).toUpperCase()
    const tokens = await generateRoomTokens()
    const result = await sync.createRoom(roomCode, tokens.editTokenHash, tokens.viewTokenHash, tasks, tombstones)
    if (!result.ok) return { ok: false, error: result.error }
    return { ok: true, roomCode, editToken: tokens.editToken, viewToken: tokens.viewToken }
  }, [sync, tasks, tombstones])

  const renewViewTokenSync = useCallback(async (roomCode) => {
    const viewToken = generateToken()
    const result = await sync.renewViewToken(roomCode, sha256Hash(viewToken))
    if (!result.ok) return { ok: false, error: result.error }
    return { ok: true, viewToken }
  }, [sync])

  const rotateEditTokenSync = useCallback(async (roomCode) => {
    const editToken = generateToken()
    const result = await sync.rotateEditToken(roomCode, sha256Hash(editToken), editToken)
    if (!result.ok) return { ok: false, error: result.error }
    return { ok: true, editToken }
  }, [sync])

  return {
    tasks,
    syncStatus,
    addTask,
    updateTask,
    removeTask,
    moveTaskDay,
    setStatus,
    setStartTime,
    replaceTasks,
    addRecurringTasks,
    removeAllInGroup,
    updateRecurringRule,
    initSync,
    createRoom: createRoomSync,
    renewViewToken: renewViewTokenSync,
    rotateEditToken: rotateEditTokenSync,
    stop: sync.stop,
  }
}
