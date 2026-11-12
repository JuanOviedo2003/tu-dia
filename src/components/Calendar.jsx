import DayCell from './DayCell'
import DayRow from './DayRow'
import { weekdayShort } from '../lib/time'
import { useIsMobile } from '../hooks/useMediaQuery'

// Desktop (>=sm): rejilla 7 columnas con ancho máximo centrado.
// Móvil (<sm): lista vertical de días estilo Google Calendar.
// Solo se monta una vista a la vez: evita droppables duplicados
// (`day:<fecha>` en DayCell y DayRow) que dejaban rects en 0x0 y
// rompían el arrastre de tareas entre días.
export default function Calendar({ year, month, tasks, onOpenDay, isViewer = false }) {
  const isMobile = useIsMobile(639)

  const first = new Date(year, month, 1)
  const startWeekday = (first.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const todayStr = (() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })()

  const cells = []
  for (let i = 0; i < startWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  if (isMobile) {
    // Lista vertical móvil: columna delgada con día + tareas por hora — scrollable
    return (
      <div className="flex-1 overflow-y-auto min-h-0">
        {cells.filter((d) => d !== null).map((d) => {
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
          const weekday = (startWeekday + (d - 1)) % 7
          return (
            <DayRow
              key={dateStr}
              dateStr={dateStr}
              dayNumber={d}
              weekday={weekday}
              isToday={dateStr === todayStr}
              tasks={tasks}
              onOpenDay={onOpenDay}
              isViewer={isViewer}
            />
          )
        })}
      </div>
    )
  }

  // Rejilla escritorio: ancho fluido con tope cómodo, centrado; alturas en
  // vw/vh, escala con resolución y zoom.
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="mx-auto w-full max-w-[1400px]">
        <div className="mb-1 grid grid-cols-7 gap-1.5">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="py-1 text-center text-[length:clamp(0.7rem,0.8vw,1.4rem)] font-semibold text-slate-400">
              {weekdayShort(i)}
            </div>
          ))}
        </div>
        {/* gap-px + fondo = líneas finas compartidas: aspecto de tabla de calendario */}
        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-slate-700/60 bg-slate-700/60">
          {cells.map((d, idx) => {
            if (d === null) {
              return <div key={`blank-${idx}`} className="h-[clamp(5.5rem,min(9vw,10.5vh),40rem)] bg-slate-900/60" />
            }
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
            const weekday = (startWeekday + (d - 1)) % 7
            return (
              <DayCell
                key={dateStr}
                dateStr={dateStr}
                dayNumber={d}
                weekday={weekday}
                isToday={dateStr === todayStr}
                isCurrentMonth
                isWeekend={weekday >= 5}
                tasks={tasks}
                onOpenDay={onOpenDay}
                isViewer={isViewer}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
