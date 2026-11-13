import { cx } from '../lib/cx'
import { VIEWS } from '../lib/constants'
import Fab from './ui/Fab'
import Icon from './ui/Icon'

function NavItem({ icon, label, active, onClick }) {
  return (
    <button
      type="button"
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
      className={cx(
        'transition-ui flex h-14 min-w-0 flex-col items-center justify-center gap-0.5 rounded-md text-caption',
        active ? 'font-semibold text-accent' : 'font-medium text-t2 hover:bg-s3',
      )}
    >
      <Icon name={icon} size={22} />
      <span className="max-w-full truncate">{label}</span>
    </button>
  )
}

export default function BottomNav({ view, onViewChange, onAdd, onMenu, showAdd }) {
  const items = VIEWS.map((option) => (
    <NavItem
      key={option.value}
      icon={option.value}
      label={option.short}
      active={view === option.value}
      onClick={() => onViewChange(option.value)}
    />
  ))

  return (
    <nav
      aria-label="Navegación principal"
      className={cx('grid shrink-0 gap-1 border-t border-line bg-s1 px-2 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]', showAdd ? 'grid-cols-5' : 'grid-cols-4')}
    >
      {items.slice(0, 2)}
      {showAdd && (
        <div className="flex items-center justify-center">
          <Fab label="Añadir tarea" onClick={onAdd} className="-translate-y-1" />
        </div>
      )}
      {items.slice(2)}
      <NavItem icon="menu" label="Menú" onClick={onMenu} />
    </nav>
  )
}
