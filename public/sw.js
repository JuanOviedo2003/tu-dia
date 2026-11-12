/* Service Worker de Tu Día (HU-4) — shell offline.
 * Escrito a mano, sin dependencias ni plugins.
 *
 * Estrategia:
 *  - /assets/*  → cache-first (los bundles llevan hash, son inmutables).
 *  - index.html → network-first con respaldo en caché (nunca un shell viejo).
 *  - Todo lo demás (Firestore, /healthz.json, /firebase-messaging-sw.js,
 *    /manifest.webmanifest, recursos de otros orígenes) → NUNCA se cachea.
 *
 * Actualizaciones conservadoras: la versión nueva espera a que las pestañas
 * actuales se cierren (sin skipWaiting automático) y toma el control al
 * activarse. Se puede forzar con postMessage({ type: 'SKIP_WAITING' }).
 *
 * Ciclo de vida de cachés: la caché anterior NO se borra en el 'activate'.
 * Se conserva un ciclo más y solo se elimina cuando el shell nuevo está
 * confirmado en caché (HTML + todos sus /assets/* presentes). Si el shell
 * nuevo todavía no tiene sus bundles, la caché anterior sigue sirviendo los
 * assets viejos y el fallback offline usa el shell más reciente utilizable.
 */

const CACHE_PREFIX = 'tu-dia-shell-';
// Subir la versión al cambiar este archivo: fuerza un shell nuevo. La caché
// anterior se conserva un ciclo más (ver evento 'activate') y se purga en la
// siguiente activación, cuando el shell nuevo ya está confirmado en caché.
const CACHE_VERSION = 'v3';
const CACHE_NAME = `${CACHE_PREFIX}${CACHE_VERSION}`;

// Clave canónica del shell: todo el HTML se guarda aquí.
const SHELL_URL = '/index.html';

// Recursos precacheados al instalar (el shell y los iconos de instalación).
const PRECACHE_URLS = [
  SHELL_URL,
  '/icon-180.png',
  '/icon-192.png',
  '/icon-512.png',
];

// Rutas propias que jamás deben cachearse.
const NEVER_CACHE_PATHS = new Set([
  '/healthz.json',
  '/firebase-messaging-sw.js',
  '/manifest.webmanifest',
]);

