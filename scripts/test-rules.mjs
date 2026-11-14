import { register } from 'node:module'
import { initializeApp } from 'firebase/app'
import { getAuth, connectAuthEmulator, signInAnonymously } from 'firebase/auth'
import {
  getFirestore, connectFirestoreEmulator, doc, getDocFromServer, setDoc, updateDoc,
  writeBatch, runTransaction, deleteField, terminate, collection, query, where, getDocs, deleteDoc,
} from 'firebase/firestore'
import { sha256 } from 'js-sha256'

const PROJECT = process.env.GCLOUD_PROJECT || 'demo-tu-dia'
const [fsHost, fsPort] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':')
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099'

const results = []
let n = 0

async function makeUser(name) {
  const app = initializeApp({ projectId: PROJECT, apiKey: 'fake-api-key' }, name)
  const auth = getAuth(app)
  connectAuthEmulator(auth, `http://${authHost}`, { disableWarnings: true })
  const db = getFirestore(app)
  connectFirestoreEmulator(db, fsHost, Number(fsPort))
  const { user } = await signInAnonymously(auth)
  return { name, app, auth, db, uid: user.uid }
}

async function check(caseId, label, fn, expectOk) {
  n++
  let ok = true
  let err = null
  try { await fn() } catch (e) { ok = false; err = e }
  const pass = ok === expectOk
  const detail = err ? `${err.code || ''} ${String(err.message || err).split('\n')[0].slice(0, 200)}` : ''
  results.push({ caseId, label, expect: expectOk ? 'ALLOW' : 'DENY', got: ok ? 'ALLOW' : 'DENY', pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'} [${caseId}] ${label} (expect ${expectOk ? 'ALLOW' : 'DENY'}, got ${ok ? 'ALLOW' : 'DENY'})${!pass && detail ? ' :: ' + detail : ''}`)
}

const allow = (c, l, f) => check(c, l, f, true)
const deny = (c, l, f) => check(c, l, f, false)

const H = (s) => sha256(s)
const fake = 'f'.repeat(64)
const task = (id) => ({ id, title: id, status: 'todo', updatedAt: Date.now() })

const read = (u, path) => getDocFromServer(doc(u.db, ...path.split('/'))).then((s) => {
  if (!s.exists()) throw Object.assign(new Error('not exists'), { code: 'not-found' })
  return s
})
const rawClaim = (u, room, data) => setDoc(doc(u.db, 'roomAccess', `${room}_${u.uid}`), data)
const claim = (u, room, role, proof) => rawClaim(u, room, role === 'viewer'
  ? { role, proof, roomId: room, name: 'Ana', joinedAt: Date.now() }
  : { role, proof })
const claimRef = (u, room, uid) => doc(u.db, 'roomAccess', `${room}_${uid}`)
const listViewersOf = (u, room) => getDocs(query(collection(u.db, 'roomAccess'), where('roomId', '==', room), where('role', '==', 'viewer')))

function pushLike(u, room, extra) {
  return runTransaction(u.db, async (tx) => {
    const ref = doc(u.db, 'rooms', room)
    const snap = await tx.get(ref)
    const cur = snap.exists() ? snap.data() : {}
    tx.set(ref, { ...cur, tasks: [...(cur.tasks || []), task(extra)], tombstones: { ...(cur.tombstones || {}), [`t-${extra}`]: Date.now() } })
  })
}
const updateKey = (u, room, field, value) => runTransaction(u.db, async (tx) => {
  tx.update(doc(u.db, 'roomKeys', room), { [field]: value })
})
function migrateBatch(u, room, newEditHash, viewHash) {
  const b = writeBatch(u.db)
  b.set(doc(u.db, 'roomKeys', room), { editTokenHash: newEditHash, viewTokenHash: viewHash })
  b.update(doc(u.db, 'rooms', room), { editTokenHash: deleteField(), viewTokenHash: deleteField() })
  return b.commit()
}

async function rulesSuite() {
  const owner = await makeUser('owner')
  const editor = await makeUser('editor2')
  const viewer = await makeUser('viewer')
  const attacker = await makeUser('attacker')

  const R = 'ROOMA'
  const editTok = 'EDITTOKENAAAAAAAAAAAA'
  const viewTok = 'VIEWTOKENAAAAAAAAAAAA'

  await allow(1, 'owner crea sala (batch rooms + roomKeys)', () => {
    const b = writeBatch(owner.db)
    b.set(doc(owner.db, 'rooms', R), { ownerUid: owner.uid, tasks: [], tombstones: {} })
    b.set(doc(owner.db, 'roomKeys', R), { editTokenHash: H(editTok), viewTokenHash: H(viewTok) })
    return b.commit()
  })
  await deny(1, 'atacante crea roomKeys para sala inexistente', () =>
    setDoc(doc(attacker.db, 'roomKeys', 'NOROOM'), { editTokenHash: fake, viewTokenHash: fake }))
  await deny(1, 'atacante sobrescribe sala ajena con su ownerUid (setDoc)', () =>
    setDoc(doc(attacker.db, 'rooms', R), { ownerUid: attacker.uid, tasks: [], tombstones: {} }))

  await allow(2, 'owner lee sala', () => read(owner, `rooms/${R}`))
  await allow(2, 'owner push (tx tasks/tombstones)', () => pushLike(owner, R, 'o1'))
  await allow(2, 'editor crea claim editor', () => claim(editor, R, 'editor', H(editTok)))
  await allow(2, 'editor lee sala', () => read(editor, `rooms/${R}`))
  await allow(2, 'editor push (tx tasks/tombstones)', () => pushLike(editor, R, 'e1'))
  await allow(2, 'viewer crea claim viewer', () => claim(viewer, R, 'viewer', H(viewTok)))
  await allow(2, 'viewer lee sala', () => read(viewer, `rooms/${R}`))
  await deny(2, 'viewer push', () => pushLike(viewer, R, 'v1'))
  await deny(2, 'viewer updateDoc tasks', () => updateDoc(doc(viewer.db, 'rooms', R), { tasks: [] }))
  await deny(2, 'editor con claim role=viewer + proof edit no lee', async () => {
    const tmp = await makeUser('tmpRoleSwap')
    await claim(tmp, R, 'viewer', H(editTok))
    await read(tmp, `rooms/${R}`)
  })

  await deny(3, 'owner lee roomKeys', () => read(owner, `roomKeys/${R}`))
  await deny(3, 'editor lee roomKeys', () => read(editor, `roomKeys/${R}`))
  await deny(3, 'viewer lee roomKeys', () => read(viewer, `roomKeys/${R}`))

  await allow(4, 'atacante (viewer valido) lee antes de forjar', async () => {
    await claim(attacker, R, 'viewer', H(viewTok))
    await read(attacker, `rooms/${R}`)
  })
  await allow(4, 'atacante crea claim editor forjado (64 chars)', () => claim(attacker, R, 'editor', fake))
  await deny(4, 'atacante (claim forjado) lee sala', () => read(attacker, `rooms/${R}`))
  await deny(4, 'atacante (claim forjado) push', () => pushLike(attacker, R, 'a1'))
  await deny(4, 'atacante (claim forjado) updateDoc tasks', () => updateDoc(doc(attacker.db, 'rooms', R), { tasks: [], tombstones: {} }))
  await allow(4, 'atacante claim editor con proof=sha(viewToken)', () => claim(attacker, R, 'editor', H(viewTok)))
  await deny(4, 'atacante (editor+viewHash) lee sala', () => read(attacker, `rooms/${R}`))
  await deny(4, 'atacante setDoc roomKeys (update)', () =>
    setDoc(doc(attacker.db, 'roomKeys', R), { editTokenHash: fake, viewTokenHash: fake }))
  await deny(4, 'atacante updateDoc roomKeys.editTokenHash', () => updateKey(attacker, R, 'editTokenHash', fake))
  await deny(4, 'atacante escribe rooms.editTokenHash', () =>
    updateDoc(doc(attacker.db, 'rooms', R), { editTokenHash: fake }))
  await deny(4, 'editor VALIDO escribe rooms.editTokenHash', () =>
    updateDoc(doc(editor.db, 'rooms', R), { editTokenHash: fake }))
  await deny(4, 'editor VALIDO escribe rooms.viewTokenHash', () =>
    updateDoc(doc(editor.db, 'rooms', R), { viewTokenHash: fake }))
  await deny(4, 'atacante borra claim ajeno (editor)', () =>
    import('firebase/firestore').then(({ deleteDoc }) => deleteDoc(doc(attacker.db, 'roomAccess', `${R}_${editor.uid}`))))
  await deny(4, 'atacante lee claim ajeno', () => read(attacker, `roomAccess/${R}_${editor.uid}`))
  await deny(4, 'atacante crea claim a nombre de otro uid', () =>
    setDoc(doc(attacker.db, 'roomAccess', `${R}_${viewer.uid}`), { role: 'editor', proof: fake }))

  const viewTok2 = 'VIEWTOKENBBBBBBBBBBBB'
  const viewTok3 = 'VIEWTOKENCCCCCCCCCCCC'
  await allow(5, 'owner renueva viewTokenHash (tx update roomKeys)', () => updateKey(owner, R, 'viewTokenHash', H(viewTok2)))
  await deny(5, 'viewer viejo pierde lectura', () => read(viewer, `rooms/${R}`))
  await allow(5, 'editor sigue leyendo', () => read(editor, `rooms/${R}`))
  await allow(5, 'viewer con token nuevo (re-claim = update) lee', async () => {
    await claim(viewer, R, 'viewer', H(viewTok2))
    await read(viewer, `rooms/${R}`)
  })
  await allow(5, 'editor no-owner renueva viewTokenHash', () => updateKey(editor, R, 'viewTokenHash', H(viewTok3)))
  await deny(5, 'viewer (token2) pierde lectura tras renovacion por editor', () => read(viewer, `rooms/${R}`))
  await allow(5, 'editor sigue leyendo/escribiendo', async () => {
    await read(editor, `rooms/${R}`)
    await pushLike(editor, R, 'e2')
  })
  await deny(5, 'viewer intenta renovar viewTokenHash', async () => {
    await claim(viewer, R, 'viewer', H(viewTok3))
    await updateKey(viewer, R, 'viewTokenHash', fake)
  })
  await deny(5, 'renovar con hash invalido (no 64) por owner', () => updateKey(owner, R, 'viewTokenHash', 'short'))
  await deny(5, 'owner anade campo extra a roomKeys', () => updateKey(owner, R, 'extra', fake))

  const editTok2 = 'EDITTOKENBBBBBBBBBBBB'
  await allow(6, 'editor no-owner rota editTokenHash', () => updateKey(editor, R, 'editTokenHash', H(editTok2)))
  await deny(6, 'editor con claim viejo no lee', () => read(editor, `rooms/${R}`))
  await deny(6, 'editor con claim viejo no escribe', () => pushLike(editor, R, 'e3'))
  await allow(6, 'editor re-crea claim con token nuevo (update de claim)', () => claim(editor, R, 'editor', H(editTok2)))
  await allow(6, 'editor vuelve a leer', () => read(editor, `rooms/${R}`))
  await allow(6, 'editor vuelve a escribir', () => pushLike(editor, R, 'e4'))
  await allow(6, 'viewer (token3) no afectado por rotacion edit', () => read(viewer, `rooms/${R}`))

  async function legacyRoom(id, eTok, vTok) {
    await setDoc(doc(owner.db, 'rooms', id), {
      ownerUid: owner.uid, tasks: [], tombstones: {}, editTokenHash: H(eTok), viewTokenHash: H(vTok),
    })
  }
  const L1 = 'LEGACY1', L2 = 'LEGACY2', L3 = 'LEGACY3'
  const lE = 'LEGEDITAAAAAAAAAAAAAA', lV = 'LEGVIEWAAAAAAAAAAAAAA'
  await allow(7, 'owner crea salas legadas (hashes en rooms, sin roomKeys)', async () => {
    await legacyRoom(L1, lE, lV)
    await legacyRoom(L2, lE, lV)
    await legacyRoom(L3, lE, lV)
  })
  await allow(7, 'editor legado claim + lee L1', async () => {
    await claim(editor, L1, 'editor', H(lE))
    await read(editor, `rooms/${L1}`)
  })
  await allow(7, 'editor legado push L1 (hashes intactos)', () => pushLike(editor, L1, 'le1'))
  await allow(7, 'viewer legado claim + lee L1', async () => {
    await claim(viewer, L1, 'viewer', H(lV))
    await read(viewer, `rooms/${L1}`)
  })
  await deny(7, 'viewer legado push L1', () => pushLike(viewer, L1, 'lv1'))
  await deny(7, 'atacante (claim forjado) crea roomKeys en sala legada', async () => {
    await claim(attacker, L1, 'editor', fake)
    await migrateBatch(attacker, L1, fake, fake)
  })
  await deny(7, 'atacante (viewer legado valido) crea roomKeys en sala legada', async () => {
    await claim(attacker, L1, 'viewer', H(lV))
    await setDoc(doc(attacker.db, 'roomKeys', L1), { editTokenHash: fake, viewTokenHash: H(lV) })
  })

  const lE2 = 'LEGEDITBBBBBBBBBBBBBB'
  await allow(7, 'migracion L1 por editor legado (batch set roomKeys + deleteField)', () => migrateBatch(editor, L1, H(lE2), H(lV)))
  await allow(7, 'viewer legado conserva lectura L1', () => read(viewer, `rooms/${L1}`))
  await deny(7, 'editor con hash viejo pierde acceso L1 (lectura)', () => read(editor, `rooms/${L1}`))
  await deny(7, 'editor con hash viejo pierde acceso L1 (escritura)', () => pushLike(editor, L1, 'le2'))
  await allow(7, 'editor re-claim con token nuevo lee/escribe L1', async () => {
    await claim(editor, L1, 'editor', H(lE2))
    await read(editor, `rooms/${L1}`)
    await pushLike(editor, L1, 'le3')
  })
  await allow(7, 'L1 ya no tiene hashes en rooms', async () => {
    const d = (await read(owner, `rooms/${L1}`)).data()
    if ('editTokenHash' in d || 'viewTokenHash' in d) throw new Error('hashes siguen en rooms')
  })
  await allow(7, 'migracion repetida L1 por editor valido (= rotacion de ambas claves)', () => migrateBatch(editor, L1, H(lE2), H(lV)))
  await deny(7, 'migracion repetida L1 por editor con hash viejo', async () => {
    const tmp = await makeUser('tmpOldLegacyEditor')
    await claim(tmp, L1, 'editor', H(lE))
    await migrateBatch(tmp, L1, fake, fake)
  })

  await allow(7, 'migracion L2 por owner (batch)', async () => {
    await claim(viewer, L2, 'viewer', H(lV))
    await claim(editor, L2, 'editor', H(lE))
    await migrateBatch(owner, L2, H(lE2), H(lV))
  })
  await allow(7, 'viewer legado conserva lectura L2', () => read(viewer, `rooms/${L2}`))
  await deny(7, 'editor con hash viejo pierde acceso L2', () => read(editor, `rooms/${L2}`))

  await allow(7, 'migracion L3 por editor legado via runTransaction (como sync.js)', async () => {
    await claim(editor, L3, 'editor', H(lE))
    await claim(viewer, L3, 'viewer', H(lV))
    await runTransaction(editor.db, async (tx) => {
      const ref = doc(editor.db, 'rooms', L3)
      const snap = await tx.get(ref)
      const legacy = snap.data()
      tx.set(doc(editor.db, 'roomKeys', L3), { editTokenHash: H(lE2), viewTokenHash: legacy.viewTokenHash })
      tx.update(ref, { editTokenHash: deleteField(), viewTokenHash: deleteField() })
    })
  })
  await allow(7, 'viewer legado conserva lectura L3', () => read(viewer, `rooms/${L3}`))
  await deny(7, 'editor con hash viejo pierde acceso L3', () => read(editor, `rooms/${L3}`))

  await deny(8, 'editor cambia ownerUid (updateDoc)', () =>
    updateDoc(doc(editor.db, 'rooms', R), { ownerUid: editor.uid }))
  await deny(8, 'editor cambia ownerUid via tx.set completo', () => runTransaction(editor.db, async (tx) => {
    const ref = doc(editor.db, 'rooms', R)
    const cur = (await tx.get(ref)).data()
    tx.set(ref, { ...cur, ownerUid: editor.uid })
  }))
  await deny(8, 'editor borra la sala', () =>
    import('firebase/firestore').then(({ deleteDoc }) => deleteDoc(doc(editor.db, 'rooms', R))))
  await deny(8, 'editor excede limite 500 tasks', () =>
    updateDoc(doc(editor.db, 'rooms', R), { tasks: Array.from({ length: 501 }, (_, i) => i) }))

  const v9 = await makeUser('v9')
  const v9b = await makeUser('v9b')
  const v9c = await makeUser('v9c')
  const vTok = H(viewTok3)
  const vClaim = (room, extra) => ({ role: 'viewer', proof: vTok, roomId: room, name: 'Beto', joinedAt: Date.now(), ...extra })
  await allow(9, 'viewer registra nombre y joinedAt en su claim', () => rawClaim(v9, R, vClaim(R)))
  await allow(9, 'viewer con claim nombrado lee sala', () => read(v9, `rooms/${R}`))
  await allow(9, 'viewer nombre de 40 chars', () => rawClaim(v9b, R, vClaim(R, { name: 'x'.repeat(40) })))
  await allow(9, 'viewer joinedAt como timestamp', () => rawClaim(v9c, R, vClaim(R, { joinedAt: new Date() })))
  const v9d = await makeUser('v9d')
  await deny(9, 'nombre vacio', () => rawClaim(v9d, R, vClaim(R, { name: '' })))
  await deny(9, 'nombre solo espacios', () => rawClaim(v9d, R, vClaim(R, { name: '   ' })))
  await deny(9, 'nombre de 41 chars', () => rawClaim(v9d, R, vClaim(R, { name: 'x'.repeat(41) })))
  await deny(9, 'nombre no string', () => rawClaim(v9d, R, vClaim(R, { name: 5 })))
  await deny(9, 'viewer sin nombre', () => rawClaim(v9d, R, { role: 'viewer', proof: vTok, roomId: R, joinedAt: Date.now() }))
  await deny(9, 'viewer sin roomId', () => rawClaim(v9d, R, { role: 'viewer', proof: vTok, name: 'Beto', joinedAt: Date.now() }))
  await deny(9, 'viewer roomId de otra sala', () => rawClaim(v9d, R, vClaim('OTRA')))
  await deny(9, 'viewer campo extra en claim', () => rawClaim(v9d, R, vClaim(R, { extra: 1 })))
  await deny(9, 'viewer crea claim con revoked:true', () => rawClaim(v9d, R, vClaim(R, { revoked: true })))
  await deny(9, 'viewer crea claim con revoked:false', () => rawClaim(v9d, R, vClaim(R, { revoked: false })))
  await deny(9, 'viewer se auto-revoca (updateDoc)', () => updateDoc(claimRef(v9, R, v9.uid), { revoked: true }))
  await deny(9, 'viewer pone revoked:false (updateDoc)', () => updateDoc(claimRef(v9, R, v9.uid), { revoked: false }))
  await deny(9, 'viewer revoca a otro viewer', () => updateDoc(claimRef(v9, R, v9b.uid), { revoked: true }))
  await deny(9, 'atacante revoca viewer', () => updateDoc(claimRef(attacker, R, v9.uid), { revoked: true }))
  await deny(9, 'viewer lee claim de otro viewer', () => read(v9, `roomAccess/${R}_${v9b.uid}`))
  await deny(9, 'editor revoca con cambio extra', () => updateDoc(claimRef(editor, R, v9.uid), { revoked: true, name: 'Hack' }))
  await deny(9, 'editor revoca claim de editor', () => updateDoc(claimRef(editor, R, editor.uid), { revoked: true }))
  await deny(9, 'editor revoca con revoked:false', () => updateDoc(claimRef(editor, R, v9.uid), { revoked: false }))

  await allow(9, 'owner pone nombre de sala', () => updateDoc(doc(owner.db, 'rooms', R), { ownerName: 'Dueno' }))
  await allow(9, 'editor cambia ownerName', () => updateDoc(doc(editor.db, 'rooms', R), { ownerName: 'Dueno2' }))
  await allow(9, 'viewer lee ownerName', async () => {
    if ((await read(v9, `rooms/${R}`)).data().ownerName !== 'Dueno2') throw new Error('ownerName no visible')
  })
  await allow(9, 'push no pierde ownerName', async () => {
    await pushLike(owner, R, 'o9')
    if ((await read(owner, `rooms/${R}`)).data().ownerName !== 'Dueno2') throw new Error('ownerName perdido')
  })
  await deny(9, 'viewer escribe ownerName', () => updateDoc(doc(v9.db, 'rooms', R), { ownerName: 'Hack' }))
  await deny(9, 'atacante escribe ownerName', () => updateDoc(doc(attacker.db, 'rooms', R), { ownerName: 'Hack' }))
  await deny(9, 'owner ownerName vacio', () => updateDoc(doc(owner.db, 'rooms', R), { ownerName: '' }))
  await deny(9, 'owner ownerName 41 chars', () => updateDoc(doc(owner.db, 'rooms', R), { ownerName: 'x'.repeat(41) }))
  await deny(9, 'owner ownerName no string', () => updateDoc(doc(owner.db, 'rooms', R), { ownerName: 7 }))

  await allow(9, 'owner lista viewers de la sala', async () => {
    const s = await listViewersOf(owner, R)
    if (s.size < 3) throw new Error('listado incompleto: ' + s.size)
  })
  await allow(9, 'editor lista viewers de la sala', async () => {
    const s = await listViewersOf(editor, R)
    if (s.size < 3) throw new Error('listado incompleto: ' + s.size)
  })
  await deny(9, 'viewer lista viewers', () => listViewersOf(v9, R))
  await deny(9, 'atacante lista viewers', () => listViewersOf(attacker, R))
  await deny(9, 'editor viejo (claim invalido) lista viewers', async () => {
    const tmp = await makeUser('tmpListEditor')
    await claim(tmp, R, 'editor', H(editTok))
    await listViewersOf(tmp, R)
  })
  await deny(9, 'listado sin filtro de sala/rol', () => getDocs(collection(owner.db, 'roomAccess')))

  await allow(9, 'editor revoca viewer (quitar acceso)', () => updateDoc(claimRef(editor, R, v9.uid), { revoked: true }))
  await allow(9, 'owner revoca viewer', () => updateDoc(claimRef(owner, R, v9c.uid), { revoked: true }))
  await deny(9, 'viewer revocado no lee la sala', () => read(v9, `rooms/${R}`))
  await deny(9, 'viewer revocado no recrea claim (setDoc)', () => rawClaim(v9, R, vClaim(R)))
  await deny(9, 'viewer revocado no actualiza claim', () => updateDoc(claimRef(v9, R, v9.uid), { name: 'Otro' }))
  await deny(9, 'viewer revocado no quita revoked (deleteField)', () => updateDoc(claimRef(v9, R, v9.uid), { revoked: deleteField() }))
  await deny(9, 'viewer revocado no borra su claim', () => deleteDoc(claimRef(v9, R, v9.uid)))
  await deny(9, 'viewer revocado por owner no lee', () => read(v9c, `rooms/${R}`))
  await allow(9, 'viewer revocado sigue viendo su propio claim', () => read(v9, `roomAccess/${R}_${v9.uid}`))
  await allow(9, 'viewer no revocado sigue leyendo', () => read(v9b, `rooms/${R}`))
  await allow(9, 'listado muestra revoked', async () => {
    const s = await listViewersOf(owner, R)
    if (!s.docs.some((d) => d.id === `${R}_${v9.uid}` && d.data().revoked === true)) throw new Error('revoked no listado')
  })
  await deny(9, 'viewer borra claim de otro', () => deleteDoc(claimRef(v9b, R, v9.uid)))
  await allow(9, 'editor borra claim de viewer', () => deleteDoc(claimRef(editor, R, v9b.uid)))
  await deny(9, 'viewer sin claim tras borrado no lee', () => read(v9b, `rooms/${R}`))
  await deny(9, 'editor no borra claim de editor', () => deleteDoc(claimRef(editor, R, attacker.uid)))
  await allow(9, 'owner borra cualquier claim', () => deleteDoc(claimRef(owner, R, attacker.uid)))

  return [owner, editor, viewer, attacker, v9, v9b, v9c, v9d]
}

const STUB = 'data:text/javascript,' + encodeURIComponent(
  'export let db, auth, authReady; export function __set(x){ db = x.db; auth = x.auth; authReady = Promise.resolve(x.auth.currentUser) }',
)
const HOOKS = `
const STUB = ${JSON.stringify(STUB)};
export async function resolve(spec, ctx, next) {
  const fromSrc = ctx.parentURL && ctx.parentURL.includes('/src/lib/');
  if (fromSrc && spec === './firebase') return { url: STUB, shortCircuit: true };
  if (fromSrc && spec.startsWith('.') && !/\\.[mc]?js$/.test(spec)) return next(spec + '.js', ctx);
  return next(spec, ctx);
}`

const wait = (ms) => new Promise((r) => setTimeout(r, ms))
async function until(fn, ms = 5000) {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) { if (await fn()) return true; await wait(100) }
  throw new Error('timeout esperando condicion')
}

async function syncSuite() {
  register('data:text/javascript,' + encodeURIComponent(HOOKS))
  const stub = await import(STUB)
  const { createSync } = await import(new URL('../src/lib/sync.js', import.meta.url).href)
  const { generateRoomTokens, sha256Hash } = await import(new URL('../src/lib/tokens.js', import.meta.url).href)

  const owner = await makeUser('s-owner')
  const editor = await makeUser('s-editor')
  const viewer = await makeUser('s-viewer')
  const mk = (u) => {
    const st = { tasks: [], tombstones: {}, statuses: [], migrated: null }
    const sync = createSync({
      getState: () => st,
      onState: (next) => { st.tasks = next.tasks; st.tombstones = next.tombstones },
      onStatus: (s) => st.statuses.push(s),
      onEditTokenMigrated: (_id, tok) => { st.migrated = tok },
    })
    return { u, st, sync, use: () => stub.__set(u) }
  }
  const viewer3 = await makeUser('s-viewer3')
  const O = mk(owner), E = mk(editor), V = mk(viewer), V3 = mk(viewer3)
  const room = 'SYNCROOM'
  const t = await generateRoomTokens()

  await allow('S', 'createSync.createRoom (owner)', async () => {
    O.use()
    const r = await O.sync.createRoom(room, t.editTokenHash, t.viewTokenHash, [task('s1')], {})
    if (!r.ok) throw new Error(r.error)
  })
  await allow('S', 'createSync.start editor + push propaga', async () => {
    E.use()
    await E.sync.start(room, t.editToken, 'editor')
    await until(() => E.st.tasks.some((x) => x.id === 's1'))
    E.st.tasks = [...E.st.tasks, task('s2')]
    E.sync.push()
    await wait(600)
    const d = (await read(owner, `rooms/${room}`)).data()
    if (!d.tasks.some((x) => x.id === 's2')) throw new Error('push no llego')
    if (E.st.migrated) throw new Error('migro una sala no legada')
  })
  await allow('S', 'createSync.joinAsViewer recibe estado', async () => {
    V.use()
    const r = await V.sync.joinAsViewer(room, t.viewToken, '  Vera  ')
    if (!r.ok) throw new Error(r.error)
    await until(() => V.st.tasks.some((x) => x.id === 's2'))
  })
  await deny('S', 'createSync.joinAsViewer nombre invalido', async () => {
    V3.use()
    const r = await V3.sync.joinAsViewer(room, t.viewToken, '   ')
    if (!r.ok) throw new Error(r.error)
  })
  await deny('S', 'createSync.joinAsViewer nombre de 41 chars', async () => {
    V3.use()
    const r = await V3.sync.joinAsViewer(room, t.viewToken, 'x'.repeat(41))
    if (!r.ok) throw new Error(r.error)
  })
  await allow('S', 'createSync.joinAsViewer segundo viewer', async () => {
    V3.use()
    const r = await V3.sync.joinAsViewer(room, t.viewToken, 'Carla')
    if (!r.ok) throw new Error(r.error)
    await until(() => V3.st.tasks.some((x) => x.id === 's2'))
  })
  await allow('S', 'createSync.listViewers (editor) ve ambos con nombre recortado', async () => {
    E.use()
    let list = null
    const off = E.sync.listViewers((l) => { list = l })
    try {
      await until(() => list && list.length === 2)
      const names = list.map((v) => v.name).sort().join(',')
      if (names !== 'Carla,Vera') throw new Error('nombres: ' + names)
      if (list.some((v) => v.revoked || !v.uid || !v.joinedAt)) throw new Error('forma incorrecta')
    } finally { off() }
  })
  await deny('S', 'createSync.listViewers (viewer) no lista', async () => {
    V3.use()
    let err = null
    const off = V3.sync.listViewers(() => {}, (e) => { err = e })
    try { await until(() => err) } finally { off() }
    throw new Error(err)
  })
  await allow('S', 'createSync.setOwnerName por owner y viewer lo lee', async () => {
    O.use()
    await O.sync.start(room, t.editToken, 'editor')
    const r = await O.sync.setOwnerName('  Dueno  ')
    if (!r.ok) throw new Error(r.error)
    const d = (await read(viewer, `rooms/${room}`)).data()
    if (d.ownerName !== 'Dueno') throw new Error('ownerName: ' + d.ownerName)
  })
  await deny('S', 'createSync.setOwnerName invalido', async () => {
    O.use()
    const r = await O.sync.setOwnerName('   ')
    if (!r.ok) throw new Error(r.error)
  })
  await deny('S', 'createSync.setOwnerName por viewer', async () => {
    V.use()
    const r = await V.sync.setOwnerName('Hack')
    if (!r.ok) throw new Error(r.error)
  })
  await allow('S', 'createSync.revokeViewer por editor', async () => {
    E.use()
    const r = await E.sync.revokeViewer(viewer.uid)
    if (!r.ok) throw new Error(r.error)
    const s = await listViewersOf(owner, room)
    if (!s.docs.some((d) => d.id === `${room}_${viewer.uid}` && d.data().revoked === true)) throw new Error('no revocado')
  })
  await deny('S', 'createSync.revokeViewer por viewer', async () => {
    V3.use()
    const r = await V3.sync.revokeViewer(viewer.uid)
    if (!r.ok) throw new Error(r.error)
  })
  await deny('S', 'createSync.viewer revocado no se re-une con el link', async () => {
    V.use()
    V.st.statuses.length = 0
    await V.sync.joinAsViewer(room, t.viewToken, 'Vera')
    if (V.st.statuses.includes('auth-error')) throw new Error('bloqueado')
  })
  const nv = await generateRoomTokens()
  await allow('S', 'createSync.renewViewToken por editor', async () => {
    E.use()
    const r = await E.sync.renewViewToken(room, nv.viewTokenHash)
    if (!r.ok) throw new Error(r.error)
  })
  await allow('S', 'renovar corta a todos: claims activos borrados, revocados conservados', async () => {
    const ids = (await listViewersOf(owner, room)).docs.map((d) => d.id)
    if (ids.length !== 1 || ids[0] !== `${room}_${viewer.uid}`) throw new Error('claims: ' + ids.join(','))
  })
  await deny('S', 'viewer activo pierde lectura tras renovar', () => read(viewer3, `rooms/${room}`))
  await allow('S', 'viewer activo se re-une con el link nuevo', async () => {
    V3.use()
    const r = await V3.sync.joinAsViewer(room, nv.viewToken, 'Carla')
    if (!r.ok) throw new Error(r.error)
    await until(() => V3.st.tasks.some((x) => x.id === 's2'))
  })
  await deny('S', 'viewer revocado sigue bloqueado con el link nuevo', async () => {
    V.use()
    V.st.statuses.length = 0
    await V.sync.joinAsViewer(room, nv.viewToken, 'Vera')
    if (V.st.statuses.includes('auth-error')) throw new Error('bloqueado')
  })
  await allow('S', 'createSync.rotateEditToken por editor -> start con token nuevo', async () => {
    E.use()
    const r = await E.sync.rotateEditToken(room, nv.editTokenHash, nv.editToken)
    if (!r.ok) throw new Error(r.error)
    E.st.statuses.length = 0
    E.st.tasks = [...E.st.tasks, task('s3')]
    E.sync.push()
    await wait(600)
    const d = (await read(owner, `rooms/${room}`)).data()
    if (!d.tasks.some((x) => x.id === 's3')) throw new Error('push tras rotacion no llego; statuses=' + E.st.statuses.join(','))
  })
  E.sync.stop(); V.sync.stop(); V3.sync.stop(); O.sync.stop()

  const limitRoom = 'LIMITROOM'
  const lm = await generateRoomTokens()
  const fillers = []
  await allow('S', 'tope: sala con 10 viewers activos', async () => {
    O.use()
    const r = await O.sync.createRoom(limitRoom, lm.editTokenHash, lm.viewTokenHash, [], {})
    if (!r.ok) throw new Error(r.error)
    for (let i = 0; i < 10; i++) {
      const f = await makeUser(`s-fill${i}`)
      fillers.push(f)
      await rawClaim(f, limitRoom, { role: 'viewer', proof: lm.viewTokenHash, roomId: limitRoom, name: `F${i}`, joinedAt: Date.now() + i })
    }
    if ((await listViewersOf(owner, limitRoom)).size !== 10) throw new Error('no hay 10 claims')
  })
  await deny('S', 'tope: joinAsViewer con 10 activos -> viewer-limit', async () => {
    O.use()
    const r = await O.sync.joinAsViewer(limitRoom, lm.viewToken, 'Extra')
    if (!r.ok) throw new Error(r.error)
  })
  await allow('S', 'tope: error exacto es viewer-limit y no crea claim', async () => {
    O.use()
    const r = await O.sync.joinAsViewer(limitRoom, lm.viewToken, 'Extra')
    if (r.ok || r.error !== 'viewer-limit') throw new Error('got ' + JSON.stringify(r))
    if ((await listViewersOf(owner, limitRoom)).size !== 10) throw new Error('se creo claim')
  })
  await allow('S', 'tope: con un revocado cabe uno nuevo; revocados no cuentan', async () => {
    await updateDoc(claimRef(owner, limitRoom, fillers[0].uid), { revoked: true })
    O.use()
    const r = await O.sync.joinAsViewer(limitRoom, lm.viewToken, 'Extra')
    if (!r.ok) throw new Error(r.error)
    O.sync.stop()
  })
  await allow('S', 'tope: viewer existente puede re-unirse con 10 activos', async () => {
    O.use()
    const r = await O.sync.joinAsViewer(limitRoom, lm.viewToken, 'Extra')
    if (!r.ok) throw new Error(r.error)
    O.sync.stop()
  })

  const legacy = 'SYNCLEGACY'
  const lt = await generateRoomTokens()
  await setDoc(doc(owner.db, 'rooms', legacy), {
    ownerUid: owner.uid, tasks: [task('L')], tombstones: {}, editTokenHash: lt.editTokenHash, viewTokenHash: lt.viewTokenHash,
  })
  const E2 = mk(editor), V2 = mk(viewer)
  await allow('S', 'createSync.start editor sala legada -> migra y re-claim', async () => {
    E2.use()
    await E2.sync.start(legacy, lt.editToken, 'editor')
    if (!E2.st.migrated) throw new Error('onEditTokenMigrated no llamado; statuses=' + E2.st.statuses.join(','))
    await until(() => E2.st.tasks.some((x) => x.id === 'L'))
    const d = (await read(owner, `rooms/${legacy}`)).data()
    if ('editTokenHash' in d) throw new Error('hash sigue en rooms')
    if (sha256Hash(E2.st.migrated) === lt.editTokenHash) throw new Error('token no cambio')
  })
  await allow('S', 'createSync.start viewer legado tras migracion', async () => {
    V2.use()
    await V2.sync.start(legacy, lt.viewToken, 'viewer')
    await until(() => V2.st.tasks.some((x) => x.id === 'L'))
  })
  E2.sync.stop(); V2.sync.stop()
  return [owner, editor, viewer, viewer3, ...fillers]
}

const users = []
try {
  users.push(...await rulesSuite())
} catch (e) {
  console.error('ERROR suite reglas:', e)
}
if (!process.argv.includes('--no-sync')) {
  try {
    users.push(...await syncSuite())
  } catch (e) {
    console.error('ERROR suite createSync:', e)
    results.push({ caseId: 'S', label: 'suite createSync', expect: 'ALLOW', got: 'ERROR', pass: false, detail: e.message })
  }
}

console.log('\n| # | Caso | Esperado | Obtenido | Resultado |')
console.log('|---|------|----------|----------|-----------|')
for (const r of results) console.log(`| ${r.caseId} | ${r.label} | ${r.expect} | ${r.got} | ${r.pass ? 'PASS' : 'FAIL'} |`)
const failed = results.filter((r) => !r.pass)
console.log(`\nTotal ${results.length}, PASS ${results.length - failed.length}, FAIL ${failed.length}`)
for (const u of users) await terminate(u.db).catch(() => {})
process.exit(failed.length ? 1 : 0)
