import { useQuickAdd } from '../hooks/useQuickAdd'
import QuickAddBarView from '../components/QuickAddBarView'

const PLACEHOLDERS = {
  desktop: 'llamar a Ana mañana 15:00',
  mobile: 'Añadir… «gym 7pm»',
}

export default function QuickAdd({ defaultDay, onCreate, isViewer = false, size = 'desktop', inputRef }) {
  const quick = useQuickAdd({ defaultDay, onCreate })

  if (isViewer) return null

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault()
      quick.submit()
    } else if (e.key === 'Escape') {
      quick.reset()
      e.currentTarget.blur()
    }
  }

  return (
    <QuickAddBarView
      size={size}
      text={quick.text}
      onTextChange={quick.setText}
      onSubmit={quick.canCreate ? quick.submit : () => inputRef?.current?.focus()}
      onKeyDown={onKeyDown}
      inputRef={inputRef}
      placeholder={PLACEHOLDERS[size]}
      canCreate={quick.canCreate}
      chips={quick.chips}
      showHint={size === 'desktop'}
    />
  )
}
