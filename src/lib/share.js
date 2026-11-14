import { MAX_NAME_LENGTH } from './constants'

export function normalizeRoomCode(code) {
  return code.toUpperCase().replace(/-V$/, '')
}

export function parseInviteParams(searchParams) {
  return { room: searchParams.get('room'), token: searchParams.get('t'), role: searchParams.get('role') }
}

function trimName(name) {
  return typeof name === 'string' ? name.trim() : ''
}

export function cleanName(name) {
  const clean = trimName(name)
  return clean.length >= 1 && clean.length <= MAX_NAME_LENGTH ? clean : null
}

export function truncateName(name) {
  return trimName(name).slice(0, MAX_NAME_LENGTH)
}
