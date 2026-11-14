export default function DayBoardMobile({ list, bottom, swipeHandlers }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div {...swipeHandlers} className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto p-4">
        {list}
        <p className="pt-2 text-center text-caption font-medium text-t3">
          Desliza ← → para cambiar de día · mantén pulsado para mover
        </p>
      </div>
      {bottom}
    </div>
  )
}
