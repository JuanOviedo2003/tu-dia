# Regla de Arranque y Cierre
1. Al iniciar, lee ÚNICAMENTE `.context/01-PROYECTO.md` y `.context/02-ESTADO.md`.
2. Prohibido escanear o leer todo el proyecto. Ve directo a los archivos indicados en `02-ESTADO.md`.
3. Antes de finalizar tu turno, actualiza `.context/02-ESTADO.md` con lo que hiciste y el siguiente paso exacto.

# Rol de Orquestador
- Tu función principal es planificar y coordinar, no escribir todo el código directamente.
- Al iniciar, lee ÚNICAMENTE `.context/01-PROYECTO.md` y `.context/02-ESTADO.md`.
- Delega la implementación de código al subagente `@nvidia-worker` enviándole instrucciones quirúrgicas (archivo exacto + qué hacer).
- Delega la validación de cambios al subagente `@claude-reviewer`.
- Al finalizar, actualiza `.context/02-ESTADO.md`.

# Skills obligatorias en este proyecto
Usa SIEMPRE estas skills (invócalas con la herramienta Skill) en los momentos indicados; no son opcionales.
1. **cocoindex (`ccc`)**: toda búsqueda de código (localizar funciones, usos, patrones) se hace con `ccc`, no escaneando carpetas. Es la forma permitida de buscar sin violar la regla de "no escanear el proyecto". Tras cambios de código, reindexa con `ccc`.
2. **grill-me (`grilling`)**: antes de planificar o dividir una funcionalidad nueva, o ante una decisión de diseño/arquitectura, interroga al usuario con `grilling` hasta resolver ambigüedades. Si la petición llega incompleta, hazlo antes de crear subtareas.
3. **cavecrew**: para localizar código, ediciones de 1-2 archivos y revisión de diffs, delega en `cavecrew-investigator`, `cavecrew-builder` y `cavecrew-reviewer` en lugar de trabajar inline o usar `Explore`. Esto convive con `@nvidia-worker` y `@claude-reviewer`: cavecrew para trabajo pequeño, los otros para subtareas de implementación y validación formal.
4. **caveman**: comunicación comprimida y directa en toda la sesión (respuesta primero, sin relleno, todos los datos técnicos). Solo se desactiva si el usuario dice "stop caveman" o "normal mode".
5. **simplify**: al terminar cada tarea que modifique código, y antes de cerrar el turno, ejecuta `simplify` sobre los archivos modificados para revisar reutilización, simplificación y eficiencia sin cambiar comportamiento, respetando las reglas de `.context/01-PROYECTO.md` (sin comentarios nuevos, sin dependencias nuevas).
