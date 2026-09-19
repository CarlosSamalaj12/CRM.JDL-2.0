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

