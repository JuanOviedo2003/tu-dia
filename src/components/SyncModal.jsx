import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'

// Modal de sincronización: crea sala con tokens o únete con link.
export default function SyncModal({ open, onClose, currentRoom, currentRole, onJoin, onCreateRoom, onRotateTokens, onLeaveRoom, syncStatus }) {
  const canvasRef = useRef(null)
  const [input, setInput] = useState('')
  const [qrTab, setQrTab] = useState('editor')
  const [tokens, setTokens] = useState(null) // { editToken, viewToken }
  const [creating, setCreating] = useState(false)
  const [rotating, setRotating] = useState(false)
  const [copied, setCopied] = useState('')
  const [error, setError] = useState('')

  const online = syncStatus === 'online'
  const authError = syncStatus === 'auth-error'
  const offline = syncStatus === 'offline'
  const roomNotFound = syncStatus === 'room-not-found'

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const editUrl = tokens ? `${baseUrl}/?room=${currentRoom}&t=${tokens.editToken}&role=editor` : ''
  const viewUrl = tokens ? `${baseUrl}/?room=${currentRoom}&t=${tokens.viewToken}&role=viewer` : ''
  const activeUrl = qrTab === 'editor' ? editUrl : viewUrl

  useEffect(() => {
    if (!activeUrl || !canvasRef.current) return
    QRCode.toCanvas(canvasRef.current, activeUrl, { width: 240, margin: 2, errorCorrectionLevel: 'M' }).catch(() => {})
  }, [activeUrl])

  if (!open) return null

  const handleCreate = async () => {
    setCreating(true)
    setError('')
    try {
      const result = await onCreateRoom()
      if (!result.ok) {
        setError(
          result.error === 'no-auth'
            ? 'Autenticación anónima deshabilitada en Firebase Console. Actívala: Authentication → Sign-in method → Anonymous.'
            : 'No se pudo crear la sala. Verifica tu conexión y vuelve a intentar.'
        )
        return
      }
      setTokens({ editToken: result.editToken, viewToken: result.viewToken })
    } catch (err) {
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
    } catch (err) {
      setError('Error inesperado al rotar tokens.')
    } finally {
      setRotating(false)
    }
  }

  const join = async () => {
    const v = input.trim()
    if (!v) return
    setError('')
    // Parsear URL completa o código simple
    try {
      const url = new URL(v)
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
      // No es URL, tratar como código
    }
    // Si es solo código sin token, denegar
    setError('Link inválido. Necesita sala y token (?room=CODE&t=TOKEN).')
    setInput('')
  }

  const copyToClipboard = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(label)
      setTimeout(() => setCopied(''), 1500)
    } catch { /* portapapeles no disponible */ }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-xl border border-brand-2/30 bg-slate-900 p-5 shadow-2xl overflow-y-auto max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-1 text-lg font-bold text-brand">Sincronización</h3>
        <p className="mb-4 text-xs font-light text-brand-2">
          Crea una sala para obtener links seguros, o únete con un link recibido.
        </p>

        {authError && (
          <p className="mb-3 rounded-md border border-rose-500/40 bg-rose-500/10 p-2 text-xs text-rose-300">
            Token inválido o expirado. Pide al anfitrión un link nuevo.
          </p>
        )}

        {roomNotFound && (
          <p className="mb-3 rounded-md border border-rose-500/40 bg-rose-500/10 p-2 text-xs text-rose-300">
            Esta sala no existe o fue eliminada.
          </p>
        )}

        {offline && (
          <p className="mb-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-300">
            Sin conexión — ediciones locales, se sincronizará al reconectar.
          </p>
        )}

        {error && (
          <p className="mb-3 rounded-md border border-rose-500/40 bg-rose-500/10 p-2 text-xs text-rose-300">
            {error}
          </p>
        )}

        {/* ── Olvidar dispositivo ───────────────────────────────────────── */}
        {currentRoom && (
          <button
            onClick={onLeaveRoom}
            className="w-full rounded-md border border-rose-500/40 px-3 py-1.5 text-[10px] font-bold text-rose-300 hover:bg-rose-500/10 disabled:opacity-50 mb-3"
          >
            Olvidar este dispositivo
          </button>
        )}

        {/* ── Crear sala ─────────────────────────────────────────────── */}
        {!currentRoom && (
          <div className="mb-4">
            <button
              onClick={handleCreate}
              disabled={creating}
              className="w-full rounded-md bg-brand px-4 py-2.5 text-sm font-bold text-slate-900 hover:bg-brand/90 disabled:opacity-50"
            >
              {creating ? 'Creando...' : 'Crear sala'}
            </button>
          </div>
        )}

        {/* ── Links de compartir (cuando hay tokens) ─────────────────── */}
        {currentRoom && tokens && (
          <div className="mb-4 space-y-2 rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-xs">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <span className="block font-semibold text-slate-300">Link Editor</span>
                <span className="block truncate text-[10px] text-slate-500">{editUrl}</span>
              </div>
              <button
                onClick={() => copyToClipboard(editUrl, 'editor')}
                className="ml-2 shrink-0 rounded-md bg-brand px-2 py-1 text-[10px] font-bold text-slate-900 hover:bg-brand/90"
              >
                {copied === 'editor' ? '¡Copiado!' : 'Copiar'}
              </button>
            </div>
            <div className="border-t border-slate-800/80 pt-2 flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <span className="block font-semibold text-slate-300">Link Espectador</span>
                <span className="block truncate text-[10px] text-slate-500">{viewUrl}</span>
              </div>
              <button
                onClick={() => copyToClipboard(viewUrl, 'viewer')}
                className="ml-2 shrink-0 rounded-md border border-sky-400/50 px-2 py-1 text-[10px] font-bold text-sky-400 hover:bg-sky-400/10"
              >
                {copied === 'viewer' ? '¡Copiado!' : 'Copiar'}
              </button>
            </div>

            <div className="border-t border-slate-800/80 pt-2">
              <button
                onClick={handleRotate}
                disabled={rotating}
                className="w-full rounded-md border border-amber-500/40 px-3 py-1.5 text-[10px] font-bold text-amber-400 hover:bg-amber-500/10 disabled:opacity-50"
              >
                {rotating ? 'Rotando...' : 'Rotar tokens (revoca links anteriores)'}
              </button>
            </div>
          </div>
        )}

        {/* ── QR ─────────────────────────────────────────────────────── */}
        {currentRoom && tokens && (
          <>
            <div className="mb-2 flex rounded-lg bg-slate-800 p-1 text-xs font-medium">
              <button
                onClick={() => setQrTab('editor')}
                className={`flex-1 rounded-md py-1 transition-colors ${
                  qrTab === 'editor' ? 'bg-brand text-slate-900 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                QR Editor
              </button>
              <button
                onClick={() => setQrTab('viewer')}
                className={`flex-1 rounded-md py-1 transition-colors ${
                  qrTab === 'viewer' ? 'bg-sky-400 text-slate-900 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                QR Espectador
              </button>
            </div>
            <div className="mb-4 flex justify-center rounded-lg bg-white p-3">
              <canvas ref={canvasRef} className="h-[240px] w-[240px]" />
            </div>
          </>
        )}

        {/* ── Unirse ─────────────────────────────────────────────────── */}
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Unirse a una sala</div>
        <div className="mb-4 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pega el link recibido"
            className="flex-1 rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand"
          />
          <button
            onClick={join}
            className="rounded-md border border-brand/50 px-4 py-2 text-sm font-bold text-brand hover:bg-brand/10"
          >
            Unirse
          </button>
        </div>

        {/* ── Estado ─────────────────────────────────────────────────── */}
        <div className="mb-4 flex items-center gap-2 rounded-md border border-slate-800 bg-slate-950/40 p-2 text-xs">
          <span className={`h-2 w-2 rounded-full ${
            online ? 'bg-emerald-400'
            : authError || roomNotFound ? 'bg-rose-400'
            : offline ? 'bg-amber-400'
            : 'bg-amber-400'
          }`} />
          <span className="text-slate-400">
            {currentRoom
              ? `Sala ${currentRoom}${currentRole ? ` (${currentRole})` : ''} · ${
                  online ? 'sincronizado'
                  : authError ? 'token inválido'
                  : roomNotFound ? 'sala no encontrada'
                  : offline ? 'sin conexión'
                  : 'conectando...'
                }`
              : 'Sin sala activa (solo local)'}
          </span>
        </div>

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="rounded-md bg-brand px-4 py-2 text-sm font-bold text-slate-900 hover:bg-brand/90"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
