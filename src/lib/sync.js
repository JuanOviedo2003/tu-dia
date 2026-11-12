import { doc, onSnapshot, runTransaction, setDoc, getDoc } from 'firebase/firestore'
import { db, auth, authReady } from './firebase'
import { reconcile } from './syncMerge'
import { sha256Hash } from './tokens'

const PUSH_DEBOUNCE = 150
const MAX_RETRIES = 3
const BASE_BACKOFF_MS = 1000

// Cliente de sync: Firestore como estado autoritativo por room.
// Acceso basado en tokens SHA-256 verificados por reglas.
export function createSync({ getState, onState, onStatus }) {
  let roomId = null
  let unsub = null
  let docRef = null
  let pushTimer = null
  let connected = false
  let claimReady = false
  let retryCount = 0
  let retryTimer = null

  function setStatus(s) {
    connected = s === 'online'
    if (s === 'online') retryCount = 0
    onStatus?.(s)
  }

  // Mapea códigos de error Firestore a estados de UI.
  function mapError(err) {
    const code = err?.code || ''
    if (code === 'permission-denied') return 'auth-error'
    if (code === 'not-found') return 'room-not-found'
    // unavailable = transitorio (sin red, servidor caído)
    return 'offline'
  }

  // Maneja error de snapshot: transitorios se reintegran, terminales no.
  function handleError(err) {
    const mapped = mapError(err)
    if (mapped === 'auth-error' || mapped === 'room-not-found') {
      // Estados terminales: no reintentar
      setStatus(mapped)
      return
    }
    // Error transitorio: backoff con reintento
    if (retryCount < MAX_RETRIES) {
      retryCount++
      const delay = BASE_BACKOFF_MS * Math.pow(2, retryCount - 1)
      if (retryTimer) clearTimeout(retryTimer)
      retryTimer = setTimeout(() => {
        retryTimer = null
        // Re-suscribir si el listener sigue activo
        if (unsub && docRef) {
          unsub()
          subscribeRaw()
        }
      }, delay)
    } else {
      setStatus('offline')
    }
  }

  function subscribeRaw() {
    if (!docRef) return
    unsub = onSnapshot(
      docRef,
      (snap) => {
        retryCount = 0
        setStatus('online')
        if (!snap.exists()) return
        const d = snap.data()
        const current = getState()
        const currentTasks = current.tasks || []
        const currentTomb = current.tombstones || {}
        const next = reconcile(currentTasks, currentTomb, d.tasks || [], d.tombstones || {})
        if (JSON.stringify(next.tasks) === JSON.stringify(currentTasks) && JSON.stringify(next.tombstones) === JSON.stringify(currentTomb)) return
        onState(next)
      },
      (err) => {
        handleError(err)
      },
    )
  }

  // Crea doc de reclamación roomAccess/{roomId}_{uid} con role y proof.
  async function createClaim(roomCode, token, role) {
    await authReady
    const user = auth.currentUser
    if (!user || !token) return { ok: false, error: 'no-auth' }
    const proof = sha256Hash(token)
    const claimRef = doc(db, 'roomAccess', `${roomCode}_${user.uid}`)
    try {
      await setDoc(claimRef, { role, proof })
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err?.code || 'unknown' }
    }
  }

  // Reclama sala legada (sin owner): primer visitante se convierte en owner.
  async function adoptLegacyRoom(roomCode, editTokenHash, viewTokenHash) {
    await authReady
    const user = auth.currentUser
    if (!user) return { ok: false, error: 'no-auth' }
    const roomRef = doc(db, 'rooms', roomCode)
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(roomRef)
        if (!snap.exists()) return
        const data = snap.data()
        if (data.ownerUid) return // ya tiene dueño
        tx.update(roomRef, {
          ownerUid: user.uid,
          editTokenHash,
          viewTokenHash,
        })
      })
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err?.code || 'unknown' }
    }
  }

  function push() {
    if (!docRef || !claimReady) return
    const user = auth.currentUser
    if (!user) return
    if (pushTimer) clearTimeout(pushTimer)
    pushTimer = setTimeout(() => {
      pushTimer = null
      const { tasks, tombstones } = getState()
      runTransaction(db, async (tx) => {
        const snap = await tx.get(docRef)
        const cur = snap.exists() ? snap.data() : {}
        const next = reconcile(cur.tasks || [], cur.tombstones || {}, tasks, tombstones)
        const patch = {
          tasks: next.tasks,
          tombstones: next.tombstones,
        }
        if (!snap.exists()) {
          patch.ownerUid = user.uid
        }
        tx.set(docRef, { ...cur, ...patch })
      }).catch((err) => {
        const mapped = mapError(err)
        if (mapped === 'auth-error' || mapped === 'room-not-found') {
          setStatus(mapped)
        }
        // Errores transitorios de push: silenciar (el push es best-effort)
      })
    }, PUSH_DEBOUNCE)
  }

  function subscribe(id) {
    docRef = doc(db, 'rooms', id)
    retryCount = 0
    subscribeRaw()
  }

  function teardown() {
    if (pushTimer) clearTimeout(pushTimer)
    pushTimer = null
    if (retryTimer) clearTimeout(retryTimer)
    retryTimer = null
    if (unsub) unsub()
    unsub = null
    docRef = null
    claimReady = false
    retryCount = 0
  }

  // Crea sala nueva con tokens.
  // NOTA: NO hacer getDoc antes — las reglas niegan `read` en docs inexistentes
  // (resource es null → resource.data falla → permission-denied). Las reglas ya
  // distinguen create vs update: `create` valida campos; `update` exige ser owner.
  async function createRoom(roomCode, editTokenHash, viewTokenHash, initialTasks, initialTombstones) {
    await authReady
    const user = auth.currentUser
    if (!user) return { ok: false, error: 'no-auth' }
    const roomRef = doc(db, 'rooms', roomCode)
    try {
      await setDoc(roomRef, {
        ownerUid: user.uid,
        editTokenHash,
        viewTokenHash,
        tasks: initialTasks || [],
        tombstones: initialTombstones || {},
      })
      return { ok: true }
    } catch (err) {
      console.error('[sync] createRoom failed:', err?.code || err)
      return { ok: false, error: err?.code || 'unknown' }
    }
  }

  // Rota tokens de una sala (solo owner).
  async function rotateTokens(roomCode, newEditHash, newViewHash) {
    await authReady
    const user = auth.currentUser
    if (!user) return { ok: false, error: 'no-auth' }
    const roomRef = doc(db, 'rooms', roomCode)
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(roomRef)
        if (!snap.exists()) throw new Error('Sala no existe')
        const data = snap.data()
        if (data.ownerUid !== user.uid) throw new Error('No eres owner')
        tx.update(roomRef, {
          editTokenHash: newEditHash,
          viewTokenHash: newViewHash,
        })
      })
      return { ok: true }
    } catch (err) {
      console.error('[sync] rotateTokens failed:', err?.code || err)
      return { ok: false, error: err?.code || err?.message || 'unknown' }
    }
  }

  async function start(id, token, role) {
    teardown()
    roomId = id
    if (token) {
      const user = await authReady
      if (!user) {
        onStatus?.('auth-error')
        return
      }
      const result = await createClaim(id, token, role)
      if (!result.ok) {
        onStatus?.('auth-error')
        return
      }
    }
    claimReady = true
    subscribe(id)
  }

  return {
    start,
    setRoom: start,
    push,
    createRoom,
    rotateTokens,
    adoptLegacyRoom,
    stop: teardown,
    isConnected: () => connected,
  }
}
