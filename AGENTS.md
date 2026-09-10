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

