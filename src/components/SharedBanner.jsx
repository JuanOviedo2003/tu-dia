import Button from './ui/Button'

export default function SharedBanner({ ownerName, onBack }) {
  const label = ownerName ? `Agenda de ${ownerName}, solo lectura` : 'Agenda compartida contigo, solo lectura'
  return (
    <div role="region" aria-label="Agenda compartida" className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-line bg-s2 px-4 py-1.5">
      <p className="min-w-0 flex-1 truncate text-small font-medium text-t2">{label}</p>
      <Button variant="text" className="shrink-0 px-2" onClick={onBack}>
        Volver a mi agenda
      </Button>
    </div>
  )
}
