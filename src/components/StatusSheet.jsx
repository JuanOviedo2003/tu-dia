import { STATUSES } from '../lib/constants'
import Button from './ui/Button'
import Modal from './ui/Modal'
import StatusButton from './ui/StatusButton'
import StatusIcon from './ui/StatusIcon'

export default function StatusSheet({ task, onSetStatus, onEdit, onClose }) {
  return (
    <Modal open={Boolean(task)} onClose={onClose} title={task?.title ?? 'Estado'}>
      <div className="flex flex-col gap-2">
        {STATUSES.map((status) => (
          <StatusButton
            key={status.key}
            status={status}
            active={task?.status === status.key}
            onClick={() => onSetStatus(status.key)}
            className="flex h-14 items-center gap-3 rounded-md border px-4 text-body-m"
            inactiveClassName={`border-line bg-s2 font-semibold ${status.text}`}
          >
            <StatusIcon status={status.key} size={20} />
            {status.label}
          </StatusButton>
        ))}
        <Button variant="secondary" onClick={onEdit} className="mt-2 h-14">
          Editar detalles
        </Button>
      </div>
    </Modal>
  )
}
