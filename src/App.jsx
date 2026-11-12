import { useEffect, useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  MeasuringStrategy,
} from '@dnd-kit/core'
import { MINUTES_PER_DAY, statusMeta } from './lib/constants'
import { minutesToLabel } from './lib/time'
import { useTasks } from './hooks/useTasks'
import { todayStr } from './lib/storage'
import { readShareTasks, clearShareParam, compressTasks } from './lib/share'
import Toolbar from './components/Toolbar'
import Sidebar from './components/Sidebar'
import Calendar from './components/Calendar'
import DayBoard from './components/DayBoard'
import TaskModal from './components/TaskModal'
import QuickAddBar from './components/QuickAddBar'
import QRModal from './components/QRModal'
import SyncModal from './components/SyncModal'

// Estados de sala: idle (local), validating, denied, not-found, editor, viewer
const ROOM_STATES = { IDLE: 'idle', VALIDATING: 'validating', DENIED: 'denied', NOT_FOUND: 'not-found', EDITOR: 'editor', VIEWER: 'viewer' }

export default function App() {
  const {
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
    createRoom,
    rotateTokens,
  } = useTasks()

  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())

  const [selectedDay, setSelectedDay] = useState(null)
  const [modal, setModal] = useState({ open: false, initial: null, defaultDay: null })
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [qrOpen, setQrOpen] = useState(false)
  const [syncOpen, setSyncOpen] = useState(false)
  const [shareD, setShareD] = useState('')
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [toast, setToast] = useState(null) // { label, onUndo } captura rápida
  const [devInfo, setDevInfo] = useState(null)
  // Clon visual del arrastre (DragOverlay). La apariencia cambia según la
  // vista de origen: barra fina (calendario), tarjeta (kanban/backlog).
  // Timeline mueve su propio bloque (re-tiempo) -> sin overlay.
  const [activeDrag, setActiveDrag] = useState(null) // { id, task }
  const timelineRef = useRef(null)

  // ── Room state machine ────────────────────────────────────────────────
  const [roomState, setRoomState] = useState(ROOM_STATES.IDLE)
  const [roomCode, setRoomCode] = useState('')
  const [roomRole, setRoomRole] = useState('') // 'editor' | 'viewer'

  // Parseo URL: ?room=CODE&t=TOKEN
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const urlRoom = params.get('room')
    const urlToken = params.get('t')
