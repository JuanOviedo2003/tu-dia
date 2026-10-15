#!/usr/bin/env node
// Health check post-deploy (CI y monitor externo).
// Uso:
//   node scripts/health-check.mjs --url https://tu-dia-ea0fd.web.app/healthz.json \
//        --firestore tu-dia-ea0fd [--timeout 10000]
// Exit 0 = todo OK. Exit 1 = fallo.

function parseArgs(argv) {
  const args = { timeout: 10000 }
  for (let i = 2; i < argv.length; i += 2) {
    const key = String(argv[i]).replace(/^--/, '')
    const value = argv[i + 1]
    if (!key || value === undefined) continue
    args[key] = value
  }
  return args
}

const args = parseArgs(process.argv)
const failures = []

async function fetchWithTimeout(url, timeout) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    return await fetch(url, { signal: controller.signal, redirect: 'follow' })
  } finally {
    clearTimeout(timer)
  }
}

// 1) Health endpoint del hosting: debe responder 200 con JSON status=ok.
async function checkHosting() {
  if (!args.url) return
  try {
    const res = await fetchWithTimeout(args.url, Number(args.timeout))
    if (res.status !== 200) {
      failures.push(`hosting: HTTP ${res.status} en ${args.url}`)
      return
    }
    const body = await res.json().catch(() => null)
    if (!body || body.status !== 'ok') {
      failures.push(`hosting: respuesta inesperada en ${args.url}: ${JSON.stringify(body)}`)
      return
    }
    console.log(`[ok] hosting: ${args.url} -> status ok`)
  } catch (err) {
    failures.push(`hosting: sin respuesta de ${args.url}: ${err.message || err}`)
  }
}

// 2) Firestore alcanzable via REST (sin auth espera 401/403; otro error = problema).
//    No valida permisos ni datos: solo que la API este viva.
async function checkFirestore() {
  if (!args.firestore) return
  const url = `https://firestore.googleapis.com/v1/projects/${args.firestore}/databases/(default)/documents`
  try {
    const res = await fetchWithTimeout(url, Number(args.timeout))
    if (res.status === 401 || res.status === 403 || res.status === 200) {
      console.log(`[ok] firestore: API viva para proyecto ${args.firestore} (HTTP ${res.status})`)
      return
    }
    failures.push(`firestore: HTTP ${res.status} en ${url}`)
  } catch (err) {
    failures.push(`firestore: sin respuesta de la API: ${err.message || err}`)
  }
}

await checkHosting()
await checkFirestore()

if (failures.length > 0) {
  console.error('HEALTH CHECK FALLO:')
  for (const f of failures) console.error('  - ' + f)
  process.exit(1)
}
console.log('HEALTH CHECK OK')
