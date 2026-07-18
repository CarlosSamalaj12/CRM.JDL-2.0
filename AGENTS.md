# CRM-JDL — Agent Notes

## Project
CRM interno de Jardines del Lago. Stack: React 19 + Vite 8 + Express (server.cjs monolith) + MariaDB.
Frontend divided: legacy CRM (`src/modules/{calendar,customers,reports,settings}/` con ApiClient)
y módulo Informes (`src/modules/informes/` con fetch crudo + AuthContext/SocketContext/ToastContext).

## Sistema de control de versiones (instalado 2026-07-18)

Cómo forzar actualización de clientes desde el server:

**Build time:**
- `scripts/bump-sw-version.cjs` se ejecuta después de `vite build` (definido en `package.json`).
- Bump formato: `YYYY-MM-DD-NN` (NN se incrementa por build del mismo día, max 99).
- Escribe `dist/sw.js` (con VERSION actualizada) y `dist/version.json` (con `{version, minVersion, required, message, deployedAt}`).

**Backend:**
- `server.cjs` tiene `GET /api/version` que lee `dist/version.json` con cache por mtime.
- Override de versión mínima: variable de entorno `APP_MIN_VERSION="2026-07-15-01"` + `APP_UPDATE_MESSAGE="..."` antes del build.
- Si `APP_MIN_VERSION` está seteado, marca `required: true` y bloquea a clientes por debajo.

**Frontend:**
- `vite.config.js` inyecta `__APP_VERSION__` global leyendo `dist/version.json` (dev = `"0.0.0-dev"`).
- `src/services/versionService.js` — `fetchServerVersion()` + `compareVersions()` + `evaluateUpdate()`.
- `src/hooks/useVersionCheck.js` — hook con polling 3h + re-check on visibilitychange.
- `src/components/ForceUpdateModal.jsx` — modal full-screen portal al body, z-index máx, ESC bloqueado, countdown 30s auto-reload.
- `src/components/VersionFooter.jsx` — footer con `v{current} · server: v{server} · [↻]`.
- Integrados en `MainLayout` y `ReportsLayout`.

**Reload trick:** al actualizar, `useVersionCheck.reload()` hace `window.location.replace(url + '?_u=' + Date.now())` para que el SW no sirva la versión cacheada.

**Importante CORS:** `server.cjs` debe tener `Cache-Control, Pragma` en `Access-Control-Allow-Headers` (ya agregado).

## Bugs históricos resueltos

### Salón "No Usa Salon" genera conflicto (2026-07-18)
- Bug: `conflictService.js` lowercased solo el nombre del slot, no los valores del array `salonConflictDisabled`.
- Fix: helper `isNoConflictSalon()` case-insensitive en ambos lados.
- Aplicado en `findHardBlocks`, `findMaintenanceDayBlocks`, `findAllConflicts`, `evaluateRules`, `checkSameSalonOverlap`.

### Kanban agrupa eventos `evt_*` incorrectamente (2026-07-18)
- Bug: `e.Idocupacion.split('_')[0]` da `"evt"` para todos los `evt_xxx`, fusionándolos si `PaxCompartido=1`.
- Fix: regex `/_s\d+_\d{6,}$/` para obtener el groupId real, + solo agrupa si count > 1.
- **Causa raíz pendiente**: `PaxCompartido` se setea a 1 por default en creación de eventos (mal).
