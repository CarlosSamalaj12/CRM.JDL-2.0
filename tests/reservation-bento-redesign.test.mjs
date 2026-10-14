import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();
const RESERVATION_FORM_PATH = path.join(ROOT_DIR, 'src', 'modules', 'calendar', 'components', 'ReservationForm.jsx');
const BENTO_CSS_PATH = path.join(ROOT_DIR, 'src', 'modules', 'calendar', 'components', 'reservationBento.css');
const CONSTANTS_PATH = path.join(ROOT_DIR, 'src', 'modules', 'calendar', 'constants.js');
const CALENDAR_PATH = path.join(ROOT_DIR, 'src', 'modules', 'calendar', 'Calendar.jsx');

test('Rediseño Bento de Reserva: Archivo CSS dedicado existe y contiene las clases esenciales de la maqueta', () => {
  assert.ok(fs.existsSync(BENTO_CSS_PATH), 'reservationBento.css debe existir');
  const css = fs.readFileSync(BENTO_CSS_PATH, 'utf-8');

  // Overlay flotante y ventana modal
  assert.match(css, /\.res-bento-overlay/);
  assert.match(css, /\.reservation-modal-overlay/);
  assert.match(css, /\.reservation-modal-content/);
  assert.match(css, /\.res-bento-window/);

  // Stepper Chevron
  assert.match(css, /\.res-bento-stepper/);
  assert.match(css, /\.res-bento-chevron-item/);
  assert.match(css, /clip-path:\s*polygon/);

  // Bento Cards y Tabla de Salones
  assert.match(css, /\.res-bento-grid/);
  assert.match(css, /\.res-bento-card/);
  assert.match(css, /\.res-bento-btn-confirm-all/);
  assert.match(css, /\.res-bento-btn-add-salon/);
  assert.match(css, /\.res-bento-table-head/);
  assert.match(css, /\.res-bento-table-row/);
  assert.match(css, /\.res-bento-star-btn/);

  // Aforo y Píldoras de cálculo
  assert.match(css, /\.res-bento-segmented-pills/);
  assert.match(css, /\.active-compartido/);
  assert.match(css, /\.active-no-compartido/);
  assert.match(css, /\.active-principal/);

  // Columna lateral: Usuario Responsable y Notas
  assert.match(css, /\.res-bento-user-card/);
  assert.match(css, /\.res-bento-user-avatar/);
  assert.match(css, /\.res-bento-notes-textarea/);

  // Botones de acción inferior
  assert.match(css, /\.res-bento-footer/);
  assert.match(css, /\.res-bento-btn-action\.mantenimiento/);
  assert.match(css, /\.res-bento-btn-action\.cita/);
  assert.match(css, /\.res-bento-btn-action\.cotizar/);
  // Blindaje de inputs blancos contra estilos oscuros globales
  assert.match(css, /background:\s*#ffffff\s*!important/);

  // Botón guardar con verde sólido / degradado ejecutivo
  assert.match(css, /res-bento-btn-guardar/);
  assert.match(css, /#007A64/);
});

test('Rediseño Bento de Reserva: ReservationForm.jsx integra la arquitectura de maqueta y preserva lógica de negocio', () => {
  assert.ok(fs.existsSync(RESERVATION_FORM_PATH), 'ReservationForm.jsx debe existir');
  const jsx = fs.readFileSync(RESERVATION_FORM_PATH, 'utf-8');

  // Import de reservationBento.css
  assert.match(jsx, /import\s+['"]\.\/reservationBento\.css['"]/);

  // Stepper con 5 etapas de pipeline comercial
  assert.match(jsx, /PIPELINE_STEPS\s*=/);
  assert.match(jsx, /'Reserva sin Cotizacion'/);
  assert.match(jsx, /'1er Cotizacion'/);
  assert.match(jsx, /'Seguimiento'/);
  assert.match(jsx, /'Pre reserva'/);
  assert.match(jsx, /'Confirmado'/);

  // Chevrons interactivos y renderizado de iconos
  assert.match(jsx, /res-bento-chevron-item/);
  assert.match(jsx, /renderStageIcon/);

  // Header ejecutivo con metadatos del evento
  assert.match(jsx, /res-bento-header/);
  assert.match(jsx, /res-bento-status-pill/);
  assert.match(jsx, /formattedHeaderDate/);

  // Tarjeta de Nombre del Evento
  assert.match(jsx, /res-bento-name-input/);

  // Tarjeta de Salones y Horarios con botón de Confirmar Todos y Agregar Salón
  assert.match(jsx, /res-bento-btn-confirm-all/);
  assert.match(jsx, /handleConfirmAllSlots/);
  assert.match(jsx, /res-bento-btn-add-salon/);
  assert.match(jsx, /res-bento-star-btn/);

  // Píldoras de cálculo de aforo (Compartido, No Compartido, Principal)
  assert.match(jsx, /active-compartido/);
  assert.match(jsx, /active-no-compartido/);
  assert.match(jsx, /active-principal/);
  assert.match(jsx, /sumaPaxSalones/);

  // Columna lateral con 4 tarjetas Bento
  assert.match(jsx, /Periodo Global del Evento/);
  assert.match(jsx, /calculatedJornadas/);
  assert.match(jsx, /Estado General Consolidado/);
  assert.match(jsx, /Usuario Responsable/);
  assert.match(jsx, /getUserInitials/);
  assert.match(jsx, /Notas y Requerimientos/);

  // Footer con botones de acción ejecutivos
  assert.match(jsx, /res-bento-footer/);
  assert.match(jsx, /handleMaintenance/);
  assert.match(jsx, /handleOpenAppointments/);
  assert.match(jsx, /handleOpenQuote/);
  assert.match(jsx, /handleOpenHistory/);
  assert.match(jsx, /handleCancelEventClick/);
  assert.match(jsx, /res-bento-btn-guardar/);
});

test('Rediseño Bento de Reserva: Preserva los colores exactos de estado del CRM en STATUS_META', () => {
  assert.ok(fs.existsSync(CONSTANTS_PATH), 'constants.js debe existir');
  const code = fs.readFileSync(CONSTANTS_PATH, 'utf-8');

  assert.match(code, /'Reserva sin Cotizacion',\s*color:\s*'#00A3FF'/);
  assert.match(code, /'1er Cotizacion',\s*color:\s*'#007A64'/);
  assert.match(code, /'Seguimiento',\s*color:\s*'#FF8C00'/);
  assert.match(code, /'Pre reserva',\s*color:\s*'#FF00CC'/);
  assert.match(code, /'Confirmado',\s*color:\s*'#00CC66'/);
});

test('Rediseño Bento de Reserva: Calendar.jsx monta el modal flotante centrado con createPortal directo al body', () => {
  assert.ok(fs.existsSync(CALENDAR_PATH), 'Calendar.jsx debe existir');
  const code = fs.readFileSync(CALENDAR_PATH, 'utf-8');

  // No debe forzar width: 100vw, height: 100vh inline que destruya el modal flotante
  assert.doesNotMatch(code, /width:\s*'100vw',\s*height:\s*'100vh'/);
  assert.match(code, /createPortal/);
  assert.match(code, /className="reservation-modal-overlay"/);
  assert.match(code, /className="reservation-modal-content"/);
  assert.match(code, /document\.body/);
});
