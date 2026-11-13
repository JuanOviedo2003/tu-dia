import { VIEWS } from '../lib/constants'
import Button from './ui/Button'
import Chip from './ui/Chip'
import DayProgress from './ui/DayProgress'
import IconButton from './ui/IconButton'
import SegmentedControl from './ui/SegmentedControl'
import SyncIndicator from './SyncIndicator'

function MobileHeader({ titleShort, eyebrow, progress, onPrev, onNext, prevLabel, nextLabel }) {
  return (
    <header className="border-b border-s3 bg-s1 px-4 pb-3 pt-4">
      <div className="flex items-center gap-1">
        <IconButton icon="chevron-left" label={prevLabel} onClick={onPrev} className="-ml-2" />
        <div className="min-w-0 flex-1 text-center">
          {eyebrow && <p className="text-small font-medium text-accent">{eyebrow}</p>}
          <h1 className="truncate text-title font-semibold text-t1">{titleShort}</h1>
        </div>
        <IconButton icon="chevron-right" label={nextLabel} onClick={onNext} className="-mr-2" />
      </div>
      {progress && <DayProgress {...progress} className="mt-3" />}
    </header>
  )
}

function DesktopHeader({ view, onViewChange, titleLong, onPrev, onNext, onToday, prevLabel, nextLabel, sync, onShare, isViewer }) {
  return (
    <header className="flex min-h-16 flex-wrap items-center gap-x-4 gap-y-2 border-b border-s3 bg-s1 px-4 py-2.5">
      <span className="text-heading font-semibold text-t1">Agenda</span>
      <div className="flex items-center gap-1">
        <IconButton icon="chevron-left" label={prevLabel} onClick={onPrev} />
        <Button onClick={onToday}>Hoy</Button>
        <IconButton icon="chevron-right" label={nextLabel} onClick={onNext} />
      </div>
      <h1 className="text-title font-semibold text-t1">{titleLong}</h1>
      <SegmentedControl options={VIEWS} value={view} onChange={onViewChange} label="Vista" />
      <div className="flex-1" />
      {isViewer && <Chip>Solo lectura</Chip>}
      <SyncIndicator status={sync.status} room={sync.room} />
      <Button icon="share" onClick={onShare}>
        Compartir
      </Button>
    </header>
  )
}

export default function AppHeader({ isMobile, ...props }) {
  return isMobile ? <MobileHeader {...props} /> : <DesktopHeader {...props} />
}
