export default function MonthGrid({ leadingBlanks, weekdayLabels, children }) {
  return (
    <div className="mx-auto w-full max-w-[1400px]">
      <div className="mb-2 grid grid-cols-7 gap-2">
        {weekdayLabels.map((label) => (
          <div key={label} className="text-center text-caption font-medium text-t2">
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: leadingBlanks }, (_, i) => (
          <div key={`blank-${i}`} aria-hidden="true" />
        ))}
        {children}
      </div>
    </div>
  )
}
