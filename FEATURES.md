# Features — Despliegue de Tu Día en la nube (Firebase)

Plan para usar la app a diario desde el celular vía web, con base de datos
real y mejoras incrementales.

## Por qué Firebase

Hoy el celular solo sincroniza si la PC tiene `npm run dev` corriendo en la
misma WiFi (WebSocket LAN). Para uso diario se necesita:

- Servidor siempre encendido, sin mantenimiento.
- Datos que no dependan del localStorage del dispositivo.
- Acceso desde cualquier red.

Firestore cubre las tres gratis (tier Spark) e incluye sincronización en
tiempo real: reemplaza todo el sistema artesanal de salas WebSocket +
merge LWW (`syncMerge.js`) + reconexión manual.

---

## Pasos

### 1. Proyecto Firebase
Crear proyecto en la consola de Firebase y habilitar **Firestore** y
**Auth anónima**.
> ~10 minutos, sin tarjeta de crédito.

### 2. Adaptador de datos (`src/lib/firebase.js`)
Exponer la MISMA API que ya consume `useTasks`:
`addTask`, `updateTask`, `removeTask`, `addRecurringTasks`,
`removeAllInGroup`.
> Los componentes no se tocan; solo cambia de dónde vienen los datos.
> Riesgo mínimo.

### 3. Suscripción en vivo
`onSnapshot` sobre la colección `tasks` reemplaza el WebSocket y
`syncMerge.js`.
> Firestore es la autoridad: desaparecen salas, reconciliación y
> tombstones (el delete nativo basta). Menos código que mantener.

### 4. Offline nativo
Activar persistencia IndexedDB de Firestore.
> Misma experiencia actual: editas sin red y sincroniza solo al volver,
> pero con una solución probada en lugar de una casera.

### 5. Auth ligero
Anónima al entrar; opcional después, login por enlace de email para tener
un espacio propio desde cualquier dispositivo.
> Sin contraseñas y evita que extraños escriban en la base.

### 6. Migración de datos
Botón "Subir mis tareas locales", reutilizando el export/import existente.
> Los datos actuales del celular/PC pasan a la nube una sola vez, sin
> duplicar (dedupe por id).

### 7. Hosting + PWA ligera
`firebase deploy` del `dist/`, más `manifest.json` e íconos para
"Agregar a pantalla de inicio" en el celular.
> URL fija HTTPS que funciona en cualquier red; el ícono en el teléfono se
> siente como app nativa.

### 8. Limpieza posterior
Cuando lo nuevo esté probado: borrar plugin WS (`vite-plugin-sync.js`),
salas, `SyncModal.jsx` y flujo QR.
> Mantener ambos sistemas = doble superficie de bugs. Primero estabilizar,
> después cortar.

---

## Por qué este orden

Data layer detrás de un adaptador primero → despliegue temprano con riesgo
bajo → migrar datos → recién entonces eliminar el sistema viejo.
Nunca se queda sin app funcional entre pasos.

## Costo

Tier Spark gratuito: cubre uso personal sobrado (~50k lecturas/día).

## Mejoras futuras (roadmap, no ahora)

- Notificaciones de tareas del día.
- Edición en cadena de series recurrentes.
- Vistas semanales.
