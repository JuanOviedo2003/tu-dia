const ACTION_CLASS = 'min-h-11 rounded-md px-3 text-body font-medium text-accent hover:text-accent-hover'

export default function Toast({ label, actionLabel = 'Deshacer', onAction, extraActions = [] }) {
  return (
    <div
      role="status"
      className="rise-in fixed bottom-24 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-md border border-line bg-s2 py-1 pl-4 pr-1 shadow-menu sm:bottom-6"
    >
      <span className="mr-2 text-body font-medium text-t1">{label}</span>
      {onAction && (
        <button type="button" onClick={onAction} className={ACTION_CLASS}>
          {actionLabel}
        </button>
      )}
      {extraActions.map((action) => (
        <button key={action.label} type="button" onClick={action.onClick} className={ACTION_CLASS}>
          {action.label}
        </button>
      ))}
    </div>
  )
}
