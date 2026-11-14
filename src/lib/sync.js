import { collection, deleteField, doc, getDocs, onSnapshot, query, runTransaction, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore'
import { db, auth, authReady } from './firebase'
import { reconcile } from './syncMerge'
import { generateToken, sha256Hash } from './tokens'
import { MAX_VIEWERS } from './constants'
import { cleanName } from './share'

const PUSH_DEBOUNCE = 150
const MAX_RETRIES = 3
const BASE_BACKOFF_MS = 1000
const DEFAULT_VIEWER_NAME = 'Invitado'

function toViewer(d) {
  const data = d.data()
  return { uid: d.id.split('_')[1], name: data.name || '', joinedAt: data.joinedAt ?? null, revoked: data.revoked === true }
}

// Cliente de sync: Firestore como estado autoritativo por room.
// Acceso basado en tokens SHA-256 verificados por reglas.
export function createSync({ getState, onState, onStatus, onEditTokenMigrated, onMeta }) {
  let roomId = null
  let token = null
  let role = null
  let unsub = null
  let docRef = null
  let pushTimer = null
  let unsubClaim = null
  let claimReady = false
  let retryCount = 0
  let retryTimer = null
  let session = 0

  function viewersQuery(roomCode) {
    return query(collection(db, 'roomAccess'), where('roomId', '==', roomCode), where('role', '==', 'viewer'))
  }

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
        if (snap.exists()) onMeta?.({ ownerName: cleanName(snap.data().ownerName) })
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

  // Crea doc de reclamación roomAccess/{roomId}_{uid}: editor {role, proof, roomId}; viewer suma name y joinedAt.
  async function createClaim(roomCode, token, role, name) {
    await authReady
    const user = auth.currentUser
    if (!user || !token) return { ok: false, error: 'no-auth' }
    const proof = sha256Hash(token)
    const claimRef = doc(db, 'roomAccess', `${roomCode}_${user.uid}`)
    const data = { role, proof, roomId: roomCode }
    if (role === 'viewer') {
      data.name = cleanName(name) || DEFAULT_VIEWER_NAME
      data.joinedAt = Date.now()
    }
    try {
      await setDoc(claimRef, data)
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
    if (role === 'viewer') watchClaim(id)
  }

  function watchClaim(id) {
    const s = session
    const uid = auth.currentUser?.uid
    if (!uid) return
    unsubClaim = onSnapshot(doc(db, 'roomAccess', `${id}_${uid}`), (snap) => {
      if (s !== session) return
      if (snap.exists() && snap.data().revoked !== true) return
      stopListening()
      setStatus('auth-error')
    }, () => {})
  }

  function stopListening() {
    if (retryTimer) clearTimeout(retryTimer)
    retryTimer = null
    if (unsub) unsub()
    unsub = null
    claimReady = false
  }

  function teardown() {
    session++
    if (pushTimer) clearTimeout(pushTimer)
    pushTimer = null
    stopListening()
    if (unsubClaim) unsubClaim()
    unsubClaim = null
    docRef = null
    retryCount = 0
  }

  // Crea sala nueva con tokens.
  // NOTA: NO hacer getDoc antes — las reglas niegan `read` en docs inexistentes
  // (resource es null → resource.data falla → permission-denied). Las reglas ya
  // distinguen create vs update: `create` valida campos; `update` exige ser owner.
  async function createRoom(roomCode, editTokenHash, viewTokenHash, initialTasks, initialTombstones, ownerName) {
    await authReady
    const user = auth.currentUser
    if (!user) return { ok: false, error: 'no-auth' }
    try {
      const batch = writeBatch(db)
      const clean = cleanName(ownerName)
      batch.set(doc(db, 'rooms', roomCode), {
        ownerUid: user.uid,
        tasks: initialTasks || [],
        tombstones: initialTombstones || {},
        ...(clean && { ownerName: clean }),
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

  async function renewViewToken(roomCode, newViewHash) {
    const result = await updateRoomKey(roomCode, 'viewTokenHash', newViewHash)
    if (!result.ok) return result
    try {
      const snap = await getDocs(viewersQuery(roomCode))
      const batch = writeBatch(db)
      let pending = 0
      snap.forEach((d) => {
        if (d.data().revoked !== true) {
          batch.delete(d.ref)
          pending++
        }
      })
      if (pending) await batch.commit()
    } catch (err) {
      console.error('[sync] clear viewer claims failed:', err?.code || err)
    }
    return result
  }

  async function updateAs(ref, patch) {
    try {
      await updateDoc(ref, patch)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err?.code || 'unknown' }
    }
  }

  async function setOwnerName(name) {
    const clean = cleanName(name)
    if (!clean) return { ok: false, error: 'invalid-name' }
    await authReady
    if (!auth.currentUser || !roomId) return { ok: false, error: 'no-auth' }
    return updateAs(doc(db, 'rooms', roomId), { ownerName: clean })
  }

  function listViewers(cb, onError) {
    if (!roomId) return () => {}
    const id = roomId
    return onSnapshot(
      viewersQuery(id),
      (snap) => cb(snap.docs.map(toViewer).sort((a, b) => (a.joinedAt ?? 0) - (b.joinedAt ?? 0))),
      (err) => onError?.(mapError(err)),
    )
  }

  async function revokeViewer(uid) {
    await authReady
    if (!auth.currentUser || !roomId || !uid) return { ok: false, error: 'no-auth' }
    return updateAs(doc(db, 'roomAccess', `${roomId}_${uid}`), { revoked: true })
  }

  async function joinAsViewer(id, viewToken, name) {
    const clean = cleanName(name)
    if (!clean) return { ok: false, error: 'invalid-name' }
    const user = await authReady
    if (!user) return { ok: false, error: 'no-auth' }
    const snap = await getDocs(viewersQuery(id)).catch(() => null)
    const active = snap ? snap.docs.map(toViewer).filter((v) => !v.revoked && v.uid !== user.uid) : []
    if (active.length >= MAX_VIEWERS) return { ok: false, error: 'viewer-limit' }
    await start(id, viewToken, 'viewer', clean)
    return { ok: true }
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

  async function claimOrFail(id, claimToken, claimRole, s, name) {
    const result = await createClaim(id, claimToken, claimRole, name)
    if (s !== session) return false
    if (!result.ok) setStatus(result.error === 'permission-denied' ? 'auth-error' : 'offline')
    return result.ok
  }

  async function start(id, nextToken, nextRole, nextName) {
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
      if (!(await claimOrFail(id, nextToken, nextRole, s, nextName))) return
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
    joinAsViewer,
    setOwnerName,
    listViewers,
    revokeViewer,
    push,
    createRoom,
    renewViewToken,
    rotateEditToken,
    stop: teardown,
  }
}