// Hosts externos que jamás deben cachearse (datos de Firestore).
const NEVER_CACHE_HOSTS = ['firestore.googleapis.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // addAll() falla en bloque si una URL falla: se cachea una por una.
      await Promise.all(
        PRECACHE_URLS.map((url) => cache.add(url).catch(() => undefined)),
      );
      // Sin skipWaiting(): la versión nueva espera a que las pestañas
      // actuales se cierren. Evita servir un shell a medio actualizar.
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      const oldKeys = keys.filter(
        (key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME,
      );

      if (oldKeys.length > 0) {
        // Solo se purga la caché anterior cuando el shell nuevo está
        // confirmado: HTML presente Y todos sus /assets/* ya cacheados.
        const ready = await shellReady(CACHE_NAME);
        if (ready) {
          await Promise.all(oldKeys.map((key) => caches.delete(key)));
        } else {
          // Shell nuevo incompleto: se conserva un ciclo más la generación
          // anterior más reciente y, si existe, la más reciente que aún tenga
          // un shell utilizable (HTML + assets). El resto se descarta para no
          // crecer sin límite.
          const sorted = oldKeys.sort(
            (a, b) => versionNumber(b) - versionNumber(a),
          );
          const keep = new Set([sorted[0]]);
          for (const name of sorted.slice(1)) {
            if (keep.size >= 2) break;
            if (await shellReady(name)) keep.add(name);
          }
          await Promise.all(
            oldKeys
              .filter((key) => !keep.has(key))
              .map((key) => caches.delete(key)),
          );
        }
      }

      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

function isNeverCache(url) {
  const hostMatch = NEVER_CACHE_HOSTS.some(
    (host) => url.hostname === host || url.hostname.endsWith(`.${host}`),
  );
  if (hostMatch) return true;
  return NEVER_CACHE_PATHS.has(url.pathname);
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  // Nunca cachear: Firestore, healthz, push, manifiesto.
  if (isNeverCache(url)) return;

  // Solo se gestionan peticiones del propio origen.
  if (url.origin !== self.location.origin) return;

  // Assets versionados: cache-first.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Shell (navegaciones e index.html): network-first con respaldo en caché.
  if (request.mode === 'navigate' || url.pathname === SHELL_URL) {
    event.respondWith(networkFirstShell(request));
  }
});

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request, { ignoreVary: true });
  if (cached) return cached;

  // Fallback: assets del shell anterior, guardados en cachés retenidas.
  const names = await listShellCaches();
  for (const name of names) {
    if (name === CACHE_NAME) continue;
    const old = await caches.open(name);
    const hit = await old.match(request, { ignoreVary: true });
    if (hit) return hit;
  }

  try {
    const response = await fetch(request);
    if (response && response.ok && response.type === 'basic') {
      // Un fallo al guardar no debe romper la respuesta.
      await cache.put(request, response.clone()).catch(() => undefined);
      // El shell nuevo ya tiene todos sus assets: se puede purgar lo viejo.
      await purgeOldCachesIfReady().catch(() => undefined);
    }
    return response;
  } catch (error) {
    // Offline y sin copia en caché: respuesta controlada en vez de rechazar.
    return new Response('Recurso no disponible sin conexión.', {
      status: 504,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

async function networkFirstShell(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const response = await fetch(request);
    if (response && response.ok) {
      // El HTML se guarda siempre bajo la clave canónica del shell.
      await cache.put(SHELL_URL, response.clone()).catch(() => undefined);
    }
    return response;
  } catch (error) {
    // Sin red: se usa el shell más reciente cuyos assets estén cacheados.
    const cached = await findUsableShell();
    if (cached) return cached;

    return new Response(
      '<!doctype html><html lang="es"><head><meta charset="utf-8">' +
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
        '<title>Tu Día</title></head><body>' +
        '<p>Sin conexión. Volvé a intentarlo cuando tengas internet.</p>' +
        '</body></html>',
      {
        status: 503,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      },
    );
  }
}

// --- Utilidades de caché -------------------------------------------------

// Número de versión de una caché (v2 -> 2) para ordenarlas de más nueva a más vieja.
function versionNumber(cacheName) {
  const match = cacheName.match(/(\d+)$/);
  return match ? Number(match[1]) : 0;
}

// Todas las cachés del shell, ordenadas de la más reciente a la más antigua.
async function listShellCaches() {
  const keys = await caches.keys();
  return keys
    .filter((key) => key.startsWith(CACHE_PREFIX))
    .sort((a, b) => versionNumber(b) - versionNumber(a));
}

// Rutas /assets/* referenciadas por el HTML del shell.
function extractAssetPaths(html) {
  const matches = html.match(/\/assets\/[A-Za-z0-9._-]+/g);
  return matches ? Array.from(new Set(matches)) : [];
}

// ¿Están todos los assets del shell presentes en esa misma caché?
async function shellAssetsCached(cache, html) {
  const paths = extractAssetPaths(html);
  if (paths.length === 0) return true;
  for (const path of paths) {
    const hit = await cache.match(path, { ignoreVary: true });
    if (!hit) return false;
  }
  return true;
}

// El shell nuevo está confirmado cuando su HTML está cacheado y todos sus
// assets (bundles con hash) también.
async function shellReady(cacheName) {
  const cache = await caches.open(cacheName);
  const shell = await cache.match(SHELL_URL);
  if (!shell) return false;
  const html = await shell.clone().text();
  return shellAssetsCached(cache, html);
}

// Shell offline más reciente utilizable (HTML + todos sus assets en la MISMA
// caché). Si ninguna generación está completa, devuelve null: es preferible
// mostrar la página "sin conexión" que servir un shell con bundles faltantes.
async function findUsableShell() {
  const names = await listShellCaches();
  for (const name of names) {
    const cache = await caches.open(name);
    const shell = await cache.match(SHELL_URL);
    if (!shell) continue;
    const html = await shell.clone().text();
    if (await shellAssetsCached(cache, html)) return shell;
  }
  return null;
}

// Purga las cachés anteriores SOLO cuando el shell nuevo está confirmado
// (HTML + todos sus /assets/*). Hasta entonces la generación anterior se
// conserva un ciclo más para que la app siga abriendo offline.
let purgeChecked = false;
async function purgeOldCachesIfReady() {
  if (purgeChecked) return;
  if (!(await shellReady(CACHE_NAME))) return;
  const keys = await caches.keys();
  const oldKeys = keys.filter(
    (key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME,
  );
  if (oldKeys.length === 0) {
    purgeChecked = true;
    return;
  }
  await Promise.all(oldKeys.map((key) => caches.delete(key)));
  purgeChecked = true;
}
