import { STATUSES } from '../lib/constants'
import DropBarView from '../components/DropBarView'
import DropZoneView from '../components/DropZoneView'
import { Droppable } from './Drag'

export default function DropBar() {
  return (
    <DropBarView>
      {STATUSES.map((status) => (
        <Droppable key={status.key} id={`col:${status.key}`}>
          {({ isOver }) => <DropZoneView status={status} isOver={isOver} />}
        </Droppable>
      ))}
    </DropBarView>
  )
}
