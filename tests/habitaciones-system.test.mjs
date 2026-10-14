import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();

test('Habitaciones: server.cjs define y registra la migración ensureHabitacionesStructure', () => {
  const serverPath = path.join(projectRoot, 'server.cjs');
  const serverCode = fs.readFileSync(serverPath, 'utf8');

  assert.ok(serverCode.includes('async function ensureHabitacionesStructure()'), 'Debe definir ensureHabitacionesStructure()');
  assert.ok(serverCode.includes('CREATE TABLE IF NOT EXISTS habitacion_reservas'), 'Debe crear habitacion_reservas');
  assert.ok(serverCode.includes('CREATE TABLE IF NOT EXISTS habitacion_catalogos'), 'Debe crear habitacion_catalogos');
  assert.ok(serverCode.includes('CREATE TABLE IF NOT EXISTS habitacion_metas'), 'Debe crear habitacion_metas');
  assert.ok(serverCode.includes("{ name: 'HabitacionesStructure', fn: ensureHabitacionesStructure }"), 'Debe registrarse en MIGRATIONS');
  assert.ok(serverCode.includes("'ensureHabitacionesStructure'"), 'Debe registrarse en CANONICAL_MIGRATIONS');
});

test('Habitaciones: backend app_routes.js monta /habitaciones y controlador implementa CRUD y directorio', () => {
  const appRoutesPath = path.join(projectRoot, 'backend', 'src', 'app_routes.js');
  const appRoutesCode = fs.readFileSync(appRoutesPath, 'utf8');
  assert.ok(appRoutesCode.includes("router.use('/habitaciones', habitacionesRouter)"), 'Debe montar habitacionesRouter');

  const controllerPath = path.join(projectRoot, 'backend', 'src', 'controllers', 'habitacionesController.js');
  const controllerCode = fs.readFileSync(controllerPath, 'utf8');
  assert.ok(controllerCode.includes('export async function getHabitaciones'), 'Debe exportar getHabitaciones');
  assert.ok(controllerCode.includes('export async function createHabitacion'), 'Debe exportar createHabitacion');
  assert.ok(controllerCode.includes('export async function updateHabitacion'), 'Debe exportar updateHabitacion');
  assert.ok(controllerCode.includes('export async function deleteHabitacion'), 'Debe exportar deleteHabitacion');
  assert.ok(controllerCode.includes('export async function getHuespedHistorial'), 'Debe exportar getHuespedHistorial');
  assert.ok(controllerCode.includes('export async function registrarContacto'), 'Debe exportar registrarContacto');
  assert.ok(controllerCode.includes('export async function getCatalogos'), 'Debe exportar getCatalogos');
  assert.ok(controllerCode.includes('export async function getMetas'), 'Debe exportar getMetas');
  assert.ok(controllerCode.includes('resolveOrCreateCompany'), 'Debe resolver o crear empresas al vuelo en MariaDB');
});

test('Habitaciones: Cálculo dinámico de noches, tarifa y sobreescritura manual de monto total', () => {
  const checkIn = '2026-10-15';
  const checkOut = '2026-10-20';
  const inDate = new Date(checkIn + 'T00:00:00');
  const outDate = new Date(checkOut + 'T00:00:00');
  const noches = Math.max(1, Math.round((outDate.getTime() - inDate.getTime()) / (1000 * 60 * 60 * 24)));
  assert.equal(noches, 5, 'Debe calcular 5 noches exactas');

  const cantidadHabitaciones = 2;
  const tarifaDiaria = 450.00;
  const montoCalculado = noches * cantidadHabitaciones * tarifaDiaria;
  assert.equal(montoCalculado, 4500.00, '5 noches x 2 habs x Q450 = Q4500.00');

  // Sobreescritura manual (ej. tarifa negociada corporativa)
  const montoManual = 4000.00;
  const montoFinal = montoManual !== undefined ? montoManual : montoCalculado;
  assert.equal(montoFinal, 4000.00, 'Debe respetar la sobreescritura manual del monto');
});

test('Habitaciones: Sustitución de tokens en plantillas WhatsApp y Correo con No. Folio', () => {
  const plantilla = 'Hola {nombre_huesped}, confirmamos tu reserva Folio #{no_folio} del {check_in} al {check_out} ({noches} noches) en {tipo_habitacion}. Total: Q{monto_total}';
  const reserva = {
    nombre_huesped: 'Carlos Mendoza',
    no_folio: 'F-200',
    fecha_check_in: '2026-10-15',
    fecha_check_out: '2026-10-17',
    noches: 2,
    tipo_habitacion_nombre: 'Habitación Doble',
    monto_total: 1300.00
  };

  const resultado = plantilla
    .replace(/{nombre_huesped}/g, reserva.nombre_huesped)
    .replace(/{check_in}/g, reserva.fecha_check_in)
    .replace(/{check_out}/g, reserva.fecha_check_out)
    .replace(/{noches}/g, String(reserva.noches))
    .replace(/{tipo_habitacion}/g, reserva.tipo_habitacion_nombre)
    .replace(/{monto_total}/g, Number(reserva.monto_total).toFixed(2))
    .replace(/{no_folio}/g, reserva.no_folio);

  assert.equal(
    resultado,
    'Hola Carlos Mendoza, confirmamos tu reserva Folio #F-200 del 2026-10-15 al 2026-10-17 (2 noches) en Habitación Doble. Total: Q1300.00',
    'Debe reemplazar limpiamente todas las variables dinámicas'
  );
});

