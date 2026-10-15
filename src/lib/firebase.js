import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth'

const env = import.meta.env

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID,
}

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  throw new Error('Falta config de Firebase en .env (VITE_FIREBASE_API_KEY / VITE_FIREBASE_PROJECT_ID)')
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
export const auth = getAuth(app)

let authError = null
signInAnonymously(auth).catch((err) => {
  authError = err?.code || 'unknown'
  console.error('[firebase] signInAnonymously falló:', err?.code, err?.message)
})

// Resolve with the actual user once auth is determined.
// The first onAuthStateChanged fires with null (no persisted state).
// We ignore null and wait for the real user from signInAnonymously.
export const authReady = new Promise((resolve) => {
  const timeout = setTimeout(() => resolve(null), 10000)
  const unsubscribe = onAuthStateChanged(auth, (user) => {
    if (!user) return // skip initial null
    clearTimeout(timeout)
    unsubscribe()
    resolve(user)
  })
})

export function getAuthError() {
  return authError
}