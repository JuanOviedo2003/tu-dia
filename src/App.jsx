import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { DndContext, DragOverlay } from '@dnd-kit/core'
import { dayProgress, tasksForDay, unscheduledTasks } from './lib/agenda'
import { cx } from './lib/cx'
import { minutesToLabel } from './lib/time'
import { useIsMobile } from './hooks/useMediaQuery'
import { ROOM_STATES, useAgenda } from './hooks/useAgenda'
import { useAgendaDnd } from './hooks/useAgendaDnd'
import { useAgendaNav } from './hooks/useAgendaNav'
import { useShortcuts } from './hooks/useShortcuts'
import { useTaskActions } from './hooks/useTaskActions'
import { useToast } from './hooks/useToast'
import AppHeader from './components/AppHeader'
import BottomNav from './components/BottomNav'
import ConfirmDialog from './components/ConfirmDialog'
import MobileMenu from './components/MobileMenu'
import StatusSheet from './components/StatusSheet'
import TaskCardView from './components/TaskCardView'
import FullScreenMessage from './components/ui/FullScreenMessage'
import Toast from './components/ui/Toast'
import Backlog from './containers/Backlog'
import DayView from './containers/DayView'
import TaskFormModal from './containers/TaskFormModal'
const loadMonthView = () => import('./containers/MonthView')
const loadShareModal = () => import('./containers/ShareModal')
const loadTimelineView = () => import('./containers/TimelineView')
const MonthView = lazy(loadMonthView)
const ShareModal = lazy(loadShareModal)
const TimelineView = lazy(loadTimelineView)

const preloadLazyViews = () => {
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 2000))
  idle(() => [loadMonthView, loadTimelineView, loadShareModal].forEach((load) => load().catch(() => undefined)))
}

const MOBILE_MAX_WIDTH = 599

