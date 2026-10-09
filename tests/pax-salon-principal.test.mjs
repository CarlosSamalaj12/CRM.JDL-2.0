import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('ReservationForm.jsx implementa la opción Salón Principal en Tipo PAX y sincroniza el total desde el slot principal', () => {
  const filePath = path.join(process.cwd(), 'src/modules/calendar/components/ReservationForm.jsx');
  const code = fs.readFileSync(filePath, 'utf8');

  // Verifica que existe la opción Salón Principal en el toggle desktop y móvil
  assert.ok(code.includes('Salón Principal'), 'Debe incluir el botón "Salón Principal" en el formulario');
  assert.ok(code.includes("paxCompartido === 'principal'"), 'Debe gestionar el estado paxCompartido como "principal"');

  // Verifica la lógica de syncEventPaxFromSlots
  assert.ok(
    code.includes("formData.paxCompartido === 'principal'") &&
    code.includes('slots.find(s => s.isPrincipal === true)'),
    'syncEventPaxFromSlots debe tomar el PAX del slot marcado como isPrincipal'
  );

  // Verifica que setPrincipalSlot actualiza formData.pax en modo principal
  assert.ok(
    code.includes("if (formData.paxCompartido === 'principal' || formData.paxCompartido === 2) {") &&
    code.includes('setFormData(prev => ({ ...prev, pax: pPax > 0 ? pPax : \'\' }));'),
    'setPrincipalSlot debe actualizar el PAX total si está en modo Salón Principal'
  );
});

test('eventService.js serializa correctamente eventos en modo Salón Principal con paxCompartido = 2', () => {
  const filePath = path.join(process.cwd(), 'src/services/eventService.js');
  const code = fs.readFileSync(filePath, 'utf8');

  assert.ok(code.includes("isPrincipalPax = eventData.paxCompartido === 'principal'"), 'Debe detectar isPrincipalPax');
  assert.ok(code.includes("paxCompartido: isPrincipalPax ? 2 : (isSharedPax ? 1 : 0)"), 'Debe asignar paxCompartido = 2 en modo principal');
  assert.ok(code.includes("paxTipo: isPrincipalPax ? 'principal'"), 'Debe declarar paxTipo como principal');
});

test('ReportsDashboard.jsx y ReportsVentas.jsx computan el PAX del Salón Principal sin inflar el total', () => {
  const dashPath = path.join(process.cwd(), 'src/modules/reports/ReportsDashboard.jsx');
  const dashCode = fs.readFileSync(dashPath, 'utf8');
  assert.ok(dashCode.includes("ev.paxCompartido === 2 || ev.paxCompartido === 'principal'"), 'ReportsDashboard debe soportar paxCompartido 2');

  const ventasPath = path.join(process.cwd(), 'src/modules/reports/ReportsVentas.jsx');
  const ventasCode = fs.readFileSync(ventasPath, 'utf8');
  assert.ok(
    ventasCode.includes("first?.paxCompartido === 2 || first?.paxCompartido === 'principal'") &&
    ventasCode.includes("s.isPrincipal === true || (s.mainSalon && s.salon === s.mainSalon)"),
    'ReportsVentas debe retornar el PAX del slot principal en getReservationPax'
  );
});

test('informeController.js resuelve el PAX oficial del Salón Principal y mapea el slot_pax por salón', () => {
  const filePath = path.join(process.cwd(), 'backend/src/controllers/informeController.js');
  const code = fs.readFileSync(filePath, 'utf8');

  assert.ok(code.includes('SalonPrincipal'), 'Debe consultar SalonPrincipal en seriesSlots');
  assert.ok(code.includes('principalSlot.Pax'), 'Debe asignar currentInf.Pax desde el slot principal');
  assert.ok(code.includes('targetSalon'), 'Debe mapear slot_pax considerando el salón del día');
});

test('InformeView.jsx prioriza el PAX sincronizado de la reserva y muestra el PAX oficial en el encabezado', () => {
  const filePath = path.join(process.cwd(), 'src/modules/informes/pages/InformeView.jsx');
  const code = fs.readFileSync(filePath, 'utf8');

  assert.ok(
    code.includes('if (dia.slot_pax && Number(dia.slot_pax) > 0)') &&
    code.includes('diaPax = dia.slot_pax;'),
    'diaPax debe priorizar el slot_pax de la reserva'
  );
  assert.ok(
    code.includes('{informe.Pax || diaPax || \'-\'} Pax'),
    'El encabezado general del documento debe mostrar informe.Pax'
  );
});

test('eventsController.js persiste pax_compartido=2 y sincroniza cotizaciones_evento y montajes de informes', () => {
  const filePath = path.join(process.cwd(), 'backend/src/controllers/eventsController.js');
  const code = fs.readFileSync(filePath, 'utf8');

  assert.ok(code.includes("e?.paxCompartido === 'principal' || e?.paxCompartido === 2"), 'upsertEventSlot debe guardar 2 para modo principal');
  assert.ok(code.includes('UPDATE cotizaciones_evento SET personas = ?'), 'Debe actualizar personas en cotizaciones_evento');
  assert.ok(code.includes('UPDATE informe_dias_detalle SET descripcion_montaje = ?'), 'Debe sincronizar montajes en informe_dias_detalle');
});
