# Funciones del Calendario - CRM Jardines del Lago

Este documento detalla todas las funciones del módulo de calendario del sistema CRM, organizadas por funcionalidad.

---

## 1. Inicialización y Configuración

### 1.1 Variables Globales del Calendario

```javascript
let viewStart = startOfWeek(new Date());  // Fecha de inicio de la vista actual
let selectedSalon = ALL_ROOMS_VALUE;       // Salon seleccionado ("__all_rooms__" = todos)
let navMode = "week";                      // Modo de navegacion: "day", "week", "month"
let monthCursor = startOfMonth(new Date()); // Cursor para vista de mes
```

### 1.2 Funciones de Inicialización

| Función | Descripción |
|---------|-------------|
| `goToTodayView()` | Navega a la fecha actual. Configura `monthCursor` al mes actual y `viewStart` al inicio de la semana actual (día o semana) o stripping time (día). |
| `loadTopbarSettings()` | Carga la configuración de la barra superior desde localStorage (`crm_topbar_settings_v1`). Incluye: mostrar leyenda, eventos compactos, mostrar fines de semana. |
| `saveTopbarSettings()` | Guarda la configuración de la barra superior en localStorage. |
| `applyTopbarSettings()` | Aplica los estilos CSS basados en la configuración cargada. |

---

## 2. Renderizado del Calendario

### 2.1 Función Principal de Renderizado

| Función | Descripción |
|---------|-------------|
| `render()` | **FUNCIÓN PRINCIPAL** que redibuja todo el calendario. hace: 1) Limpia selección de interacción, 2) Calcula días visibles según modo, 3) Actualiza etiqueta de fecha (semana/mes/día), 4) Configura columnas CSS, 5) Dibuja encabezado de días con fechas, 6) Dibuja grid con líneas de horas, 7) Filtra eventos por rango y salón, 8) Calcula layout de eventos, 9) Coloca eventos en el grid, 10) Sincroniza scroll de columna de tiempo. |

### 2.2 Renderizado de Componentes

| Función | Descripción |
|---------|-------------|
| `renderLegend()` | Dibuja la leyenda de estados en la barra lateral. Itera sobre `STATUS_META` y crea badges con puntos de colores para cada estado (Confirmado, Lista de Espera, Pre-reserva, etc.). |
| `renderTimeColumn()` | Dibuja la columna de horas (00:00 a 23:00). Crea 24+1 slots de tiempo con formato AM/PM (12h). |
| `renderRoomSelects()` | Llena el selector de salones en la barra superior con los salones activos del estado. Incluye opción "Todos los salones". Actualiza también las opciones en los slots del formulario de evento. |
| `renderStatusSelect()` | Llena el selector de estados en el formulario de reserva. Usa la función `statusOptionsHtml()` para generar opciones. |
| `renderUsersSelect()` | Llena el selector de usuarios en el formulario de evento. Solo muestra usuarios activos. Selecciona por defecto el usuario de la sesión actual. |
| `renderTopbarWelcome()` | Muestra el mensaje "Bienvenido - [nombre]" y el avatar del usuario en la barra superior. |
| `renderCompaniesSelect(selectedId)` | Llena el selector de empresas en el modal de cotización. |
| `renderServicesList()` | Prepara la lista de servicios para el datalist del buscador de servicios en cotizaciones. |
| `syncCalendarVerticalOffset()` | Sincroniza el offset del header del calendario con la propiedad CSS `--calendar-header-offset` para posicionar correctamente los eventos. |

### 2.3 Vistas del Calendario

| Función | Descripción |
|---------|-------------|
| `getVisibleDayCount()` | Retorna la cantidad de días visibles según el modo: día=1, semana=5 (sin weekends) o 7, mes=determina días del mes. |
| `renderDayView()` | Renderiza vista de un solo día (no usada actualmente, implícita en render()). |
| `renderWeekView()` | Renderiza vista de semana (default). |
| `renderMonthView()` | Renderiza vista de mes, donde monthCursor determina el mes mostrado. |

---

## 3. Navegación del Calendario

### 3.1 Funciones de Movimiento

| Función | Descripción |
|---------|-------------|
| `shiftViewBackward()` | Retrocede en el calendario: mes=-1, día=-1, semana=-días_visibles. Llama `render()` después. |
| `shiftViewForward()` | Avanza en el calendario: mes=+1, día=+1, semana=+días_visibles. Llama `render()` después. |
| `goToToday()` | Botón "Hoy" que llama `goToTodayView()` y luego `render()`. |
| `setNavMode(mode)` | Cambia el modo de navegación (day/week/month). Ajusta viewStart y monthCursor según el modo anterior. |
| `setSelectedSalon(salon)` | Filtra el calendario por un salón específico. |
| `revealEventInCalendar(eventId)` | Navega al calendario y muestra un evento específico: ajusta `monthCursor`, `viewStart` y `selectedSalon` según el evento, luego llama `render()`. |

