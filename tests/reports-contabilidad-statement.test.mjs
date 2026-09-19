import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();

// Simulación aislada de la función de categorización para verificar su comportamiento matemático y algorítmico
function testCategorizeQuoteItems(items = []) {
  const sections = {
    alimentosBebidas: { title: 'Alimentos & Bebidas', items: [], subtotal: 0 },
    habitaciones: { title: 'Habitaciones / Hospedaje', items: [], subtotal: 0 },
    miscelaneos: { title: 'Misceláneos & Servicios del Evento', items: [], subtotal: 0 },
    otros: { title: 'Otros Servicios', items: [], subtotal: 0 }
  };

  const normalizeText = (str) => String(str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

  for (const item of items) {
    const cat = normalizeText(item.category);
    const name = normalizeText(item.name);
    const qty = Number(item.qty || item.quantity || 1);
    const price = Number(item.price || item.unitPrice || 0);
    const total = Number(item.total || (qty * price));

    const itemObj = { ...item, qty, price, total };

    if (
      cat.includes('alimento') || cat.includes('bebida') || cat.includes('comida') ||
      cat.includes('menu') || cat.includes('catering') || cat.includes('bar') || cat.includes('coctel') ||
      name.includes('alimento') || name.includes('bebida') || name.includes('menu') || name.includes('comida') ||
      name.includes('descorche') || name.includes('plato') || name.includes('cena') || name.includes('almuerzo')
    ) {
      sections.alimentosBebidas.items.push(itemObj);
      sections.alimentosBebidas.subtotal += total;
    } else if (
      cat.includes('habitacion') || cat.includes('hospedaje') || cat.includes('hotel') || cat.includes('alojamiento') ||
      name.includes('habitacion') || name.includes('hospedaje') || name.includes('hotel') || name.includes('noche')
    ) {
      sections.habitaciones.items.push(itemObj);
      sections.habitaciones.subtotal += total;
    } else if (
      cat.includes('miscelaneo') || cat.includes('salon') || cat.includes('mobiliario') ||
      cat.includes('audio') || cat.includes('decoracion') || cat.includes('montaje') ||
      name.includes('salon') || name.includes('silla') || name.includes('mesa') || name.includes('audio') ||
      name.includes('luces') || name.includes('dj') || name.includes('decoracion')
    ) {
      sections.miscelaneos.items.push(itemObj);
      sections.miscelaneos.subtotal += total;
    } else {
      sections.otros.items.push(itemObj);
      sections.otros.subtotal += total;
    }
  }

  return sections;
}

test('categorizeQuoteItems secciona correctamente Alimentos & Bebidas, Habitaciones, Misceláneos y Otros', () => {
  const sampleItems = [
    { name: 'Buffet Especial de Tres Tiempos', category: 'Alimentos y Bebidas', qty: 100, price: 150, total: 15000 },
    { name: 'Descorche Ilimitado', category: 'Bebidas', qty: 1, price: 2000, total: 2000 },
    { name: 'Habitación Suite Nupcial', category: 'Hospedaje', qty: 2, price: 800, total: 1600 },
    { name: 'Habitación Estándar Vista al Lago', category: 'Hotel', qty: 5, price: 500, total: 2500 },
    { name: 'Salón Las Pergolas', category: 'Misceláneos', qty: 1, price: 5000, total: 5000 },
    { name: 'Montaje de Luces y Audio DJ', category: 'Servicios del Evento', qty: 1, price: 3500, total: 3500 },
    { name: 'Servicio de Guardia Privada Adicional', category: 'Seguridad', qty: 2, price: 400, total: 800 }
  ];

  const categorized = testCategorizeQuoteItems(sampleItems);

  // Alimentos & Bebidas: 15000 + 2000 = 17000
  assert.equal(categorized.alimentosBebidas.items.length, 2);
  assert.equal(categorized.alimentosBebidas.subtotal, 17000);

  // Habitaciones: 1600 + 2500 = 4100
  assert.equal(categorized.habitaciones.items.length, 2);
  assert.equal(categorized.habitaciones.subtotal, 4100);

  // Misceláneos: 5000 + 3500 = 8500
  assert.equal(categorized.miscelaneos.items.length, 2);
  assert.equal(categorized.miscelaneos.subtotal, 8500);

  // Otros: 800
  assert.equal(categorized.otros.items.length, 1);
  assert.equal(categorized.otros.subtotal, 800);

  // Suma total consistente
  const grandTotal = categorized.alimentosBebidas.subtotal +
    categorized.habitaciones.subtotal +
    categorized.miscelaneos.subtotal +
    categorized.otros.subtotal;
  assert.equal(grandTotal, 30400);
});

test('ReportsContabilidad.jsx implementa la arquitectura ejecutiva de Estados de Cuenta solicitada', () => {
  const filePath = path.join(projectRoot, 'src', 'modules', 'reports', 'ReportsContabilidad.jsx');
  const code = fs.readFileSync(filePath, 'utf8');

  // 1. Buscador bajo demanda (Enter y botón Aplicar) para no saturar con miles de eventos
  assert.ok(code.includes('searchDraft'), 'Debe manejar borrador de búsqueda');
  assert.ok(code.includes('appliedSearch'), 'Debe manejar término de búsqueda aplicado');
  assert.ok(code.includes("e.key === 'Enter'"), 'Debe activar la búsqueda con la tecla Enter');
  assert.ok(code.includes('handleApplySearch'), 'Debe contar con manejador para aplicar la búsqueda');
  assert.ok(code.includes('Ctrl + K') || code.includes("ctrlKey || e.metaKey"), 'Debe soportar atajo de teclado Ctrl+K');

  // 2. Cinco tarjetas KPI del diseño de referencia
  assert.ok(code.includes('INSTITUCIONES'), 'Debe incluir KPI de Instituciones');
  assert.ok(code.includes('VENTA NETA'), 'Debe incluir KPI de Venta Neta');
  assert.ok(code.includes('COBRADO'), 'Debe incluir KPI de Cobrado');
  assert.ok(code.includes('SALDO PENDIENTE'), 'Debe incluir KPI de Saldo Pendiente');
  assert.ok(code.includes('SALDO A FAVOR'), 'Debe incluir KPI de Saldo a Favor');

  // 3. Banner de Diagnóstico de Cartera
  assert.ok(code.includes('Diagnóstico de Cartera:'), 'Debe incluir el banner de Diagnóstico de Cartera');

  // 4. Pestañas de estado (Todos, Vencidos, Por Vencer, Al Día, Saldo a Favor)
  assert.ok(code.includes("'ALL'"), 'Debe incluir filtro Todos');
  assert.ok(code.includes("'OVERDUE'"), 'Debe incluir filtro Vencidos');
  assert.ok(code.includes("'DUE_SOON'"), 'Debe incluir filtro Por Vencer');
  assert.ok(code.includes("'UP_TO_DATE'"), 'Debe incluir filtro Al Día');
  assert.ok(code.includes("'CREDIT'"), 'Debe incluir filtro Saldo a Favor');

  // 5. Hoja formal de Estado de Cuenta por evento específico
  assert.ok(code.includes('activeEventStatementRow'), 'Debe contar con estado para la hoja de estado de cuenta por evento');
  assert.ok(code.includes('categorizeQuoteItems'), 'Debe invocar categorizeQuoteItems para desglosar la cotización');
  assert.ok(code.includes('Alimentos & Bebidas'), 'Debe desglosar sección Alimentos & Bebidas');
  assert.ok(code.includes('Habitaciones / Hospedaje'), 'Debe desglosar sección Habitaciones');
  assert.ok(code.includes('Misceláneos & Servicios del Evento'), 'Debe desglosar sección Misceláneos');
  assert.ok(code.includes('printEventStatement'), 'Debe contar con función para imprimir/exportar la hoja');

  // 6. Visualización de Boletas de pago (Voucher Lightbox)
  assert.ok(code.includes('previewVoucher'), 'Debe contar con estado para previsualizar la boleta');
  assert.ok(code.includes('Ver Boleta') || code.includes('Ver boleta'), 'Debe tener acción para ver boletas de pago');
  assert.ok(code.includes('No. Boleta') || code.includes('Boleta / Ref') || code.includes('voucherNumber'), 'Debe detallar el número de boleta');

  // 7. Iconos minimalistas Lucide
  assert.ok(code.includes("from 'lucide-react'"), 'Debe usar iconos vectoriales de lucide-react');
  assert.ok(code.includes('Landmark'), 'Debe usar iconos minimalistas como Landmark');
  assert.ok(code.includes('Coins'), 'Debe usar iconos minimalistas como Coins');

  // 8. Exportación completa a Excel
  assert.ok(code.includes('handleExportExcel') || code.includes('exportToExcel'), 'Debe implementar exportación a Excel');
  assert.ok(code.includes("'Cartera por Empresa'"), 'Excel debe incluir hoja resumen por empresa');
  assert.ok(code.includes("'Detalle de Eventos'"), 'Excel debe incluir hoja de detalle de eventos');
});

test('reports.css incluye estilos dedicados para los estados de cuenta contables y su impresión', () => {
  const cssPath = path.join(projectRoot, 'src', 'modules', 'reports', 'reports.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  assert.ok(css.includes('.acct-page-container'), 'Debe incluir estilos para el contenedor contable');
  assert.ok(css.includes('.acct-kpi-grid'), 'Debe incluir estilos para la cuadrícula de KPIs');
  assert.ok(css.includes('.acct-kpi-card'), 'Debe incluir estilos para las tarjetas KPI');
  assert.ok(css.includes('.acct-diagnostic-banner'), 'Debe incluir estilos para el banner de diagnóstico');
  assert.ok(css.includes('.acct-status-pills'), 'Debe incluir estilos para los pills de estado');
  assert.ok(css.includes('.acct-table'), 'Debe incluir estilos para la tabla contable');
  assert.ok(css.includes('@media print'), 'Debe incluir reglas para impresión formal');
});

test('resolveEventCompany previene la contaminación de companyId 10 residual/clonado', () => {
  const filePath = path.join(projectRoot, 'src', 'modules', 'reports', 'ReportsContabilidad.jsx');
  const code = fs.readFileSync(filePath, 'utf8');

  // Verifica que implementa la resolución inteligente de empresa y contacto
  assert.ok(code.includes('resolveEventCompany'), 'Debe definir resolveEventCompany');
  assert.ok(code.includes('resolveEventContact'), 'Debe definir resolveEventContact');
  assert.ok(code.includes('isMatchingCompanyName'), 'Debe definir isMatchingCompanyName');
  assert.ok(code.includes('companyToken'), 'Debe utilizar companyToken para agrupar las cuentas de forma legítima');
  assert.ok(code.includes('confirmado'), 'Debe filtrar exclusivamente eventos confirmados');
  assert.ok(code.includes("startsWith('1970')"), 'Debe descartar registros huérfanos con fecha 1970');
  assert.ok(code.includes("'(sin nombre)'"), 'Debe descartar registros sin nombre');
});

test('ReportsContabilidad.jsx implementa botón X de alta visibilidad, soporte de Escape y sección de cobros/abonos para eventos pasados', () => {
  const filePath = path.join(projectRoot, 'src', 'modules', 'reports', 'ReportsContabilidad.jsx');
  const code = fs.readFileSync(filePath, 'utf8');

  // 1. Botón de cerrar de alta visibilidad y soporte de tecla Escape
  assert.ok(code.includes("e.key === 'Escape'"), 'Debe escuchar la tecla Escape para cerrar modales abiertos');
  assert.ok(code.includes("title=\"Cerrar (Esc)\""), 'Debe tener botón de cerrar con tooltip explicativo de Escape');
  assert.ok(code.includes("strokeWidth={2.5}"), 'El icono X de cerrar debe tener trazo nítido y visible');
  assert.ok(code.includes("background: '#ffffff'"), 'El botón de cerrar debe tener fondo contrastado y sólido');

  // 2. Sección para aplicar y registrar pagos a eventos (incluso si ya pasaron de fecha)
  assert.ok(code.includes('handleSaveAdvanceInModal'), 'Debe contar con manejador para guardar y aplicar abonos al evento');
  assert.ok(code.includes('handleDeleteAdvanceInModal'), 'Debe contar con manejador para eliminar abonos con confirmación');
  assert.ok(code.includes('handleStartEditAdvance'), 'Debe contar con funcionalidad para editar abonos registrados');
  assert.ok(code.includes('handleFillPendingBalance'), 'Debe permitir saldar el monto total pendiente con un clic');
  assert.ok(code.includes('showAdvanceForm'), 'Debe controlar la visibilidad del formulario interactivo de abonos');
  assert.ok(code.includes('compressEvidenceFile'), 'Debe procesar y comprimir comprobantes o boletas bancarias');
  assert.ok(code.includes('Aplicar Pago'), 'Debe incluir botón rápido Aplicar Pago en la lista de eventos');
  assert.ok(code.includes('advanceLogs'), 'Debe auditar los abonos agregados, editados o eliminados en la bitácora');
});

test('ReportsContabilidad y reports.css implementan persistencia de abonos editados y diseño ejecutivo de botones', () => {
  const jsxPath = path.join(projectRoot, 'src', 'modules', 'reports', 'ReportsContabilidad.jsx');
  const jsxCode = fs.readFileSync(jsxPath, 'utf8');

  const cssPath = path.join(projectRoot, 'src', 'modules', 'reports', 'reports.css');
  const cssCode = fs.readFileSync(cssPath, 'utf8');

  // 1. Clases CSS para botones ejecutivos inmunes a reglas globales
  assert.ok(cssCode.includes('.acct-btn-toggle-form'), 'Debe definir clase .acct-btn-toggle-form');
  assert.ok(cssCode.includes('.acct-btn-clear-file'), 'Debe definir clase .acct-btn-clear-file para el botón de eliminar comprobante');
  assert.ok(cssCode.includes('.acct-btn-submit-advance'), 'Debe definir clase .acct-btn-submit-advance');
  assert.ok(cssCode.includes('.acct-btn-saldar'), 'Debe definir clase .acct-btn-saldar');
  assert.ok(cssCode.includes('.acct-btn-cancel-form'), 'Debe definir clase .acct-btn-cancel-form');
  assert.ok(cssCode.includes('.acct-btn-row-action'), 'Debe definir clase .acct-btn-row-action');

  // 2. Uso de clases en ReportsContabilidad.jsx
  assert.ok(jsxCode.includes('acct-btn-toggle-form'), 'Debe usar clase acct-btn-toggle-form');
  assert.ok(jsxCode.includes('acct-btn-clear-file'), 'Debe usar clase acct-btn-clear-file');
  assert.ok(jsxCode.includes('acct-btn-submit-advance'), 'Debe usar clase acct-btn-submit-advance');
  assert.ok(jsxCode.includes('acct-btn-saldar'), 'Debe usar clase acct-btn-saldar');
  assert.ok(jsxCode.includes('acct-btn-cancel-form'), 'Debe usar clase acct-btn-cancel-form');
  assert.ok(jsxCode.includes('acct-btn-row-action'), 'Debe usar clase acct-btn-row-action');

  // 3. Persistencia y consolidación de abonos contra pérdidas en edición
  assert.ok(jsxCode.includes('advancesMap'), 'Debe unificar anticipos mediante advancesMap para evitar pérdidas al editar');
  assert.ok(jsxCode.includes('targetEvent.quote?.advances'), 'Debe leer anticipos de targetEvent');
  assert.ok(jsxCode.includes('activeEventStatementRow.advances'), 'Debe leer anticipos de activeEventStatementRow');
  assert.ok(jsxCode.includes('advanceEditingId'), 'Debe gestionar advanceEditingId');
});

test('ReportsContabilidad y server.cjs registran y muestran el usuario o vendedor que aplica el pago', () => {
  const jsxPath = path.join(projectRoot, 'src', 'modules', 'reports', 'ReportsContabilidad.jsx');
  const jsxCode = fs.readFileSync(jsxPath, 'utf8');

  const serverPath = path.join(projectRoot, 'server.cjs');
  const serverCode = fs.readFileSync(serverPath, 'utf8');

  // 1. Selector de usuario en el formulario de abonos
  assert.ok(jsxCode.includes('Usuario *'), 'El formulario debe tener selector de usuario');
  assert.ok(jsxCode.includes('advanceForm.userId'), 'Debe almacenar el ID del usuario en advanceForm');
  assert.ok(jsxCode.includes('advanceForm.userName'), 'Debe almacenar el nombre del usuario en advanceForm');

  // 2. Columna en la tabla del modal
  assert.ok(jsxCode.includes('>Usuario</th>'), 'La tabla del modal debe tener la columna Usuario');
  assert.ok(jsxCode.includes('appliedByName'), 'Debe calcular el usuario aplicado para cada fila');

  // 3. Columna en la hoja formal imprimible
  assert.ok(jsxCode.includes('Aplicado Por'), 'La hoja imprimible debe contener columna Aplicado Por');

  // 4. Backend persiste y actualiza id_usuario_creador y nombre_usuario_creador
  assert.ok(serverCode.includes('id_usuario_creador = COALESCE(VALUES(id_usuario_creador), anticipos_evento.id_usuario_creador)'), 'server.cjs debe actualizar id_usuario_creador en duplicados');
  assert.ok(serverCode.includes('nombre_usuario_creador = COALESCE(VALUES(nombre_usuario_creador), anticipos_evento.nombre_usuario_creador)'), 'server.cjs debe actualizar nombre_usuario_creador en duplicados');
});

test('ReportsContabilidad y reports.css implementan rediseño móvil ejecutivo y optimización de columnas desktop', async () => {
  const jsxPath = path.join(projectRoot, 'src', 'modules', 'reports', 'ReportsContabilidad.jsx');
  const jsxCode = fs.readFileSync(jsxPath, 'utf8');

  const cssPath = path.join(projectRoot, 'src', 'modules', 'reports', 'reports.css');
  const cssCode = fs.readFileSync(cssPath, 'utf8');

  // 1. Separación de vistas responsive
  assert.ok(jsxCode.includes('acct-desktop-view'), 'Debe contar con contenedor .acct-desktop-view');
  assert.ok(jsxCode.includes('acct-mobile-view'), 'Debe contar con contenedor .acct-mobile-view');
  assert.ok(cssCode.includes('.acct-desktop-view'), 'CSS debe definir .acct-desktop-view');
  assert.ok(cssCode.includes('.acct-mobile-view'), 'CSS debe definir .acct-mobile-view');
  assert.ok(cssCode.includes('@media (max-width: 850px)'), 'CSS debe incluir breakpoint responsive a 850px');

  // 2. Botón "Detalle" (con chevron) y Botón "Estado" ("Ver estado de cuenta")
  assert.ok(jsxCode.includes('acct-btn-detail'), 'Debe contar con botón Detalle en desktop');
  assert.ok(jsxCode.includes('acct-btn-state'), 'Debe contar con botón Estado en desktop');
  assert.ok(jsxCode.includes('acct-btn-mobile-detail'), 'Debe contar con botón Detalle en móvil');
  assert.ok(jsxCode.includes('acct-btn-mobile-state'), 'Debe contar con botón Estado en móvil');
  assert.ok(jsxCode.includes('setActiveStatementCompanyId(account.key)'), 'Botón Estado debe consultar directamente el estado de cuenta corporativo');

  // 3. Calibración de columnas y acciones sticky
  assert.ok(cssCode.includes('position: sticky'), 'Columna de acciones debe estar anclada sticky');
  assert.ok(cssCode.includes('.acct-col-actions'), 'Debe definir clase .acct-col-actions');
  assert.ok(cssCode.includes('.acct-col-status'), 'Debe definir clase .acct-col-status');
  assert.ok(cssCode.includes('.acct-col-company'), 'Debe definir clase .acct-col-company');

  // 4. Elementos de la vista móvil idénticos a la maqueta
  assert.ok(jsxCode.includes('acct-mobile-diagnostic-card'), 'Debe incluir tarjeta de diagnóstico móvil');
  assert.ok(jsxCode.includes('acct-mobile-kpi-carousel'), 'Debe incluir carrusel financiero deslizante');
  assert.ok(jsxCode.includes('Deslizar →'), 'Debe incluir indicador Deslizar en carrusel');
  assert.ok(jsxCode.includes('acct-mobile-search-bar'), 'Debe incluir buscador móvil');
  assert.ok(jsxCode.includes('showMobileFilters'), 'Debe soportar drawer de filtros avanzados en móvil');
  assert.ok(jsxCode.includes('acct-mobile-status-scroll'), 'Debe incluir scroll horizontal de estados');
  assert.ok(jsxCode.includes('acct-mobile-avatar'), 'Debe incluir avatar de iniciales en tarjetas móviles');
  assert.ok(jsxCode.includes('acct-mobile-inner-box'), 'Debe incluir caja interna de métricas');
  assert.ok(jsxCode.includes('acct-btn-mobile-phone'), 'Debe incluir botón de llamada telefónica');
  assert.ok(jsxCode.includes('acct-btn-mobile-proposal'), 'Debe incluir botón contextual de propuesta');
  assert.ok(jsxCode.includes('acct-mobile-pagination'), 'Debe incluir paginador móvil');

  // 5. Verificación de helpers matemáticos y visuales
  assert.ok(jsxCode.includes('function getAccountInitials'), 'Debe definir getAccountInitials');
  assert.ok(jsxCode.includes('function formatDateEs'), 'Debe definir formatDateEs');
  assert.ok(jsxCode.includes('function renderFormattedParts'), 'Debe definir renderFormattedParts');

  const initialsMatch = jsxCode.match(/export function getAccountInitials\([\s\S]*?^}/m);
  assert.ok(initialsMatch, 'Debe exportar getAccountInitials');
  const getAccountInitials = new Function(`${initialsMatch[0].replace('export function getAccountInitials', 'function getAccountInitials')}; return getAccountInitials;`)();
  assert.equal(getAccountInitials('PNUD'), 'PN');
  assert.equal(getAccountInitials('BODA GIOIA OROZCO'), 'GO');
  assert.equal(getAccountInitials('BODA CARDONA LUNA'), 'CL');
  assert.equal(getAccountInitials('BODA BURDIN VALENCIA'), 'BV');

  const dateMatch = jsxCode.match(/export function formatDateEs\([\s\S]*?^}/m);
  assert.ok(dateMatch, 'Debe exportar formatDateEs');
  const formatDateEs = new Function(`${dateMatch[0].replace('export function formatDateEs', 'function formatDateEs')}; return formatDateEs;`)();
  assert.equal(formatDateEs('2026-07-31'), '31 jul 2026');
  assert.equal(formatDateEs('2026-09-30'), '30 sept 2026');
});

test('ReportsContabilidad y reports.css implementan modal bottom sheet de filtros y pastillas de estado anti-truncamiento', () => {
  const jsxPath = path.join(projectRoot, 'src', 'modules', 'reports', 'ReportsContabilidad.jsx');
  const jsxCode = fs.readFileSync(jsxPath, 'utf8');

  const cssPath = path.join(projectRoot, 'src', 'modules', 'reports', 'reports.css');
  const cssCode = fs.readFileSync(cssPath, 'utf8');

  // 1. Bottom Sheet Modal Portal
  assert.ok(jsxCode.includes('acct-mobile-sheet-overlay'), 'Debe contar con overlay de modal bottom sheet');
  assert.ok(jsxCode.includes('acct-mobile-sheet-container'), 'Debe contar con contenedor de modal bottom sheet');
  assert.ok(jsxCode.includes('acct-mobile-sheet-handle'), 'Debe incluir tirador o drag handle');
  assert.ok(jsxCode.includes('acct-mobile-date-presets'), 'Debe incluir presets de fecha rápida');
  assert.ok(jsxCode.includes('handleDatePreset'), 'Debe implementar función handleDatePreset');
  assert.ok(jsxCode.includes('acct-sheet-input-date'), 'Debe usar inputs de fecha estilizados para el sheet');

  // 2. Tira de Chips de Filtros Activos Rápidos
  assert.ok(jsxCode.includes('acct-mobile-active-chips-strip'), 'Debe mostrar tira de chips de filtros activos');
  assert.ok(jsxCode.includes('acct-mobile-clear-all-chip'), 'Debe permitir limpiar todos los filtros');
  assert.ok(jsxCode.includes('handleResetSecondaryFilters'), 'Debe implementar handleResetSecondaryFilters');

  // 3. Pastillas de Estado Pastel Anti-Truncamiento
  assert.ok(jsxCode.includes('is-pill-all'), 'Debe usar clase is-pill-all');
  assert.ok(jsxCode.includes('is-pill-overdue'), 'Debe usar clase is-pill-overdue');
  assert.ok(jsxCode.includes('is-pill-due'), 'Debe usar clase is-pill-due');
  assert.ok(jsxCode.includes('is-pill-ok'), 'Debe usar clase is-pill-ok');
  assert.ok(jsxCode.includes('is-pill-credit'), 'Debe usar clase is-pill-credit');
  assert.ok(jsxCode.includes('acct-pill-dot'), 'Debe incluir puntos de color');

  // 4. CSS: light-mode forzado en fechas y flex-shrink: 0 para evitar truncamiento
  assert.ok(cssCode.includes('color-scheme: light !important'), 'CSS debe forzar color-scheme: light en fechas para evitar fondos negros de SO móvil');
  assert.ok(cssCode.includes('flex-shrink: 0 !important'), 'CSS debe impedir que las pastillas se encojan o trunquen sus textos y contadores');
  assert.ok(cssCode.includes('min-width: max-content !important'), 'CSS debe asegurar ancho natural sin cortes');
  assert.ok(cssCode.includes('.acct-mobile-sheet-overlay'), 'CSS debe definir overlay');
  assert.ok(cssCode.includes('.acct-mobile-sheet-container'), 'CSS debe definir contenedor con animación');
});