export default function App() {
  useEffect(preloadLazyViews, [])
  const { api, room, requestJoin, pendingJoin, confirmJoin, cancelJoin, createNewRoom, renewViewToken, rotateEditToken, leaveRoom, backToLocal } =
    useAgenda()
  const isMobile = useIsMobile(MOBILE_MAX_WIDTH)
  const nav = useAgendaNav()
  const toast = useToast()
  const isViewer = room.isViewer
  const ui = useTaskActions({ api, isViewer, isMobile, selectedDay: nav.selectedDay, toast })
  const { activeDrag, timelineRef, dndProps } = useAgendaDnd({
    isViewer,
    selectedDay: nav.selectedDay,
    scheduleOnDrop: nav.view !== 'month',
    api,
  })

  const [shareOpen, setShareOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [backlogOpen, setBacklogOpen] = useState(false)
  const [focusRequest, setFocusRequest] = useState(0)
  const quickAddRef = useRef(null)

  const { view, setView } = nav

  useEffect(() => {
    if (focusRequest && view === 'day') {
      quickAddRef.current?.focus()
      setFocusRequest(0)
    }
  }, [focusRequest, view])

  useShortcuts({
    enabled: !activeDrag,
    onNew: () => {
      if (isViewer) return
      setView('day')
      setFocusRequest((n) => n + 1)
    },
    onPrev: nav.goPrev,
    onNext: nav.goNext,
    onToday: nav.goToday,
  })

  const closeShare = () => setShareOpen(false)
  const sync = { status: api.syncStatus, room: room.inRoom ? room.code : '', role: room.role }

  if (room.state === ROOM_STATES.NOT_FOUND) {
    return (
      <FullScreenMessage
        icon="danger"
        title="Agenda no encontrada"
        text="Esta agenda compartida ya no existe. Pide un link actualizado."
        actionLabel="Volver al modo local"
        onAction={backToLocal}
      />
    )
  }

  if (room.state === ROOM_STATES.DENIED) {
    return (
      <FullScreenMessage
        icon="danger"
        title="Agenda privada"
        text="No tienes acceso a esta agenda. Pide un link válido."
        actionLabel="Volver al modo local"
        onAction={backToLocal}
      />
    )
  }

  if (room.state === ROOM_STATES.VALIDATING) {
    return <FullScreenMessage icon="inprogress" title="Validando acceso…" text="Verificando el link." />
  }

  const progress = isMobile && view === 'day' ? dayProgress(tasksForDay(api.tasks, nav.selectedDay), nav.selectedDay) : null

  return (
    <DndContext {...dndProps}>
      <div className="flex h-[100dvh] flex-col bg-app text-t1">
        <AppHeader
          isMobile={isMobile}
          isViewer={isViewer}
          view={view}
          onViewChange={setView}
          titleLong={nav.titleLong}
          titleShort={nav.titleShort}
          eyebrow={nav.eyebrow}
          progress={progress}
          onPrev={nav.goPrev}
          onNext={nav.goNext}
          onToday={nav.goToday}
          prevLabel={nav.prevLabel}
          nextLabel={nav.nextLabel}
          sync={sync}
          onShare={() => setShareOpen(true)}
        />

        <div className={cx('flex min-h-0 flex-1', isMobile ? 'flex-col' : 'flex-wrap overflow-y-auto')}>
          {!isMobile && (
            <Backlog tasks={api.tasks} actions={ui.actions} isViewer={isViewer} onNewTask={() => ui.openNew({ day: null })} variant="aside" />
          )}
          <main className="flex h-full min-h-0 min-w-0 flex-col [flex:999_1_560px]">
            {view === 'day' && (
              <DayView
                dateStr={nav.selectedDay}
                tasks={api.tasks}
                actions={ui.actions}
                isViewer={isViewer}
                isMobile={isMobile}
                dragging={Boolean(activeDrag)}
                onNewTask={ui.openNew}
                onCreate={ui.quickCreate}
                onPrev={nav.goPrev}
                onNext={nav.goNext}
                quickAddRef={quickAddRef}
              />
            )}
            {view === 'timeline' && (
              <Suspense fallback={null}>
                <TimelineView
                  dateStr={nav.selectedDay}
                  tasks={api.tasks}
                  actions={ui.actions}
                  isViewer={isViewer}
                  timelineRef={timelineRef}
                />
              </Suspense>
            )}
            {view === 'month' && (
              <div className="min-h-0 flex-1 overflow-y-auto p-4 md:px-5">
                <Suspense fallback={null}>
                  <MonthView
                    dateStr={nav.selectedDay}
                    tasks={api.tasks}
                    isMobile={isMobile}
                    isViewer={isViewer}
                    onSelectDay={nav.selectDay}
                  />
                </Suspense>
              </div>
            )}
          </main>
        </div>

        {isMobile && !activeDrag && (
          <BottomNav
            view={view}
            onViewChange={setView}
            onAdd={() => (view === 'day' ? setFocusRequest((n) => n + 1) : ui.openNew({ day: nav.selectedDay }))}
            onMenu={() => setMenuOpen(true)}
            showAdd={!isViewer}
          />
        )}

        {isMobile && (
          <Backlog
            tasks={api.tasks}
            actions={ui.actions}
            isViewer={isViewer}
            onNewTask={() => ui.openNew({ day: null })}
            variant="drawer"
            open={backlogOpen}
            dragging={Boolean(activeDrag)}
            onClose={() => setBacklogOpen(false)}
          />
        )}

        <MobileMenu
          open={isMobile && menuOpen}
          onClose={() => setMenuOpen(false)}
          view={view}
          onViewChange={setView}
          onToday={nav.goToday}
          sync={sync}
          isViewer={isViewer}
          onShare={() => setShareOpen(true)}
          onOpenBacklog={() => setBacklogOpen(true)}
          backlogCount={unscheduledTasks(api.tasks).length}
        />

        <TaskFormModal
          open={ui.modal.open}
          initial={ui.modal.initial}
          defaultDay={ui.modal.defaultDay}
          defaultStatus={ui.modal.defaultStatus}
          groupCount={ui.modal.groupCount}
          onSave={ui.save}
          onDelete={ui.remove}
          onSaveRecurring={ui.saveRecurring}
          onDeleteSeries={ui.removeSeries}
          onUpdateRule={api.updateRecurringRule}
          onClose={ui.closeModal}
        />

        {shareOpen && (
          <Suspense fallback={null}>
            <ShareModal
              open={shareOpen}
              onClose={closeShare}
              currentRoom={room.inRoom ? room.code : ''}
              currentRole={room.role}
              tokens={room.tokens}
              onJoin={requestJoin}
              onCreateRoom={createNewRoom}
              onRenewViewToken={renewViewToken}
              onRotateEditToken={rotateEditToken}
              onLeaveRoom={() => {
                leaveRoom()
                closeShare()
              }}
              syncStatus={api.syncStatus}
            />
          </Suspense>
        )}

        <ConfirmDialog
          open={Boolean(pendingJoin)}
          title="Unirse a la agenda compartida"
          message={
            pendingJoin
              ? `Tienes ${pendingJoin.localCount} ${pendingJoin.localCount === 1 ? 'tarea local' : 'tareas locales'}. ¿Qué hago con ellas?`
              : ''
          }
          confirmLabel="Usar la agenda compartida"
          onConfirm={() => confirmJoin('room')}
          secondaryLabel="Combinar con mis tareas locales"
          onSecondary={() => confirmJoin('merge')}
          onCancel={cancelJoin}
        />

        <StatusSheet task={ui.sheet.task} onSetStatus={ui.sheet.setStatus} onEdit={ui.sheet.edit} onClose={ui.sheet.close} />

        {toast.toast && <Toast label={toast.toast.label} onAction={toast.undo} />}
      </div>

      <DragOverlay>
        {activeDrag && !activeDrag.id.startsWith('tl:') ? (
          <TaskCardView
            task={activeDrag.task}
            timeLabel={activeDrag.task.day ? minutesToLabel(activeDrag.task.startMinutes) : null}
            showStatus
            dragging
            isMobile={isMobile}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
