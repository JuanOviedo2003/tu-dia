# Runbook de infra (Tu Dia)

Infraestructura, despliegue y operación. Dueño: Dani (infra). Cambios de
arquitectura: preguntar antes de editar este archivo.

## Arquitectura

```
[Vite build] -> [Firebase Hosting (CDN global)]
                    |
                    +--> /healthz.json          (health check)
                    +--> /firebase-messaging-sw.js (FCM push)
                    +--> /assets/*              (inmutable, cache 1 anio)
                    +--> SPA rewrite -> index.html (deep links)
[App web] -------> [Firestore]   estado por sala (rooms, roomAccess)
                +-> [Firebase Auth]   anonimo
                +-> [FCM]        notificaciones push (en preparacion)
```

Decision clave (confirmada por el jefe): **no hay servidor propio para
sync en produccion**. Firestore (`onSnapshot`) da el tiempo real
multi-dispositivo y la resolucion de conflictos LWW vive en
`src/lib/syncMerge.js` (cliente + transaccion en `src/lib/sync.js`).
El servidor Fastify/WebSocket de `server/` (Ana) es **solo modo legacy
LAN/QR local**: se usa en red local, **no se despliega a produccion** y no
forma parte del pipeline. Cloud Functions (validacion, triggers de sharing,
cleanup, conflictos) corren por ahora en **emulador local**; tampoco estan en
el deploy de produccion.

## Pipeline CI/CD (`.github/workflows/ci.yml`)

| Evento | Que hace | Dnde despliega |
|---|---|---|
| PR a main | build + validacion dry-run de `firestore.rules` + canal preview `pr-N` | `https://pr-N--tu-dia-ea0fd.web.app` (7 dias, renovado en cada push) |
| Push a main | build + deploy hosting + reglas + indices + health check | `https://tu-dia-ea0fd.web.app` (produccion) |

- Preview = staging real: mismos datos Firestore que produccion (no hay
  proyecto staging separado; ver "Backups y entornos").
- El deploy de produccion usa `environment: produccion` en Actions: ahi se
  puede exigir aprobacion manual.
- PRs de forks: solo build, sin deploy (secrets no disponibles).
- Cloud Functions **no** se despliegan en el pipeline (hoy: emulador local,
  ver Pendientes). Solo hosting + reglas + indices.

## Configuracion one-time (checklist)

1. **Secrets del repo GitHub** (Settings > Secrets and variables > Actions):
   - `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`,
     `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`,
     `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`,
     `VITE_FIREBASE_MEASUREMENT_ID`: copiar de Firebase Console >
     Configuracion del proyecto > Tus apps > Configuracion SDK. Son valores
     publicos (el SDK web los expone igual); protegerlos es higiene, no seguridad.
   - `FIREBASE_TOKEN`: generado con `npx firebase login:ci` local. Solo para CI,
     nunca commitear.
2. **Environment** `produccion` en Settings > Environments.
3. **Firebase Console**:
   - Authentication > Sign-in method > Anonimo: habilitar.
   - Firestore: creado en region cercana (eur3 recomendado para LATAM/EU).
   - Hosting: nada extra; `firebase.json` ya define headers, caché y rewrite.

## Variables de entorno locales

Copiar `.env.example` a `.env` y llenar (ver checklist arriba). El build no
rompe sin ellas, pero la app falla en runtime (`src/lib/firebase.js` lanza
error al importar). `VITE_FCM_VAPID_KEY` solo al activar push.

## Deploy manual (emergencia o prueba)

```bash
npm ci && npm run build
npx firebase deploy --only hosting --project tu-dia-ea0fd     # solo frontend
npx firebase deploy --only firestore:rules,firestore:indexes --project tu-dia-ea0fd
```

Reglas + indices se despliegan solas en cada push a main; manual solo si
toca algo urgente fuera del pipeline.

## Health checks

- Endpoint publico: `https://tu-dia-ea0fd.web.app/healthz.json` (hosting).
  Responde `{"status":"ok",...}` con `Cache-Control: no-cache`.