### 3.2 Botones de Navegación (Event Listeners)

```javascript
el.btnPrev.addEventListener("click", shiftViewBackward);
el.btnNext.addEventListener("click", shiftViewForward);
el.btnToday.addEventListener("click", () => { goToTodayView(); render(); });
el.navMode.addEventListener("change", (e) => { /* cambia navMode */ });
el.roomSelect.addEventListener("change", (e) => { selectedSalon = e.target.value; render(); });
```

---

## 4. Gestión de Eventos (Reservas)

### 4.1 Apertura y Cierre de Modales

| Función | Descripción |
|---------|-------------|
| `openModalForCreate({date, start, end, salon, rangeDates})` | Abre el modal para crear una nueva reserva. Recibe fecha/hora/salón inicial. Configura valores por defecto: estado "Reserva sin Cotización", usuario actual, agrega primer slot. |
| `openModalForEdit(id)` | Abre el modal para editar una reserva existente. Carga todos los datos del evento: nombre, fechas, salones/horarios, usuario, estado, notas. Muestra botones de historial y citas. Verifica si el evento es pasado y puede requerir código de administrador. |
| `showModal()` | Muestra el backdrop del modal de evento y agrega clase CSS.Hace focus al campo nombre. |
| `closeModal()` | Cierra el modal de evento, limpia datos, oculta paneles de historial y citas. |

### 4.2 Gestión de Slots (Salones y Horarios)

| Función | Descripción |
|---------|-------------|
| `addSlotRow({salon, slotPax, startTime, endTime})` | Agrega una fila de salón/horario al formulario. Cada reserva puede tener múltiples salones con diferentes horarios. |
| `removeSlotRow(index)` | Elimina una fila de slot por índice. |
| `getSlotsFromForm()` | Lee todos los slots del formulario y retorna array de objetos con: salon, slotPax, startTime, endTime, dateStart, dateEnd. |
| `syncEventPaxFromSlots()` | Calcula el PAX total sumando el PAX de cada slot. Asigna al campo eventPax. |
| `syncHiddenTimesFromFirstSlot()` | Sincroniza los campos ocultos startTime y endTime con el primer slot del formulario. |
| `renderSlotsBody()` | Renderiza la tabla de slots en el formulario de evento. |
| `rerenderSlotRoomOptions()` | Actualiza las opciones de salón en todos los slots cuando cambia el catálogo de salones. |

### 4.3 Validación de Eventos

| Función | Descripción |
|---------|-------------|
| `validateReservationRequiredFields()` | Valida que el formulario tenga: nombre, fecha inicio/fin, usuario, PAX, al menos un slot completo. Muestra toasts de error si falta algo. |
| `updateRulesAndConflictsUI()` | Evalúa las reglas de negocio y detecta conflictos de horario. Muestra advertencias en la UI. |
| `evaluateRules(draft, replaceIds)` | Evalúa reglas: disponibilidad del salón, capacidad maxima, conflictos con otras reservas. Retorna `{ok: true}` o `{ok: false, message}`. |

### 4.4 Guardado y Eliminación

| Función | Descripción |
|---------|-------------|
| `saveEventFromForm()` | **FUNCIÓN PRINCIPAL DE GUARDADO**: 1) Valida todos los campos, 2) Normaliza fechas y horas, 3) Verifica conflictos, 4) Construye eventos (soporta eventos multifecha y multisalón), 5) Guarda/actualiza en state.events, 6) Registra historial de cambios, 7) Persiste en servidor, 8) Cierra modal y renderiza. |
| `removeEvent(id, actorUserId)` | Elimina un evento y toda su serie (eventos agrupados). Registra eliminación en historial, libera capacidad notificada a reservas en lista de espera. |
| `getEventSeries(ev)` | Obtiene todos los eventos relacionados (mismo groupId). Si no hay groupId, retorna solo ese evento. |
| `getEventSeriesFinancialMeta(ev)` | Obtiene metadatos financieros de la serie: salones únicos, salon principal, fechas inicio/fin, horarios. |

---

## 5. Sistema de Fechas y Horas

### 5.1 Funciones de Fecha

| Función | Descripción |
|---------|-------------|
| `startOfWeek(date)` | Retorna el lunes de la semana de la fecha recibida. |
| `startOfMonth(date)` | Retorna el primer día del mes de la fecha recibida. |
| `addDays(date, days)` | Agrega o resta días a una fecha. |
| `addMonths(date, months)` | Agrega o resta meses a una fecha. |
| `addWeeks(date, weeks)` | Agrega o resta semanas (usa addDays). |
| `isSameDay(date1, date2)` | Compara si dos fechas son el mismo día. |
| `stripTime(date)` | Limpia la hora de una fecha, deja solo fecha (midnight). |
| `toISODate(date)` | Convierte fecha a formato ISO (YYYY-MM-DD). |
| `parseISODate(text)` | Parsea texto en formato ISO a objeto Date. |

