const mariadb = require('mariadb');

async function main() {
  const pool = mariadb.createPool({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: 'Xvfv2du1p5xyZX',
    database: 'crm_jdl'
  });

  const conn = await pool.getConnection();
  console.log('Connected to MariaDB. Inspecting events with cotizacion_json...');

  const rows = await conn.query("SELECT id, nombre, cotizacion_json FROM eventos WHERE cotizacion_json IS NOT NULL");
  let fixedCount = 0;

  for (const r of rows) {
    if (!r.cotizacion_json) continue;
    try {
      const q = typeof r.cotizacion_json === 'string' ? JSON.parse(r.cotizacion_json) : r.cotizacion_json;
      if (!q || typeof q !== 'object') continue;

      let changed = false;
      let rawTotal = Number(q.total || 0);
      let rawSubtotal = Number(q.subtotal || 0);
      const rawDiscount = Number(q.discountAmount ?? q.discountValue ?? 0);

      // 1. Fallback a versiones
      if (rawTotal <= 0 && Array.isArray(q.versions) && q.versions.length > 0) {
        const lastVer = q.versions[q.versions.length - 1];
        if (lastVer && Number(lastVer.total || 0) > 0) {
          rawTotal = Number(lastVer.total || 0);
          if (rawSubtotal <= 0) rawSubtotal = Number(lastVer.subtotal || rawTotal);
        }
      }

      // 2. Fallback a items
      if (rawTotal <= 0 && Array.isArray(q.items) && q.items.length > 0) {
        rawSubtotal = q.items.reduce((acc, it) => {
          const qty = Number(it?.qty || it?.quantity || (it?.quantityMode === 'PAX' ? (q.people || 1) : 1));
          const price = Number(it?.price || it?.unitPrice || 0);
          return acc + (it?.total ? Number(it.total) : (qty * price));
        }, 0);
        rawTotal = Math.max(0, rawSubtotal - rawDiscount);
      }

      if (rawTotal > 0 && (!q.total || Number(q.total) <= 0)) {
        q.total = rawTotal;
        changed = true;
      }
      if (rawSubtotal > 0 && (!q.subtotal || Number(q.subtotal) <= 0)) {
        q.subtotal = rawSubtotal;
        changed = true;
      }

      const isUsd = String(q.currency || '').trim().toUpperCase() === 'USD';
      const rate = Number(q.exchangeRate) || 7.75;
      const expectedTotalGtq = isUsd ? Math.round(rawTotal * rate * 100) / 100 : rawTotal;
      const expectedSubtotalGtq = isUsd ? Math.round(rawSubtotal * rate * 100) / 100 : rawSubtotal;

      if ((q.totalGtq === undefined || q.totalGtq === null || Number(q.totalGtq) === 0) && expectedTotalGtq > 0) {
        q.totalGtq = expectedTotalGtq;
        changed = true;
      }
      if ((q.subtotalGtq === undefined || q.subtotalGtq === null || Number(q.subtotalGtq) === 0) && expectedSubtotalGtq > 0) {
        q.subtotalGtq = expectedSubtotalGtq;
        changed = true;
      }

      if (changed) {
        await conn.query("UPDATE eventos SET cotizacion_json = ? WHERE id = ?", [JSON.stringify(q), r.id]);
        fixedCount++;
        if (r.id === 'evt_07b6ba46' || fixedCount <= 5) {
          console.log(`[FIXED] Event ${r.id} (${r.nombre}): total=${q.total}, totalGtq=${q.totalGtq}, subtotal=${q.subtotal}`);
        }
      }
    } catch (err) {
      console.warn(`Error parsing event ${r.id}:`, err.message);
    }
  }

  console.log(`Backfill completed successfully. Fixed ${fixedCount} events.`);
  conn.release();
  await pool.end();
}

main().catch(err => {
  console.error('Fatal error in backfill:', err);
  process.exit(1);
});
