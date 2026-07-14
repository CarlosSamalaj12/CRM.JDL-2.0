const mariadb = require('mariadb');
async function main() {
  const pool = mariadb.createPool({
    host: '127.0.0.1', port: 3306, user: 'root', password: 'Xvfv2du1p5xyZX', database: 'crm_jdl', connectTimeout: 5000
  });
  const conn = await pool.getConnection();

  try {
    console.log('=== PASO 1: Corregir caso especial JORGE CORTEZ ===');
    const jorge = await conn.query(`
      UPDATE crm_jdl.encargados_empresa
      SET id = nombre, id_empresa = '0', nombre = 'JORGE CORTEZ'
      WHERE id = '0' AND nombre = '2252'
    `);
    console.log(`JORGE CORTEZ corregido: ${jorge.affectedRows} fila(s)`);

    console.log('\n=== PASO 2: Mover IDs corruptos a valores temporales ===');
    // Move numeric IDs to temp column (id -> "BAD_" + numeric)
    const toTemp = await conn.query(`
      UPDATE crm_jdl.encargados_empresa
      SET id = CONCAT('BAD_', nombre)
      WHERE nombre REGEXP '^[0-9]+$' AND id != '0'
    `);
    console.log(`IDs movidos a temporales: ${toTemp.affectedRows} fila(s)`);

    console.log('\n=== PASO 3: Swap id <-> nombre (ya no hay colision) ===');
    // Now swap: id = "BAD_1234", nombre = "BODA XXX"  ->  id = "BODA XXX", nombre = "BAD_1234"
    const swap = await conn.query(`
      UPDATE crm_jdl.encargados_empresa
      SET id = nombre, nombre = id
      WHERE id LIKE 'BAD_%'
    `);
    console.log(`Swap realizados: ${swap.affectedRows} fila(s)`);

    console.log('\n=== PASO 4: Limpiar prefijos BAD_ ===');
    // nombre = "BAD_1234" -> "1234"
    const clean = await conn.query(`
      UPDATE crm_jdl.encargados_empresa
      SET nombre = SUBSTRING(nombre, 5)
      WHERE nombre LIKE 'BAD_%'
    `);
    console.log(`Prefijos limpiados: ${clean.affectedRows} fila(s)`);

    console.log('\n=== PASO 5: Limpiar cotizaciones_evento.id_encargado ===');
    const quotes = await conn.query(`
      SELECT COUNT(*) as cnt FROM crm_jdl.cotizaciones_evento
      WHERE id_encargado IN (
        SELECT id FROM crm_jdl.encargados_empresa
        WHERE id LIKE 'BAD_%'
      )
    `);
    console.log(`Cotizaciones a limpiar: ${quotes[0].cnt}`);

    if (quotes[0].cnt > 0) {
      const cleanQuotes = await conn.query(`
        UPDATE crm_jdl.cotizaciones_evento
        SET id_encargado = NULL
        WHERE id_encargado IN (
          SELECT id FROM crm_jdl.encargados_empresa WHERE id LIKE 'BAD_%'
        )
      `);
      console.log(`Cotizaciones limpiadas: ${cleanQuotes.affectedRows}`);
    }

    console.log('\n=== VERIFICACION ===');
    const remaining = await conn.query("SELECT COUNT(*) as cnt FROM crm_jdl.encargados_empresa WHERE nombre REGEXP '^[0-9]+\$'");
    console.log(`Corruptos restantes (nombre numerico): ${remaining[0].cnt}`);

    const badIds = await conn.query("SELECT COUNT(*) as cnt FROM crm_jdl.encargados_empresa WHERE id LIKE 'BAD_%'");
    console.log(`IDs temporales restantes: ${badIds[0].cnt}`);

    console.log('\n=== Preview: proximos 10 registros normalizados ===');
    const corruptIds = await conn.query(`
      SELECT id, nombre, id_empresa, telefono
      FROM crm_jdl.encargados_empresa
      WHERE id IN (
        SELECT id FROM crm_jdl.encargados_empresa WHERE nombre REGEXP '^[0-9]+$'
      )
      LIMIT 10
    `);
    for (const r of corruptIds) {
      console.log(`  id="${r.id}" | nombre="${r.nombre}" | empresa=${r.id_empresa} | tel=${r.telefono || '-'}`);
    }

  } finally {
    await conn.release();
    await pool.end();
  }

  console.log('\n✅ Proceso completo. Reinicia el servidor para recargar el state desde la DB.');
}
main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