test('Habitaciones: Navegación en Sidebar.jsx y Enrutamiento en App.jsx', () => {
  const sidebarPath = path.join(projectRoot, 'src', 'layouts', 'MainLayout', 'components', 'Sidebar.jsx');
  const sidebarCode = fs.readFileSync(sidebarPath, 'utf8');

  assert.ok(sidebarCode.includes('/habitaciones'), 'Sidebar debe tener ruta /habitaciones');
  assert.ok(sidebarCode.includes('Ingreso de Habitaciones'), 'Sidebar debe tener texto Ingreso de Habitaciones');

  const appPath = path.join(projectRoot, 'src', 'App.jsx');
  const appCode = fs.readFileSync(appPath, 'utf8');
  assert.ok(appCode.includes('HabitacionesModule'), 'App.jsx debe importar HabitacionesModule');
  assert.ok(appCode.includes('<Route path="habitaciones"'), 'App.jsx debe registrar la ruta protegida /habitaciones');
});

test('Habitaciones: SettingsMain.jsx y SettingsHabitaciones.jsx integran Bento de Habitaciones', () => {
  const settingsMainPath = path.join(projectRoot, 'src', 'modules', 'settings', 'SettingsMain.jsx');
  const settingsMainCode = fs.readFileSync(settingsMainPath, 'utf8');
  assert.ok(settingsMainCode.includes('SettingsHabitaciones'), 'SettingsMain debe importar SettingsHabitaciones');
  assert.ok(settingsMainCode.includes("openView('habitaciones')"), 'SettingsMain debe permitir abrir la vista de habitaciones');

  const settingsHabPath = path.join(projectRoot, 'src', 'modules', 'settings', 'SettingsHabitaciones.jsx');
  assert.ok(fs.existsSync(settingsHabPath), 'SettingsHabitaciones.jsx debe existir');
  const settingsHabCode = fs.readFileSync(settingsHabPath, 'utf8');
  assert.ok(settingsHabCode.includes('medios_contacto'), 'Debe incluir pestaña medios_contacto');
  assert.ok(settingsHabCode.includes('tipos_habitacion'), 'Debe incluir pestaña tipos_habitacion');
  assert.ok(settingsHabCode.includes('plantillas'), 'Debe incluir pestaña plantillas');
  assert.ok(settingsHabCode.includes('metas'), 'Debe incluir pestaña metas');
});

test('Habitaciones: ReportsModule y ReportsVentasHabitaciones implementan reportería de habitaciones', () => {
  const reportsModulePath = path.join(projectRoot, 'src', 'modules', 'reports', 'ReportsModule.jsx');
  const reportsModuleCode = fs.readFileSync(reportsModulePath, 'utf8');
  assert.ok(reportsModuleCode.includes('Reporte de Ventas de Eventos'), 'Debe renombrar a Reporte de Ventas de Eventos');
  assert.ok(reportsModuleCode.includes('Reporte de Ventas de Habitaciones'), 'Debe incluir tarjeta Reporte de Ventas de Habitaciones');
  assert.ok(reportsModuleCode.includes('ReportsVentasHabitaciones'), 'Debe conectar ReportsVentasHabitaciones');

  const reportsHabPath = path.join(projectRoot, 'src', 'modules', 'reports', 'ReportsVentasHabitaciones.jsx');
  assert.ok(fs.existsSync(reportsHabPath), 'ReportsVentasHabitaciones.jsx debe existir');
});

test('Habitaciones: ReportsDashboard.jsx suma habitaciones a la Meta Global Consolidada sin TDZ', () => {
  const dashboardPath = path.join(projectRoot, 'src', 'modules', 'reports', 'ReportsDashboard.jsx');
  const dashboardCode = fs.readFileSync(dashboardPath, 'utf8');
  assert.ok(dashboardCode.includes('totalConsolidado = globalAchieved + habitacionesTotal'), 'Debe calcular totalConsolidado sumando eventos y habitaciones');
  assert.ok(dashboardCode.includes('Total Ingresos Consolidados:'), 'Debe mostrar Total Ingresos Consolidados en el desglose');
  assert.ok(dashboardCode.includes('Ventas Habitaciones:'), 'Debe desglosar Ventas Habitaciones');

  const getDateRangeIndex = dashboardCode.indexOf('const getDateRange =');
  const useEffectHabIndex = dashboardCode.indexOf('setHabitacionesTotal(sum);');
  assert.ok(getDateRangeIndex > -1 && useEffectHabIndex > -1, 'Debe existir getDateRange y efecto de habitaciones');
  assert.ok(getDateRangeIndex < useEffectHabIndex, 'getDateRange debe definirse ANTES de cualquier hook que lo consuma para evitar TDZ');
});

test('Habitaciones: ReportsProyeccionMetas.jsx implementa conmutador de proyecciones', () => {
  const proyeccionPath = path.join(projectRoot, 'src', 'modules', 'reports', 'ReportsProyeccionMetas.jsx');
  const proyeccionCode = fs.readFileSync(proyeccionPath, 'utf8');
  assert.ok(proyeccionCode.includes("setProjectionMode('consolidado')"), 'Debe tener opción Consolidado');
  assert.ok(proyeccionCode.includes("setProjectionMode('eventos')"), 'Debe tener opción Solo Eventos');
  assert.ok(proyeccionCode.includes("setProjectionMode('habitaciones')"), 'Debe tener opción Solo Habitaciones');
});

