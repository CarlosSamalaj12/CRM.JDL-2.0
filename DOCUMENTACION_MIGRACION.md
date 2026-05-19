# Documentación Completa para Migración a React - CRM Jardines del Lago

Este documento contiene todos los detalles del sistema actual para facilitar la migración al proyecto React.

---

## Tabla de Contenidos

1. [Arquitectura General](#arquitectura-general)
2. [API del Servidor (Endpoints)](#api-del-servidor-endpoints)
3. [Funciones del Frontend (app.js)](#funciones-del-frontend-appjs)
4. [Estructura de la Base de Datos](#estructura-de-la-base-de-datos)
5. [Estados del Sistema](#estados-del-sistema)
6. [Flujos de Datos](#flujos-de-datos)
7. [Componentes UI y Modales](#componentes-ui-y-modales)
8. [Consideraciones para React](#consideraciones-para-react)

---

## 1. Arquitectura General

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (app.js)                        │
│  - Single Page Application vanilla JS                           │
│  - Calendario, Modales, Reportes, Configuración               │
│  - Persistencia en localStorage                                │
└──────────────────────────┬──────────────────────────────────────┘
                           │ REST API + Socket.IO
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                     BACKEND (server.js)                         │
│  - Node.js + Express                                           │
│  - MariaDB (MySQL)                                              │
│  - 25 endpoints API                                            │
└─────────────────────────────────────────────────────────────────┘
```

**Puerto por defecto**: 3000
**Base de datos**: crm_jdl (MariaDB)

---

## 2. API del Servidor (Endpoints)

### Autenticación

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/health` | Verifica que el servidor esté activo |
| GET | `/api/login-users` | Retorna lista de usuarios para el selector de login |
| POST | `/api/login` | Autentica usuario con userId y password |
| POST | `/api/auth/firebase` | Autenticación con Firebase (crea/vincula usuario) |

**Códigos de respuesta:**
- 200: Éxito
- 400: Error de validación
- 401: Credenciales incorrectas
- 403: Usuario inactivo
- 500: Error del servidor

---

### Estado Global

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/state` | **Obtiene todo el estado**: salones, usuarios, empresas, servicios, eventos, cotizaciones, recordatorios, menu, etc. |
| PUT | `/api/state` | **Guarda todo el estado**: sincroniza cambios desde el cliente |

**Respuesta de `/api/state`:**
```javascript
{
  salones: ["Arenal", "Santa Isabel", ...],
  users: [{ id, name, username, fullName, email, phone, password, signatureDataUrl, avatarDataUrl, active, salesTargetEnabled, monthlyGoals: [{month, amount}] }],
  companies: [{ id, name, owner, email, nit, businessName, eventType, address, phone, notes, managers: [{id, name, phone, email, address}] }],
  services: [{ id, name, price, description, categoryId, subcategoryId, category, subcategory, quantityMode }],
  events: [{ id, groupId, name, salon, date, eventDateStart, eventDateEnd, endDate, status, startTime, endTime, userId, pax, notes, quote: {...} }],
  quickTemplates: [],
  quoteServiceTemplates: [],
  disabledCompanies: [],
  disabledServices: [],
  disabledManagers: [],
  disabledSalones: [],
  globalMonthlyGoals: [{ month, role, amount }],
  checklistTemplates: [],
  checklistTemplateItems: [],
  checklistTemplateSections: ["General"],
  menuMontajeSections: ["General"],
  menuMontajeBebidas: [{ id, nombre, activo }],
  eventChecklists: {},
  occupancyWeeklyOps: {},
  changeHistory: { "eventId": [{ timestamp, userId, userName, change }] },
  reminders: { "eventId": [{ id, date, time, channel, notes }] }
}
```

---

### Gestión de Salones

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/salones` | Lista todos los salones |

---

### Gestión de Servicios y Categorías

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/categorias-servicio` | Lista categorías de servicios |
| POST | `/api/categorias-servicio` | Crea nueva categoría |
| PUT | `/api/categorias-servicio/:id` | Actualiza categoría |
| PATCH | `/api/categorias-servicio/:id/activo` | Activa/desactiva categoría |
| GET | `/api/subcategorias-servicio?categoria_id=X` | Lista subcategorías (opcional por categoría) |
| POST | `/api/subcategorias-servicio` | Crea subcategoría |
| PUT | `/api/subcategorias-servicio/:id` | Actualiza subcategoría |
| PATCH | `/api/subcategorias-servicio/:id/activo` | Activa/desactiva subcategoría |
| POST | `/api/service-catalog/recover` | Recupera catálogo de servicios |

---

### Menú y Montaje (Catálogos)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/menu-catalog/:kind` | Obtiene catálogo de menú (plato_fuerte, preparacion, salsa, guarnicion, postre, bebida, comentario, montaje_tipo, montaje_adicional) |
| POST | `/api/menu-catalog/:kind` | Crea elemento en catálogo |
| PUT | `/api/menu-catalog/:kind/:id` | Actualiza elemento del catálogo |
| GET | `/api/menu-suggestions` | Obtiene sugerencias de menú |
| PUT | `/api/menu-suggestions` | Actualiza sugerencias |

**Parámetros para `GET /api/menu-catalog/:kind`:**
- `kind`: plato_fuerte, preparacion, salsa, guarnicion, postre, bebida, comentario, montaje_tipo, montaje_adicional
- Para `preparacion` se requiere `plato_id` en query

**Parámetros para crear elementos:**
- `plato_fuerte`: { nombre, tipo_plato (NORMAL/VEGETARIANO/VEGANO), es_sin_proteina }
- `preparacion`: { id_plato_fuerte, nombre }
- `salsa`, `guarnicion`, `postre`, `bebida`, `comentario`: { nombre }
- `montaje_tipo`, `montaje_adicional`: { nombre, tipo }

---

### Documentos

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/doc-code-next` | Genera siguiente código de documento (COT-001, COT-002, etc.) |

**Respuesta:**
```javascript
{ ok: true, code: "COT-001" }
```

---

### Archivos Estáticos

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/manifest.json` | Manifiesto PWA |
| GET | `/sw.js` | Service Worker |
| GET | `*` | Servir index.html para SPA |

---

## 3. Funciones del Frontend (app.js)

El archivo app.js tiene más de 24,000 líneas con todas las funciones organizadas por módulo:

### 3.1 Funciones de Autenticación y Sesión

| Función | Descripción |
|---------|-------------|
| `loadPersistedAuthSession()` | Carga sesión desde localStorage |
| `saveAuthSessionToStorage(session)` | Guarda sesión en localStorage |
| `clearAuthSessionFromStorage()` | Limpia sesión |
| `authenticateUser(userId, password)` | Autentica contra API |
| `handleLoginFormSubmit(e)` | Procesa formulario de login |
| `handleUserSelectChange()` | Cambia avatar al seleccionar usuario |
| `logout()` | Cierra sesión |

---

### 3.2 Calendario y Vistas

| Función | Descripción |
|---------|-------------|
| `buildInitialState()` | Crea estado inicial vacío |
| `render()` | Renderiza todo el calendario |
| `renderCalendarGrid()` | Dibuja la grilla del calendario |
| `renderTimeCol()` | Dibuja columna de horas |
| `renderDaysHeader()` | Dibuja encabezado de días |
| `renderEvents()` | Dibuja los eventos en el calendario |
| `renderLegend()` | Dibuja la leyenda de estados |
| `getWeekLabel(start)` | Genera etiqueta de semana |
| `startOfWeek(date)` | Obtiene inicio de semana (lunes) |
| `startOfMonth(date)` | Obtiene inicio de mes |
| `addDays(date, days)` | Agrega días a fecha |
| `moveView(delta)` | Mueve vista adelante/atrás |
| `goToToday()` | Va a la fecha actual |
| `setNavMode(mode)` | Cambia modo de navegación (day/week/month) |
| `setSelectedSalon(salon)` | Filtra por salón |

---

### 3.3 Modal de Reserva (Eventos)

| Función | Descripción |
|---------|-------------|
| `openModalForCreate({date, start, end, salon, rangeDates})` | Abre modal para crear nueva reserva |
| `openModalForEdit(id)` | Abre modal para editar reserva existente |
| `showModal()` | Muestra el modal |
| `closeModal()` | Cierra el modal |
| `validateReservationRequiredFields()` | Valida campos requeridos |
| `updateRulesAndConflictsUI()` | Actualiza UI de conflictos |
| `addSlotRow({salon, slotPax, startTime, endTime})` | Agrega fila de salón/horario |
| `removeSlotRow(index)` | Elimina fila de salón |
| `syncEventPaxFromSlots()` | Sincroniza PAX desde los slots |
| `syncHiddenTimesFromFirstSlot()` | Sincroniza horas ocultas |
| `renderSlotsBody()` | Renderiza los slots del evento |
| `handleEventFormSubmit(e)` | Procesa formulario de evento |
| `saveEventToState(event)` | Guarda evento en estado |
| `deleteEventFromState(eventId)` | Elimina evento |

---

### 3.4 Estados de Reserva

```javascript
const STATUS = {
  CONFIRMADO: "Confirmado",
  LISTA: "Lista de Espera",
  PRERESERVA: "Pre reserva",
  MANTENIMIENTO: "Mantenimiento",
  CANCELADO: "Cancelado",
  PERDIDO: "Perdido",
  RESERVA_SIN_COTIZACION: "Reserva sin Cotizacion",
  PRIMERA: "1er Cotizacion",
  SEGUIMIENTO: "Seguimiento"
};
```

**Estados automáticos** (se asignan sin intervención del usuario):
- Reserva sin Cotizacion
- 1er Cotizacion
- Seguimiento
- Perdido

---

### 3.5 Sistema de Cotizaciones

| Función | Descripción |
|---------|-------------|
| `openQuoteModal(eventId)` | Abre modal de cotización |
| `closeQuoteModal()` | Cierra modal de cotización |
| `renderQuoteHeaderFields()` | Renderiza campos del encabezado |
| `renderCompaniesSelect(selectedId)` | Renderiza selector de empresas |
| `renderQuoteManagerSelect(companyId, selectedManagerId)` | Renderiza selector de encargado |
| `renderQuoteTemplateSelect(selectedId)` | Renderiza selector de plantilla |
| `renderQuoteServiceTemplateSelect(selectedId)` | Renderiza selector de plantilla de servicios |
| `searchServices(query)` | Busca servicios |
| `addServiceToQuote(service)` | Agrega servicio a cotización |
| `removeQuoteItem(rowId)` | Elimina item de cotización |
| `moveQuoteItemUp(rowId)` | Mueve item arriba |
| `moveQuoteItemDown(rowId)` | Mueve item abajo |
| `duplicateQuoteItem(rowId)` | Duplica item |
| `calculateQuoteTotals(quote)` | Calcula subtotal, descuento, total |
| `setQuoteDiscountType(type)` | Tipo de descuento (AMOUNT/PERCENT) |
| `setQuoteDiscountValue(value)` | Valor del descuento |
| `getQuoteTotals(quote)` | Obtiene totales calculados |
| `openQuoteAdvanceModal()` | Abre modal de anticipos |
| `closeQuoteAdvanceModal()` | Cierra modal de anticipos |
| `addQuoteAdvance(advance)` | Agrega anticipo |
| `removeQuoteAdvance(id)` | Elimina anticipo |
| `renderQuoteAdvances()` | Renderiza lista de anticipos |
| `setQuoteDocPanelVisible(visible)` | Muestra/oculta panel de documento |
| `generateQuoteDocumentHtml(quote, templateId)` | Genera HTML del documento |
| `printQuoteDocument()` | Imprime documento |
| `downloadQuotePdf()` | Descarga PDF |
| `renderQuoteVersionControls()` | Controles de versión |
| `loadQuoteVersion(versionNumber)` | Carga versión específica |
| `createNewQuoteVersion()` | Crea nueva versión |
| `saveQuoteToState()` | Guarda cotización en estado |
| `persistQuote()` | Persiste cotización en API |

---

### 3.6 Menú y Montaje

| Función | Descripción |
|---------|-------------|
| `openMenuMontajeModal()` | Abre modal de menú y montaje |
| `closeMenuMontajeModal()` | Cierra modal |
| `openMenuMontajeSelectableModal()` | Abre modal de selección de menú |
| `saveMenuMontajeFromModal(options)` | Guarda menú desde modal |
| `renderMenuMontajeEntries()` | Renderiza entradas de menú |
| `addMenuMontajeEntry()` | Agrega entrada de menú |
| `removeMenuMontajeEntry(index)` | Elimina entrada |
| `updateMenuMontajeEntry(index, data)` | Actualiza entrada |
| `renderMenuMontajeSuggestions()` | Renderiza sugerencias |
| `loadMenuSuggestions(protein, preparation)` | Carga sugerencias |
| `openMenuCatalogManagerModal(kind)` | Abre catálogo de menú |
| `saveMenuCatalogItem(kind, data)` | Guarda item del catálogo |
| `deleteMenuCatalogItem(kind, id)` | Elimina item del catálogo |

---

### 3.7 Módulo de Leads (Clientes Potenciales)

| Función | Descripción |
|---------|-------------|
| `openLeadsModal()` | Abre modal de leads |
| `closeLeadsModal()` | Cierra modal |
| `renderLeadsFilters()` | Renderiza filtros |
| `getLeadsFilteredRows()` | Obtiene leads filtrados |
| `renderLeadsTable()` | Renderiza tabla de leads |
| `buildLeadsRows()` | Construye filas de leads |

---

### 3.8 Buscador de Eventos

| Función | Descripción |
|---------|-------------|
| `openEventFinderModal()` | Abre modal de búsqueda |
| `closeEventFinderModal()` | Cierra modal |
| `searchEvents(query)` | Busca eventos |
| `renderEventFinderResults(results)` | Renderiza resultados |

---

### 3.9 Reportes

#### Reporte de Ventas
| Función | Descripción |
|---------|-------------|
| `openSalesReportModal()` | Abre reporte de ventas |
| `buildSalesReportRows()` | Construye filas del reporte |
| `getSalesReportFilteredRows()` | Obtiene filas filtradas |
| `renderSalesReportFilters()` | Renderiza filtros |
| `renderSalesReportSummary(rows)` | Resumen del reporte |
| `renderSalesReportTable()` | Tabla del reporte |
| `exportSalesReportToExcel()` | Exporta a Excel |

#### Reporte de Contabilidad
| Función | Descripción |
|---------|-------------|
| `openAccountingReportModal()` | Abre reporte de contabilidad |
| `enrichAccountingReportRows(rows)` | Enriquece datos del reporte |
| `getAccountingReportFilteredRows()` | Obtiene filas filtradas |
| `renderAccountingReportFilters()` | Filtros del reporte |
| `renderAccountingReportTable()` | Tabla del reporte |
| `getAccountingCompanyAccounts(rows)` | Agrupa por empresa |
| `buildAccountingLedgerEntries(account)` | Construye libro mayor |
| `renderAccountingStatementModal(account)` | Modal de estado de cuenta |
| `exportAccountingReportToExcel()` | Exporta a Excel |

#### Reporte de Ocupación
| Función | Descripción |
|---------|-------------|
| `openOccupancyReportModal()` | Abre reporte de ocupación |
| `buildOccupancyReportRows()` | Construye filas |
| `getOccupancyWeekRange()` | Obtiene rango de semana |
| `updateOccupancyReportWeekUi(monday)` | Actualiza UI de semana |
| `moveOccupancyReportWeek(deltaWeeks)` | Mueve semana |
| `renderOccupancyReportTable()` | Renderiza tabla |
| `exportOccupancyReportToExcel()` | Exporta a Excel |

#### Reporte Dashboard
| Función | Descripción |
|---------|-------------|
| `openDashboardReportModal()` | Abre dashboard |
| `buildDashboardReportRows(fromIso, toIso)` | Construye datos |
| `calculateDashboardMetrics(rows, fromIso, toIso)` | Calcula métricas |
| `renderDashboardReport()` | Renderiza dashboard |
| `renderDashboardGoalsGrid()` | Grid de metas |
| `renderDashboardCompareChart()` | Gráfico de comparación |
| `renderDashboardBestMonthChart()` | Mejor mes |

#### Reporte por Institución
| Función | Descripción |
|---------|-------------|
| `openInstitutionReportModal()` | Abre reporte por empresa |
| `getInstitutionReportDefaultRange()` | Rango de fechas por defecto |
| `getInstitutionReportFilteredCompanies()` | Empresas filtradas |
| `buildInstitutionReportData(companyId, fromIso, toIso)` | Datos del reporte |
| `renderInstitutionReport()` | Renderiza reporte |
| `renderInstitutionOverviewGrid()` | Grid de overview |
| `renderInstitutionReportCharts()` | Gráficos del reporte |
| `renderInstitutionReportTimeline()` | Línea de tiempo |

---

### 3.10 Configuración

#### Gestión de Usuarios
| Función | Descripción |
|---------|-------------|
| `openUserModal(userId)` | Abre modal de usuario |
| `closeUserModal()` | Cierra modal |
| `loadUserInModal(userId)` | Carga usuario en modal |
| `resetUserModalForm()` | Resetea formulario |
| `setUserModalMode(mode, user)` | Modo crear/editar |
| `upsertUserMonthlyGoalDraft()` | Agrega/edita meta mensual |
| `saveUserFromModal()` | Guarda usuario |

#### Gestión de Empresas
| Función | Descripción |
|---------|-------------|
| `openCompanyModal(companyId)` | Abre modal de empresa |
| `closeCompanyModal()` | Cierra modal |
| `loadCompanyInModal(companyId)` | Carga empresa |
| `resetCompanyModalForm()` | Resetea formulario |
| `addCompanyManager()` | Agrega encargado |
| `removeCompanyManager(index)` | Elimina encargado |
| `saveCompanyFromModal()` | Guarda empresa |

#### Gestión de Servicios
| Función | Descripción |
|---------|-------------|
| `openServiceModal(serviceId)` | Abre modal de servicio |
| `closeServiceModal()` | Cierra modal |
| `loadServiceInModal(serviceId)` | Carga servicio |
| `resetServiceModalForm()` | Resetea formulario |
| `saveServiceFromModal()` | Guarda servicio |
| `openServiceCategoryManagerModal()` | Abre gestor de categorías |
| `openServiceSubcategoryManagerModal()` | Abre gestor de subcategorías |

#### Gestión de Salones
| Función | Descripción |
|---------|-------------|
| `openSalonesModal()` | Abre modal de salones |
| `closeSalonesModal()` | Cierra modal |
| `loadSalonInModal(name)` | Carga salón |
| `saveSalonFromModal()` | Guarda salón |

#### Metas Globales
| Función | Descripción |
|---------|-------------|
| `openGlobalGoalsModal()` | Abre modal de metas |
| `closeGlobalGoalsModal()` | Cierra modal |
| `loadGlobalGoalInModal(month)` | Carga meta |
| `saveGlobalGoalFromModal()` | Guarda meta |

#### Checklists
| Función | Descripción |
|---------|-------------|
| `openChecklistTemplateModal()` | Abre modal de plantillas |
| `closeChecklistTemplateModal()` | Cierra modal |
| `addChecklistTemplate()` | Agrega plantilla |
| `removeChecklistTemplate(id)` | Elimina plantilla |
| `addChecklistSection()` | Agrega sección |
| `openEventChecklistModal(eventId)` | Abre checklist de evento |
| `saveEventChecklistFromModal()` | Guarda checklist |

#### Import/Export
| Función | Descripción |
|---------|-------------|
| `exportEventsToExcel()` | Exporta eventos |
| `exportCompaniesToExcel()` | Exporta empresas |
| `exportManagersToExcel()` | Exporta encargados |
| `downloadEventsTemplate()` | Descarga plantilla eventos |
| `importEventsFromCsv(file)` | Importa eventos |
| `downloadManagersTemplate()` | Descarga plantilla encargados |
| `importManagersFromCsv(file)` | Importa encargados |

---

### 3.11 Recordatorios y Citas

| Función | Descripción |
|---------|-------------|
| `openAppointmentModal(eventId)` | Abre modal de cita |
| `closeAppointmentModal()` | Cierra modal |
| `saveAppointmentFromModal()` | Guarda cita |
| `renderAppointmentsForEvent(event)` | Renderiza citas |
| `deleteAppointment(id)` | Elimina cita |
| `renderTopbarReminderPanel()` | Renderiza panel de recordatorios |
| `checkRemindersAndNotify()` | Verifica recordatorios |

---

### 3.12 Historial de Cambios

| Función | Descripción |
|---------|-------------|
| `renderHistoryForEvent(event)` | Renderiza historial |
| `addHistoryEntry(eventId, change)` | Agrega entrada de historial |
| `setHistoryPanelVisible(visible)` | Muestra/oculta panel |

---

### 3.13 Persistencia y Sincronización

| Función | Descripción |
|---------|-------------|
| `persist()` | Persiste estado al servidor |
| `schedulePersist()` | Programa persistencia (debounce 700ms) |
| `syncFromServer()` | Sincroniza desde servidor |
| `ensureApiStateUrlWorks()` | Verifica URL de API |
| `tryApiStateUrl(url)` | Prueba URL de API |

---

### 3.14 Utilidades

| Función | Descripción |
|---------|-------------|
| `escapeHtml(text)` | Escapa HTML |
| `toISODate(date)` | Convierte a ISO date |
| `parseISODate(text)` | Parsea ISO date |
| `fmtDate(date)` | Formatea fecha |
| `fmtTime(time)` | Formatea hora |
| `moneyGT(amount)` | Formatea货币 (Q) |
| `compareTime(a, b)` | Compara horas |
| `timeToMinutes(time)` | Convierte tiempo a minutos |
| `minutesToTime(minutes)` | Convierte minutos a tiempo |
| `isValidClockTime(time)` | Valida formato de hora |
| `stripTime(date)` | Limpia tiempo de fecha |
| `deepClone(obj)` | Clonación profunda |
| `matchesLikeSearch(text, query)` | Búsqueda flexible |
| `normalizeUserRecord(user)` | Normaliza usuario |
| `normalizeQuoteVersionHistory(versions)` | Normaliza versiones de cotización |
| `normalizeQuoteAdvancesForSnapshot(advances)` | Normaliza anticipos |

---

## 4. Estructura de la Base de Datos

### Tablas del Sistema

```sql
-- Catálogos base
salones (id, nombre)
usuarios (id, nombre, nombre_usuario, nombre_completo, correo, telefono, contrasena, firma_data_url, avatar_data_url, activo, influye_meta_ventas, metas_mensuales_json)

-- Empresas y contactos
empresas (id, nombre, encargado_principal, correo, nit, razon_social, tipo_evento, direccion, telefono, notas)
encargados_empresa (id, id_empresa, nombre, telefono, correo, direccion)

-- Servicios
servicios (id, nombre, precio, descripcion, id_categoria, id_subcategoria, modo_cantidad)
categorias_servicio (id, nombre, activo)
subcategorias_servicio (id, id_categoria, nombre, activo)

-- Reservas y eventos
eventos (id, id_grupo, nombre, nombre_salon, fecha_evento, fecha_inicio_reserva, fecha_fin_reserva, hora_inicio, hora_fin, estado, id_usuario, pax, notas, cotizacion_json)

-- Cotizaciones
cotizaciones_evento (id_evento, id_empresa, id_encargado, nombre_empresa, nombre_encargado, contacto, correo, facturar_a, direccion, tipo_evento, lugar, horario_texto, codigo, fecha_documento, telefono, nit, personas, fecha_evento, folio, fecha_fin, fecha_max_pago, tipo_pago, notas_internas, notas, cotizado_en_iso, json_crudo)
items_cotizacion_evento (id, id_evento, id_servicio, fecha_servicio, cantidad, precio, nombre, descripcion)
cotizacion_versiones_evento (id, id_evento, version_num, subtotal, descuento_tipo, descuento_valor, descuento_monto, total_neto, cotizado_en_iso, json_crudo)
items_cotizacion_version_evento (id, id_evento, version_num, fila_num, id_servicio, fecha_servicio, cantidad, precio, nombre, descripcion)

-- Historial y recordatorios
historial_evento (id, clave_evento, cambiado_en_iso, id_usuario_actor, nombre_actor, cambio_texto)
recordatorios_evento (id, clave_evento, fecha_recordatorio, hora_recordatorio, medio, notas, creado_en_iso, id_usuario_creador)
anticipos_evento (id, id_evento, fecha_anticipo, monto, tipo_pago, descripcion, creado_en_iso)

-- Menú y Montaje
menu_platos_fuertes (id, nombre, tipo_plato, es_sin_proteina, activo)
menu_preparaciones (id, id_plato_fuerte, nombre, activo)
menu_salsas (id, nombre, activo)
menu_guarniciones (id, nombre, activo)
menu_postres (id, nombre, activo)
menu_bebidas (id, nombre, activo)
menu_comentarios_adicionales (id, nombre, activo)
montaje_tipos (id, nombre, activo)
montaje_adicionales (id, nombre, tipo, activo)

-- Sugerencias de menú
menu_preparacion_salsa_sugerida (id_preparacion, id_salsa, prioridad)
menu_preparacion_postre_sugerido (id_preparacion, id_postre, prioridad)
menu_plato_guarnicion_sugerida (id_plato_fuerte, id_guarnicion, prioridad)
menu_plato_preparacion_salsa_sugerida (id_plato_fuerte, id_preparacion, id_salsa, prioridad)
menu_plato_preparacion_postre_sugerido (id_plato_fuerte, id_preparacion, id_postre, prioridad)
menu_plato_preparacion_guarnicion_sugerida (id_plato_fuerte, id_preparacion, id_guarnicion, prioridad)
menu_plato_preparacion_bebida_sugerida (id_plato_fuerte, id_preparacion, id_bebida, prioridad)
menu_plato_preparacion_montaje_tipo_sugerido (id_plato_fuerte, id_preparacion, id_montaje_tipo, prioridad)
menu_plato_preparacion_montaje_adicional_sugerido (id_plato_fuerte, id_preparacion, id_adicional, prioridad)
montaje_tipo_adicional_sugerido (id_montaje_tipo, id_adicional, prioridad)

-- Plantillas de montaje
menu_montaje_plantillas (id, nombre, activo)
menu_montaje_plantilla_detalle (id, id_plantilla, id_plato_fuerte, id_preparacion, id_salsa, id_postre, cantidad, notas)
menu_montaje_plantilla_guarnicion (id_detalle, id_guarnicion)
menu_montaje_plantilla_adicional (id_detalle, id_montaje_tipo, id_adicional, cantidad)

-- Estado global
app_state_kv (clave, valor_json)
doc_sequence (scope, last_value)
```

---

## 5. Estados del Sistema

### Estados de Reserva
1. **Reserva sin Cotización** - Nueva reserva sin documento
2. **1er Cotización** - Primera propuesta enviada
3. **Seguimiento** - En negociación
4. **Lista de Espera** - Esperando confirmación
5. **Pre-reserva** - Reservación preliminar
6. **Confirmado** - Reserva asegurada
7. **Cancelado** - Reserva cancelada
8. **Mantenimiento** - Salón en mantenimiento
9. **Perdido** - Cliente no concretó

### Roles de Usuario
- `vendedor` (Vendedor)
- `recepcionista` (Recepcionista)
- `admin` (Administrador)

### Modos de Navegación
- `day` - Vista por día
- `week` - Vista por semana
- `week` - Vista por mes

---

## 6. Flujos de Datos

### Flujo de Login
```
1. GET /api/login-users → obtiene usuarios para selector
2. Usuario selecciona usuario → muestra avatar
3. Usuario ingresa contraseña
4. POST /api/login → {userId, password}
5. Servidor verifica credenciales (hash scrypt)
6. Respuesta: {ok: true, user: {...}}
7. Frontend guarda sesión en localStorage
```

### Flujo de Sincronización
```
1. App inicia → GET /api/state
2. Servidor lee todas las tablas → retorna estado JSON
3. App carga estado en memoria
4. Cambios → PUT /api/state con estado completo
5. Otros clientes reciben cambio via Socket.IO (futuro)
```

### Flujo de Creación de Reserva
```
1. Click en calendario o "Nueva Reserva"
2. openModalForCreate() → muestra formulario
3. Usuario llena: nombre, fechas, salones, usuario
4. submit → handleEventFormSubmit()
5. saveEventToState() → actualiza array events
6. schedulePersist() → debounce 700ms
7. persist() → PUT /api/state
8. render() → actualiza calendario
```

### Flujo de Cotización
```
1. Desde reserva → "Cotizar evento"
2. openQuoteModal(eventId)
3. Si no hay código → POST /api/doc-code-next
4. Usuario selecciona empresa, encargado
5. Busca y agrega servicios
6. Calcula totales (subtotal, descuento, total)
7. "Guardar" → saveQuoteToState() → persist()
8. "Ver documento" → genera HTML con plantilla
9. "Imprimir" → window.print() o PDF
```

---

## 7. Componentes UI y Modales

### Archivos HTML (index.html)
- **Login Screen**: Formulario de autenticación
- **Module Hub**: Pantalla de módulos
- **Reports Hub**: Selector de reportes
- **Settings Screen**: Configuraciones
- **Calendario**: Grid, header, eventos
- **Modal de Reserva**: Formulario de evento
- **Modal de Cita**: Agregar recordatorio
- **Modal de Usuario**: CRUD de usuarios
- **Modal de Empresa**: CRUD de empresas
- **Modal de Servicio**: CRUD de servicios
- **Modal de Cotización**: Formulario completo
- **Modal de Anticipos**: Pagos parciales
- **Modal de Menú**: Diseño de menú
- **Modal de Reportes**: tables, filtros, exports

### CSS (styles.css + design-system.css)
- Sistema de diseño con CSS custom properties
- Estilos para calendario (grid, eventos, colores)
- Estilos para modales (responsive, animaciones)
- Estilos para tablas, formularios, botones

---

## 8. Consideraciones para React

### Recomendaciones de Arquitectura

1. **Estado Global**: Usar Context API o Zustand para estado global
2. **Fetching**: Usar React Query o SWR para cacheo de API
3. **Rutas**: React Router para navegación
4. **Formularios**: React Hook Form + Zod para validación
5. **UI Components**: Construir biblioteca de componentes
6. **Fechas**: date-fns o dayjs (más ligero que moment)

### Mapeo de Funcionalidades a Componentes

| Funcionalidad Legacy | Componente React Sugerido |
|---------------------|--------------------------|
| Calendario | Calendar component (react-big-calendar o custom) |
| Modal de Reserva | ReservationForm Modal |
| Sistema de Cotizaciones | QuoteBuilder, QuoteEditor |
| Reportes | ReportViewer + filtros |
| Configuración | SettingsPanel con sub-secciones |

### Servicios API (migrar a React)

```javascript
// api.js - Cliente HTTP
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const api = {
  getState: () => fetch(`${API_BASE}/api/state`).then(r => r.json()),
  saveState: (state) => fetch(`${API_BASE}/api/state`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(state)
  }),
  login: (userId, password) => fetch(`${API_BASE}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, password })
  }).then(r => r.json()),
  // ... otros endpoints
};
```

### Keys de localStorage a Migrar

- `crm_topbar_settings_v1` - Configuración de UI
- `crm_quick_templates_v1` - Plantillas rápidas
- `crm_auth_session_v1` - Sesión de usuario
- `crm_active_module_screen_v1` - Última pantalla

---

## 9. Constantes Importantes

```javascript
// URLs de API
const API_STATE_CANDIDATES = [
  "http://192.168.10.2:3002/api/state",
  "http://localhost:3002/api/state",
  "http://127.0.0.1:3002/api/state",
  "/api/state"
];

// Configuración de calendario
const HOUR_START = 0;
const HOUR_END = 23;
const HOUR_HEIGHT = 56;
const SNAP_MINUTES = 30;

// Plantillas de cotización
const CORPORATE_TEMPLATE_ID = "tpl-corporativo";
const SERVIHOSP_TEMPLATE_ID = "tpl-servi-hosp";
const CONTRACT_CORP_TEMPLATE_ID = "tpl-contrato-corp";

// Código para editar eventos pasados
const PAST_EVENT_ADMIN_EDIT_CODE = "JDL-ADMIN-2026";
```

---

## 10. Seguridad

- Contraseñas hasheadas con scrypt (N=16384, r=8, p=1)
- Autenticación Firebase opcional
- Sesiones en localStorage (no cookies)
- Validación de entrada en servidor
- SQL injection prevenido con prepared statements

---

## 11. Variables de Entorno (.env)

```env
APP_PORT=3000
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=crm_jdl
```

---

## 12. Próximos Pasos para Migración

1. **Configurar proyecto React** con Vite
2. **Crear cliente API** baseado en esta documentación
3. **Implementar autenticación** (login + sesión)
4. **Crear estado global** (usando Zustand o Context)
5. **Desarrollar componentes** siguiendo el mapeo anterior
6. **Implementar funcionalidades** una por una
7. **Agregar Socket.IO** para sincronización en tiempo real
8. **Testing** y validación de cada módulo

---

*Documento generado para migración del CRM Jardines del Lago a React*
*Última actualización: Mayo 2026*