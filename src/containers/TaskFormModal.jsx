import { useTaskForm } from '../hooks/useTaskForm'
import Modal from '../components/ui/Modal'
import TaskFormView from '../components/TaskFormView'

export default function TaskFormModal({
  open,
  initial,
  defaultDay,
  defaultStatus,
  groupCount,
  onSave,
  onDelete,
  onSaveRecurring,
  onDeleteSeries,
  onUpdateRule,
  onClose,
}) {
  const task = useTaskForm({ open, initial, defaultDay, defaultStatus, onSave, onSaveRecurring, onUpdateRule })

  return (
    <Modal open={open} onClose={onClose} title={task.isEditing ? 'Editar tarea' : 'Nueva tarea'} width="sm:max-w-lg">
      <TaskFormView
        form={task.form}
        onFieldChange={task.setField}
        showRepeat={task.showRepeat}
        repeat={task.repeat}
        onRepeatChange={task.setRepeat}
        duration={task.duration}
        onDurationChange={task.setDuration}
        ruleHint={task.ruleHint}
        repeatWarning={task.repeatWarning}
        isEditing={task.isEditing}
        hasSeries={task.hasSeries}
        seriesCount={groupCount}
        saveDisabled={task.saveDisabled}
        onSubmit={task.submit}
        onCancel={onClose}
        onDelete={() => onDelete(initial.id)}
        onDeleteSeries={() => onDeleteSeries(initial.groupId)}
      />
    </Modal>
  )
}
