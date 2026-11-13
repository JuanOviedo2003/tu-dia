export default function DropBarView({ children }) {
  return (
    <div className="border-t border-line bg-s1 px-3 pb-[22px] pt-3">
      <p className="mb-2 text-center text-small font-medium text-t2">Suelta en un estado</p>
      <div className="grid grid-cols-4 gap-2">{children}</div>
    </div>
  )
}
