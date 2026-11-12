/**
 * Tu Día - Design Tokens (TypeScript)
 * Tipados para consumo futuro
 */

export const colors = {
  bg: {
    DEFAULT: 'var(--color-bg)',
    elevated: 'var(--color-bg-elevated)',
  },
  surface: {
    DEFAULT: 'var(--color-surface)',
    2: 'var(--color-surface-2)',
    hover: 'var(--color-surface-hover)',
    active: 'var(--color-surface-active)',
  },
  border: {
    DEFAULT: 'var(--color-border)',
    subtle: 'var(--color-border-subtle)',
    strong: 'var(--color-border-strong)',
  },
  text: {
    primary: 'var(--color-text-primary)',
    secondary: 'var(--color-text-secondary)',
    tertiary: 'var(--color-text-tertiary)',
    inverse: 'var(--color-text-inverse)',
  },
  primary: {
    DEFAULT: 'var(--color-primary)',
    hover: 'var(--color-primary-hover)',
    active: 'var(--color-primary-active)',
    subtle: 'var(--color-primary-subtle)',
  },
  success: {
    DEFAULT: 'var(--color-success)',
    subtle: 'var(--color-success-subtle)',
  },
  warning: {
    DEFAULT: 'var(--color-warning)',
    subtle: 'var(--color-warning-subtle)',
  },
  danger: {
    DEFAULT: 'var(--color-danger)',
    hover: 'var(--color-danger-hover)',
    subtle: 'var(--color-danger-subtle)',
  },
  focus: {
    DEFAULT: 'var(--color-focus)',
    ring: 'var(--color-focus-ring)',
  },
} as const;

export const typography = {
  fontFamily: {
    sans: 'var(--font-sans)',
    mono: 'var(--font-mono)',
  },
  fontSize: {
    xs: 'var(--text-xs)',
    sm: 'var(--text-sm)',
    base: 'var(--text-base)',
    lg: 'var(--text-lg)',
    xl: 'var(--text-xl)',
    '2xl': 'var(--text-2xl)',
    '3xl': 'var(--text-3xl)',
    '4xl': 'var(--text-4xl)',
  },
  fontWeight: {
    normal: 'var(--font-normal)',
    medium: 'var(--font-medium)',
    semibold: 'var(--font-semibold)',
  },
  lineHeight: {
    tight: 'var(--leading-tight)',
    snug: 'var(--leading-snug)',
    normal: 'var(--leading-normal)',
    relaxed: 'var(--leading-relaxed)',
  },
} as const;

export const spacing = {
  0: 'var(--space-0)',
  px: 'var(--space-px)',
  0.5: 'var(--space-0-5)',
  1: 'var(--space-1)',
  1.5: 'var(--space-1-5)',
  2: 'var(--space-2)',
  2.5: 'var(--space-2-5)',
  3: 'var(--space-3)',
  3.5: 'var(--space-3-5)',
  4: 'var(--space-4)',
  5: 'var(--space-5)',
  6: 'var(--space-6)',
  7: 'var(--space-7)',
  8: 'var(--space-8)',
  9: 'var(--space-9)',
  10: 'var(--space-10)',
  12: 'var(--space-12)',
  16: 'var(--space-16)',
} as const;

export const borderRadius = {
  sm: 'var(--radius-sm)',
  md: 'var(--radius-md)',
  lg: 'var(--radius-lg)',
  xl: 'var(--radius-xl)',
  '2xl': 'var(--radius-2xl)',
  full: 'var(--radius-full)',
} as const;

export const elevation = {
  sm: 'var(--shadow-sm)',
  md: 'var(--shadow-md)',
  lg: 'var(--shadow-lg)',
  xl: 'var(--shadow-xl)',
  focus: 'var(--shadow-focus)',
} as const;

export const touchTarget = {
  min: 'var(--touch-target-min)',
  comfortable: 'var(--touch-target-comfortable)',
} as const;

export const transition = {
  fast: 'var(--transition-fast)',
  base: 'var(--transition-base)',
  slow: 'var(--transition-sslow)',
} as const;
