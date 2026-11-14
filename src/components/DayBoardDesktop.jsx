import DayProgress from './ui/DayProgress'
import ShortcutLegend from './ShortcutLegend'

export default function DayBoardDesktop({ progress, columns }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 px-5 pb-5 pt-4">
      <div className="flex justify-end">
        <DayProgress {...progress} className="h-12" barClassName="w-[120px]" />
      </div>
      <div className="grid flex-1 grid-cols-[repeat(auto-fit,minmax(240px,1fr))] items-stretch gap-4">{columns}</div>
      <ShortcutLegend />
    </div>
  )
}
