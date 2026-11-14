import { cx } from '../lib/cx'
import Chip from './ui/Chip'
import Icon from './ui/Icon'
import Modal from './ui/Modal'
import SyncIndicator from './SyncIndicator'
import { VIEWS } from '../lib/constants'

function MenuItem({ icon, active, onClick, children }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cx(
        'transition-ui flex h-14 w-full items-center gap-3 rounded-md px-4 text-body-m',
        active ? 'bg-s3 font-semibold text-t1' : 'bg-transparent font-medium text-t1 hover:bg-s1',
      )}
    >
      <Icon name={icon} size={20} />
      {children}
    </button>
  )
}

export default function MobileMenu({ open, onClose, view, onViewChange, onToday, onShare, onOpenBacklog, backlogCount, sync, isViewer, sharedLabel, onOpenShared }) {
  const run = (action) => () => {
    action()
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Menú">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <SyncIndicator status={sync.status} room={sync.room} />
        {isViewer && <Chip>Solo lectura</Chip>}
      </div>
      <nav aria-label="Menú" className="flex flex-col gap-1">
        {VIEWS.map((option) => (
          <MenuItem
            key={option.value}
            icon={option.value}
            active={view === option.value}
            onClick={run(() => onViewChange(option.value))}
          >
            {option.label}
          </MenuItem>
        ))}
        <div className="my-1 border-t border-line" />
        <MenuItem icon="day" onClick={run(onToday)}>
          Ir a hoy
        </MenuItem>
        <MenuItem icon="inbox" onClick={run(onOpenBacklog)}>
          Sin programar ({backlogCount})
        </MenuItem>
        {!isViewer && (
          <MenuItem icon="share" onClick={run(onShare)}>
            Compartir
          </MenuItem>
        )}
        {sharedLabel && (
          <MenuItem icon="share" onClick={run(onOpenShared)}>
            {sharedLabel}
          </MenuItem>
        )}
      </nav>
    </Modal>
  )
}
