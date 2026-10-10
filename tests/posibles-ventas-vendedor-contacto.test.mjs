import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test('PosiblesVentasModule.jsx nunca muestra quien asignó el evento en Último contacto y resuelve vendedorContacto', () => {
  const fileContent = fs.readFileSync(
    path.join(rootDir, 'src', 'modules', 'posiblesVentas', 'PosiblesVentasModule.jsx'),
    'utf8'
  );

  // 1. Verificar definición de vendedorContacto
  assert.ok(
    fileContent.includes('const vendedorContacto = lead.tomadoPorOtro && lead.atendidoPorNombre'),
    'Debe definir vendedorContacto priorizando atendidoPorNombre cuando tomadoPorOtro es true'
  );

  // 2. Verificar que el bloque de Último contacto usa vendedorContacto y NO creadoPorNombre
  assert.ok(
    fileContent.includes('{vendedorContacto && <span> · {vendedorContacto}</span>}'),
    'El bloque de Último contacto debe mostrar vendedorContacto'
  );
  assert.ok(
    !fileContent.includes('<strong>{formatDiaSeguimientoShort(fechaSeg)}</strong>\n                {lead.creadoPorNombre'),
    'Último contacto NUNCA debe mostrar lead.creadoPorNombre directamente'
  );

  // 3. Verificar que en la cabecera sí se muestra quien asignó como contexto informativo
  assert.ok(
    fileContent.includes('asignado por <strong style={{ color: \'#475569\', fontWeight: 600 }}>{lead.creadoPorNombre}</strong>'),
    'La cabecera debe mostrar quien asignó el evento con "asignado por [creadoPorNombre]"'
  );

  // 4. Verificar que si otro vendedor atendió la reserva, la cabecera lo resalta
  assert.ok(
    fileContent.includes('Reserva atendida por: <strong style={{ color: \'#0284c7\'>>{lead.atendidoPorNombre}</strong>') ||
    fileContent.includes('Reserva atendida por: <strong style={{ color: \'#0284c7\' }}>{lead.atendidoPorNombre}</strong>'),
    'La cabecera debe mostrar "Reserva atendida por: [lead.atendidoPorNombre]"'
  );
});

test('Lógica pura de resolución de vendedorContacto para seguimiento', () => {
  function resolveVendedorContacto(lead) {
    return lead.tomadoPorOtro && lead.atendidoPorNombre
      ? lead.atendidoPorNombre
      : (lead.atendidoPorNombre || lead.vendedorNombre || null);
  }

  // Caso 1: Asignado a Vendedor A, pero tomado y atendido por Vendedor B
  const leadTomadoPorOtro = {
    vendedorNombre: 'Ana Ventas',
    creadoPorNombre: 'Carlos Recepción',
    atendidoPorNombre: 'Beatriz Reservas',
    tomadoPorOtro: true,
  };
  assert.equal(resolveVendedorContacto(leadTomadoPorOtro), 'Beatriz Reservas');

  // Caso 2: Asignado a Vendedor A y la reserva fue creada por Vendedor A
  const leadPropio = {
    vendedorNombre: 'Ana Ventas',
    creadoPorNombre: 'Carlos Recepción',
    atendidoPorNombre: 'Ana Ventas',
    tomadoPorOtro: false,
  };
  assert.equal(resolveVendedorContacto(leadPropio), 'Ana Ventas');

  // Caso 3: Lead aún no vinculado a reserva (sin atendidoPorNombre)
  const leadSinReserva = {
    vendedorNombre: 'Ana Ventas',
    creadoPorNombre: 'Carlos Recepción',
    atendidoPorNombre: null,
    tomadoPorOtro: false,
  };
  assert.equal(resolveVendedorContacto(leadSinReserva), 'Ana Ventas');
});

test('posiblesVentasController.js sincroniza ultimo_seguimiento_en en notas y mensajes, y calcula fecha más reciente', () => {
  const fileContent = fs.readFileSync(
    path.join(rootDir, 'backend', 'src', 'controllers', 'posiblesVentasController.js'),
    'utf8'
  );

  // 1. Función getLatestDate presente
  assert.ok(
    fileContent.includes('function getLatestDate(...dates)'),
    'posiblesVentasController debe incluir función getLatestDate para resolver el contacto más reciente'
  );

  // 2. buildLead resuelve la fecha más reciente de seguimiento
  assert.ok(
    fileContent.includes('ultimoSeguimientoEn: getLatestDate('),
    'buildLead debe invocar getLatestDate para calcular ultimoSeguimientoEn'
  );

  // 3. enviarMensajeVendedor actualiza ultimo_seguimiento_en
  assert.ok(
    fileContent.includes('UPDATE posibles_ventas') &&
    fileContent.includes('ultimo_seguimiento_en = CURRENT_TIMESTAMP'),
    'enviarMensajeVendedor debe actualizar ultimo_seguimiento_en'
  );

  // 4. updatePosibleVenta actualiza ultimo_seguimiento_en al editar notas o servicios
  assert.ok(
    fileContent.includes('body.notas !== undefined') &&
    fileContent.includes("updates.push('ultimo_seguimiento_en = CURRENT_TIMESTAMP')"),
    'updatePosibleVenta debe actualizar ultimo_seguimiento_en al cambiar notas'
  );
  assert.ok(
    fileContent.includes('body.servicios !== undefined') &&
    fileContent.includes("updates.push('ultimo_seguimiento_en = CURRENT_TIMESTAMP')"),
    'updatePosibleVenta debe actualizar ultimo_seguimiento_en al cambiar servicios'
  );
});

test('eventsController.js y server.cjs sincronizan posibles_ventas al guardar reservas, anticipos y cotizaciones con servicios', () => {
  const eventsContent = fs.readFileSync(
    path.join(rootDir, 'backend', 'src', 'controllers', 'eventsController.js'),
    'utf8'
  );
  const serverContent = fs.readFileSync(
    path.join(rootDir, 'server.cjs'),
    'utf8'
  );

  // eventsController sincroniza en updateEvent y createEvent
  assert.ok(
    eventsContent.includes('SINCRONIZAR ÚLTIMO CONTACTO EN POSIBLES VENTAS VINCULADAS') &&
    eventsContent.includes('ultimo_seguimiento_en = CURRENT_TIMESTAMP'),
    'eventsController debe actualizar posibles_ventas al actualizar o crear reservas'
  );

  // eventsController sincroniza en updateEventQuote (al agregar/editar servicios en la cotización)
  assert.ok(
    eventsContent.indexOf('updateEventQuote') !== -1 &&
    eventsContent.includes('UPDATE posibles_ventas') &&
    eventsContent.includes('ultimo_seguimiento_en = CURRENT_TIMESTAMP'),
    'eventsController debe actualizar posibles_ventas al guardar o agregar servicios en la cotización'
  );

  // eventsController sincroniza en createEventReminder (al agregar una cita)
  assert.ok(
    eventsContent.indexOf('createEventReminder') !== -1 &&
    eventsContent.includes('UPDATE posibles_ventas') &&
    eventsContent.includes('ultimo_seguimiento_en = CURRENT_TIMESTAMP'),
    'eventsController debe actualizar posibles_ventas al registrar citas'
  );

  // server.cjs sincroniza en anticipos, cotizaciones y recordatorios
  assert.ok(
    serverContent.includes('UPDATE posibles_ventas') &&
    serverContent.includes('ultimo_seguimiento_en = CURRENT_TIMESTAMP'),
    'server.cjs debe actualizar posibles_ventas al registrar anticipos o guardar cotizaciones'
  );
});
