import { useEffect, useRef, useState } from 'react'

const QR_COLORS = { dark: '#1B1F24', light: '#F1F3F5' }
const QR_OPTS = { width: 240, margin: 2, errorCorrectionLevel: 'M', color: QR_COLORS }

function useQrCanvas(ref, url, enabled) {
  useEffect(() => {
    if (!enabled || !url || !ref.current) return
    let cancelled = false
    import('qrcode').then(({ default: QRCode }) => {
      if (cancelled || !ref.current) return
      QRCode.toCanvas(ref.current, url, QR_OPTS).catch(() => {})
    })
    return () => {
      cancelled = true
    }
  }, [enabled, url])
}

function describeStatus({ online, authError, roomNotFound, offline }, role) {
  if (online) return { text: `Sincronizado · ${role === 'viewer' ? 'Solo lectura' : 'Editor'}`, icon: 'done' }
  if (authError) return { text: 'Link no válido', icon: 'danger' }
  if (roomNotFound) return { text: 'Agenda no encontrada', icon: 'danger' }
  if (offline) return { text: 'Sin conexión', icon: 'todo' }
  return { text: 'Conectando…', icon: 'inprogress' }
}

const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

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
  const [moreOpen, setMoreOpen] = useState(false)
  const [joinOpen, setJoinOpen] = useState(false)
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
  const status = describeStatus(flags, currentRole)

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const editToken = tokens?.editToken ?? null
  const viewToken = tokens?.viewToken ?? null
  const editUrl = currentRoom && editToken ? `${baseUrl}/?room=${currentRoom}&t=${editToken}&role=editor` : ''
  const viewUrl = currentRoom && viewToken ? `${baseUrl}/?room=${currentRoom}&t=${viewToken}&role=viewer` : ''

  useEffect(() => {
    if (open) return
    setConfirm(null)
    setMoreOpen(false)
    setJoinOpen(false)
  }, [open])

  useQrCanvas(canvasEditRef, editUrl, open && showQr.editor)
  useQrCanvas(canvasViewRef, viewUrl, open && showQr.viewer)

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
              : 'No se pudo activar compartir. Verifica tu conexión y vuelve a intentar.',
          )
        }
      } catch {
        setError('Error inesperado al activar compartir.')
      } finally {
        setCreating(false)
      }
    })

  const runTokenAction = async (action, setPending, failMsg, errorMsg) => {
    setPending(true)
    setError('')
    try {
      const result = await action()
      if (!result?.ok) setError(failMsg)
    } catch {
      setError(errorMsg)
    } finally {
      setPending(false)
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

  const nativeShare = async (url) => {
    try {
      await navigator.share({ title: 'Mi agenda', url })
    } catch (err) {
      if (err?.name !== 'AbortError') copyToClipboard(url, 'viewer')
    }
  }

  const toggleMore = () => setMoreOpen((prev) => !prev)
  const toggleJoin = () => setJoinOpen((prev) => !prev)

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
        await runTokenAction(
          onRenewViewToken,
          setRenewing,
          'No se pudo renovar el link de solo ver. Verifica tu conexión.',
          'Error inesperado al renovar el link de solo ver.',
        )
      } else if (kind === 'rotateEdit') {
        await runTokenAction(
          onRotateEditToken,
          setRotatingEdit,
          'No se pudo renovar el link de edición. Verifica tu conexión.',
          'Error inesperado al renovar el link de edición.',
        )
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
    statusText: status.text,
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
    canNativeShare,
    nativeShare,
    moreOpen,
    toggleMore,
    joinOpen,
    toggleJoin,
  }
}