### 5.2 Funciones de Hora

| Función | Descripción |
|---------|-------------|
| `timeToMinutes(time)` | Convierte hora "HH:mm" a minutos desde medianoche. |
| `minutesToTime(minutes)` | Convierte minutos a formato "HH:mm". |
| `compareTime(a, b)` | Compara dos horas. Retorna 1, 0, o -1. |
| `isValidClockTime(time)` | Valida que una hora tenga formato "HH:mm" válido (00:00-23:59). |
| `formatHourAmPm(hour)` | Convierte hora 24h a formato 12h AM/PM. |
| `timesOverlap(start1, end1, start2, end2)` | Detecta si dos rangos de tiempo se superponen. |

---

## 6. Colocación de Eventos en el Grid

### 6.1 Layout de Eventos

| Función | Descripción |
|---------|-------------|
| `placeEvent(ev, layout)` | **FUNCIÓN CRÍTICA**: Coloca un evento en el DOM del calendario. Usa el layout calculado para posicionar (top, height, left, width). Crea elemento visual con color según estado, muestra nombre, salon, hora. |
| `computeDayEventLayout(dayEvents)` | **ALGORITMO DE LAYOUT**: Calcula posición y ancho de cada evento en un día. Algoritmo de carriles (lanes): agrupa eventos que se superponen en tiempo y les asigna carriles horizontales. Maneja eventos de diferente duración. |
| `findHardBlocks(draft, replaceIds)` | Encuentra bloqueos duros (reservas confirmadas o prerreserva) que impiden poner el evento en mantenimiento. |
| `buildBlockingWindowsFromEvents(events)` | Construye ventanas de bloqueo para cada evento (salon, fecha, hora inicio/fin). |

### 6.2 Filtrado de Eventos

| Función | Descripción |
|---------|-------------|
| `getEventsInWeek(viewStart, selectedSalon, dayCount)` | Filtra eventos que caen dentro del rango visible del calendario. Si selectedSalon es específico, filtra solo eventos de ese salón. |

---

## 7. Estados de Reserva

### 7.1 Constantes de Estados

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

### 7.2 Funciones de Estados

| Función | Descripción |
|---------|-------------|
| `isAutoStatus(status)` | Retorna true si el estado se asigna automáticamente (RESERVA_SIN_COTIZACION, PRIMERA, SEGUIMIENTO, PERDIDO). Estos estados no pueden elegirse manualmente. |
| `statusColor(status)` | Obtiene el color CSS del estado consultando la variable CSS `--c-[estado]`. |
| `statusOptionsHtml(selected, options)` | Genera opciones HTML para el select de estados. Inhabilita estados automáticos si options.includeAuto es false. |
| `reservationStatusFromQuotePresence(ev)` | Asigna estado automáticamente según si el evento tiene cotización: si tiene cotizacion -> "1er Cotizacion", sino -> "Reserva sin Cotizacion". |
| `autoMarkLostEvents()` | Marca eventos anteriores a hoy sin cotización como "Perdido". Se ejecuta al iniciar y al guardar. |

---

## 8. Búsqueda y Filtros

### 8.1 Buscador de Eventos

| Función | Descripción |
|---------|-------------|
| `openEventFinderModal()` | Abre el modal de búsqueda de eventos.Hace focus al input de búsqueda. |
| `closeEventFinderModal()` | Cierra el modal de búsqueda. |
| `buildEventFinderRows()` | Construye array de eventos para búsqueda con datos normalizados: código, fecha, nombre, salon, empresa, estado. |
| `renderEventFinderResults(term)` | Filtra eventos según término de búsqueda (usa `matchesLikeSearch`) y renderiza tabla de resultados (máx 150). |
| `renderEventFinderIdle()` | Muestra mensaje "Escribe un criterio y presiona Enter para buscar". |

### 8.2 Pipeline de Leads

| Función | Descripción |
|---------|-------------|
| `openLeadsModal()` | Abre el modal de clientes potenciales (pipeline). |
| `closeLeadsModal()` | Cierra el modal de leads. |
| `buildLeadsRows()` | Construye filas de leads filtrando solo estados del pipeline: RESERVA_SIN_COTIZACION, PRIMERA, SEGUIMIENTO, LISTA, PRERESERVA, PERDIDO. |
| `renderLeadsResults(term)` | Renderiza resultados de leads con filtros: estado, vendedor, rango de fechas. |

---

