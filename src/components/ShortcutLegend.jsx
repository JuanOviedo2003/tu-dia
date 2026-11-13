import Kbd from './ui/Kbd'

const ITEMS = [
  [['N'], 'añadir'],
  [['←', '→'], 'cambiar de día'],
  [['T'], 'hoy'],
  [['1', '2', '3', '4'], 'mover tarjeta con foco'],
  [['Enter'], 'abrir'],
  [['Esc'], 'cerrar'],
]

export default function ShortcutLegend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-caption font-medium text-t2">
      {ITEMS.map(([keys, label]) => (
        <li key={label} className="flex items-center gap-1.5">
          <span className="flex gap-0.5">
            {keys.map((key) => (
              <Kbd key={key}>{key}</Kbd>
            ))}
          </span>
          {label}
        </li>
      ))}
    </ul>
  )
}
