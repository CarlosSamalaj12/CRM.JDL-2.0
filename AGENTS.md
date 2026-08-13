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
- **Resuelto 2026-07-25**: default ahora es `null` con validación obligatoria en `ReservationForm.jsx:818`.

### Race condition en `push_subscriptions` (2026-07-25)
- Bug: `ER_DUP_ENTRY` en `uq_push_endpoint` cuando 2 requests `POST /api/push/subscribe` llegaban concurrentemente.
- Causa: el endpoint hacía `DELETE` + `INSERT` no atómicos.
- Fix: `INSERT ... ON DUPLICATE KEY UPDATE` en `server.cjs:5001-5030`. Ahora es atómico.

### Reporte de Ventas: `r.eventDate` con epoch 0 (2026-07-25)
- Bug: fechas salían como `01-01-70` cuando el campo `date` del evento estaba corrupto.
- Causa: el reporte usaba `financialMeta.startDate` (primera fecha de la serie) en vez del slot primario.
- Fix: usar `primaryEvent.eventDateStart` / `primaryEvent.eventDateEnd` (lo que el usuario edita en el formulario).
- Además: `formatDateShort` filtra años <= 1970 para no mostrar 01-01-70.

### MultiSelect reutilizable (2026-07-25)
- Componente: `src/modules/reports/components/MultiSelect.jsx`.
- Migrado en: `ReportsVentas`, `ReportsComisiones`, `ReportsEficenciaConfirmacion`, `ReportsEficenciaEventos`, `ReportsProyeccionMetas`, `ReportsContabilidad`, `SearchModule`, `CustomersModule`.
- SearchModule: `readSetFromSession`/`writeSetToSession` para compat con filtros legacy (`'all'` / string simple).

### Espacio en blanco arriba al imprimir informes (2026-08-12)
- Bug: ~7-10cm de espacio en blanco arriba del logo al imprimir o "Guardar como PDF" desde `InformeView`.
- Causa raíz: Chrome (especialmente con "Guardar como PDF" o impresoras físicas como Kyocera ECOSYS) **ignora `@page { margin: 0 }`** y añade un margen residual enorme arriba del contenido. Ningún `margin: 0` / `padding: 0` en los ancestros (`html`, `body`, `#root`, `.reports-root`, `.informes-shell`, `main`, `.informe-view-layout`, `.informe-print-container`) lo eliminaba — el outline verde de diagnóstico confirmó que el `.iv-documento` quedaba empujado ~7-10cm hacia abajo.
- Fix: anclar el `.iv-documento` con `position: absolute !important; top: 0; left: 0; right: 0;` en dos lugares:
  - `<style media="print">` inline en `InformeView.jsx:400-422` (controla la impresión directa).
  - `@media print` en `styles.css:4142-4162` (controla el "Exportar PDF" con html2canvas, ya que el `<style>` inline no se copia al clon).
- Padding del documento: `1cm 1.5cm` (1cm arriba/abajo, 1.5cm izq/der). Al estar `position: absolute`, ya no se duplica con el `@page` margin residual.
- También reducido: `marginMm: 10` en `handleExportPDF` (`InformeView.jsx:235`) para alinear el PDF con el padding-top del documento.
- Trampa a evitar: en `ReportsLayout.jsx:18-19` se importan `styles.scss` y `styles.css` (archivos duplicados). El CSS externo va ÚLTIMO y pisa las reglas del SCSS en caso de empate de `!important`. Cualquier ajuste de print debe replicarse en AMBOS archivos (CSS + SCSS) o la versión CSS gana.
