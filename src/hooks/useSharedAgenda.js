import { useEffect, useMemo, useRef, useState } from 'react'
import { createSync } from '../lib/sync'
import { loadShared, saveShared } from '../lib/storage'
import { NAME_REQUIRED_ERROR, SHARED_OPEN_TIMEOUT_MS } from '../lib/constants'
import { normalizeRoomCode, parseInviteParams } from '../lib/share'

export const SHARED_PHASES = {
  IDLE: 'idle',
  ASKING_NAME: 'asking-name',
  VALIDATING: 'validating',
  TIMED_OUT: 'timed-out',
  READY: 'ready',
  DENIED: 'denied',
  NOT_FOUND: 'not-found',
  REVOKED: 'revoked',
}

const EMPTY = { tasks: [], tombstones: {} }
const INVALID_NAME_ERROR = 'Ese nombre no es válido. Prueba con otro.'

export function readViewerLink() {
  const { room, token, role } = parseInviteParams(new URLSearchParams(window.location.search))
  if (!room || !token || role !== 'viewer') return null
  return { code: normalizeRoomCode(room), token }
}

export function useSharedAgenda({ profileName, saveProfile }) {
  const [initialLink] = useState(readViewerLink)
  const [phase, setPhase] = useState(
    initialLink ? (profileName ? SHARED_PHASES.VALIDATING : SHARED_PHASES.ASKING_NAME) : SHARED_PHASES.IDLE,
  )
  const [data, setData] = useState(EMPTY)
  const [status, setStatus] = useState('offline')
  const [liveOwner, setLiveOwner] = useState(null)
  const [remembered, setRemembered] = useState(loadShared)
  const [nameError, setNameError] = useState('')

  const dataRef = useRef(data)
  const credsRef = useRef(initialLink && { ...initialLink, fresh: true })
  const lastAttemptRef = useRef(null)
  dataRef.current = data

  const sync = useMemo(
    () =>
      createSync({
        getState: () => dataRef.current,
        onState: setData,
        onStatus: setStatus,
        onMeta: (meta) => setLiveOwner(meta.ownerName),
      }),
    [],
  )

  const clearData = () => {
    dataRef.current = EMPTY
    setData(EMPTY)
    setLiveOwner(null)
    setNameError('')
  }

  const reset = () => {
    credsRef.current = null
    sync.stop()
    clearData()
  }

  const forget = () => {
    saveShared(null)
    setRemembered(null)
  }

  const begin = async (code, token, fresh, name) => {
    const mine = { code, token, fresh }
    credsRef.current = mine
    lastAttemptRef.current = { ...mine, name }
    clearData()
    setStatus('connecting')
    setPhase(SHARED_PHASES.VALIDATING)
    const result = await sync.joinAsViewer(code, token, name)
    if (credsRef.current !== mine || result.ok) return
    if (result.error === 'invalid-name') {
      setNameError(INVALID_NAME_ERROR)
      setPhase(SHARED_PHASES.ASKING_NAME)
    } else setPhase(SHARED_PHASES.DENIED)
  }

  useEffect(() => {
    if (phase !== SHARED_PHASES.VALIDATING && phase !== SHARED_PHASES.READY) return
    if (status === 'online' && phase === SHARED_PHASES.VALIDATING) {
      setPhase(SHARED_PHASES.READY)
    } else if (status === 'auth-error' || status === 'room-not-found') {
      const wasKnown = phase === SHARED_PHASES.READY || !credsRef.current?.fresh
      sync.stop()
      if (wasKnown) {
        forget()
        setPhase(SHARED_PHASES.REVOKED)
      } else setPhase(status === 'auth-error' ? SHARED_PHASES.DENIED : SHARED_PHASES.NOT_FOUND)
    }
  }, [status, phase])

  useEffect(() => {
    if (phase !== SHARED_PHASES.VALIDATING) return
    const timer = setTimeout(() => {
      credsRef.current = null
      sync.stop()
      setPhase(SHARED_PHASES.TIMED_OUT)
    }, SHARED_OPEN_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [phase])

  useEffect(() => {
    const creds = credsRef.current
    if (phase !== SHARED_PHASES.READY || !creds) return
    const next = { code: creds.code, token: creds.token, ownerName: liveOwner || null }
    saveShared(next)
    setRemembered(next)
  }, [phase, liveOwner])

  const join = (code, token) => {
    if (profileName) {
      begin(code, token, true, profileName)
      return
    }
    reset()
    credsRef.current = { code, token, fresh: true }
    setPhase(SHARED_PHASES.ASKING_NAME)
  }

  const submitName = (name) => {
    const creds = credsRef.current
    const clean = creds && saveProfile(name)
    if (!clean) {
      setNameError(NAME_REQUIRED_ERROR)
      return
    }
    begin(creds.code, creds.token, true, clean)
  }

  const reopen = () => {
    if (remembered) begin(remembered.code, remembered.token, false, profileName)
  }

  const retry = () => {
    const last = lastAttemptRef.current
    if (last) begin(last.code, last.token, last.fresh, last.name)
  }

  const close = () => {
    reset()
    setPhase(SHARED_PHASES.IDLE)
  }

  return {
    phase,
    active: phase !== SHARED_PHASES.IDLE,
    tasks: data.tasks,
    status,
    ownerName: liveOwner || remembered?.ownerName || '',
    hasRemembered: Boolean(remembered),
    nameError,
    join,
    submitName,
    reopen,
    retry,
    close,
  }
}