test('Habitaciones: stateService.js importa y exporta métodos de habitaciones sin errores de referencia de ámbito', () => {
  const stateServicePath = path.join(projectRoot, 'src', 'services', 'stateService.js');
  const stateServiceCode = fs.readFileSync(stateServicePath, 'utf8');
  assert.ok(/import\s*\{[^}]*getHabitacionesApi[^}]*\}\s*from\s*['"]\.\/habitacionesService['"]/.test(stateServiceCode), 'stateService debe importar getHabitacionesApi explícitamente');
  assert.ok(stateServiceCode.includes("getHabitacionesApi,"), 'stateService debe incluir getHabitacionesApi');
  assert.ok(stateServiceCode.includes("getMetasHabitacionesApi,"), 'stateService debe incluir getMetasHabitacionesApi');
  assert.ok(stateServiceCode.includes("getCatalogosHabitacionesApi,"), 'stateService debe incluir getCatalogosHabitacionesApi');
});

test('Utilidad toast.jsx expone métodos atómicos success, error, warning, info y dismiss', () => {
  const toastPath = path.join(projectRoot, 'src', 'utils', 'toast.jsx');
  const toastCode = fs.readFileSync(toastPath, 'utf8');
  assert.ok(toastCode.includes('toast.success ='), 'toast debe tener método success');
  assert.ok(toastCode.includes('toast.error ='), 'toast debe tener método error');
  assert.ok(toastCode.includes('toast.warning ='), 'toast debe tener método warning');
  assert.ok(toastCode.includes('toast.info ='), 'toast debe tener método info');
  assert.ok(toastCode.includes('toast.dismiss ='), 'toast debe tener método dismiss');
});

test('Habitaciones: Protección de integridad y modal con diseño en catálogos y reservas', () => {
  // 1. Controller valida integridad en deleteCatalogoItem y devuelve 409
  const controllerPath = path.join(projectRoot, 'backend', 'src', 'controllers', 'habitacionesController.js');
  const controllerCode = fs.readFileSync(controllerPath, 'utf8');
  assert.ok(controllerCode.includes('usageCount > 0'), 'Controller debe verificar usageCount');
  assert.ok(controllerCode.includes('status(409)'), 'Controller debe responder 409 si elemento está en uso');
  assert.ok(controllerCode.includes('getCatalogoItemUsage'), 'Controller debe exportar getCatalogoItemUsage');

  // 2. Rutas exponen endpoint de verificación de uso
  const routesPath = path.join(projectRoot, 'backend', 'src', 'routes', 'habitacionesRoutes.js');
  const routesCode = fs.readFileSync(routesPath, 'utf8');
  assert.ok(routesCode.includes('/catalogos/:categoria/:id/usage'), 'Rutas deben incluir endpoint usage');

  // 3. SettingsHabitaciones no utiliza window.confirm nativo y renderiza modal diseñado
  const settingsPath = path.join(projectRoot, 'src', 'modules', 'settings', 'SettingsHabitaciones.jsx');
  const settingsCode = fs.readFileSync(settingsPath, 'utf8');
  assert.ok(!settingsCode.includes('window.confirm'), 'SettingsHabitaciones no debe contener window.confirm nativo');
  assert.ok(settingsCode.includes('deleteModal'), 'SettingsHabitaciones debe usar deleteModal');
  assert.ok(settingsCode.includes('ShieldAlert'), 'SettingsHabitaciones debe usar ShieldAlert para protección de integridad');
  assert.ok(settingsCode.includes('Protección de Integridad'), 'SettingsHabitaciones debe mostrar texto de protección de integridad');

  // 4. HabitacionesModule no utiliza window.confirm nativo y renderiza modal diseñado
  const modulePath = path.join(projectRoot, 'src', 'modules', 'habitaciones', 'HabitacionesModule.jsx');
  const moduleCode = fs.readFileSync(modulePath, 'utf8');
  assert.ok(!moduleCode.includes('window.confirm'), 'HabitacionesModule no debe contener window.confirm nativo');
  assert.ok(moduleCode.includes('cancelModal'), 'HabitacionesModule debe usar cancelModal');
});

