import { useEffect, useState } from 'react'

// Suscripción a una media query. El valor inicial se calcula de forma
// síncrona para montar la vista correcta ya en el primer render.
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  )

  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = () => setMatches(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])

  return matches
}

// Atajo para el patrón más usado: móvil por ancho máximo.
export function useIsMobile(maxWidth = 767) {
  return useMediaQuery(`(max-width: ${maxWidth}px)`)
}
