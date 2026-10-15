import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'

// Modal con el QR de la página actual (incluye los datos compartidos en la URL).
// Permite elegir qué IP local usar (puede haber varias: WiFi, adaptador virtual, etc.).
export default function QRModal({ d, devInfo, onClose }) {
  const canvasRef = useRef(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [sel, setSel] = useState('')

  const ips = devInfo?.ips || []
  const port = devInfo?.port || ''
  const hasIp = ips.length > 0

  // Selecciona la primera IP por defecto cuando estén disponibles.
  useEffect(() => {
    if (ips.length && !ips.includes(sel)) setSel(ips[0])
  }, [ips, sel])

  const hostUrl = sel ? `http://${sel}:${port}/?d=${encodeURIComponent(d)}` : ''
  const fallbackUrl = typeof window !== 'undefined' ? `${window.location.origin}/?d=${encodeURIComponent(d)}` : ''
  const url = hostUrl || fallbackUrl
  const tooBig = url.length > 1800 // por encima, el QR es denso y difícil de escanear

  useEffect(() => {
    if (!url || !canvasRef.current) return
    setError('')
    // 'L' da más capacidad (menos módulos) => más fácil de escanear.
    QRCode.toCanvas(canvasRef.current, url, { width: 280, margin: 2, errorCorrectionLevel: 'L' })
      .catch(() => setError('Demasiados datos para un QR. Usa "Copiar enlace" en su lugar.'))
  }, [url])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* portapapeles no disponible */
    }
  }

  if (!d) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl border border-brand-2/30 bg-slate-900 p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-1 text-lg font-bold text-brand">Abrir en tu móvil</h3>

        {hasIp ? (
          <div className="mb-3">
            <p className="text-xs font-light text-brand-2">Elige la IP de tu red WiFi:</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {ips.map((ip) => (
                <button
                  key={ip}
                  onClick={() => setSel(ip)}
                  className={[
                    'rounded-md border px-2 py-1 text-xs font-bold',
                    sel === ip
                      ? 'border-brand bg-brand/15 text-brand'
                      : 'border-brand-2/40 text-brand-2 hover:bg-brand-2/10',
                  ].join(' ')}
                >
                  {ip}:{port}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p className="mb-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-300">
            No se detectó una IP local. Conéctate a una red WiFi y recarga. El QR usará el origen actual, que podría no ser alcanzable desde el móvil.
          </p>
        )}

        <div className="flex justify-center rounded-lg bg-white p-3">
          {error ? (
            <p className="py-10 px-4 text-center text-xs text-rose-500">{error}</p>
          ) : (
            <canvas ref={canvasRef} className="h-[280px] w-[280px]" />
          )}
        </div>

        {tooBig && !error && (
          <p className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-[11px] text-amber-300">
            URL larga: el QR es denso y tu móvil podría leerlo mal. Si falla, usa «Copiar enlace» y envíatelo por otra vía.
          </p>
        )}

        <p className="mt-3 break-all rounded-md bg-slate-950/60 p-2 text-[10px] text-slate-400">
          {url}
        </p>

        <p className="mt-2 text-[11px] leading-snug text-slate-400">
          Escanea con el móvil estando en la <span className="text-slate-200">misma red WiFi</span>.
          Si el firewall bloquea, permite el puerto <span className="text-slate-200">{port || '5173'}</span>.
          La IP puede cambiar al reconectar a otra red.
        </p>

        <div className="mt-4 flex gap-2">
          <button
            onClick={copy}
            className="flex-1 rounded-md border border-brand-2/40 px-3 py-2 text-sm text-brand-2 hover:bg-brand-2/10"
          >
            {copied ? '¡Copiado!' : 'Copiar enlace'}
          </button>
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
