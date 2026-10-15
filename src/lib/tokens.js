// Generación de tokens y hashes SHA-256 para control de acceso a salas.
// Tokens: ≥16 chars, charset sin caracteres ambiguos (O/0/I/1).
// Hashes: SHA-256 pura via js-sha256 (no depende de crypto.subtle / HTTPS).
// crypto.getRandomValues SÍ está disponible en http — se usa solo para tokens.

import { sha256 } from 'js-sha256'

const TOKEN_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const TOKEN_LENGTH = 20

// Genera un token aleatorio seguro (CSPRNG).
export function generateToken() {
  const arr = new Uint8Array(TOKEN_LENGTH)
  crypto.getRandomValues(arr)
  return Array.from(arr, (b) => TOKEN_CHARS[b % TOKEN_CHARS.length]).join('')
}

// SHA-256 de un string → hex lowercase.  Funciona en http y https.
export function sha256Hash(input) {
  return sha256(input)
}

// Genera par de tokens y sus hashes para una sala.
export async function generateRoomTokens() {
  const editToken = generateToken()
  const viewToken = generateToken()
  const [editTokenHash, viewTokenHash] = await Promise.all([
    sha256Hash(editToken),
    sha256Hash(viewToken),
  ])
  return { editToken, viewToken, editTokenHash, viewTokenHash }
}

// Verifica un token contra un hash almacenado.
export async function verifyToken(token, storedHash) {
  const computed = await sha256Hash(token)
  return computed === storedHash
}