test('Habitaciones: Eliminación física de no_reserva y solicito en BD y UI, y alineación de Monto Total', () => {
  // 1. server.cjs no debe declarar no_reserva ni solicito en CREATE TABLE y debe ejecutar DROP COLUMN
  const serverPath = path.join(projectRoot, 'server.cjs');
  const serverCode = fs.readFileSync(serverPath, 'utf8');
  const createTableChunk = serverCode.substring(
    serverCode.indexOf('CREATE TABLE IF NOT EXISTS habitacion_reservas'),
    serverCode.indexOf('ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci')
  );
  assert.ok(!createTableChunk.includes('no_reserva'), 'CREATE TABLE habitacion_reservas no debe tener no_reserva');
  assert.ok(!createTableChunk.includes('solicito'), 'CREATE TABLE habitacion_reservas no debe tener solicito');
  assert.ok(serverCode.includes('DROP COLUMN no_reserva'), 'Debe ejecutar DROP COLUMN no_reserva si existe');
  assert.ok(serverCode.includes('DROP COLUMN solicito'), 'Debe ejecutar DROP COLUMN solicito si existe');

  // 2. Controller no debe referenciar no_reserva ni solicito en SELECT/INSERT/UPDATE
  const controllerPath = path.join(projectRoot, 'backend', 'src', 'controllers', 'habitacionesController.js');
  const controllerCode = fs.readFileSync(controllerPath, 'utf8');
  assert.ok(!controllerCode.includes('no_reserva'), 'habitacionesController no debe referenciar no_reserva');
  assert.ok(!controllerCode.includes('solicito'), 'habitacionesController no debe referenciar solicito');

  // 3. HabitacionModal no debe renderizar inputs para no_reserva ni solicito, y debe alinear Monto Total
  const modalPath = path.join(projectRoot, 'src', 'modules', 'habitaciones', 'HabitacionModal.jsx');
  const modalCode = fs.readFileSync(modalPath, 'utf8');
  assert.ok(!modalCode.includes('No. Reserva (Voucher)'), 'Modal no debe tener label de No. Reserva');
  assert.ok(!modalCode.includes('Solicitó (Detalle)'), 'Modal no debe tener label de Solicitó (Detalle)');
  assert.ok(modalCode.includes('No. Folio'), 'Modal debe conservar No. Folio');
  assert.ok(modalCode.includes("minHeight: 20"), 'Modal debe estandarizar minHeight de encabezados para alinear inputs');

  // 4. HabitacionesModule y ReportsVentasHabitaciones deben mostrar No. Folio
  const habModulePath = path.join(projectRoot, 'src', 'modules', 'habitaciones', 'HabitacionesModule.jsx');
  const habModuleCode = fs.readFileSync(habModulePath, 'utf8');
  assert.ok(habModuleCode.includes('<th>No. Folio</th>'), 'HabitacionesModule debe tener columna No. Folio');
  assert.ok(!habModuleCode.includes('r.no_reserva'), 'HabitacionesModule no debe renderizar r.no_reserva');
  assert.ok(!habModuleCode.includes('r.solicito'), 'HabitacionesModule no debe renderizar r.solicito');

  const reportsHabPath = path.join(projectRoot, 'src', 'modules', 'reports', 'ReportsVentasHabitaciones.jsx');
  const reportsHabCode = fs.readFileSync(reportsHabPath, 'utf8');
  assert.ok(/<th[^>]*>No\. Folio<\/th>/.test(reportsHabCode), 'ReportsVentasHabitaciones debe tener columna No. Folio');
  assert.ok(!reportsHabCode.includes('r.no_reserva'), 'ReportsVentasHabitaciones no debe renderizar r.no_reserva');
});

test('Habitaciones: Catálogo CRUD de Módulos/Sectores con protección de integridad y dropdown en reserva', () => {
  // 1. server.cjs define semillas para categoría 'modulos'
  const serverPath = path.join(projectRoot, 'server.cjs');
  const serverCode = fs.readFileSync(serverPath, 'utf8');
  assert.ok(serverCode.includes("categoria: 'modulos'"), 'server.cjs debe incluir semillas para categoría modulos');

  // 2. Controller implementa usage_count e integridad para modulos
  const controllerPath = path.join(projectRoot, 'backend', 'src', 'controllers', 'habitacionesController.js');
  const controllerCode = fs.readFileSync(controllerPath, 'utf8');
  assert.ok(controllerCode.includes("categoria === 'modulos'"), 'habitacionesController debe validar categoría modulos');
  assert.ok(controllerCode.includes("r.modulo = c.nombre"), 'habitacionesController debe evaluar uso de modulo en reservas');

  // 3. SettingsHabitaciones integra pestaña de Módulos / Sectores
  const settingsPath = path.join(projectRoot, 'src', 'modules', 'settings', 'SettingsHabitaciones.jsx');
  const settingsCode = fs.readFileSync(settingsPath, 'utf8');
  assert.ok(settingsCode.includes("id: 'modulos'"), 'SettingsHabitaciones debe incluir tab modulos');
  assert.ok(settingsCode.includes("Módulos / Sectores"), 'SettingsHabitaciones debe tener etiqueta Módulos / Sectores');

  // 4. HabitacionesModule carga modulos en catalogos
  const habModulePath = path.join(projectRoot, 'src', 'modules', 'habitaciones', 'HabitacionesModule.jsx');
  const habModuleCode = fs.readFileSync(habModulePath, 'utf8');
  assert.ok(habModuleCode.includes("getCatalogosHabitacionesApi('modulos')"), 'HabitacionesModule debe cargar modulos');

  // 5. HabitacionModal renderiza select desplegable para Módulo / Sector
  const modalPath = path.join(projectRoot, 'src', 'modules', 'habitaciones', 'HabitacionModal.jsx');
  const modalCode = fs.readFileSync(modalPath, 'utf8');
  assert.ok(modalCode.includes("catalogos.modulos"), 'HabitacionModal debe consumir catalogos.modulos');
  assert.ok(modalCode.includes("<select"), 'HabitacionModal debe renderizar select para Módulo / Sector');
  assert.ok(modalCode.includes("Seleccione módulo / sector..."), 'HabitacionModal debe tener opción por defecto');
});

test('Habitaciones: Pestañas de configuración con colores diferenciados y diseño anti-recorte', () => {
  const settingsPath = path.join(projectRoot, 'src', 'modules', 'settings', 'SettingsHabitaciones.jsx');
  const settingsCode = fs.readFileSync(settingsPath, 'utf8');

  // 1. Cada pestaña debe tener color temático asignado
  assert.ok(settingsCode.includes("color: '#0284c7'"), 'Medios de contacto debe tener color celeste/sky');
  assert.ok(settingsCode.includes("color: '#059669'"), 'Tipos de habitación debe tener color esmeralda');
  assert.ok(settingsCode.includes("color: '#7c3aed'"), 'Módulos/Sectores debe tener color violeta');
  assert.ok(settingsCode.includes("color: '#d97706'"), 'Tipos de cliente debe tener color ámbar');
  assert.ok(settingsCode.includes("color: '#0d9488'"), 'Formas de pago debe tener color teal');
  assert.ok(settingsCode.includes("color: '#e11d48'"), 'Plantillas mensajes debe tener color rose');
  assert.ok(settingsCode.includes("color: '#4f46e5'"), 'Metas de habitaciones debe tener color índigo');

  // 2. Botones deben tener flexShrink: 0 y padding holgado para evitar corte de texto
  assert.ok(settingsCode.includes("flexShrink: 0"), 'Los botones deben tener flexShrink: 0 para no comprimirse');
  assert.ok(settingsCode.includes("padding: '10px 18px'"), 'Los botones deben tener padding holgado anti-recorte');
  assert.ok(settingsCode.includes("tab.bgBadge"), 'Debe renderizar badge de icono temático');
});

