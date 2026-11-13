import { useEffect, useRef, useState } from 'react'

const QR_COLORS = { dark: '#1B1F24', light: '#F1F3F5' }

function describeStatus({ online, authError, roomNotFound, offline }) {
  if (online) return { text: 'sincronizado', icon: 'done' }
  if (authError) return { text: 'token inválido', icon: 'danger' }
  if (roomNotFound) return { text: 'sala no encontrada', icon: 'danger' }
  if (offline) return { text: 'sin conexión', icon: 'todo' }
  return { text: 'conectando...', icon: 'inprogress' }
}

export function useShare({
  open,
  currentRoom,
  currentRole,
  tokens,
  onCreateRoom,
  onRenewViewToken,
  onRotateEditToken,
  onLeaveRoom,
  onJoin,
  onClose,
  syncStatus,
}) {
  const canvasEditRef = useRef(null)
  const canvasViewRef = useRef(null)
  const [input, setInput] = useState('')
  const [showQr, setShowQr] = useState({ editor: false, viewer: false })
  const [creating, setCreating] = useState(false)
  const [renewing, setRenewing] = useState(false)
  const [rotatingEdit, setRotatingEdit] = useState(false)
  const [copied, setCopied] = useState('')
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState(null)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)

  const runBusy = async (fn) => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    try {
      await fn()
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

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
  const editToken = tokens?.editToken ?? null
  const viewToken = tokens?.viewToken ?? null
  const editUrl = currentRoom && editToken ? `${baseUrl}/?room=${currentRoom}&t=${editToken}&role=editor` : ''
  const viewUrl = currentRoom && viewToken ? `${baseUrl}/?room=${currentRoom}&t=${viewToken}&role=viewer` : ''

  useEffect(() => {
    if (!open) setConfirm(null)
  }, [open])

  useEffect(() => {
    if (!open || !showQr.editor || !editUrl || !canvasEditRef.current) return
    let cancelled = false
    import('qrcode').then(({ default: QRCode }) => {
      if (cancelled || !canvasEditRef.current) return
      QRCode.toCanvas(canvasEditRef.current, editUrl, {
        width: 240,
        margin: 2,
        errorCorrectionLevel: 'M',
        color: QR_COLORS,
      }).catch(() => {})
    })
    return () => {
      cancelled = true
    }
  }, [open, showQr.editor, editUrl])

  useEffect(() => {
    if (!open || !showQr.viewer || !viewUrl || !canvasViewRef.current) return
    let cancelled = false
    import('qrcode').then(({ default: QRCode }) => {
      if (cancelled || !canvasViewRef.current) return
      QRCode.toCanvas(canvasViewRef.current, viewUrl, {
        width: 240,
        margin: 2,
        errorCorrectionLevel: 'M',
        color: QR_COLORS,
      }).catch(() => {})
    })
    return () => {
      cancelled = true
    }
  }, [open, showQr.viewer, viewUrl])

  const toggleQr = (kind) => setShowQr((prev) => ({ ...prev, [kind]: !prev[kind] }))

  const handleCreate = () =>
    runBusy(async () => {
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
        }
      } catch {
        setError('Error inesperado al crear la sala.')
      } finally {
        setCreating(false)
      }
    })

  const handleRenewViewToken = async () => {
    setRenewing(true)
    setError('')
    try {
      const result = await onRenewViewToken()
      if (!result?.ok) {
        setError('No se pudo renovar el link de solo ver. Verifica tu conexión.')
        return false
      }
      return true
    } catch {
      setError('Error inesperado al renovar el link de solo ver.')
      return false
    } finally {
      setRenewing(false)
    }
  }

  const handleRotateEditToken = async () => {
    setRotatingEdit(true)
    setError('')
    try {
      const result = await onRotateEditToken()
      if (!result?.ok) {
        setError('No se pudo rotar el token de editor. Verifica tu conexión.')
        return false
      }
      return true
    } catch {
      setError('Error inesperado al rotar el token de editor.')
      return false
    } finally {
      setRotatingEdit(false)
    }
  }

  const join = async () => {
    const value = input.trim()
    if (!value) return
    setError('')
    let parsed = null
    try {
      const url = new URL(value)
      const room = url.searchParams.get('room')
      const token = url.searchParams.get('t')
      const role = url.searchParams.get('role') === 'viewer' ? 'viewer' : 'editor'
      if (room && token) parsed = { room, token, role }
    } catch {
      /* no es una URL */
    }
    if (!parsed) {
      setError('Link inválido. Pega el link completo de edición o de solo ver.')
      setInput('')
      return
    }
    setInput('')
    await onJoin(parsed.room.toUpperCase(), parsed.token, parsed.role)
    onClose()
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

  const askConfirm = (kind) => {
    if (!busyRef.current) setConfirm(kind)
  }
  const cancelConfirm = () => {
    if (!busyRef.current) setConfirm(null)
  }

  const runConfirm = () =>
    runBusy(async () => {
      const kind = confirm
      if (!kind) return
      if (kind === 'leave') {
        onLeaveRoom?.()
      } else if (kind === 'renewView') {
        await handleRenewViewToken()
      } else if (kind === 'rotateEdit') {
        await handleRotateEditToken()
      }
      setConfirm(null)
    })

  return {
    ...flags,
    input,
    setInput,
    showQr,
    toggleQr,
    creating,
    renewing,
    rotatingEdit,
    busy,
    copied,
    error,
    statusText,
    statusIcon: status.icon,
    editUrl,
    viewUrl,
    canvasEditRef,
    canvasViewRef,
    confirm,
    askConfirm,
    cancelConfirm,
    runConfirm,
    handleCreate,
    join,
    copyToClipboard,
  }
}
