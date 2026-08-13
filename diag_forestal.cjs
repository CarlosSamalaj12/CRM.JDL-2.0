const mariadb = require('mariadb');
async function main() {
  const pool = mariadb.createPool({
    host: '127.0.0.1', port: 3306, user: 'root', password: 'Xvfv2du1p5xyZX', database: 'crm_jdl', connectTimeout: 5000
  });
  const conn = await pool.getConnection();
  const rows = await conn.query(
    "SELECT id, nombre_salon, fecha_evento, fecha_inicio_reserva, fecha_fin_reserva, estado FROM eventos WHERE id LIKE '%evt_eb154a04%' OR nombre LIKE '%Forestal%' ORDER BY fecha_evento"
  );
  console.log('=== Filas del evento Servicio Forestal ===');
  rows.forEach(r => console.log(
    r.id, '|', r.nombre_salon, '|',
    'fecha_evento=', r.fecha_evento && r.fecha_evento.toISOString ? r.fecha_evento.toISOString().slice(0,10) : r.fecha_evento,
    '| inicio=', r.fecha_inicio_reserva && r.fecha_inicio_reserva.toISOString ? r.fecha_inicio_reserva.toISOString().slice(0,10) : r.fecha_inicio_reserva,
    '-> fin=', r.fecha_fin_reserva && r.fecha_fin_reserva.toISOString ? r.fecha_fin_reserva.toISOString().slice(0,10) : r.fecha_fin_reserva,
    '|', r.estado
  ));

  // Versiones guardadas de la cotización
  const vers = await conn.query(
    "SELECT version_num, subtotal, total_neto, cotizado_en_iso FROM cotizacion_versiones_evento WHERE id_evento = 'evt_eb154a04' ORDER BY version_num"
  );
  console.log('\n=== Versiones cotización evt_eb154a04 ===');
  vers.forEach(v => console.log('v' + v.version_num, '| subtotal=', String(v.subtotal), '| total=', String(v.total_neto), '|', v.cotizado_en_iso));

  // Items de la versión actual (8)
  const vitems = await conn.query(
    "SELECT version_num, fecha_servicio, nombre, cantidad, precio FROM items_cotizacion_version_evento WHERE id_evento = 'evt_eb154a04' AND fecha_servicio <= '2026-08-09' ORDER BY version_num, fecha_servicio"
  );
  console.log('\n=== Items de versiones con fecha <= 2026-08-09 ===');
  vitems.forEach(v => console.log('v' + v.version_num, '|', v.fecha_servicio && v.fecha_servicio.toISOString ? v.fecha_servicio.toISOString().slice(0,10) : v.fecha_servicio, '|', v.nombre, '|', String(v.cantidad), 'x', String(v.precio)));

  await conn.release();
  await pool.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