test('Habitaciones: Botones de acciones Bento y botones con color temático (Excel, Nueva Reserva, Cancelar, Registrar)', () => {
  const cssPath = path.join(projectRoot, 'src', 'modules', 'habitaciones', 'habitaciones.css');
  const cssCode = fs.readFileSync(cssPath, 'utf8');

  // 1. Botones de acciones Bento con sus 4 variantes
  assert.ok(cssCode.includes('.hab-action-group'), 'habitaciones.css debe definir .hab-action-group');
  assert.ok(cssCode.includes('.hab-action-btn.whatsapp'), 'Debe definir botón whatsapp con color');
  assert.ok(cssCode.includes('.hab-action-btn.email'), 'Debe definir botón email con color');
  assert.ok(cssCode.includes('.hab-action-btn.edit'), 'Debe definir botón edit con color');
  assert.ok(cssCode.includes('.hab-action-btn.delete'), 'Debe definir botón delete con color');

  // 2. Botones de acción principales con color temático
  assert.ok(cssCode.includes('.hab-btn-excel'), 'Debe definir botón hab-btn-excel');
  assert.ok(cssCode.includes('.hab-btn-submit'), 'Debe definir botón hab-btn-submit');
  assert.ok(cssCode.includes('.hab-btn-cancel'), 'Debe definir botón hab-btn-cancel');

  // 3. HabitacionesModule implementa hab-action-group, hab-btn-excel y estilos inline blindados
  const habModulePath = path.join(projectRoot, 'src', 'modules', 'habitaciones', 'HabitacionesModule.jsx');
  const habModuleCode = fs.readFileSync(habModulePath, 'utf8');
  assert.ok(habModuleCode.includes('className="hab-action-group"'), 'HabitacionesModule debe usar hab-action-group');
  assert.ok(habModuleCode.includes('className="hab-btn-excel"'), 'HabitacionesModule debe usar hab-btn-excel');
  assert.ok(habModuleCode.includes('linear-gradient(135deg, #107c41 0%, #059669 100%)'), 'HabitacionesModule debe tener inline gradient de Excel');
  assert.ok(!habModuleCode.includes('>+ Nueva Reserva'), 'No debe tener signo + redundante duplicado en el texto');

  // 4. HabitacionModal implementa hab-btn-cancel y hab-btn-submit con estilos blindados
  const modalPath = path.join(projectRoot, 'src', 'modules', 'habitaciones', 'HabitacionModal.jsx');
  const modalCode = fs.readFileSync(modalPath, 'utf8');
  assert.ok(modalCode.includes('className="hab-btn-cancel"'), 'HabitacionModal debe usar hab-btn-cancel');
  assert.ok(modalCode.includes('className="hab-btn-submit"'), 'HabitacionModal debe usar hab-btn-submit');
  assert.ok(modalCode.includes('linear-gradient(135deg, #059669 0%, #10b981 100%)'), 'HabitacionModal debe tener inline gradient verde esmeralda para submit');
  assert.ok(modalCode.includes("background: '#f1f5f9'"), 'HabitacionModal debe tener fondo gris neutro blindado para cancelar');
});

