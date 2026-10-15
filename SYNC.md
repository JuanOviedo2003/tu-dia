# Sincronizacion movil <-> web (Tu Dia)

## Arquitectura
Servidor WebSocket ligero integrado en el mismo proceso de Vite (plugin
`vite-plugin-sync.js`), en la ruta `/ws`. No hay cuentas ni servicios de terceros:
funciona en LAN igual que el QR existente. Estado autoritativo por "sala" (room)
en memoria del servidor, agrupado por codigo de sala (`?room=CODE` o boton Sync).

El cliente (`src/lib/sync.js`) mantiene una unica conexion por sala, con
reconexion automatica (1.5s) y reenvio de su estado local al reconectar.

## Protocolo (JSON)
- Cliente -> servidor al abrir: `{type:'hello', snapshot:{tasks, tombstones}}`
- Cliente -> servidor en cada cambio: `{type:'update', snapshot:{...}}`
- Servidor -> todos los de la sala: `{type:'state', tasks, tombstones}`

`snapshot` = `{ tasks: Task[], tombstones: { [id]: deletedAt } }`.
Cada tarea lleva `updatedAt` (epoch ms).

## Resolucion de conflictos: Last-Write-Wins por tarea
- Al unir dos estados, para cada `id` se queda la tarea con `updatedAt` mayor
  (empate: gana la remota). Implementado en `src/lib/syncMerge.js` (`mergeTasks`).
- Borrado = tombstone: al eliminar, la tarea sale de `tasks` y se registra
  `{id: deletedAt}` en `tombstones`. Los tombstones se combinan por `deletedAt`
  mayor (`mergeTombstones`). Una tarea se oculta si existe un tombstone con
  `deletedAt` >= su `updatedAt` (`reconcile`).

## Offline
Si el WS esta caido, la app sigue editando en `localStorage` (no se bloquea).
Al recuperar conexion, el cliente reenvia su snapshot (incluye ediciones offline)
y el servidor hace merge LWW; ambos dispositivos convergen.

## Notas
- El QR de transferencia total (`?d=`) se mantiene como respaldo y no depende
  del servidor.
- Compatibilidad: el flujo QR original sigue funcionando; el sync es aditivo.
