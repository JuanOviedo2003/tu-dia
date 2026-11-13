import ColumnView from '../components/ColumnView'
import { Droppable } from './Drag'
import TaskCard from './TaskCard'

export default function BoardColumn({ status, tasks, actions, isViewer, onAdd }) {
  return (
    <Droppable id={`col:${status.key}`} disabled={isViewer} className="flex min-h-0 flex-col">
      {({ isOver }) => (
        <ColumnView status={status} count={tasks.length} isOver={isOver} isViewer={isViewer} onAdd={() => onAdd(status.key)}>
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} source="col" actions={actions} isViewer={isViewer} />
          ))}
        </ColumnView>
      )}
    </Droppable>
  )
}
