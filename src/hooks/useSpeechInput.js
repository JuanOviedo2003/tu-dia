import { useCallback, useEffect, useRef, useState } from 'react'

const REASONS = {
  'not-allowed': 'permiso denegado',
  'service-not-allowed': 'permiso denegado',
  'no-speech': 'no se oyó nada',
  'audio-capture': 'sin micrófono',
  network: 'sin conexión con el servicio de voz',
}

function recognitionClass() {
  return typeof window === 'undefined' ? null : window.SpeechRecognition || window.webkitSpeechRecognition || null
}

function join(base, spoken) {
  if (!spoken) return base
  return base && !/\s$/.test(base) ? `${base} ${spoken}` : `${base}${spoken}`
}

function withoutProvisional(text, provisional) {
  if (!provisional) return text
  const at = text.lastIndexOf(provisional)
  return at >= 0 && at + provisional.length === text.length ? text.slice(0, at).replace(/ $/, '') : text
}

export function useSpeechInput({ text, onText }) {
  const [supported] = useState(() => Boolean(recognitionClass()))
  const [listening, setListening] = useState(false)
  const [error, setError] = useState(null)
  const recRef = useRef(null)
  const latest = useRef({ text, onText })
  latest.current = { text, onText }

  const stop = useCallback(() => {
    recRef.current?.stop()
  }, [])

  const cancel = useCallback(() => {
    const rec = recRef.current
    if (!rec) return
    rec.cancelled = true
    rec.onresult = null
    recRef.current = null
    setListening(false)
    rec.abort()
  }, [])

  const start = useCallback(() => {
    const Recognition = recognitionClass()
    if (!Recognition || recRef.current) return
    const rec = new Recognition()
    let provisional = ''
    rec.lang = 'es-ES'
    rec.interimResults = true
    rec.continuous = false
    rec.onresult = (e) => {
      if (rec.cancelled) return
      let spoken = ''
      for (let i = 0; i < e.results.length; i += 1) spoken += e.results[i][0].transcript
      const next = spoken.trim()
      const base = withoutProvisional(latest.current.text, provisional)
      provisional = next
      latest.current.onText(join(base, next))
    }
    rec.onerror = (e) => {
      if (rec.cancelled || e.error === 'aborted') return
      const reason = REASONS[e.error]
      setError(reason ? `No se pudo usar el micrófono: ${reason}` : 'No se pudo usar el micrófono')
    }
    rec.onend = () => {
      if (rec.cancelled) return
      recRef.current = null
      setListening(false)
    }
    setError(null)
    recRef.current = rec
    try {
      rec.start()
      setListening(true)
    } catch {
      recRef.current = null
      setError('No se pudo usar el micrófono')
    }
  }, [])

  const toggle = useCallback(() => (recRef.current ? stop() : start()), [start, stop])

  useEffect(
    () => () => {
      const rec = recRef.current
      if (!rec) return
      rec.onend = null
      rec.onresult = null
      rec.onerror = null
      rec.abort?.()
    },
    [],
  )

  return { supported, listening, error, toggle, stop, cancel }
}
