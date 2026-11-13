import { deleteField, doc, onSnapshot, runTransaction, setDoc, writeBatch } from 'firebase/firestore'
import { db, auth, authReady } from './firebase'
import { reconcile } from './syncMerge'
import { generateToken, sha256Hash } from './tokens'

const PUSH_DEBOUNCE = 150
const MAX_RETRIES = 3
const BASE_BACKOFF_MS = 1000

// Cliente de sync: Firestore como estado autoritativo por room.
// Acceso basado en tokens SHA-256 verificados por reglas.
export function createSync({ getState, onState, onStatus, onEditTokenMigrated }) {
  let roomId = null
  let token = null
  let role = null
  let unsub = null
  let docRef = null
  let pushTimer = null
  let claimReady = false
  let retryCount = 0
  let retryTimer = null
  let session = 0

  function setStatus(s) {
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
    const s = session
    unsub = onSnapshot(
      docRef,
      (snap) => {
        if (s !== session) return
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
        if (s === session) handleError(err)
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

  function push() {
    if (!docRef || !claimReady || role === 'viewer') return
    const user = auth.currentUser
    if (!user) return
    if (pushTimer) clearTimeout(pushTimer)
    pushTimer = setTimeout(() => {
      pushTimer = null
      const s = session
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
        if (s !== session) return
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
    session++
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
    try {
      const batch = writeBatch(db)
      batch.set(doc(db, 'rooms', roomCode), {
        ownerUid: user.uid,
        tasks: initialTasks || [],
        tombstones: initialTombstones || {},
      })
      batch.set(doc(db, 'roomKeys', roomCode), { editTokenHash, viewTokenHash })
      await batch.commit()
      return { ok: true }
    } catch (err) {
      console.error('[sync] createRoom failed:', err?.code || err)
      return { ok: false, error: err?.code || 'unknown' }
    }
  }

  async function updateRoomKey(roomCode, field, value) {
    await authReady
    if (!auth.currentUser) return { ok: false, error: 'no-auth' }
    const keysRef = doc(db, 'roomKeys', roomCode)
    try {
      await runTransaction(db, async (tx) => {
        tx.update(keysRef, { [field]: value })
      })
      return { ok: true }
    } catch (err) {
      console.error(`[sync] update ${field} failed:`, err?.code || err)
      return { ok: false, error: err?.code || err?.message || 'unknown' }
    }
  }

  async function migrateLegacyRoom(id) {
    const roomRef = doc(db, 'rooms', id)
    const newToken = generateToken()
    try {
      const migrated = await runTransaction(db, async (tx) => {
        const snap = await tx.get(roomRef)
        const legacy = snap.exists() ? snap.data() : {}
        if (typeof legacy.editTokenHash !== 'string') return false
        const viewTokenHash = typeof legacy.viewTokenHash === 'string' && legacy.viewTokenHash.length === 64
          ? legacy.viewTokenHash
          : sha256Hash(generateToken())
        tx.set(doc(db, 'roomKeys', id), { editTokenHash: sha256Hash(newToken), viewTokenHash })
        tx.update(roomRef, { editTokenHash: deleteField(), viewTokenHash: deleteField() })
        return true
      })
      return migrated ? newToken : null
    } catch (err) {
      console.error('[sync] migrateLegacyRoom failed:', err?.code || err)
      return null
    }
  }

  function renewViewToken(roomCode, newViewHash) {
    return updateRoomKey(roomCode, 'viewTokenHash', newViewHash)
  }

  async function rotateEditToken(roomCode, newEditHash, newEditToken) {
    const prev = { token, role }
    teardown()
    const result = await updateRoomKey(roomCode, 'editTokenHash', newEditHash)
    if (result.ok) await start(roomCode, newEditToken, 'editor')
    else await start(roomCode, prev.token, prev.role)
    push()
    return result
  }

  async function claimOrFail(id, claimToken, claimRole, s) {
    const result = await createClaim(id, claimToken, claimRole)
    if (s !== session) return false
    if (!result.ok) setStatus(result.error === 'permission-denied' ? 'auth-error' : 'offline')
    return result.ok
  }

  async function start(id, nextToken, nextRole) {
    teardown()
    const s = session
    roomId = id
    token = nextToken
    role = nextRole
    setStatus('connecting')
    if (nextToken) {
      const user = await authReady
      if (s !== session) return
      if (!user) {
        setStatus('auth-error')
        return
      }
      if (!(await claimOrFail(id, nextToken, nextRole, s))) return
      if (nextRole === 'editor') {
        const migratedToken = await migrateLegacyRoom(id)
        if (migratedToken) onEditTokenMigrated?.(id, migratedToken)
        if (s !== session) return
        if (migratedToken) {
          token = migratedToken
          if (!(await claimOrFail(id, migratedToken, 'editor', s))) return
        }
      }
    }
    claimReady = true
    subscribe(id)
  }

  return {
    start,
    push,
    createRoom,
    renewViewToken,
    rotateEditToken,
    stop: teardown,
  }
}
