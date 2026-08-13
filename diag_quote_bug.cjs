const mariadb = require('mariadb');
async function main() {
  const pool = mariadb.createPool({
    host: '127.0.0.1', port: 3306, user: 'root', password: 'Xvfv2du1p5xyZX', database: 'crm_jdl', connectTimeout: 5000
  });
  const conn = await pool.getConnection();

  // Buscar eventos cuya reserva cubra del 8 al 14 (cualquier mes reciente) o que tengan cotizacion
  const eventos = await conn.query(`
    SELECT id, nombre, nombre_salon, fecha_evento, fecha_inicio_reserva, fecha_fin_reserva, estado,
           CHAR_LENGTH(cotizacion_json) AS quote_len
    FROM eventos
    WHERE cotizacion_json IS NOT NULL AND cotizacion_json != ''
      AND (
        (DAY(fecha_inicio_reserva) IN (8,9) AND DAY(fecha_fin_reserva) = 14)
        OR (DAY(fecha_evento) IN (8,9))
      )
    ORDER BY fecha_evento DESC
    LIMIT 40
  `);
  console.log('=== Eventos candidatos (reserva 8/9 -> 14) ===');
  for (const e of eventos) {
    console.log(`${e.id} | ${e.nombre} | salon=${e.nombre_salon} | fecha_evento=${e.fecha_evento?.toISOString?.().slice(0,10)} | inicio=${e.fecha_inicio_reserva?.toISOString?.().slice(0,10)} | fin=${e.fecha_fin_reserva?.toISOString?.().slice(0,10)} | estado=${e.estado} | quote_len=${e.quote_len}`);
  }

  console.log('\n=== Detalle de cotizaciones de esos eventos ===');
  for (const e of eventos) {
    const rows = await conn.query(`SELECT cotizacion_json FROM eventos WHERE id = ?`, [e.id]);
    if (!rows.length || !rows[0].cotizacion_json) continue;
    let q;
    try { q = JSON.parse(rows[0].cotizacion_json); } catch { console.log(`${e.id}: JSON corrupto`); continue; }
    const items = Array.isArray(q.items) ? q.items : [];
    console.log(`\n--- Evento ${e.id} (${e.nombre}) ---`);
    console.log(`  quote.eventDate=${q.eventDate}  quote.endDate=${q.endDate}  version=${q.version}  code=${q.code}`);
    console.log(`  quote.subtotal=${q.subtotal}  quote.total=${q.total}`);
    const byDate = {};
    for (const it of items) {
      const sd = String(it.serviceDate || '(sin fecha)');
      byDate[sd] = byDate[sd] || { count: 0, sum: 0, names: [] };
      byDate[sd].count++;
      byDate[sd].sum += Number(it.qty || 0) * Number(it.price || 0);
      byDate[sd].names.push(`${it.name} (${it.qty}x${it.price})`);
    }
    for (const [d, info] of Object.entries(byDate).sort()) {
      console.log(`  items ${d}: ${info.count} items, suma=${info.sum.toFixed(2)}`);
      info.names.forEach(n => console.log(`      - ${n}`));
    }
    // Tabla normalizada
    const dbItems = await conn.query(`SELECT fecha_servicio, nombre, cantidad, precio FROM items_cotizacion_evento WHERE id_evento = ? ORDER BY fecha_servicio`, [e.id]);
    const dbByDate = {};
    for (const r of dbItems) {
      const sd = r.fecha_servicio ? r.fecha_servicio.toISOString().slice(0,10) : '(null)';
      dbByDate[sd] = dbByDate[sd] || { count: 0, sum: 0 };
      dbByDate[sd].count++;
      dbByDate[sd].sum += Number(r.cantidad) * Number(r.precio);
    }
    console.log(`  items_cotizacion_evento (tabla):`);
    for (const [d, info] of Object.entries(dbByDate).sort()) {
      console.log(`      ${d}: ${info.count} items, suma=${info.sum.toFixed(2)}`);
    }
  }

  await conn.release();
  await pool.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