- Verificador: `node scripts/health-check.mjs --url <healthz> --firestore <projectId>`.
  Chequea hosting + API de Firestore viva (401/403 esperados sin auth).
- CI lo corre automaticamente post-deploy a produccion.
- Monitor externo: apuntar un uptime check (UptimeRobot y similares) a
  `healthz.json`, cadencia 5 min, alerta tras 2 fallos.

## Logs centralizados

- **Firestore / Auth / Hosting**: Cloud Logging del proyecto
  (`console.cloud.google.com/logs`), explorador por servicio. Ahi caen lecturas,
  escrituras, denegaciones por reglas y errores de deploy de firebase-tools.
- **Errores de cliente**: hoy solo `console.*` del navegador. Pendiente:
  capturador centralizado (Sentry o similar) cuando haya trafico real.
- **CI/CD**: logs de GitHub Actions (retencion 90 dias por defecto).

## Backups y entornos

- Firestore gestionado tiene PITR implicito. Export programado:
  Cloud Scheduler semanal con `gcloud firestore export` a bucket GCS.
  Montar al pasar a trafico real; hoy no esta configurado.
- No hay proyecto staging separado (costo innecesario a esta escala). Los
  canales de preview aíslan el frontend; comparten Firestore de produccion,
  asi que reglas de validacion estrictas (ya en `firestore.rules`) son la
  barrera real.

## Notificaciones push (FCM)

Estado: **en espera de confirmar plan Blaze** (T8). FCM HTTP v1 en
produccion requiere plan Blaze (facturacion activa).

- Si hay Blaze: SW ya servido en `/firebase-messaging-sw.js` (scope `/`),
  recibe config via `postMessage` desde el frontend tras `getToken`.
  Console: Cloud Messaging > generar par WebPush (VAPID) > copiar a
  `VITE_FCM_VAPID_KEY`. Luego: Beto/frontend `getToken`, Ana/Functions envio
  por room. CSP ya permite `gstatic.com` para el SW compat.
- Si no hay Blaze (Spark): **workaround documentado** — sin push nativo se
  cubre con (1) polling ligero desde el cliente cada N minutos cuando la
  pestana este activa (`onSnapshot` ya cubre sync en vivo), y/o (2) email
  como canal de aviso. FCM queda pospuesto; el SW no molesta (inerte hasta
  que el frontend registre token).

## Incidencias comunes

| Sintoma | Diagnóstico | Fix |
|---|---|---|
| Sync no funciona, "auth-error" | Reglas deniegan (claim invalido o usuario anonimo sin auth) | Ver Auth anonimo habilitado; reglas en `firestore.rules` |
| App en blanco al abrir | Faltan `VITE_FIREBASE_*` en el build | Revisar secrets de Actions / `.env` local |
| Deploy CI falla en reglas | Error de sintaxis en `firestore.rules` | Dry-run local: `npx firebase deploy --only firestore:rules --dry-run` |
| Deploy falla: permisos | `FIREBASE_TOKEN` expirado o sin rol | Regenerar con `npx firebase login:ci` |
| Cambios no aparecen en prod | Cache del `index.html` previo | `index.html` va con `no-cache`; forzar reload / revisar CDN |
| Preview channel caido | Expiraron los 7 dias sin pushes | Redesplegar: reabrir PR o push nuevo |

## Criterio de salida: Firestore -> PostgreSQL

Migrar solo si se cumple alguna: consultas relacionales/reportes complejos,
mas de ~10k usuarios activos, o factura Firestore > costo de mantener backend
(Postgres gestionado + API + realtime propio). Evaluacion trimestral.

## Pendientes de infra

- [ ] T8 push: confirmar plan Blaze. Sin Blaze, aplicar workaround polling/
      email documentado arriba y posponer FCM.
- [ ] Cloud Functions de Ana (validacion, sharing, cleanup, conflictos):
      cuando salgan del emulador, extender pipeline con `--only functions`
      (requiere Blaze).
- [ ] Configurar export programado de Firestore al pasar a produccion real.
- [ ] Code-splitting del bundle JS (1 MB hoy): dueño Beto, infra reabre con
      `manualChunks` si la metrica lo pide.
