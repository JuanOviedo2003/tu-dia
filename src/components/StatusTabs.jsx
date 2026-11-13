import StatusButton from './ui/StatusButton'
import StatusIcon from './ui/StatusIcon'

export default function StatusTabs({ groups, value, onChange }) {
  return (
    <nav aria-label="Estados" className="grid grid-cols-4 gap-1.5 border-t border-s3 bg-s1 px-2.5 py-1.5">
      {groups.map(({ status, tasks }) => (
        <StatusButton
          key={status.key}
          status={status}
          active={status.key === value}
          onClick={() => onChange(status.key)}
          className="flex h-[60px] flex-col items-center justify-center gap-0.5 rounded-[12px] text-small"
          inactiveClassName="bg-transparent font-semibold text-t2"
        >
          <span className="flex items-center gap-1">
            <StatusIcon status={status.key} size={14} />
            {tasks.length}
          </span>
          <span>{status.label}</span>
        </StatusButton>
      ))}
    </nav>
  )
}