const urlRole = params.get('role')
    if (urlRoom && urlToken) {
      const code = urlRoom.toUpperCase().replace(/-V$/, '')
      setRoomCode(code)
      setRoomState(ROOM_STATES.VALIDATING)
      // El sync se inicia cuando auth esté listo (useTasks maneja auth)
      initSync(code, urlToken, urlRole || 'editor') // TODO: determinar role por token
      // Limpiar URL sin recargar
      const url = new URL(window.location.href)
      url.searchParams.delete('room')
      url.searchParams.delete('t')
      url.searchParams.delete('role')
      window.history.replaceState({}, '', url.toString())
    } else if (urlRoom) {
      // Legacy: ?room=CODE sin token → denegar
      setRoomCode(urlRoom.toUpperCase().replace(/-V$/, ''))
      setRoomState(ROOM_STATES.DENIED)
    }
  }, []) // solo al montar

  // Observar syncStatus para determinar estado de sala
  useEffect(() => {
    if (syncStatus === 'online' && roomState === ROOM_STATES.VALIDATING) {
      setRoomState(ROOM_STATES.EDITOR) // o VIEWER, se determina después
    } else if (syncStatus === 'auth-error') {
      setRoomState(ROOM_STATES.DENIED)
    } else if (syncStatus === 'room-not-found') {
      setRoomState(ROOM_STATES.NOT_FOUND)
    }
  }, [syncStatus, roomState])

  const isViewer = roomState === ROOM_STATES.VIEWER
  const inRoom = roomState === ROOM_STATES.EDITOR || roomState === ROOM_STATES.VIEWER

  // ── URL share data ───────────────────────────────────────────────────
  useEffect(() => {
    const shared = readShareTasks()
    if (shared) {
      replaceTasks(shared)
      clearShareParam()
    }
  }, [replaceTasks])

  useEffect(() => {
    fetch('/__dev-info')
      .then((r) => r.json())
      .then((d) => setDevInfo(d))
      .catch(() => setDevInfo({ ips: [], port: null }))
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  )

  const openDay = (dateStr) => setSelectedDay(dateStr)
  const openNew = (defaultDay = null) => setModal({ open: true, initial: null, defaultDay, groupCount: 0 })
  const openEdit = (task) => {
    if (isViewer) return
    setModal({
      open: true,
      initial: task,
      defaultDay: task.day,
      groupCount: task.groupId ? tasks.filter((t) => t.groupId === task.groupId).length : 0,
    })
  }
  const closeModal = () => setModal({ open: false, initial: null, defaultDay: null, groupCount: 0 })

  const handleSave = (data) => {
    if (isViewer) return
    if (modal.initial) updateTask(modal.initial.id, data)
    else addTask(data)
    closeModal()
  }

  const handleSaveRecurring = (data, opts) => {
    if (isViewer) return
    addRecurringTasks(data, opts)
    closeModal()
  }

  const handleDelete = (id) => {
    if (isViewer) return
    removeTask(id)
    closeModal()
  }

  const handleDeleteSeries = (groupId) => {
    removeAllInGroup(groupId)
    closeModal()
  }

  // ── Captura rápida (Quick-add): Ctrl+K, botón toolbar, FAB móvil ──────
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setQuickAddOpen((v) => {
          if (v) return false
          return !isViewer && !selectedDay
        })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isViewer, selectedDay])

  // Toast con deshacer: auto-cierre a los 5s.
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(t)
  }, [toast])

  const handleQuickCreate = (data, repeatOpts) => {
    if (isViewer) return
    if (repeatOpts) {
      const created = addRecurringTasks(data, repeatOpts)
      if (created.length > 0) {
        const groupId = created[0].groupId
        setToast({
          label: `Serie creada (${created.length} tareas)`,
          onUndo: () => removeAllInGroup(groupId),
        })
      }
    } else {
      const task = addTask(data)
      setToast({
        label: data.day ? 'Tarea creada' : 'Tarea creada en Sin programar',
        onUndo: () => removeTask(task.id),
      })
    }
  }

  const changeMonth = (delta) => {
    let m = month + delta
    let y = year
    if (m < 0) { m = 11; y-- }
    if (m > 11) { m = 0; y++ }
    setMonth(m)
    setYear(y)
  }

  const goToday = () => {
    const d = new Date()
    setYear(d.getFullYear())
    setMonth(d.getMonth())
  }

  const openQR = () => {
    setShareD(compressTasks(tasks))
    setQrOpen(true)
  }

