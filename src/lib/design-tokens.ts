export const colors = {
  bg: 'var(--bg)',
  surface: {
    1: 'var(--surface-1)',
    2: 'var(--surface-2)',
    3: 'var(--surface-3)',
  },
  border: {
    DEFAULT: 'var(--border)',
    strong: 'var(--border-strong)',
  },
  text: {
    1: 'var(--text-1)',
    2: 'var(--text-2)',
    3: 'var(--text-3)',
  },
  accent: {
    DEFAULT: 'var(--accent)',
    hover: 'var(--accent-hover)',
    press: 'var(--accent-press)',
    on: 'var(--on-accent)',
    subtle: 'var(--accent-subtle)',
  },
  status: {
    todo: { text: 'var(--status-todo)', bg: 'var(--status-todo-bg)', border: 'var(--status-todo-border)' },
    doing: { text: 'var(--status-doing)', bg: 'var(--status-doing-bg)', border: 'var(--status-doing-border)' },
    review: { text: 'var(--status-review)', bg: 'var(--status-review-bg)', border: 'var(--status-review-border)' },
    done: { text: 'var(--status-done)', bg: 'var(--status-done-bg)', border: 'var(--status-done-border)' },
    danger: { text: 'var(--status-danger)', bg: 'var(--status-danger-bg)', border: 'var(--status-danger-border)' },
  },
} as const

export const radius = {
  sm: 'var(--r-sm)',
  md: 'var(--r-md)',
  lg: 'var(--r-lg)',
  full: 'var(--r-full)',
} as const

export const target = {
  min: 'var(--target-min)',
  thumb: 'var(--target-thumb)',
  dropZone: 'var(--drop-zone)',
} as const

export const motion = {
  fast: 'var(--dur-fast)',
  base: 'var(--dur-base)',
  slow: 'var(--dur-slow)',
  ease: 'var(--ease-out)',
} as const
