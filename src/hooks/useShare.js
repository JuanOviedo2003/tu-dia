import { useEffect, useRef, useState } from 'react'

const QR_COLORS = { dark: '#1B1F24', light: '#F1F3F5' }

function describeStatus({ online, authError, roomNotFound, offline }) {
  if (online) return { text: 'sincronizado', icon: 'done' }
  if (authError) return { text: 'token inválido', icon: 'danger' }
  if (roomNotFound) return { text: 'sala no encontrada', icon: 'danger' }
  if (offline) return { text: 'sin conexión', icon: 'todo' }
  return { text: 'conectando...', icon: 'inprogress' }
}

export function useShare({ open, currentRoom, currentRole, onCreateRoom, onRotateTokens, onJoin, onClose, syncStatus }) {
  const canvasRef = useRef(null)
  const [input, setInput] = useState('')
  const [qrTab, setQrTab] = useState('editor')
  const [tokens, setTokens] = useState(null)
  const [creating, setCreating] = useState(false)
  const [rotating, setRotating] = useState(false)
  const [copied, setCopied] = useState('')
  const [error, setError] = useState('')

  const flags = {
    online: syncStatus === 'online',
    authError: syncStatus === 'auth-error',
    offline: Boolean(currentRoom) && syncStatus === 'offline',
    roomNotFound: syncStatus === 'room-not-found',
  }
  const status = describeStatus(flags)
  const statusText = currentRoom
    ? `Sala ${currentRoom}${currentRole ? ` (${currentRole})` : ''} · ${status.text}`
    : 'Sin sala activa (solo local)'

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const editUrl = tokens ? `${baseUrl}/?room=${currentRoom}&t=${tokens.editToken}&role=editor` : ''
  const viewUrl = tokens ? `${baseUrl}/?room=${currentRoom}&t=${tokens.viewToken}&role=viewer` : ''
  const activeUrl = qrTab === 'editor' ? editUrl : viewUrl

  useEffect(() => {
    setTokens(null)
  }, [currentRoom])

  useEffect(() => {
    if (!open || !activeUrl || !canvasRef.current) return
    let cancelled = false
    import('qrcode').then(({ default: QRCode }) => {
      if (cancelled || !canvasRef.current) return
      QRCode.toCanvas(canvasRef.current, activeUrl, {
        width: 240,
        margin: 2,
        errorCorrectionLevel: 'M',
        color: QR_COLORS,
      }).catch(() => {})
    })
    return () => {
      cancelled = true
    }
  }, [open, activeUrl])

  const handleCreate = async () => {
    setCreating(true)
    setError('')
    try {
      const result = await onCreateRoom()
      if (!result.ok) {
        setError(
          result.error === 'no-auth'
            ? 'Autenticación anónima deshabilitada en Firebase Console. Actívala: Authentication → Sign-in method → Anonymous.'
            : 'No se pudo crear la sala. Verifica tu conexión y vuelve a intentar.',
        )
        return
      }
      setTokens({ editToken: result.editToken, viewToken: result.viewToken })
    } catch {
      setError('Error inesperado al crear la sala.')
    } finally {
      setCreating(false)
    }
  }

  const handleRotate = async () => {
    if (!currentRoom) return
    setRotating(true)
    setError('')
    try {
      const result = await onRotateTokens(currentRoom)
      if (!result.ok) {
        setError('No se pudieron rotar los tokens. Verifica tu conexión.')
        return
      }
      setTokens({ editToken: result.editToken, viewToken: result.viewToken })
    } catch {
      setError('Error inesperado al rotar tokens.')
    } finally {
      setRotating(false)
    }
  }

  const join = async () => {
    const value = input.trim()
    if (!value) return
    setError('')
    try {
      const url = new URL(value)
      const room = url.searchParams.get('room')
      const token = url.searchParams.get('t')
      const role = url.searchParams.get('role') || 'editor'
      if (room && token) {
        await onJoin(room.toUpperCase(), token, role)
        setInput('')
        onClose()
        return
      }
    } catch {
      /* no es una URL */
    }
    setError('Link inválido. Necesita sala y token (?room=CODE&t=TOKEN).')
    setInput('')
  }

  const copyToClipboard = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(label)
      setTimeout(() => setCopied(''), 1500)
    } catch {
      /* portapapeles no disponible */
    }
  }

  return {
    ...flags,
    input,
    setInput,
    qrTab,
    setQrTab,
    tokens,
    creating,
    rotating,
    copied,
    error,
    statusText,
    statusIcon: status.icon,
    editUrl,
    viewUrl,
    canvasRef,
    handleCreate,
    handleRotate,
    join,
    copyToClipboard,
  }
}