const joinRoom = (code, token, role) => {
  setRoomCode(code)
  setRoomState(ROOM_STATES.VALIDATING)
  initSync(code, token, role || 'editor')
  setSyncOpen(false)
}

  const createNewRoom = async () => {
    const result = await createRoom()
    if (result.ok) {
      setRoomCode(result.roomCode)
      setRoomState(ROOM_STATES.EDITOR)
      initSync(result.roomCode, result.editToken, 'editor')
    }
    return result
  }

  const handleRotateTokens = async () => {
    if (!roomCode) return
    return await rotateTokens(roomCode)
  }

  const handleDragStart = (event) => {
    if (isViewer) return
    const task = event.active.data.current?.task ?? null
    if (task) setActiveDrag({ id: String(event.active.id), task })
  }

  const handleDragEnd = (event) => {
    if (isViewer) {
      setActiveDrag(null)
      return
    }
    const { active, over } = event
    const fromTimeline = active.data.current?.from === 'timeline'
    setActiveDrag(null)
    if (!over) return
    const task = active.data.current?.task
    if (!task) return
    const overId = String(over.id)
    // Timeline solo re-tiempo: no permitir soltar bloque sobre kanban/día.
    if (fromTimeline && overId !== 'timeline') return
    if (overId.startsWith('col:')) {
      const status = overId.slice(4)
      const patch = { status }
      if (selectedDay && task.day !== selectedDay) patch.day = selectedDay
      updateTask(task.id, patch)
    } else if (overId === 'backlog') {
      moveTaskDay(task.id, null)
    } else if (overId.startsWith('day:')) {
      moveTaskDay(task.id, overId.slice(4))
    } else if (overId === 'timeline') {
      const el = timelineRef.current
      const translated = active.rect.current?.translated
      if (el && translated) {
        const trackRect = el.getBoundingClientRect()
        const yWithin = translated.top - trackRect.top + el.scrollTop
        const rangeStart = Number(el.dataset.rangeStart || 0)
        const rangeEnd = Number(el.dataset.rangeEnd || MINUTES_PER_DAY)
        let mins = rangeStart + (yWithin / el.scrollHeight) * (rangeEnd - rangeStart)
        mins = Math.max(0, Math.min(MINUTES_PER_DAY - 1, Math.round(mins)))
        setStartTime(task.id, mins)
      }
    }
  }

  // ── UI: sala no encontrada ────────────────────────────────────────────
  if (roomState === ROOM_STATES.NOT_FOUND) {
    return (
      <div className="flex h-[100dvh] flex-col items-center justify-center bg-slate-950 text-slate-100 p-4">
        <div className="max-w-sm text-center">
          <div className="mb-4 text-4xl">🚫</div>
          <h2 className="mb-2 text-lg font-bold text-brand">Sala no encontrada</h2>
          <p className="mb-4 text-sm text-slate-400">
            Esta sala no existe o fue eliminada. Crea una sala nueva o pide un link actualizado.
          </p>
          <button
            onClick={() => { setRoomState(ROOM_STATES.IDLE); setRoomCode(''); }}
            className="rounded-md bg-brand px-4 py-2 text-sm font-bold text-slate-900 hover:bg-brand/90"
          >
            Volver al modo local
          </button>
        </div>
      </div>
    )
  }

  // ── UI: pantalla de sala privada (denegado) ──────────────────────────
  if (roomState === ROOM_STATES.DENIED) {
    return (
      <div className="flex h-[100dvh] flex-col items-center justify-center bg-slate-950 text-slate-100 p-4">
        <div className="max-w-sm text-center">
          <div className="mb-4 text-4xl">🔒</div>
          <h2 className="mb-2 text-lg font-bold text-brand">Sala privada</h2>
          <p className="mb-4 text-sm text-slate-400">
            No tienes acceso a esta sala. Pide al anfitrión un link válido con token.
          </p>
          <button
            onClick={() => { setRoomState(ROOM_STATES.IDLE); setRoomCode(''); }}
            className="rounded-md bg-brand px-4 py-2 text-sm font-bold text-slate-900 hover:bg-brand/90"
          >
            Volver al modo local
          </button>
        </div>
      </div>
    )
  }

  // ── UI: validando ────────────────────────────────────────────────────
  if (roomState === ROOM_STATES.VALIDATING) {
    return (
      <div className="flex h-[100dvh] flex-col items-center justify-center bg-slate-950 text-slate-100 p-4">
        <div className="max-w-sm text-center">
          <div className="mb-4 text-4xl">⏳</div>
          <h2 className="mb-2 text-lg font-bold text-brand">Validando acceso...</h2>
          <p className="text-sm text-slate-400">Verificando token de sala.</p>
        </div>
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      // Timeline solo vive en su carril: excluir todos los demás droppables
      // cuando el drag nace en la línea de tiempo.
      collisionDetection={(args) => {
        if (args.active?.data?.current?.from === 'timeline') {
          const containers = args.droppableContainers.filter((c) => c.id === 'timeline')
          return pointerWithin({ ...args, droppableContainers: containers })
        }
        return rectIntersection(args)
      }}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
    >
      <div className="flex h-[100dvh] flex-col bg-slate-950 text-slate-100">
        <Toolbar
          year={year}
          month={month}
          onPrev={() => changeMonth(-1)}
          onNext={() => changeMonth(1)}
          onToday={goToday}
          onQR={openQR}
          onMenu={() => setSidebarOpen(true)}
          onSync={() => setSyncOpen(true)}
          syncStatus={syncStatus}
          room={inRoom ? roomCode : ''}
          roomRole={inRoom ? roomRole : ''}
          onQuickAdd={!isViewer ? () => setQuickAddOpen(true) : undefined}
        />
        {!selectedDay && (
          <div className="flex flex-1 min-h-0">
            <Sidebar
              tasks={tasks}
              onNewTask={openNew}
              onEdit={openEdit}
              onDelete={removeTask}
              open={sidebarOpen}
              onClose={() => setSidebarOpen(false)}
              isViewer={isViewer}
            />
            <main className="flex flex-1 flex-col min-w-0">
              <div className="flex-1 pt-4 sm:pt-6 px-4 sm:px-6 min-h-0">
                <Calendar year={year} month={month} tasks={tasks} onOpenDay={openDay} isViewer={isViewer} />
              </div>
            </main>
          </div>
        )}

        <DayBoard
          dateStr={selectedDay}
          tasks={tasks}
          onClose={() => setSelectedDay(null)}
          onNewTask={openNew}
          onEdit={openEdit}
          onDelete={removeTask}
          timelineRef={timelineRef}
          isViewer={isViewer}
        />

        <TaskModal
          open={modal.open}
          initial={modal.initial}
          defaultDay={modal.defaultDay || todayStr()}
          groupCount={modal.groupCount}
          onSave={handleSave}
          onDelete={handleDelete}
          onSaveRecurring={handleSaveRecurring}
          onDeleteSeries={handleDeleteSeries}
          onUpdateRule={updateRecurringRule}
          onClose={closeModal}
        />

        <QRModal d={qrOpen ? shareD : ''} devInfo={qrOpen ? devInfo : null} onClose={() => setQrOpen(false)} />

        <SyncModal
          open={syncOpen}
          onClose={() => setSyncOpen(false)}
          currentRoom={inRoom ? roomCode : ''}
          currentRole={roomRole}
          onJoin={joinRoom}
          onCreateRoom={createNewRoom}
          onRotateTokens={handleRotateTokens}
          syncStatus={syncStatus}
        />

        <QuickAddBar
          open={quickAddOpen}
          onClose={() => setQuickAddOpen(false)}
          onCreate={handleQuickCreate}
        />

        {/* FAB móvil: captura rápida flotante en vista calendario */}
        {!selectedDay && !isViewer && (
          <button
            onClick={() => setQuickAddOpen(true)}
            className="fixed bottom-5 right-5 z-40 flex items-center gap-1.5 rounded-full bg-brand px-4 py-3 text-sm font-bold text-slate-900 shadow-2xl hover:bg-brand/90 sm:hidden"
            title="Tarea rápida"
          >
            ✎ Rápida
          </button>
        )}

        {/* Toast captura rápida con deshacer */}
        {toast && (
          <div className="fixed bottom-20 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 shadow-2xl sm:bottom-5">
            <span className="text-sm text-slate-200">{toast.label}</span>
            <button
              onClick={() => {
                toast.onUndo?.()
                setToast(null)
              }}
              className="text-sm font-bold text-brand hover:text-brand/90"
            >
              Deshacer
            </button>
          </div>
        )}
      </div>

        {/* Clon visual del elemento arrastrado. Calendario -> barra fina;
          kanban/backlog -> tarjeta. Timeline no usa overlay. */}
      <DragOverlay>
        {activeDrag && !activeDrag.id.startsWith('tl:') ? (
          <DragPreview id={activeDrag.id} task={activeDrag.task} />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

// Réplica visual del elemento bajo el puntero durante el arrastre.
function DragPreview({ id, task }) {
  const meta = statusMeta(task.status)
  // Barra del calendario (misma apariencia que TaskBar)
  if (id.startsWith('cal:')) {
    return (
      <div
        className="mx-0.5 opacity-95"
        style={{ background: meta.color, color: meta.text, height: 'clamp(14px,1.15vw,30px)' }}
      >
        <div className="truncate rounded border border-black/10 px-1 text-[length:clamp(10px,0.7vw,16px)] leading-tight">
          {task.title}
        </div>
      </div>
    )
  }
  // Tarjeta del kanban / backlog (misma apariencia que TaskCard)
  return (
    <div className="rounded-md border border-brand-2/40 bg-slate-800 p-2 text-xs shadow-2xl">
      <div className="flex items-start gap-2">
        <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: meta.color }} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-slate-100">{task.title}</p>
          {task.day && (
            <p className="mt-0.5 text-[10px] text-slate-500">{minutesToLabel(task.startMinutes)}</p>
          )}
        </div>
      </div>
    </div>
  )
}
