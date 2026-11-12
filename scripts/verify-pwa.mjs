import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const BASE = 'http://localhost:4173';
const CACHE_VERSION = 'v3';

const results = [];

function report(ok, label, detail = '') {
  results.push({ ok, label });
  const suffix = detail ? ` — ${detail}` : '';
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${suffix}`);
}

async function startServer() {
  const child = spawn('npx vite preview --port 4173', {
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  child.stdout.on('data', () => {});
  child.stderr.on('data', () => {});
  return child;
}

async function waitForServer(timeoutMs = 45000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/index.html`, { cache: 'no-store' });
      if (res.ok) return true;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

function killServer(child) {
  if (!child) return;
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
    });
  } else {
    child.kill('SIGTERM');
  }
}

function findIcon(icons, size) {
  return Array.isArray(icons)
    ? icons.find((icon) => icon && icon.sizes === size && icon.src)
    : undefined;
}

async function main() {
  let server;
  let browser;
  let context;
  let page;
  const pageErrors = [];

  try {
    server = await startServer();
    const serverUp = await waitForServer();
    report(serverUp, 'vite preview responde en :4173');
    if (!serverUp) return;

    const manifestRes = await fetch(`${BASE}/manifest.webmanifest`, {
      cache: 'no-store',
    });
    const manifestOk = manifestRes.ok;
    let manifest = null;
    try {
      manifest = await manifestRes.json();
    } catch {}
    report(manifestOk, 'GET /manifest.webmanifest responde 200', `status ${manifestRes.status}`);
    report(
      Boolean(manifest && typeof manifest.name === 'string' && manifest.name.length > 0),
      'manifest.name válido',
      manifest ? String(manifest.name) : 'sin JSON',
    );
    report(
      Boolean(manifest && manifest.display === 'standalone'),
      'manifest.display standalone',
      manifest ? String(manifest.display) : 'sin JSON',
    );
    report(
      Boolean(manifest && findIcon(manifest.icons, '192x192')),
      'manifest icon 192',
    );
    report(
      Boolean(manifest && findIcon(manifest.icons, '512x512')),
      'manifest icon 512',
    );

    browser = await chromium.launch({ headless: true });
    context = await browser.newContext();
    page = await context.newPage();
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });

    const swActive = await page
      .evaluate(async () => {
        const registration = await navigator.serviceWorker.ready;
        return Boolean(registration && registration.active);
      })
      .catch(() => false);
    report(swActive, 'service worker activo (navigator.serviceWorker.ready)');

    const controlled = await page
      .waitForFunction(() => Boolean(navigator.serviceWorker.controller), null, {
        timeout: 15000,
      })
      .then(() => true)
      .catch(() => false);
    report(controlled, 'página controlada por service worker');

    const controlledReload = await page
      .reload({ waitUntil: 'load', timeout: 30000 })
      .then(() => true)
      .catch(() => false);
    report(controlledReload, 'recarga online controlada por SW (precalienta assets)');

    await page
      .evaluate(async () => {
        await Promise.all([
          fetch('/healthz.json', { cache: 'no-store' }).catch(() => undefined),
          fetch('/manifest.webmanifest', { cache: 'no-store' }).catch(() => undefined),
        ]);
      })
      .catch(() => undefined);

    const cacheInfo = await page.evaluate(async (version) => {
      const keys = await caches.keys();
      const shellKeys = keys.filter(
        (key) => key.startsWith('tu-dia-shell-') && key.includes(version),
      );
      const detail = {};
      for (const name of shellKeys) {
        const cache = await caches.open(name);
        detail[name] = {
          index: Boolean(await cache.match('/index.html')),
          icon180: Boolean(await cache.match('/icon-180.png')),
          icon192: Boolean(await cache.match('/icon-192.png')),
          icon512: Boolean(await cache.match('/icon-512.png')),
        };
      }
      const entries = [];
      for (const name of keys) {
        const cache = await caches.open(name);
        for (const request of await cache.keys()) {
          entries.push({ cache: name, url: request.url });
        }
      }
      return { keys, shellKeys, detail, entries };
    }, CACHE_VERSION);

    report(
      cacheInfo.shellKeys.length > 0,
      `existe caché con prefijo de versión ${CACHE_VERSION}`,
      cacheInfo.shellKeys.join(', ') || 'ninguna',
    );

    const cacheChecks = Object.entries(cacheInfo.detail);
    report(
      cacheChecks.length > 0 && cacheChecks.every(([, info]) => info.index),
      'caché v3 contiene index.html',
    );
    report(
      cacheChecks.length > 0 && cacheChecks.every(([, info]) => info.icon180),
      'caché v3 contiene icon-180.png',
    );
    report(
      cacheChecks.length > 0 && cacheChecks.every(([, info]) => info.icon192),
      'caché v3 contiene icon-192.png',
    );
    report(
      cacheChecks.length > 0 && cacheChecks.every(([, info]) => info.icon512),
      'caché v3 contiene icon-512.png',
    );

    const cachedFirestore = cacheInfo.entries.filter((entry) =>
      entry.url.includes('firestore.googleapis.com'),
    );
    report(
      cachedFirestore.length === 0,
      'Firestore NO está cacheado',
      cachedFirestore.map((entry) => entry.url).join(', '),
    );

    const cachedHealthz = cacheInfo.entries.filter((entry) => {
      try {
        return new URL(entry.url).pathname === '/healthz.json';
      } catch {
        return false;
      }
    });
    report(
      cachedHealthz.length === 0,
      '/healthz.json NO está cacheado',
      cachedHealthz.map((entry) => entry.url).join(', '),
    );

    const cachedManifest = cacheInfo.entries.filter((entry) => {
      try {
        return new URL(entry.url).pathname === '/manifest.webmanifest';
      } catch {
        return false;
      }
    });
    report(
      cachedManifest.length === 0,
      '/manifest.webmanifest NO está cacheado',
      cachedManifest.map((entry) => entry.url).join(', '),
    );

    await context.setOffline(true);

    let reloadOk = false;
    let reloadStatus = null;
    try {
      const response = await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
      reloadStatus = response ? response.status() : null;
      reloadOk = true;
    } catch {}
    report(reloadOk, 'recarga offline completada', `status ${reloadStatus}`);

    const rendered = reloadOk
      ? await page
          .waitForFunction(
            () => {
              const root = document.getElementById('root');
              return Boolean(
                root &&
                  root.children.length > 0 &&
                  root.textContent.trim().length > 0 &&
                  !root.textContent.includes('Algo salió mal'),
              );
            },
            null,
            { timeout: 15000 },
          )
          .then(() => true)
          .catch(() => false)
      : false;
    report(rendered, 'app renderiza con React tras recarga offline');

    let rootState = { children: 0, text: 0, title: '', boundary: false, shell: false };
    if (reloadOk) {
      rootState = await page
        .evaluate(() => {
          const root = document.getElementById('root');
          return {
            children: root ? root.children.length : 0,
            text: root ? root.textContent.trim().length : 0,
            title: document.title,
            boundary: root ? root.textContent.includes('Algo salió mal') : false,
            shell: Boolean(document.querySelector('header') && document.querySelector('main')),
          };
        })
        .catch(() => rootState);
    }
    const notErrorPage =
      rendered &&
      rootState.children > 0 &&
      rootState.text > 0 &&
      !rootState.boundary &&
      rootState.shell &&
      pageErrors.length === 0 &&
      rootState.title.length > 0 &&
      page.url().startsWith(BASE);
    report(
      notErrorPage,
      'no es página de error del navegador',
      `hijos=${rootState.children}, texto=${rootState.text}, title="${rootState.title}", errorBoundary=${rootState.boundary}, header+main=${rootState.shell}, pageerrors=${pageErrors.length}${pageErrors.length ? ' ' + pageErrors.join(' | ') : ''}`,
    );

    await context.setOffline(false).catch(() => undefined);
  } catch (error) {
    report(false, 'ejecución sin excepciones', error && error.message ? error.message : String(error));
  } finally {
    if (browser) await browser.close().catch(() => undefined);
    killServer(server);
  }

  const failures = results.filter((result) => !result.ok);
  console.log(`\nRESULTADO: ${results.length - failures.length}/${results.length} PASS`);
  if (failures.length > 0) {
    console.log(`FALLOS: ${failures.map((failure) => failure.label).join(' | ')}`);
    process.exitCode = 1;
  }
}

main();
