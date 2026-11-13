import { REPEAT_LABELS } from '../lib/constants'
import { durationLabel } from '../lib/recurring'
import { Field, Select } from './ui/Field'
import Notice from './ui/Notice'
import SegmentedControl from './ui/SegmentedControl'

const OPTIONS = [{ value: 'none', label: 'No' }, ...Object.entries(REPEAT_LABELS).map(([value, label]) => ({ value, label }))]

const DURATIONS = [2, 3, 4, 6, 12]

export default function RepeatField({ repeat, onRepeatChange, duration, onDurationChange, hint, warning }) {
  return (
    <div className="space-y-3">
      <div>
        <span className="mb-1 block text-small font-medium text-t2">Repetir</span>
        <SegmentedControl label="Repetir" options={OPTIONS} value={repeat} onChange={onRepeatChange} className="w-full" />
      </div>
      {repeat !== 'none' && (
        <Field label="Duración">
          <Select value={duration} onChange={(e) => onDurationChange(e.target.value)}>
            {DURATIONS.map((m) => (
              <option key={m} value={m}>
                {durationLabel(repeat, m)}
              </option>
            ))}
          </Select>
        </Field>
      )}
      {hint && <p className="text-caption text-t3">{hint}</p>}
      {warning && <Notice tone="warning">{warning}</Notice>}
    </div>
  )
}
