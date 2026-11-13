import { useEffect, useRef, useState } from 'react'
import { useTasks } from './useTasks'
import {
  saveRoomCode,
  loadRoomCode,
  saveToken,
  loadToken,
  saveRole,
  loadRole,
  saveViewToken,
  loadViewToken,
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

function clearRoomCredentials() {
  saveRoomCredentials(null, null, null, null)
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

  const pendingCreds = useRef(null)

  const handleEditTokenMigrated = (code, editToken) => {
    if (pendingCreds.current?.code === code) pendingCreds.current = { ...pendingCreds.current, token: editToken }
    else if (loadRoomCode() === code) saveToken(editToken)
    else return
    setTokens((prev) => ({ ...prev, editToken }))
  }

  const api = useTasks(roomRole, handleEditTokenMigrated)
  const { syncStatus, initSync, createRoom, renewViewToken: renewView, rotateEditToken: rotateEdit, stop } = api
  const localCount = api.tasks.length

  const joinRoom = (code, token, role, discardLocal = false) => {
    pendingCreds.current = { code, token, role }
    setRoomCode(code)
    setRoomState(ROOM_STATES.VALIDATING)
    setRoomRole(role)
    setTokens(role === 'viewer' ? { editToken: null, viewToken: token } : { editToken: token, viewToken: null })
    initSync(code, token, role, discardLocal)
  }

  const requestJoin = (code, token, role) => {
    const nextRole = role === 'viewer' ? 'viewer' : 'editor'
    if (nextRole === 'viewer' || localCount === 0) {
      setPendingJoin(null)
      joinRoom(code, token, nextRole)
      return
    }
    setPendingJoin({ code, token, role: nextRole, localCount })
  }

  const confirmJoin = (mode) => {
    if (!pendingJoin) return
    const { code, token, role } = pendingJoin
    setPendingJoin(null)
    joinRoom(code, token, role, mode === 'room')
  }

  const cancelJoin = () => setPendingJoin(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const urlRoom = params.get('room')
    const urlToken = params.get('t')
    const urlRole = params.get('role')

    if (urlRoom && urlToken) {
      requestJoin(urlRoom.toUpperCase().replace(/-V$/, ''), urlToken, urlRole || 'editor')
      clearRoomParams()
    } else if (urlRoom) {
      setRoomCode(urlRoom.toUpperCase().replace(/-V$/, ''))
      setRoomState(ROOM_STATES.DENIED)
    } else {
      const storedRoomCode = loadRoomCode()
      const storedToken = loadToken()
      const storedRole = loadRole() || 'editor'

      if (storedRoomCode && storedToken) {
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
    const result = await createRoom()
    if (result.ok) {
      pendingCreds.current = null
      setPendingJoin(null)
      setRoomCode(result.roomCode)
      setRoomState(ROOM_STATES.EDITOR)
      saveRoomCredentials(result.roomCode, result.editToken, 'editor', result.viewToken)
      setRoomRole('editor')
      setTokens({ editToken: result.editToken, viewToken: result.viewToken })
      initSync(result.roomCode, result.editToken, 'editor')
    }
    return result
  }

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
    resetToLocal()
  }

  const inRoom = roomState === ROOM_STATES.EDITOR || roomState === ROOM_STATES.VIEWER

  return {
    api,
    room: {
      state: roomState,
      code: roomCode,
      role: roomRole,
      inRoom,
      isViewer: roomRole === 'viewer',
      tokens,
    },
    requestJoin,
    pendingJoin,
    confirmJoin,
    cancelJoin,
    createNewRoom,
    renewViewToken,
    rotateEditToken,
    leaveRoom,
    backToLocal: resetToLocal,
  }
}
