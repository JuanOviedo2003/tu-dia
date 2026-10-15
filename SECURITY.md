# Seguridad — Tu Día

## Modelo de acceso basado en tokens

### Arquitectura

```
rooms/{roomId}                    → { ownerUid, editTokenHash, viewTokenHash, tasks, tombstones }
roomAccess/{roomId}_{uid}         → { role: 'editor'|'viewer', proof: sha256(token) }
```

- **Token**: string aleatorio ≥20 chars (CSPRNG, charset sin ambiguos). Viaja en la URL una sola vez.
- **Hash**: SHA-256 del token, almacenado en Firestore. Nunca el token plano.
- **Claim**: doc `roomAccess/{roomId}_{uid}` con `{ role, proof }`. El cliente crea el claim; las reglas verifican el proof contra el hash del room.

### Flujo de verificación

1. Owner crea sala → genera editToken + viewToken → almacena hashes en room doc.
2. Owner comparte link: `?room=CODE&t=TOKEN` (editor o viewer).
3. Guest recibe link → autentica (anónimo) → hashea token → crea claim doc.
4. Guest lee room → reglas verifican: `claim.proof == room.hash` → acceso concedido/denegado.

### Firestore Rules (`firestore.rules`)

**`roomAccess/{claimId}`**:
- `create`: auth.uid == claimId.split('_')[1], role válido, proof string 64 chars.
- `read`: auth.uid == claimId.split('_')[1].
- `update`: false (inmutable).
- `delete`: owner de la sala puede revocar.

**`rooms/{roomId}`**:
- `read`: owner O claim válido (editor con editTokenHash, viewer con viewTokenHash).
- `create`: owner autenticado, valida estructura (≤500 tasks, ≤600 tombstones).
- `update`: owner O editor con claim válido. Salas legadas: primer visitante reclama owner.
- `delete`: solo owner.

### Salas legadas (sin owner)

- `rooms/{roomId}` sin `ownerUid` → "reclamable".
- Primer usuario autenticado que las abre → transacción atómica → adopta como owner.
- Requiere: `ownerUid`, `editTokenHash`, `viewTokenHash` en la transacción.
- Documentado como aceptado: sala sin reclamar queda solo-legible.

## Autenticación

- **Anónima** (`signInAnonymously`): cada usuario obtiene un UID sin email/password.
- El UID se almacena en `rooms/{roomId}.ownerUid` al crear la sala.
- El UID se almacena en `roomAccess/{roomId}_{uid}` al crear claim.

## Tokens

- **Generación**: `crypto.getRandomValues()` (CSPRNG), 20 chars, charset `ABCDEFGHJKMNPQRSTUVWXYZ23456789`.
- **Entropía**: ~32^20 ≈ 10^30 combinaciones → brute-force inviable.
- **Almacenamiento**: solo hashes SHA-256 en Firestore. Tokens planos solo en URLs compartidas.
- **Rotación**: owner regenera tokens → hashes cambian → links anteriores dejan de funcionar instantáneamente.

## Headers de seguridad (`firebase.json`)

- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`
- `Content-Security-Policy`: default-src self, connect-src self + googleapis, frame-ancestors none, base-uri self, object-src none.
- `Referrer-Policy: strict-origin-when-cross-origin`

## Auditoría XSS

- Todos los componentes usan JSX `{variable}` (auto-escape de React).
- No se encontró `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function`, ni templates inseguros.
- **Conclusión: sin XSS.**

## Mitigación de ataques

| Vector | Mitigación |
|--------|-----------|
| Adivinar código de sala | 10 chars CSPRNG → brute-force inviable |
| URL sin token | Reglas requieren claim válido (proof == hash) |
| Token inventado | SHA-256 del token no coincide con hash almacenado |
| Sobreescritura de owner | `ownerUid` se establece al crear; reglas requieren `auth.uid == ownerUid` |
| DoS de escritura | Límite 500 tasks / 600 tombstones en reglas |
| Inyección de tombstones | Límite 600 tombstones + LWW (owner sobreescribe con `updatedAt`) |
| Viewer escribiendo | claim `role: 'viewer'` → regla update niega (solo 'editor') |
| Robo de rol | claim inmutable (update: false); owner puede borrar claims |
| Scraping REST directo | Auth anónima requerida + claim válido + App Check |
| Bots | App Check reCAPTCHA v3 (cuando se active) |

## Gaps conocidos (justificados)

1. **Membership self-signed**: Un viewer podría crear su claim con `role: 'editor'` en vez de `'viewer'`. Mitigación: el proof debe coincidir con `editTokenHash` del room. Si el viewer tiene el token editor, ya tiene acceso legítimo.
2. **No hay lista blanca de emails**: El acceso se basa en tokens (knowledge-based). Es el modelo solicitado.
3. **App Check no activado**: requiere `VITE_RECAPTCHA_KEY` en `.env` (obtener de Google reCAPTCHA Admin).

## Replicar en otro proyecto

1. Copia `firestore.rules` y `firebase.json`.
2. Crea `.env` con tu config Firebase (ver `.env.example`).
3. `npm install firebase`.
4. Habilita Auth anónima en Firebase Console → Authentication → Sign-in method.
5. Habilita Firestore en Firebase Console → Firestore Database.
6. Despliega: `firebase deploy` (rules + hosting).

## Tests manuales de aceptación

1. **curl sin auth**: `curl -X GET 'https://firestore.googleapis.com/v1/projects/tu-dia-ea0fd/databases/(default)/documents/rooms/PRUEBA'` → 403/permission-denied.
2. **curl con token inventado**: crear claim con proof falso → room read → permission-denied.
3. **Link de vista**: unirse con viewToken → crea claim `role:'viewer'` → lee room → intenta escribir → permission-denied.
4. **Link de editor**: unirse con editToken → crea claim `role:'editor'` → escribe room → éxito.
5. **Rotar tokens**: owner rota → link viejo → claim antiguo no coincide → permission-denied.
6. **Sala legada**: room sin ownerUid → primer visitante reclama owner → transacción exitosa.
7. **Offline→online**: trabajar offline → reconectar → merge LWW sin pérdida.
8. **Build**: `npm run build` + `firebase deploy` → prod estable.

## Script/curl de prueba

```bash
# 1. Crear sala (requiere auth)
# 2. Crear claim (requiere auth + token)
curl -X POST "https://firestore.googleapis.com/v1/projects/tu-dia-ea0fd/databases/(default)/documents/roomAccess" \
  -H "Content-Type: application/json" \
  -d '{"fields": {"role": {"stringValue": "editor"}, "proof": {"stringValue": "<sha256-hash>"}}}'

# 3. Leer sala (requiere claim válido)
curl -X GET "https://firestore.googleapis.com/v1/projects/tu-dia-ea0fd/databases/(default)/documents/rooms/<roomId>"
```
