# Amenazas futuras

Amenazas no aplicables hoy (app cliente estática + sync por WebSocket local
y, en el futuro, Firestore) pero relevantes si el proyecto crece con backend
propio, login o endpoints costosos.

## Inyección SQL
Consiste en: un atacante introduce sentencias SQL maliciosas a través de
entrada de usuario para manipular la base de datos.
Cuándo aplica: si algún día hay un backend SQL propio (p. ej. PostgreSQL o
MySQL) detrás de la app.
Solución: usar consultas preparadas/parametrizadas o un ORM que las genere;
nunca concatenar input de usuario en strings SQL. Hoy Firestore parametriza
de forma nativa y no expone SQL.

## Inyección de comandos
Consiste en: input de usuario llega a una llamada del sistema operativo
(ejecución de shell) en el servidor, permitiendo ejecutar comandos arbitrarios.
Cuándo aplica: si se añade lógica server-side que recibe input del usuario
(nombres de archivo, URLs, comandos, etc.).
Solución: prohibir `exec`/`system`/`child_process` con datos de usuario;
validar con listas blancas estrictas y librerías de parsing seguras.

## Fuerza bruta
Consiste en: intentos masivos automatizados de adivinar credenciales de
login.
Cuándo aplica: cuando exista un sistema de login (cuentas de usuario).
Solución: Firebase Auth ya aplica rate-limiting; sumar verificación por
email-link y 2FA para cuentas sensibles.

## Credenciales por defecto
Consiste en: paneles admin o servicios desplegados con usuarios/contra
genéricas (admin/admin) que no se cambian.
Cuándo aplica: si se añaden paneles de administración o backends con acceso
privilegiado.
Solución: cambio obligatorio de contraseña en el primer acceso y prohibición
de usuarios genéricos/compartidos.

## DoS / DDoS
Consiste en: inundación de peticiones que agotan recursos y tumban el servicio.
Cuándo aplica: si se añaden endpoints propios costosos (procesamiento, IA, etc.).
Solución: servir detrás de CDN con mitigación de ataques y WAF. Hoy el hosting
estático + infraestructura de Google absorbe el tráfico sin servidores propios.
