import { useEffect, useRef, useState } from 'react'
import { useTasks } from './useTasks'
import { readViewerLink, useSharedAgenda } from './useSharedAgenda'
import { normalizeRoomCode, parseInviteParams, truncateName } from '../lib/share'
import {
  clearRoomCredentials,
  migrateLegacyViewer,
  saveRoomCode,
  loadRoomCode,
  saveToken,
  loadToken,
  saveRole,
  loadRole,
  saveViewToken,
  loadViewToken,
  saveProfileName,
  loadProfileName,
  saveOwnRoom,
  loadOwnRoom,
} from '../lib/storage'

export const ROOM_STATES = {
  IDLE: 'idle',
  VALIDATING: 'validating',
  DENIED: 'denied',
  NOT_FOUND: 'not-found',
  EDITOR: 'editor',
  VIEWER: 'viewer',
}

const NO_TOKENS = { editToken: null, viewToken: null }

function saveRoomCredentials(code, token, role, viewToken) {
  saveRoomCode(code)
  saveToken(token)
  saveRole(role)
  saveViewToken(viewToken)
}

function clearRoomParams() {
  const url = new URL(window.location.href)
  url.searchParams.delete('room')
  url.searchParams.delete('t')
  url.searchParams.delete('role')
  window.history.replaceState({}, '', url.toString())
}

function readTokens(role, token) {
  if (role === 'viewer') return { editToken: null, viewToken: token }
  return { editToken: token, viewToken: loadViewToken() }
}

