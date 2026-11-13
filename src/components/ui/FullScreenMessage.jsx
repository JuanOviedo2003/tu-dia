import StatusIcon from './StatusIcon'
import Button from './Button'

export default function FullScreenMessage({ icon = 'todo', title, text, actionLabel, onAction }) {
  return (
    <div className="flex h-[100dvh] flex-col items-center justify-center bg-app p-4 text-t1">
      <div className="max-w-sm text-center">
        <div className="mb-4 flex justify-center text-t2">
          <StatusIcon status={icon} size={32} />
        </div>
        <h1 className="mb-2 text-title font-semibold">{title}</h1>
        <p className="mb-5 text-body text-t2">{text}</p>
        {actionLabel && (
          <Button variant="primary" onClick={onAction}>
            {actionLabel}
          </Button>
        )}
      </div>
    </div>
  )
}
