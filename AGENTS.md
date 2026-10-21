# CRM-JDL — Agent Notes

## Project
CRM interno de Jardines del Lago. Stack: React 19 + Vite 8 + Express (server.cjs monolith) + MariaDB.
Frontend divided: legacy CRM (`src/modules/{calendar,customers,reports,settings}/` con ApiClient)
y módulo Informes (`src/modules/informes/` con fetch crudo + AuthContext/SocketContext/ToastContext).

## Sistema de control de versiones y cierre de sesión automático (actualizado 2026-09-11)

Cómo forzar actualización de clientes y cierre de sesión limpio desde cada build:

**Build time:**
- `scripts/bump-sw-version.cjs` se ejecuta antes de `vite build` (definido en `package.json`).
- Incrementa automáticamente la versión semántica (ej. `2.1.68` → `2.1.69`).
- Escribe `dist/sw.js` (con VERSION actualizada), `dist/version.json` y `public/version.json` con `{ version, minVersion, required: true, forceLogout: true, message, deployedAt }`.

**Backend:**
- `server.cjs` tiene `GET /api/version` que lee `dist/version.json` con cache por mtime.
- Un watcher periódico (cada 15s) detecta cuando `dist/version.json` cambia de versión y emite inmediatamente `io.emit('system:force-logout', { version, forceLogout: true, message })` para notificar a todos los navegadores conectados en tiempo real.

**Frontend:**
- `vite.config.js` inyecta `__APP_VERSION__` global leyendo `dist/version.json` (dev = `"0.0.0-dev"`).
- `src/services/versionService.js`:
  - `forcePurgeAndLogout(targetVersion)`: purga `localStorage.removeItem('user')`, `localStorage.removeItem('token')`, `sessionStorage.clear()`, elimina todas las cachés (`caches.delete`) y desregistra los Service Workers. Luego redirige a `/login?update=1&v={version}&_u={timestamp}`.
- `src/App.jsx`:
  - Arranque en frío: si `CURRENT_VERSION !== '0.0.0-dev'` y `localStorage.getItem('crm_installed_version') !== CURRENT_VERSION`, purga de inmediato la sesión y cachés antes de cargar rutas protegidas.
- `src/components/ForceUpdateModal.jsx` y `src/components/UpdateBanner.jsx`:
  - Si un usuario tiene la app abierta durante el build, se muestra un modal prioritario con cuenta regresiva de 20s y botón "Cerrar sesión y actualizar ahora". Al llegar a 0s o hacer clic, purga todo y redirige a `/login`.
- `src/modules/auth/Login.jsx`:
  - Si recibe `?update=1`, muestra un banner elegante informando que el sistema se actualizó y se cerró la sesión para cargar los cambios limpiamente. Evita rebotes si había sesión residual.
- `src/main.jsx`:
  - Si el Service Worker cambia de controlador (`controllerchange`) en producción, ejecuta `forcePurgeAndLogout(CURRENT_VERSION)`.

## Bugs históricos resueltos
### Solución: Impresión Autónoma Client-Side mediante Blob URL, Incrustación de Encabezado Data URL y Blindaje contra CSP de Servidor Remoto (`printUtils.js`, `server.cjs`, `tests/security-audit-remediations.test.mjs`) (2026-10-21)
- Requerimiento del usuario:
  - Al abrir la vista previa de la cotización, los botones "🖨️ Imprimir / Guardar como PDF" y "✕ Cerrar" seguían sin responder y la consola arrojaba:
    - `Loading the image 'http://localhost:5173/templates/Encabezadojdl.png' violates the following Content Security Policy directive: "img-src data: https:". The action has been blocked.`
    - `Executing inline script violates the following Content Security Policy directive 'default-src 'none''. Note also that 'script-src' was not explicitly set, so 'default-src' is used as a fallback. The action has been blocked.`
    - `Executing inline event handler violates the following Content Security Policy directive 'default-src 'none''.`
- Causa raíz:
  - En `.env`, `VITE_API_URL=https://www.appjardinesdellago.tech`.
  - En `src/utils/printUtils.js`, `generateQuotePrintDocument` enviaba el HTML compilado a `${apiBase}/api/print/prepare` y navegaba la pestaña a `https://www.appjardinesdellago.tech/api/print/render/:id`.
  - Dado que el servidor remoto de producción (`appjardinesdellago.tech`) ejecutaba una compilación previa (`2.0.57`) sin la actualización local de CSP de `server.cjs`, el servidor remoto respondía con el CSP antiguo estricto (`default-src 'none'`), bloqueando completamente cualquier ejecución de JavaScript (`window.print()`, `window.close()`, event listeners) y bloqueando la carga de imágenes `http://` del entorno local.
  - Además, transferir cientos de kilobytes de HTML al backend para una caché temporal en memoria de 5 minutos generaba latencia innecesaria y dependencia frágil del backend remoto.
- Solución:
  1. En `src/utils/printUtils.js`:
     - Se convirtió la generación de impresión a un flujo 100% autónomo del lado del cliente utilizando `Blob URL` (`URL.createObjectURL(new Blob([finalHtml], { type: 'text/html;charset=utf-8' }))`).
     - Al servirse como Blob URL con el mismo origen de la app, el documento no hereda las cabeceras CSP restrictivas del servidor remoto, permitiendo la ejecución inmediata y sin restricciones de los manejadores `window.print()`, `window.close()` y la auto-apertura asistida.
     - Se implementó la pre-conversión automática de la imagen de encabezado institucional (`docHeaderImage`) a Data URL base64 (`reader.readAsDataURL(imgBlob)`), garantizando carga instantánea a 0 ms sin peticiones de red ni bloqueos de protocolo (`http:` vs `https:`).
     - Se añadió `<base href="...">` en el `<head>` del documento HTML para resolución segura de recursos relativos.
     - Se preservó un fallback secundario a `/api/print/prepare` para entornos sin soporte de Blob URL.
  2. En `tests/security-audit-remediations.test.mjs`:
     - Se incorporaron aserciones unitarias validando la presencia de `URL.createObjectURL(blob)`, `reader.readAsDataURL` y `<base href=` en `printUtils.js`.
- Validación: 182 pruebas unitarias aprobadas (`node --test tests/*.test.mjs`) y build de producción exitoso (versión `2.1.238`).

### Solución: Corrección del Botón Imprimir en Vista Previa de Cotizaciones y Adición de Sticky Toolbar con Auto-Apertura (`server.cjs`, `printUtils.js`, `tests/security-audit-remediations.test.mjs`) (2026-10-21)
- Requerimiento del usuario:
  - Al generar la cotización, el botón "Imprimir" ubicado al pie del documento no funcionaba al presionarlo (no abría la ventana de impresión ni el cuadro de diálogo del navegador).
- Causa raíz:
  - En `server.cjs`, el endpoint `GET /api/print/render/:id` emitía una cabecera `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline' https:; img-src data: https:; font-src https: data:;`.
  - Al carecer de la directiva `script-src` y tener `default-src 'none'`, el navegador bloqueaba estrictamente cualquier script o manejador en línea (`onclick="window.print()"`), ignorando el clic del usuario.
  - Además, para documentos extensos con contratos y cláusulas, el usuario debía desplazarse hasta el final para encontrar el botón.
- Solución:
  1. En `server.cjs`:
     - Se actualizó la cabecera CSP en `/api/print/render/:id` para incluir `script-src 'unsafe-inline';`, permitiendo la ejecución de `window.print()` y scripts de interfaz autorizados manteniendo el bloqueo de orígenes no permitidos (`default-src 'none'`).
  2. En `src/utils/printUtils.js`:
     - Se diseñó e implementó una barra superior fija institucional (`.print-toolbar-sticky`) visible en todo momento durante el scroll, con identificación de cotización, botón institucional **"🖨️ Imprimir / Guardar como PDF"** (`#btnPrintTop`) y botón de **"✕ Cerrar"** (`#btnCloseTop`).
     - Se actualizó el botón inferior `#btnPrintBottom` en `.actions`.
     - Se incorporó un bloque `<script>` que asocia los manejadores `addEventListener` a los botones y dispara la auto-apertura asistida de `window.print()` tras 500 ms de completarse la carga de imágenes y estilos.
     - Se configuró la regla `@media print { .print-toolbar-sticky, .actions { display: none !important; } }` para asegurar que ningún botón de acción aparezca en el PDF ni en la hoja impresa.
  3. En `tests/security-audit-remediations.test.mjs`:
     - Se actualizaron las pruebas unitarias para validar que el CSP permite `script-src 'unsafe-inline'`, que se incluye la barra sticky y que se ocultan los controles en `@media print`.
- Validación: 182 pruebas unitarias aprobadas (`node --test tests/*.test.mjs`) y build de producción exitoso (versión `2.1.237`).

### Solución: Sustitución de Período Fiscal por Rango de Fechas (Fecha Inicial y Fecha Final) con Validación Interactiva y Auto-Ajuste en Reporte de Ventas de Habitaciones (`ReportsVentasHabitaciones.jsx`, `reports.css`, `tests/reports-ventas-habitaciones.test.mjs`) (2026-10-21)
- Requerimiento del usuario:
  - En el apartado de reporte de ventas de habitaciones, reemplazar el filtro estático/rígido de "Período Fiscal" por la opción de escoger libremente en qué rango de fechas buscar.
  - Implementar validaciones para que la fecha inicial no sea inconsistente respecto a la fecha final.
- Causa raíz:
  - El filtro utilizaba un input nativo `<input type="month">` transparente superpuesto que no permitía una selección flexible de fechas arbitrarias ni selecciones multi-mes/días exactos.
  - El backend ya disponía de soporte para `desde` y `hasta`, pero el módulo de frontend enviaba exclusivamente el parámetro `mes`.
- Solución:
  1. En `src/modules/reports/ReportsVentasHabitaciones.jsx`:
     - Se reemplazó el estado de `mes` por `fechaInicio` y `fechaFin`, inicializados por defecto en el primer y último día del mes en curso.
     - Se implementaron los manejadores `handleFechaInicioChange` y `handleFechaFinChange` con validación interactiva y auto-ajuste:
       - Si la fecha inicial seleccionada es mayor a la final, la final se auto-ajusta a dicha fecha inicial.
       - Si la fecha final seleccionada es menor a la inicial, la inicial se auto-ajusta a dicha fecha final.
       - Restricción visual de selección mediante `max={fechaFin}` y `min={fechaInicio}`.
     - Se conectaron los parámetros `desde: fechaInicio` y `hasta: fechaFin` a `getHabitacionesApi`.
     - Se actualizó la exportación institucional a Excel para reflejar el rango seleccionado tanto en los metadatos de la hoja como en el nombre de archivo descargado (`Reporte_Ventas_Habitaciones_${fechaInicio}_al_${fechaFin}.xlsx`).
  2. En `src/modules/reports/reports.css`:
     - Se reconfiguró `.rhab-filters-card` con `grid-template-columns: repeat(5, minmax(0, 1fr))` para albergar simétricamente Fecha Inicial, Fecha Final, Vendedor, Tipo de Habitación y Búsqueda Rápida.
     - Se crearon las reglas blindadas con especificidad `body:not(.informes-theme) input[type="date"].rhab-date-input` con acabado Bento, altura de 40px y foco temático verde esmeralda.
  3. En `tests/reports-ventas-habitaciones.test.mjs`:
     - Se actualizaron las pruebas unitarias y se incorporó un test específico validando las restricciones `min`/`max`, los manejadores de auto-ajuste y la inicialización de fechas.
- Validación: 182 pruebas unitarias aprobadas (`node --test tests/*.test.mjs`) y build de producción exitoso (versión `2.1.236`).

### Solución: Aislamiento Estricto de Vistas Activas y Eliminadas, Erradicación de Fuga de Eventos Eliminados y Keys Unívocas (`posiblesVentasController.js`, `PosiblesVentasModule.jsx`, `tests/posibles-ventas-filter-freeze.test.mjs`) (2026-10-20)
- Requerimiento del usuario:
  - Al filtrar por `Ganada`, la vista se quedaba estancada y aparecía incorrectamente en la lista un evento eliminado y marcado como perdido (`Prueba 2 sistemas • 🗑 Eliminada • Perdida` con botón `↩ Restaurar`).
- Causa raíz:
  1. En `src/modules/posiblesVentas/PosiblesVentasModule.jsx`:
     - El contenedor de la lista en `.pv-leads-scroll-container` alternaba condicionalmente entre un Fragment (`<> <div style={...}> ... </div> <div style={footer}> ... </div> </>`) para `vista === 'activas'` y un `<div>` (`<div style={{ display: 'flex', ... }}>`) para `vista === 'eliminadas'`.
     - Ninguno de los dos contenedores poseía atributo `key`. Al alternar entre `Eliminadas` y los filtros de estado activos (`Ganada`, `Pendiente`, etc.), el reconciliador de React 19 reutilizaba el mismo elemento DOM `div`, reconciliando los componentes funcionales `<DeletedLeadCard key={lead.id}>` con los elementos host `<div key={lead.id}>`.
     - Esto dejaba nodos DOM huérfanos de tarjetas eliminadas (como `Prueba 2 sistemas`) en la vista activa y provocaba colisiones de claves en React (`Encountered two children with the same key`), congelando la actualización de los filtros.
     - Además, los clics en las tarjetas KPI (`MetricCardClean`) ejecutaban `setEstadoFilter(...)` sin invocar `setVista('activas')`, dejando `vista` desincronizada si el usuario venía de la pestaña de eliminadas.
  2. En `backend/src/controllers/posiblesVentasController.js`:
     - `LINKED_EVENT_JOIN` permitía coincidencia simultánea si un evento poseía id exacto y slots (`e_direct.id = pv.evento_id OR e_direct.id = SUBSTRING_INDEX(...)`). Se blindó con subconsulta guardiana `AND NOT EXISTS` para garantizar una única fila estricta por lead.
- Solución:
  1. En `src/modules/posiblesVentas/PosiblesVentasModule.jsx`:
     - Se reemplazó el Fragment unkeyed por contenedores con `key`s únicas y explícitas (`key={`pv-view-activas-${estadoFilter}-${vendedorFilter}-${salonFilter}-${currentPage}`}` y `key="pv-view-eliminadas"`), forzando a React a desmontar y montar limpiamente el árbol DOM al conmutar vistas.
     - Se prefijaron las claves de las tarjetas para garantizar unicidad absoluta: `key={`pv-active-lead-${lead.id}`}` para activas y `key={`pv-deleted-lead-${lead.id}`}` para eliminadas.
     - Se forzó `setVista('activas')` en todos los manejadores de clic de las tarjetas KPI (`MetricCardClean`).
     - Se añadió exclusión defensiva `!item.deletedAt` tanto en `loadLeads` como en `filteredLeads`.
  2. En `backend/src/controllers/posiblesVentasController.js`:
     - Se aplicó subconsulta defensiva `AND NOT EXISTS (SELECT 1 FROM eventos e_sub WHERE e_sub.id = pv.evento_id)` en `LINKED_EVENT_JOIN` y `syncAllEstados`.
  3. En `tests/posibles-ventas-filter-freeze.test.mjs`:
     - Se incorporaron pruebas unitarias validando la exclusión de `deletedAt`, la presencia de keys de vista unívocas y los prefijos de tarjetas.
- Validación: 181 pruebas unitarias aprobadas (`node --test tests/*.test.mjs`), build de producción exitoso (versión `2.1.233`) y verificación funcional en navegador confirmando aislamiento total de vistas, desaparición inmediata de la tarjeta eliminada en `Ganada` y alternancia de filtros sin congelamiento.

### Solución: Corrección de Congelamiento de Filtros por Duplicación de Filas y Eliminación del Botón Sincronizar en Eventos Asignados (`posiblesVentasController.js`, `PosiblesVentasModule.jsx`, `tests/posibles-ventas-filter-freeze.test.mjs`) (2026-10-20)
- Requerimientos del usuario:
  - Al alternar entre los filtros de estado (Pendiente → En proceso → Ganada → Perdida → Pendiente), la vista se congelaba o quedaba estancada, desincronizando la pestaña activa con los registros mostrados y forzando a recargar la página.
  - El botón "Sincronizar" en la cabecera superior era innecesario, ya que el sistema actualiza en tiempo real vía WebSockets.
- Causa raíz:
  1. En `backend/src/controllers/posiblesVentasController.js`: `LINKED_EVENT_JOIN` realizaba `LEFT JOIN eventos e_direct ON ... OR e_direct.id_grupo = pv.evento_id ...`. En reservas de eventos multi-día o multi-slot (por ejemplo, el evento `evt_f23b5f8a` con 7 slots con el mismo `id_grupo`), la consulta multiplicaba las filas (el lead 58 se repetía 7 veces, el lead 32 dos veces, etc., inflando el total de prospectos de 83 reales a 91).
  2. En `src/modules/posiblesVentas/PosiblesVentasModule.jsx`:
     - Al renderizar `<div key={lead.id}>`, los IDs duplicados producían colisiones de claves en React (`Encountered two children with the same key`), corrompiendo el árbol fiber del reconciliador al conmutar entre filtros y provocando que el renderizado de la lista quedara atascado.
     - La paginación conservaba un `currentPage` fuera de rango durante el cambio de pestaña antes de que el efecto reactivo lo corrigiera.
- Solución:
  1. En `backend/src/controllers/posiblesVentasController.js`:
     - Se limpió `LINKED_EVENT_JOIN` para unir exclusivamente por el ID primario del evento o baseId (`e_direct.id = pv.evento_id OR e_direct.id = SUBSTRING_INDEX(pv.evento_id, '_s', 1)`), erradicando las uniones por `id_grupo` que duplicaban filas. La consulta ahora devuelve exactamente los 83 prospectos únicos.
  2. En `src/modules/posiblesVentas/PosiblesVentasModule.jsx`:
     - Se eliminó por completo el botón manual "Sincronizar" de la barra superior, confiando plenamente en la sincronización reactiva por WebSockets (`entity:changed`).
     - Se añadió deduplicación defensiva en `loadLeads` utilizando un `Map` por ID.
     - Se implementó acotación segura de página (`safePage = Math.min(Math.max(1, currentPage), totalPages)`) en `paginatedLeads`.
     - Se forzó el reinicio síncrono a página 1 (`setCurrentPage(1)`) en los manejadores de clic de todas las pestañas y tarjetas KPI.
  3. En `tests/posibles-ventas-filter-freeze.test.mjs`:
     - Pruebas unitarias automatizadas validando la no duplicación en el controlador, la ausencia del botón Sincronizar, la deduplicación defensiva y la sincronización de página.
- Validación: 181 pruebas unitarias aprobadas (`node --test tests/*.test.mjs`), build de producción exitoso (versión `2.1.232`) y verificación funcional en navegador sin advertencias de React ni bloqueos.

### Solución: Integración de Habitaciones Individuales en Comisiones por Vendedor y Conmutador Segmentado de Equipos (Vendedores vs Recepcionistas) (`ReportsComisiones.jsx`, `reports.css`, `tests/reports-comisiones-groups.test.mjs`) (2026-10-20)
- Requerimiento del usuario:
  - En el reporte "Desglose de ventas y comisiones por vendedor", permitir que la venta individual de habitaciones ingresadas desde el módulo de Habitaciones (`habitacion_reservas`) sume a las ventas y comisiones de los colaboradores correspondientes.
  - Las habitaciones que formen parte de cotizaciones de eventos se mantienen intactas dentro del cálculo de eventos como hasta ahora, sin alterarlas ni mezclarlas.
  - Ofrecer una diferenciación clara entre dos grupos de trabajo (Vendedores y Recepcionistas) mediante un control/filtro para visualizar las comisiones por equipo o de forma global.
- Solución:
  1. En `src/modules/reports/ReportsComisiones.jsx`:
     - Se incorporó la consulta de `habitacion_reservas` (`getHabitacionesApi`) y `equipos_trabajo` (`getEquipos`).
     - Se respetó la lógica existente de eventos y cotizaciones: las habitaciones empaquetadas en cotizaciones de eventos se procesan fielmente como parte de `events`.
     - Para las reservas de hotel independientes (`habitacion_reservas`), se filtran por fecha de check-in dentro del rango temporal seleccionado y por estados válidos de liquidación (`Confirmada`, `En Casa`, `Completada`).
     - Se acumulan los montos de habitaciones por `id_vendedor`, sumándose de manera transparente al `salesAmount` total de cada colaborador para el cálculo de su escala de comisiones.
     - En la tabla de comisiones, la columna de ventas totales muestra el monto consolidado y, si el vendedor registra ventas de habitaciones, despliega debajo un desglose discreto en texto mate (`Eventos: Q ... · Hab: Q ...`).
     - Se implementó un control segmentado en el toolbar: `[Todos]`, `[Vendedores]` y `[Recepcionistas]`, sincronizado reactivamente con el dropdown `MultiSelect` de colaboradores, las tarjetas de KPI, el gráfico comparativo, la tabla detallada y las exportaciones a PDF y Excel.
     - Solo se muestran colaboradores con escalas de comisiones configuradas (`goalTiers.length > 0`), manteniendo el reporte limpio y libre de usuarios inactivos o sin metas.
  2. En `src/modules/reports/reports.css`:
     - Se crearon las clases `.comisiones-segmented-container`, `.comisiones-segmented-btn` y sus variantes activas con paletas mate sobrias (Azul para Todos, Verde Esmeralda para Vendedores y Violeta para Recepción).
  3. En `tests/reports-comisiones-groups.test.mjs`:
     - Pruebas unitarias automatizadas verificando la integración de la API de habitaciones, el filtro de estados, el cálculo de ventas consolidado y la presencia del conmutador segmentado.
- Validación: 179 pruebas unitarias aprobadas (`node --test tests/*.test.mjs`) y build de producción exitoso (versión `2.1.228`).

### Solución: Auto-Migración de Propinas, Blindaje Defensivo en updateEventQuote y Desacoplamiento de Guardado de Cotizaciones contra Falsos Conflictos 409 (`server.cjs`, `eventsController.js`, `eventService.js`, `quote-save-conflict-guard.test.mjs`) (2026-10-14)
- Requerimiento del usuario:
  - Al editar una cotización y agregar o modificar únicamente el "No. Folio" en Datos de Empresa (sin alterar fechas ni salones), el sistema arrojaba el error: `HTTP 409 Conflict: "La modificación desvincula fechas o salones con informes de evento activos"`, impidiendo guardar la cotización.
- Causa raíz:
  1. En `server.cjs`: la migración `QuoteVersion` ya estaba registrada en la tabla `migration_log` de producción. Cuando posteriormente se incorporaron las columnas de propina (`propina_tipo`, `propina_valor`, `propina_monto`) dentro de `ensureQuoteVersionStructure`, el servidor omitía su ejecución al arrancar (`applied.has(m.name)`), dejando la tabla `cotizaciones_evento` y `cotizacion_versiones_evento` en producción sin esas columnas.
  2. En `backend/src/controllers/eventsController.js` (`updateEventQuote`): al guardar la cotización vía `PUT /api/events/:id/quote`, MariaDB arrojaba `HTTP 500: Unknown column 'propina_tipo' in 'INSERT INTO'`.
  3. En `src/services/eventService.js` (`saveQuote`): al fallar el endpoint atómico, el bloque `catch` invocaba un fallback tradicional a `this.update(rawId, { quote, status })` (`PUT /api/events/:id`).
  4. En `updateEvent`: al recibir una actualización sin la lista explícita de slots del evento, el validador antidesfase comparaba los slots contra los informes existentes del evento (los cuales, en eventos históricos o modificados previamente, podían tener días en fechas no alineadas con la reserva actual), rechazando con `HTTP 409 Conflict`.
- Solución:
  1. En `server.cjs`:
     - Creada la migración canónica dedicada `ensureQuotePropinasStructure` y registrada en `MIGRATIONS` y `CANONICAL_MIGRATIONS` para forzar la creación inmediata de las columnas `propina_tipo`, `propina_valor` y `propina_monto` tanto en `cotizaciones_evento` como en `cotizacion_versiones_evento`.
  2. En `backend/src/controllers/eventsController.js`:
     - En `updateEventQuote`: implementada auto-recuperación ante `ER_BAD_FIELD_ERROR` de propinas con ejecución inmediata de `ALTER TABLE` y reintento atómico sin fallar la petición.
     - En `updateEvent`: incorporada la bandera `isQuoteOnly`, omitiendo el chequeo de conflicto de informes cuando solo se actualiza la cotización sin modificar salones ni fechas.
  3. En `src/services/eventService.js`:
     - En `saveQuote`: añadido `isQuoteOnly: true` en el fallback de actualización para garantizar que jamás detone un falso conflicto 409 de salones.
  4. En `tests/quote-save-conflict-guard.test.mjs`:
     - Agregadas pruebas unitarias validando la existencia de la migración `QuotePropinasStructure`, la bandera `isQuoteOnly` y la auto-recuperación defensiva.
- Validación: 177 pruebas unitarias aprobadas (`node --test tests/*.test.mjs`) y build de producción exitoso (versión `2.1.226`).

### Solución: Diseño Adaptativo (Adaptive Design) en Editar Reserva y Erradicación de Doble Barra de Scroll (`reservationBento.css`, `tests/reservation-bento-redesign.test.mjs`) (2026-10-14)
- Requerimientos del usuario:
  - Al reducir el tamaño de la ventana en escritorio o en pantallas laptop, los controles de la tarjeta "Salones y Horarios" se cortaban.
  - Luego de habilitar scroll horizontal, aparecían dos barras de desplazamiento horizontales superpuestas ("salen dos barras desplazarse no se ve bien").
- Causa raíz:
  - `.res-bento-table-rows` tenía `overflow-y: auto;` junto a `overflow-x: visible;`. En la especificación W3C de CSS, `visible` combinado con `auto` en el otro eje se convierte forzosamente en `auto`, provocando que el contenedor de filas generara una primera barra de scroll horizontal mientras el contenedor exterior `.res-bento-table-wrap` generaba una segunda barra de scroll.
  - El ancho mínimo rígido de 850px forzaba scroll en resoluciones de laptop (1280px-1366px) donde los controles caben cómodamente si se optimizan las columnas.
- Solución:
  1. En `src/modules/calendar/components/reservationBento.css`:
     - Se fijó `overflow-x: hidden !important; overflow-y: auto !important;` en `.res-bento-table-rows`, erradicando por completo la barra de scroll duplicada.
     - Se unificó el desplazamiento horizontal exclusivamente en `.res-bento-table-wrap` (`overflow-x: auto !important; overflow-y: hidden !important;`) con barra fina y estilizada de 6px.
     - Se optimizaron las columnas de la tabla a proporciones compactas ejecutivas (`28px minmax(110px, 1.3fr) 50px minmax(230px, 1.8fr) minmax(160px, 1.2fr) minmax(125px, 1fr) 28px`), reduciendo el `min-width` a 760px.
     - Se ajustó `.res-bento-grid` a `minmax(0, 2.3fr) minmax(310px, 1fr)`, otorgando mayor amplitud a la columna izquierda para que en laptops quepa todo sin necesidad de mostrar barra de desplazamiento.
     - Se mantuvo el breakpoint `@media (max-width: 1260px)` para conmutar a 1 columna fluida con cuadrícula 2x2 en la columna lateral en pantallas reducidas.
  2. En `tests/reservation-bento-redesign.test.mjs`:
     - Se añadieron aserciones comprobando `overflow-x: hidden !important` en `.res-bento-table-rows`, `min-width: 760px` y `overflow-x: auto !important` en `.res-bento-table-wrap`.
- Validación: 175 pruebas unitarias aprobadas (`node --test tests/*.test.mjs`) y build de producción exitoso (versión `2.1.29`).

### Solución: Atenuación de Colores Chillantes por Paleta Ejecutiva Mate en Búsqueda de Eventos y Editar Reserva (`SearchModule.jsx`, `search.css`, `ReservationForm.jsx`, `tests/search-datagrid.test.mjs`) (2026-10-14)
- Requerimientos del usuario:
  1. En la tabla de "Búsqueda de Eventos", el encabezado azul brillante (`#2563eb`) y el botón `+ Nueva Cotización` resultaban demasiado chillantes / saturados. Solicita un tono más opaco / mate.
  2. En el modal "Editar Reserva", los chevrons de las 5 etapas comerciales tenían colores neón hiper-saturados (`#00A3FF`, `#FF8C00`, `#FF00CC`, `#00CC66`), cansando la vista. Solicita atenuarlos a tonos más opacos.
- Solución:
  1. En `src/modules/search/SearchModule.jsx` y `src/modules/search/search.css`:
     - Se reemplazó el azul eléctrico `#2563eb` en `.datagrid-table thead`, `tr` y `th.datagrid-th` por **Azul Marino Ejecutivo Mate** (`#1e3a8a`), sobrio, elegante y con contraste nítido (WCAG AAA).
     - Se actualizó `.search-btn-new-quote` y `.search-brand-icon` a gradiente mate `linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%)` con sombra suave ejecutiva `rgba(30, 58, 138, 0.22)`.
  2. En `src/modules/calendar/components/ReservationForm.jsx`:
     - Se integró `PIPELINE_MATTE_COLORS` y la función auxiliar `getBentoStatusColor(statusKey)` para aplicar colores desaturados y mate en los chevrons del Stepper y en la pastilla superior:
       - Contacto (`Reserva sin Cotizacion`): `#0284c7` (Azul pizarra mate en lugar de azul celeste neón `#00A3FF`).
       - Cotizado (`1er Cotizacion`): `#007A64` (Verde esmeralda institucional sobrio).
       - Seguimiento (`Seguimiento`): `#d97706` (Ámbar cálido mate en lugar de naranja neón `#FF8C00`).
       - Pre-Reserva (`Pre reserva`): `#7c3aed` (Ciruela / violeta ejecutivo en lugar de fucsia neón `#FF00CC`).
       - Confirmado (`Confirmado`): `#16a34a` (Verde bosque sobrio en lugar de verde lima chillante `#00CC66`).
     - Se mantuvieron intactos los valores en `constants.js` (`STATUS_META`) preservando la compatibilidad global del CRM y suites de pruebas existentes.
  3. En `tests/search-datagrid.test.mjs`:
     - Se actualizaron las aserciones para validar el azul marino `#1e3a8a`.
- Validación: 174 pruebas unitarias aprobadas (`node --test tests/*.test.mjs`) y build de producción exitoso.

### Solución: Filtros de Columna Flotantes con React Portal Encima de la Tabla y Erradicación de Cortes por Overflow (`SearchModule.jsx`, `search.css`, `tests/search-datagrid.test.mjs`) (2026-10-14)
- Requerimiento del usuario:
  - En el módulo de "Búsqueda de Eventos", al filtrar cuando hay pocos registros (o 1 solo registro), el menú/popover de filtro de columna aparecía atrapado dentro del contenedor de la tabla ("sale adentro no encima") y se cortaba por el límite inferior de la tabla (`overflow-x: auto`), ocultando los campos de fecha, inputs y botones de "Limpiar" y "Aplicar".
- Causa raíz:
  - Los popovers `.datagrid-popover-portal` estaban renderizados directamente dentro de cada celda `<th>` dentro de `.datagrid-table-container`.
  - En la especificación W3C de CSS, cualquier elemento con `overflow-x: auto` convierte automáticamente su eje vertical a `overflow-y: auto`, creando un contexto de recorte (clipping context). Con 1 sola fila en la tabla, la altura del contenedor era inferior a 100px, cortando por completo los popovers de 200px-380px.
- Solución:
  1. En `src/modules/search/SearchModule.jsx`:
     - Se integró `createPortal` de `react-dom` para montar los popovers de filtro de columna directamente en `document.body`.
     - Se implementó `calculatePopoverCoords(buttonEl, colKey)` calculando dinámicamente las coordenadas en pantalla con `getBoundingClientRect()` y posicionamiento inteligente `position: fixed; z-index: 999999;` (despliegue hacia abajo o hacia arriba según el espacio disponible en viewport, y protección contra desbordamiento horizontal).
     - Se añadió listener de reposicionamiento reactivo en `scroll` (modo captura) y `resize`.
     - Se limpió el `<thead>`, extrayendo los 8 bloques de popovers de los `<th>` y centralizándolos en el portal unificado en `document.body`.
     - Se añadió lógica inteligente al menú de 3 puntos de acciones en las filas para desplegarse hacia arriba si se encuentra en las últimas filas.
  2. En `src/modules/search/search.css`:
     - Se configuró `.datagrid-popover-portal` con `position: fixed; z-index: 999999; box-shadow: 0 16px 40px rgba(15, 23, 42, 0.22)...` para flotar con máxima prioridad sobre cualquier elemento.
     - Se añadió `min-height: 380px;` a `.datagrid-table-container` garantizando un lienzo amplio y despejado sin importar si hay 0, 1 o múltiples registros.
  3. En `tests/search-datagrid.test.mjs`:
     - Se agregaron aserciones validando el uso de `createPortal` con `document.body`, `position: fixed` en CSS y `min-height: 380px`.
- Validación: 174 pruebas unitarias aprobadas (`node --test tests/*.test.mjs`) y build de producción exitoso (versión `2.1.26`).

### Solución: Consolidación de Reservas Multi-Día y Multi-Salón en Búsqueda de Eventos (`SearchModule.jsx`, `search.css`, `tests/search-datagrid.test.mjs`) (2026-10-14)
- Requerimientos del usuario:
  1. En el módulo de "Búsqueda de Eventos", las reservas multi-día aparecían fragmentadas en múltiples filas (un registro por cada día del evento, ej. 2026-12-07, 2026-12-08, 2026-12-09 con el mismo número de documento `COT-172803` y repitiendo el monto total `Q 89,635.00` en cada fila).
  2. Consolidar los registros para mostrar únicamente una sola fila por reserva con sus datos unificados.
  3. Formato de fechas consolidado: Mostrar el rango global de fechas con badge de jornadas (`07/12/2026 al 09/12/2026 • 3 Jornadas`) y horario general.
  4. Formato de salones: Mostrar el Salón Principal y, si hay espacios adicionales, una pastilla informativa `+N más` con tooltip interactivo con los demás espacios.
  5. Exportación e Impresión: Consolidar también en la exportación a Excel y en la vista de impresión, exportando 1 sola fila por reserva con el monto exacto sin duplicar sumas.
- Solución:
  1. En `src/modules/search/SearchModule.jsx`:
     - Se refactorizó `processedEvents` para agrupar canónicamente los eventos por reserva mediante `getReservationKey(ev)` (evaluando `groupId`, `quote.code`, o `parent_id`).
     - Se extrajo el rango global de fechas `_dateStart` (fecha mínima) y `_dateEnd` (fecha máxima), calculando dinámicamente `_jornadas` a partir del número de fechas únicas en la serie.
     - Se unificó la lista de salones (`_salonList`), designando el salón principal y calculando `_additionalSalonsCount` y `_additionalSalonsList`.
     - Se tomó el monto de la cotización canónica (`totalNum`) una sola vez sin duplicaciones ni inflación de totales.
     - Se actualizó el renderizado en la tabla desktop y en las tarjetas móviles para mostrar el rango global con `<span className="datagrid-jornadas-badge">{ev._jornadas} Jornadas</span>` y la pastilla `<span className="datagrid-salon-more-pill">+{ev._additionalSalonsCount} más</span>`.
     - El filtro de año se adaptó para evaluar si la reserva inicia o concluye en el año seleccionado.
  2. En `src/modules/search/search.css`:
     - Se diseñaron las clases `.datagrid-jornadas-badge` (azul pastel `#eff6ff` con borde `#bfdbfe` y texto `#1d4ed8`) y `.datagrid-salon-more-pill` (gris pizarra tenue con borde discontinuo `#cbd5e1` y hover interactivo).
  3. En `tests/search-datagrid.test.mjs`:
     - Se añadió prueba unitaria automatizada comprobando la consolidación por clave, cálculo de jornadas y existencia de las clases visuales.
- Validación: 174 pruebas unitarias aprobadas (`node --test tests/*.test.mjs`) y build de producción exitoso (versión `2.1.25`).

### Solución: Pantalla Completa (100vw × 100vh) Sin Márgenes Flotantes, Botones Pastel Ejecutivos y Erradicación de Desbordamientos en Fechas de Salones (`reservationBento.css`, `Calendar.jsx`, `ReservationForm.jsx`, `tests/reservation-bento-redesign.test.mjs`) (2026-10-14)
- Requerimientos del usuario:
  1. El formulario de reserva no tomaba la pantalla completa en escritorio (mostraba bordes y overlay oscuros perimetrales flotantes estilo popup).
  2. Los botones de acción inferiores no se veían estéticos (fondos blancos planos con bordes toscos de alambre y texto 'Descartar' desalineado sin peso de botón).
  3. En la tabla de "Salones y Horarios", el año en los selectores de fecha nativos se cortaba (`12/10/202📅`), solapándose el texto con el icono de calendario, y existía desbordamiento horizontal.
- Solución:
  1. En `src/modules/calendar/components/reservationBento.css`:
     - Se configuraron `.reservation-modal-overlay`, `.reservation-modal-content` y `.res-bento-window` para ocupar el 100% de la pantalla (`width: 100vw !important; height: 100vh !important; max-width: 100vw !important; max-height: 100vh !important; border-radius: 0 !important; margin: 0 !important; padding: 0 !important;`) erradicando fondos oscuros, filtros de desenfoque y márgenes perimetrales.
     - Se rediseñaron los botones de acción del footer (`.res-bento-btn-action`): altura estandarizada a `36px`, esquinas redondeadas de `8px`, sombras suaves y paletas pastel sólidas de alto nivel ejecutivo (`Mantenimiento` en gris pizarra sobre blanco con icono `#64748b`; `+ Cita` en verde menta `#ecfdf5` con borde `#a7f3d0` e icono `#059669`; `Cotizar` en azul hielo `#eff6ff` con borde `#bfdbfe` e icono `#2563eb`; `Historial` en lavanda `#f5f3ff` con borde `#ddd6fe` e icono `#9333ea`; `Cancelar` en rosa carmesí `#fef2f2` con borde `#fecaca` e icono `#dc2626`).
     - Se rediseñó el botón `Descartar` como botón secundario ejecutivo formal (`background: #ffffff`, borde `#cbd5e1`, texto `#475569`, `36px` de altura y esquinas de `8px`) evitando que parezca un enlace suelto.
     - Se rediseñó el botón principal `Guardar Cambios` (`background: #007A64`, borde `#006653`, texto blanco, `38px` de altura, esquinas de `8px` y checkmark SVG).
     - Se reestructuró `.res-bento-cell-range` con `display: grid !important; grid-template-columns: 1fr auto 1fr !important;` y estilo controlado para el indicador de calendario `::-webkit-calendar-picker-indicator`, garantizando ancho simétrico para ambas fechas y erradicando cualquier corte de texto o colisión con el icono.
     - Se ajustó la plantilla de columnas de la tabla a `28px minmax(130px, 1.3fr) 54px minmax(285px, 2fr) minmax(180px, 1.2fr) minmax(135px, 1fr) 30px;` con `padding: 10px 20px;` en el encabezado y `padding: 8px 12px;` en las filas (dentro de wrapper con padding `8px`), logrando alineación milimétrica con el encabezado y `overflow-x: hidden !important;`.
  2. En `tests/reservation-bento-redesign.test.mjs`:
     - Se actualizaron las aserciones para validar pantalla completa (`width: 100vw`, `height: 100vh`), eliminación de `max-width: 1380px` y persistencia de las clases de botones de acción.
- Validación: 173 pruebas unitarias aprobadas (`node --test tests/*.test.mjs`) y build de producción exitoso (versión `2.1.23`).
- Requerimientos del usuario:
  1. En el modal "Editar Reserva" (y Nueva Reserva), la sección "Salones y Horarios" presentaba columnas desalineadas con los encabezados y un desbordamiento horizontal (`overflow-x: auto`) que forzaba barra de scroll y ocultaba el salón o comprimía los inputs.
  2. Ajustar las dimensiones de la ventana modal en escritorio para mantener el diseño flotante centrado con bordes redondeados y fondo oscuro difuminado (acorde a la maqueta de referencia), con ancho óptimo (`95vw`, `max-width: 1380px`, `height: 90vh`, `max-height: 860px`) para que todas las columnas encajen fluidamente.
  3. Erradicación total de emojis en todo el layout Bento y reemplazo exclusivo por iconos vectoriales SVG minimalistas tipo trazo fino (estilo Lucide/Feather).
- Solución:
  1. En `src/modules/calendar/components/reservationBento.css`:
     - Se eliminó el `min-width: 820px` rígido de `.res-bento-table-inner`, reemplazándolo por `width: 100%; min-width: 0;` y `.res-bento-table-wrap` con `overflow-x: hidden;` en resoluciones de escritorio normales.
     - Se ajustó el ratio de columnas de la cuadrícula Bento `.res-bento-grid` a `minmax(0, 1.95fr) minmax(320px, 1fr)` con `gap: 20px`, otorgando amplitud total a la columna izquierda.
     - Se sincronizaron las 7 columnas de `.res-bento-table-head` y `.res-bento-table-row` con la plantilla exacta `28px minmax(130px, 1.4fr) 56px minmax(200px, 1.8fr) minmax(170px, 1.4fr) 135px 30px; gap: 8px;` y padding perimétrico `10px 21px;` en el encabezado, alineándolo al píxel con el inicio de cada input dentro de las filas.
     - Se normalizó el ancho del input de PAX a `56px` con texto centrado, y se aplicó regla flex proporcional (`.res-bento-cell-range > div { flex: 1; min-width: 0; }`) para que los dos selectores `TimeSelect` se expandan armónicamente.
     - Se actualizaron las dimensiones de `.reservation-modal-content` y `.res-bento-window` a `width: 95vw !important; max-width: 1380px !important; height: 90vh !important; max-height: 860px !important;`.
  2. En `src/modules/calendar/components/ReservationForm.jsx`:
     - Se erradicaron todos los emojis del layout Bento (`★`, `📅`, `🕒`, `👥`, `👤`, `📞`, `🏢`, `ℹ`, `✍️`, `⚠️`, `✓`) reemplazándolos por iconos vectoriales SVG minimalistas ultra-limpios con trazos refinados (1.6px - 1.8px).
  3. En `src/components/TimeSelect.jsx`:
     - Se reemplazó el emoji `🕒` en el disparador del dropdown de horario por un icono SVG de reloj minimalista.
  4. En `tests/reservation-bento-redesign.test.mjs`:
     - Se incorporaron pruebas automatizadas validando la erradicación total de emojis en el layout Bento y la ausencia de anchos rígidos (`min-width: 820px`) en el CSS.
- Validación: 173 pruebas unitarias aprobadas (`node --test tests/*.test.mjs`) y build de producción exitoso.

### Solución: Rediseño Bento Ejecutivo Moderno del Modal de Reserva (Edición y Nueva) Basado en Maqueta de Referencia con Preservación Estricta de Colores del CRM (`ReservationForm.jsx`, `Calendar.jsx`, `reservationBento.css`, `tests/reservation-bento-redesign.test.mjs`) (2026-10-14)
- Requerimientos del usuario:
  1. Rediseñar el modal de "Editar Reserva" (aplicado de manera simétrica a "Nueva Reserva") basado en la maqueta de referencia proporcionada.
  2. Preservar de forma estricta los colores institucionales de los estados comerciales del CRM (`STATUS_META`: Contacto `#00A3FF`, Cotizado `#007A64`, Seguimiento `#FF8C00`, Pre-Reserva `#FF00CC`, Confirmado `#00CC66`).
  3. Mantener el comportamiento exacto actual al cambiar el estado individual de cada salón (sin sobreescrituras forzadas).
  4. Implementar modal flotante centrado en escritorio (`border-radius: 20px`, sombra ejecutiva y `backdrop-filter: blur(6px)`), y responsivo a pantalla completa en móviles (`<= 768px`).
  5. Stepper Chevron interactivo con las 5 etapas comerciales y visualización de progreso.
  6. Tarjeta Bento de Nombre del Evento y categoría.
  7. Tarjeta Bento de Salones y Horarios con botón rápido `Confirmar Todos` y `+ Agregar Salón`, tabla multi-espacio con selector de salón principal (estrella dorada), rango de fechas, selector de horario `TimeSelect`, selector de estado individual y botón de eliminación.
  8. Píldoras segmentadas de cálculo de aforo: `Compartido`, `No Compartido` y `Principal` con nota explicativa dinámica.
  9. Columna lateral con 4 tarjetas Bento: Periodo Global del Evento con contador de jornadas, Estado General Consolidado, Usuario Responsable interactivo con avatar de iniciales (`[ KB ]`), rol y escudo de verificación, y Notas con badge de autoguardado y contador de caracteres.
  10. Barra de acciones inferior con botones temáticos ejecutivos: Mantenimiento, + Cita (teal), Cotizar (azul), Historial (púrpura), Cancelar (rojo), Descartar y Guardar Cambios (verde esmeralda con check).
- Solución:
  1. En `src/modules/calendar/Calendar.jsx`:
     - Se limpiaron los estilos inline rígidos del overlay de reserva y se portaleó directamente al `document.body` mediante `createPortal`, evitando cualquier restricción de ancho o layout rígido de `#appShell`.
  2. En `src/modules/calendar/components/reservationBento.css`:
     - Se crearon reglas CSS con selectores de máxima especificidad (`html body:not(.informes-theme) .reservation-modal-overlay ...`) para blindar inputs, selects y textareas con fondo blanco puro (`background: #ffffff !important`, `background-color: #ffffff !important`, `background-image: none !important`), erradicando los fondos oscuros provenientes de reglas globales.
     - Se definió el modal flotante centrado con dimensiones ejecutivas (`max-width: 1220px !important`, `height: 88vh !important`, `max-height: 820px !important`, `border-radius: 20px !important`, sombra profunda y `backdrop-filter: blur(8px)` con padding perimetral de `32px 24px`), evitando que ocupe el 100% de la pantalla.
     - Se corrigió el botón de estrella principal (`.res-bento-star-btn`) y el botón de papelera (`.res-bento-btn-trash`) con reseteo a 28px/30px, fondo transparente, sin bordes de botón estándar ni formas ovaladas infladas.
     - Se estilizó el botón `+ Agregar Salón` con verde esmeralda sólido (`#007A64`, texto blanco) y `✓ Confirmar Todos` en blanco con borde verde según maqueta.
     - Se implementó el botón `✓ Guardar Cambios` con degradado esmeralda sólido (`#007A64` a `#00967a`), texto blanco y checkmark vectorial.
     - Se refinaron las píldoras de aforo (Compartido activo blanco con borde verde, No Compartido y Principal).
     - Se implementó el Stepper Chevron con `clip-path: polygon(...)`, tintes según estado y renderizado de los 5 iconos vectoriales correspondientes.
  3. En `src/modules/calendar/components/ReservationForm.jsx`:
     - Se incorporaron estilos inline de respaldo en inputs de texto, selector de salón, fechas y notas para garantizar apariencia blanca prístina.
     - Se enriqueció la cabecera con subtítulos e iconos visuales (`📅`, `🕒`, `👥`).
     - Se blindaron los botones de estrella y eliminación en cada fila de salón con iconos vectoriales SVG limpios.
  4. En `tests/reservation-bento-redesign.test.mjs`:
     - Se mantuvieron y validaron las suites automáticas comprobando la integridad de las clases, colores de estado, montaje por portal y compatibilidad.
  4. En `tests/reservation-bento-redesign.test.mjs`:
     - Se añadió suite automatizada comprobando la existencia de clases CSS, estructura JSX, preservación estricta de colores de estado en `constants.js` y comportamiento del overlay en `Calendar.jsx`.
- Validación: 171 pruebas unitarias aprobadas (`node --test tests/*.test.mjs`) y build de producción exitoso (versión `2.1.223`).

### Solución: Validaciones No Nativas, Mínimo 1 Noche Obligatoria, Toast Corporativo y Diseño de Errores Reactivo (`HabitacionModal.jsx`, `habitaciones.css`, `tests/habitaciones-system.test.mjs`) (2026-10-14)
- Requerimientos del usuario:
  1. Validar que la reserva de habitación tenga al menos una noche (`noches >= 1`, Check-Out posterior a Check-In).
  2. Implementar validaciones no nativas (sin globos o popups estándar feos del navegador; usar `noValidate`).
  3. Agregar diseño ejecutivo con estilos visuales, resaltado de campos inválidos con borde/fondo rojo, anillo focus, micro-animación e insignias de error con icono (`AlertCircle`).
  4. Integrar feedback con `toast` (`toast.error(...)`) corporativo con mensajes prioritarios y auto-enfoque en el primer campo inválido.
- Solución:
  1. En `src/modules/habitaciones/HabitacionModal.jsx`:
     - Se añadió `<form noValidate onSubmit={handleSubmit}>` y se removieron todos los atributos `required` nativos de HTML5 para erradicar los globos nativos del navegador.
     - Se implementó función `validateForm()` que valida:
       - Nombre del huésped obligatorio.
       - Fecha Check-In y Check-Out obligatorias.
       - Check-Out estrictamente posterior a Check-In.
       - Noches obligatorio y mayor o igual a 1 noche (`noches >= 1`).
       - Cantidad de habitaciones mayor o igual a 1 (`cantidad_habitaciones >= 1`).
       - Tarifa diaria y monto total válidos (no negativos).
     - Se integró `setErrors(validationErrors)` y la función `clearError(fieldName)` que limpia reactivamente el error en tiempo real a medida que el usuario escribe o corrige cada campo.
     - Se integró `toast.error(message)` en `handleSubmit` notificando inmediatamente el primer error encontrado con texto claro en español.
     - Se implementó auto-enfoque programático con `document.querySelector('.hab-modal-card .is-invalid')?.focus()` para guiar al usuario directo al campo que requiere corrección.
     - Se restauraron las declaraciones de hook omitidas `const [companySearch, setCompanySearch] = useState('')` y `const [companySuggestions, setCompanySuggestions] = useState([])` solucionando el `ReferenceError: setCompanySearch is not defined`.
  2. En `src/modules/habitaciones/habitaciones.css`:
     - Se añadieron estilos blindados con alta especificidad para `.hab-input.is-invalid`, `.hab-select.is-invalid` (borde rojo `#ef4444`, fondo tenue `#fef2f2`, texto `#991b1b` y sombra de resalte).
     - En foco (`:focus`), se aplica anillo suave de atención `#dc2626` con `rgba(220, 38, 38, 0.28)`.
     - Se diseñó `.hab-field-error` con tipografía ejecutiva (11px, `font-weight: 800`), icono vectorial de alerta y micro-animación `@keyframes habErrorFadeIn`.
  3. En `tests/habitaciones-system.test.mjs`:
     - Se añadió suite automatizada comprobando la regla de al menos 1 noche, validaciones no nativas, uso de `noValidate`, emisión de toasts, badges de error y estilos CSS.
- Validación: 167 pruebas unitarias aprobadas (`node --test tests/*.test.mjs`) y build de producción exitoso.

### Solución: Corrección de Bloqueo al Borrar en Campos Numéricos (Noches, Tarifa Diaria, Cantidad de Habitaciones y Monto Total) y Sincronización Automática de Check-Out (`HabitacionModal.jsx`, `SettingsHabitaciones.jsx`, `tests/habitaciones-system.test.mjs`) (2026-10-14)
- Requerimientos del usuario:
  1. En el modal "+ Nueva Reserva de Habitación", al intentar borrar el valor inicial en el campo "Noches" (por ejemplo `1`) para escribir `2`, el sistema no permitía borrar y al escribir salía `12`.
  2. De igual manera en "Tarifa Diaria (Q)", al intentar borrar para escribir una tarifa deseada, el campo se resistía al borrado y concatenaba números con ceros residuales (ej. `0450`).
  3. Revisar todos los campos del modal para que permitan borrar completamente su contenido y escribir la cantidad deseada libremente.
- Causa raíz:
  1. Los inputs numéricos realizaban coerción inmediata en `onChange` con `parseInt(e.target.value) || 1` y `Math.max(1, ...)` o `parseFloat(e.target.value) || 0`.
  2. Al presionar Backspace o borrar el texto, `e.target.value` era `""`. Como `parseInt("")` es `NaN`, `NaN || 1` evaluaba a `1` y reescribía el estado en `1` de inmediato, impidiendo vaciar el input. Al pulsar `2`, el cursor concatenaba al `1` existente produciendo `12`.
  3. De forma idéntica, `parseFloat("") || 0` forzaba `0` instantáneamente al borrar la tarifa diaria, produciendo `0450` al teclear `450`.
  4. Adicionalmente, al cambiar las noches manualmente, no se actualizaba la fecha de check-out, desincronizando la estancia.
- Solución:
  1. En `src/modules/habitaciones/HabitacionModal.jsx`:
     - Se permitió que el estado acepte strings temporales y string vacío `""` durante la edición (`value={formData.[campo] ?? ''}`).
     - Se crearon manejadores dedicados `handleNochesChange`, `handleCantidadHabitacionesChange`, `handleTarifaDiariaChange`, y `handleMontoTotalChange` que limpian ceros espurios a la izquierda (ej. `"0450"` -> `"450"`, preservando `"0."` para decimales).
     - Se implementaron handlers `onBlur` que formatean y aplican fallbacks seguros si el usuario abandona el input en blanco (`noches`: mínimo 1 o días entre check-in y check-out; `cantidad_habitaciones`: mínimo 1; `tarifa_diaria`: 0; `monto_total`: auto-total si estaba en blanco).
     - Se añadió `onFocus={e => e.target.select()}` en todos los campos numéricos para resaltar el número completo al hacer clic o tabulación, facilitando la sobreescritura inmediata sin obligar a presionar Backspace.
     - Se incorporó la función `addDays` para sincronizar automáticamente `fecha_check_out` con base en `fecha_check_in` + `noches`.
     - En `handleSubmit`, se aseguró la sanitización estricta de todos los campos numéricos en el payload antes de enviarlos a `onSave`.
  2. En `src/modules/settings/SettingsHabitaciones.jsx`:
     - Se corrigió el mismo comportamiento en `tarifa_base`, `orden`, `globalMonto` y `vm.monto` de metas de vendedores.
  3. En `tests/habitaciones-system.test.mjs`:
     - Se incorporó suite de pruebas unitarias automatizadas blindando el soporte de borrado, la auto-selección en foco, `addDays` y la sanitización en `handleSubmit`.
- Validación: 166 pruebas unitarias aprobadas (`node --test tests/*.test.mjs`) y build de producción exitoso.

### Solución: Rediseño Ejecutivo Moderno de Pantalla de Mantenimiento, Erradicación de Fuga de Clave en Placeholder y Eliminación de Cuenta Regresiva (`MaintenancePage.jsx`, `maintenance.css`, `tests/maintenance-mode-admin.test.mjs`) (2026-10-13)
- Requerimientos y observaciones del usuario:
  1. **Seguridad y confidencialidad de la clave**: En la versión anterior el placeholder del input mostraba `Ej: JDL-ADMIN-2026`, filtrando la clave maestra. Se erradicó por completo cualquier indicio o muestra de la contraseña en la UI, placeholders o tooltips (`placeholder="••••••••••••"`).
  2. **Eliminación del temporizador de 30 segundos**: Remover el contador regresivo de 30s y dejar únicamente el botón de acción principal **"🔄 Reintentar ahora"**.
  3. **Eliminación de la barra de progreso**: Omitir la barra de porcentaje a solicitud del usuario.
  4. **Rediseño visual moderno y profesional basado en imagen de referencia**:
     - **Fondo dark luxury**: `#080d1a` con resplandor radial azul (`radial-gradient`) y tipografía del sistema nítida.
     - **Barra superior institucional**: Logotipo "Jardines del Lago - HOTEL & RESORT LAKE VIEW" con icono vectorial de olas y badge flotante translúcido con punto ámbar pulsante `"🟡 Mantenimiento Preventivo Global"`.
     - **Tarjeta Bento ejecutiva**: Con bordes redondeados (`24px`), sombra de alta profundidad y cinta superior ámbar integrada `"⚙️ Optimización y despliegue de infraestructura de alta disponibilidad | Fase 2 de 2"`.
     - **Ícono central**: Caja amarilla degradada con llave de tuercas dorada e insignia de versión inferior oscura (`v2.1.21`).
     - **Botón Reintentar ahora**: Botón azul vibrante con icono giratorio durante la verificación, sin temporizadores forzados.
     - **Canales de soporte directo**: Dos tarjetas limpias (Área de Sistemas con pill "Disponible" y Recepción & Hotel con pill "24/7 Activo"), con botones directos para "Llamar", "WhatsApp" y "Copiar" correo con feedback visual "¡Copiado!".
     - **Footer ejecutivo**: Botón cápsula oscuro translúcido con candado `"🔒 Acceso de administrador"` y copyright.
     - **Modal seguro de Administrador**: Con campo de tipo password, botón de alternar visibilidad (ojo SVG), soporte para Enter y botones para desactivar mantenimiento para todos o acceder como administrador (bypass).
- Validación: 165 pruebas unitarias aprobadas (`node --test tests/*.test.mjs`) y build de producción exitoso (versión `2.1.21`).


### Solución: Arquitectura Responsiva Móvil, Vista de Tarjetas, Eliminación de Insignia 'Data Grid' y Traducción Completa al Español en Búsqueda de Eventos (`SearchModule.jsx`, `search.css`, `tests/search-datagrid.test.mjs`) (2026-10-13)
- Requerimientos:
  1. **Eliminación de la insignia 'Data Grid'**: Remover la pastilla `<span className="search-badge-saas">Data Grid</span>` de la cabecera del módulo conforme a la solicitud directa del usuario.
  2. **Traducción total al español**: Reemplazar textos y etiquetas en inglés en toda la interfaz de búsqueda:
     - Buscador general: placeholder `"Search by Keywords..."` → `"Buscar cliente, evento o no. doc..."`.
     - Barra de filtros: `"Filters"` → `"Filtros"`, `"Keywords :"` → `"Búsqueda :"`, `"Year :"` → `"Año :"`, `"Status :"` → `"Estado :"`, y botón dorado `"Clear All"` → `"Limpiar Todo"`.
     - Paginación: `"Previous"` → `"Anterior"`, `"Next"` → `"Siguiente"`, `"Per Page"` → `"Por página:"`, contador `"Showing X to Y of Z"` → `"Mostrando X a Y de Z"`, y botón de salto `"Go"` → `"Ir"`.
  3. **Optimización de visibilidad en versión móvil (`<= 768px`)**:
     - En pantallas de celular, una tabla de 9 columnas comprimía las celdas, rompía los nombres en líneas verticales deformes (`BYRON RANGEL 15 AÑOS`), forzaba scroll horizontal incómodo y recortaba fechas, totales y botones.
     - Implementación de la **Vista de Tarjetas Móviles (`search-mobile-card`)** como modo predeterminado en dispositivos móviles:
       - Fila superior: No. Doc (pastilla azul clicable), estado (pastilla coloreada con punto) y monto total en Quetzales destacado (`Q 25,450.00`).
       - Título del evento nítido y legible en negrita sin quiebres de palabras.
       - Metadatos organizados con iconos vectoriales: Cliente, Fechas con horario, Salón(es) y Vendedor asignado con avatar de iniciales.
       - Botones táctiles al pie: `Ver Detalle`, `Editar` y menú flotante `Más opciones` (`Ver Cotización`, `Copiar No. Doc`).
     - **Conmutador de Vista Móvil (`datagrid-mobile-view-toggle`)**: Permite alternar instantáneamente entre `[ 📇 Tarjetas ]` y `[ 📑 Tabla ]` con contador integrado de resultados.
     - Ocultación del atajo `Ctrl K` en móvil (`display: none !important;`) y expansión del buscador al 100% de ancho con altura de 38px.
     - Botón "Nueva Cotización" en móvil adaptado a botón cuadrado táctil de 38x38px mostrando únicamente el icono `+` en blanco sobre degradado azul (`.search-btn-new-quote span { display: none !important; }`), evitando truncamientos del texto (`ueva Cotiza`) y alineándose perfectamente con el selector de año y botones de herramientas.
     - Eliminación del botón manual de refresco (`RefreshCw`) por redundancia operativa (el sistema actualiza en tiempo real reactivamente).
     - Estandarización de color institucional en botones de herramientas superiores:
       - Exportar Excel: Verde esmeralda ejecutivo (`#059669` / `#047857`, icono blanco).
       - Imprimir tabla: Rojo institucional ejecutivo (`#dc2626` / `#b91c1c`, icono blanco).
     - Adición de `padding-bottom: 76px !important;` para garantizar que el botón flotante hamburguesa de navegación no tape la última tarjeta ni el paginador.
- Validación: 161 pruebas unitarias aprobadas (`node --test tests/*.test.mjs`) y build de producción exitoso (versión `2.1.19`).

### Solución: Arquitectura Responsiva Móvil y Corrección de Desbordamientos en Módulo Eventos Asignados (`PosiblesVentasModule.jsx`, `posiblesVentas.css`, `tests/posibles-ventas-mobile-responsive.test.mjs`) (2026-10-13)
- Requerimientos:
  1. **Corrección de compresión severa en tarjetas de eventos (`LeadCard`)**: En pantallas móviles (`<= 768px`), las tarjetas distribuían el contenido y las acciones de forma horizontal rígida con `minWidth: 190px` en los botones de acción, comprimiendo el área de contenido a menos de 80px de ancho disponible.
  2. **Corrección de quiebres de texto deformados**: Las fechas de eventos se partían entre renglones (ej. `2026-11-` / `23`), las notas se rompían a 1-2 palabras por línea vertical (ej. `PEDIDA` / `DE` / `MANO` / `Y` / `HABITACION`), y las pastillas de seguimiento (`Sin seguimiento programado`) se aplastaban.
  3. **Reorganización ergonómica de botones de acción**: Mover los botones al pie de la tarjeta abarcando el 100% del ancho con una división superior suave (`border-top: 1px solid #f1f5f9; padding-top: 10px;`). La primera fila asigna `flex: 1` a `Ver detalle` flanqueado por botones cuadrados de 38x38px de Editar y Eliminar; la segunda fila expande el botón `Mensaje` / `Reactivar` al 100% de ancho con área táctil óptima (38px de alto).
  4. **Adaptación de la barra de herramientas y filtros**:
     - Las pestañas de estado (`Status tabs`) implementan desplazamiento horizontal táctil suave (`overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none;`) sin amontonarse ni saltar renglones.
     - Los selectores de `Vendedor` y `Salón` se organizan en cuadrícula fluida de ancho completo.
     - El buscador se expande al 100% de ancho con altura estandarizada de 36px.
  5. **Márgenes y padding móvil**: Reducción del padding horizontal general de 24px a 12px para aprovechar toda la pantalla táctil y adición de margen inferior de 28px para evitar que el botón flotante hamburguesa de navegación móvil tape la última tarjeta.
- Solución:
  1. Se creó `src/modules/posiblesVentas/posiblesVentas.css` con estilos semánticos dedicados y bloque `@media (max-width: 768px)` completo para `.pv-lead-card`, `.pv-lead-content`, `.pv-lead-header`, `.pv-lead-title`, `.pv-lead-assignment`, `.pv-lead-meta-row`, `.pv-lead-meta-item`, `.pv-lead-notes`, `.pv-lead-actions`, `.pv-lead-actions-row-1`, `.pv-lead-actions-row-2`, `.pv-header-container`, `.pv-header-wrap`, `.pv-header-actions`, `.pv-kpis-grid`, `.pv-toolbar-container`, `.pv-status-tabs-wrap`, `.pv-status-tabs-track`, `.pv-filter-controls`, `.pv-filter-dropdowns-row`, `.pv-search-wrap`, `.pv-leads-scroll-container`, y `.pv-modal-grid-2`.
  2. En `src/modules/posiblesVentas/PosiblesVentasModule.jsx`:
     - Se importó `posiblesVentas.css`.
     - Se vincularon las clases semánticas responsivas a `LeadCard`, `LeadModal`, toolbar, selector de filtros y contenedor de tarjetas, migrando la etiqueta `<style>` inline previa.
     - Se preservó íntegra la lógica de asignación y contacto probada en suites previas (`tests/posibles-ventas-vendedor-contacto.test.mjs`).
  3. En `tests/posibles-ventas-mobile-responsive.test.mjs`:
     - Se diseñó suite automatizada validando la importación de estilos, presencia de clases en JSX y reglas de flex-direction, min-width, nowrap y layout táctil en CSS.
- Validación: 161 pruebas unitarias aprobadas (`node --test tests/*.test.mjs`) y build de producción exitoso.

### Solución: Arquitectura Responsiva Móvil y Corrección de Desbordamientos en Reporte de Proyección de Metas (`ReportsProyeccionMetas.jsx`, `reports.css`, `tests/reports-proyeccion-metas.test.mjs`) (2026-10-13)
- Requerimientos:
  1. **Corrección de desbordamiento horizontal en el conmutador de modos**: En pantallas móviles (`<= 768px`), el contenedor de 3 botones (`Consolidado`, `Solo Eventos`, `Solo Habitaciones`) excedía el ancho disponible de la tarjeta (~395px vs 320-375px), desbordándose hacia la derecha y truncando el texto "Solo Habitaciones" a "Solo Habitaci...".
  2. **Eliminación del divisor vertical huérfano**: En pantallas móviles, la barra divisoria `|` quedaba flotando en una línea aislada antes del campo "DESDE".
  3. **Simetría y orden en presets rápidos**: En lugar de que "Año" quedara huérfano y aislado en una segunda fila cuando los primeros 3 presets ocupaban el ancho, organizar los 4 presets en una cuadrícula simétrica 2x2 equilibrada.
  4. **Alineación de selectores de fecha (`Desde` y `Hasta`)**: Mostrar ambos selectores en una fila simétrica de 2 columnas con campos de ancho completo.
  5. **Adaptación al 100% de los filtros `VENDEDOR:` y `ESTADO:`**: Eliminar los anchos fijos de 220px/240px en móvil para que cada filtro se estructure verticalmente (etiqueta arriba, dropdown al 100% de ancho de la tarjeta).
  6. **Botones de exportación simétricos**: `Exportar PDF` y `Exportar CSV` divididos en 2 columnas iguales (50% / 50%) alineados en la parte inferior.
- Solución:
  1. En `src/modules/reports/ReportsProyeccionMetas.jsx`:
     - Se reemplazaron los estilos inline rígidos del toolbar por clases semánticas responsivas (`.proyeccion-row-1`, `.proyeccion-presets-group`, `.proyeccion-modes-dates-wrap`, `.proyeccion-desktop-prefix`, `.proyeccion-desktop-divider`, `.proyeccion-dates-row`, `.proyeccion-date-field`, `.proyeccion-row-2`, `.proyeccion-filters-group`, `.proyeccion-filter-item`, `.proyeccion-export-group`).
     - Se encapsuló la palabra `"Solo "` dentro de `<span className="proyeccion-desktop-prefix">Solo </span>` para "Solo Eventos" y "Solo Habitaciones", manteniendo el texto completo en desktop y mostrando "Consolidado", "Eventos" y "Habitaciones" en móvil con sus iconos vectoriales.
  2. En `src/modules/reports/reports.css`:
     - Se crearon las reglas base para desktop garantizando que la distribución en 2 filas se mantenga 100% idéntica.
     - Se añadió bloque `@media (max-width: 768px)` con:
       - `.proyeccion-presets-group`: cuadrícula `grid-template-columns: repeat(2, 1fr)` con botones al 100% de ancho.
       - `.proyeccion-segmented-container`: cuadrícula `grid-template-columns: repeat(3, 1fr)` al 100% de ancho y botones con `letter-spacing: -0.02em` y sin desbordamiento.
       - `.proyeccion-desktop-prefix` y `.proyeccion-desktop-divider`: `display: none !important;` en móvil.
       - `.proyeccion-dates-row`: cuadrícula `grid-template-columns: 1fr 1fr` con inputs al 100% de ancho.
       - `.proyeccion-filter-item`: visualización en columna al 100% con `.multiselect-wrapper` expandido a `width: 100% !important; min-width: 0 !important;`.
       - `.proyeccion-export-group`: cuadrícula `grid-template-columns: 1fr 1fr` con botones simétricos.
  3. En `tests/reports-proyeccion-metas.test.mjs`:
     - Se agregó suite de pruebas unitarias verificando la presencia de las clases responsivas en JSX y las reglas de media query en `reports.css`.
- Validación: 159 pruebas unitarias aprobadas (`node --test tests/*.test.mjs`) y build de producción exitoso.

### Solución: Estandarización Global de Botones de Exportación (PDF Rojo, Excel Verde), Acciones de Cabecera (Kanban Índigo, Alertas Violeta), Presets Rápidos con Estado Activo y Limpieza de Filtros en Toda la Suite de Reportes (`reports.css`, `ReportsSatisfaccion.jsx`, `ReportsComisiones.jsx`, `ReportsDashboard.jsx`, `ReportsContabilidad.jsx`, `ReportsInstitucion.jsx`, `ReportsOcupacionBarras.jsx`, `ReportsEficenciaEventos.jsx`, `ReportsEficenciaConfirmacion.jsx`, `ReportsIngresosCategorias.jsx`, `ReportsSeguimientosPendientes.jsx`, `ReportsOcupacion.jsx`, `ReportsEventosAsignados.jsx`, `tests/reports-standardized-buttons.test.mjs`) (2026-10-13)
- Requerimientos:
  1. **Estandarización de botones de exportación con color corporativo**:
     - Exportar PDF / Imprimir: Rojo ejecutivo institucional (`#dc2626`, borde `#b91c1c`, texto e icono `#ffffff`), altura fija de 36px, sombra suave y hover (`#b91c1c`, `translateY(-1px)`).
     - Descargar / Exportar Excel / CSV: Verde esmeralda ejecutivo (`#059669`, borde `#047857`, texto e icono `#ffffff`), altura fija de 36px, sombra suave y hover (`#047857`, `translateY(-1px)`).
  2. **Botones de acción rápida en cabecera**:
     - "Pipeline Kanban" (en Dashboard): Índigo corporativo (`background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)`, borde `#4338ca`, icono y texto blanco).
     - "Configurar Alertas" (en Auditoría & Calidad): Violeta ejecutivo (`background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)`, borde `#6d28d9`, icono y texto blanco).
  3. **Presets rápidos de fecha y alineación simétrica en toolbars**:
     - Presets (`[ Este Mes ]`, `[ Mes Anterior ]`, `[ Últimos 3M ]`, `[ Últimos 6M ]`, `[ Año ]`): Diseño píldora con altura uniforme de 36px, fondo blanco, borde `#cbd5e1`, tipografía `700`, hover `#f1f5f9` con resalte, y estado ACTIVO (`.active`) vibrante en Azul Real (`linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)`) con texto blanco y resplandor.
     - Selectores de fecha/mes: contenedor `.reports-filter-input-wrap` con 36px de altura, icono `#2563eb`, borde `#cbd5e1` y focus ring suave.
     - Botón "Limpiar Filtros" (`.reports-btn-clear`): diseño píldora ámbar/coral suave (`#fff7ed`, borde `#fdba74`, color `#c2410c`, icono `↺`), visible dinámicamente cuando hay filtros aplicados.
- Archivos modificados:
  - `src/modules/reports/reports.css`: Definición y blindaje de especificidad con `body:not(.informes-theme)` para `.reports-btn-pdf`, `.reports-btn-excel`, `.reports-btn-kanban`, `.reports-btn-alertas`, `.reports-preset-btn`, `.reports-btn-clear`, y `.reports-filter-input-wrap`.
  - `src/modules/reports/ReportsSatisfaccion.jsx`: Exportar PDF rojo, Descargar Excel verde, Configurar Alertas violeta.
  - `src/modules/reports/ReportsComisiones.jsx`: Exportar PDF rojo, Exportar CSV verde, alineación simétrica del toolbar (Mes, presets y vendedor a 38px), estado activo en presets y botón reactivo "Limpiar Filtros".
  - `src/modules/reports/ReportsDashboard.jsx`: Pipeline Kanban índigo, Exportar Reporte rojo y Limpiar Filtros ámbar/coral.
  - `src/modules/reports/ReportsContabilidad.jsx`: Exportar Excel verde esmeralda institucional.
  - `src/modules/reports/ReportsInstitucion.jsx`: Exportar Excel verde esmeralda institucional.
  - `src/modules/reports/ReportsOcupacionBarras.jsx`: Descargar Excel verde esmeralda, presets de rango rápido con seguimiento de estado activo e inputs con altura estandarizada.
  - `src/modules/reports/ReportsEficenciaEventos.jsx`, `ReportsEficenciaConfirmacion.jsx`, `ReportsIngresosCategorias.jsx`: Presets estandarizados con estado activo e inputs protegidos.
  - `src/modules/reports/ReportsSeguimientosPendientes.jsx`, `ReportsOcupacion.jsx`: Presets y botones de navegación rápida con estilos estandarizados.
  - `src/modules/reports/ReportsEventosAsignados.jsx`: Exportar PDF estandarizado a `.reports-btn-pdf`.
  - `tests/reports-standardized-buttons.test.mjs`: Suite de pruebas unitarias automatizadas validando las clases en `reports.css` y la adopción consistente en todos los módulos de reportería.
- Validación: 158 pruebas unitarias aprobadas (`node --test tests/*.test.mjs`) y build de producción exitoso (versión `2.1.13`).

### Solución: Unificación de Título "Dashboard" y Corrección de Margen Superior (Headroom) / Cero PAX en Gráfico de Asistencia (`ReportsDashboard.jsx`, `ReportsModule.jsx`, `ReportsModuleContainer.jsx`, `ReportInfo.jsx`, `tests/reports-dashboard-pax.test.mjs`) (2026-10-13)
- Requerimientos:
  1. **Simplificación del título**: Renombrar el reporte a simplemente `"Dashboard"` en toda la suite (removiendo "Dashboard Ejecutivo" y "Dashboard Principal") tanto en la vista del reporte (`ReportsDashboard.jsx`), tarjeta del hub Bento (`ReportsModule.jsx`), listado central (`ReportsModuleContainer.jsx`) y panel de ayuda conceptual (`ReportInfo.jsx`).
  2. **Corrección de etiquetas truncadas en días pico de PAX**: En el gráfico de barras "Asistencia total por día (todos los salones)", en los días con el número máximo de asistentes (como el día 10 con 1298 PAX en la imagen del usuario), la etiqueta numérica flotante sobre la barra quedaba recortada y oculta en la parte superior debido a que la barra alcanzaba el 100% de la altura y el contenedor con `overflow-x: auto` recortaba el eje vertical.
  3. **Visualización de 0 PAX en días sin asistencia**: En lugar de omitir la etiqueta en días donde no hay eventos o asistencia registrada, mostrar el valor `0` sobre la base de la barra para informar explícitamente al usuario.
- Causa raíz:
  1. En `ReportsDashboard.jsx`, el porcentaje de altura de cada barra se calculaba estrictamente como `(pax / maxDayPax) * 100`. Para el día de mayor asistencia, la barra medía el 100% (170px de 170px), posicionando la etiqueta con `bottom: 100%` en coordenadas negativas fuera del contenedor. Al tener el contenedor `overflowX: 'auto'`, la especificación CSS fuerza el recorte en `overflow-y`, cortando la etiqueta por completo.
  2. La etiqueta estaba condicionada a `{pax > 0 && <span ...>{pax}</span>}`, dejando los días con 0 PAX sin ningún indicador visual numérico.
- Solución:
  1. En `ReportsDashboard.jsx`:
     - Se incorporó un margen superior (headroom) del 20% en `paxDayChartData`: `yAxisMax = maxDayPax > 0 ? Math.ceil(maxDayPax * 1.2) : 100`. Con esto, la barra del día pico alcanza ~83.3% de la altura del gráfico, garantizando más de 28px de espacio libre interno antes del borde superior.
     - Se añadió `paddingTop: '16px'` al contenedor de scroll horizontal para otorgar respiro adicional.
     - Se actualizó la escala del eje Y (ticks de 100%, 75%, 50%, 25%, 0) con base en `paxDayChartData.yAxisMax`.
     - Se removió la condición restrictiva `{pax > 0 && ...}`, mostrando `{pax}` en todos los días: con azul `#2563eb` y peso `800` si `pax > 0`, y en gris slate `#94a3b8` con peso `600` cuando `pax === 0`.
     - Se simplificó el título del reporte en el encabezado a `Dashboard`.
  2. En `src/modules/reports/ReportsModule.jsx` y `src/modules/reports/ReportsModuleContainer.jsx`:
     - Se actualizaron las tarjetas y etiquetas de `"Dashboard Principal"` a `"Dashboard"`.
  3. En `src/modules/reports/components/ReportInfo.jsx`:
     - Se actualizó el título informativo a `"Dashboard"`.
  4. En `tests/reports-dashboard-pax.test.mjs`:
     - Se añadieron 3 pruebas unitarias automatizadas blindando la unificación de nombres, el headroom del 20% y el renderizado incondicional de `0` en días sin PAX.
- Validación: 156 pruebas unitarias aprobadas (`node --test tests/*.test.mjs`) y build de producción exitoso.

### Solución: Alineación de Controles, Reactividad de Filtros y Rediseño Ejecutivo del Conmutador de Modos en Reporte de Proyección de Metas (`ReportsProyeccionMetas.jsx`, `reports.css`, `tests/reports-proyeccion-metas.test.mjs`) (2026-10-13)
- Requerimientos:
  1. **Alineación de controles**: Organizar la barra de herramientas del Reporte de Proyección de Metas en 2 filas limpias, simétricas y perfectamente balanceadas:
     - Fila 1: Presets rápidos (`Este Mes`, `Mes Anterior`, `Últimos 3M`, `Año`) a la izquierda, y a la derecha el conmutador segmentado de modos (`Consolidado` / `Solo Eventos` / `Solo Habitaciones`), divisor vertical y los selectores de fechas inline (`Desde` / `Hasta`).
     - Fila 2: Filtros desplegables con etiquetas (`VENDEDOR:` y `ESTADO:`) alineados a la izquierda a la par, y botones de exportación ejecutiva (`Exportar PDF` en rojo y `Exportar CSV` en verde) alineados a la derecha. Todos los controles estandarizados a 38px de altura.
  2. **Diseño y visibilidad del conmutador de modos**: Reemplazar los botones planos y desapercibidos anteriores por un conmutador segmentado de alta visibilidad:
     - Contenedor con borde `#cbd5e1`, esquinas redondeadas y fondo `#f1f5f9`.
     - Iconos vectoriales personalizados: `IconLayers` (Consolidado), `IconEventSparkles` (Solo Eventos) y `IconBed` (Solo Habitaciones).
     - Estados activos vibrantes con degradados ejecutivos y sombras de resplandor: Consolidado en Azul Real (`#2563eb`), Solo Eventos en Violeta (`#7c3aed`) y Solo Habitaciones en Verde Esmeralda (`#059669`).
     - Estados inactivos con fondo blanco nítido, borde sutil, cursor pointer, micro-animación hover y color de icono respectivo.
  3. **Corrección de reactividad y lógica de negocio en filtros**:
     - Causa raíz 1: `projectionData` carecía de `projectionMode`, `habitacionesList` y `habitacionesMetasMap` en su array de dependencias de `useMemo`, provocando que al alternar entre modos el cálculo de vendedores y metas no se actualizara en pantalla.
     - Causa raíz 2: La llamada a `getHabitacionesApi` enviaba de forma rígida `estado: 'Confirmada'`, ignorando reservas en 'Pre reserva' a pesar de que el filtro de estados del usuario incluía Pre reserva.
     - Causa raíz 3: `computeTeamData` (agrupamiento por equipos) y `potentialData` (tendencia mensual) calculaban únicamente eventos, omitiendo por completo las ventas de habitaciones y el `projectionMode`.
     - Causa raíz 4: Normalización de estados con el helper `isHabitacionInStatusFilter` para conciliar diferencias morfológicas (ej. 'Confirmada' para habitación vs 'Confirmado' para evento).
     - Causa raíz 5: Evaluación de metas en modo Solo Habitaciones: si el vendedor cuenta con una meta configurada en `habitacionesMetasMap`, se evalúa contra dicha meta al 100%; en caso contrario, se utiliza la escala de comisión general (`goalTiers`).
- Archivos modificados:
  - `src/modules/reports/ReportsProyeccionMetas.jsx`: Implementación de iconos vectoriales, normalizador de estados, corrección de llamadas a API, inclusión de dependencias reactivas completas y rediseño del toolbar en 2 filas estructuradas.
  - `src/modules/reports/reports.css`: Estilos dedicados blindados con `body:not(.informes-theme)` para `.reports-toolbar--proyeccion`, `.proyeccion-preset-btn`, `.proyeccion-segmented-container`, `.proyeccion-segmented-btn`, variantes activas con degradados y botones ejecutivos de exportación.
  - `tests/reports-proyeccion-metas.test.mjs`: Suite de pruebas unitarias automatizadas validando la presencia de iconos, opciones del conmutador, reactividad de dependencias, evaluación de metas de habitaciones y estilos CSS.
- Validación: 153 pruebas automáticas superadas (`node --test tests/*.test.mjs`), build limpio de producción.

### Solución: Estandarización y Rediseño con Color Ejecutivo de Botones "Volver a Reportes" en Todos los Reportes (`ReportsVentas.jsx`, `ReportsVentasHabitaciones.jsx`, `ReportsContabilidad.jsx`, `ReportsDashboard.jsx`, `ReportsInstitucion.jsx`, etc., `reports.css`, `tests/reports-navigation-and-chips.test.mjs`) (2026-10-13)
- Requerimientos:
  1. **Estandarización de texto**: Unificar el texto de retorno en todos los 15 reportes del sistema a `"Volver a Reportes"`, eliminando inconsistencias confusas donde unos decían solo "Volver", otro "Volver al Dashboard" y otros "Volver a Reportes".
  2. **Estandarización de posición (mismo lado)**: Ubicar el botón de retorno en todos los reportes sobre el **lado derecho** de la cabecera (`.reports-page-header`), junto a los controles de acción y el botón de información `(i)` (`ReportInfo`), dejando el lado izquierdo reservado para la identidad y títulos del reporte, corrigiendo la anomalía de `ReportsVentas.jsx` donde estaba en el lado izquierdo.
  3. **Rediseño con color ejecutivo de alta visibilidad**: Reemplazar los botones pálidos y casi invisibles de fondo blanco y borde gris tenue por un diseño con color real y vibrante:
     - Fondo con degradado azul corporativo ejecutivo: `linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%) !important;` y color base `#2563eb !important;`.
     - Tipografía y flecha vectorial en blanco puro `#ffffff !important;` (`font-weight: 700 !important; font-size: 13px !important;`).
     - Borde azul sólido `1px solid #1d4ed8 !important;` y sombra con resplandor `box-shadow: 0 2px 6px rgba(37, 99, 235, 0.28) !important;`.
     - Efecto hover con micro-animación de retorno `transform: translateX(-2px) !important;`, oscurecimiento a azul cobalto `linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)` y elevación de sombra `box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4) !important;`.
     - Blindaje con `body:not(.informes-theme)` en `reports.css` para `.reports-btn-back`, `.reports-back-btn`, `.rhab-btn-back` y `.reports-page-header button.btn-exit`.
- Archivos modificados:
  - `src/modules/reports/reports.css`: Definición y blindaje de las reglas de color, degradado, icono blanco y hover para todas las clases de retorno.
  - `src/modules/reports/ReportsVentas.jsx`: Reubicación del botón al lado derecho junto a `ReportInfo` y texto estandarizado "Volver a Reportes".
  - `src/modules/reports/ReportsVentasHabitaciones.jsx`: Botón estandarizado con clases y diseño azul ejecutivo.
  - `src/modules/reports/ReportsContabilidad.jsx`, `ReportsDashboard.jsx`, `ReportsInstitucion.jsx`, `ReportsSatisfaccion.jsx`, `ReportsOcupacionBarras.jsx`, `ReportsOcupacion.jsx`, `ReportsEficenciaEventos.jsx`, `ReportsEficenciaConfirmacion.jsx`, `ReportsIngresosCategorias.jsx`, `ReportsSeguimientosPendientes.jsx`, `ReportsComisiones.jsx`, `ReportsProyeccionMetas.jsx`, `ReportsEventosAsignados.jsx`: Texto unificado a "Volver a Reportes", eliminación de estilos inline obsoletos que forzaban fondo blanco o transparente y agrupación uniforme a la derecha junto a `ReportInfo`.
  - `tests/reports-navigation-and-chips.test.mjs`: Prueba automatizada exhaustiva que verifica que los 14 archivos de sub-reportes contengan exactamente "Volver a Reportes" y que el CSS aplique el azul corporativo `#2563eb`.
- Validación: 150 pruebas automáticas superadas (`node --test tests/*.test.mjs`), build limpio de producción.

### Solución: Rediseño de Botón Volver, Círculo de Información (i) y Chips de Categorías en Reportes (`ReportsModule.jsx`, `ReportInfo.jsx`, `ReportsVentas.jsx`, `reports.css`, `tests/reports-navigation-and-chips.test.mjs`) (2026-10-13)
- Requerimientos:
  1. **Opción Volver al Dashboard visible en todos los reportes**: Transformar la opción de "Volver al Dashboard" / "Volver a Reportes" en un botón real de alta visibilidad, con color, borde y diseño destacado, eliminando el estilo transparente/oculto anterior.
  2. **Círculo de información `(i)` perfectamente redondo y con color**: Corregir la deformación del botón `(i)` de información de cálculo de reportes (`ReportInfo.jsx`), el cual aparecía ovalado y estirado por reglas globales de botones, otorgándole una geometría 100% circular (`border-radius: 50% !important; aspect-ratio: 1 / 1 !important; width: 32px; height: 32px; padding: 0 !important;`), icono SVG vectorial nítido, fondo azul hielo `#eff6ff`, borde azul `#bfdbfe`, color azul real `#2563eb` y micro-animación en hover (`scale(1.08)`).
  3. **Rediseño de los botones del menú de reportes (`ReportsModule.jsx`)**: Adaptar la barra de categorías con máxima fidelidad a la imagen de referencia ("Reportes Generales"):
     - Píldoras redondeadas (`border-radius: 12px`, `height: 40px`, padding `0 14px 0 8px`).
     - Cajita de icono con esquinas redondeadas (`width: 26px; height: 26px; border-radius: 7px;`) e iconos vectoriales dedicados (`grid-all`, `trending-up`, `card`, `calendar`, `target`, `grid-dots`, `star`, `filter`).
     - Paleta pastel suave por categoría (Ventas menta `#ecfdf5`, Finanzas ámbar `#fffbeb`, Operación celeste `#f0f9ff`, KPIs índigo `#eef2ff`, Clientes violeta `#f5f3ff`, Calidad rosa `#fff1f2`, Pipeline cian `#ecfeff`).
     - Insignia píldora (`.reports-hub-chip-badge`) con el conteo dinámico exacto de reportes disponibles por categoría.
     - Estado ACTIVO (`.reports-hub-chip--active`) en estilo oscuro elegante (`#0f172a`), texto blanco, borde slate `#334155` y badge oscuro translúcido `#1e293b`.
- Causa raíz:
  1. En `design-system-scoped.css`, la regla `body:not(.informes-theme) button` aplicaba forzosamente `min-height: 40px !important;` y `padding: 0 14px !important;`. Al no tener especificidad ni `!important` en el inline style de `ReportInfo.jsx`, el botón de 28px se estiraba a 40px de alto y más de 56px de ancho, desfigurándolo como un óvalo achatado en vez de un círculo.
  2. En `ReportsVentas.jsx`, el botón "Volver al Dashboard" tenía `background: transparent; border: none; color: #475569`, y en los demás reportes la regla `.btn-exit` en `reports.css` forzaba `background: transparent !important; border: none !important; color: #64748b !important;`, volviéndolo casi invisible para el usuario.
- Solución:
  1. En `src/modules/reports/components/ReportInfo.jsx` y `reports.css`:
     - Se creó la clase `.report-info-btn` blindada con `body:not(.informes-theme)` que impone `width: 32px !important; height: 32px !important; min-width: 32px !important; min-height: 32px !important; border-radius: 50% !important; aspect-ratio: 1 / 1 !important; padding: 0 !important;`.
     - Se reemplazó el carácter textual `i` por un SVG vectorial elegante con círculo concéntrico e indicador central.
  2. En `src/modules/reports/ReportsVentas.jsx`, `ReportsDashboard.jsx` y `reports.css`:
     - Se implementó la clase `.reports-btn-back` y se blindaron `.reports-btn-back`, `.reports-back-btn` y `.reports-page-header .btn-exit` con fondo `#ffffff`, borde `1.5px solid #cbd5e1`, color `#1e293b`, icono con trazo azul `#2563eb`, altura 36px y micro-desplazamiento suave `translateX(-2px)` en hover.
  3. En `src/modules/reports/ReportsModule.jsx` y `reports.css`:
     - Se estructuraron los chips de categorías con `.reports-hub-chip-icon-box`, `.reports-hub-chip-label` y `.reports-hub-chip-badge`.
     - Se implementó cálculo reactivo con `useMemo` de `categoryCounts` para alimentar los badges numéricos.
     - Se implementaron las clases de color pastel individuales (`.reports-hub-chip--ventas`, etc.) y el estilo oscuro activo (`.reports-hub-chip--active`) fiel a la imagen.
  4. En `tests/reports-navigation-and-chips.test.mjs`:
     - Se crearon 3 pruebas unitarias exhaustivas blindando la geometría circular de `(i)`, el botón de navegación visible y los chips con conteos y paleta pastel.
- Validación: 150 pruebas automáticas superadas (`node --test tests/*.test.mjs`), build limpio de producción (versión `2.1.219`).

### Solución: Botones Imprimir / PDF y Exportar Excel al lado de Columnas con Mismo Tamaño y Reporte PDF Idéntico a Excel (`ReportsVentas.jsx`, `reports.css`, `tests/reports-ventas-columns.test.mjs`) (2026-10-13)
- Requerimiento:
  1. En el módulo de Reporte de Ventas (`ReportsVentas.jsx`), transformar el botón "Imprimir / PDF" a color ROJO ejecutivo (`#dc2626`) y reubicarlo junto al botón de "Exportar Excel" para que ambos estén situados **a la par del botón `Columnas 9/9`** en la cabecera de la tabla de registros.
  2. Ambos botones ("Imprimir / PDF" y "Exportar Excel") deben tener exactamente el **mismo tamaño y proporciones** (`height: 34px`, padding uniforme, tipografía consistente e iconos SVG del mismo tamaño).
  3. Corregir el fallo por el cual al presionar "Imprimir / PDF" salía en BLANCO: debe generarse con su diseño institucional completo (logotipo, membrete, metadatos, filtros activos, KPIs) y contener **exactamente las mismas 12 columnas contables y datos filtrados** que el reporte de Excel (`#`, `Estado`, `Cotización`, `No. Folio / NOG`, `Institución / Cliente`, `Vendedor Asignado`, `Fecha Inicio`, `Fecha Fin`, `Evento`, `Salón Principal`, `PAX`, `Monto Total (GTQ)` y fila de `TOTAL GENERAL`).
- Causa raíz de la hoja en blanco:
  1. En `src/modules/reports/reports.css`, la regla `@media print` contenía `body * { visibility: hidden !important; }` incondicionalmente, diseñada para un modal contable aislado. Al importarse `reports.css` en `ReportsVentas.jsx`, esa regla forzaba que absolutamente todo el contenido de la página se ocultara al dispararse el diálogo de impresión, resultando en páginas 100% en blanco.
  2. La función `handlePrint` se limitaba a invocar `window.print()`, truncando los datos a 10 filas de la vista de pantalla en vez de imprimir toda la cartera filtrada.
- Solución:
  1. En `src/modules/reports/reports.css`:
     - Se corrigió la regla `@media print` reemplazando `body * { visibility: hidden !important; }` por `body:has(.printable-event-statement-modal) *`, permitiendo que la ventana normal imprima sin ocultarse.
     - Se crearon y blindaron las clases `.rv-btn-print` (`#dc2626 !important`, borde `#b91c1c`) y `.rv-btn-excel` (`#059669 !important`, borde `#047857`), forzando exactamente `height: 34px !important`, `min-height: 34px !important`, `max-height: 34px !important`, `padding: 0 14px !important`, `border-radius: 8px !important` y trazos de SVG en blanco puro.
  2. En `src/modules/reports/ReportsVentas.jsx`:
     - Se reubicaron los botones "Imprimir / PDF" y "Exportar Excel" directamente en la cabecera de "Detalle de Operaciones y Reservas", colocándolos a la par del botón `Columnas {visibleCount}/{totalColumns}` en un flex container unificado.
     - Se limpió el encabezado superior de la página, dejando únicamente el indicador de sincronización y el botón informativo.
     - Se reconstruyó `handlePrint` con un documento imprimible que incluye las **12 columnas idénticas a Excel** (`#`, `Estado`, `Cotización`, `No. Folio / NOG`, `Institución / Cliente`, `Vendedor Asignado`, `Fecha Inicio`, `Fecha Fin`, `Evento`, `Salón Principal`, `PAX`, `Monto Total (GTQ)`), cabecera institucional JDL, filtros activos, 6 tarjetas KPI y fila de `TOTAL GENERAL` contable.
     - Soporte para apertura directa en ventana emergente con barra de vista previa `.no-print` y fallback transparente por iframe en navegadores con bloqueo de popups.
  3. En `tests/reports-ventas-columns.test.mjs`:
     - Se blindaron pruebas unitarias validando la agrupación de los botones al lado de Columnas, el mismo tamaño de 34px en CSS y las 12 columnas exactas de Excel en `handlePrint`.
- Validación: 147 pruebas automáticas superadas (`node --test tests/*.test.mjs`), build limpio de producción (versión `2.1.218`).

### Solución: Rediseño Data Grid y Filtros Interactivos en Buscar Eventos (`SearchModule.jsx`, `search.css`, `tests/search-datagrid.test.mjs`) (2026-10-13)
- Requerimiento:
  Rediseñar el módulo de Buscar Eventos implementando una arquitectura interactiva tipo **Data Grid** con máxima fidelidad a la imagen de referencia ("DATAGRID FILTER UI/UX WITH USER FLOW ANIMATION"):
  1. Barra superior: Título con badge "Data Grid", buscador por palabras clave (`Search by Keywords...`) con atajo visual `Ctrl+K`, selector desplegable de año, botones de herramientas (Exportar a Excel, Imprimir, Refrescar) y botón para "Nueva Cotización".
  2. Barra de filtros activos: Icono `Filters`, chips oscuros alargados (`#334155`) con texto blanco y botón circular de remoción `✕`, más botón ámbar/dorado `Clear All` para restablecer todos los filtros.
  3. Encabezados Data Grid en azul real (`#2563eb`): Flechas de ordenación dinámica `↓↑` en cada columna e icono de embudo `[Y]` interactivo con popover flotante por columna (con botones "Limpiar" y "Aplicar").
  4. Columnas desagregadas con tipografía ejecutiva: `No. Doc` (pill monospace azul), `Evento`, `Cliente / Empresa`, `Vendedor` (avatar circular de iniciales), `Salón`, `Fechas`, `Total (Q)` (monospace verde menta), `Estado` (pastilla con badge de color) y `Acción`.
  5. Tres botones de acción rápida por fila: Lupa azul para Ver (`.btn-view`), Lápiz verde para Editar (`.btn-edit`) y Basurero rojo para Eliminar (`.btn-delete`).
  6. Pie de paginación Data Grid: Botón `Previous`, números de página interactivos (`.datagrid-page-num`), botón `Next`, selector `Per Page [ 05 / 10 / 25 / 50 ]`, contador `Showing X to Y of Z`, e input de salto directo de página con botón `[ Go ]`.
- Solución:
  1. En `src/modules/search/search.css`:
     - Se crearon las clases `.datagrid-wrapper`, `.datagrid-topbar`, `.datagrid-search-box`, `.datagrid-search-kbd`, `.datagrid-active-filters-bar`, `.datagrid-chip`, `.datagrid-btn-clear-all`, `.datagrid-th`, `.datagrid-th-btn`, `.datagrid-popover-portal`, `.datagrid-td`, `.datagrid-doc-pill`, `.datagrid-amount-mono`, `.datagrid-action-btn`, `.datagrid-pagination-footer`, etc.
     - Se eliminó el `max-width: 1440px` y `margin: 0 auto` restrictivo en `.search-saas-container`, configurando `width: 100% !important` y `max-width: 100% !important` para erradicar el espacio desperdiciado y expandir el Data Grid al 100% del viewport.
     - Se fijó `select.datagrid-year-select` a `width: auto !important` y `.datagrid-topbar-actions` con `flex-wrap: nowrap` para alinear el buscador, selector de año y botones en una sola fila horizontal sin saltos ni desbordes.
     - Se blindó `.datagrid-table thead`, `tr` y `th.datagrid-th` con `background: #2563eb !important`, `background-color: #2563eb !important` y `color: #ffffff !important` contra `design-system-scoped.css` y estilos heredados.
     - Se blindaron con `body:not(.informes-theme)` todos los botones (`.datagrid-btn-clear-all`, `.datagrid-action-btn`, `.datagrid-tool-btn`, `.datagrid-page-btn`, `.datagrid-goto-btn`).
  2. En `src/modules/search/SearchModule.jsx`:
     - Se implementó la arquitectura Data Grid con ordenación reactiva por columna (`sortField`, `sortDirection`), filtrado por columna individual mediante popovers flotantes con click-outside, filtrado por año y texto global, atajo `Ctrl+K`, paginación completa en cliente y exportación ejecutiva a Excel con `ExcelJS` y fallback a `XLSX`.
     - Se corrigió el diseño de los popovers de filtro por columna: textboxes con fondo blanco limpio (`#ffffff`) y texto oscuro contrastado (`#0f172a`), inputs de fechas con layout vertical contenido (`.datagrid-date-field-wrap`) sin desbordes laterales, y lista de vendedores con ancho expandido a 310px con `overflow-x: hidden` y `white-space: normal` para leer nombres completos sin scroll horizontal.
  3. En `tests/search-datagrid.test.mjs`: Se incorporaron 4 pruebas unitarias exhaustivas blindando la arquitectura Data Grid, los estilos full-width, el color de cabeceras y la exportación.
- Validación: 146 pruebas automáticas superadas (`node --test tests/*.test.mjs`), build limpio de producción (versión `2.1.216`).

### Solución: Exportación a Excel Institucional con Membrete y Corrección de Buffer en Reporte de Ventas de Habitaciones (`ReportsVentasHabitaciones.jsx`, `tests/reports-ventas-habitaciones.test.mjs`) (2026-10-13)
- Requerimiento / Síntoma:
  Al presionar el botón "Exportar a Excel" en el Reporte de Ventas de Habitaciones, la descarga no se iniciaba o arrojaba error, y el archivo carecía del diseño ejecutivo, membrete y encabezado institucional presente en el Reporte de Ventas de eventos.
- Causa raíz:
  1. En `handleExportExcel`, el código intentaba escribir el buffer ejecutando `ws.xlsx.writeBuffer()`. En la librería `exceljs`, `ws` es una instancia de `Worksheet` (la cual carece de la propiedad `.xlsx`), por lo que `ws.xlsx` era `undefined`, provocando la excepción `TypeError: Cannot read properties of undefined (reading 'writeBuffer')` que interrumpía la descarga.
  2. El enlace de descarga temporal `downloadAnchor` no se agregaba al DOM (`document.body.appendChild`), lo cual en navegadores modernos puede bloquear el disparo de `downloadAnchor.click()`.
  3. No se contaba con estructura de banner institucional, filtros aplicados, formato de moneda `Q #,##0.00` en celdas, ni fila de `TOTAL GENERAL:` con fórmulas contables `SUM()`.
- Solución:
  1. En `src/modules/reports/ReportsVentasHabitaciones.jsx`:
     - Se corrigió la invocación de buffer a `workbook.xlsx.writeBuffer()`.
     - Se estructuró el archivo Excel con diseño ejecutivo idéntico al de eventos:
       - Banner superior institucional en verde esmeralda corporativo JDL (`A1:N1`, font 13pt negrita blanca, altura 34px).
       - Fila de metadatos (`A2:N2`) con fecha/hora de generación, conteo de transacciones y filtros activos (período fiscal, vendedor, tipo de habitación, término de búsqueda).
       - 14 columnas estilizadas (`#`, `No. Folio`, `Estado`, `Huésped`, `Teléfono / Correo`, `Empresa`, `Check-In`, `Check-Out`, `Noches`, `Cant. Hab`, `Tipo de Habitación`, `Vendedor Asignado`, `Forma de Pago`, `Monto Total (GTQ)`).
       - Filas de datos con estados coloreados (Confirmada verde menta, Cancelada rojo pastel, Pre reserva ámbar suave) y alternancia de fondo (`#FFFFFF` y `#F8FAFC`).
       - Fila de `TOTAL GENERAL:` con fórmulas Excel automáticas `SUM()` para Noches, Habitaciones y Monto Total, con doble línea contable inferior y fondo esmeralda.
       - Autofiltros integrados y fallback resiliente con `XLSX` (SheetJS) en bloque catch.
       - Descarga segura mediante inserción y remoción limpia de `downloadAnchor` en el DOM.
  2. En `tests/reports-ventas-habitaciones.test.mjs`: Se incorporaron pruebas unitarias validando la presencia del banner superior, metadatos, fórmulas `SUM()`, `workbook.xlsx.writeBuffer()` y fallback con SheetJS.
- Validación: 142 pruebas automáticas superadas (`node --test tests/*.test.mjs`), build limpio de producción (versión `2.1.213`).
### Solución: Alineación Perfecta del Filtro de Estados y Chips en Reporte de Ventas (`ReportsVentas.jsx`, `tests/reports-ventas-columns.test.mjs`) (2026-10-13)
- Requerimiento / Síntoma:
  En la barra de filtros del Reporte de Ventas, los chips de estados activos aparecían desalineados verticalmente respecto al selector desplegable de estados y al texto `FILTRO ESTADO:`.
- Causa raíz:
  El componente `MultiSelect` renderizaba por defecto una etiqueta superior `<span>{placeholder}</span>` ("Estados") con `display: block; margin-bottom: 4px;` a menos que se le pasara la prop `hideLabel`. Dado que la fila ya contenía el label horizontal explícito `FILTRO ESTADO:` a la izquierda, la presencia de la etiqueta superior duplicada "Estados" aumentaba la altura total del contenedor del MultiSelect a ~52px y empujaba el botón trigger hacia abajo. Al tener el contenedor flex padre `align-items: center`, los chips laterales (`height: 25px`) y el texto `FILTRO ESTADO:` se alineaban verticalmente con el punto medio de los 52px (es decir, en el espacio entre la etiqueta "Estados" y el selector), provocando que los chips flotaran en la parte superior y quedaran completamente desalineados respecto al trigger.
- Solución:
  1. En `src/modules/reports/ReportsVentas.jsx`:
     - Se añadió la propiedad `hideLabel` y `wrapperStyle={{ display: 'inline-flex' }}` al `MultiSelect` de `statusFilter`.
     - Esto eliminó el texto duplicado "Estados" y ajustó la altura total del componente a los 32px exactos del trigger, permitiendo que `FILTRO ESTADO:`, el selector de estados y los chips se alineen limpiamente en una sola línea horizontal uniforme.
  2. En `tests/reports-ventas-columns.test.mjs`: Se incorporó una prueba unitaria para verificar la presencia de `hideLabel` en el `MultiSelect` de estados.
- Validación: 141 pruebas automáticas superadas (`node --test tests/*.test.mjs`), build limpio de producción (versión `2.1.212`).

### Solución: Rediseño Bento Ejecutivo del Reporte de Ventas de Habitaciones (`ReportsVentasHabitaciones.jsx`, `reports.css`, `tests/reports-ventas-habitaciones.test.mjs`) (2026-10-13)
- Requerimiento:
  Rediseñar el módulo del Reporte de Ventas de Habitaciones para adaptarlo con máxima fidelidad a la imagen de referencia:
  1. Encabezado institucional Bento: tarjeta blanca con icono de casita esmeralda (`<Home />`), título con badge pill `Live`, subtítulo descriptivo, botón `Volver a Reportes` (outline gris) y botón `Exportar a Excel` (verde esmeralda).
  2. Cuadrícula de 4 KPI Cards Bento: Ingresos Totales Hospedaje (con badge verde `100% cobrado` y leyenda de período), Noches Vendidas (icono calendario azul), Habitaciones Reservadas (icono lavanda/cama) y Ticket Promedio / Noche (icono ámbar tendencia).
  3. Barra de filtros Bento en 4 columnas: Período Fiscal (con selector nativo transparente y etiqueta en español formateada ej. "octubre de 2026"), Vendedor (`Todos los Vendedores`), Tipo de Habitación (`Todos los Tipos de Habitación`), y Búsqueda Rápida con lupa y botón reactivo para limpiar.
  4. Dos paneles analíticos lado a lado (grid 2 columnas):
     - `Ingresos por Tipo de Habitación` con badge de categorías, montos en verde, barras de progreso esmeralda y pie con participación neta y total.
     - `Rendimiento por Vendedor` con badge de ejecutivos, montos en azul real, barras de progreso azul y pie con comisión/cierre de ventas y total.
  5. Tabla Bento de Transacciones de Hospedaje: cabecera con punto verde indicador `●`, columnas estilizadas (No. Folio pill monospace, Huésped con avatar circular de iniciales y teléfono, Empresa pill suave, Fechas con pill verde menta `⏱ X noche(s)`, Habitación `Xx Tipo`, Vendedor con avatar circular azul, Total Facturado en monospace negrita y Estado en pill verde menta `● Confirmada`), y paginador numérico (`Mostrando X a Y de Z`, `Anterior`, números de página interactivos y `Siguiente`).
- Solución:
  1. En `src/modules/reports/reports.css`:
     - Se crearon las clases `.rhab-container`, `.rhab-header-card`, `.rhab-kpi-grid`, `.rhab-kpi-card`, `.rhab-filters-card`, `.rhab-split-grid`, `.rhab-panel-card`, `.rhab-table-card`, `.rhab-avatar-guest`, `.rhab-avatar-seller`, etc.
     - Se blindaron con alta especificidad (`body:not(.informes-theme)`) todos los botones (`.rhab-btn-excel`, `.rhab-btn-back`, `.rhab-page-nav-btn`, `.rhab-page-num-btn`, `.rhab-search-clear`) y controles de formulario (`.rhab-select`, `.rhab-search-input`) contra sobrescrituras de `design-system-scoped.css`.
  2. En `src/modules/reports/ReportsVentasHabitaciones.jsx`:
     - Se implementó la estructura de 5 bloques Bento, cálculo reactivo de iniciales `getInitials`, formateo de mes `formatMonthLabel`, paginación en cliente (`currentPage`, `pageSize = 10`, `paginatedReservas`), y exportación a Excel impecable.
  3. En `tests/reports-ventas-habitaciones.test.mjs`: Se incorporaron pruebas unitarias completas para blindar los 5 bloques Bento y el CSS.
- Validación: 141 pruebas automáticas superadas (`node --test tests/*.test.mjs`), build de producción limpio (versión `2.1.211`).

### Solución: Rediseño Compacto y Blindaje de Chips de Estado en Reporte de Ventas (`ReportsVentas.jsx`, `reports.css`, `tests/reports-ventas-columns.test.mjs`) (2026-10-13)
- Requerimiento / Síntoma:
  En la barra de filtros del Reporte de Ventas, los chips de estado activo (ej. `● Confirmado ✕`, `● Pre reserva ✕`) aparecían inflados, gigantescos y toscos, desentonando con el selector MultiSelect y los botones de preset de fecha.
- Causa raíz:
  La regla global `body:not(.informes-theme) button` en `design-system-scoped.css` aplicaba forzosamente `min-height: 40px` y `padding: 0 14px` a todos los botones. Al contener cada chip un botón interno `<button type="button">✕</button>` para remover el filtro, el botón se expandía a 40px de alto y más de 30px de ancho, estirando e inflando el contenedor padre `<span>` hasta convertirlo en una cápsula enorme.
- Solución:
  1. En `src/modules/reports/reports.css`:
     - Se crearon las clases `.rpt-filter-chip`, `.rpt-filter-chip-dot` y `.rpt-filter-chip-btn` con máxima especificidad (`body:not(.informes-theme) .rpt-filter-chip`, `body:not(.informes-theme) button.rpt-filter-chip-btn`).
     - Se forzó con `!important`: altura compacta de 25px (`height: 25px`), padding simétrico (`0 7px 0 9px`), tipografía refinada (11px, weight 700), punto indicador de 5x5px y botón circular de remoción de 15x15px (`padding: 0`, `margin: 0 0 0 1px`) con micro-hover (`scale(1.15)`) y opacidad suave.
  2. En `src/modules/reports/ReportsVentas.jsx`:
     - Se aplicaron las clases `.rpt-filter-chip`, `.rpt-filter-chip-dot` y `.rpt-filter-chip-btn` con estilos inline protectores en los chips de estados (`statusFilter`), vendedores (`userFilter`) y salones (`salonFilter`).
  3. En `tests/reports-ventas-columns.test.mjs`: Se incorporó prueba unitaria para verificar la presencia de las clases compactas y el blindaje en CSS y JSX.
- Validación: 139 pruebas automáticas superadas (`node --test tests/*.test.mjs`), build limpio de producción (versión `2.1.210`).

### Solución: Blindaje de Inputs Controlados contra Prop Null al Editar Reservas (`HabitacionModal.jsx`, `tests/habitaciones-system.test.mjs`) (2026-10-13)
- Requerimiento / Síntoma:
  Al presionar "Editar" en una reserva de habitación, la consola de React mostraba:
  `'value' prop on 'input' should not be null. Consider using an empty string to clear the component or 'undefined' for uncontrolled components.`
  `A component is changing a controlled input to be uncontrolled. This is likely caused by the value changing from a defined to undefined... at HabitacionModal.jsx:401`
- Causa raíz:
  En MariaDB, las columnas opcionales de una reserva (`correo`, `telefono`, `no_folio`, `observaciones`, `empresa_nombre`, `modulo`) se almacenan como `NULL`. Al abrir el modal para editar, `HabitacionModal.jsx` ejecutaba `setFormData({ ...initialData })` directamente, propagando los valores `null` en el estado `formData`. Al renderizarse el `<input type="email" value={formData.correo} />`, React 19 detectó una prop `value={null}`, disparando la advertencia de componente controlado inválido y provocando desincronización de estado controlado a no controlado.
- Solución:
  1. En `src/modules/habitaciones/HabitacionModal.jsx`:
     - En el `useEffect` de carga de `initialData`, se normalizaron de forma explícita todos los campos usando coalescencia nula (`correo: initialData.correo ?? ''`, `telefono: initialData.telefono ?? ''`, `observaciones: initialData.observaciones ?? ''`, etc.), impidiendo la entrada de `null` en el estado del formulario.
     - En todos los `<input>`, `<select>` y `<textarea>` del formulario se agregaron salvaguardas directas en sus props `value={formData.xxx ?? ''}` (y `?? 0` para valores numéricos), garantizando que ningún input reciba jamás `null` ni `undefined`.
  2. En `tests/habitaciones-system.test.mjs`: Se incorporó prueba unitaria que verifica la sanitización de `initialData` y las props `value` seguras en `HabitacionModal.jsx`.
- Validación: 138 pruebas automáticas superadas (`node --test tests/*.test.mjs`), build limpio de producción (versión `2.1.209`).

### Solución: Corrección de Diseño de Botón de Cerrar y Buscador Bento en Lanzar Ofertas y Promociones (`HabitacionCampanaModal.jsx`, `habitaciones.css`, `tests/habitaciones-system.test.mjs`) (2026-10-13)
- Requerimiento:
  1. En el encabezado morado de Lanzar Ofertas o Promociones, el botón de cerrar aparecía distorsionado/aplastado como un círculo con un punto diminuto sin la 'X' visible.
  2. En la barra de progreso, el textbox de buscar cliente salía con la lupa (`Search`) montada directamente encima de las letras del texto placeholder "Buscar cliente...", con bordes toscos y sin botón de limpieza.
- Causa raíz:
  1. La regla global `body:not(.informes-theme) button` en `design-system-scoped.css` aplicaba `padding: 0 14px`, `min-height: 40px` y `background: var(--ui-surface-muted)`. En un botón con ancho fijo de 32px, el padding horizontal de 14px redujo el espacio interior a solo 4px de ancho utilizable, aplastando el SVG `<X />` hasta verse como un punto vertical diminuto.
  2. En `habitaciones.css`, la regla `body:not(.informes-theme) input.hab-input:not(.hab-search-input)` aplicaba `padding: 8px 12px !important;`. Al tener `.hab-input` sin la clase `.hab-search-input`, el selector con `!important` anulaba el `paddingLeft: 34` inline, forzando que el placeholder arrancara a los 12px desde la izquierda, coincidiendo exactamente con la coordenada de la lupa (`left: 12px`).
- Solución:
  1. En `src/modules/habitaciones/habitaciones.css`:
     - Se creó la clase `.hab-campana-close-btn` con máxima especificidad (`body:not(.informes-theme) button.hab-campana-close-btn`), forzando con `!important`: `width: 36px`, `height: 36px`, `padding: 0`, `margin: 0`, `background: rgba(255, 255, 255, 0.2)`, `border: 1px solid rgba(255, 255, 255, 0.35)`, `borderRadius: 11px`, `color: #ffffff`, micro-hover (`scale(1.06)`) y dimensiones explícitas de 20x20px en el SVG interior para garantizar que la 'X' sea nítida y perfectamente centrada.
     - Se crearon las clases `.hab-campana-search-wrap` y su foco temático en violeta `#7c3aed`.
  2. En `src/modules/habitaciones/HabitacionCampanaModal.jsx`:
     - Se conectó `hab-campana-close-btn` en el botón superior con `<X size={20} strokeWidth={2.5} color="#ffffff" />`.
     - Se transformó el buscador en un componente Bento fluido (`.hab-search-wrap hab-campana-search-wrap`) con `.hab-search-icon` alineado (`left: 14`), input `.hab-input hab-search-input` con `padding-left: 42px !important` inmune a solapamientos, y botón reactivo `.hab-search-clear` para vaciar el texto.
     - Se refinó el botón inferior "Cerrar Panel" con sombra suave y estilo ejecutivo Bento.
  3. En `tests/habitaciones-system.test.mjs`: Se incorporaron validaciones para `.hab-campana-close-btn`, `.hab-campana-search-wrap` y `.hab-search-clear`.
- Validación: 137 pruebas automáticas superadas (`node --test tests/*.test.mjs`), build limpio de producción (versión `2.1.208`).

### Solución: Campañas de Marketing y Ofertas por Segmento de Cliente (WhatsApp, Correo, Flyers e Integridad Blindada) (`HabitacionCampanaModal.jsx`, `HabitacionContactModal.jsx`, `SettingsHabitaciones.jsx`, `HabitacionesModule.jsx`, `habitacionesController.js`, `habitacionesRoutes.js`, `server.cjs`, `habitaciones.css`, `habitaciones-system.test.mjs`) (2026-10-13)
- Requerimiento:
  1. Permitir el envío de promociones y ofertas (no solo confirmación de reservas) por WhatsApp y Correo a clientes de habitaciones, guardándolos en base de datos para marketing.
  2. Ofrecer soporte para fotografías o flyers promocionales adjuntos con sugerencias de valor agregado (copia directa al portapapeles para WhatsApp Web y enlace al catálogo).
  3. Clasificar a clientes y empresas por segmento/sector (ej. Bancos, ONGs, Corporativo, Gobierno, Turismo, etc.).
  4. Agregar en Configuración la administración de estos segmentos con integridad referencial (no poder eliminar sectores en uso en reservas) y capacidad de lanzar campañas dirigidas a un sector específico.
- Solución:
  1. En `server.cjs` y base de datos:
     - Migración que extiende `habitacion_catalogos` con `tipo_plantilla VARCHAR(50) DEFAULT 'confirmacion'` e `imagen_url TEXT NULL`.
     - Semillas para `tipos_cliente` ("Bancos", "ONGs", "Corporativo", "Gobierno", "Turismo", "Agencias") y plantilla de promoción `cat_pl_promo_1` ("Oferta Especial de Temporada").
  2. En `backend/src/controllers/habitacionesController.js` y `habitacionesRoutes.js`:
     - Endpoint `GET /api/habitaciones/campanas/segmento/:idSegmento` (`getCampanaClientesPorSegmento`): consulta y agrupa clientes únicos con teléfono, correo, historial de estancias y último contacto filtrados por el sector.
     - Endpoint `POST /api/habitaciones/catalogos/upload-imagen` (`uploadPromocionImagen`): recibe imágenes rasterizadas con `multer` y genera `dataUrl` en base64 de alta fidelidad. También soporta payloads JSON directos `{ dataUrl }` y fallback en `createCatalogoItem` para prevenir falsos 400 por colisión de categoría `upload-imagen`.
     - Integridad referencial reforzada: `deleteCatalogoItem` y `getCatalogoItemUsage` verifican `categoria === 'tipos_cliente'` consultando `habitacion_reservas WHERE id_tipo_cliente = ? OR tipo_cliente_nombre = ?` respondiendo `409 Conflict` si el segmento está en uso.
  3. En `src/services/api.js` y `src/services/habitacionesService.js`:
     - `api.js` soporta `FormData` de forma nativa sin serialización forzada a JSON ni sobrescritura de `Content-Type`, y expone `api.postForm`.
     - `uploadPromocionImagenApi` implementa arquitectura resiliente de lectura inmediata con `FileReader` y subida dual a backend, garantizando que el usuario siempre obtenga la URL de imagen sin bloqueos.
  4. En `src/modules/settings/SettingsHabitaciones.jsx`:
     - Pestaña renombrada formalmente a "Segmentos de Cliente" (`tipos_cliente`).
     - Soporte completo en el formulario de plantillas para propósito (Confirmación vs Promoción / Oferta), uploader y preview de flyer promocional, y catálogo de variables dinámicas (`{segmento}`, `{descuento}`, `{vigencia}`, `{enlace_promo}`).
  5. En `src/modules/habitaciones/HabitacionContactModal.jsx`:
     - Selector de propósito (Confirmación de Reserva vs Oferta / Promoción) con ajuste de variables dinámicas.
     - Soporte para flyer con visor Bento y botón `copyImageToClipboard` (conversión automática a `image/png` para pegar con `Ctrl+V` directamente en WhatsApp Web).
  6. En `src/modules/habitaciones/HabitacionCampanaModal.jsx`:
     - Componente Bento para campañas dirigidas por segmento: selector de sector, selector de plantilla de promo, edición de variables en vivo, visor y uploader de flyer.
     - Conteo y búsqueda rápida de clientes del sector con barra de progreso interactiva ("X de Y contactados").
     - Tarjetas Bento individuales por cliente con iniciales armónicas, estancias históricas y botones rápidos de WhatsApp (abre chat con mensaje personalizado y copia flyer al portapapeles) y Correo (abre cliente con asunto y cuerpo).
  7. En `src/modules/habitaciones/HabitacionesModule.jsx` y `habitaciones.css`:
     - Botón Bento "Lanzar Promoción" (`.hab-btn-campana` en degradado violeta/índigo `#7c3aed`) en el encabezado superior con adaptación responsive para móvil.
     - Selector de "Segmento de Cliente" en el modal de Filtros Avanzados para filtrar reservas por sector.
  8. En `tests/habitaciones-system.test.mjs`: Se incorporó prueba unitaria exhaustiva validando las nuevas rutas, integridad referencial de segmentos, plantillas con flyer y apertura de campañas.
- Validación: 137 pruebas automáticas superadas (`node --test tests/*.test.mjs`), columnas `tipo_plantilla` e `imagen_url` (MEDIUMTEXT) aplicadas en MariaDB mediante migración de startup en `server.cjs`, build limpio de producción (versión `2.1.207`).

### Solución: Corrección de Desborde Móvil y Selector Bento de Período Anti-Colisiones (`habitaciones.css`, `HabitacionesModule.jsx`, `habitaciones-system.test.mjs`) (2026-10-13)
- Requerimiento: Resolver defectos visuales en la versión móvil de Ingreso y Ventas de Habitaciones:
  1. El icono verde de la camita y el encabezado superior se desbordaban horizontalmente hacia la derecha (el título, badge y botones "Exportar a Excel" y "Nueva Reserva" se cortaban en pantallas pequeñas).
  2. En "Período de Análisis", aparecían dos iconos de calendario y el icono de Lucide quedaba montado directamente tapando las letras "oc" de "octubre de 2026".
- Causa raíz:
  1. `.hab-brand-box` no tenía `min-width: 0` ni `word-break: break-word` en el bloque de texto del encabezado, y los botones de acción tenían texto largo con `white-space: nowrap` forzando un ancho superior a 390px que desbordaba el viewport móvil.
  2. El campo `<input type="month">` en navegadores webkit pinta su propio icono nativo a la derecha y alinea el texto del mes a la izquierda; la presencia simultánea de un `<Calendar size={15}>` posicionado absolutamente en `left: 11px` colisionaba directamente sobre el texto nativo, generando un doble icono y texto ilegible.
- Solución:
  1. En `src/modules/habitaciones/habitaciones.css`:
     - Se crearon las clases `.hab-month-picker-wrap`, `.hab-month-picker-text` y `.hab-month-native-input` (input nativo superpuesto con `opacity: 0; position: absolute; inset: 0; cursor: pointer;`), permitiendo un diseño Bento impecable con un solo icono verde esmeralda visible, texto limpio ("Octubre de 2026") y flecha desplegable (`ChevronDown`), abriendo reactivamente el selector nativo al tocar cualquier parte.
     - En `@media (max-width: 768px)`: se aseguraron `overflow-x: hidden`, `min-width: 0`, `word-break: break-word` para `.hab-brand-title` y se configuraron las clases adaptativas `.hab-btn-label-desktop` y `.hab-btn-label-mobile` ("+ Nueva Reserva" en móvil) junto a un grid simétrico de 2 columnas para los botones de acción superior.
  2. En `src/modules/habitaciones/HabitacionesModule.jsx`:
     - Se envolvieron el título y la descripción en `.hab-brand-info` y las acciones en `.hab-header-right`.
     - Se reemplazó el input de período por el componente Bento `.hab-month-picker-wrap` con capitalización elegante del mes.
  3. En `tests/habitaciones-system.test.mjs`: Se agregaron aserciones para verificar el selector de mes Bento y las clases anti-desborde móvil.
- Validación: 136 pruebas automáticas superadas (`node --test tests/*.test.mjs`), build limpio de producción (versión `2.1.202`).

### Solución: Rediseño Ejecutivo Bento de Ingreso y Ventas de Habitaciones (Socket.IO en Vivo, 5 KPIs, Filtros Avanzados, Paginador Numérico y Tarjetas Móviles) (`HabitacionesModule.jsx`, `habitacionesController.js`, `habitaciones.css`, `habitaciones-system.test.mjs`) (2026-10-13)
- Requerimiento: Mejorar sustancialmente el diseño visual del módulo de Ingreso y Ventas de Habitaciones adaptándolo 100% a las maquetas de referencia Desktop y Mobile provistas por el usuario:
  1. Conectar Socket.IO en tiempo real con indicador "● En Vivo - Sincronizado" pulsante y marca temporal de última actualización.
  2. Implementar las 5 KPI Cards Bento (Ingresos con % de meta y barra de progreso, Habitaciones Vendidas, Noches Vendidas con ticket promedio, Huéspedes Recurrentes VIP, Tasa de Ocupación con ADR diario basado en capacidad estándar de 24 habitaciones).
  3. Reestructurar la barra de filtros eliminando el botón "Restablecer" y proveyendo 4 selectores superiores (Período, Vendedor, Tipo, Estado) y botón Bento "Filtros" con modal emergente para filtros avanzados (Módulo, Forma de Pago, Empresa y rango de fechas exacto).
  4. Rediseñar la tabla Desktop con mayor contraste y color Bento: Folio dark pill (`#0f172a`), avatares con iniciales armónicas, pastillas suaves para empresa y canal, monto destacado en verde esmeralda y botones de acción temáticos.
  5. Agregar barra de paginación numérica (`Mostrando X - Y de Z`, selector de 10/25/50 y botones numéricos `< 1 2 3 ... >`).
  6. Adaptar la visualización para dispositivos móviles (< 768px) transformando automáticamente la tabla en tarjetas Bento individuales de Folios Activos con acciones rápidas de llamada y WhatsApp.
- Solución:
  1. En `backend/src/controllers/habitacionesController.js`: Se aseguraron emisiones de Socket.IO `emitChange(req, 'habitaciones', ...)` en `createHabitacion`, `updateHabitacion`, `deleteHabitacion`, `registrarContacto`, `createCatalogoItem`, `updateCatalogoItem`, `deleteCatalogoItem` y `updateMetas`.
  2. En `src/modules/habitaciones/HabitacionesModule.jsx`:
     - Se integró `socketService` escuchando `entity:changed` y `state-updated` para recargar reactivamente datos en segundo plano sin parpadeos, reflejando el estado de conexión y hora de última sincronización.
     - Se calculó la Tasa de Ocupación, ADR, meta mensual y conteo de suites para alimentar las 5 KPI Cards Bento con barras de progreso animadas.
     - Se configuró la paginación con estado `currentPage` y `pageSize`, calculando páginas de forma reactiva.
     - Se implementó el modal emergente para filtros avanzados adicionales y se removió el botón "Restablecer".
     - Se diseñó la vista responsiva móvil de Folios Activos Bento con avatares, pastillas de estado y atajos de contacto.
  3. En `src/modules/habitaciones/habitaciones.css`: Se crearon las clases `.hab-sync-badge`, `.hab-sync-dot` con `@keyframes habPulseDot`, `.hab-kpi-grid-5`, `.hab-kpi-card-bento`, `.hab-folio-pill`, `.hab-avatar`, `.hab-status-pill`, `.hab-pagination-container`, `.hab-page-btn` y la sección responsive `@media (max-width: 768px)` para `.hab-mobile-folios-card`.
  4. En `tests/habitaciones-system.test.mjs`: Se incorporó prueba unitaria para validar la integración de Socket.IO, las 5 KPIs Bento, paginación numérica y diseño móvil de Folios Activos.
- Validación: 136 pruebas automáticas superadas (`node --test tests/*.test.mjs`), build limpio de producción (versión `2.1.201`).

### Solución: Blindaje de Contraste y Color en Botones de Habitaciones contra Sobrescritura de design-system-scoped (`habitaciones.css`, `HabitacionesModule.jsx`, `HabitacionModal.jsx`, `HabitacionContactModal.jsx`, `ReportsVentasHabitaciones.jsx`, `habitaciones-system.test.mjs`) (2026-10-13)
- Requerimiento: Resolver defecto visual donde los botones "Exportar a Excel", "Nueva Reserva", "Cancelar" y "Registrar Reserva" aparecían descoloridos (fondo gris/celeste muy claro `#eef2f8` con texto blanco, casi invisibles e ilegibles), y eliminar el símbolo `+` duplicado en "+ + Nueva Reserva".
- Causa raíz: En `src/styles/design-system-scoped.css` (línea 103), la regla global `body:not(.informes-theme) button` posee especificidad `(0, 1, 2)`, aplicando `background: var(--ui-surface-muted)` (`#eef2f8`). Mientras que `color: #ffffff !important` se mantenía en los botones de habitaciones, la falta de mayor especificidad en las propiedades de `background`, `background-color` y `background-image` provocó que el CSS global sustituyera el color corporativo por el fondo claro, resultando en texto blanco sobre fondo blanco.
- Solución:
  1. En `src/modules/habitaciones/habitaciones.css`: Se reforzaron las reglas CSS con máxima especificidad (`body:not(.informes-theme) .hab-container button.hab-btn-primary`, `body:not(.informes-theme) button.hab-btn-primary`, `.hab-btn-primary`, etc.) forzando con `!important`: `background`, `background-color`, `background-image`, `color`, `border` y `box-shadow` tanto en estado base como en `:hover` y `:active` para `.hab-btn-excel` (Verde Excel), `.hab-btn-primary` (Azul Zafiro), `.hab-btn-submit` (Verde Esmeralda), `.hab-btn-cancel` (Gris Neutro con texto legible `#334155`) y `.hab-action-btn` (WhatsApp, Email, Edit, Delete).
  2. En `HabitacionesModule.jsx`, `HabitacionModal.jsx`, `HabitacionContactModal.jsx` y `ReportsVentasHabitaciones.jsx`: Se inyectaron estilos en línea directos (`style={{ ... }}`) como escudo infalible y se importó `habitaciones.css` en `HabitacionModal.jsx`.
  3. En `HabitacionesModule.jsx`: Se corrigió el texto de `<span>+ Nueva Reserva de Habitación</span>` a `<span>Nueva Reserva de Habitación</span>`, evitando la duplicación visual con el icono `<Plus />`.
- Validación: 135 pruebas automáticas superadas (`node --test tests/*.test.mjs`), build limpio de producción (versión `2.1.200`).

### Solución: Rediseño Ejecutivo de Botones de Acción (WhatsApp, Email, Edit, Delete) y Botones Temáticos (Excel, Nueva Reserva, Cancelar, Registrar) (`habitaciones.css`, `HabitacionesModule.jsx`, `HabitacionModal.jsx`, `HabitacionContactModal.jsx`, `ReportsVentasHabitaciones.jsx`, `habitaciones-system.test.mjs`) (2026-10-13)
- Requerimiento: Rediseñar los botones de acción de fila (mensaje WhatsApp, correo, editar, bote de basura) que lucían planos y toscos, mejorando su diseño con Bento action pills, colores pastel vibrantes y micro-animaciones al hacer hover. Además, asignar colores corporativos temáticos a los botones de "Exportar a Excel" (verde corporativo de Excel), "Nueva Reserva" (azul cielo zafiro), "Cancelar" (gris neutro refinado) y "Registrar Reserva / Guardar Cambios" (verde esmeralda radiante).
- Causa raíz:
  1. En `src/modules/habitaciones/habitaciones.css`, `.hab-action-btn` carecía de dimensiones fijas, bordes sutiles y fondos base (`background: none; border: none; padding: 6px;`), provocando un aspecto apagado y comprimido en la tabla de reservas.
  2. Los botones de exportar y cancelar usaban estilos neutros o genéricos sin jerarquía visual ni distinción semántica clara.
- Solución:
  1. En `src/modules/habitaciones/habitaciones.css`:
     - Se crearon las clases Bento `.hab-action-group` y `.hab-action-btn` con `width: 34px`, `height: 34px`, `borderRadius: 9px`, micro-elevación suave (`translateY(-2px)`) y sombras exclusivas para cada acción: Verde Esmeralda para WhatsApp (`#ecfdf5`, `#a7f3d0`, `#16a34a`), Azul Royal para Correo (`#eff6ff`, `#bfdbfe`, `#2563eb`), Azul Celeste para Editar (`#f0f9ff`, `#bae6fd`, `#0284c7`) y Rojo Coral para Cancelar/Eliminar (`#fef2f2`, `#fecaca`, `#ef4444`).
     - Se implementó `.hab-btn-excel` con degradado verde Excel (`#107c41` → `#059669`), bordes precisos y sombra verde corporativa.
     - Se fortaleció `.hab-btn-primary` para "Nueva Reserva" con degradado azul zafiro (`#0284c7` → `#0369a1`).
     - Se definió `.hab-btn-submit` para "Registrar Reserva" / "Guardar Cambios" con degradado esmeralda radiante (`#059669` → `#10b981`) y `.hab-btn-cancel` para modales con estilo neutral ejecutivo.
  2. En `HabitacionesModule.jsx`, `HabitacionModal.jsx`, `HabitacionContactModal.jsx` y `ReportsVentasHabitaciones.jsx`:
     - Se conectó `hab-action-group` en la tabla de reservas con tooltips explicativos y strokes nítidos en los íconos de Lucide.
     - Se integró `hab-btn-excel` con ícono `FileSpreadsheet` / `Download`.
     - Se aplicaron `hab-btn-cancel` y `hab-btn-submit` en los pies de página de los modales.
  3. En `tests/habitaciones-system.test.mjs`: Se incorporó prueba unitaria para verificar las 4 variantes de `.hab-action-btn`, `.hab-btn-excel`, `.hab-btn-submit`, `.hab-btn-cancel` y su consumo en los módulos.
- Validación: 135 pruebas automáticas superadas (`node --test tests/*.test.mjs`), build limpio de producción (versión `2.1.198`).

### Solución: Pestañas Bento con Colores Temáticos Diferenciados y Diseño Anti-Recorte en Configuración de Habitaciones (`SettingsHabitaciones.jsx`, `habitaciones-system.test.mjs`) (2026-10-13)
- Requerimiento: Resolver defecto visual donde las letras al final de los botones de las pestañas en el centro de configuración de habitaciones se cortaban o salían apretadas contra el borde derecho (ej. la 'o' en Medios de Contacto, la 'n' en Tipos de Habitación, la 's' en Metas de Habitaciones), y asignar un color distintivo propio a cada una de las 7 pestañas.
- Causa raíz: Los botones de las pestañas no contaban con `flex-shrink: 0`, tenían un padding horizontal reducido (`8px 14px`) y carecían de `box-sizing: border-box`, provocando que en anchos reducidos el flex container horizontal comprimiera los botones recortando el texto en los bordes y ocultando los badges de los íconos.
- Solución:
  1. En `src/modules/settings/SettingsHabitaciones.jsx`:
     - Se dotó a cada pestaña en `TABS` de su paleta cromática exclusiva (`color`, `bgActive`, `borderActive`, `bgBadge`, `badgeColor`): Sky Blue para Medios de Contacto, Esmeralda para Tipos de Habitación, Púrpura para Módulos / Sectores, Ámbar para Tipos de Cliente, Teal para Formas de Pago, Rose para Plantillas Mensajes e Índigo para Metas de Habitaciones.
     - Se rediseñaron los botones con `display: inline-flex`, `flexShrink: 0`, `padding: 10px 18px`, `borderRadius: 12`, `boxSizing: border-box`, y un badge contenedor de ícono Bento (`26x26px`, `borderRadius: 8`) con el ícono Lucide siempre visible y nítido.
     - Se conectaron dinámicamente el avatar de cabecera superior, el botón "+ Agregar a..." y los botones de guardado para adoptar el color temático de la pestaña activa.
  2. En `tests/habitaciones-system.test.mjs`: Se incorporó prueba unitaria para verificar la paleta de colores temáticos de cada pestaña, `flexShrink: 0`, padding holgado y badge de ícono.
- Validación: 134 pruebas automáticas superadas (`node --test tests/*.test.mjs`), build limpio de producción (versión `2.1.196`).

### Solución: Catálogo CRUD de Módulos/Sectores, Protección de Integridad Referencial y Selector Desplegable (`server.cjs`, `habitacionesController.js`, `SettingsHabitaciones.jsx`, `HabitacionesModule.jsx`, `HabitacionModal.jsx`, `habitaciones-system.test.mjs`) (2026-10-13)
- Requerimiento: Convertir el campo `Módulo / Sector` en una lista desplegable (`<select>`) igual que Vendedor y Tipo de Habitación en el modal de reserva, y habilitar su catálogo CRUD completo en el panel de configuración de habitaciones (`SettingsHabitaciones.jsx`) con protección de integridad referencial para impedir la eliminación si el módulo ya está asignado a reservas.
- Solución:
  1. En `server.cjs`: Se añadieron semillas predeterminadas para la categoría `modulos` ("Módulo Jardín", "Módulo Lago", "Módulo Principal", "Sector Cabañas") tanto en el bootstrap inicial como en bases de datos existentes si la categoría no cuenta con registros.
  2. En `backend/src/controllers/habitacionesController.js`: Se incorporó soporte para `categoria === 'modulos'` en `getCatalogos`, `getCatalogoItemUsage` y `deleteCatalogoItem`, calculando reactivamente el número de reservas asociadas mediante `r.modulo = c.nombre OR r.modulo = c.id`. Si el módulo está en uso (`usageCount > 0`), el endpoint responde `409 Conflict` bloqueando la eliminación.
  3. En `src/modules/settings/SettingsHabitaciones.jsx`: Se añadió la pestaña `Módulos / Sectores` con ícono `Layers` en `TABS`, permitiendo crear, editar descripción/orden y eliminar módulos con el modal Bento diseñado de protección de integridad (`ShieldAlert` y badge de candado).
  4. En `src/modules/habitaciones/HabitacionesModule.jsx`: Se integró la carga asíncrona de `modulos` en `loadAuxData` y se suministró al estado de `catalogos`.
  5. En `src/modules/habitaciones/HabitacionModal.jsx`: Se reemplazó el `<input type="text">` de `Módulo / Sector` por un `<select className="hab-select">` conectado a `catalogos.modulos`, con selección automática del primer módulo al crear y preservación de valores preexistentes al editar.
- Validación: 133 pruebas automáticas superadas (`node --test tests/*.test.mjs`), build limpio de producción (versión `2.1.194`).

### Solución: Unificación de Folio, Eliminación de no_reserva y solicito en BD/UI, y Alineación Perfecta de Monto Total (`server.cjs`, `habitacionesController.js`, `HabitacionModal.jsx`, `habitaciones.css`, `HabitacionesModule.jsx`, `ReportsVentasHabitaciones.jsx`, `HabitacionContactModal.jsx`, `SettingsHabitaciones.jsx`, `habitaciones-system.test.mjs`) (2026-10-13)
- Requerimiento:
  1. Conservar `No. Folio` como único identificador unificado y eliminar `No. Reserva` (`no_reserva`) tanto de la interfaz como de la base de datos MariaDB.
  2. Eliminar el campo `Solicitó (Detalle)` (`solicito`) de la interfaz y de la base de datos MariaDB.
  3. Corregir el desalineamiento visual del campo `Monto Total (Q)` en el modal de reserva respecto a `Tipo de Habitación` y `Tarifa Diaria (Q)`.
- Causa raíz:
  1. En `habitacion_reservas` existían redundantemente las columnas `no_reserva` y `solicito`, presentes en los queries SQL (`SELECT`, `INSERT`, `UPDATE`), formularios y tablas.
  2. En `HabitacionModal.jsx`, el contenedor de `Monto Total (Q)` incluía un `div flex` con un botón de auto-cálculo que tenía mayor altura de línea y padding nativo (~26px) en comparación con los simples `<label display: block; margin-bottom: 4>` (~16px) de `Tipo de Habitación` y `Tarifa Diaria`, empujando el input de monto total 10px hacia abajo. Además, el input total tenía `fontSize: 15` sin altura física explícita unificada con el `hab-select` y el `hab-input` adyacentes.
- Solución:
  1. En `server.cjs`: Se removieron `no_reserva` y `solicito` del esquema inicial de `habitacion_reservas` y se agregó una migración defensiva que ejecuta `ALTER TABLE habitacion_reservas DROP COLUMN no_reserva` y `DROP COLUMN solicito` verificando previamente su existencia en `information_schema.COLUMNS`. Las semillas de plantillas se actualizaron para usar `{no_folio}`.
  2. En `backend/src/controllers/habitacionesController.js`: Se erradicaron `no_reserva` y `solicito` de `getHabitaciones`, `getHabitacion`, `createHabitacion`, `updateHabitacion` y `getHuespedHistorial`, unificando las búsquedas y respuestas hacia `no_folio`.
  3. En `src/modules/habitaciones/habitaciones.css`: Se fijó `height: 38px !important; box-sizing: border-box !important;` tanto para `.hab-input`, `.hab-select` como para `.hab-input-total`.
  4. En `src/modules/habitaciones/HabitacionModal.jsx`:
     - Se estandarizó el encabezado de las 3 columnas de la fila de estancia (`Tipo de Habitación`, `Tarifa Diaria`, `Monto Total`) con `display: flex; align-items: center; justify-content: space-between; height: 20px; minHeight: 20px; marginBottom: 5px;` y los 3 controles con `height: 38px`, logrando alineación visual idéntica y simétrica.
     - En la sección "Control Comercial, Recepción y Folios", se eliminaron `No. Reserva (Voucher)` y `Solicitó (Detalle)` y se renombró `No. Folio Físico` a `No. Folio`, organizando los 6 campos restantes en una cuadrícula simétrica de 3 columnas (2 filas completas de 3 campos) sobre las Observaciones Internas.
  5. En `HabitacionesModule.jsx`, `ReportsVentasHabitaciones.jsx`, `HabitacionContactModal.jsx` y `SettingsHabitaciones.jsx`: Se homologó la visualización a `No. Folio`, se eliminó `solicito` y se actualizaron las plantillas y exportación a Excel.
- Validación: 132 pruebas automáticas superadas (`node --test tests/*.test.mjs`), build de producción limpio (versión `2.1.193`).

### Solución: Corrección Definitiva de Apilamiento, Fondo Claro e Integración Visual del Buscador de Habitaciones (`habitaciones.css`, `HabitacionesModule.jsx`, `ReportsVentasHabitaciones.jsx`, `habitaciones-system.test.mjs`) (2026-10-13)
- Requerimiento: Resolver defecto visual donde el ícono de la lupa (`Search`) salía tapado detrás del texto en el campo de búsqueda ("Buscar por huésped, voucher, folio, empresa...") y, al excluir la regla genérica de padding, el fondo del input heredaba el degradado oscuro de `global-scoped.css`.
- Causa raíz:
  1. En `src/modules/habitaciones/habitaciones.css`, la regla genérica `body:not(.informes-theme) .hab-container input` forzaba `padding: 8px 12px !important;`. Al excluirla con `:not(.hab-search-input)`, el input perdió el `background: #ffffff !important` de esa regla y fue capturado por `global-scoped.css` (degradado oscuro `#1e293b`).
  2. En el árbol DOM, el `<span className="hab-search-icon">` estaba posicionado antes del `<input>`, quedando la lupa tapada por el texto.
- Solución:
  1. En `src/modules/habitaciones/habitaciones.css`: Se blindó `.hab-search-input` con máxima especificidad fijando `background: #ffffff !important; background-color: #ffffff !important; background-image: none !important; color: #0f172a !important; color-scheme: light !important; border: 1px solid #cbd5e1 !important; padding-left: 46px !important; padding-right: 36px !important;`, junto a sus pseudoclases `:focus` y `::placeholder`. Para `.hab-search-icon`, se fijó `position: absolute !important; left: 14px !important; z-index: 10 !important; pointer-events: none !important;`.
  2. En `src/modules/habitaciones/HabitacionesModule.jsx` y `src/modules/reports/ReportsVentasHabitaciones.jsx`: Se reordenó el JSX colocando primero el `<input>` (con `backgroundColor: '#ffffff'`, `color: '#0f172a'` y `paddingLeft: 46`) y después el `<span className="hab-search-icon">`.
- Validación: 131 pruebas automáticas superadas (`node --test tests/*.test.mjs`), build de producción limpio (versión `2.1.192`).

### Solución: Corrección de ReferenceError en Inicialización de getDateRange en ReportsDashboard (`ReportsDashboard.jsx`, `habitaciones-system.test.mjs`) (2026-10-13)
- Requerimiento: Resolver error de tiempo de ejecución en consola `ReferenceError: Cannot access 'getDateRange' before initialization at ReportsDashboard (ReportsDashboard.jsx:241:7)` al cargar el Dashboard Principal en el apartado de reportes.
- Causa raíz: En `src/modules/reports/ReportsDashboard.jsx`, el `useEffect` que carga las ventas de habitaciones para consolidar en la meta global se encontraba posicionado antes de la declaración `const getDateRange = useCallback(...)`. Al inicializar el componente, el array de dependencias del efecto `[getDateRange]` intentó evaluar la variable mientras se encontraba en la Zona Muerta Temporal (Temporal Dead Zone - TDZ) de JavaScript, gatillando el `ReferenceError` capturado por el `ErrorBoundary`.
- Solución:
  1. En `src/modules/reports/ReportsDashboard.jsx`: Se reordenaron las declaraciones léxicas colocando las funciones auxiliares de fecha (`fmtShort`) y la función memorizada `getDateRange` antes del estado y efecto de `habitacionesTotal`.
  2. En `tests/habitaciones-system.test.mjs`: Se incorporó aserción estricta de orden de inicialización para prevenir regresiones por TDZ.
- Validación: 131 pruebas automáticas superadas (`node --test tests/*.test.mjs`), build limpio de producción (versión `2.1.189`).

### Solución: Protección de Integridad de Datos en Catálogos de Habitaciones y Modales de Confirmación Diseñados (`habitacionesController.js`, `habitacionesRoutes.js`, `habitacionesService.js`, `stateService.js`, `SettingsHabitaciones.jsx`, `HabitacionesModule.jsx`, `habitaciones-system.test.mjs`) (2026-10-13)
- Requerimiento: Proteger la integridad referencial de los catálogos en el Panel de Configuración de Habitaciones: si algún registro (tipo de habitación, medio de contacto, tipo de cliente, forma de pago) ya está siendo utilizado en reservas (`habitacion_reservas`), impedir su eliminación. Además, erradicar los mensajes de confirmación nativos del navegador (`window.confirm`) al eliminar o cancelar, reemplazándolos con modales de confirmación con diseño ejecutivo personalizado acorde a la estética Bento del CRM.
- Causa raíz:
  1. `habitacionesController.js` ejecutaba la desactivación del elemento sin verificar si el registro ya tenía reservas asociadas en `habitacion_reservas`.
  2. `SettingsHabitaciones.jsx` y `HabitacionesModule.jsx` invocaban `window.confirm(...)` nativo del navegador para pedir confirmación al usuario, mostrando el diálogo tosco de `localhost:5173 dice...`.
- Solución:
  1. En `backend/src/controllers/habitacionesController.js`:
     - En `getCatalogos`: Inyección reactiva de `usage_count` por subconsulta SQL para cada categoría de catálogo.
     - Nuevo endpoint `getCatalogoItemUsage`: Consulta en tiempo real de reservas asociadas por ID y nombre.
     - En `deleteCatalogoItem`: Validación estricta de integridad; si `usageCount > 0`, responde con `HTTP 409 Conflict` impidiendo la eliminación e informando la cantidad exacta de reservas vinculadas.
  2. En `backend/src/routes/habitacionesRoutes.js`, `src/services/habitacionesService.js` y `src/services/stateService.js`:
     - Registrado y expuesto `getCatalogoItemUsageApi(categoria, id)`.
  3. En `src/modules/settings/SettingsHabitaciones.jsx`:
     - Erradicado `window.confirm`.
     - Implementado modal diseñado `deleteModal` con animación suave y estética Bento.
     - Si el elemento tiene reservas vinculadas (`usageCount > 0`): Muestra alerta de "Protección de Integridad" con ícono `ShieldAlert` y `Lock`, detallando el número de reservas vinculadas y botón "Entendido, conservar registro".
     - Si el elemento no tiene reservas (`usageCount === 0`): Muestra modal de confirmación con verificación de integridad en verde ("✓ 0 dependencias activas") y botones estilizados de "Cancelar" y "Eliminar Elemento".
     - En la tabla de catálogo, indicador visual de reservas asociadas y candado de protección.
  4. En `src/modules/habitaciones/HabitacionesModule.jsx`:
     - Erradicado `window.confirm` en la cancelación de reservas, sustituido por modal diseñado `cancelModal`.
- Validación: 131 pruebas automáticas superadas (`node --test tests/*.test.mjs`), build limpio de producción (versión `2.1.188`).

### Solución: Compatibilidad de Métodos Atómicos en Utilidad Toast (`src/utils/toast.jsx`, `SettingsHabitaciones.jsx`, `habitaciones-system.test.mjs`) (2026-10-13)
- Requerimiento: Resolver error en tiempo de ejecución en consola `TypeError: toast.success is not a function at handleSaveCatalogItem (SettingsHabitaciones.jsx:178:15)` y posterior `TypeError: toast.error is not a function` al guardar un nuevo tipo de habitación o elementos del catálogo.
- Causa raíz: En `src/utils/toast.jsx`, la función exportada `toast(msg, options)` envolvía `react-hot-toast`, pero no exponía como propiedades estáticas los métodos de conveniencia `.success`, `.error`, `.warning`, `.info` y `.dismiss`. Al invocar `toast.success(...)`, el intérprete arrojaba `TypeError` al no ser funciones definidas en el objeto `toast`.
- Solución:
  1. En `src/utils/toast.jsx`: Se adjuntaron directamente al objeto de función `toast` los métodos `toast.success`, `toast.error`, `toast.warning`, `toast.info` (inyectando automáticamente la opción `type` respectiva) y `toast.dismiss(id)` apuntando a `toastLib.dismiss`. Además, se agregó exportación default `export default toast` para interoperabilidad total.
  2. En `tests/habitaciones-system.test.mjs`: Se incorporó prueba unitaria para verificar la existencia de todos los métodos atómicos de la utilidad.
- Validación: 130 pruebas automáticas superadas (`node --test tests/*.test.mjs`), build limpio de producción (versión `2.1.186`).

### Solución: Blindaje de Modo Claro en Inputs de Habitaciones y Reportería contra Estilos Oscuros Heredados (`habitaciones.css`, `HabitacionModal.jsx`, `SettingsHabitaciones.jsx`, `ReportsVentasHabitaciones.jsx`) (2026-10-13)
- Requerimiento: Resolver apariencia visual discordante donde en el nuevo modal de reserva de habitaciones, en la barra de filtros/búsqueda, en catálogos de configuración y en reportería de habitaciones, los campos de texto, fechas, correos, teléfonos y áreas de texto aparecían con fondo gris oscuro/negro (`#1e293b`) mientras otros campos numéricos y selectores eran blancos.
- Causa raíz: En la hoja de estilos global `src/styles/global-scoped.css` (línea 839), la regla `body:not(.informes-theme) input:not(...):not(...)` y `textarea` aplicaba con alta especificidad CSS un degradado oscuro `background: linear-gradient(180deg, rgba(30, 41, 59, 0.78), rgba(15, 23, 42, 0.72))` y texto claro, sobrepasando las clases básicas de los nuevos componentes.
- Solución:
  1. En `src/modules/habitaciones/habitaciones.css`: Se implementó la salvaguarda de alta especificidad para `.hab-container`, `.hab-modal-backdrop`, `.hab-modal-card`, `.hab-input` y `.hab-select` forzando `background: #ffffff !important`, `color: #0f172a !important`, `border: 1px solid #cbd5e1 !important`, `color-scheme: light !important`, placeholders claros y anillo de enfoque esmeralda `#059669`.
  2. En `HabitacionModal.jsx`: Se aplicaron las clases `.hab-input-total.is-auto` y `.is-manual` para conservar el resalte suave esmeralda/ámbar en el total de la reserva, y `.hab-company-item` para sugerencias con hover interactivo.
  3. En `SettingsHabitaciones.jsx` y `ReportsVentasHabitaciones.jsx`: Se importó `habitaciones.css` y se homologaron los inputs, selectores y textarea a las clases protegidas `.hab-input` y `.hab-select`.
- Validación: 129 pruebas automáticas superadas (`node --test tests/*.test.mjs`), build limpio de producción (versión `2.1.184`).

### Solución: Corrección de ReferenceError por Re-exportación en Ámbito Local de stateService (`stateService.js`, `habitaciones-system.test.mjs`) (2026-10-13)
- Requerimiento: Resolver error en tiempo de ejecución en consola del navegador `Uncaught ReferenceError: getHabitacionesApi is not defined at stateService.js:767:3`.
- Causa raíz: En `src/services/stateService.js`, se utilizaba la sintaxis de re-exportación directa `export { getHabitacionesApi, ... } from './habitacionesService';`. En la especificación ECMAScript, este tipo de exportación agregada no vincula los identificadores en el ámbito léxico del módulo actual. Al evaluar la constante `const stateService = { ... getHabitacionesApi ... }`, el motor de JavaScript lanzaba `ReferenceError` porque `getHabitacionesApi` no existía en el ámbito local.
- Solución:
  1. En `src/services/stateService.js`: Se importaron explícitamente todas las funciones desde `./habitacionesService` al inicio del archivo.
  2. Se expusieron en el objeto `stateService` por defecto y se exportaron como named exports.
  3. En `tests/habitaciones-system.test.mjs`: Se incorporó una prueba unitaria para verificar la importación y vinculación en ámbito sin errores.
- Validación: 129 pruebas automáticas superadas (`node --test tests/*.test.mjs`), build de producción completado en 3.25s (versión `2.1.181`).

### Solución: Implementación Integral del Módulo de Ingreso de Habitaciones y Metas Comerciales (`server.cjs`, `habitacionesController.js`, `habitacionesRoutes.js`, `habitacionesService.js`, `HabitacionesModule.jsx`, `HabitacionModal.jsx`, `HabitacionContactModal.jsx`, `SettingsHabitaciones.jsx`, `SettingsMain.jsx`, `ReportsModule.jsx`, `ReportsVentasHabitaciones.jsx`, `ReportsDashboard.jsx`, `ReportsProyeccionMetas.jsx`, `Sidebar.jsx`, `App.jsx`, `habitaciones-system.test.mjs`) (2026-10-13)
- Requerimiento: Implementar el módulo de ingreso de habitaciones acordado para el CRM de Jardines del Lago:
  1. Base de datos MariaDB: tablas `habitacion_reservas`, `habitacion_catalogos` (con semillas de medios de contacto, tipos de habitación con tarifas, tipos de cliente, formas de pago y plantillas) y `habitacion_metas` (metas mensuales globales y por vendedor).
  2. Endpoints backend: CRUD completo de reservas, catálogos, metas, directorio inteligente de huéspedes con historial por teléfono/correo, y registro de último contacto. Creación al vuelo de empresas en MariaDB.
  3. Configuración Frontend: `SettingsHabitaciones.jsx` conectado en `SettingsMain.jsx` con Bento tabs para gestionar los catálogos de habitaciones y sus metas.
  4. Módulo principal: `HabitacionesModule.jsx` en `/habitaciones` accesible desde el Sidebar (bajo Tablero Ocupación) con KPIs del mes, filtros, tabla con acciones rápidas, modal de reserva con cálculo reactivo de noches/totales y sobreescritura manual, modal interactivo de WhatsApp/Correo con plantillas dinámicas, y exportación a Excel.
  5. Reportería y metas: Renombrar en `ReportsModule.jsx` a "Reporte de Ventas de Eventos", crear "Reporte de Ventas de Habitaciones" (`ReportsVentasHabitaciones.jsx`), consolidar ingresos de habitaciones a la Meta Global Mensual en `ReportsDashboard.jsx` con desglose visual, e integrar selector de proyecciones (`Consolidado`, `Solo Eventos`, `Solo Habitaciones`) en `ReportsProyeccionMetas.jsx`.
- Solución:
  1. En `server.cjs`: Implementada migración `ensureHabitacionesStructure` registrada en `MIGRATIONS` y `CANONICAL_MIGRATIONS` que asegura la creación de `habitacion_reservas`, `habitacion_catalogos` con semillas predeterminadas, y `habitacion_metas`.
  2. En `backend/src/controllers/habitacionesController.js` y `backend/src/routes/habitacionesRoutes.js`: Endpoints REST atómicos protegidos con JWT. Montados en `backend/src/app_routes.js` bajo `/habitaciones`.
  3. En `src/services/habitacionesService.js` y `src/services/stateService.js`: Funciones atómicas de consumo de API y despacho de eventos en tiempo real.
  4. En `src/modules/settings/SettingsHabitaciones.jsx` y `src/modules/settings/SettingsMain.jsx`: Panel de configuración con sub-pestañas para medios de contacto, tipos de habitación (tarifas base), tipos de cliente, formas de pago, plantillas dinámicas con variables interactivas y metas mensuales.
  5. En `src/layouts/MainLayout/components/Sidebar.jsx` y `src/App.jsx`: Acceso a `/habitaciones` en menú móvil y desktop debajo de Tablero Ocupación con ícono `bed` y precarga lazy.
  6. En `src/modules/habitaciones/HabitacionesModule.jsx`, `HabitacionModal.jsx`, `HabitacionContactModal.jsx` y `habitaciones.css`: Módulo ejecutivo responsivo, detección de huéspedes frecuentes, creación de empresas al vuelo, cálculo reactivo de noches y total con sobreescritura manual, plantillas de WhatsApp/Correo y exportación a Excel con ExcelJS.
  7. En `src/modules/reports/ReportsModule.jsx`, `ReportsVentasHabitaciones.jsx`, `ReportsDashboard.jsx` y `ReportsProyeccionMetas.jsx`: Renombrado de ventas de eventos, nuevo reporte transaccional y analítico de habitaciones, suma consolidada a la meta global en el dashboard ejecutivo, y conmutador de proyecciones.
- Validación: 128 pruebas automáticas superadas (`node --test tests/*.test.mjs`), build de producción limpio (versión `2.1.180`).

### Solución: Auditoría Integral de Seguridad (Cloudflare Security Audit Skill) y Blindaje Defensivo del Backend (`server.cjs`, `events.js`, `catalogRoutes.js`, `platilloRoutes.js`, `tareasRoutes.js`, `userRoutes.js`, `imagenesRoutes.js`, `authService.js`, `socketService.js`, `security-audit-remediations.test.mjs`) (2026-10-13)
- Requerimiento: Instalar la habilidad de auditoría de seguridad de Cloudflare (`cloudflare/security-audit-skill`), adaptarla a entornos Windows, auditar exhaustivamente la aplicación y subsanar todas las vulnerabilidades detectadas en autenticación, autorización, CSP, Socket.IO, subida de archivos y fuerza bruta.
- Vulnerabilidades detectadas y remediadas:
  1. `auth.firebase.unverified_token_privilege_escalation` (Crítica): En `/api/auth/firebase`, el servidor confiaba en `uid` y `email` enviados directamente por el cliente en el cuerpo JSON sin verificar firmas criptográficas. Solucionado integrando verificación criptográfica con `jwt.verify` RS256 contra certificados públicos x509 de Google (`googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com`), con caché de 6 horas y extracción de identidad directamente desde el payload verificado.
  2. `auth.users.unprotected_management_endpoints` (Crítica): Endpoints de gestión de usuarios (`POST /api/users`, `DELETE /api/users/:id`, `PUT /api/users/:id/toggle-active`, `PUT /api/users/:id/equipo`) no tenían middleware de autenticación ni verificación de rol en `server.cjs`. Solucionado aplicando `authenticateJWT` y `requireRole("admin")`, además de restringir `PUT /api/users/:id` para impedir escalamiento de privilegios por usuarios no administradores.
  3. `api.state.unauthenticated_full_database_dump_and_overwrite` (Crítica): `GET /api/state` y `PUT /api/state` no requerían token, permitiendo a cualquier actor no autenticado extraer la base de datos completa de clientes, eventos y usuarios, o sobreescribirla. Solucionado exigiendo `authenticateJWT` en ambos endpoints y actualizando `MaintenancePage.jsx`.
  4. `xss.print_render.arbitrary_html_reflection` (Alta): En `/api/print/prepare` y `/api/print/render/:id`, se recibía y renderizaba HTML arbitrario sin cabeceras CSP. Solucionado requiriendo `authenticateJWT` en `/api/print/prepare` y configurando cabeceras `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline' https:; img-src data: https:; font-src https: data:;`, `X-Content-Type-Options: nosniff`, y `X-Frame-Options: SAMEORIGIN` en el renderizado.
  5. `auth.routes.unprotected_business_endpoints` (Alta): Los routers modulares ESM (`events.js`, `catalogRoutes.js`, `platilloRoutes.js`, `tareasRoutes.js`, `tareasSemanalesRoutes.js`) carecían de middleware de autenticación a nivel de router. Solucionado agregando `router.use(authenticate)` a todos ellos.
  6. `cors.socketio.unauthenticated_wildcard_exposure` (Media): Servidor Socket.IO utilizaba `origin: "*"` y no validaba tokens en el handshake. Solucionado limitando CORS a orígenes institucionales permitidos e inspeccionando el JWT en `io.use` para adjuntar `socket.user`.
  7. `upload.svg.unrestricted_extension_stored_xss` (Media): Filtro de multer en `imagenesRoutes.js` aceptaba archivos `.svg`, susceptibles a Stored XSS mediante tags `<script>`. Solucionado restringiendo estrictamente a formatos rasterizados (`jpg, jpeg, png, gif, webp, bmp`).
  8. `auth.password.plaintext_fallback_and_missing_rate_limit` (Baja): `/api/login` no limitaba intentos por IP y autenticaba contraseñas en texto plano legacy sin migrarlas. Solucionado agregando rate limiting de 10 intentos por ventana de 5 minutos en memoria y auto-migración transparente a `scrypt$` con sal criptográfica en MariaDB al iniciar sesión.
- Validación: 119 pruebas automáticas superadas (`node --test tests/*.test.mjs`), reportes formales generados y validados con los esquemas de Cloudflare, y compilación limpia de producción.

### Solución: Blindaje Antidesfase Granular, Autopodado de Días Vacíos y Guardado sin Transferir Funcional (`eventsController.js`, `informeController.js`, `ReservationForm.jsx`, `InformeTransferModal.jsx`, `informes-conflict-guard.test.mjs`) (2026-10-10)
- Requerimiento: Resolver error donde al modificar fechas o salones de una reserva (ej. reducir Casa Flores 06 del 16 al 14 de octubre), el sistema detectaba informes con conflicto e impedía guardar con "Guardar sin Transferir" arrojando un error HTTP 409 Conflict. Además, si el usuario confirmaba la reserva, el modal preseleccionaba por defecto reasignar a un salón disponible en otra fecha (ej. No usa Salon al 12 de octubre), moviendo la fecha y salón del informe contra la voluntad del usuario. Si los días retirados de la reserva no tenían comida ni montajes en el informe (días vacíos), el sistema debía permitir guardar sin transferir sin interrumpir ni dar error; y si tenían contenido, permitir elegir si mover de salón o eliminar solo ese día huérfano del informe sin alterar los demás días válidos.
- Causa raíz:
  1. En `backend/src/controllers/eventsController.js`: el blindaje antidesfase trataba cualquier fila en `informe_dias_detalle` como un conflicto crítico, incluso si el día estaba completamente vacío (sin menú, sin platillos en `items_tiempo_comida`, y sin montajes personalizados).
  2. Si el usuario hacía clic en "Guardar sin Transferir", `ReservationForm.jsx` enviaba `informeResolutions: null`, provocando que el backend lo interpretara como un conflicto no resuelto y rechazara con `HTTP 409 Conflict: La modificación desvincula fechas o salones con informes de evento activos`.
  3. `InformeTransferModal.jsx` inicializaba todas las resoluciones con `action: 'reassign'` y, si no había un salón en la misma fecha, tomaba el primer slot disponible (`availableSlots[0]`), cambiando silenciosamente la fecha del informe al guardar.
  4. La acción `delete` en `informeController.js` ejecutaba un soft delete de TODO el informe (`UPDATE informes_eventos SET estado = 'eliminado'`), en lugar de eliminar de forma granular únicamente el día desvinculado en `informe_dias_detalle`.
- Solución:
  1. En `backend/src/controllers/informeController.js`:
     - En `checkEventInformes`: cálculo de bandera `isEmpty` para cada día evaluando ausencia de menú, montajes activos y platillos de comida.
     - En `applyInformeResolutionsInternal`: soporte granular para `diaId` en acciones `delete` y `delete_day`. Si el informe tiene más de un día, ejecuta `DELETE FROM informe_dias_detalle WHERE id = ? AND informe_id = ?` con auditoría `DIA_ELIMINADO`, preservando intactos los demás días del evento. Solo si era el único día se archiva o elimina el informe completo.
  2. En `backend/src/controllers/eventsController.js`:
     - Al validar cobertura de informes activos: si un día desvinculado está vacío (`isDayEmpty`), se agrega a `emptyDiasToPrune` y se elimina silenciosamente en la misma transacción sin generar conflicto ni bloquear con 409.
     - Solo bloquea con 409 si existen días descubiertos con contenido real y sin resoluciones.
  3. En `src/modules/calendar/components/ReservationForm.jsx`:
     - En el pre-chequeo local, ignora días con `day.isEmpty`.
     - En `handleProceedWithoutInformeTransfer`: genera resoluciones con `action: 'delete_day'` para los días huérfanos desvinculados, permitiendo que la reserva se guarde limpiamente sin error 409 y descartando solo los días que el usuario decidió no transferir.
  4. En `src/modules/calendar/components/InformeTransferModal.jsx`:
     - Si no hay un slot en la misma fecha dentro de la reserva, sugiere por defecto `Eliminar solo este día` en lugar de reasignar a una fecha distinta.
     - Si el usuario selecciona reasignar a un slot en una fecha diferente, muestra advertencia visual: `⚠️ Atención: La reserva no tiene salones el [fecha]. Al reasignar aquí, el día del informe se trasladará al [nueva_fecha]`.
     - Texto de eliminación aclarado a "Eliminar solo este día" con mensaje explicativo de eliminación granular.
  5. Saneamiento MariaDB de columnas `propina_tipo`, `propina_valor`, `propina_monto` en `cotizaciones_evento` y `cotizacion_versiones_evento`.
  6. Validado con 112 pruebas unitarias automáticas (`node --test tests/*.test.mjs`) y compilación exitosa de producción (versión 2.1.179).

### Solución: Corrección de Vendedor en Último Contacto, Asignador Informativo en Cabecera y Sincronización Automática de Seguimiento en Eventos Asignados (`PosiblesVentasModule.jsx`, `posiblesVentasController.js`, `eventsController.js`, `server.cjs`, `ReportsEventosAsignados.jsx`, `posibles-ventas-vendedor-contacto.test.mjs`) (2026-10-10)
- Requerimiento: Resolver error crítico en el módulo de Eventos Asignados (`PosiblesVentasModule.jsx`) donde en la sección inferior de la tarjeta "Último contacto" aparecía erróneamente el nombre del usuario que asignó o creó el evento (`lead.creadoPorNombre`, ej. Carlos Robert Samalaj o Recepción) en vez del vendedor asignado o el vendedor que tomó/creó la reserva y le está dando seguimiento. Además, el usuario que asignó el evento debe figurar como dato informativo en la cabecera (`Asignado a: [Vendedor] · asignado por [Quien asignó] · hace X días`) y si otro vendedor tomó la reserva, destacarlo con `· Reserva atendida por: [Vendedor de la Reserva]`. Asimismo, la fecha de "Último contacto" debe actualizarse automáticamente tanto al editar notas o enviar mensajes al vendedor, como al modificar la reserva o registrar anticipos en el calendario.
- Causa raíz:
  1. En `PosiblesVentasModule.jsx` (línea 786), el pie de la tarjeta renderizaba directamente `{lead.creadoPorNombre && <span> · {lead.creadoPorNombre}</span>}` junto a la fecha de seguimiento, atribuyendo erróneamente el contacto al creador/asignador en lugar del vendedor.
  2. La cabecera solo mostraba `Asignado a: lead.vendedorNombre`, omitiendo el dato informativo de quién asignó el evento (`creadoPorNombre`).
  3. `backend/src/controllers/posiblesVentasController.js`, `eventsController.js` y `server.cjs` no sincronizaban atómicamente `ultimo_seguimiento_en` hacia `posibles_ventas` cuando se editaban notas en el lead, se enviaban recordatorios al vendedor, o se actualizaban reservas y anticipos vinculados en el calendario.
- Solución:
  1. En `src/modules/posiblesVentas/PosiblesVentasModule.jsx`:
     - Resuelto `vendedorContacto = lead.tomadoPorOtro && lead.atendidoPorNombre ? lead.atendidoPorNombre : (lead.atendidoPorNombre || lead.vendedorNombre || null)`.
     - En la sección inferior "Último contacto:" / "Próximo seguimiento:", reemplazado `lead.creadoPorNombre` por `{vendedorContacto && <span> · {vendedorContacto}</span>}`, garantizando que NUNCA aparezca el creador/asignador como autor del seguimiento.
     - En la cabecera superior, incorporado el contexto informativo `asignado por [lead.creadoPorNombre]` y destacado `· Reserva atendida por: [lead.atendidoPorNombre]` con estilo azul institucional `#0369a1` cuando un vendedor diferente toma o atiende la reserva.
     - Actualizado `DeletedLeadCard`, la exportación a Excel con columna `Atendido Por`, y la barra de búsqueda para incluir `creadoPorNombre`.
  2. En `backend/src/controllers/posiblesVentasController.js`:
     - Implementada función `getLatestDate` en `buildLead` para resolver reactivamente la fecha de interacción más reciente entre el lead y el evento ligado (`ultimo_seguimiento_en`, `linked_actualizado_en`, `linked_creado_en`).
     - En `enviarMensajeVendedor`, actualización automática de `ultimo_seguimiento_en = CURRENT_TIMESTAMP`.
     - En `updatePosibleVenta`, actualización automática de `ultimo_seguimiento_en = CURRENT_TIMESTAMP` y `primer_seguimiento_en` al modificar notas, servicios (`servicios_json`) o enviar `ultimoSeguimientoEn`.
  3. En `backend/src/controllers/eventsController.js` y `server.cjs`:
     - En `createEvent`, `updateEvent` y `updateEventQuote`: sincronización inmediata de `primer_seguimiento_en` y `ultimo_seguimiento_en = CURRENT_TIMESTAMP` en `posibles_ventas` vinculadas al evento editado (incluyendo al agregar o modificar servicios y precios de la cotización).
     - En `server.cjs` (`POST`, `PUT`, `DELETE /api/events/:eventId/anticipos` y guardado de cotizaciones): sincronización automática de `ultimo_seguimiento_en` al registrar o modificar anticipos y servicios.
  4. En `src/modules/reports/ReportsEventosAsignados.jsx`:
     - Homologada la insignia a `Reserva atendida por: [l.atendidoPorNombre]` con formato ejecutivo.
  5. Validado con 111 pruebas unitarias automáticas (`node --test tests/*.test.mjs`) y compilación exitosa de producción (versión 2.1.176).

### Solución: Sistema de Propinas para Personal en Cotizaciones y Contratos con Aislamiento Financiero (`server.cjs`, `eventsController.js`, `stateService.js`, `eventSeriesUtils.js`, `ReportsVentas.jsx`, `ReportsContabilidad.jsx`, `printUtils.js`, `QuoteModal.jsx`, `SettingsPropinas.jsx`, `SettingsMain.jsx`, `quote-tip-system.test.mjs`) (2026-10-10)
- Requerimiento: Incorporar opción de propinas para el personal en cotizaciones con la misma ergonomía que los descuentos comerciales (ingreso por monto fijo o porcentaje), calculadas sobre el subtotal neto `(Subtotal - Descuento)`. Las propinas no deben inflar los ingresos ni las metas de ventas de la empresa en la reportería (pertenecen a los empleados), pero deben ser identificables por evento en contabilidad y ventas. En documentos impresos, deben salir exclusivamente en el formato completo "Cotización + Contrato" (`completa`) y omitirse en la "Cotización normal" (`standard`) para no interferir en la fase de negociación comercial. Permitir configurar un porcentaje sugerido por defecto (ej. 10%) desde el panel de configuraciones con su propio endpoint REST.
- Causa raíz y consideraciones:
  1. `cotizaciones_evento` y `cotizacion_versiones_evento` no almacenaban campos dedicados para propinas (`propina_tipo`, `propina_valor`, `propina_monto`).
  2. La función de cómputo financiero `getQuoteFinancialAmounts` sumaba directamente los totales hacia `totalGtq`, lo que habría inflado artificialmente las métricas de ingresos corporativos si se mezclaban fondos de empleados con ventas de servicios.
  3. Los formatos impresos no contaban con discriminación de propina entre propuesta comercial inicial y contrato legal formal.
- Solución:
  1. En `server.cjs` y `backend/src/controllers/eventsController.js`:
     - Migración automática MariaDB de columnas `propina_tipo` (VARCHAR), `propina_valor` (DECIMAL 10,2) y `propina_monto` (DECIMAL 10,2) en `cotizaciones_evento` y `cotizacion_versiones_evento`.
     - `calculateQuoteTotals`: calcula `netSubtotal = Math.max(0, subtotal - discountAmount)`, resuelve `tipAmount` según tipo (monto o porcentaje sobre subtotal neto), mantiene `companyTotal = netSubtotal` y define el total del cliente `total = netSubtotal + tipAmount`.
     - Endpoints REST dedicados `GET /api/settings/propina` y `PUT /api/settings/propina` para porcentaje sugerido (default 10%), estado habilitado y nota de servicio.
  2. En `src/services/stateService.js`:
     - Funciones atómicas `getTipConfigApi()` y `saveTipConfigApi(config)`.
  3. En `src/modules/reports/components/eventSeriesUtils.js`:
     - `getQuoteFinancialAmounts` expone `companyTotalGtq` (`totalGtq = companyTotalGtq`) para blindar ingresos y metas de la empresa contra cualquier alteración por propinas, y provee `tipGtq`, `clientTotalGtq` y `hasTip`.
  4. En `src/modules/reports/ReportsVentas.jsx` y `ReportsContabilidad.jsx`:
     - `ReportsVentas.jsx`: Badge visual `+ Propina: Q X.XX` en la tabla y métrica informativa en la barra de resumen `Propina (periodo)` sin sumar a metas corporativas.
     - `ReportsContabilidad.jsx`: Badge en subtabla de cuentas, desglose en modal formal de estado de cuenta y banner de observación de fondo de empleados.
  5. En `src/utils/printUtils.js`:
     - Tokens `PROPINA` y `MONTO_PROPINA` para plantillas de contrato.
     - En `generateQuotePrintDocument`, la propina se imprime estrictamente cuando `printOption === "completa"` y `rawTipDoc > 0`. En `standard`, se omite la fila y el total impreso se mantiene en el monto de servicios.
  6. En `src/modules/calendar/components/QuoteModal.jsx`:
     - Interfaz completa desktop y móvil con selector de tipo (% o Monto), botón "10% Sugerido" conectado a la configuración de la empresa, botón "Quitar", cálculo reactivo sobre subtotal neto e inclusión en snapshot impreso y persistencia.
  7. En `src/modules/settings/SettingsPropinas.jsx` y `SettingsMain.jsx`:
     - Módulo de configuración Bento para definir porcentaje sugerido por defecto, conmutador de estado, atajos (5%, 10%, 15%) y nota de contrato.
  8. Validado con 107 pruebas unitarias automáticas (`node --test tests/*.test.mjs`) y compilación exitosa de producción (versión 2.1.174).

### Solución: Corrección de Error 413 Payload Too Large y ReferenceError en Actualización Atómica de Eventos (`eventsController.js`, `server.cjs`) (2026-10-09)
- Requerimiento: Resolver error donde al guardar cambios en una reserva desde `ReservationForm.jsx`, la consola arrojaba `PUT /api/state 413 (Payload Too Large)` con toast "Error al guardar el evento".
- Causa raíz:
  1. En `backend/src/controllers/eventsController.js`, en la función `updateEvent`, la variable `dias` estaba declarada dentro del bloque condicional `if (informesActivos.length > 0) { const [dias] = ... }`. Al guardar un evento que no tenía informes activos asociados (`informesActivos.length === 0`), `dias` no existía en el scope exterior, provocando `ReferenceError: dias is not defined` en la línea 975 (`if (Array.isArray(dias) && dias.length > 0)`).
  2. Al fallar el endpoint atómico `/api/events/:id` con HTTP 500, `eventService.update` recurría al mecanismo de respaldo `saveState({ ...currentState })`, el cual enviaba el estado completo de todo el CRM (>25MB).
  3. `server.cjs` tenía un límite de `express.json({ limit: "25mb" })`, provocando el rechazo con código `HTTP 413 Payload Too Large`.
- Solución:
  1. En `backend/src/controllers/eventsController.js`: Se declaró `let dias = [];` fuera del bloque condicional, garantizando que siempre esté definida como un arreglo vacío si no hay informes activos. Con esto, `PUT /api/events/:id` completa el guardado atómico en milisegundos sin recurrir al fallback de estado completo.
  2. En `server.cjs`: Se aumentó el límite de `express.json` y `express.urlencoded` a `100mb` para prevenir rechazos por tamaño de payload en operaciones masivas.
  3. Validado con 99 pruebas unitarias y compilación de producción en versión 2.1.172.

### Solución: Blindaje Anticolisión de Empresas en Menú & Montaje y Saneamiento de COT-172536 (`printUtils.js`, `fix_dvv_company.cjs`, `menu-montaje-company-shield.test.mjs`) (2026-10-09)
- Requerimiento: Resolver error donde al imprimir una cotización con contrato (formato completo que adjunta Menú & Montaje del evento), la barra azul del encabezado mostraba el nombre de un evento ajeno (`BODA CLAUDIA RIOS - MENU & MONTAJE - 2026-10-06`) a pesar de que el evento impreso pertenecía a `DVV INTERNATIONAL` (Cotización `COT-172536`, Encargado `ANA ZAPETA`, Salón `San Pedro`).
- Causa raíz:
  1. En la base de datos MariaDB de empresas, el registro `id: 1000` correspondía a `"BODA CLAUDIA RIOS"`.
  2. Debido a una colisión histórica de empresas heredadas/clonadas en el CRM, la cotización `COT-172536` y sus slots tenían asignado `companyId: 1000`, a pesar de que el usuario había especificado `quote.companyName = "DVV INTERNATIONAL"`.
  3. En `src/utils/printUtils.js`, las funciones `buildMenuMontajeSectionHtmlOnly` y `buildMenuMontajeReportHtml` buscaban ciegamente la empresa por ID (`companies.find(c => c.id === quote.companyId)`) y ejecutaban `company?.name || quote.companyName`, priorizando el nombre del catálogo (`"BODA CLAUDIA RIOS"`) por encima del nombre real de la cotización (`"DVV INTERNATIONAL"`).
- Solución:
  1. En `src/utils/printUtils.js`:
     - Implementada validación de concordancia estricta en `buildMenuMontajeSectionHtmlOnly` y `buildMenuMontajeReportHtml`: se define `explicitName = quote.companyName || ev?.name`. Si la empresa encontrada por ID tiene un nombre que no concuerda con el nombre explícito, se descarta el ID colisionado y se busca en el catálogo por nombre o se toma como `null`.
     - `institutionName` ahora prioriza fielmente `explicitName` por encima de cualquier empresa de catálogo, garantizando que el encabezado del documento refleje siempre el cliente/evento real.
  2. En MariaDB (`scripts/fix_dvv_company.cjs`):
     - Registrada la empresa oficial `DVV INTERNATIONAL` en la tabla `empresas` (`cmp_dvv_intl_*`).
     - Actualizada la cotización `COT-172536` en `cotizaciones_evento` y los 4 slots de `evt_f5c3dd54` en `eventos` con el nuevo ID limpio de empresa, desvinculando completamente la colisión con `1000`.
  3. Validado con suite de 99 pruebas unitarias automáticas (`node --test tests/*.test.mjs`) y compilación exitosa de producción (versión 2.1.171).

### Solución: Modo Tipo PAX "Salón Principal", Sincronización Automática con Cotizaciones y Desacople Fiel de Informes (`ReservationForm.jsx`, `InformeView.jsx`, `eventsController.js`, `informeController.js`, `ReportsDashboard.jsx`, `ReportsVentas.jsx`, `Kanban.jsx`, `pax-salon-principal.test.mjs`) (2026-10-09)
- Requerimiento: Resolver discrepancia crítica en eventos multislot donde el informe de evento mostraba un número de personas desfasado (ej. 170 Pax en vez de 150 Pax) en el encabezado y en el día tras modificarse la reserva en el CRM. Además, permitir un tercer modo "Salón Principal" en Tipo PAX donde salones auxiliares (ej. Casa Flores con 10 personas) puedan tener su cupo independiente sin inflar el total ni forzar a que todos los salones tengan 150 en modo compartido. Mantener la sincronización automática con `cotizaciones_evento` y asegurar que en los informes cada día refleje el PAX del salón reservado y el encabezado general refleje el PAX oficial del evento, preservando intactas las cantidades de los platillos de cocina.
- Causa raíz:
  1. `InformeView.jsx` priorizaba el valor estático `personasMontaje` guardado en el JSON de montajes por encima de `dia.slot_pax` y de `informe.Pax`.
  2. `cotizaciones_evento` mantenía el número inicial de 170 personas sin actualizarse cuando se editaba la reserva.
  3. `fetchInformeWithDias` y `getEventById` consultaban el slot base `cleanOcupacionId` que correspondía a Casa Flores (10 Pax) en vez de resolver el Salón Principal (Muelle, 150 Pax).
  4. El selector de Tipo PAX solo admitía dos estados binarios (Compartido / No Compartido), obligando a que o bien todos los salones tuvieran 150, o bien se sumaran a 310.
- Solución:
  1. En `src/modules/calendar/components/ReservationForm.jsx`:
     - Añadido el tercer modo interactivo **`Salón Principal`** en el selector de Tipo PAX (desktop y móvil).
     - Al seleccionar "Salón Principal", cada salón mantiene su propio cupo independiente en su fila y el PAX TOTAL del evento toma reactivamente solo el valor del slot marcado con la estrella ⭐ (`isPrincipal === true`).
     - Al alternar la estrella ⭐ a otro salón o editar el cupo del salón principal, el total del evento se actualiza de inmediato.
  2. En `src/services/eventService.js`, `server.cjs` y `backend/src/controllers/eventsController.js`:
     - Soporte completo para `pax_compartido = 2` / `'principal'` en MariaDB y memoria.
     - Al guardar la reserva, sincronización automática del campo `personas` en `cotizaciones_evento` y actualización del `num_personas` de los montajes de los días de informes activos correspondientes a los salones modificados, dejando intactas las cantidades de platillos de cocina.
  3. En `backend/src/controllers/informeController.js` y `eventsController.js`:
     - `fetchInformeWithDias` y `getEventById` resuelven el PAX oficial del Salón Principal para `currentInf.Pax` y mapean el `slot_pax` de cada día según el salón asignado a esa fecha.
  4. En `src/modules/informes/pages/InformeView.jsx`:
     - El encabezado general del documento muestra `{informe.Pax || diaPax || '-'} Pax` (150 Pax).
     - La barra azul de cada día prioriza `dia.slot_pax` para mostrar fielmente el cupo del salón asignado a la fecha.
  5. En `src/modules/reports/ReportsDashboard.jsx`, `ReportsVentas.jsx` y `Kanban.jsx`:
     - Reconocimiento de eventos con `paxCompartido === 2` para computar exclusivamente el PAX del salón principal en métricas mensuales, diarias y de ventas sin duplicar ni sumar salones auxiliares.
  6. Validado con suite de 97 pruebas unitarias automáticas (`node --test tests/*.test.mjs`) y compilación exitosa de producción (versión 2.1.170).

### Solución: Rediseño Ejecutivo y Minimalista del Selector de Días de Informes (`InformeView.jsx`, `styles.css`, `informe-day-selector-ui.test.mjs`) (2026-10-02)
- Requerimiento: Modernizar integralmente el apartado de selección de días en la visualización de informes de eventos (`InformeView.jsx`). Reemplazar el elemento `<select>` nativo del navegador y los emojis del sistema operativo (`📅`, `📋`) por una barra de herramientas ejecutiva compacta de una sola fila (`.iv-dia-selector-bar`), alineada al ancho del documento (`max-width: 850px`), con iconografía vectorial minimalista SVG y un menú flotante Bento para selección rápida y estética.
- Causa raíz:
  1. El componente utilizaba una etiqueta nativa `<select id="iv-dia-select">` con opciones `<option>`, impidiendo la renderización de estilos personalizados, microinteracciones o iconos vectoriales.
  2. Los textos incluían emojis del sistema operativo (`📅 DÍA DEL EVENTO` y `📋 Ver todos los días ({N})`), luciendo pixelados o discordantes entre diferentes dispositivos.
  3. Intentos previos combinaban controles redundantes (píldoras, selectores y resúmenes simultáneos) saturando visualmente la cabecera del documento.
- Solución:
  1. En `src/modules/informes/pages/InformeView.jsx`:
     - Erradicados todos los emojis del sistema operativo y el elemento nativo `<select>`.
     - Implementada una sola fila compacta ejecutiva (`.iv-dia-selector-bar` con altura fija de 48px y centrado perfecto):
       - Bloque izquierdo (`.iv-dia-label-side`): icono minimalista en caja suave (`.iv-dia-icon-box` con `<IconCalendar size={14} />`), etiqueta formal ("Días del informe") y pastilla de conteo sutil (`.iv-dia-count-tag`).
       - Bloque derecho (`.iv-dia-dropdown-wrap`): disparador moderno con micro-etiqueta ("Seleccionar día:"), botón interactivo (`.iv-dia-trigger-btn`) con icono temático (`IconLayers` o `IconCalendar`), texto informativo truncado elegantemente y chevron rotacional (`IconChevronDown`).
     - Diseñado el **menú flotante Bento** (`.iv-dia-menu-popover`): menú desplegable con cabecera en micro-mayúsculas, opción global "Ver todos los días" y opciones por día con números dedicados, fechas legibles, badges de salón asignado (`<IconBuilding size={11} />`) y checkmark minimalista (`<IconCheck size={14} />`).
     - Soporte para cierre automático al hacer clic afuera (`handleClickOutside`) o presionar tecla `Escape`.
  2. En `src/modules/informes/styles.css`:
     - Diseñados los estilos ejecutivos limpios para `.iv-dia-selector-bar` (ancho máximo coincidente de 850px, bordes refinados y sombras tenues), `.iv-dia-label-side`, `.iv-dia-trigger-btn`, `.iv-dia-menu-popover`, `.iv-dia-popover-item` y `.iv-dia-popover-item.selected`.
     - Añadida regla responsiva `@media (max-width: 768px)` con ajuste vertical ergonómico a 100% de ancho para móviles.
  3. En `tests/informe-day-selector-ui.test.mjs`:
     - Suite de pruebas unitarias actualizada validando la erradicación de emojis, el uso exclusivo de iconos SVG y la arquitectura de la barra ejecutiva slim.
  4. Validado con 91 pruebas unitarias automáticas (`node --test tests/*.test.mjs`) y compilación exitosa de producción (versión 2.1.168).

### Solución: Optimización Responsiva Móvil Integral del Panel de Configuración (`settings.css`, `SettingsMain.jsx`, `settings-redesign.test.mjs`) (2026-10-02)
- Requerimiento: Resolver error de visualización en dispositivos móviles (iPhone / Android) donde el panel de configuración se rompía por completo: la cabecera superior truncaba "Historial de Auditoría" y ocultaba "Volver al Tablero" fuera de pantalla, el sidebar fijo de 230px (`.settings-sidebar-col`) comprimía el canvas blanco principal (`.settings-content-card`) a un hilo vertical de ~60px cortando títulos y palabras letra por letra, los botones Bento de 176px desbordaban las tarjetas y la tarjeta estática de sincronización consumía el espacio útil en pantalla.
- Causa raíz:
  1. `.settings-layout-grid` utilizaba flexbox horizontal de escritorio (`display: flex; gap: 24px;`) sin reglas `@media` para colapsar en pantallas menores a 880px.
  2. `.settings-sidebar-col` tenía ancho fijo `width: 230px; flex-shrink: 0;`, consumiendo casi el 70% del ancho móvil.
  3. `.settings-header-bar` no contaba con reglas responsivas, provocando que los botones de acción se desbordaran hacia la derecha fuera del viewport.
  4. Los botones de acción Bento (`.settings-action-btn`) tenían anchos forzados de `176px !important`, lo que impedía que se ajustaran dentro de las tarjetas en pantallas estrechas.
- Solución:
  1. En `src/modules/settings/settings.css`:
     - `@media (max-width: 880px)`:
       - `.settings-header-bar`: Colapsado a distribución vertical limpia (`flex-direction: column; align-items: stretch; gap: 12px; padding: 12px 16px;`). Los botones "Historial de Auditoría" y "Volver al Tablero" se distribuyen simétricamente en una fila con `flex: 1`, textos protegidos contra desbordamiento con `text-overflow: ellipsis`, bordes refinados y esquinas suaves.
       - `.settings-layout-grid` / `.settings-layout-row`: Colapsado a columna completa (`flex-direction: column; width: 100%; gap: 12px;`).
       - `.settings-sidebar-col`: Ancho al 100% (`width: 100%; flex-shrink: 0;`).
       - `.settings-nav` y `.settings-nav-item`: Transformados en una barra de pastillas/pills moderna deslizable horizontalmente con scroll táctil inercial iOS/Android (`overflow-x: auto; flex-direction: row; gap: 8px; border-radius: 999px;`). En estado activo, la pastilla se ilumina en azul institucional `#0284c7` con texto e iconos blancos y sombra sutil; en inactivo, pastilla blanca limpia con borde sutil.
       - `.settings-sync-card`: Ocultada en móviles (`display: none;`) para maximizar el área de trabajo y ubicar el contenido directamente tras los módulos.
       - `.settings-content-card`: Ancho 100% con padding ergonómico (`padding: 16px 14px; border-radius: 14px;`).
       - `.settings-content-header`: Colapsado en columna para títulos y pastilla de estado sin colisiones.
       - `.settings-bento-card`: Colapsado en columna vertical accesible con icono alineado al inicio.
       - `.settings-action-btn`: Ancho adaptativo al 100% (`width: 100% !important; min-width: 0 !important;`) y centrado con microinteracción táctil fluida.
       - `.settings-footer`: Ajustado para visualización vertical limpia con tipografía optimizada.
     - `@media (max-width: 480px)`: Afinamiento para teléfonos ultra compactos (padding de 8-10px, títulos a 16px, pastillas compactas a 36px de altura).
  2. En `tests/settings-redesign.test.mjs`:
     - Incorporada prueba unitaria automatizada que verifica el colapso del grid, la barra de pastillas horizontal y los botones responsivos full-width.
  3. Validado con 89 pruebas unitarias automáticas (`node --test tests/*.test.mjs`) y compilación exitosa de producción (versión 2.1.166).

### Solución: Rediseño Ejecutivo del Diálogo de Cotización Guardada, Animación SVG y Guía de WhatsApp (`QuoteModal.jsx`, `quoteMobile.css`, `quote-modal-ui.test.mjs`) (2026-10-02)
- Requerimiento: Reemplazar el checkmark verde pixelado/genérico de SweetAlert y los emojis del sistema operativo (`🖨️`, `💬`, `❌`) en el diálogo "¡Cotización guardada!". Crear un indicador de completado minimalista con animación fluida en SVG vectorial, halo pulsante en esmeralda, pastilla de estado "Guardado exitoso", chip de código de cotización (`COT-XXXXX`) y tarjetas Bento interactivas para "Imprimir / PDF" y "WhatsApp", junto con la modernización de la guía de pasos para compartir por WhatsApp.
- Solución:
  1. En `src/modules/calendar/components/quoteMobile.css`:
     - Implementado `.qsave-swal-popup` con curvatura de 22px, sombreado profundo `0 25px 60px -15px rgba(15,23,42,0.28)` y ancho de 480px.
     - Diseñado el badge de completado `.qsave-badge-icon` (62×62px) con fondo gradiente mint/esmeralda, animación de pop-in `@keyframes qsave-pop` y halo radiante suave `@keyframes qsave-ring-pulse`.
     - Creado el trazo dinámico de verificación `.qsave-check-path` con animación de dibujo vectorial `@keyframes qsave-check-draw` que no se pixela en pantallas retina.
     - Añadida pastilla `.qsave-status-pill` con punto brillante y chip de código `.qsave-code-chip`.
     - Implementadas tarjetas Bento interactivas `.qsave-card` con variantes `.is-print` y `.is-whatsapp`, iconos vectoriales minimalistas SVG, badges temáticos y flechas SVG animadas con desplazamiento lateral.
     - Diseñado `.qwa-swal-popup` con encabezado verde WhatsApp, tarjetas de pasos numeradas (1, 2, 3) y botones estilizados sin emojis.
  2. En `src/modules/calendar/components/QuoteModal.jsx`:
     - Creada la función `promptQuoteSavedModal(finalQuote)` que suprime los iconos genéricos (`icon: null`) y retorna de forma asíncrona la acción elegida (`'print'`, `'whatsapp'`, o `null`).
     - Modernizado el flujo de WhatsApp (`showGuidedAlert`) para usar la nueva arquitectura de pasos Bento y botones vectoriales.
     - Erradicados emojis en botones de error y respaldo.
  3. Validado con 88 pruebas unitarias automáticas (`node --test tests/*.test.mjs`) y build de producción exitoso (versión 2.1.162).

### Solución: Rediseño Ejecutivo del Selector de Formato de Impresión/Exportación de Cotizaciones (`QuoteModal.jsx`, `quoteMobile.css`, `quote-modal-ui.test.mjs`) (2026-10-02)
- Requerimiento: Modernizar integralmente el modal "Selecciona el formato" de cotizaciones/contratos, erradicando los emojis del sistema operativo (`📄`, `📋`, `🔒`, `→`) y el icono circular azul genérico de SweetAlert `( i )`. Crear una interfaz ejecutiva Bento con tarjetas interactivas, iconos vectoriales minimalistas SVG, pastillas categóricas (`Comercial`, `Operativo`, `Cocina / Staff`), microinteracciones de elevación e iluminación sutil, y plena accesibilidad con teclado.
- Solución:
  1. En `src/modules/calendar/components/quoteMobile.css`:
     - Diseñado el contenedor `.qformat-swal-popup` con ancho controlado de 480px, esquinas suaves de 20px, sombreado `0 25px 60px -15px rgba(15,23,42,0.28)` y borde sutil.
     - Incorporado encabezado `.qformat-header` con caja de icono gradiente `.qformat-header-icon-box` e icono SVG de documento/impresora.
     - Implementadas tarjetas Bento interactivas `.qformat-card` con variantes temáticas:
       - `.is-standard`: Acento Azul Cobalto (`#0284c7`), badge `Comercial`, SVG minimalista de hoja de cotización (`FileText`).
       - `.is-completa`: Acento Esmeralda (`#059669`), badge `Operativo`, SVG minimalista de contrato / checklist (`ClipboardCheck`).
       - `.is-sin-precios`: Acento Púrpura Imperial (`#7c3aed`), badge `Cocina / Staff`, SVG minimalista de candado seguro (`Lock`).
     - Micro-animaciones en hover: elevación `-2px`, escalado sutil de la caja de icono `1.06`, desplazamiento `+4px` de la flecha SVG derecha y halo perimetral con el color institucional de cada formato.
     - Botón de cancelación ejecutiva tipo pastilla `.qformat-cancel-btn`.
  2. En `src/modules/calendar/components/QuoteModal.jsx`:
     - Modificado `localSwal` para aceptar `icon: null` o `icon: false`, suprimiendo la animación azul por defecto de SweetAlert y permitiendo una cabecera nativa limpia.
     - Creada la función unificada `promptPrintFormatModal()` que encapsula la renderización del diálogo Bento y el manejo de selección (vía clic o teclado `Enter`/`Space`).
     - Conectado `promptPrintFormatModal()` tanto en `handleSaveQuote` (flujo post-guardado) como en `handleReimprimir` (botón de la barra superior).
  3. Validado con 87 pruebas unitarias automáticas (`node --test tests/*.test.mjs`) y build de producción exitoso (versión 2.1.160).

### Solución: Corrección de Conflicto 409 al Guardar Cotizaciones, Formato ISO en Días de Informes y Filtrado de Versiones Activas (`eventsController.js`, `informeController.js`, `ReservationForm.jsx`, `server.cjs`, `quote-save-conflict-guard.test.mjs`) (2026-10-02)
- Requerimiento: Resolver error donde al guardar una cotización desde el modal de cotización, el sistema arrojaba en consola `HTTP 409 Conflict: La modificación desvincula fechas o salones con informes de evento activos`, mostrando el toast rojo "Error al guardar el evento" aunque la cotización sí se persistía.
- Causa raíz:
  1. En `ReservationForm.jsx`, `handleQuoteSave` guardaba la cotización correctamente en MariaDB mediante `eventService.saveQuote`, pero inmediatamente intentaba ejecutar `await handleAddEvent(updatedEvent)` como respaldo. Al tratarse de un evento existente, `handleAddEvent` llamaba a `eventService.update` (`PUT /api/events/:id`), que disparaba innecesariamente el guardián de desvinculación de informes y la reescritura de slots de la reserva, mostrando un toast de error a pesar de que la cotización ya estaba guardada.
  2. En `backend/src/controllers/eventsController.js` y `informeController.js`, las consultas de `informesActivos` obtenían **todas** las versiones históricas anteriores del informe (ej. versiones 1 a 33), las cuales contenían salones y días antiguos que ya habían sido modificados o descartados en la versión actual (versión 34).
  3. En `informe_dias_detalle`, la columna `fecha_evento` es retornada por el driver `mysql2` como un objeto `Date` de JavaScript. La expresión `String(d.fecha_evento).slice(0, 10)` producía cadenas como `"Wed Sep 30"` o `"Fri Sep 25"`, rompiendo la comparación lexicográfica contra fechas ISO `"2026-09-30"` y provocando que cada día del informe fuera erróneamente clasificado como un conflicto no cubierto.
  4. En `updateEvent` (`eventsController.js`), si la petición provenía de una actualización parcial o de un slot individual sin `expandedEvents` explícito, `expanded` se reducía a un solo elemento (`[eventData]`). Esto hacía que el validador comparara todos los días del informe contra un único slot, y además disparaba `DELETE FROM eventos WHERE id NOT IN (...)`, amenazando con eliminar los demás slots de la reserva.
  5. En `cotizaciones_evento`, `id_empresa` e `id_encargado` estaban definidos como `NOT NULL`, lo que causaba fallos en `PUT /api/events/:id/quote` cuando la cotización no tenía empresa o encargado asociado.
- Solución:
  1. En `backend/src/controllers/eventsController.js`:
     - Implementado el helper `toIsoDate(val)` para normalizar fechas procedentes de strings o instancias `Date`.
     - Actualizada la consulta de `informesActivos` para filtrar exclusivamente la última versión activa para toda la serie de la reserva (`AND i.id = (SELECT i2.id FROM informes_eventos i2 WHERE (i2.id_ocupacion = ? OR i2.id_ocupacion = ? OR i2.id_ocupacion LIKE CONCAT(?, '_%')) AND (i2.estado IS NULL OR i2.estado = 'activo') AND i2.deleted_at IS NULL ORDER BY i2.version DESC, i2.id DESC LIMIT 1)`).
     - Incorporado `hasExplicitMultiSlots` y `slotsForCoverageCheck`: si la petición no reemplaza explícitamente los multi-slots, recupera los slots existentes de la base de datos para validar la cobertura completa del informe y previene el borrado involuntario de otros slots en `eventos`.
     - Añadido `DATE_FORMAT(idd.fecha_evento, '%Y-%m-%d') AS fecha_evento` en la consulta de días y normalización con `toIsoDate` en `diaFecha`, `sStart` y `sEnd`.
  2. En `backend/src/controllers/informeController.js`:
     - Implementado `toIsoDate(val)` y actualizado `checkEventInformes` para consultar solo la versión activa más reciente de la serie y formatear las fechas de días en formato ISO estricto (`YYYY-MM-DD`).
  3. En `server.cjs`:
     - Incorporada la migración en `ensureInformeConflictGuardStructure` para permitir valores `NULL` en `id_empresa` e `id_encargado` de la tabla `cotizaciones_evento`.
  4. En `src/modules/calendar/components/ReservationForm.jsx`:
     - En `handleQuoteSave`, cuando el evento ya existe (`id` o `currentEvent.id`), se ejecuta el guardado atómico con `eventService.saveQuote(targetId, quoteData, newStatus)` y se llama a `refreshData(true)` en segundo plano sin invocar `handleAddEvent` de forma redundante.
  5. Validado con 86 pruebas unitarias automáticas (`node --test tests/*.test.mjs`), reinicio limpio del servidor backend y compilación de producción exitosa (versión 2.1.158).
### Solución: Blindaje Antidesfase de Informes al Modificar Reservas, Intercepción Atómica HTTP 409 y Modal Ejecutivo Tri-Estado (`eventsController.js`, `informeController.js`, `informeRoutes.js`, `server.cjs`, `eventService.js`, `ReservationForm.jsx`, `InformeTransferModal.jsx`, `informes-conflict-guard.test.mjs`) (2026-10-01)
- Requerimiento: Implementar un mecanismo de intercepción y blindaje atómico al modificar fechas o salones de una reserva con informes asociados. Si existen informes en días o salones que van a ser liberados o desplazados, bloquear la actualización automática con HTTP 409 Conflict. Presentar un modal no nativo, ultra intuitivo con tarjetas Bento e iconos minimalistas SVG que permita al usuario decidir el destino con 3 acciones: a) Mover/Reasignar a un salón/slot válido, b) Desvincular/Archivar para preservación histórica sin perder datos, y c) Eliminar mediante Soft Delete auditado.
- Solución:
  1. En `server.cjs`:
     - Creada y registrada la migración `ensureInformeConflictGuardStructure` en `MIGRATIONS` y `CANONICAL_MIGRATIONS`.
     - Crea la tabla normalizada `reserva_salones_fechas` e incorpora columnas evolutivas en `informes_eventos` (`id_reserva_origen`, `estado`, `deleted_at`, `deleted_by`), `informe_dias_detalle` (`slot_detalle_id`) e `informe_historial` (`rol_usuario`), con índices dedicados.
  2. En `backend/src/controllers/informeController.js` y `informeRoutes.js`:
     - Implementado `applyInformeResolutionsInternal` con soporte atómico para acciones `reassign`, `archive` (estado='archivado', id_ocupacion=NULL) y `delete` (estado='eliminado', soft delete auditado).
     - Registrado endpoint `POST /api/informes/resolve-conflicts`.
     - Enriquecido `checkEventInformes` para filtrar informes eliminados y retornar detalles completos por día.
  3. En `backend/src/controllers/eventsController.js`:
     - En `updateEvent` (`PUT /api/events/:id`), implementado el interceptor que verifica si hay informes activos en fechas o salones no cubiertos por los nuevos slots.
     - Si existen conflictos no resueltos, aborta la transacción con `HTTP 409 Conflict` (`INFORMES_DESYNC_BLOCKED`).
     - Si se adjuntan `informeResolutions`, las ejecuta de forma atómica en la misma transacción junto con la actualización de la reserva y sincronización a `reserva_salones_fechas`.
  4. En `src/services/eventService.js`:
     - `eventService.update` transmite `informeResolutions` en el payload y re-lanza explícitamente los errores 409 para activar el modal en la interfaz sin caer en el fallback de `saveState`.
  5. En `src/modules/calendar/components/InformeTransferModal.jsx` y `src/modules/informes/components/ReassignSalonModal.jsx`:
     - Erradicados todos los emojis del sistema operativo (`🗓️`, `⏰`, `👥`, `📄`, `ℹ️`, `⚠️`, `🔄`).
     - Sustituidos por iconografía SVG minimalista de trazo nítido (`IconCalendar`, `IconClock`, `IconUsers`, `IconFileText`, `IconBuilding`, `IconTag`, `IconLayers`, `IconSwap`, `IconArchive`, `IconTrash`, `IconShieldAlert`, `IconInfo`, `IconAlertTriangle`, `IconCheck`, `IconX`, `IconRefreshCw`).
     - Checkboxes ejecutivos estilizados y cabeceras con botón de cierre limpio.
  6. En `src/modules/calendar/components/ReservationForm.jsx`:
     - Verificación granular por cada día de informe antes de guardar.
     - Captura reactiva de errores 409 del backend como red de seguridad adicional.
  7. Validado con 81 pruebas automáticas (`node --test tests/*.test.mjs`) y build de producción exitoso (versión 2.1.156).

### Solución: Blindaje Antidesfase de Informes al Editar Reservas, Modal de Transferencia Inteligente de Salón y Reasignación Manual (`informeController.js`, `server.cjs`, `ReservationForm.jsx`, `InformeTransferModal.jsx`, `ReassignSalonModal.jsx`, `ConstructorInforme.jsx`, `InformeView.jsx`) (2026-09-19)
- Requerimiento: Resolver error crítico en reservas multislot donde al cambiar fechas de un salón (ej. *Santa Cruz* del 24-27 al 25-27) y agregar otro salón el día 24 (ej. *Mesa Reservada* con comida solo ese día), el sistema desfasaba silenciosamente el informe (#1146) del día 24 al 25 arrastrando el menú ("Caldo de res"), mostraba *Santa Cruz* en lugar de *Mesa Reservada*, y en el Kanban el día 24 aparecía como "+ Informe" sin vincular. Blindar el sistema para evitar mutaciones automáticas de fechas en informes, proveer un modal inteligente al guardar en "Editar Reserva" para transferir el informe al salón destino conservando el menú intacto, reparar el informe #1146, y habilitar un botón "Reasignar Salón" en el constructor y visor de informes sin alterar la presentación visual de los días.
- Causa raíz:
  1. `server.cjs` en `syncEventsToDb` (líneas 3925–3944) detectaba `oldEvent.date !== e.date` y ejecutaba un trigger destructivo ciego: `UPDATE informe_dias_detalle SET fecha_evento = DATE_ADD(..., INTERVAL ? DAY)`.
  2. `informeController.js` en `fetchInformeWithDias` (líneas 54–75) mutaba silenciosamente la base de datos en tiempo de lectura (`UPDATE informe_dias_detalle SET fecha_evento = ? WHERE id_informe = ?`) si la fecha del evento no coincidía con el primer día.
  3. `server.cjs` (líneas 4356–4378) sobreescribía `informes_eventos.id_ocupacion` con el slot principal (`principalSlotId`), desvinculando cualquier slot secundario con informe activo.
  4. `ConstructorInforme.jsx` (líneas 678–695) desplazaba artificialmente los días mapeados al cargar si la fecha del slot CRM difería del día 1.
- Solución:
  1. En `informeController.js`:
     - Eliminada la mutación automática ciega de `fecha_evento` en `fetchInformeWithDias`.
     - Implementado endpoint `GET /api/informes/check-event/:eventId` (`checkEventInformes`): detecta qué informes y días con menús/montajes están asociados a la serie de la reserva antes de guardar.
     - Implementado endpoint `POST /api/informes/:id/reassign-slot` (`reassignInformeSlot`): reasigna `id_ocupacion` en `informes_eventos` y actualiza opcionalmente el salón y horario en `descripcion_montaje` del día afectado manteniendo el menú, ingredientes y cantidades 100% intactos.
  2. En `server.cjs`:
     - Eliminado el trigger destructivo `DATE_ADD(idd.fecha_evento, INTERVAL ? DAY)`.
     - Blindada la asignación de `id_ocupacion` con `AND id_ocupacion NOT IN (SELECT id FROM eventos)` en `syncEventsToDb` y `ensureMainSalonStructure` para impedir la desconexión de slots secundarios.
     - Creada y registrada la migración `ensureRepairDesyncedInformes` que restaura el informe #1146 al slot `evt_10dcf44a` (*Mesa Reservada*, 2026-09-24, 19:00 - 21:00) con el menú "Caldo de res" intacto.
  3. En `src/modules/calendar/components/ReservationForm.jsx` y `InformeTransferModal.jsx`:
     - Al guardar la reserva, si se detecta que un salón con informe existente fue modificado o recortado, se intercepta el guardado abriendo `InformeTransferModal`.
     - El modal detecta coincidencias automáticas de fechas, permite elegir a qué salón transferir el informe o guardar sin transferir, y ejecuta la reasignación atómica sin desfasar menús.
  4. En `src/modules/informes/components/ReassignSalonModal.jsx`, `ConstructorInforme.jsx` e `InformeView.jsx`:
     - Creado `ReassignSalonModal` accesible para roles autorizados (Admin, Vendedor, FrontOffice, Eventos) mediante el botón "🔄 Reasignar Salón" en la barra superior de edición y en el visor (tanto en desktop como en barra móvil).
     - En `ConstructorInforme.jsx`, corregido el mapeo de días para vincular datos por fecha exacta del calendario (`crmDays.find(cd => cd.fecha === md.fecha)`), blindando los menús contra desfasamiento.
  5. Validado con 69 pruebas automáticas (`node --test tests/*.test.mjs`) y build de producción exitoso (versión 2.1.153).

### Solución: Rediseño Ejecutivo del Panel de Configuración Réplica 100% Maqueta (`SettingsMain.jsx`, `settings.css`, `SettingsUsuariosManager.jsx`, `settings-redesign.test.mjs`) (2026-09-19)
- Requerimiento: Alinear y replicar de forma 100% fiel la imagen de referencia ejecutiva provista por el usuario: cabecera con avatar circular azul "JL", "EMS RESERVAS / JARDINES DEL LAGO", botón "Historial de Auditoría" y "< Volver al Tablero"; sidebar con título "MÓDULOS DEL SISTEMA", pestañas con barra indicadora vertical azul y badges dinámicos ("Activo", "6", punto verde "●"), tarjeta inferior "Sincronización en vivo"; contenedor blanco con badge "● Sistema Operativo Activo"; banner azul con icono sólido de edificio y términos clave en azul; 4 tarjetas Bento idénticas a la imagen con badges de estado, sub-meta info, barra de progreso naranja de avance de ventas y tags de checklists con botones dedicados; y pie de página con respaldo automático y versión Enterprise.
- Solución:
  1. En `src/modules/settings/settings.css`:
     - Diseñado `.settings-brand-avatar` circular azul `#0284c7` con tipografía bold blanca "JL".
     - Estilizado `.settings-header-bar` con acciones `.settings-btn-audit` y `.settings-btn-back`.
     - Implementado `.settings-sidebar-col` con eyebrow `MÓDULOS DEL SISTEMA`, elementos `.settings-nav-item` con barra indicadora lateral de 3.5px (`::before`), badges `.settings-nav-badge-active`, `.settings-nav-badge-count`, `.settings-nav-badge-dot` y tarjeta informativa `.settings-sync-card`.
     - Implementado `.settings-content-card` blanco con encabezado `.settings-status-badge` (`● Sistema Operativo Activo`), banner `.settings-storytelling-banner` con icono sólido `.settings-storytelling-icon-solid`.
     - Diseñadas las tarjetas `.settings-bento-card` con cajas de icono `.settings-bento-icon-box` (`.is-blue`, `.is-green`, `.is-amber`, `.is-purple`), badges de cabecera (`.badge-gray`, `.badge-green`, `.badge-amber`, `.badge-purple`), sub-metas (`.settings-meta-pill-green`, `.settings-meta-tag`, `.settings-progress-wrap` con barra de progreso naranja) y botones de acción dedicados `.settings-action-btn`.
     - Diseñado el pie `.settings-footer` con icono de escudo y versión del sistema.
  2. En `src/modules/settings/SettingsMain.jsx`:
     - Reestructurado el layout principal y cada una de las 6 secciones reflejando los elementos exactos de la imagen.
     - Botones de acción dedicados: `Gestionar Áreas →`, `Ajustar Tasa →`, `Definir Objetivos →`, `Configurar Plantillas →`, etc.
  3. Validado con 62 pruebas unitarias automatizadas (`node --test tests/*.test.mjs`) y compilación limpia de producción (versión 2.1.151).

### Solución: Bloqueo de Cierre Involuntario, Scroll Fluido con Ratón/Barra en Anticipos/Auditoría y Botón de Cerrar en Evidencia (`QuoteModal.jsx`, `quoteMobile.css`) (2026-09-19)
- Requerimiento: Evitar que el modal de Gestión de Anticipos se cierre por error al hacer clic afuera en el fondo (`backdrop`), solucionar el problema donde la tabla de anticipos y el log de auditoría se comprimían a una sola fila sin barra de desplazamiento ni funcionamiento del scroll del ratón (solo permitía moverse con Tab), y restaurar el icono `✕` en los botones de cerrar del visor lightbox de evidencias.
- Causa raíz:
  1. `QuoteModal.jsx` tenía un listener `onClick` en `.qav-modal-backdrop` que cerraba inmediatamente el modal ante cualquier clic fuera del recuadro.
  2. En `quoteMobile.css`, los hijos flex de `.qav-modal-body` (`.qav-card`, `.qav-accordion`, etc.) tenían `flex-shrink: 1` implícito, lo que provocaba que Flexbox comprimiera violentamente la tabla de anticipos y el acordeón de auditoría a ~50px de altura (dejando visible únicamente la primera fila y ocultando el resto y el pie de la tabla).
  3. Las reglas de scrollbars tenían un ancho estrecho (6px) y colores translúcidos que las hacían invisibles en Chrome y carecían de soporte estándar para Firefox (`scrollbar-color`).
  4. La tabla de trazabilidad no tenía un contenedor con altura máxima y scroll dedicado (`.qav-log-wrap`).
  5. En el visor de evidencias, el botón superior utilizaba `.qav-close-btn` (que imponía un botón circular de icono aplastando el texto) y el botón inferior carecía de icono SVG.
- Solución:
  1. En `QuoteModal.jsx`:
     - Eliminado el listener `onClick` del backdrop; el modal solo se cierra al hacer clic deliberado en `[ ✕ ]` o `[ Listo / Cerrar ]`.
     - Encapsulada la tabla de auditoría en `<div className="qav-log-wrap" style={{ maxHeight: '220px', overflowY: 'auto' }}>` con encabezados fijos (`position: sticky`).
     - Sustituidos los botones de cerrar en el visor de comprobantes por `.qav-lightbox-close-btn` con icono `<X size={15} strokeWidth={2.5} />` y texto `Cerrar` nítidos.
  2. En `quoteMobile.css`:
     - Incorporado `flex-shrink: 0 !important;` en `.qav-card`, `.qav-accordion`, `.qav-kpi-grid` y `.qav-footer`, erradicando el colapso vertical de las tablas.
     - Barras de desplazamiento visibles y de alto contraste (`width: 8px !important; background: #94a3b8;`) con soporte estándar `scrollbar-width: thin !important; scrollbar-color: #94a3b8 #f1f5f9 !important;` para `.qav-table-wrap`, `.qav-log-wrap` y `.qav-modal-body`.
     - Creada la clase de alta especificidad `.qav-lightbox-close-btn` (con variante `.is-bottom`) que neutraliza los estilos globales y asegura la visualización perfecta del icono y texto.
  3. Validado con 54 pruebas unitarias automáticas y compilación limpia de producción (versión 2.1.148).
### Solución: Icono de Evidencia de Referencia y Corrección de Scroll en Gestión de Anticipos (`QuoteModal.jsx`, `quoteMobile.css`) (2026-09-19)
- Requerimiento: Resolver el bloqueo de scroll entre anticipos en el módulo de Gestión de Anticipos y reemplazar el nombre extenso del archivo de evidencia por un icono de referencia compacto que indique que existe comprobante adjunto.
- Causa raíz:
  1. En `quoteMobile.css`, la propiedad `overscroll-behavior: contain !important` en `.qav-table-wrap` y `.qav-modal-body` provocaba un bloqueo de eventos de scroll (`scroll trap`), impidiendo que el desplazamiento vertical se propagara al resto del modal cuando el cursor se encontraba sobre la tabla.
  2. En `QuoteModal.jsx`, la celda de evidencia renderizaba el nombre completo del archivo (ej. `WhatsApp Image 2026-09-14 at 3.53.05 PM.webp`), inflando el ancho de la columna a más de 350px y desfigurando el diseño de la tabla.
- Solución:
  1. En `QuoteModal.jsx`:
     - La cabecera `EVIDENCIA` se ajustó a un ancho estricto de `70px`.
     - Se reemplazó el texto del archivo por un botón de icono cuadrado (`30px × 30px`) con `ImageIcon` y tooltip informativo (`title="Comprobante: ... (clic para ver)"`), que abre directamente el visor lightbox al hacer clic.
     - Si el anticipo carece de comprobante, se muestra un guión elegante `—`.
     - Altura dinámica para la tabla: `maxHeight: 280px` cuando el formulario está activo y `maxHeight: 520px` cuando el formulario está minimizado.
  2. En `quoteMobile.css`:
     - Se sustituyó `overscroll-behavior: contain` por `overscroll-behavior: auto !important` en `.qav-table-wrap` y `.qav-modal-body`.
     - Se añadió `touch-action: pan-y !important` y encabezados fijos (`position: sticky; top: 0; z-index: 5`) en la tabla.
     - Se incorporó soporte para `.qav-inline-card` cuando se despliega incrustado desde la reserva.
  3. Validado con 54 pruebas unitarias automatizadas (`node --test tests/*.test.mjs`) y compilación limpia de producción (versión 2.1.147).

### Solución: Sincronización Bidireccional de Pagos/Abonos en Eventos y Contratos, Endpoints Atómicos y Rediseño Ejecutivo de Gestión de Anticipos (`server.cjs`, `QuoteModal.jsx`, `quoteMobile.css`, `stateService.js`, `ReportsContabilidad.jsx`, `event-advances-sync.test.mjs`) (2026-09-19)
- Requerimiento: Resolver error crítico donde al aplicar un pago en el Estado de Cuenta no se restaba en el evento ni al generar el contrato, permitir editar y eliminar abonos dentro del módulo del evento llevando registro de quién lo hace y horario, y rediseñar por completo el módulo de anticipos según maqueta ejecutiva (Imagen 3).
- Causa raíz:
  1. `server.cjs` en las líneas 3878 y 4313 forzaba `{ advances: undefined }` al persistir `cotizacion_json`.
  2. En eventos multi-slot, la función `syncEventsToDb` ejecutaba `DELETE FROM anticipos_evento` porque los slots secundarios tenían `advances` vacío y compartían el mismo `baseId`.
  3. No existían endpoints atómicos REST para consultar, insertar, modificar o eliminar abonos directamente sin sobreescribir el payload masivo del evento.
  4. La vista previa de anticipos en `QuoteModal.jsx` (modal e inline) no permitía editar o eliminar abonos con selector de usuario auditor ni contaba con el diseño ejecutivo moderno.
- Solución:
  1. En `server.cjs`:
     - Eliminada la propiedad destructiva `{ advances: undefined }`, preservando `JSON.stringify(q)`.
     - Protegida la sincronización de multi-slots restringiendo el borrado de anticipos al ID base (`id === baseId`) y verificando `Array.isArray(quote.advances)`.
     - Creados 4 endpoints REST atómicos: `GET /api/events/:eventId/anticipos`, `POST /api/events/:eventId/anticipos`, `PUT /api/events/:eventId/anticipos/:advanceId` y `DELETE /api/events/:eventId/anticipos/:advanceId`.
     - Registro cronológico auditable en `historial_anticipos` con nombre de usuario, ID, acción (`added`, `edited`, `deleted`), timestamp y emisión de WebSockets en tiempo real.
  2. En `src/services/stateService.js` y `src/services/api.js`:
     - Exportados `getEventAdvancesApi`, `addEventAdvanceApi`, `updateEventAdvanceApi` y `deleteEventAdvanceApi`.
  3. En `src/modules/reports/ReportsContabilidad.jsx`:
     - Vinculada la aplicación de abonos en el Estado de Cuenta a los endpoints atómicos, garantizando sincronización inmediata sin riesgo de sobreescritura.
  4. En `src/modules/calendar/components/QuoteModal.jsx` y `src/modules/calendar/components/quoteMobile.css`:
     - Rediseñado completamente el módulo "Gestión de Anticipos" fiel a la Imagen 3:
       * Encabezado institucional con billetera azul, badge `● Evento: [Nombre] #[Código]` y subtítulo.
       * 3 tarjetas KPI: TOTAL ANTICIPOS (con contador de aportes), SALDO PENDIENTE (con badge ámbar `Por Pagar` y vencimiento), y SALDO A FAVOR (con check esmeralda).
       * Formulario de alta gama con prefijo `Q` en Monto, selectores ejecutivos, caja de carga de comprobante con botón "Explorar" y selector de Asesor/Usuario.
       * Tabla estilizada de abonos con badges de forma de pago, fecha con hora, referencia bancaria en monospace, monto bold, botón de comprobante lightbox y acciones ✏️ / 🗑️.
       * Acordeón colapsable `LOG DE TRAZABILIDAD Y AUDITORÍA DE PAGOS` con historial auditable.
       * Pie con exportación a PDF formal y botón "Listo / Cerrar".
  5. Validado con 54 pruebas automatizadas (`node --test tests/*.test.mjs`) y compilación limpia de producción (versión 2.1.143).

### Solución: Persistencia de Abonos en Edición, Explicación de Almacenamiento en MariaDB y Rediseño Ejecutivo de Botones (`ReportsContabilidad.jsx`, `reports.css`, `reports-contabilidad-statement.test.mjs`) (2026-09-17)
- Requerimiento: Resolver error donde un abono desaparecía de la base de datos al ser editado y actualizado desde el estado de cuenta contable, explicar dónde y cómo se almacenan los abonos en el sistema, y rediseñar todos los botones del panel de pagos y modales contables (corrigiendo el botón rosa deformado de comprobante, botón de saldar, cancelar, guardar/actualizar y acciones de tabla).
- Causa raíz:
  1. Almacenamiento de abonos: Los abonos se normalizan en la tabla MariaDB `anticipos_evento` (`id`, `id_evento`, `fecha_anticipo`, `monto`, `tipo_pago`, `descripcion`, `numero_boleta`, `datos_evidencia`, etc.) y se auditan en `historial_anticipos`. En `eventos`, `cotizacion_json.advances` se sincroniza para el frontend. Al sincronizar en `syncEventsToDb`, el backend elimina de `anticipos_evento` cualquier ID que exista en la BD pero no venga en `incomingAdvances`.
  2. Causa de la desaparición al editar: En `handleSaveAdvanceInModal`, `currentAdvances` se extraía únicamente de `targetEvent.quote.advances` (leído de `events` del contexto). Si el usuario registraba un abono y de inmediato lo editaba antes de que el contexto re-renderizara el evento, `targetEvent.quote.advances` seguía vacío o desactualizado. Al buscar `advanceEditingId`, `findIndex` devolvía `-1`. Como `advanceEditingId` era verdadero pero el índice no existía, el abono no se actualizaba y se enviaba una lista vacía `[]` a `handleAddEvent`, provocando que el backend ejecutara `DELETE FROM anticipos_evento WHERE id IN (...)`, eliminando permanentemente el abono de MariaDB y dejándolo en 0.
  3. Deformación estética de botones: La regla global `body:not(.informes-theme) button` en `design-system-scoped.css` imponía `min-height: 40px` y `padding: 0 14px`. El botón para remover comprobante (`width: 32px`) quedaba con un área interna útil de 4px (`32px - 28px`), deformándose en un bloque rosa alargado con un punto rojo microscópico. Los botones "Cancelar", "Saldar Pendiente", "Ocultar Formulario" y las acciones de tabla carecían de especificidad alta y estilos SaaS modernos.
- Solución:
  1. En `src/modules/reports/ReportsContabilidad.jsx`:
     - Implementado algoritmo de consolidación multi-origen en `handleSaveAdvanceInModal` y `handleDeleteAdvanceInModal`: unifica anticipos usando `Map` desde `targetEvent.quote.advances`, `activeEventStatementRow.advances` y `activeEventStatementRow.quote.advances`.
     - Si `advanceEditingId` existe, actualiza el ítem existente y, en caso de cualquier discrepancia de índice, lo añade con su ID intacto (`currentAdvances.push(...)`), garantizando que ningún abono se descarte o borre accidentalmente.
     - Sincroniza `currentQuote` combinando ambas fuentes y recalcula saldos pendientes y a favor en tiempo real.
     - Indicador dinámico de estado en el formulario: badge "✏️ Editando Abono Registrado" con "Modo Edición" y botón "Cancelar Edición".
     - Botón de envío dinámico: "✓ Guardar Pago" (modo creación, gradiente azul) o "✓ Actualizar Abono" (modo edición, gradiente esmeralda).
  2. En `src/modules/reports/reports.css`:
     - Creadas clases de alta especificidad que neutralizan la herencia global:
       * `.acct-btn-toggle-form`: Botón conmutador con soporte para estados abierto/cerrado con borde sutil o gradiente verde.
       * `.acct-btn-saldar`: Botón esmeralda suave (`#ecfdf5`, `#065f46`, borde `#a7f3d0`) con icono de rayo.
       * `.acct-btn-cancel-form`: Botón blanco con borde slate y tipografía ejecutiva.
       * `.acct-btn-clear-file`: Botón cuadrado exacto de 36px × 36px con `padding: 0 !important` e icono X centrado de 16px nítido.
       * `.acct-btn-submit-advance`: Botón de acción principal con variantes `.is-create` y `.is-edit`.
       * `.acct-btn-row-action`: Botones compactos (28px) de tabla con variantes `.is-voucher`, `.is-edit` y `.is-delete`.
       * `.acct-btn-subrow-pay` y `.acct-btn-subrow-state`: Botones ejecutivos para la tabla de eventos de cada institución.
       * `.acct-btn-print`: Botón azul de impresión de hoja de estado de cuenta.
  3. Validado con 45 pruebas automatizadas (`node --test tests/*.test.mjs`) y build de producción exitoso (versión 2.1.138).

### Solución: Botón X de Cerrar de Alta Visibilidad, Soporte Escape y Restauración de Aplicación de Pagos/Abonos para Eventos Pasados (`ReportsContabilidad.jsx`, `reports.css`, `reports-contabilidad-statement.test.mjs`) (2026-09-17)
- Requerimiento: Resolver error visual donde el botón `✕` de cerrar en los modales de Estados de Cuenta no se apreciaba con nitidez (aparecía como un bloque alargado con un punto microscópico), y restaurar la sección interactiva de cobros/abonos dentro de la hoja de estado de cuenta para poder registrar, editar y eliminar pagos en eventos cuya fecha ya pasó (los cuales están bloqueados para edición regular en el calendario).
- Causa raíz:
  1. En `src/styles/design-system-scoped.css` (línea 103), la regla global `body:not(.informes-theme) button` imponía `min-height: 40px` y `padding: 0 14px` sobre todas las etiquetas `<button>`. Al asignarle al botón de cerrar `width: 32px`, el padding horizontal de 28px (`14px + 14px`) reducía el ancho disponible del contenido interno a solo 4px (`32px - 28px`), comprimiendo el SVG de la `X` a un punto de 4px imperceptible dentro de un bloque blanco alargado.
  2. No existía soporte para cerrar modales mediante la tecla `Escape`.
  3. Tras el rediseño formal de la hoja de estado de cuenta, la tabla de anticipos se había dejado como sólo lectura, omitiendo el formulario para registrar y aplicar pagos directamente sobre el evento desde contabilidad (especialmente necesario cuando la fecha del evento ya pasó y los usuarios no pueden ingresar a modificarlo desde el calendario).
- Solución:
  1. En `src/modules/reports/reports.css`:
     - Creada la clase de alta especificidad `.acct-modal-close-btn` con `padding: 0 12px !important`, `height: 34px !important`, `box-sizing: border-box !important` y reglas SVG fijas de `width: 16px !important`, `height: 16px !important`, `stroke-width: 2.5px !important` que neutralizan por completo la herencia global.
  2. En `src/modules/reports/ReportsContabilidad.jsx`:
     - Rediseñado el botón con formato ejecutivo `[ ✕ Cerrar ]`: icono nítido de 16px junto con texto legible "Cerrar" en tipografía bold de 12px, fondo blanco sólido `#ffffff`, texto e icono `#0f172a`, borde visible `#cbd5e1`, esquinas redondeadas (8px) y animación de hover en rojo elegante (`#fee2e2` y `#dc2626`).
     - Agregada barra inferior de acciones rápidas (con clase `no-print`) en el modal con botón "Cerrar" adicional y botón "Imprimir Estado".
     - Implementado listener global de la tecla `Escape` para cerrar cualquier modal activo (`previewVoucher`, `activeEventStatementRow`, `activeStatementCompanyId`).
     - Agregado botón directo "💳 Aplicar Pago" en la fila expandida de eventos de cada institución en la tabla general.
     - Restaurado y optimizado el panel interactivo de cobros/abonos dentro del estado de cuenta del evento:
       * Permite registrar abonos con Monto, Fecha, Forma de Pago (`Transferencia`, `Depósito`, `Cheque`, `Tarjeta`, `Efectivo`), No. de Boleta / Referencia Bancaria, Concepto / Descripción y Comprobante adjunto comprimido (`compressEvidenceFile`).
       * Botón rápido "⚡ Saldar Pendiente" para auto-completar el valor exacto adeudado en un clic.
       * Acciones en la tabla de abonos: "Editar" (carga el pago al formulario para modificarlo) y "Eliminar" (con confirmación de SweetAlert2).
       * Sincronización inmediata vía `handleAddEvent({ ...event, quote })` que persiste los cambios en MariaDB sin importar si el evento es pasado, y actualiza los saldos y KPIs en tiempo real.
       * El formulario y los botones de acción cuentan con la clase `no-print`, asegurando que al imprimir sólo salga la hoja formal limpia.
  3. Validado con 44 pruebas unitarias automatizadas (`node --test tests/*.test.mjs`) y build de producción limpio (versión 2.1.137).

### Solución: Rediseño Ejecutivo de Estados de Cuenta Contables, Buscador Óptimo con Enter y Hoja Formal por Evento con Categorías y Boletas (`ReportsContabilidad.jsx`, `reports.css`, `reports-contabilidad-statement.test.mjs`) (2026-09-17)
- Requerimiento: Rediseñar integralmente el módulo de Estados de Cuenta Contables en Reportes a partir de maqueta de referencia: barra institucional superior (JL / sincronización bancaria), 5 tarjetas KPI (Instituciones, Venta Neta, Cobrado con % amortización, Saldo Pendiente con contador de mora, Saldo a Favor), banner de diagnóstico de cartera, motor de búsqueda optimizado bajo demanda (disparado con tecla Enter o botón Aplicar para evitar lag en miles de eventos, atajo Ctrl+K, botón de limpiar), pestañas de estado (Todos, Vencidos, Por Vencer, Al Día, Saldo a Favor), tabla con días de vencimiento, contacto con desglose y propuesta de cobro. Adicionalmente, hoja formal de estado de cuenta por evento específico con membrete de Jardines del Lago, desglose de cotización seccionado por categorías (Alimentos & Bebidas, Habitaciones / Hospedaje, Misceláneos & Servicios, Otros), resumen financiero de 4 bloques, tabla cronológica de abonos con No. de Boleta bancaria, visor lightbox de boletas de pago, cuentas bancarias autorizadas y bloque de firmas imprimible.
- Causa raíz:
  1. La pantalla anterior de contabilidad carecía de la estructura ejecutiva corporativa solicitada en la maqueta de referencia.
  2. El filtro de búsqueda ejecutaba filtrados de texto letra por letra sobre miles de eventos provocando congelamientos en el navegador.
  3. No existía una hoja formal por evento individual con desglose por categorías (Alimentos & Bebidas, Habitaciones, Misceláneos), ni visualizador de comprobantes de pago/boletas adjuntas.
  4. Contaminación de `companyId: '10'`: Más de 250 cotizaciones históricas clonadas o duplicadas heredaban el identificador residual `companyId: '10'` (asociado a la empresa '60 AÑOS MIRNA CANO'). Al agrupar por `row.companyId`, eventos de otras instituciones (como MAICON IXCOL, THE NATURE CONSERVANCY, COONAGRI, etc.) se acumulaban erróneamente bajo '60 AÑOS MIRNA CANO' inflando la venta a Q 4.7M y 153 eventos.
- Solución:
  1. En `src/modules/reports/ReportsContabilidad.jsx`:
     - Implementado encabezado institucional con badge `JL`, indicador en vivo de sincronización con bancos, botón "Volver" y exportación a Excel en dos hojas (`Cartera por Empresa` y `Detalle de Eventos`).
     - 5 tarjetas KPI dinámicas y banner `Diagnóstico de Cartera`.
     - Buscador de alto rendimiento bajo demanda activado con `Enter`, botón "Aplicar Filtros" y atajo `Ctrl + K`.
     - Pestañas de estado con badges de conteo y filtros secundarios completos.
     - Expansión de cartera por empresa mediante botón `Detalle`, desplegando la lista de eventos con acceso a la `📄 Hoja Evento`.
     - Modal de Hoja Formal de Estado de Cuenta por Evento con función de categorización insensible a diacríticos (`categorizeQuoteItems`), resumen financiero, historial de abonos con comprobantes, cuentas bancarias e impresión limpia vía `window.print()` y CSS print.
     - Lightbox Modal para visualización y ampliación de boletas de pago.
     - Iconografía minimalista vectorial exclusiva de `lucide-react`.
     - Corregido `ReferenceError: React is not defined` importando explícitamente `React` y `Fragment` desde `'react'` para compatibilidad plena con la transformación JSX de React 19 y Vite.
     - Incorporadas funciones canónicas `resolveEventCompany` y `resolveEventContact` con token de empresa único (`companyToken`): si una cotización tiene `companyId: '10'` pero su nombre explícito es otro (ej. "COONAGRI"), valida la coincidencia y rechaza el ID huérfano, agrupando cada evento en su institución legítima.
     - Filtrado estricto de eventos confirmados: En estados de cuenta contables, la cartera de cobro registra exclusivamente eventos con estado `Confirmado` (descartando prospectos comerciales en `Seguimiento`, `1er Cotización`, `Pre reserva`, etc., evitando falsos pasivos contables).
     - Descarte de borradores huérfanos con fecha `1970-01-01` y `(sin nombre)`: Se eliminan del cálculo contable los registros fantasma generados por cotizaciones que nunca tuvieron un evento de calendario asignado o que fueron duplicadas residualmente.
  2. En `src/modules/reports/reports.css`:
     - Incorporadas clases CSS BEM (`.acct-page-container`, `.acct-kpi-grid`, `.acct-kpi-card`, `.acct-diagnostic-banner`, `.acct-filters-panel`, `.acct-search-row`, `.acct-status-pills`, `.acct-table`, `.acct-pagination-bar`) y estilos de impresión formal `@media print`.
  3. Validado con 43 pruebas unitarias automatizadas (`node --test tests/*.test.mjs`) y compilación limpia de producción (versión 2.1.135).

### Solución: Endpoints Dedicados de Tipo de Cambio, Historial Cronológico por Fecha de Evento y Corrección de 404/SyntaxError (`server.cjs`, `SettingsTipoCambio.jsx`, `stateService.js`, `QuoteModal.jsx`, Reportes) (2026-09-17)
- Requerimiento: Resolver error HTTP 404 al consultar y guardar tipo de cambio (`GET/PUT /api/exchange-rate 404 Not Found`), dotar al tipo de cambio de su propia tabla relacional y endpoints atómicos dedicados, y asegurar que cada evento/cotización calcule su tipo de cambio según la fecha del evento sin alterar el valor de eventos pasados cuando la tasa cambie en el futuro.
- Causa raíz:
  1. En `server.cjs`, la consulta de base de datos para el historial se había colocado dentro de la función síncrona `events: (() => { ... })()`, disparando un `SyntaxError: await is only valid in async functions`. Esto impedía el arranque del servidor con los nuevos endpoints y provocaba que el proceso Node en ejecución (iniciado antes de las adiciones) continuara devolviendo 404 Not Found.
  2. El sistema únicamente admitía un valor escalar global para el tipo de cambio; al cambiar de Q 7.75 a Q 7.80, todos los eventos históricos pasados cambiaban retroactivamente alterando los cierres de ventas y balances contables anteriores.
  3. Las vistas de reportes y cotización no reflejaban la fecha de referencia ni la tasa bajo la cual se calculó la conversión a Quetzales.
- Solución:
  1. En `server.cjs`:
     - Creada tabla relacional `tipo_cambio_historial` (`id`, `fecha_vigencia DATE`, `tasa DECIMAL(10,4)`, `notas`, `creado_en`, `actualizado_en`) registrada en migraciones canónicas.
     - Implementado algoritmo `resolveRateForEvent(evDateStr)` en `readStateFromTables`: si un evento ocurrió en el pasado (ej. mayo 2024), busca cronológicamente la tasa vigente en esa fecha exacta y asocia `quote.exchangeRate`, `quote.exchangeRateDate`, `quote.totalGtq`, `quote.subtotalGtq` y `quote.discountAmountGtq`.
     - Endpoints atómicos dedicados: `GET /api/exchange-rate`, `GET /api/exchange-rate/resolve?date=YYYY-MM-DD`, `POST /api/exchange-rate/history`, `PUT /api/exchange-rate/history/:id`, `DELETE /api/exchange-rate/history/:id` y compatibilidad legacy con `PUT /api/exchange-rate`.
     - Corregido `SyntaxError` moviendo la consulta `conn.query` al ámbito asíncrono superior de `readStateFromTables` y reiniciado el proceso en puerto 3000.
  2. En `src/services/stateService.js`:
     - Métodos cliente: `getExchangeRateDataApi()`, `addExchangeRateHistoryApi()`, `updateExchangeRateHistoryApi()`, `deleteExchangeRateHistoryApi()` y `resolveExchangeRateAtDateApi()`.
  3. En `src/modules/settings/SettingsTipoCambio.jsx`:
     - Rediseño ejecutivo con tarjeta KPI de tasa activa actual, formulario para agregar/editar tasas de cambio por fecha de vigencia, tabla cronológica de historial con acciones y badges visuales, y guía explicativa.
  4. En `QuoteModal.jsx`:
     - Consulta automática de la tasa correspondiente a la fecha del evento con `resolveExchangeRateAtDateApi`, guardado persistente de `exchangeRateDate` y badge visual informativo en el selector de moneda.
  5. En `ReportsVentas.jsx`, `ReportsContabilidad.jsx` y `eventSeriesUtils.js`:
     - Badge informativo visible en las columnas de Monto Total: `$1,000.00 USD` con etiqueta `TC Q 7.75 (dd/mm/aaaa)`.
  6. Validado con 39 pruebas unitarias automatizadas (`node --test tests/*.test.mjs`) y compilación limpia de producción (versión 2.1.128).

### Solución: Rediseño Ejecutivo y Corrección de Checkboxes Gigantes en Configurar Columnas (`ReportsVentas.jsx`) (2026-09-17)
- Requerimiento: Mejorar el diseño del modal "Configurar Columnas Visibles" en el Reporte de Ventas, donde los checkboxes se mostraban como bloques azules gigantes y desalineados ocupando la pantalla de forma desfigurada.
- Causa raíz:
  1. Reglas globales en `design-system-scoped.css` y `global-scoped.css` (`body:not(.informes-theme) input:not(.search-input-naked)`) imponían `min-height: 42px`, `padding: 10px 12px`, y bordes sobre todos los elementos `<input>` sin excluir checkboxes ni radios, inflando los inputs nativos a cajas enormes de más de 40px con texto desalineado.
  2. El modal carecía de diseño SaaS moderno, soporte de acciones rápidas (mostrar todas, esenciales, restablecer), contador de columnas activas, persistencia de preferencias entre sesiones y cierre por tecla Escape o clic afuera.
- Solución:
  1. Eliminados por completo los `<input type="checkbox">` nativos del modal y reemplazados por tarjetas interactivas de alta gama con switches de alternancia estilo iOS encapsulados con SVG e inmunes a cualquier herencia de CSS global.
  2. Cada columna cuenta con icono vectorial alusivo, paleta cromática identificatoria y descripción explicativa.
  3. Cuadrícula adaptable de 2 columnas en desktop / 1 columna en móvil, con cabecera ejecutiva con barra de degradado y badge dinámico de conteo en vivo (`X de 9 visibles`).
  4. Barra de acciones rápidas: "Mostrar todas", "Esenciales" y "Restablecer", junto con protección para impedir apagar la última columna visible.
  5. Persistencia automática en `localStorage` (`crm_reports_ventas_columns_v1`) y escucha de evento `Escape` y backdrop para cierre intuitivo.
  6. Actualizado el botón "Columnas" en el encabezado de la tabla para reflejar dinámicamente cuántas columnas están activas (`Columnas X/9`) y destacar si hay filtros activos.
  7. Validado con 34 pruebas automatizadas (`node --test tests/*.test.mjs`) y compilación limpia de producción (versión 2.1.127).

### Solución: Conversión Integral y Automática de Dólares (USD) a Quetzales (GTQ) en Reportes y Cotizaciones (`server.cjs`, `QuoteModal.jsx`, `eventSeriesUtils.js`, Módulos de Reportes y Clientes) (2026-09-17)
- Requerimiento: Las cotizaciones en Dólares (USD) no se convertían a Quetzales en los reportes, KPIs y métricas del sistema, mostrándose montos nominales en dólares con el signo de Quetzales (ej. $1,000 USD se sumaba y mostraba como Q 1,000.00 en vez de Q 7,750.00).
- Causa raíz:
  1. `QuoteModal.jsx` guardaba cotizaciones en USD con `total` y `currency: 'USD'`, pero no leía `exchangeRate` ni persistía `totalGtq` ni `subtotalGtq`.
  2. `server.cjs` en `readStateFromTables` entregaba el JSON crudo sin enriquecer cotizaciones existentes ni calcular la conversión a moneda local usando `exchangeRate`.
  3. Múltiples reportes intentaban leer `quote.totalGtq || quote.total || 0` (cayendo en el total en dólares por ser `totalGtq` indefinido), mientras que otros leían directamente `quote.total` sin contemplar la moneda.
- Solución:
  1. En `server.cjs`: Inyección retroactiva automática en `readStateFromTables` de `totalGtq`, `subtotalGtq`, `discountAmountGtq` y `exchangeRate` para cada cotización en USD según el tipo de cambio configurado en `app_state_kv`.
  2. En `QuoteModal.jsx`: Guardado automático de `totalGtq`, `subtotalGtq` y `exchangeRate` al cotizar en USD usando el tipo de cambio activo de configuración.
  3. En `eventSeriesUtils.js`: Funciones estándar `getQuoteFinancialAmounts(quote, exchangeRate)` y `getQuoteTotalGtq(quote)`.
  4. En `ReportsVentas.jsx`, `ReportsComisiones.jsx`, `ReportsContabilidad.jsx`, `ReportsDashboard.jsx`, `ReportsInstitucion.jsx`, `ReportsProyeccionMetas.jsx`, `ReportsSeguimientosPendientes.jsx`, `ReportsEficenciaConfirmacion.jsx`, `ReportsIngresosCategorias.jsx`, `ReportsOcupacion.jsx` y `CustomersModule.jsx`: Migrados para usar montos convertidos en Quetzales, con indicador visual de monto original en USD en Ventas y Contabilidad.
  5. Validado con 33 pruebas unitarias (`node --test tests/*.test.mjs`) y build de producción limpio (versión 2.1.125).

### Solución: Error 413 (Payload Too Large) al Modificar Tipo de Cambio y Configuraciones de `app_state_kv` (`SettingsTipoCambio.jsx`, `stateService.js`, `server.cjs`, `SettingsCitas.jsx`, `SettingsMantenimiento.jsx`, `SettingsGlobalGoals.jsx`) (2026-09-17)
- Requerimiento: Resolver error HTTP `413 (Payload Too Large)` y `ApiError: Error interno del servidor` al guardar el tipo de cambio USD a GTQ en producción desde el panel de Configuración.
- Causa raíz:
  1. `SettingsTipoCambio.jsx` ejecutaba `const currentState = await loadCrmState(); await saveCrmState({ ...currentState, exchangeRate: num });`, enviando el estado completo de MariaDB (más de 17 MB con eventos, cotizaciones completas en JSON, historial, etc.) en un solo `PUT /api/state`.
  2. En local, la base de datos de pruebas era pequeña y no pasaba por proxy inverso. En producción, Nginx o Cloudflare tienen configurado `client_max_body_size` y rechazan peticiones que superan el límite con HTTP 413.
- Solución:
  1. En `server.cjs`:
     - Implementados endpoints atómicos dedicados: `GET /api/exchange-rate` y `PUT /api/exchange-rate` (y `POST /api/exchange-rate`) que operan directamente sobre la fila `clave = 'exchangeRate'` de `app_state_kv` en MariaDB y emiten `state-updated` vía Socket.io.
     - Implementados endpoints atómicos de configuración genérica con lista blanca segura: `GET /api/settings/:key` y `PUT /api/settings/:key` (y `POST /api/settings/:key`).
  2. En `src/services/stateService.js`:
     - Implementados y exportados `getExchangeRateApi()`, `saveExchangeRateApi(rate)`, `getSettingApi(key)` y `saveSettingApi(key, value)`, reduciendo los paquetes de red de 17 Megabytes a ~25 bytes (<1 KB).
  3. En `src/modules/settings/`:
     - `SettingsTipoCambio.jsx` refactorizado para usar `saveExchangeRateApi` y `getExchangeRateApi`, eliminando `saveCrmState`.
     - `SettingsCitas.jsx`, `SettingsMantenimiento.jsx` y `SettingsGlobalGoals.jsx` migrados a `saveSettingApi` protegiendo todas las pantallas de configuración contra el error 413.
  4. Validado con 29 pruebas automatizadas (`node --test tests/*.test.mjs`) y compilación limpia con `npm run build` (versión 2.1.123).

### Solución: Estandarización VAPID RFC 8292 y Diagnóstico / Corrección Integral para Web Push en iOS (`webPushService.js`, `public/sw.js`, `SocketContext.jsx`, `.env`) (2026-09-16)
- Requerimiento: Eliminar la variable legacy `VITE_FIREBASE_VAPID_KEY` para usar únicamente el par de claves VAPID estándar (`VAPID_PUBLIC_KEY` y `VAPID_PRIVATE_KEY`), resolver por qué no aparecían las notificaciones push en iOS (iPhone/iPad) y clarificar la configuración requerida.
- Causa raíz:
  1. En `public/sw.js`, existía una verificación `if (data.data?.autorId && activeUserId && String(data.data.autorId) === String(activeUserId)) return;` que descartaba silenciosamente la notificación sin llamar a `showNotification()`. Al realizar pruebas mencionándose a sí mismo o con la misma cuenta entre computadora y teléfono, la notificación era recibida de Apple APNs pero eliminada en el dispositivo.
  2. En `src/services/webPushService.js`, cada vez que se ejecutaba la función se llamaba `existingSub.unsubscribe()`. En iOS Safari/PWA, desuscribirse y luego suscribirse en un `useEffect` (sin gesto físico del usuario) fallaba o generaba acumulación masiva de suscripciones obsoletas (más de 40 por usuario).
  3. En `src/modules/informes/context/SocketContext.jsx`, la función `showBrowserNotif` invocaba `new Notification()`, lo cual arroja un `TypeError` fatal en WebKit iOS porque Apple solo soporta `ServiceWorkerRegistration.showNotification()`.
  4. En iOS (iOS 16.4+), Apple impone tres requisitos mandatorios de plataforma:
     - La app DEBE estar agregada a la Pantalla de Inicio (modo PWA Standalone). En pestañas normales de Safari el PushManager está deshabilitado por Apple.
     - La solicitud de permisos (`Notification.requestPermission()`) DEBE ocurrir en respuesta a un gesto físico del usuario (toque en pantalla/botón).
     - En Ajustes de iOS > Notificaciones > [CRM JDL], los permisos deben estar concedidos.
- Solución:
  1. En `.env`, se eliminó completamente `VITE_FIREBASE_VAPID_KEY` y se estandarizó en `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` y `VITE_VAPID_PUBLIC_KEY`.
  2. En `src/services/webPushService.js`, se eliminó `VITE_FIREBASE_VAPID_KEY`, se blindó la reutilización de suscripciones activas existentes sin desuscribir innecesariamente, y se modularizó `saveSubscriptionToBackend`.
  3. En `public/sw.js`, se eliminó el bloqueo de autoría propia para garantizar que las notificaciones siempre se muestren en el dispositivo destino.
  4. En `SocketContext.jsx`, se blindó `showBrowserNotif` con verificación de Service Worker y captura de excepciones para prevenir fallos en iOS.
  5. Se probó el envío directo a Apple APNs (`https://web.push.apple.com/...`), confirmando respuesta HTTP 201 Created con el par de claves VAPID actual.
  6. Validado con 23 pruebas automatizadas (`node --test tests/*.test.mjs`) y compilación limpia con `npm run build` (versión 2.1.122).
### Solución: Apertura Masiva de Tarjetas por Mención y Notificaciones Web Push Móviles (`Kanban.jsx`, `EventCard.jsx`, `webPushService.js`, `webPushHelper.js`, `sw.js`) (2026-09-16)
- Requerimiento: Al pulsar una notificación de mención ("Te mencionaron en una nota"), todas las tarjetas del tablero Kanban se abrían simultáneamente con el formulario "Escribe una nota... Enviar". Adicionalmente, las notificaciones push no llegaban a dispositivos móviles (Android / iOS).
- Causa raíz:
  1. En `src/modules/informes/pages/Kanban.jsx`, la prop `highlightNotaId={searchParams.get('notaId')}` se enviaba indiscriminadamente a todas las tarjetas de eventos. En `EventCard.jsx`, `useState(() => Boolean(highlightNotaId))` evaluaba a `true` en cada tarjeta, desplegando el cajón de notas y el input en todas las tarjetas de la semana.
  2. En `.env`, existía una discrepancia entre la clave pública VAPID leída por el frontend (`VITE_FIREBASE_VAPID_KEY=BKl_-3yxf...`) y las claves usadas por el backend (`VAPID_PUBLIC_KEY=BBw5b_6...` y `VAPID_PRIVATE_KEY=wDGjv...`), ocasionando rechazos HTTP 401/403 por Google FCM y Apple WebPush.
  3. En `backend/src/helpers/webPushHelper.js`, ante un error 401/403 se borraba agresivamente la suscripción de la base de datos (`DELETE FROM push_subscriptions`). Además, el payload no incluía el objeto anidado `data: { url, autorId }`, impidiendo que `public/sw.js` reconociera la URL de destino al hacer clic.
  4. En `public/sw.js`, la llamada `vibrate: [100, 50, 100]` no estaba resguardada contra navegadores iOS Safari/PWA que no soportan la API Vibration.
- Solución:
  1. En `Kanban.jsx`, se condicionó `highlightNotaId` para que solo se pase a la tarjeta que coincida con el ID de ocupación mencionado (`eventoResaltado === String(event.Idocupacion) || searchParams.get('highlightEvento') === String(event.Idocupacion)`), pasando `null` a todas las demás. En `EventCard.jsx`, se añadió un `useEffect` para reaccionar abriendo únicamente la tarjeta correspondiente.
  2. Se unificaron las claves VAPID en `.env` y se actualizó `src/services/webPushService.js` para consultar dinámicamente la clave pública desde el endpoint del backend `GET /api/push/vapid-public-key` y renovar suscripciones previas obsoletas.
  3. En `webPushHelper.js`, se utilizó el pool compartido de base de datos (`../config/db.js`), se incluyó `data: { ...data, url: targetUrl }` en el payload y se limitó la eliminación de suscripciones únicamente a códigos 404 y 410.
  4. En `public/sw.js`, se resguardó la propiedad `vibrate` con `'vibrate' in navigator` y se garantizó la resolución de URLs en el evento `notificationclick`.
  5. Validado con 23 pruebas automatizadas (`node --test tests/*.test.mjs`) y compilación limpia con `npm run build` (versión 2.1.121).

### Solución: Selector de Vistas Comprimido en Ocupación Semanal (`Kanban.jsx`, `styles.css` y `search.css`) (2026-09-16)
- Requerimiento: Resolver el error visual en los filtros superiores de Ocupación Semanal (Kanban) donde los botones "Ocupación", "Tabla" y "Tareas" aparecían encogidos, truncados y desfigurados como `Ocupa | Tab | Tare`.
- Causa raíz:
  1. En `src/modules/search/search.css` (línea 818), existía un selector no acotado `.view-toggle-btn` (diseñado exclusivamente para la vista de lista/cuadrícula de 32x32px del módulo de búsqueda) con reglas `width: 32px !important; min-width: 32px !important; max-width: 32px !important; padding: 0 !important;`.
  2. Al tener `!important` y selectores globales, colisionaba con los botones del conmutador de vistas de Kanban (`.kanban-filter .view-toggle-btn`), forzándolos a un ancho fijo diminuto de 32 píxeles y cortando el texto y los iconos.
- Solución:
  1. En `src/modules/search/search.css`, se eliminó el selector global descontextualizado y se restringió estrictamente a `.search-page-saas .search-view-toggle .view-toggle-btn`.
  2. En `src/modules/informes/styles.css`, se reforzó `.kanban-filter .view-toggle` y `.kanban-filter .view-toggle-btn` con ancho flexible automático (`width: auto !important`, `min-width: unset !important`), padding generoso de 10px, borde redondeado de 7px, tipografía nítida y soporte completo para modo claro y modo oscuro.
  3. Verificado con pruebas automatizadas (`node --test tests/*.test.mjs`) y compilación limpia con `npm run build` (versión 2.1.120).

### Solución: Campos oscuros en Edición de Plantillas y Configuración (`SettingsPlantillas.jsx` y `settings.css`) (2026-09-16)
- Requerimiento: Resolver por qué los campos de texto "Nombre de la plantilla" y el buscador "Agregar servicio" aparecían con fondo oscuro / negro en la pantalla de editar o crear plantillas de cotización.
- Causa raíz:
  1. `src/styles/global-scoped.css` (líneas 153 y 838) define una regla con selector de alta especificidad `body:not(.informes-theme) input:not(.search-input-naked)` que impone un degradado oscuro glassmórfico (`linear-gradient(180deg, rgba(30, 41, 59, 0.78), rgba(15, 23, 42, 0.72))`) y color de texto blanco destinado a los modales del calendario.
  2. Los selectores de `settings.css` (`.settings-modern-field input` y `.settings-input-compact`) tenían menor especificidad CSS y no utilizaban `!important` para el estado en reposo, siendo sobreescritos por el degradado oscuro.
  3. En `SettingsPlantillas.jsx`, los inputs carecían de estilos directos de color de fondo y texto.
- Solución:
  1. En `src/modules/settings/settings.css` (Sección 16 `Input background safeguard`), se blindaron todos los inputs, selects y textareas dentro de `.settings-page`, `.settings-section-card`, `.settings-modern-field` y `.settings-input-compact` con `background: #ffffff !important`, `color: #0f172a !important`, `border: 1px solid #cbd5e1 !important` y placeholders legibles `#94a3b8 !important`.
  2. En `src/modules/settings/SettingsPlantillas.jsx`, se agregaron estilos inline directos con fondo `#ffffff`, texto `#0f172a`, bordes nítidos `#cbd5e1` y padding adecuado en los 4 inputs del módulo: "Nombre de la plantilla", "Agregar servicio", y las columnas "Cantidad" y "Precio unitario" de la tabla.
  3. Verificado con pruebas automatizadas (`node --test tests/*.test.mjs`) y compilación limpia con `npm run build` (versión 2.1.119).

### Solución Integral: Tablas Relacionales para Plantillas de Cotización y Sincronización Automática con Servicios (2026-09-16)
- Requerimiento: Al editar un servicio en el catálogo (su nombre, precio o modo de cantidad), las plantillas de cotización no se actualizaban porque no tenían relación relacional en la base de datos (se guardaban como JSON monolítico en `app_state_kv`). Crear tablas dedicadas para las plantillas en MariaDB, vincular sus ítems directamente con la tabla `servicios` y sincronizar automáticamente cualquier cambio.
- Causa raíz:
  1. Las plantillas se almacenaban serializadas como strings en `app_state_kv.valor_json` (`quickTemplates` y `quoteServiceTemplates`).
  2. Cada ítem de plantilla guardaba snapshots de texto desconectados sin `JOIN` ni relación foránea con `servicios`.
  3. Al editar servicios en `SettingsServicios.jsx`, las plantillas conservaban los valores antiguos.
  4. `SettingsPlantillas.jsx` utilizaba `saveState()` enviando todo el estado del CRM (17 MB), susceptible al error 413.
- Solución:
  1. Tablas relacionales en MariaDB creadas en `server.cjs` (`ensurePlantillasStructure`):
     - `plantillas_cotizacion`: `id VARCHAR(255) PRIMARY KEY`, `nombre`, `activo`, timestamps.
     - `plantillas_cotizacion_items`: `id VARCHAR(255) PRIMARY KEY`, `id_plantilla` (FK cascade), `id_servicio` (FK set null hacia `servicios`), `nombre_servicio`, `cantidad`, `precio_unitario`, `modo_cantidad`, `orden`, timestamps.
     - Migración automática en startup que transfiere las plantillas existentes desde `app_state_kv` vinculando cada ítem a su respectivo `servicios.id`.
  2. Sincronización automática y lectura con `JOIN`:
     - `readPlantillasFromTables` hace `LEFT JOIN servicios s ON s.id = i.id_servicio`, garantizando que el nombre, precio actual, modo de cantidad y estado activo provengan directamente de `servicios`.
     - Al editar un servicio en `updateServicioInTable`, se actualizan los ítems vinculados y se emite el evento socket/web `entity:changed` con `plantilla:updated`.
  3. Endpoints atómicos:
     - `GET /api/plantillas`, `POST /api/plantillas` y `DELETE /api/plantillas/:id` en `server.cjs`.
     - Métodos cliente `getPlantillasApi()`, `savePlantillaApi()` y `deletePlantillaApi()` en `src/services/stateService.js`.
  4. Reactividad en frontend:
     - `SettingsPlantillas.jsx` resuelve ítems contra `services` con `getResolvedItem`, muestra badge "Sincronizado con catálogo" y escucha eventos `entity:changed`.
     - `QuoteModal.jsx` resuelve ítems dinámicamente con `catalogServices` en `handleApplyTemplate`.
  5. Validado con 17 pruebas automatizadas (`node --test tests/*.test.mjs`) y compilación limpia con `npm run build` (código 0).

### Solución Integral: Edición/Creación de Servicios, Cierre de Modales por Clic Afuera y Error 413 (2026-09-16)
- Requerimiento: Resolver error `413 Payload Too Large` y `ApiError: Error interno del servidor` al crear o editar servicios en el Panel de Configuración (`SettingsServicios.jsx`) y en la Cotización (`QuoteModal.jsx`), evitar que los modales se cierren accidentalmente al hacer clic en el backdrop ("clic falso afuera"), agregar botón explícito `✕` de cierre, y blindar el fallback offline de `sw.js`.
- Causa raíz:
  1. `SettingsServicios.jsx` y `QuoteModal.jsx` ejecutaban `saveCrmState()` para guardar servicios individuales, enviando el estado completo de MariaDB (más de 17 MB con eventos, cotizaciones, historial, etc.) en un solo `PUT /api/state`, rechazado con 413 por Nginx.
  2. El contenedor overlay de los modales de Servicio, Categoría y Subcategoría poseía `onClick={() => setShow...Modal(false)}`. Al arrastrar texto o hacer un clic involuntario en el fondo, el formulario se destruía inmediatamente.
  3. En `public/sw.js`, el bloque `.catch()` de assets estáticos devolvía promesas encadenadas que resolvían en `undefined`, disparando `TypeError: Failed to convert value to 'Response'`.
  4. La columna `servicios.id` tenía restricción `VARCHAR(30)` en MariaDB.
- Solución:
  1. Endpoints y métodos atómicos: `saveServiceApi`, `deleteServiceApi`, `batchImportServicesApi`, `saveCategoryApi`, `deleteCategoryApi`, `saveSubcategoryApi` y `deleteSubcategoryApi` en `src/services/stateService.js` reduciendo el payload de 17 MB a <1 KB con respuesta en milisegundos.
  2. `server.cjs` reforzado con:
     - Inserción/actualización segura (`upsert`) en `createServicioInTable` y `updateServicioInTable`.
     - Resolución automática de `id_categoria` y `id_subcategoria` a partir de nombres de categoría/subcategoría o IDs explícitos.
     - Endpoint de importación en lote `POST /api/servicios/batch` y eliminación `DELETE /api/subcategorias-servicio/:id`.
     - Migración automática al inicio: `ALTER TABLE servicios MODIFY COLUMN id VARCHAR(255) NOT NULL`.
  3. Blindaje de modales en `SettingsServicios.jsx`: Removido el handler de cierre involuntario en el backdrop de los tres modales e integrados botones de cierre `✕` estilizados y accesibles con soporte `aria-label`.
  4. `QuoteModal.jsx` migrado a `saveServiceApi` para creación y conmutación de estado activo en catálogo de servicios.
  5. `public/sw.js` corregido con `async/await` garantizando fallback a `new Response('Offline', { status: 503 })`.
  6. Validado con 10 pruebas unitarias automatizadas (`node --test tests/*.test.mjs`) y compilación de producción `npx vite build` limpia (código 0).

### Solución Integral: Creación de Empresas, Encargados, Error 413 y Service Worker (2026-09-15)
- Requerimiento: Resolver error `413 Payload Too Large` y `TypeError: Failed to convert value to 'Response'` en `sw.js` al crear o editar empresas y encargados, evitar que las observaciones se borren al recargar, flexibilizar validaciones bloqueantes en `QuoteModal.jsx` y `SettingsEmpresas.jsx`, y ampliar la longitud de la clave primaria en la base de datos MariaDB.
- Causa raíz:
  1. `saveCrmState` enviaba todo el estado de la base de datos (16.9 MB) en una sola petición HTTP POST para guardar una empresa, provocando rechazo 413 en Nginx.
  2. `sw.js` retornaba promesas no resueltas de `caches.match()` en el handler offline en vez de un objeto `Response`.
  3. `server.cjs` leía `c.notes` en vez de `c.notas`, perdiendo las notas en recarga.
  4. La columna `empresas.id` tenía restricción `VARCHAR(30)` frente a IDs largos.
  5. UI exigía 8 campos obligatorios rígidos y bloqueaba si no se hacía clic explícito en `+ Encargado`.
- Solución:
  1. Endpoints atómicos en `server.cjs`: `POST /api/companies`, `POST /api/companies/:id/managers` y `DELETE /api/companies/:id` reduciendo el payload de 17MB a <1KB (570 bytes).
  2. Columna `empresas.id` ampliada a `VARCHAR(200)` en MariaDB preservando la llave foránea `fk_encargados_empresa`, y registrada en las migraciones de inicio.
  3. `sw.js` y `dist/sw.js` refactorizados con `async/await` y respuesta de respaldo `Response('Offline', { status: 503 })`.
  4. `QuoteModal.jsx` y `SettingsEmpresas.jsx` migrados a llamadas atómicas con autoguardado de encargados borrador y relajación de campos secundarios.
  5. Verificado con prueba automatizada y compilación de producción `npx vite build` (código 0).

### Rediseño Ejecutivo: Vista de Calendario Semanal y Cuadrícula Horaria (`Calendar.jsx`, `Topbar.jsx`, `Legend.jsx`) (2026-09-15)
- Requerimiento: Rediseñar integralmente la pantalla de **Calendario** (Vista `Semana` y estructura ejecutiva) según el código HTML de referencia y mockup visual de alta fidelidad "Jardines EMS — Sistema de Gestión y Calendario de Eventos", eliminando la apariencia tosca y desproporcionada sin remover ninguna función existente (arrastre para reserva, doble clic, clics en eventos, filtros y tooltips).
- Solución:
  1. Topbar ejecutiva de 2 filas sincronizada:
     - Fila 1: Botón `[📅 Hoy]`, chevrons integrados `[ ‹ | › ]`, badge de rango semanal (`13 sept — 19 sept 2026 S37 ⌵`), selector segmentado de vistas con `Semana` activa en esmeralda institucional (`text-emerald-700 bg-white shadow-xs`), e indicador pulsante `● En vivo`.
     - Fila 2: Selector de Salones (`Todos los Salones (N)`), Selector de Vendedores (`Todos los Vendedores`) y barra OmniSearch con atajo `⌘K`.
  2. Barra de Estados / Filtros interactiva (`Legend.jsx`):
     - Encabezado con icono `FILTROS`.
     - Chip activo `● Todos {N}` en negro carbón (`#0f172a`) con punto esmeralda.
     - 10 chips cromáticos por cada estado (Sin Cotización, Pre-reserva, Confirmado, 1er Cotización, Seguimiento, Lista de Espera, Perdido, Cancelado, Mantenimiento, Mantenimiento Realizado) con conteo dinámico de eventos en el rango visible.
     - Botón `✕ Limpiar filtros` y badge `{N} eventos` en monospace.
     - Interactividad instantánea: el clic en cualquier chip filtra la vista y recalcula de inmediato los totales.
  3. Encabezados Sticky de Días (`cal-week-header`):
     - Columna `HORA` (80px) con texto monospace y cápsula `GMT-6`.
     - 7 columnas de días con nombre del día, badges dinámicos de ocupación (`Alta ocupación`, `{N} eventos`, `Libre`), número de día (20px) y mes abreviado.
     - Columna de **Hoy** destacada en verde esmeralda (`bg-emerald-50/40 border-b-2 border-emerald-500`), número en círculo verde esmeralda `15`, texto de mes completo `Septiembre`, badge `HOY` y punto verde pulsante.
  4. Cuadrícula Horaria y Tarjetas de Eventos Ejecutivas:
     - Altura de slot ajustada a 84px exactos (`HOUR_HEIGHT = 84`), con marcas de tiempo en monospace de `06:00` a `24:00`.
     - Tarjetas de eventos con borde izquierdo de 4px en el color del estado, fondo en degradado sutil (`bg-gradient-to-b from-white to-.../12`), chip de estado con código abreviado (`P`, `PR`, `1C`, `CAN`), título en negrita ejecutiva, píldora de horario con reloj SVG, badge de salón, vendedor, PAX y cotización monetaria formal (`Q 11,450.00` o `Cot Q 0.00`).
     - Distribución limpia en carriles paralelos (`lane`) para eventos simultáneos.
     - Conservadas todas las funcionalidades originales: clic para navegar a `/reserva/:id`, selección por arrastre de celdas para `/nueva-reserva`, doble clic y tooltip flotante con información completa.
  5. Barra de estado inferior (`QuickFooterStatusBar`):
     - Barra de 32px con punto pulsante de conexión al servidor principal, zona horaria `America/Guatemala (GMT-6)`, conteo de eventos en rango y total cotizado en quetzales acumulado.
  6. Compilación de producción validada con `npx vite build` (código 0 en 2.65s). Verificación visual e interactiva confirmada con `browser_subagent`.

### Rediseño Ejecutivo: Gestor de Espacios & Timeline (`DesktopTimelineView.jsx` y `Topbar.jsx`) (2026-09-15)
- Requerimiento: Rediseñar integralmente la pantalla de **Timeline** (`Calendar` -> Vista `Timeline`) según el código HTML de referencia y mockup ejecutivo de alta fidelidad "Jardines EMS | Gestor de Espacios & Timeline".
- Solución:
  1. Topbar ejecutiva de 2 filas exactas en `Topbar.jsx`:
     - Fila 1: Botón `[📅 Hoy]`, bloque integrado de fecha con chevrons y reloj `[ ‹ | 🕒 date | › ]`, selector segmentado de vistas (`Día`, `Semana`, `Mes`, `Año`, `Agenda`, `Timeline` en púrpura `#4f46e5`), y selectores estilizados de Estados y Vendedores (`[Todos los Estados ⌵]`, `[Todos los Vendedores ⌵]`).
     - Fila 2: Selector de Salones de ancho fijo `w-56` (224px) `[Todos los Salones (N) ⌵]` y barra de búsqueda horizontal amplia fluida con icono de lupa SVG `#94a3b8`.
     - Reseteo contra `design-system-scoped.css` para evitar que botones y selects se convirtieran en cápsulas grises de 40px.
  2. Cinta semanal y filtros KPI en `DesktopTimelineView.jsx`:
     - Tira de 7 días con botones chevron de 28x28px (`border: 1px solid #e2e8f0`); día activo en índigo `#4f46e5` con texto blanco y destello pulsante; fines de semana en rojo coral; días con eventos con punto cromático de estado.
     - Píldoras de KPI a la derecha en contenedor `#f1f5f9/90`: `Todos {N}` en negro carbón con cápsula gris `#334155`, `● Libres` (#047857), `● Parcial` (#4338ca), `● Ocupados` (#be123c) y `>150 PAX`.
     - Selector segmentado de modo de visualización `[ ☷ Matriz ]` vs `[ ☰ Tarjetas ]`.
  3. Matriz de Salones y Bloques (CSS Grid de 12 Columnas):
     - Contenedor con `min-width: 1240px` sobre fondo `#f8fafc`.
     - Encabezado `grid grid-cols-12`: `col-span-3` para `SALÓN / ÁREA` con icono arquitectónico y badge `{N} ÁREAS`; `col-span-9 grid-cols-6` con las 6 columnas horarias (`10H`, `12H`, `14H`, `16H`, `18H ACTUAL` en púrpura destacada, `20H`).
     - Fila de salón `grid grid-cols-12`: `col-span-3` con nombre en negrita 14px, badge `Cap. {N} PAX`, punto de estado dinámico (`● Libre día`, `● Parcial`) y botón `+ Todo el día` (#f1f5f9 / #e2e8f0); `col-span-9 grid-cols-6` con celdas horarias.
     - Celdas libres: Botón con checkmark `✓ Libre + Reservar` (`#ecfdf5`, borde `#a7f3d0`, texto `#065f46`, hover `#d1fae5`).
     - Celdas ocupadas / cotizadas / pre-reserva: Tarjetas ejecutivas en 2 filas con icono temático, estado, badge de código `#EV-XX` / `PR-XX` y nombre del evento/PAX truncado limpiamente.
  4. Barra de estado inferior: `Código de Estados:` con 5 puntos cromáticos (Libre, Confirmado, Cotizado, Pre-reserva, Mantenimiento), indicador `Zona Horaria: GMT-6 (Guatemala)` y punto pulsante con texto `✓ Sincronizado en tiempo real`.
  5. Compilación validada limpiamente con `npx vite build` (código 0 en 3.29s). Verificación visual en navegador confirmada con subagente de navegación.

### Rediseño Escritorio Ejecutivo: Carrito Operativo y Control Financiero (`QuoteModal.jsx`) (2026-09-14)
- Requerimiento: Resolver la sobreposición / desfasamiento del encabezado flotante `.qp-cart-sticky-header` que tapaba el contenido de fechas y filas al hacer scroll; reestructurar la vista de escritorio de **Cotizar Evento** (`QuoteModal.jsx`) según mockup de referencia de alta fidelidad y protocolo `/grill-me`, adoptando la barra de herramientas integrada en el carrito, tarjetas para días vacíos, desglose de totales y tarjetas KPI en Control Financiero.
- Causa raíz:
  1. `.qp-cart-sticky-header` tenía `position: sticky !important; top: 0 !important;` y márgenes negativos (`margin: -14px -16px 12px -16px !important;`) con sombra `box-shadow`. Al hacer scroll dentro del modal `#qp-body`, el encabezado flotaba como una caja desprendida por encima de los encabezados de fecha (`📅 2026-09-10`) y las filas de la tabla.
  2. Los botones de acción por lote (`Duplicar`, `Subir`, `Bajar`, `Limpiar`) estaban ubicados de forma redundante y apretada en la barra superior del modal (`#qp-header`), en lugar de pertenecer al contexto del carrito de servicios.
  3. Los días del evento sin servicios asignados mostraban un mensaje simple o se ocultaban en el carrito en lugar de ofrecer una tarjeta limpia interactiva.
  4. El estado de cuenta mostraba un texto apilado simple en vez de las 3 tarjetas de indicadores clave.
- Solución:
  1. Normalizado `.qp-cart-sticky-header` a `position: static !important; background: transparent !important; margin: 0 0 16px 0 !important; padding: 0 !important; border: none !important; box-shadow: none !important;`, eliminando la sobreposición y flotación errática.
  2. Integrada la barra de herramientas directamente en el encabezado del carrito a la derecha:
     - Badge `{N} seleccionado(s)` en verde menta (`#dcfce7`, `#166534`, borde `#bbf7d0`).
     - Separador vertical.
     - Botones `[📋 Duplicar]`, `[⌃ Subir]`, `[⌄ Bajar]`, `[✕ Limpiar]`.
     - Enlace inferior `Deseleccionar todo`.
  3. Removido el contenedor `.qp-header-selection-tools` de la barra superior `#qp-header`, dejándola limpia y profesional como en la referencia.
  4. Tarjetas de día estructuradas:
     - Días con servicios: Encabezado con `📅 {fecha}`, badge `{N} servicios` en verde y a la derecha `Subtotal día: {monto}`.
     - Días sin servicios: Tarjeta limpia con icono `⊕`, texto `Sin servicios asignados a este día.` y botón interactivo `+ Agregar servicio a este día` (asigna la fecha a `selectedServiceDate` y hace foco en el buscador `#quoteServiceSearchInput`).
     - Columnas de tabla alineadas (`Sel.`, `Fecha`, `Cant.` 65px centrado, `Servicio / Concepto`, `Precio unitario` con prefijo monetario, `Total` y `🗑`).
  5. Desglose de Descuento y Totales:
     - Lado izquierdo: `Tipo Descuento` y `Valor Descuento` con prefijo de divisa o porcentaje.
     - Lado derecho: `Subtotal`, `Descuento aplicado: - Q XX.XX` en rojo y `Total cotización: Q XX.XX` en tipografía grande (24px, `#005954`).
  6. Tarjetas KPI en "Control Financiero / Estado de cuenta":
     - Badge de estado superior derecho (`Pago pendiente` en ámbar `#fef3c7`, `Saldo a favor` o `Pagado`).
     - Grid de 3 tarjetas KPI: `Total Cotizado` (`totals.total`), `Total Abonado` (`abonosTotal`) y `Saldo Pendiente` (`saldoPendiente` en fondo/borde rojizo `#fee2e2`).
  7. Accesibilidad de Acciones en Cotizaciones Extensas (Solución a pérdida de visibilidad al hacer scroll):
     - Botones de acción directa integrados en cada fila (`[⌃ Subir]`, `[⌄ Bajar]`, `[📋 Duplicar]` y `[🗑 Eliminar]`), permitiendo reordenar o duplicar cualquier ítem en 1 solo clic sin tener que seleccionarlo ni desplazarse.
     - Barra Flotante de Selección múltiple (`.qp-floating-selection-bar`): cuando se marcan checkboxes (`selectedItemIds.size > 0`), aparece una barra flotante fija sobre el footer en la parte inferior central (`[✓ {N} seleccionados | 📋 Duplicar | ⌃ Subir | ⌄ Bajar | ✕ Limpiar]`), acompañando al usuario por cualquier día del evento.
     - Feedback visual animado (`@keyframes qpRowPulse` / `.qp-row-highlight-pulse`) con destello azul suave y auto-enfoque con `scrollIntoView({ behavior: 'smooth', block: 'nearest' })` en la fila que acaba de subir, bajar o duplicarse, junto con notificaciones toast inmediatas.
  8. Validación de compilación de producción limpia con `npx vite build` (código de salida 0 en 2.83s).

### Rediseño Móvil Formal y Ejecutivo: Cotizar Evento (`QuoteModal.jsx` y `quoteMobile.css`) (2026-09-13)
- Requerimiento: Rediseñar integralmente la experiencia táctil en pantallas móviles (`<= 768px`) para la creación y edición de cotizaciones en **Cotizar Evento** (`QuoteModal.jsx`) según imagen de referencia y protocolo `/grill-me`, adoptando la paleta institucional formal (Navy Corporativo `#0f4c81` / `#0b3b64` y Slate `#0f172a` / `#475569`) y preservando el 100% del layout de escritorio.
- Solución:
  1. Detección de vista móvil reactiva (`window.innerWidth <= 768`) en `QuoteModal.jsx`, aislando la renderización móvil (`.quote-mobile-root`) y manteniendo intacto el contenedor `#qp-root` de escritorio.
  2. Header superior compacto con etiqueta de marca del salón, título `Cotizar evento`, subtítulo del cliente y fecha, botón de cierre `✕`, y barra horizontal deslizable de chips:
     - Selector segmentado de Contrato (`Jardines` vs `ServiHosp` con checkmark y activo en Navy `#0f4c81`).
     - Selector de Moneda (`Q` / `$`).
     - Selector de Versión (`V1 (act.)`, `V2`).
     - Píldoras de acción rápida para `🏢 Datos` e `📄 Informe`.
  3. Pestañas ejecutivas segmentadas (`quote-mobile-tabs-bar`):
     - `[ 📦 Catálogo y Servicios ]`: Buscador de servicios táctil con autocompletado en bottom sheet, inputs de cantidad táctiles, selector de fecha, botón `+ Agregar servicio`, botón delineado `Crear nuevo servicio` y bloque de plantillas rápidas de banquetes con botón ámbar formal (`★ Aplicar plantilla`).
     - `[ 🛒 Carrito ]`: Muestra el listado de servicios agregados con badge numérico interactivo, organizados por fecha en tarjetas táctiles independientes (`.quote-mobile-item-card`).
  4. Tarjetas táctiles de servicios en el carrito:
     - Nombre del servicio en negrita `#0f172a`.
     - Control stepper de cantidad táctil: `[ − ]  [ Qty ]  [ + ]` de 34px de altura.
     - Precios unitarios y subtotales calculados dinámicamente en moneda formal.
     - Selector táctil para reasignar la fecha de servicio del ítem individual.
     - Botón de eliminación directa `🗑` con confirmación inmediata.
  5. Descuento comercial táctil (monto fijo o porcentaje) y desglose de Control Financiero (subtotal, descuento, total de la cotización, anticipos/abonos registrados y saldo pendiente por cobrar en callout azul institucional `#e8f1fb`).
  6. Barra inferior fija (Sticky Bottom) con resumen financiero en vivo (`Total Cotización: Q XX,XXX.00` y `Saldo Pendiente: Q XX,XXX.00`), CTA principal `✓ Guardar Cotización` en Navy Corporativo `#0f4c81` y píldoras secundarias estructuradas (`💳 Anticipos`, `🖨 Imprimir`, `🏢 Datos Empresa`).
  7. Reseteo de especificidad absoluta contra `global-scoped.css` y `design-system-scoped.css` (`body:not(.informes-theme) .quote-mobile-root ... !important` y `body:not(.informes-theme) .quote-mobile-modal-overlay ... !important`) para inputs, botones, selects y textareas, impidiendo que se tiñan de gradientes oscuros o se deformen en cápsulas grises.
  8. Modal móvil "Datos de la Empresa" (`showDocPanel`): Desplegable a pantalla completa en móvil con buscador táctil reactivo con autocompletado, alta rápida de empresa (`+ Nueva Empresa`), vinculación con checkmark, edición de datos fiscales en 1 columna y botón de confirmación inferior.
  9. Modal móvil "Crear Nuevo Servicio" (`showCreateServiceModal`): Pestañas segmentadas `[ + Nuevo Servicio ]` (formulario táctil en 1 columna) y `[ 📋 Registrados ]` (tarjetas táctiles con buscador y botón editar), eliminando la tabla ancha desbordada.
  10. Modal móvil "Crear / Editar Empresa" (`showCreateCompanyModal`): Formulario estructurado en tarjetas a 1 columna (Organización, Facturación y Encargados) con botón inferior fijo en Navy `#0f4c81`.
  11. Switch / Toggle Táctil (`.quote-mobile-switch`): Excluido `input[type="checkbox"]` del selector genérico que forzaba `min-height: 40px` en pantallas móviles (el cual convertía el switch en un cuadro verde deforme con el botón desalineado). Se construyó un toggle táctil nativo con riel píldora de 44x24px, botón circular de 20x20px con desplazamiento suave de 20px, fondo verde esmeralda institucional (`#10b981`) al activarse y gris neutro (`#cbd5e1`) al desactivarse.
  12. Normalización de Botones de Pie de Página en Modales Móviles: Unificada la altura de los botones `Cancelar` y `Guardar` a 44px exactos (`height: 44px; min-height: 44px; max-height: 44px;`), bordes redondeados de 9px y distribución proporcional balanceada 50% / 50% (`flex: 1`), eliminando la disparidad de tamaño y asimetría visual.
  13. Restauración y Blindaje de la Versión de Escritorio (Desktop `#qp-root`): Reseteo maestro contra `global-scoped.css` (línea 838) que teñía los campos de texto (`SERVICIO`) con degradado oscuro y `design-system-scoped.css` (línea 260) que estiraba los inputs a 40px; estandarización de columnas en la tabla `.qp-tbl` (Cant 60px, Servicio fluido blanco seminegrita, Precio 88px derecha, Fecha 135px); checkmarks `.qp-checkbox` con dimensiones fijas de 18x18px con check blanco nítido sobre `#0f4c81` y fila en `#f0f7ff`; y reemplazo del pie flotante por una barra inferior fija dockada (`.qp-docked-footer`) evitando la transposición o solapamiento sobre la tarjeta de Notas internas.

### Rediseño Móvil Integral: Editar Reserva (`ReservationForm.jsx` y `reservationMobile.css`) (2026-09-13)
- Requerimiento: Reestructuración y rediseño completo de la vista móvil de edición y creación de reservas según mockup visual de referencia de alta fidelidad, reemplazando la tabla no responsiva de salones y adaptando todos los campos a una experiencia táctil fluida sin alterar la versión de escritorio.
- Solución:
  1. Detección de vista móvil dinámica (`window.innerWidth <= 768`) en `ReservationForm.jsx`, aislando la renderización móvil (`.res-mobile-root`) y preservando el 100% del layout de escritorio original.
  2. Implementación de los 9 bloques del mockup:
     - Header móvil con botón `✕`, marca del salón, título dinámico, acceso a historial (`🕒`), selector de fecha y avatar de usuario.
     - Tarjeta Hero con estado en vivo (`• En Gestión`, `• Confirmado`), ID del evento, botón festivo (`🎉`), edición rápida del título del evento, metadatos estructurados (salón, fecha, horario) y chip de vendedor asignado (`👤`).
     - Stepper interactivo de etapas (`ETAPA DEL PROCESO`, `Paso X de 5`) con 5 fases (`Contacto`, `Cotizado`, `Seguimiento`, `Pre-Reserva`, `Confirmado`) con cambio de estado al toque directo.
     - Bloque "Salones y Horarios" con botón `+ Agregar Salón` y tarjetas de salón táctiles: selector de estrella (`★`) para salón principal, selector de salón, cuadrícula 2x2 (PAX con sufijo `pers.`, selector de horas `TimeSelect`, fecha Desde y fecha Hasta) y etiqueta de turno dinámico (`Turno Vespertino / Nocturno`, duración en horas).
     - Configuración de Capacidad: PAX total acumulado, toggle segmentado `PAX Compartido` vs `No Compartido` y callout explicativo `ⓘ`.
     - Vigencia y Límites con inputs de fecha y píldoras rápidas (`Mismo Día`, `Fin de Semana Completo`, `+ Desmontaje Día Siguiente`).
     - Notas y Requerimientos con etiqueta `Privado interno` y footer de autoguardado.
     - Accesos directos táctiles para `📅 Agendar Cita` y `📄 Cotización`.
     - Barra de navegación y acción inferior fija (`sticky bottom`) con CTA principal `✓ Guardar Cambios`, menú desplegable `⋮` y fila secundaria (`Mantenimiento`, `Cotización`, `Descartar`).
  3. Hoja de estilos `src/modules/calendar/components/reservationMobile.css` dedicada con variables de color institucional `#005954`, tipografía legible y resguardo inferior para navegadores móviles.
  4. Reseteo de especificidad absoluta contra `global-scoped.css` y `design-system-scoped.css` (`body:not(.informes-theme) .res-mobile-root ... !important`) para eliminar fondos con gradientes oscuros en inputs/textareas y evitar que botones se distorsionen en cápsulas grises.
  5. Reemplazo sistemático de emojis del sistema operativo (`🎉`, `📍`, `📅`, `⏰`, `👤`, `🏢`, `🗒️`, `🔧`, `📄`, `✕`) por iconos vectoriales SVG limpios y minimalistas (trazo sutil de 2.0-2.2px).
  6. Horario Bloqueado optimizado para pantallas móviles estrechas usando selectores de tiempo nativos fluidos (`HH:MM`) con separador `–`, eliminando el desbordamiento horizontal provocado por el componente de escritorio.
  7. Eliminados chips redundantes de preset de fechas ("Mismo Día", "Fin de semana...") y botón de "Adjuntar Minuta".
  8. Paleta formal corporativa ejecutiva (`#0f4c81` / `#0b3b64` / `#e8f1fb` / `#0f172a`): Reemplazados los tonos menta/teal informales por la identidad formal del sistema de diseño (Navy Corporativo). Botón principal "Guardar Cambios" en azul marino ejecutivo con sombra sobria, estrella de salón principal en oro/ámbar formal (`#d97706` sobre `#fffbeb`), callout con borde institucional lateral de 3.5px en navy, y barra secundaria de acciones en píldoras con bordes de precisión (Mantenimiento, Cotización, Descartar).




### Optimización Móvil Integral: Embudo de Ventas y Buscar Eventos (2026-09-13)
- Problema:
  1. En Buscar Eventos (`SearchModule.jsx` y `search.css`), los campos de "RANGO DE FECHAS" se desbordaban por fuera del borde derecho de la tarjeta blanca; el atajo "Ctrl K" estorbaba en pantallas táctiles; la vista por defecto abría la tabla de >900px cortando 6 columnas en móviles; y el botón flotante de menú cubría el contenido inferior.
  2. En Embudo de Ventas (`CustomersModule.jsx` y `customers.css`), el listón de KPIs cortaba los montos ("EN NEGOCIAC... Q 6,446,0..."); los inputs de fecha se desbordaban a la derecha; los filtros apilados ocupaban todo el alto de la pantalla; y las 7 columnas del Kanban se presentaban en una fila rígida de 2000px donde solo se veía la columna "Nuevo" sin forma ágil de cambiar de etapa.
- Causa raíz:
  1. Falta de `min-width: 0` y `flex: 1 1 0` en `.date-single-wrap` e inputs de fecha; falta de media queries con adaptación para pantallas `<= 768px`; y predeterminación de vista a `list` (tabla grande) en lugar de tarjetas móviles.
  2. En `customers.css`, `.customers-date-input` forzaba `width: 108px !important;` y los KPIs usaban `min-width: 170px;` en flex horizontal; `.customers-kanban-board` limitaba la altura a `max-height: 480px;` sin un selector de etapas segmentado para móvil.
- Solución:
  1. En `SearchModule.jsx` y `search.css`:
     - Inputs de fechas con `min-width: 0`, `flex: 1 1 0`, `width: 100% !important;` y padding reducido en móvil para evitar cualquier desbordamiento.
     - Ocultado el badge "Ctrl K" en dispositivos táctiles (`display: none;`).
     - Predeterminación inteligente de vista: en móviles (`<= 768px`) abre por defecto en modo tarjeta (`grid`) con cliente, PAX, monto total de cotización y menú de 3 puntos integrado. En modo tabla se añade aviso táctil y scroll horizontal suave.
     - Botón "Filtros avanzados" colapsable en móvil para recuperar espacio de visualización.
     - Separación inferior (`padding-bottom: 85px`) para resguardo del botón menú hamburguesa flotante.
  2. En `CustomersModule.jsx` y `customers.css`:
     - Listón de KPIs en cuadrícula 2x2 optimizado: valores formateados con `formatKpiCurrency` (sin decimales redundantes para montos >= 1,000, ej. `Q 14,954,144` y `Q 6,446,047`, con tooltip que preserva los centavos exactos); etiquetas con `white-space: normal` para evitar truncamiento en "CONFIRMADO / GANADO"; y números con `letter-spacing: -0.02em`.
     - Eliminada la barra intermedia redundante `mobile-stage-quick-nav` ("Nuevo (1 de 7)") que ocupaba ~45px verticales y duplicaba el encabezado.
     - Botón "Ver todas" integrado directamente como píldora (`toggle-all-pill`) en la barra de etapas deslizante horizontal (`customers-mobile-stages-bar`).
     - Auto-desplazamiento horizontal automático (`scrollIntoView`) de la pestaña activa en la barra superior al cambiar de etapa.
     - Flechas de navegación rápida táctil `‹` y `›` integradas directamente en el encabezado de cada columna (`customers-col-arrow-btn`).
     - Descripción de etapa (`.customers-stage-desc`) con texto fluido (`white-space: normal`, `max-width: none`) para evitar truncamiento ("Lead recién ingresado sin cotización").
     - Separación y resguardo inferior de seguridad (`padding-bottom: 95px` y espaciador de 48px) en el cuerpo de las columnas para evitar colisión con el botón flotante verde de menú (`.mobile-hamburger-btn`).

### Buscar Eventos: Selector de página traspuesto sobre tarjetas, badge SaaS v2.4 y Excel estilizado (2026-09-13)
- Problema:
  1. En el módulo Buscar Eventos (`SearchModule.jsx` y `search.css`), al hacer scroll hacia abajo, la barra inferior de paginación (`.search-saas-footer`: "Mostrando 10 de 812 eventos...") aparecía atravesada y montada directamente encima de la 3ra fila de tarjetas de eventos ("se traspone").
  2. En el encabezado aparecía un badge `SaaS v2.4` confuso.
  3. La exportación a Excel generaba un archivo plano sin encabezado institucional, sin bordes en celdas, sin formateo de moneda y con texto truncado.
- Causa raíz:
  1. En `search.css`, `.search-content-area` tenía `flex: 1; min-height: 0;` dentro de `.search-saas-container` (`min-height: 100%`). Al tener `min-height: 0` y no contar con `overflow-y: auto` interno, flexbox colapsaba su altura a ~430px (el espacio disponible inicial en viewport). Las tarjetas (10 tarjetas en cuadrícula de 3 columnas = ~950px de alto) se desbordaban visualmente fuera de `.search-content-area`, mientras que el footer se posicionaba al final del contenedor colapsado (en ~600px). Por ello, el footer quedaba flotando a mitad de la lista, cortando las tarjetas 7, 8 y 9.
  2. El badge `SaaS v2.4` era un indicador interno del rediseño UI.
  3. La exportación previa utilizaba `XLSX.utils.json_to_sheet` sin estilos de celda ni anchos configurados.
- Solución:
  1. En `search.css`: Actualizado `.search-content-area` con `flex: 1 0 auto; min-height: auto; width: 100%;` para permitir que crezca dinámicamente con el tamaño real de las tarjetas o filas de la tabla. Añadido `flex-shrink: 0;` a `.search-saas-header`, `.search-filters-card` y `.search-saas-footer`, con `margin-top: auto;` en el footer para empujarlo al final de la página cuando hay pocos resultados y mantenerlo al final del contenido cuando hay muchos.
  2. En `SearchModule.jsx`: Removido el elemento `<span className="search-badge-saas">SaaS v2.4</span>`.
  3. En `SearchModule.jsx`: Reimplementada la función `handleExportExcel` con `ExcelJS` (y fallback a `XLSX`): banner de título en azul marino institucional, fila de metadatos (fecha, total registros, filtros aplicados), encabezados de columnas estilizados en azul corporativo con texto en negrita blanca, bordes delgados en todas las celdas de datos, alternancia de filas (zebra striping `#ffffff` y `#f8fafc`), formato contable para moneda (`"Q"#,##0.00`), fila de Total General con fórmula `=SUM(...)`, autofiltros nativos en Excel y anchos de columna automáticos.

### Buscar Eventos SaaS v2.4: Fechas oscuras y botón de 3 puntos / toggle como cápsulas vacías (2026-09-13)
- Problema: En el módulo rediseñado Buscar Eventos (`SearchModule.jsx` y `search.css`):
  1. Los campos de fecha ("RANGO DE FECHAS") aparecían con fondo negro / degradado oscuro.
  2. A la par del botón `👁️ Ver` en cada fila de la tabla aparecía un rectángulo blanco redondeado vacío ("un cuadro raro").
  3. Los botones de alternar vista (tabla / tarjetas) aparecían también estirados como cápsulas vacías.
- Causa raíz:
  1. `global-scoped.css` (línea 839) aplica `background: linear-gradient(180deg, rgba(30, 41, 59, 0.78), rgba(15, 23, 42, 0.72))` a `body:not(.informes-theme) input:not(.search-input-naked)`. Al tener mayor especificidad que `.search-saas-date-input`, teñía los campos de fecha de oscuro.
  2. `design-system-scoped.css` (línea 103) aplica `min-height: 40px`, `padding: 0 14px`, `background: var(--ui-surface-muted)` a `body:not(.informes-theme) button`, estirando los botones `.btn-action-dots` y `.view-toggle-btn` a cápsulas de 40px con padding horizontal.
  3. En `SearchModule.jsx`, el SVG de los 3 puntos usaba `<circle r="1" fill="none" stroke="currentColor" strokeWidth="2.5" />`, resultando en trazos casi invisibles dentro de la cápsula estirada.
- Solución:
  1. En `SearchModule.jsx`: Reemplazado el SVG de `.btn-action-dots` por círculos sólidos `<circle cx="12" cy="..." r="2.2" fill="currentColor" />` y agregada clase `is-active` cuando el menú desplegable está abierto.
  2. En `search.css`: Añadido scoping de alta especificidad con `!important` para `input[type="date"]`, forzando `background: #ffffff !important`, `background-image: none !important`, `color: #0f172a !important`, `color-scheme: light !important`, y estilizado el indicador de calendario.
  3. En `search.css`: Agregado reseteo y dimensiones fijas con `!important` para `.btn-action-dots` (32x32px), `.view-toggle-btn` (32x32px), `.btn-action-view` (32px alto), botones del popover de acciones (`.action-dropdown-popover button`), botones de paginación (`.page-nav-btn`, `.page-num-btn`) y botones de filtro.

### ReferenceError: reactingTo is not defined en ColaboracionPanel (2026-09-13)
- Problema: Al abrir un informe que contiene comentarios, la aplicación se rompía con `ReferenceError: reactingTo is not defined at ColaboracionPanel.jsx:593:43` en el ErrorBoundary.
- Causa raíz: En `ColaboracionPanel.jsx`, el botón de reaccionar a comentarios (`+`) y el selector de emojis consumían la variable de estado `reactingTo` y su setter `setReactingTo`, pero `const [reactingTo, setReactingTo] = useState(null)` no había sido declarado en el componente. En informes sin comentarios el mapeo no se ejecutaba y no fallaba; pero al existir comentarios, lanzaba el ReferenceError. Además, en `SearchBar.jsx` existía una advertencia de React por mezclar shorthand `border` en CSS con `borderColor` en inline style.
- Solución:
  1. Declarado `const [reactingTo, setReactingTo] = useState(null)` en [ColaboracionPanel.jsx](file:///c:/Users/samal/Desktop/CRM/CRM.JDL-2.0/src/modules/informes/components/ColaboracionPanel.jsx).
  2. En [SearchBar.jsx](file:///c:/Users/samal/Desktop/CRM/CRM.JDL-2.0/src/modules/informes/components/SearchBar.jsx), removido el `borderColor` inline en favor de la clase CSS `.header-search-box.is-focused`, eliminando la advertencia de React.

### Campos de búsqueda con aspecto anidado ("control dentro de otro control") (2026-09-13)
- Problema: Al hacer clic o escribir en la barra de búsqueda del Calendario (`Topbar.jsx`), en Informes (`SearchBar.jsx`), en el módulo Buscar Eventos (`SearchModule.jsx`) o en el buscador móvil de `Kanban.jsx`, aparecía un segundo rectángulo interior con fondo lavanda/celeste, esquinas redondeadas y un borde/anillo resplandeciente (`box-shadow: 0 0 0 3px ...`), dando la impresión visual de tener un input de texto flotando dentro de otra caja contenedora.
- Causa raíz:
  1. En `src/main.jsx`, las hojas de estilo cargadas en tiempo de ejecución son `global-scoped.css`, `design-system-scoped.css` y `responsive-mobile.css` (no `global.css`).
  2. En `design-system-scoped.css` (línea 271) existía la regla de alta especificidad `body:not(.informes-theme) input:focus` que forzaba `border-color: #2d6ea8 !important` y `box-shadow: 0 0 0 3px rgba(45, 110, 168, 0.15) !important`.
  3. En `responsive-mobile.css` (línea 275) `body:not(.informes-theme) input` forzaba `min-height: 44px !important`, y en `global-scoped.css` (líneas 153-155 y 838-842) `input` aplicaba `padding: 10px 12px`, `border: 1px solid ...` y `border-radius: 12px`.
  4. Dado que los estilos inline de React (`style={{ ... }}`) no pueden controlar pseudo-clases CSS como `:focus` o `:hover`, al hacer clic en el input de `Topbar.jsx`, el navegador aplicaba la regla `:focus` de `design-system-scoped.css`, dibujando el rectángulo azul interior con sombra.
- Solución:
  1. En `design-system-scoped.css`, `global-scoped.css` y `responsive-mobile.css`: Agregada la exclusión `:not(.search-input-naked)` a todos los selectores genéricos de `input` e `input:focus` (`body:not(.informes-theme) input:not(.search-input-naked)`).
  2. En las 3 hojas de estilo activas: Incorporado el bloque maestro de reseteo universal con `!important` para `.search-input-naked`, `.topbar-search input` y `.search-input-wrap input` (`border: none !important`, `background: transparent !important`, `box-shadow: none !important`, `min-height: 0 !important`, `padding: 0 4px !important`).
  3. En `Topbar.jsx`: Implementado estado `isSearchFocused`, `:focus-within` en el label envolvente (`.topbar-search-box`) con borde `#2563eb` y sombra sutil `rgba(37, 99, 235, 0.14)`, cambio de color del ícono a `#2563eb` y botón `✕` de limpieza rápida cuando hay texto escrito.
  4. En `SearchBar.jsx` (Informes): Diseño píldora (`border-radius: 20px`), `:focus-within` dinámico con `var(--primary-glow)` en el contenedor padre, cambio de color del ícono `IconSearch` al enfocar y botón `✕` de limpieza optimizado.

### Botón "Leído / Enterado" cortado en panel de Colaboración de Informes (2026-09-13)
- Problema: En el panel de Colaboración de `InformeView`, el botón verde de "Leído / Enterado" estaba ubicado dentro de la misma fila que las 3 pestañas (`Comentarios`, `Actividad`, `Lectores`). Dado que el sidebar tiene un ancho fijo de 360px (interior ~336px) y las 3 pestañas requieren ~300px, el botón de "Leído" se desbordaba por la derecha, quedando cortado a la mitad (solo se apreciaba el check verde y el texto "Leído" desaparecía por `overflow: hidden`).
- Solución:
  1. Reubicado el botón de "Leído / Enterado" en el header superior del panel de colaboración ([ColaboracionPanel.jsx](file:///c:/Users/samal/Desktop/CRM/CRM.JDL-2.0/src/modules/informes/components/ColaboracionPanel.jsx)), situándolo a la par del botón de cierre `✕`. En esta fila hay más de 120px de espacio libre disponible, garantizando que el botón se muestre 100% completo, con bordes redondeados, ícono y texto íntegros.
  2. La barra de pestañas segmentadas (`colab-tabs`) ahora utiliza el 100% del ancho para las 3 pestañas de navegación con `flex: 1` cada una, ofreciendo una apariencia simétrica y sin compresiones.
  3. Eliminado el header duplicado en [InformeView.jsx](file:///c:/Users/samal/Desktop/CRM/CRM.JDL-2.0/src/modules/informes/pages/InformeView.jsx), unificando el control tanto en versión móvil como de escritorio.

### Visor Carrusel Lightbox para imágenes en móviles y compresión WebP (2026-09-13)
- Requerimiento: En dispositivos móviles, las miniaturas de 200px en los informes de eventos resultaban muy pequeñas para apreciar detalles de montajes, flores y vajilla. Se solicitó que al tocar una imagen se abriera en grande en un carrusel navegable con soporte para gestos táctiles (swipe), preservando las notas/comentarios individuales por foto, sin alterar la maquetación actual del documento y optimizando el formato con WebP.
- Solución:
  1. Creado `src/modules/informes/components/ImageLightboxModal.jsx`: Modal carrusel a pantalla completa con React Portal, backdrop blur (`rgba(10, 15, 29, 0.94)`), navegación por gestos táctiles (deslizar izquierda/derecha para cambiar foto, deslizar abajo para cerrar), botones flotantes `‹` y `›`, navegación por teclado en PC (`←`, `→`, `Escape`), contador de fotos (`📷 2 de 4`) e indicador inferior con la nota/descripción de la imagen actual (`img.descripcion`). Marcado con `.no-print` para evitar interferencias al imprimir o generar PDF.
  2. Integrado en `InformeView.jsx` y `ConstructorInforme.jsx`: miniaturas con cursor pointer y hover sutil, abriendo el carrusel en el índice de la foto seleccionada.
  3. Compresión WebP en `ConstructorInforme.jsx`: resolución máxima aumentada a 1200px con compresión `image/webp` a calidad 0.75 (y fallback automático a `image/jpeg`). Reduce el peso en BD entre un 30% y 40% con mayor nitidez.
  4. Módulo `src/utils/imageUtils.js`: compresión automática de fotos de comprobantes bancarios (`anticipos_evento`) a WebP (1600px) en `QuoteModal.jsx` y `ReportsContabilidad.jsx`, manteniendo los archivos PDF vectoriales 100% intactos.

### Unificación de suscripciones Web Push y corrección del envío de notificaciones (2026-09-13)
- Problema: Existían dos tablas paralelas para Web Push (`push_subscriptions` y `usuarios_push_subscriptions`). El servicio general del CRM (`webPushService.js` vía `/api/webpush/save-subscription`) guardaba las suscripciones de los navegadores en `usuarios_push_subscriptions` (536 registros). Sin embargo, el helper de envío de notificaciones (`webPushHelper.js`) consultaba exclusivamente `push_subscriptions` (129 registros antiguos). Como consecuencia, a más de 480 dispositivos de vendedores y recepcionistas nunca les llegaban las notificaciones push al asignarles posibles ventas, tareas o menciones en notas.
- Solución:
  1. Migradas de forma atómica todas las suscripciones de `usuarios_push_subscriptions` hacia la tabla canónica `push_subscriptions` (totalizando 608 suscripciones consolidadas).
  2. Eliminada la tabla redundante `usuarios_push_subscriptions`.
  3. `backend/src/controllers/webPushController.js` actualizado para escribir directamente en `push_subscriptions` con `ON DUPLICATE KEY UPDATE` y captura del `user_agent`.
  4. Registrada la migración canónica `UnifyPushSubscriptions` en `server.cjs` para ejecución automática no destructiva en producción al arrancar.

### Migración atómica de Checklists a tablas dedicadas y endpoints independientes (2026-09-13)
- Problema: Los checklists de cada evento se guardaban dentro de un JSON monolítico en la clave `eventChecklists` de `app_state_kv`. Al editar un checklist, se reescribía toda la clave acumulada y se enviaba en un megasave del estado general, arriesgando pérdida de datos o bloqueos concurrentes.
- Solución:
  1. Creadas las tablas dedicadas `checklists_evento (id_evento PK, checklist_json LONGTEXT, actualizado_en TIMESTAMP)` y `checklist_links_publicos (id PK, token UNIQUE, id_evento, datos_json LONGTEXT)`.
  2. Migración automática no destructiva en `server.cjs` durante el arranque: si `checklists_evento` está vacía, extrae los datos existentes de `eventChecklists`, los inserta individualmente con upsert y vacía la clave en `app_state_kv` a `{}`.
  3. Endpoints atómicos dedicados en backend: `GET /api/checklists/:eventoId`, `PUT /api/checklists/:eventoId`, `GET /api/checklists/public/:token` y `POST /api/checklists/public/:token/evaluacion`.
  4. Frontend (`checklistService.js`, `SettingsChecklist.jsx`, `PublicChecklistPage.jsx`) migrado a consumir los endpoints atómicos independientes sin tocar `app_state_kv`.

### Índices de rendimiento para notas e informes por id_ocupacion (2026-09-13)
- Problema: `event_notas` e `informes_eventos` no tenían índice en `idocupacion` / `id_ocupacion`, forzando table scans completos en cada consulta del calendario o informes. Una recomendación automática sugería crear una `FOREIGN KEY` a `eventos.id`, lo que hubiera provocado fallo por Error 1452 (existen 45 informes y 5 notas huérfanas de eventos históricos/cancelados) y bloqueos al editar reservas multislot en el calendario.
- Solución:
  1. Creados índices convencionales: `idx_event_notas_idocupacion` en `event_notas(idocupacion)` y `idx_informes_eventos_id_ocupacion` en `informes_eventos(id_ocupacion)`. (En `evento_metadatos`, `id_ocupacion` ya es la clave primaria clustered).
  2. Registrada migración canónica `OcupacionPerformanceIndexes` en `server.cjs` para aplicación automática en producción.
  3. Preservados todos los datos históricos intactos sin foreign keys destructivas.

### Eventos Asignados: seguimiento cruzado por otro vendedor y permisos de edición para vendedores (2026-09-12)
- Bug 1: Cuando un vendedor atendía un evento asignado a otro vendedor que no tuvo tiempo y le daba seguimiento (creaba la cotización o reserva), el evento en `Eventos Asignados` (`/posibles-ventas`) no cambiaba a "En Proceso", manteniéndose perpetuamente en "Pendiente".
- Causa raíz: En `posiblesVentasController.js`, tanto `getPosibleVenta` (`GET /:id`) como `updatePosibleVenta` (`PATCH /:id`) bloqueaban con `403 Forbidden` si `rol === 'vendedor'` y `lead.vendedor_id !== userId`. Al guardar la reserva desde `ReservationForm.jsx`, la vinculación `{ eventoId: newId }` fallaba silenciosamente por el 403, dejando `evento_id` en `NULL`. Sin `evento_id`, `computeEstado()` evaluaba el prospecto siempre como `pendiente`.
- Bug 2: Los vendedores no podían editar ningún dato erróneo de los eventos asignados (ej. nombre, teléfono, correo, fecha tentativa, pax, salón, notas). En el frontend todos los inputs tenían `disabled={editing && userRole === 'vendedor'}`, y en el backend `updatePosibleVenta` envolvía todas las actualizaciones en `if (!isVendedor)`.
- Solución:
  1. `posiblesVentasController.js`: Removidos los filtros 403 en `getPosibleVenta` y `updatePosibleVenta` para vendedores y recepcionistas. Eliminado `if (!isVendedor)` para que los vendedores puedan actualizar los campos y reasignar vendedor. Notificación al nuevo vendedor si cambia la asignación.
  2. `PosiblesVentasModule.jsx`: `canEditLead` actualizado para permitir edición por rol `vendedor` y recepción mientras el evento no esté en `ganada`. Removido `disabled` en todos los inputs del modal. Incorporado el componente de vinculación/desvinculación con el calendario (`Reserva vinculada en Calendario`) con sugerencia automática de coincidencia por cliente/fecha en 1 clic.
  3. Reparación de datos existentes: Leads #33 (Boda Alejandro Bonilla e Isabel Maldonado atendida por Wendy en `evt_19f35230`) y #18 (AARON ESTRADA atendida en `evt_67afabe6`) vinculados y sincronizados a estado `en_proceso`.

### Eventos anteriores a 1 mes ocultos en Calendario y Reportes (2026-09-12)
- Bug: Los eventos de más de 30 días de antigüedad (ej. desde el 11 de agosto hacia atrás) no se mostraban en el calendario, reportes históricos (ventas, comisiones, eficiencia) ni en el buscador global.
- Causa raíz: En el commit `dd8134f` (14 de agosto de 2026) se añadió `WHERE fecha_evento >= DATE_SUB(CURRENT_DATE, INTERVAL 1 MONTH)` a `readStateFromTables()` en `server.cjs:1352` y en el `DELETE` de `writeStateToTables()` en `server.cjs:3012` como una optimización prematura. Al ser dinámico, cada día que pasaba empujaba la fecha de corte hacia adelante, ocultando 398 eventos intactos de la BD para ahorrar solo ~40ms de consulta.
- Fix: Removido el filtro dinámico de fecha en `server.cjs` (tanto en el `SELECT` de eventos como en el `DELETE` de huérfanos). Toda la historia vuelve a cargarse en el estado del CRM.

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
### Check List de Evento: rediseño responsive para móviles y Android (2026-09-07)
- Bug / Requerimiento: el modal de Check List (`SettingsChecklist.jsx`) presentaba problemas severos de visualización en dispositivos móviles y navegadores Android:
  1. Utilizaba una tabla rígida de 4 columnas (`checklist-table`), provocando compresión extrema de los textos de los puntos a verificar y de los menús desplegables (`<select>`), con scroll horizontal roto.
  2. En pantallas pequeñas, el modal sufría por el comportamiento de teclado virtual de Android y zoom automático en inputs con tamaño de fuente menor a 16px.
  3. El footer y los botones de acción quedaban desplazados fuera de pantalla o colapsados por desbordamiento flex.
- Solución implementada (siguiendo diseño de referencia provisto):
  - **Header visual limpio**: Icono púrpura de verificación, título `Check List — Evento`, nombre del evento en mayúsculas truncado y fecha formateada con ícono `📅`.
  - **Pestañas Operativa / Evaluación**: Barra tipo cápsula (`#f1f5f9`) con botones redondeados e íconos (`⚙️ Operativa` / `⭐ Evaluación`).
  - **Tarjeta 1 (Plantillas Aplicadas)**: Pills con botón de eliminación `✕` y botón punteado `+ Agregar plantilla` con selector nativo transparente encima para activación táctil instantánea en Android.
  - **Tarjeta 2 (Avance General / Satisfacción)**: Métrica en porcentaje grande, barra de progreso con gradiente y cuadrícula de tarjetas de conteo por estado (`Cumplido`, `En proceso`, `Pendiente`, `No aplica` o niveles de satisfacción).
  - **Tarjeta 3 (Notas / Sugerencias Generales)**: Textarea integrada con bordes suaves para observaciones.
  - **Lista de verificación card-based**: En lugar de una tabla comprimida, cada punto a verificar es una tarjeta táctil con:
    - Círculo numérico y etiqueta de categoría adaptativa (`whiteSpace: normal`, `wordBreak: break-word` sin truncado `...` ni prefijos duplicados).
    - Texto y descripción del punto a verificar al 100% visible (`0.9rem`, `lineHeight: 1.4`).
    - Fila de controles con pill de estado interactivo (`● Pendiente ⌄` con overlay de `<select>` nativo para abrir el picker nativo de Android) y botón `💬 Nota` que despliega un campo de texto para comentarios.
  - **Footer fijo inferior**: Botones ergonómicos `Cerrar` y `✓ Guardar Operativa / Evaluación` (`#059669`) anclados al fondo con safe-area para Android e iOS.
  - **Estilos móviles**: Diálogo a pantalla completa (`100vw`, `100dvh`), `overflow-y: auto`, `overscroll-behavior: contain` y `font-size: 16px !important` en inputs/selects para prevenir zoom intrusivo en Android.
  - **Respeto de plantillas inactivas (`active === false`)**: Al abrir un evento, el autoselector por defecto verificaba solo la existencia de secciones operativas o de evaluación pero ignoraba `t.active !== false`, cargando plantillas que el usuario había inhabilitado (ej. "Satisfacción Clientes (inactiva)"). Se añadió filtro estricto de `t.active !== false` tanto para la sugerencia por defecto como para descartar plantillas inactivas en eventos que no posean datos reales calificados guardados.

### Informe de Eventos: rediseño compacto en 2 columnas y ahorro de papel (2026-09-07)
- Requerimiento: el informe de eventos (`InformeView.jsx`) generaba un desperdicio excesivo de papel al imprimir o exportar a PDF (salía en 6+ hojas por evento multidiario con bloques de firma innecesarios y tablas extendidas verticalmente).
- Solución arquitectónica:
  - **Paginación 1 día = 1 hoja**: Cada día se empaqueta en `.iv-day-block.iv-paper-sheet` con `page-break-after: always` y `page-break-inside: avoid`.
  - **Estructura en 2 columnas (50% / 50%)**:
    - Columna Izquierda (`.iv-menu-col`): Menú Programado con tiempos de comida, cantidades destacadas, notas de servicio/refill y total de comensales.
    - Columna Derecha (`.iv-montaje-col`): Montaje y Logística con pills de equipo audiovisual/mobiliario, mantelería, mesas/sillas, recuadro de observaciones/instrucciones destacadas y sello de revisión técnica.
  - **Encabezados adaptativos**:
    - Página 1: Encabezado formal con cuadrícula 2x4 (`.iv-meta-grid-full`).
    - Páginas 2+: Barra compacta de 1 fila (`.iv-meta-bar-compact`) para maximizar la superficie útil en eventos de varios días.
  - **Sin bloque de firmas**: Eliminado por completo a petición del usuario para evitar arrastrar hojas en blanco.
  - **Alertas y casos vacíos**: Badges de restricciones alimentarias integrados dentro de la tarjeta de menú; fallbacks simétricos de "Sin Platillo Asignado" o "Sin Requerimientos de Montaje" si un día solo tiene una de las dos secciones.
  - **Dual CSS**: Las clases se sincronizaron en `styles.css` y `styles.scss`, y `PDF_AVOID_SPLIT_SELECTOR` se actualizó en `InformeView.jsx` para cortes limpios en html2canvas.

### Informe de Eventos: omisión de días vacíos sin menú ni montaje (2026-09-07)
- Requerimiento: en eventos multidiario donde algún día es solo recepción de habitaciones o no tiene asignado servicio de banquetes ni montaje logístico (ej. Día 1 vacío y Día 2 con banquete), el sistema generaba una hoja entera innecesaria con "Sin platillo asignado para esta fecha".
- Solución:
  - En `InformeView.jsx`, se implementó `diasFiltrados` (`useMemo`) que evalúa si cada día tiene menú (`items.length > 0`, `nombre_menu` o `comentario_menu`) o montaje con especificaciones reales (`montajesValidos.length > 0`).
  - Los días sin menú ni montaje quedan automáticamente excluidos de la vista, de la impresión y de la exportación a PDF, mostrando únicamente los días con requerimientos operativos reales.
  - Se preserva el número de día del evento (`numeroDiaOriginal`) en la cinta azul (`DÍA 2`) y en el encabezado (`FECHA DEL DÍA 2`), mientras que la paginación del documento físico se recalcula secuencialmente (`PÁGINA 1`, `PÁGINA 2`, etc.), aplicando el encabezado completo 2x4 a la primera página útil del reporte.
  - Fallback defensivo: si ningún día del evento tiene menú ni montaje, se muestran todos los días para evitar un documento en blanco.

### Tabla de Ocupación Semanal: cortes de filas y márgenes en PDF (2026-09-07)
- Bug: al exportar a PDF la tabla de ocupación semanal desde `Kanban.jsx` (botón "PDF"), las filas de la tabla quedaban cortadas horizontalmente por la mitad en los saltos de página (ej. texto partido entre hojas), no existía margen inferior (el contenido tocaba el borde de la hoja) y las columnas no tenían anchos proporcionales (`table-layout: fixed` dividía las 13 columnas en anchos idénticos de ~92px, comprimiendo nombres de instituciones a 8 renglones de una sola palabra).
- Causa raíz:
  1. `exportToPdf` realizaba una paginación ingenua con `position = heightLeft - pdfHeight` sin márgenes (`margin: 0`) y sin considerar las fronteras de los elementos (`<tr>`). Cualquier pixel a la altura de `297mm` era rebanado ciegamente.
  2. La tabla carecía de `<colgroup>` con anchos dedicados.
- Solución:
  - Algoritmo de corte inteligente por filas: se miden las coordenadas `top`/`bottom` de cada fila (`<tr>`) con respecto al canvas renderizado. Los saltos de página solo se ejecutan **entre filas**, nunca en medio de una fila o texto.
  - Títulos de día huérfanos prevenidos: si un `dia-header` queda como la última fila de una hoja sin eventos abajo, se traslada automáticamente a la página siguiente.
  - Encabezado `thead` repetido: en la página 2 y posteriores, el encabezado con los nombres de las columnas se dibuja automáticamente en la parte superior para facilitar la lectura.
  - Márgenes perimetrales garantizados: margen uniforme de 10mm en los 4 bordes (arriba, abajo, izquierda, derecha) en todas las hojas.
  - Anchos de columna proporcionales mediante `<colgroup>`: Institución (250px), Salón (130px), Vendedor (145px), Horario (95px), Estado (85px), Día (78px), Pax y Alimentos (42-48px).

### Tabla de Ocupación Semanal: Encabezado con Mes, Semana e Identidad Púrpura (2026-09-07)
- Requerimiento: el encabezado del reporte de ocupación semanal (tanto en la vista de pantalla como en la exportación a PDF e impresión directa) no indicaba el mes ni la semana que se estaba visualizando/imprimiendo, y carecía de la identidad visual de marca del módulo de informes (tono púrpura / índigo).
- Solución:
  - **Cálculo dinámico de Semana y Mes (`weekMeta`)**:
    - Cálculo de número de semana ISO, mes y año a partir del lunes de referencia.
    - Soporte para semanas que cruzan fronteras de mes (ej. `SEPTIEMBRE - OCTUBRE 2026` y `Semana 39 • Del 28 de septiembre al 4 de octubre`).
  - **Encabezado institucional en PDF e impresión (`buildPrintHtml`)**:
    - Badge con gradiente púrpura de marca (`linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)`) y logo blanco `/logo.png`.
    - Título formal: `INFORME DE OCUPACIÓN SEMANAL` con subtítulo `CONTROL OPERATIVO Y SERVICIOS • JARDINES DEL LAGO`.
    - Pill destacado con mes en mayúsculas (`SEPTIEMBRE 2026`) y subtítulo de semana (`Semana 38 • Del 14 al 20 de septiembre de 2026`).
    - Barra de metadatos estilizada con período, usuario emisor y timestamp de impresión.
    - Encabezados de tabla (`<th>`) estilizados con gradiente púrpura/índigo (`#4f46e5` a `#4338ca`) y títulos de día con borde y fondo púrpura tenue (`#f5f3ff` / `#3730a3`).
  - **Banner informativo en pantalla (`viewMode === 'tabla'`)**:
    - Se agregó banner superior en la vista tabular web con el logo, título formal, pill de mes y pill de rango de semana para coherencia total entre la pantalla y el PDF exportado.

### Eventos Asignados: rediseño completo de la interfaz según referencia (2026-09-07)
- Requerimiento: rediseñar el módulo de Eventos Asignados (`PosiblesVentasModule.jsx`) para modernizar la visualización y ajustarse con exactitud al diseño de referencia provisto por el usuario.
- Solución arquitectónica:
  - **Encabezado principal**:
    - Título `Eventos Asignados` con badge `Pipeline activo` verde esmeralda y subtítulo descriptivo.
    - Botones de acción: `[⤓ Exportar]` a Excel (usando `xlsx` dinámico), `[↻ Sincronizar]` con animación de giro y `[+ Asignar evento]` (`#0f766e`).
  - **Barra de KPIs (8 métricas en una fila)**:
    - `TOTAL LEADS` con pill de `N s/seg`.
    - `PENDIENTE`, `EN PROCESO`, `GANADA`, `PERDIDA` con porcentajes e indicadores por punto de color (`#f59e0b`, `#3b82f6`, `#10b981`, `#ef4444`).
    - `CONVERSIÓN` (% y conteo de ganadas).
    - `ASIGNADOS` (% asignados sobre total).
    - `ATENCIÓN` (conteo sin seguimiento, alerta roja `#e11d48` y fondo rosado suave).
  - **Barra de filtros tipo cápsula**:
    - Pestañas con contadores de leads activos por estado y pestaña de `[🗑 Eliminadas]` para administradores.
    - Filtro de Vendedores con avatar apilado, filtro de Salón con ícono de edificio (`🏢 Todos los salones`), y selector de vista (`[≡]` lista / `[▦]` cuadrícula).
  - **Tarjetas de Lead (`LeadCard`)**:
    - Borde izquierdo de 4.5px codificado por color según el estado comercial.
    - Avatar con iniciales en paleta pastel limpia (`MR`, `BL`, `BA`, `S`) calculado dinámicamente.
    - Nombre del cliente en negrita, badge de estado con punto de color, badge `📎 Vinculada` (si tiene reserva enlazada) y asignación con tiempo transcurrido (`Asignado a: [Nombre] · hace X días`).
    - Fila de metadatos completa: Fecha (`📅`), Salón (`🚢`), Pax (`👥`), Teléfono cliqueable con enlace `tel:` (`📞`) y Correo cliqueable con enlace `mailto:` (`✉️`).
    - Recuadro de comentarios/cotización tipo cita en gris suave (`“ [Notas]`).
    - Badge de Próximo Seguimiento / Último Contacto con ícono de reloj y nombre del asesor, o aviso destacado en cursiva roja para leads perdidos.
    - Columna de acciones a la derecha:
      - `[👁 Ver reserva]` / `[👁 Ver detalle]` (botón outline blanco).
      - `[💬 Mensaje]` (botón verde menta `#ecfdf5` / `#059669` para redactar recordatorio rápido) o `[↻ Reactivar]` para leads perdidos.
      - Botones sutiles de editar y eliminar en la esquina superior derecha.
  - **Paginación inferior**:
    - Contador de resultados (`Mostrando X a Y de Z eventos activos`).
    - Botones ergonómicos de paginación `[Anterior] [1] [2] [Siguiente]`.
  - **Localización al español**:
    - `Pipeline activo` → `Seguimiento activo`.
    - `TOTAL LEADS` → `TOTAL PROSPECTOS`.
    - `leads` → `prospectos` (en subtítulos, modales y notas de estado).

### Ocupación Semanal: rediseño móvil adaptativo según referencia visual (2026-09-07)
- Requerimiento:
  1. La pestaña **Lista / Tabla** (`viewMode === 'tabla'`) en móviles mostraba una tabla rígida de 13 columnas recortada y difícil de leer en pantallas pequeñas. Se solicitó rediseñar **Lista / Tabla** en móvil basándose en la imagen de referencia provista (tarjetas limpias por día con carrusel superior).
  2. La pestaña **Ocupación** (`viewMode === 'kanban'`) debe mantener sus `EventCard`s completos para permitir ver notas, mensajes, chat en tiempo real, menciones a usuarios con `@`, reacciones de emojis y botones de checklist/alertas.
  3. No se requiere botón para saltar a reserva desde las tarjetas ni botón flotante (+) para nueva reserva, ya que colisionaba con el botón flotante del menú móvil en la esquina inferior derecha.
- Solución implementada:
  - **Encabezado móvil de marca y carrusel**:
    - Ícono púrpura de marca, subtítulo `JARDINES DEL LAGO` y título `Ocupación Semanal`.
    - Selector en cápsula de 3 vistas: `[ 🎛️ Ocupación ]`, `[ 📄 Lista / Tabla ]`, `[ 📋 Tareas ]`.
    - Stepper con fecha interactiva que abre el datepicker nativo del dispositivo y carrusel de 7 días (LUN a DOM) con conteo de eventos y resaltado púrpura del día activo.
  - **Pestaña Lista / Tabla en móvil (`MobileTablaCard`)**:
    - Reemplaza la tabla HTML rígida por una lista de tarjetas limpias inspirada exactamente en la referencia:
      - Fila superior: Pill de estado (`● CONFIRMADO`, `● PRE-RESERVA`, `● MANTENIMIENTO`), `Día DD` y conteo destacado `N PAX`.
      - Fila media: Nombre de la institución/evento en negrita mayúscula de alto contraste.
      - Fila inferior: Salón con badge (`🏢`) y horario (`🕒 HH:MM - HH:MM`).
      - Desglose de comida enriquecido por tipo de servicio con conteos precisos desde `weeklyServices` (Desayunos `🍳`, Refacciones AM `☕`, Almuerzos `🍽️`, Refacciones PM `🍪`, Cenas `🍲`) como pills coloreadas.
      - Solución al bug del `0` fantasma: en JSX `{event.tiene_alertas && ...}` evaluaba a `0` numérico cuando MariaDB devolvía `0`. Se convirtió a ternario estricto con `Boolean()`.
      - Al tocar la tarjeta, navega directamente al informe del evento. Sin botones innecesarios de reserva abajo.
    - **Barra de exportación móvil**:
      - Botones directos y visibles `[ 📄 Descargar PDF ]`, `[ 📊 Exportar Excel ]`, `[ 🖨️ Imprimir ]` en la vista de Lista / Tabla para fácil conversión a PDF en teléfonos.
    - **Tarjeta de totales del día**:
      - Resumen al pie del día con total de Pax y sumatoria de todos los tiempos de comida del día seleccionado.
  - **Pestaña Ocupación en móvil (`EventCard`)**:
    - Mantiene intacto el componente `EventCard` original para el día seleccionado en el carrusel, preservando notas, hilos de mensajes, menciones `@usuario`, reacciones y acceso al checklist.
  - **Remoción de botón flotante (+)**:
    - Eliminado el botón FAB que causaba superposición ("trasposición") con el botón circular flotante del menú principal del sistema.
  - **Aislamiento desktop**:
    - La vista de escritorio se mantiene al 100% intacta. En móvil se desactiva la barra duplicada `informe-actions-bar` para garantizar máxima área visual útil.

### Vista de Informe (`InformeView`): Rediseño de acciones a barra inferior en móvil (2026-09-07)
- Bug / Requerimiento:
  - En la vista móvil de informes (`InformeView`), los botones de acción (`[Volver]`, `[Exportar PDF]`, `[Imprimir]`, `[Colaborar]`, `[Editar]`) se apilaban en 3 filas dentro del header superior fijo (`.informe-actions-bar`), sumado a la barra de búsqueda global `<SearchBar />`.
  - Esto consumía más del 40-50% del alto de pantalla de los teléfonos, ocultando y bloqueando la visibilidad del documento formal del evento (`.iv-documento`).
  - Adicionalmente, el panel de colaboración (`colabOpen`) se inicializaba en `true` por defecto, ocupando espacio masivo estático al final de la pantalla.
- Solución implementada:
  - **Header móvil ultra compacto**:
    - Al abrir un informe (`isInformeView`), en pantallas móviles (`<= 768px`) se ocultan la barra de búsqueda global y la barra superior de botones (`.informe-actions-bar`), dejando solo una fila delgada (~44px) con el logo institucional y los controles esenciales (modo oscuro, notificaciones y salir).
  - **Barra inferior de acciones fija (`.iv-mobile-bottom-bar`)**:
    - Reubicados todos los botones a un dock inferior moderno con fondo glassmorphism translúcido (`backdrop-filter: blur(16px)`), soporte para `env(safe-area-inset-bottom)` y animación activa al toque:
      - `[ ← Volver ]`: Botón táctil para regresar a la vista anterior.
      - `[ 📄 PDF ]`: Pill con badge verde esmeralda (`#059669`) con indicador de carga durante la generación.
      - `[ 🖨️ Imprimir ]`: Botón destacado con gradiente de marca púrpura (`#6366f1` a `#4f46e5`).
      - `[ 💬 Colaborar ]`: Botón con ícono de chat y estado activo/indicador si está desplegado.
      - `[ ✏️ Editar ]`: Visible según permisos de rol (`Admin`, `Vendedor`, `FrontOffice`, `Eventos`) para editar el evento en el constructor POS.
  - **Colaboración como Bottom Sheet móvil**:
    - `colabOpen` se inicializa en `false` en pantallas móviles (salvo que venga con `highlightComentarioId` en la URL).
    - Al tocar "Colaborar", se abre como un **Bottom Sheet modal sobrepuesto** con fondo oscuro deslizable (`.colab-mobile-backdrop` + `.colab-mobile-sheet`), permitiendo leer y escribir comentarios sin deformar el documento y cerrándolo fácilmente con `✕` o tocando afuera.
  - **Márgenes de seguridad y exclusión en impresión**:
    - Padding inferior (`padding-bottom: 75px`) en `.informe-print-container` para evitar que el pie de página quede tapado por la barra inferior al hacer scroll.
    - Exclusión estricta en impresión y exportación PDF (`.no-print` y `@media print`).
  - **Montaje mediante `createPortal` al `document.body`**:
    - Al renderizar dentro de `.informe-view-layout`, los ancestros flex con `flex-direction: column` y `align-items: center` atrapaban el contenedor `position: fixed`, provocando que los botones colapsaran verticalmente en el centro del documento en vez de estirarse horizontalmente a lo ancho del viewport.
    - Se encapsuló la barra (`.iv-mobile-bottom-bar`) y el panel de colaboración móvil en `createPortal(..., document.body)` con ancho explícito `100vw`, `flex-direction: row` y estilos inline de alta prioridad, asegurando que se sitúe horizontalmente de extremo a extremo en la base de la pantalla.
  - **Compatibilidad**:
    - En escritorio (`> 768px`) la interfaz se mantiene exactamente como estaba (barra de acciones en el header y panel lateral de colaboración lado a lado).

### Calendario Móvil: Disponibilidad de Salones en 1 Clic (2026-09-09)
- Requerimiento:
  - El calendario en versión móvil comprimía la vista de semana de escritorio en 3 columnas angostas con scroll horizontal incómodo y sin claridad de disponibilidad.
  - Se solicitó rediseñar la experiencia móvil para consultar con **1 solo clic** qué salones están libres, ocupados o desocupados, siguiendo la maqueta de referencia provista.
- Solución implementada:
  - **Componente dedicado (`MobileSalonesCalendar.jsx`)**:
    - Detección automática en móviles (`<= 768px`) al entrar a `/calendar`.
    - Header institucional: `Jardines EMS • Sede Campestre Central` con estado verde, campana de notificaciones con badge, avatar con iniciales del usuario y botón hamburguesa que activa el menú lateral del CRM.
    - Navegador de fechas `< 📅 Mié 9 Sept 2026 >` con botón `Hoy`.
    - Tira semanal interactiva (7 días: LUN..DOM) con selección activa en azul índigo (`MIÉ 9+`) y puntos de colores calculados según los estados reales de las reservas del día (verde, azul, rosa, etc.).
    - Tarjetas KPI interactivas de 1 clic: `LIBRES (N salones)`, `OCUPADOS (N salones)`, `MANT. (N área)` que filtran instantáneamente la lista con un solo toque.
    - Carrusel de chips de filtro rápido: `Todas`, `Solo Libres`, `Ocupación Parcial`, `Ocupados`, `Salones Grandes (> 150 PAX)`.
    - Tarjetas de salón por disponibilidad (06:00 a 24:00, 18 horas operativas):
      - *Disponible todo el día*: Línea de tiempo visual completa con horas disponibles y botón primario `+ Reservar este salón`.
      - *Ocupación parcial*: Intervalos libres (mínimo 1 hora) con botón `+ Reservar` intercalados cronológicamente con tarjetas de eventos ocupados (horario, badge de estado, cotización `Cot. Q XX,XXX`, comensales `PAX XX`, vendedor y notas), más botones `Ver detalle` y `+ Añadir reserva`.
      - *Ocupado todo el día*: Lista de reservas que abarcan el día completo.
      - *Mantenimiento*: Bloque violeta con llave inglesa, descripción de trabajo, horario restringido y botón de reapertura `🕒 Reservar tarde`.
    - Prellenado inteligente: Al tocar `+ Reservar este salón` o `+ Reservar` en un espacio libre, `ReservationForm` abre con fecha, salón y horas preseleccionadas automáticamente mediante `?salon=...`.
    - Código de colores operativo: Desplegable al final del scroll con guía visual de los 7 estados.
    - Botón flotante (FAB) `+ Nueva reserva` violeta/índigo con texto y cruz blanca.
    - Barra de navegación inferior fija: `Calendario` (vistas clásicas), `Salones` (vista móvil activa), `Cotizaciones` (`/posibles-ventas`) y `Reportes` (`/reports`).
  - **Aislamiento desktop**:
    - En pantallas grandes (`> 768px`), el calendario de escritorio permanece 100% intacto con su topbar y grilla completa.

### Calendario Móvil: Navegación de Semanas y Buscador de Mes/Año (2026-09-09)
- Bug: Los controles de cambiar de semana (`<` y `>`) y el botón para buscar mes/año no respondían o se bloqueaban en dispositivos móviles.
- Causas raíz identificadas y resueltas:
  1. **Escape de contenedor `overflow: auto` (Montaje con `createPortal`)**: El modal de búsqueda de mes se renderizaba dentro del árbol React hijo de `.lum-main` (que tiene `overflow: auto; position: relative`). En WebKit/Chromium móvil, los elementos `position: fixed` quedaban atrapados dentro del contenedor con scroll o recortados fuera del viewport visible, dejando además un backdrop transparente que bloqueaba clics posteriores. Se encapsuló el modal con `createPortal(..., document.body)` para garantizar despliegue en pantalla completa al frente de toda la aplicación.
  2. **Intercepción por pseudo-elementos globales (`button::after`)**: En `styles.css:322`, la regla global `button::after { content: ''; position: absolute; inset: 0; ... }` generaba hitboxes de miles de píxeles al aplicarse sobre botones con `all: unset`. Se suprimió de raíz con `display: none !important; content: none !important; pointer-events: none !important;` en todos los botones de `.mobile-salones-root` y `.ms-month-modal-backdrop`.
  3. **Semántica táctil nativa**: Se cambió `.ms-date-display` de `<div>` a `<button type="button">` con `touch-action: manipulation !important` y `pointer-events: none` en iconos/textos internos para que los toques táctiles se registren sin retardos ni pérdidas de foco en Android y Safari iOS.
  4. **Buscador interactivo de Meses y Años**: Se agregó una barra de búsqueda (`ms-month-search-input`) dentro del modal donde el usuario puede escribir el mes (ej: "Oct", "Diciembre") o el año (ej: "2027"), filtrando en tiempo real la cuadrícula de 12 meses y actualizando el selector con 1 solo toque.
  5. **Navegación por deslizamiento (Swipe)**: Soporte táctil nativo en la tira semanal (`onTouchStart` / `onTouchEnd` > 45px horizontal) para cambiar de semana deslizando el dedo hacia la izquierda o derecha.
  6. **Aislamiento en modo desarrollo (`vite.config.js`)**: En `mode === 'development'`, `__APP_VERSION__` ahora inyecta `'0.0.0-dev'`, impidiendo que `UpdateBanner` aparezca superpuesto en la parte superior en entornos locales.
  7. **Cierre prematuro al navegar meses en fecha exacta (`↑` / `↓`)**: En Chrome, al pulsar las flechas del selector nativo `<input type="date">` para cambiar de mes, se disparaba `onChange` intermedio, cerrando el modal de inmediato. Se desacopló el cierre automático de `onChange` usando estado local `exactDateValue` + botón explícito `[ Aplicar ]` y verificación estricta de `e.target === e.currentTarget` en el backdrop.
  8. **Iconografía Minimalista Profesional y Retiro de Buscador (2026-09-09)**:
     - Retirado el input de búsqueda del modal de meses para una experiencia visual limpia y directa, aprovechando la cuadrícula de 12 meses accesible con un solo toque.
     - Eliminados todos los emojis (`📅`, `🏖️`, `🎨`, `🕒`) y caracteres de texto plano (`‹`, `›`, `✕`, `▲`, `▼`, `+`).
     - Sustituidos por iconos vectoriales SVG minimalistas (`strokeWidth="2.2"`, esquinas redondeadas, consistentes con el diseño moderno del CRM) en cabecera de modal (`.ms-modal-icon-badge`), botón de cierre, selector de año, botones de reserva en tarjetas, estado vacío, código de colores y botón flotante FAB.
     - **Rediseño de 'O fecha exacta'**: Estructurado en tarjeta de 2 filas (`.ms-month-exact-date-box`) con etiqueta superior e input ampliado a ancho completo con altura ergonómica (38px) junto al botón `[ Aplicar ]`, eliminando la colisión del texto de la fecha con el icono nativo de calendario.

### Calendario Móvil: Vista Timeline Diario (6 Bloques) y Barra Inferior Simplificada (2026-09-09)
- Requerimiento:
  1. Eliminar los botones inferiores (`Calendario`, `Salones`, `Cotizaciones`, `Reportes`) y el botón flotante (FAB) que tapaba la pantalla.
  2. Colocar abajo únicamente dos botones ergonómicos lado a lado: a la derecha `+ Nueva reserva` y a la par (izquierda) el selector de vista tipo timeline (`Vista Timeline` / `Vista Tarjetas`).
  3. Crear una vista tipo Timeline inspirada en la maqueta de referencia provista por el usuario (`media_1788992570103.png`), manteniendo el diseño estructural de matriz de 6 bloques y píldoras 3D, pero armonizando 100% los colores con la estética clara, moderna e institucional del CRM.
- Solución implementada:
  - **Barra inferior unificada (`.ms-bottom-bar-unified`)**:
    - Removidos el botón flotante `.ms-fab` y el `<nav className="ms-bottom-nav">` con los 4 accesos directos.
    - Barra fija inferior tipo dock con fondo glassmorphism translúcido claro (`rgba(255, 255, 255, 0.96)` con `backdrop-filter: blur(16px)`), borde superior suave `#e2e8f0`, soporte para `env(safe-area-inset-bottom)` y layout 50/50 (`flex: 1` por botón):
      - Botón izquierdo (`.ms-bottom-view-btn`): Alterna entre `[ ⫼ Vista Timeline ]` y `[ ⊞ Vista Tarjetas ]` con icono SVG minimalista y estado activo en suave índigo `#eef2ff` / `#4338ca`.
      - Botón derecho (`.ms-bottom-new-btn`): `+ Nueva reserva` con fondo gradiente púrpura/índigo institucional (`#6366f1` a `#4f46e5`) e icono vectorial de suma.
  - **Vista Timeline Diario — 6 Bloques (`.ms-timeline-card`) en Paleta Armonizada del CRM**:
    - **Tarjeta contenedor**: Fondo blanco puro (`#ffffff`), borde suave `#e2e8f0`, esquinas redondeadas (16px), sombra sutil ejecutiva (`0 4px 16px -2px rgba(15, 23, 42, 0.06)`).
    - **Encabezado de matriz**: Título `Timeline Diario — 6 Bloques` con icono índigo `#4f46e5`, texto `#0f172a` y badge de `HOY` o fecha seleccionada en pill suave `#eef2ff` / `#4338ca`.
    - **Columnas de tiempo**: `SALA` (slate-700), y bloques horarios `10h`, `12h`, `14h`, `16h`, `18h`, `20h` (slate-500).
    - **Indicador de bloque en tiempo real (`▲`)**: Si se visualiza el día de hoy, la columna de la hora activa se resalta en el color primario del CRM (`#4338ca`) con una flecha cian/índigo `▲`.
    - **Pills 3D biseladas adaptadas a la paleta del CRM**:
      - *Libre*: Verde esmeralda suave (`#d1fae5` con bisel superior `#10b981` y bordes `#a7f3d0`).
      - *Confirmado (En Uso)*: Rosa/coral suave (`#ffe4e6` con bisel superior `#e11d48` y bordes `#fecdd3`).
      - *Cotizado / En Proceso*: Ámbar suave (`#fef3c7` con bisel superior `#d97706` y bordes `#fde68a`).
      - *Pre-reserva / Lista de espera*: Azul suave (`#dbeafe` con bisel superior `#2563eb` y bordes `#bfdbfe`).
      - *Mantenimiento*: Lavanda suave (`#ede9fe` con bisel superior `#7c3aed` y bordes `#ddd6fe`).
    - **Leyenda inferior**: Barra redondeada al pie de la matriz (`#f8fafc`) con puntos de color 3D y etiquetas claras: `Libres`, `Confirmado`, `Cotizado`, `Pre-reserva`, `Mant.`.
  - **Modal interactivo por bloque (Bottom Sheet `ms-block-detail-card`)**:
    - Al pulsar cualquier píldora de la matriz, se abre un modal inferior detallado con fondo blanco y tipografía institucional del CRM:
      - Si está libre: Botón directo `+ Reservar este bloque` que prellena automáticamente el salón, fecha y horario en `ReservationForm`.
      - Si está ocupado o en cotización: Muestra el nombre de la institución, cliente, comensales (PAX), vendedor, estado comercial y botón `👁 Ver reserva completa`.
      - Si está en mantenimiento: Muestra la descripción del trabajo y horas restringidas.
  - **Alternancia fluida de vistas**: Los usuarios pueden alternar entre la vista ejecutiva rápida de matriz (Timeline) y la vista detallada cronológica (Tarjetas) con un solo toque sin perder la fecha o filtros activos.

### Calendario Escritorio: Vista Timeline Diario (6 Bloques y Tarjetas) (2026-09-09)
- Requerimiento:
  - Extender la experiencia de la vista Timeline de la versión móvil hacia la versión de escritorio (`> 768px`).
- Solución implementada:
  - **Componente dedicado (`DesktopTimelineView.jsx`)**:
    - **Acceso desde Topbar**: Añadido `{ key: 'timeline', label: 'Timeline' }` al array de `views` en `Topbar.jsx` y activación de filtros (`isFilterActive`).
    - **Navegación y formato en MainLayout**: `viewMode === 'timeline'` soporta navegación anterior/siguiente día a día y etiqueta legible con día de la semana (`dateRangeLabel`).
    - **Tira semanal de 7 días (LUN..DOM)**: Mini-panel interactivo que muestra las tarjetas del día con conteo de eventos, puntos de ocupación de colores y navegación de semanas `<` y `>`.
    - **Tarjetas KPI y Filtros rápidos de 1 Clic**: Métricas de `TOTAL SALONES`, `LIBRES TODO EL DÍA`, `OCUPACIÓN PARCIAL`, `OCUPADOS`, `MANTENIMIENTO` y chips de categoría (`Todos`, `Solo Libres`, `Parciales`, `Ocupados`, `Grandes >150 PAX`) integrados con filtros de Topbar (búsqueda, salón, estado, vendedor).
    - **Matriz de 6 Bloques para Escritorio**:
      - Columnas de tiempo: `10h (08:00-11:00)`, `12h (11:00-13:00)`, `14h (13:00-15:00)`, `16h (15:00-17:00)`, `18h (17:00-19:00)`, `20h (19:00-23:00)`.
      - Indicador `▲ ACTUAL` en tiempo real en la columna horaria activa del día actual.
      - Píldoras 3D armonizadas con nombres de eventos visibles, comensales (PAX) y horarios.
      - Celdas disponibles con badge `✓ Libre` y botón `+ Reservar`.
      - Tooltip flotante enriquecido al pasar el cursor por encima de cualquier bloque con datos completos del evento/salón.
      - Diálogo modal interactivo al hacer clic para reservar el bloque (`+ Reservar este bloque horario`), reservar el día completo o abrir la reserva completa.
    - **Alternancia de vista**: Permite conmutar con un clic entre la **Matriz (6 Bloques)** y la vista de **Tarjetas Detalladas** en grid multi-columna de escritorio.

### Cotizaciones: Reemplazo accidental de Empresa y Encargado por colisión de `companyId` compartido (2026-09-10)
- Bug: Al crear una cotización, llenar el carrito operativo e ingresar datos de empresa y encargado, al reabrir el evento días después para agregar ítems extras o imprimir/guardar, aparecía otra empresa o encargado no asignado originalmente (ej. "60 AÑOS MIRNA CANO" o encargados de otras instituciones ajenas).
- Causa raíz:
  1. **Herencia de IDs colisionados**: En migraciones históricas, más de 250 eventos en MariaDB tenían asignado `companyId: "10"` (u otros valores genéricos como `"100"` o `"1000"`), a pesar de que cada evento poseía su propio `companyName` y `contact` real (bodas, talleres, retiros, cumpleaños, etc.).
  2. **Sobreescritura global de empresa**: Cuando un usuario editaba una cotización y guardaba la empresa desde el modal de edición/creación en `QuoteModal.jsx`, el modal reusaba `existing?.id || quote.companyId` (`"10"`). Al guardar (ej. el 9 de septiembre para "60 AÑOS MIRNA CANO"), sobreescribió el registro `10` en la tabla global `empresas`.
  3. **Cascada a todos los eventos y fallback a primer encargado**: Al cargar cualquier evento con `companyId: "10"`, el modal traía a la nueva empresa ("60 AÑOS MIRNA CANO"). Al no coincidir el encargado del evento con los de la empresa alterada, el `<select>` de encargado caía automáticamente a `managers[0]` ("MIRNA CANO"), sobreescribiendo permanentemente el contacto al volver a guardar la cotización.
  4. **Desincronización `quote.contact` vs `quote.managerName`**: En `QuoteModal`, el input de texto modificaba `contact`, pero en MariaDB (`tbl_seguimientocotizaciones` y endpoints de cotizaciones) se priorizaba `nombre_encargado` (`quote.managerName`), provocando discrepancias entre lo que el asesor escribía y lo que se visualizaba en los reportes o al reabrir.
- Solución arquitectónica:
  - **Saneamiento y migración de base de datos (`scripts/fix_collided_quote_companies.cjs`)**:
    - Se migraron 553 registros de eventos con IDs de empresa colisionados.
    - Cada empresa distinta fue aislada en su propio registro en `empresas` (`cmp_leg_...`) junto con sus encargados en `encargados_empresa`, preservando el nombre, teléfono y correo originales.
    - Se actualizaron los campos `companyId`, `companyName`, `managerId`, `managerName` y `contact` en el JSON de cotización de cada evento en `cotizaciones_evento` y `tbl_seguimientocotizaciones`.
  - **Aislamiento en `QuoteModal.jsx`**:
    - *Validación estricta de concordancia*: `selectedQuoteCompany` ahora verifica si el nombre de la empresa en el catálogo coincide (`normalizeComp(byId.name) === normalizeComp(quote.companyName)`). Si no coincide, descarta el `companyId` colisionado para evitar asociar una empresa ajena.
    - *Desacoplamiento de creación vs edición*: Se separaron `openCreateCompanyModal()` (que siempre genera un nuevo ID único `cmp_...`) de `openEditCompanyModal(targetComp)` (que edita explícitamente una empresa existente del catálogo).
    - *Selector rápido `+ Agregar encargado`*: Nuevo botón ergonómico junto al selector de encargados con modal dedicado (`showQuickManagerModal`) para vincular nuevos contactos a la empresa seleccionada de inmediato sin perder datos de la cotización.
    - *Preservación de contacto asignado*: Si un evento tiene un contacto guardado que aún no figura en `companyManagers`, el `<select>` muestra y retiene la opción `👤 {quote.contact} (Contacto asignado)` en lugar de forzar un fallback destructivo a `managers[0]`.
    - *Sincronización bidireccional*: Al editar el contacto o seleccionarlo en el dropdown, `quote.contact` y `quote.managerName` se mantienen 100% sincronizados.

