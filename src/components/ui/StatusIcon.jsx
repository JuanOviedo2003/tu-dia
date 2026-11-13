const SHAPES = {
  todo: <circle cx="12" cy="12" r="9" />,
  inprogress: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" />
    </>
  ),
  review: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3" fill="currentColor" />
    </>
  ),
  done: (
    <>
      <circle cx="12" cy="12" r="9" fill="currentColor" />
      <path d="m8 12.5 3 3 5-6" stroke="var(--surface-2)" />
    </>
  ),
  danger: (
    <>
      <path d="M12 3.5 22 20H2z" />
      <path d="M12 10v4.5M12 17.2v.1" />
    </>
  ),
}

export default function StatusIcon({ status, size = 16 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={size <= 16 ? 1.75 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      {SHAPES[status] ?? SHAPES.todo}
    </svg>
  )
}