test('Habitaciones: Rediseño ejecutivo completo (Socket.IO en tiempo real, 5 KPIs Bento, paginación numérica, filtros y mobile cards)', () => {
  const habModulePath = path.join(projectRoot, 'src', 'modules', 'habitaciones', 'HabitacionesModule.jsx');
  const habModuleCode = fs.readFileSync(habModulePath, 'utf8');

  // 1. Socket.IO y badge de sincronización en vivo
  assert.ok(habModuleCode.includes("import socketService from '../../services/socketService';"), 'HabitacionesModule debe importar socketService');
  assert.ok(habModuleCode.includes("socketService.on('entity:changed'"), 'Debe escuchar entity:changed');
  assert.ok(habModuleCode.includes('hab-sync-badge'), 'Debe renderizar hab-sync-badge');
  assert.ok(habModuleCode.includes('hab-sync-dot'), 'Debe renderizar punto pulsante hab-sync-dot');

  // 2. 5 KPIs Bento
  assert.ok(habModuleCode.includes('hab-kpi-grid-5'), 'Debe usar grid de 5 KPIs hab-kpi-grid-5');
  assert.ok(habModuleCode.includes('Tasa de Ocupación'), 'Debe calcular y mostrar Tasa de Ocupación');
  assert.ok(habModuleCode.includes('Capacidad: 24 Hab'), 'Debe mostrar badge de Capacidad: 24 Hab');
  assert.ok(habModuleCode.includes('ADR: Q'), 'Debe calcular ADR (Average Daily Rate)');
  assert.ok(habModuleCode.includes('Meta:'), 'Debe mostrar porcentaje de meta');

  // 3. Barra de filtros sin botón restablecer y con botón Filtros
  assert.ok(habModuleCode.includes('hab-filters-shelf'), 'Debe incluir estante superior de filtros');
  assert.ok(habModuleCode.includes('hab-btn-filter-trigger'), 'Debe incluir botón Bento para abrir filtros avanzados');
  assert.ok(!habModuleCode.includes('<span>Restablecer</span>'), 'No debe tener botón de restablecer');
  assert.ok(habModuleCode.includes('isFilterModalOpen'), 'Debe manejar estado para modal de filtros avanzados');

  // 4. Paginación numérica
  assert.ok(habModuleCode.includes('hab-pagination-container'), 'Debe incluir contenedor de paginación');
  assert.ok(habModuleCode.includes('hab-page-btn'), 'Debe renderizar botones numéricos de paginación');
  assert.ok(habModuleCode.includes('setPageSize'), 'Debe permitir configurar tamaño de página');

  // 5. Vista Móvil Bento Folios Activos (< 768px)
  assert.ok(habModuleCode.includes('hab-mobile-folios-card'), 'Debe definir sección móvil hab-mobile-folios-card');
  assert.ok(habModuleCode.includes('hab-mobile-item-card'), 'Debe renderizar tarjetas Bento móviles');
  assert.ok(habModuleCode.includes('Folios Activos'), 'Debe tener título de Folios Activos en móvil');

  // 6. Selector de período Bento anti-colisiones y cabecera móvil anti-desborde
  assert.ok(habModuleCode.includes('hab-month-picker-wrap'), 'Debe usar hab-month-picker-wrap para evitar doble icono');
  assert.ok(habModuleCode.includes('hab-month-native-input'), 'Debe usar input nativo transparente para selector');
  assert.ok(habModuleCode.includes('hab-brand-info'), 'Debe usar hab-brand-info para prevenir desborde en móvil');
  assert.ok(habModuleCode.includes('hab-header-right'), 'Debe usar hab-header-right para alinear acciones');
  assert.ok(habModuleCode.includes('hab-btn-label-mobile'), 'Debe soportar etiqueta corta para mobile');

  const cssPath = path.join(projectRoot, 'src', 'modules', 'habitaciones', 'habitaciones.css');
  const cssCode = fs.readFileSync(cssPath, 'utf8');
  assert.ok(cssCode.includes('.hab-sync-dot'), 'CSS debe definir punto pulsante');
  assert.ok(cssCode.includes('.hab-kpi-grid-5'), 'CSS debe definir grid de 5 KPIs');
  assert.ok(cssCode.includes('.hab-folio-pill'), 'CSS debe definir pastilla oscura de folio');
  assert.ok(cssCode.includes('.hab-mobile-folios-card'), 'CSS debe definir tarjetas Bento móviles');
  assert.ok(cssCode.includes('.hab-month-picker-wrap'), 'CSS debe definir hab-month-picker-wrap');
  assert.ok(cssCode.includes('.hab-btn-label-mobile'), 'CSS debe definir hab-btn-label-mobile');
});

