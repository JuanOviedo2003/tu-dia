export default function Toast({ label, actionLabel = 'Deshacer', onAction }) {
  return (
    <div
      role="status"
      className="rise-in fixed bottom-28 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-md border border-line bg-s2 py-1 pl-4 pr-1 shadow-menu sm:bottom-6"
    >
      <span className="text-body font-medium text-t1">{label}</span>
      <button type="button" onClick={onAction} className="rounded-md px-3 text-body font-medium text-accent hover:text-accent-hover">
        {actionLabel}
      </button>
    </div>
  )
}
