## Legacy archive 2026-06

Archivos movidos fuera del flujo activo durante la limpieza de `react/CRM.JDL`.

### Motivo

Estos archivos no tenían imports o callers activos dentro de `src` al momento de la limpieza y se conservaron solo como respaldo funcional o visual.

### Contenido archivado

- `calendar-components/legacy_mms.jsx`: prototipo anterior de Menu y Montaje.
- `calendar-components/legacy_mms.html`: maqueta HTML previa de Menu y Montaje.
- `calendar-components/legacy_adv.html`: maqueta HTML legacy relacionada con anticipos.
- `calendar-components/CalendarEvent.jsx`: componente de evento sin uso activo.
- `calendar-components/LegacyMenuMontaje.css`: estilos legacy no importados por la versión actual.
- `reports/ReportsModuleLegacy.jsx`: módulo de reportes legacy sin uso activo.
- `settings/LegacyMenuCatalogModal.jsx`: modal legacy de catálogo sin uso activo.
- `utils/legacyPrintMontaje.js`: utilidad legacy de impresión.
- `utils/legacyMenuCatalogLogic.js`: lógica legacy de catálogo de menú.
- `utils/legacyExportLogic.js`: lógica legacy de exportación.

### Reemplazos activos

- `modules/calendar/components/MenuMontajePanel.jsx`
- `modules/calendar/components/MenuMontajePanel.pos.css`
- módulos actuales de cotización, reportes y configuración conectados desde la app React.