test('Habitaciones: Campañas de Marketing por Segmento, Plantillas Promocionales con Flyer e Integridad Blindada', () => {
  // 1. Backend: server.cjs define columnas y migración para plantillas y segmentos
  const serverPath = path.join(projectRoot, 'server.cjs');
  const serverCode = fs.readFileSync(serverPath, 'utf8');
  assert.ok(serverCode.includes('tipo_plantilla'), 'server.cjs debe definir columna tipo_plantilla');
  assert.ok(serverCode.includes('imagen_url'), 'server.cjs debe definir columna imagen_url para flyers');
  assert.ok(serverCode.includes('cat_pl_promo_1'), 'server.cjs debe incluir semilla para plantilla promocional');

  // 2. Controlador y Rutas de habitaciones
  const routesPath = path.join(projectRoot, 'backend', 'src', 'routes', 'habitacionesRoutes.js');
  const routesCode = fs.readFileSync(routesPath, 'utf8');
  assert.ok(routesCode.includes("router.get('/campanas/segmento/:idSegmento'"), 'Rutas debe exponer /campanas/segmento/:idSegmento');
  assert.ok(routesCode.includes("router.post('/catalogos/upload-imagen'"), 'Rutas debe exponer /catalogos/upload-imagen');

  const controllerPath = path.join(projectRoot, 'backend', 'src', 'controllers', 'habitacionesController.js');
  const controllerCode = fs.readFileSync(controllerPath, 'utf8');
  assert.ok(controllerCode.includes('export async function getCampanaClientesPorSegmento'), 'Controller debe exportar getCampanaClientesPorSegmento');
  assert.ok(controllerCode.includes('export async function uploadPromocionImagen'), 'Controller debe exportar uploadPromocionImagen');
  assert.ok(controllerCode.includes("categoria === 'tipos_cliente'"), 'deleteCatalogoItem y usage deben validar tipos_cliente');
  assert.ok(controllerCode.includes('WHERE id_tipo_cliente = ? OR tipo_cliente_nombre = ?'), 'Debe proteger la integridad referencial de segmentos');

  // 3. Frontend Service
  const servicePath = path.join(projectRoot, 'src', 'services', 'habitacionesService.js');
  const serviceCode = fs.readFileSync(servicePath, 'utf8');
  assert.ok(serviceCode.includes('getCampanaClientesPorSegmentoApi'), 'Service debe exportar getCampanaClientesPorSegmentoApi');
  assert.ok(serviceCode.includes('uploadPromocionImagenApi'), 'Service debe exportar uploadPromocionImagenApi');

  // 4. SettingsHabitaciones: Pestaña Segmentos de Cliente y Flyers
  const settingsPath = path.join(projectRoot, 'src', 'modules', 'settings', 'SettingsHabitaciones.jsx');
  const settingsCode = fs.readFileSync(settingsPath, 'utf8');
  assert.ok(settingsCode.includes("'Segmentos de Cliente'"), 'SettingsHabitaciones debe titular la pestaña Segmentos de Cliente');
  assert.ok(settingsCode.includes('tipo_plantilla'), 'SettingsHabitaciones debe permitir clasificar tipo de plantilla');
  assert.ok(settingsCode.includes('{descuento}'), 'SettingsHabitaciones debe incluir variable de descuento');
  assert.ok(settingsCode.includes('{vigencia}'), 'SettingsHabitaciones debe incluir variable de vigencia');
  assert.ok(settingsCode.includes('{segmento}'), 'SettingsHabitaciones debe incluir variable de segmento');

  // 5. HabitacionContactModal: Modo promoción y variables dinámicas
  const contactModalPath = path.join(projectRoot, 'src', 'modules', 'habitaciones', 'HabitacionContactModal.jsx');
  const contactModalCode = fs.readFileSync(contactModalPath, 'utf8');
  assert.ok(contactModalCode.includes('replaceTokens'), 'HabitacionContactModal debe tener replaceTokens');
  assert.ok(contactModalCode.includes('copyImageToClipboard'), 'HabitacionContactModal debe soportar copiado de flyers');

  // 6. HabitacionCampanaModal y HabitacionesModule
  const campanaModalPath = path.join(projectRoot, 'src', 'modules', 'habitaciones', 'HabitacionCampanaModal.jsx');
  assert.ok(fs.existsSync(campanaModalPath), 'HabitacionCampanaModal.jsx debe existir');
  const campanaModalCode = fs.readFileSync(campanaModalPath, 'utf8');
  assert.ok(campanaModalCode.includes('Lanzar Ofertas y Promociones por Segmento'), 'Modal debe titularse correctamente');
  assert.ok(campanaModalCode.includes('handleSendWhatsAppCliente'), 'Modal debe permitir envío por WhatsApp');
  assert.ok(campanaModalCode.includes('handleSendCorreoCliente'), 'Modal debe permitir envío por Correo');
  assert.ok(campanaModalCode.includes('hab-campana-close-btn'), 'Modal debe usar hab-campana-close-btn blindado para botón de cerrar');
  assert.ok(campanaModalCode.includes('hab-campana-search-wrap'), 'Modal debe usar hab-campana-search-wrap Bento para buscar clientes');
  assert.ok(campanaModalCode.includes('hab-search-clear'), 'Modal debe proveer botón para limpiar búsqueda');

  const cssPath = path.join(projectRoot, 'src', 'modules', 'habitaciones', 'habitaciones.css');
  const cssCode = fs.readFileSync(cssPath, 'utf8');
  assert.ok(cssCode.includes('.hab-campana-close-btn'), 'habitaciones.css debe incluir estilos para hab-campana-close-btn');
  assert.ok(cssCode.includes('.hab-campana-search-wrap'), 'habitaciones.css debe incluir estilos para hab-campana-search-wrap');

  const habModulePath = path.join(projectRoot, 'src', 'modules', 'habitaciones', 'HabitacionesModule.jsx');
  const habModuleCode = fs.readFileSync(habModulePath, 'utf8');
  assert.ok(habModuleCode.includes('HabitacionCampanaModal'), 'HabitacionesModule debe importar y renderizar HabitacionCampanaModal');
  assert.ok(habModuleCode.includes('hab-btn-campana'), 'HabitacionesModule debe tener botón hab-btn-campana');
  assert.ok(habModuleCode.includes('Lanzar Promoción'), 'HabitacionesModule debe tener texto Lanzar Promoción');
  assert.ok(habModuleCode.includes('filterSegmento'), 'HabitacionesModule debe soportar filtrado por Segmento de Cliente');
});

test('Habitaciones: HabitacionModal blinda initialData y props value contra valores nulos', () => {
  const modalPath = path.join(projectRoot, 'src', 'modules', 'habitaciones', 'HabitacionModal.jsx');
  const modalCode = fs.readFileSync(modalPath, 'utf8');

  // Verificar que el mapeo de initialData sanitice los valores nulos con fallback seguro
  assert.ok(modalCode.includes("correo: initialData.correo ?? ''"), 'Debe convertir correo nulo a string vacío');
  assert.ok(modalCode.includes("telefono: initialData.telefono ?? ''"), 'Debe convertir teléfono nulo a string vacío');
  assert.ok(modalCode.includes("observaciones: initialData.observaciones ?? ''"), 'Debe convertir observaciones nulas a string vacío');
  assert.ok(modalCode.includes("empresa_nombre: initialData.empresa_nombre ?? ''"), 'Debe convertir empresa_nombre nula a string vacío');

  // Verificar que el JSX no pase null a la prop value de inputs controlados
  assert.ok(modalCode.includes("value={formData.correo ?? ''}"), 'Input de correo debe protegerse con fallback contra null');
  assert.ok(modalCode.includes("value={formData.telefono ?? ''}"), 'Input de teléfono debe protegerse con fallback contra null');
  assert.ok(modalCode.includes("value={formData.nombre_huesped ?? ''}"), 'Input de huésped debe protegerse con fallback contra null');
  assert.ok(modalCode.includes("value={companySearch ?? ''}"), 'Input de empresa debe protegerse con fallback contra null');

  // Verificar que los hooks de estado de empresa estén declarados
  assert.ok(modalCode.includes("const [companySearch, setCompanySearch] = useState("), 'Debe declarar el hook companySearch');
  assert.ok(modalCode.includes("const [companySuggestions, setCompanySuggestions] = useState("), 'Debe declarar el hook companySuggestions');
});

