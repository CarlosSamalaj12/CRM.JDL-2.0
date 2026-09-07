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

### Comisiones reporta totales distintos a Ventas (2026-08-31)
- Bug: con un mismo vendedor, mismo mes y mismo filtro de status, `ReportsComisiones` daba un total mayor que `ReportsVentas` (ej. Walter Aug 2026: Ventas Q 671,094 vs Comisiones Q 674,599 → diff Q 3,505).
- Causa raíz: el `useMemo` de agregación en `ReportsComisiones.jsx:110-127` (versión vieja) aplicaba los filtros en este orden: **fecha → status → monto → userId → dedup por groupId**. Y la fecha filtrada era `ev.date` del slot iterado, no la de la serie.
  - En `ReportsVentas` el orden es inverso: **dedup primero** (usando `ev.groupId || ev.id`), después se computa `financialMeta` y se filtra por `financialMeta.startDate` (la fecha más temprana de la serie).
  - Para una reserva multi-slot que cruza la frontera del mes (ej. Jul 30 + Aug 5), Comisiones contaba el slot de agosto (pasa filtro) y descartaba el de julio, pero Ventas "reclamaba" la reserva desde el primer slot y usaba `startDate = Jul 30` para filtrar → reserva entera excluida del mes de agosto. Comisiones quedaba inflado por exactamente esos Q 3,505.
- Fix: reordenar el loop de `ReportsComisiones.jsx:114-138` para que haga **dedup primero, después filtros**, igual que Ventas. Usar `getEventSeriesFinancialMeta(ev, events)` para resolver el `primaryEvent` de la serie y leer `primaryEvent.userId` / `primaryEvent.status` / `primaryEvent.quote.total` (con fallback a `ev.*` por si el primary no tiene quote propio).
- Patrón canónico: TODOS los reportes del sistema que suman ventas por vendedor (`ReportsDashboard`, `ReportsInstitucion`, `ReportsProyeccionMetas`, `ReportsSeguimientosPendientes`, `CustomersModule`, `ReportsVentas`) usan el orden **dedup → filtro por fecha de la serie**. Si agregás un reporte nuevo, copialo de `ReportsVentas` y no del Comisiones viejo.
- Trampa a evitar: si en el futuro querés que la comisión reconozca a cualquier vendedor que tocó un slot (no solo al primario), NO lo metas dentro del mismo loop — agregá un flag explícito (ej. `multiVendorCredit: true`) y un code path separado. No pises el patrón canónico.

### Reporte por Institución: `companyId` clonado y encargado falso inflan ventas (2026-09-05)
- Bug: en `ReportsInstitucion`, eventos completamente distintos (bodas, cumpleaños, talleres de ONG, sesiones de fotos) salían con el mismo encargado (`"Lucía Merida"`) y se agrupaban bajo una misma empresa (`"INCAP"` o `"Venta de habitaciones"`), elevando artificialmente sus ventas a Q 735k+ y posicionándola falsamente como "Empresa Top".
- Causa raíz:
  1. Al clonar o duplicar eventos para generar nuevas cotizaciones, **242 eventos** en la base de datos heredaron el campo `"companyId": 10` (INCAP) o `"companyId": 1000`, a pesar de que el usuario había escrito un `quote.companyName` real (`"UNAMG"`, `"BODA ASTURIAS"`, `"CONALFA"`, etc.) y su propio `quote.managerName`.
  2. El código anterior priorizaba `quote.companyId` ciegamente: al encontrar `id: 10`, descartaba el `quote.companyName` real y asignaba el token `id:10`. Además, como `quote.managerId` no coincidía con los encargados de INCAP, recurría a `matchedCompany.managers[0]` (`"Lucía Merida"`), sobreescribiendo el encargado real del evento.
- Fix:
  - Función `resolveEventCompany`: si existe `quote.companyName` escrito, valida si `candidateCompany.name` coincide mediante `isMatchingCompanyName`. Si no coincide (plantilla clonada), descarta el `companyId` huérfano y busca por nombre en el catálogo o crea un token propio `name:...`.
  - Función `resolveEventContact`: siempre prioriza `quote.managerName` / `quote.contact` del evento. NUNCA asigna por defecto el encargado principal de una empresa del catálogo si el evento ya especifica a su propio contacto o si la empresa fue un falso match.