export function useAgenda() {
  const [roomState, setRoomState] = useState(ROOM_STATES.IDLE)
  const [roomCode, setRoomCode] = useState('')
  const [roomRole, setRoomRole] = useState('')
  const [tokens, setTokens] = useState(NO_TOKENS)
  const [pendingJoin, setPendingJoin] = useState(null)

  const [profileName, setProfileName] = useState(loadProfileName)
  const [ownRoomCode, setOwnRoomCode] = useState(loadOwnRoom)
  const [ownError, setOwnError] = useState(false)
  const [booted, setBooted] = useState(false)
  const [onlineTick, setOnlineTick] = useState(0)

  const pendingCreds = useRef(null)
  const creatingRef = useRef(false)
  const occupiedRef = useRef(false)
  const nameSyncedRef = useRef('')

  const handleEditTokenMigrated = (code, editToken) => {
    if (pendingCreds.current?.code === code) pendingCreds.current = { ...pendingCreds.current, token: editToken }
    else if (loadRoomCode() === code) saveToken(editToken)
    else return
    setTokens((prev) => ({ ...prev, editToken }))
  }

  const saveProfile = (name) => {
    const clean = truncateName(name)
    if (!clean) return null
    saveProfileName(clean)
    setProfileName(clean)
    return clean
  }

  const shared = useSharedAgenda({ profileName, saveProfile })
  const { join: joinShared, close: closeShared } = shared

  const api = useTasks(roomRole, handleEditTokenMigrated)
  const { syncStatus, initSync, createRoom, renewViewToken: renewView, rotateEditToken: rotateEdit, stop } = api
  const localCount = api.tasks.length

  const clearOwnRoom = () => {
    saveOwnRoom(null)
    setOwnRoomCode('')
  }

  const joinRoom = (code, token, role, discardLocal = false) => {
    closeShared()
    if (code !== ownRoomCode) clearOwnRoom()
    pendingCreds.current = { code, token, role }
    setRoomCode(code)
    setRoomState(ROOM_STATES.VALIDATING)
    setRoomRole(role)
    setTokens(role === 'viewer' ? { editToken: null, viewToken: token } : { editToken: token, viewToken: null })
    initSync(code, token, role, discardLocal)
  }

  const requestJoin = (code, token, role) => {
    if (role === 'viewer') {
      setPendingJoin(null)
      joinShared(code, token)
      return
    }
    if (localCount === 0) {
      setPendingJoin(null)
      joinRoom(code, token, 'editor')
      return
    }
    setPendingJoin({ code, token, role: 'editor', localCount })
  }

  const confirmJoin = (mode) => {
    if (!pendingJoin) return
    const { code, token, role } = pendingJoin
    setPendingJoin(null)
    joinRoom(code, token, role, mode === 'room')
  }

  const cancelJoin = () => setPendingJoin(null)

  useEffect(() => {
    const { room: urlRoom, token: urlToken, role: urlRole } = parseInviteParams(new URLSearchParams(window.location.search))

    const viewerLink = readViewerLink()

    if (urlRoom && urlToken && !viewerLink) {
      requestJoin(normalizeRoomCode(urlRoom), urlToken, urlRole || 'editor')
      clearRoomParams()
    } else if (urlRoom && !viewerLink) {
      setRoomCode(normalizeRoomCode(urlRoom))
      setRoomState(ROOM_STATES.DENIED)
    } else {
      if (viewerLink) {
        joinShared(viewerLink.code, viewerLink.token)
        clearRoomParams()
      }
      const storedRoomCode = loadRoomCode()
      const storedToken = loadToken()
      const storedRole = loadRole() || 'editor'

      if (migrateLegacyViewer()) {
        setRoomCode('')
        setRoomState(ROOM_STATES.IDLE)
      } else if (storedRoomCode && storedToken) {
        setRoomCode(storedRoomCode)
        setRoomState(ROOM_STATES.VALIDATING)
        setRoomRole(storedRole)
        setTokens(readTokens(storedRole, storedToken))
        initSync(storedRoomCode, storedToken, storedRole)
        clearRoomParams()
      } else {
        setRoomCode('')
        setRoomState(ROOM_STATES.IDLE)
      }
    }
    setBooted(true)
  }, [initSync])

  useEffect(() => {
    if (syncStatus === 'online' && roomState === ROOM_STATES.VALIDATING) {
      const creds = pendingCreds.current
      if (creds) {
        pendingCreds.current = null
        saveRoomCredentials(creds.code, creds.token, creds.role, null)
      }
      setRoomState(roomRole === 'viewer' ? ROOM_STATES.VIEWER : ROOM_STATES.EDITOR)
    } else if (syncStatus === 'auth-error' || syncStatus === 'room-not-found') {
      setRoomState(syncStatus === 'auth-error' ? ROOM_STATES.DENIED : ROOM_STATES.NOT_FOUND)
      setTokens(NO_TOKENS)
      if (pendingCreds.current) pendingCreds.current = null
      else clearRoomCredentials()
    }
  }, [syncStatus, roomState, roomRole])

  const createNewRoom = async () => {
    if (creatingRef.current) return { ok: false, error: 'busy' }
    if (roomCode) return { ok: false, error: 'exists' }
    creatingRef.current = true
    setOwnError(false)
    try {
      const result = await createRoom(profileName).catch(() => ({ ok: false, error: 'unknown' }))
      if (!result.ok) {
        setOwnError(true)
        return result
      }
      if (occupiedRef.current) return { ok: false, error: 'busy' }
      pendingCreds.current = null
      setPendingJoin(null)
      setRoomCode(result.roomCode)
      setRoomState(ROOM_STATES.EDITOR)
      saveRoomCredentials(result.roomCode, result.editToken, 'editor', result.viewToken)
      saveOwnRoom(result.roomCode)
      setOwnRoomCode(result.roomCode)
      setRoomRole('editor')
      setTokens({ editToken: result.editToken, viewToken: result.viewToken })
      initSync(result.roomCode, result.editToken, 'editor')
      return result
    } finally {
      creatingRef.current = false
    }
  }

  const occupied = roomState !== ROOM_STATES.IDLE || Boolean(pendingJoin) || shared.active
  occupiedRef.current = occupied

  useEffect(() => {
    const onOnline = () => setOnlineTick((n) => n + 1)
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [])

  useEffect(() => {
    if (!booted || !profileName || occupied || ownRoomCode || loadRoomCode()) return
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return
    createNewRoom()
  }, [booted, profileName, roomState, pendingJoin, onlineTick, shared.active])

  useEffect(() => {
    if (roomState !== ROOM_STATES.EDITOR || !profileName || api.roomOwnerName || roomCode === ownRoomCode) return
    const key = `${roomCode}:${profileName}`
    if (nameSyncedRef.current === key) return
    nameSyncedRef.current = key
    api.setOwnerName(profileName)
  }, [roomState, roomCode, profileName, api.roomOwnerName, ownRoomCode])

  const canManageTokens = Boolean(roomCode) && roomRole === 'editor'

  const manageToken = async (action, field, persist) => {
    if (!canManageTokens) return { ok: false, error: 'not-editor' }
    const result = await action(roomCode)
    if (result.ok) {
      persist(result[field])
      setTokens((prev) => ({ ...prev, [field]: result[field] }))
    }
    return result
  }

  const renewViewToken = () => manageToken(renewView, 'viewToken', saveViewToken)
  const rotateEditToken = () => manageToken(rotateEdit, 'editToken', saveToken)

  const resetToLocal = () => {
    pendingCreds.current = null
    setRoomCode('')
    setRoomRole('')
    setTokens(NO_TOKENS)
    setPendingJoin(null)
    setRoomState(ROOM_STATES.IDLE)
  }

  const leaveRoom = () => {
    stop()
    clearRoomCredentials()
    clearOwnRoom()
    resetToLocal()
  }

  const inRoom = roomState === ROOM_STATES.EDITOR || roomState === ROOM_STATES.VIEWER

  const isOwn = Boolean(roomCode) && roomCode === ownRoomCode
  const ownerLabel = api.roomOwnerName || (isOwn || !roomCode ? profileName : '')
  const agendaName = ownerLabel ? `Agenda de ${ownerLabel}` : ''

  return {
    api: shared.active ? { ...api, tasks: shared.tasks, syncStatus: shared.status } : api,
    shared,
    profileName,
    saveProfile,
    ownAgenda: ownRoomCode ? 'ready' : ownError ? 'error' : 'creating',
    agendaName,
    room: {
      state: roomState,
      code: roomCode,
      role: roomRole,
      inRoom,
      isViewer: shared.active,
      tokens,
    },
    requestJoin,
    pendingJoin,
    confirmJoin,
    cancelJoin,
    renewViewToken,
    rotateEditToken,
    leaveRoom,
    backToLocal: resetToLocal,
  }
}