## 9. Historial y Recordatorios

### 9.1 Historial de Cambios

| Función | Descripción |
|---------|-------------|
| `renderHistoryForEvent(event)` | Renderiza el panel de historial de cambios de un evento. Muestra: hora, vendedor, descripción del cambio. |
| `appendHistoryByKey(key, userId, change)` | Agrega entrada al historial de un evento. |
| `appendDetailedEditHistory(key, userId, oldSnapshot, newSnapshot)` | Registra cambios detallados comparando estado anterior vs nuevo. |
| `moveHistoryKey(oldKey, newKey)` | Migra historial cuando se agrupa/desagrupa evento. |
| `setHistoryPanelVisible(visible)` | Muestra/oculta el panel de historial. |

### 9.2 Recordatorios y Citas

| Función | Descripción |
|---------|-------------|
| `openAppointmentModal(eventId)` | Abre modal para agregar cita/recordatorio. |
| `renderAppointmentsForEvent(event)` | Renderiza lista de citas en el panel lateral del modal de evento. |
| `addReminderForEvent(ev, payload)` | Agrega recordatorio a un evento. |
| `getPrimaryReminderForEvent(ev)` | Obtiene el recordatorio más próximo de un evento. |
| `runUpcomingReminderChecks()` | Verifica recordatorios pendientes y muestra notificaciones toast. |
| `refreshTopbarReminders()` | Actualiza el panel de recordatorios en la barra superior. |

---

## 10. Persistencia y Sincronización

### 10.1 Sincronización con Servidor

| Función | Descripción |
|---------|-------------|
| `syncWithServerState()` | Sincroniza estado desde MariaDB: llama GET /api/state y actualiza state. Marca serverStateReady=true cuando termina. |
| `persist()` | Persiste el estado completo al servidor: PUT /api/state con todo el estado. |
| `schedulePersist()` | Programa persistencia con debounce de 700ms para evitar muchas llamadas. |
| `ensureApiStateUrlWorks()` | Verifica que la URL de API funcione probando /api/health. |
| `tryApiStateUrl(url)` | Prueba una URL de API específica. |

### 10.2 LocalStorage

| Función | Descripción |
|---------|-------------|
| `loadPersistedAuthSession()` | Carga sesión de localStorage (crm_auth_session_v1). |
| `savePersistedAuthSession()` | Guarda sesión en localStorage. |
| `clearPersistedAuthSession()` | Limpia sesión de localStorage. |
| `restorePersistedAppSession()` | Restaura sesión y muestra calendario si hay sesión válida. |
| `loadPersistedModuleScreen()` | Carga última pantalla abierta (calendar/settings/reports). |
| `savePersistedModuleScreen(screen)` | Guarda última pantalla abierta. |

---

## 11. Utilidades del Calendario

| Función | Descripción |
|---------|-------------|
| `getWeekLabel(start)` | Genera etiqueta de semana para mostrar en la barra: "DD MMM - DD MMM YYYY". |
| `fmtMonthYear(date)` | Formatea fecha como "Mes YYYY" (ej: "Mayo 2026"). |
| `fmtDateShort(date)` | Formatea fecha corta "DD MMM". |
| `fmtWeekday(date)` | Nombre del día de la semana (lunes, martes, etc.). |
| `fmtDayMonth(date)` | Día del mes con mes abreviado "DD MMM". |
| `formatDayCardLabel(isoDate)` | Etiqueta para tarjeta de día en reporte de ocupación. |

---

## 12. Constantes de Configuración

```javascript
const HOUR_START = 0;       // Hora inicial del grid (00:00)
const HOUR_END = 23;        // Hora final editable (23:00)
const HOUR_HEIGHT = 56;      // Altura de cada hora en pixels
const SNAP_MINUTES = 30;    // Intervalo de ajuste (30 min)
const ALL_ROOMS_VALUE = "__all_rooms__";  // Valor para "todos los salones"
const FALLBACK_MAX_PAX_PER_SLOT = 2000;   // PAX máximo por defecto
```

---

## Resumen de Flujo de Uso

1. **Al cargar**: `goToTodayView()` → `render()` → muestra calendario actual
2. **Navegar**: Click en prev/next → `shiftViewBackward/Forward()` → `render()`
3. **Crear reserva**: Click en grid → `openModalForCreate()` → llenar datos → `saveEventFromForm()` → `persist()` → `render()`
4. **Editar reserva**: Click en evento → `openModalForEdit()` → modificar → `saveEventFromForm()`
5. **Filtrar**: Cambiar selector salon → `selectedSalon = value` → `render()`
6. **Buscar**: `openEventFinderModal()` → escribir → `renderEventFinderResults()`

---

*Documento generado para参考 durante la migración a React*
*Última actualización: Mayo 2026*