test('Habitaciones: HabitacionModal permite borrar campos numéricos y escribir cantidades deseadas sin trabas', () => {
  const modalPath = path.join(projectRoot, 'src', 'modules', 'habitaciones', 'HabitacionModal.jsx');
  const modalCode = fs.readFileSync(modalPath, 'utf8');

  // Permitir borrar valores en noches, cantidad_habitaciones, tarifa_diaria y monto_total
  assert.ok(modalCode.includes("handleNochesChange"), 'Debe implementar handleNochesChange');
  assert.ok(modalCode.includes("handleNochesBlur"), 'Debe implementar handleNochesBlur');
  assert.ok(modalCode.includes("handleCantidadHabitacionesChange"), 'Debe implementar handleCantidadHabitacionesChange');
  assert.ok(modalCode.includes("handleTarifaDiariaChange"), 'Debe implementar handleTarifaDiariaChange');
  assert.ok(modalCode.includes("handleMontoTotalChange"), 'Debe implementar handleMontoTotalChange');

  // Auto-selección con onFocus en los 4 campos numéricos
  assert.ok(modalCode.includes("value={formData.noches ?? ''}"), 'Input noches debe aceptar string vacío para poder borrar');
  assert.ok(modalCode.includes("value={formData.cantidad_habitaciones ?? ''}"), 'Input cantidad_habitaciones debe aceptar string vacío');
  assert.ok(modalCode.includes("value={formData.tarifa_diaria ?? ''}"), 'Input tarifa_diaria debe aceptar string vacío');
  assert.ok(modalCode.includes("value={formData.monto_total ?? ''}"), 'Input monto_total debe aceptar string vacío');

  // Sincronización de check-out cuando cambia noches
  assert.ok(modalCode.includes("function addDays("), 'Debe incluir addDays para sincronizar fecha_check_out con noches');

  // Sanitización de números en handleSubmit antes de onSave
  assert.ok(modalCode.includes("nochesFinal ="), 'handleSubmit debe sanitizar nochesFinal');
  assert.ok(modalCode.includes("habsFinal ="), 'handleSubmit debe sanitizar habsFinal');
  assert.ok(modalCode.includes("tarifaFinal ="), 'handleSubmit debe sanitizar tarifaFinal');
  assert.ok(modalCode.includes("montoFinal ="), 'handleSubmit debe sanitizar montoFinal');
});
test('Habitaciones: HabitacionModal implementa validaciones no nativas, al menos 1 noche, toast y diseño de errores', () => {
  const modalPath = path.join(projectRoot, 'src', 'modules', 'habitaciones', 'HabitacionModal.jsx');
  const modalCode = fs.readFileSync(modalPath, 'utf8');

  // 1. Formulario sin validación nativa del navegador (noValidate)
  assert.ok(modalCode.includes('<form noValidate onSubmit={handleSubmit}'), 'El formulario debe tener noValidate para evitar globos nativos del navegador');
  assert.ok(!modalCode.includes('required\n') && !modalCode.includes('required '), 'No debe haber atributos required nativos');

  // 2. Validación de al menos 1 noche y fechas
  assert.ok(modalCode.includes("const validateForm = () =>"), 'Debe existir validateForm');
  assert.ok(modalCode.includes("newErrors.noches = 'La reserva debe tener al menos 1 noche'"), 'Debe validar que noches sea al menos 1');
  assert.ok(modalCode.includes("newErrors.fecha_check_out = 'El check-out debe ser posterior al check-in'"), 'Debe validar check-out posterior a check-in');
  assert.ok(modalCode.includes("newErrors.nombre_huesped = 'El nombre del huésped es obligatorio'"), 'Debe validar nombre del huésped');

  // 3. Feedback prioritario con toast
  assert.ok(modalCode.includes("toast.error(validationErrors.noches)"), 'Debe emitir toast.error cuando falten noches');
  assert.ok(modalCode.includes("toast.error(validationErrors.nombre_huesped)"), 'Debe emitir toast.error para nombre de huésped');
  assert.ok(modalCode.includes("document.querySelector('.hab-modal-card .is-invalid')"), 'Debe auto-enfocar el primer campo inválido');

  // 4. Clases CSS no nativas y badges de error
  assert.ok(modalCode.includes("${errors.nombre_huesped ? 'is-invalid' : ''}"), 'Huésped debe tener clase is-invalid');
  assert.ok(modalCode.includes("${errors.fecha_check_in ? 'is-invalid' : ''}"), 'Check-in debe tener clase is-invalid');
  assert.ok(modalCode.includes("${errors.fecha_check_out ? 'is-invalid' : ''}"), 'Check-out debe tener clase is-invalid');
  assert.ok(modalCode.includes("${errors.noches ? 'is-invalid' : ''}"), 'Noches debe tener clase is-invalid');
  assert.ok(modalCode.includes("hab-field-error"), 'Debe renderizar badges de error con clase hab-field-error');

  // 5. Estilos en habitaciones.css
  const cssPath = path.join(projectRoot, 'src', 'modules', 'habitaciones', 'habitaciones.css');
  const cssCode = fs.readFileSync(cssPath, 'utf8');
  assert.ok(cssCode.includes('.hab-input.is-invalid'), 'habitaciones.css debe definir estilos de error para .hab-input.is-invalid');
  assert.ok(cssCode.includes('.hab-field-error'), 'habitaciones.css debe definir .hab-field-error');
  assert.ok(cssCode.includes('@keyframes habErrorFadeIn'), 'habitaciones.css debe incluir micro-animación habErrorFadeIn');
});