### Importación de Encargados / Empresas: `Se requiere un array` por hojas múltiples o encabezados alternativos (2026-09-05)
- Bug: al intentar importar encargados desde `SettingsImport`, salía `Error importando: ApiError: Se requiere un array de encargados` con HTTP 400.
- Causa raíz:
  1. Si se importaba un archivo Excel exportado desde `SettingsExport` o con múltiples hojas, `workbook.SheetNames[0]` leía la hoja de "Diccionario de columnas" en vez de la hoja con los datos.
  2. `validateManagerRows` y `validateCompanyRows` devolvían `valid: true` cuando `validCount === 0` (todas las filas se tomaban erróneamente como vacías si los encabezados diferían, ej. `id_empresa` vs `empresa_id` o `nombre` vs `nombre_encargado`). Al confirmar, `buildManagerPayload` devolvía un array vacío `[]`, enviando `{ managers: [] }` al endpoint `/api/import/managers`, que rechaza arrays vacíos con 400.
- Fix:
  - `SettingsImport.jsx`: detector inteligente de hoja con datos (omite hojas de solo diccionario) y bloqueo de confirmación si `validCount === 0`.
  - `settingsDataUtils.js`: helpers `getManagerRowFields` y `getCompanyRowFields` que mapean sinónimos de encabezados (`id_empresa`, `empresa`, `nombre`, `contacto`, etc.) y resuelven nombres de empresa a IDs si el usuario ingresó el nombre. Validación estricta que exige `validCount > 0`.

### Carrito Operativo: servicios no visibles por colapso de flexbox (2026-09-07)
- Bug: en `QuoteModal`, el "Carrito Operativo" no mostraba los servicios correctamente al cotizar eventos multidiario; solo salía el primer ítem de cada fecha (o ninguno en días con pocos ítems), a pesar de que el subtotal y el contador reflejaban todos los ítems agregados.
- Causa raíz:
  1. El contenedor `.qp-cart-items-scroll` usaba `display: flex; flex-direction: column` con una altura máxima acotada (`max-height: min(620px, calc(100vh - 340px))`).
  2. Las tarjetas hijas por fecha tenían `overflow: hidden` y carecían de `flex-shrink: 0` (por defecto `flex-shrink: 1`). En la especificación CSS Flexbox, un elemento hijo con `overflow: hidden` tiene `min-height: 0`. Al sobrepasar la altura del contenedor, Flexbox encogía agresivamente todas las tarjetas para que cupieran en los ~500-600px en vez de desbordar y activar el scroll vertical.
  3. Al encogerse, el contenido de la tabla quedaba recortado por el `overflow: hidden` de la tarjeta (mostrando únicamente el encabezado o una sola fila).
- Fix:
  - `.qp-cart-items-scroll > *`: asignado `flex-shrink: 0 !important` y `flexShrink: 0` inline en las tarjetas por fecha y estados vacíos.
  - Generación de `rowId` garantizada al cargar `items` iniciales desde el backend.
  - Fallback de fecha automático para ítems huérfanos sin fecha asignada, previniendo que queden excluidos del render.

### Carrito Operativo: botones de acción de selección reubicados a la barra superior (2026-09-07)
- Requerimiento: los botones de "Duplicar selección", "Subir" y "Bajar" se encontraban dentro del header de la tarjeta del Carrito Operativo (`.qp-cart-sticky-header`), por lo que al hacer scroll dentro del modal o la lista de servicios quedaban ocultos fuera de la vista y competían por espacio con los títulos.
- Solución:
  - Reubicados al header superior fijo del modal (`.qp-header-controls`), situados a la par del selector de `Versión`.
  - Al estar en `.qp-header`, permanecen 100% visibles y accesibles en todo momento sin importar cuánto scroll se haga dentro del modal o de las fechas del carrito.
  - Se añadió contador de ítems seleccionados (`N sel.`) y botón rápido `✕ Limpiar` cuando hay filas seleccionadas.
  - Los botones se activan/desactivan dinámicamente según si hay ítems seleccionados.
  - En la tarjeta del carrito operativo se mantuvo un indicador visual limpio de cuántos ítems están seleccionados con opción para deseleccionar.
  - Soporte responsivo móvil (`grid-column: 1 / -1`) para asegurar que en pantallas pequeñas los botones se expandan uniformemente sin desbordar.




