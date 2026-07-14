const mariadb = require('mariadb');
async function main() {
  const pool = mariadb.createPool({
    host: '127.0.0.1', port: 3306, user: 'root', password: 'Xvfv2du1p5xyZX', database: 'crm_jdl', connectTimeout: 5000
  });
  const conn = await pool.getConnection();

  try {
    console.log('=== Analizando colisiones ===\n');
    // Find all current IDs
    const allIds = await conn.query('SELECT id FROM crm_jdl.encargados_empresa');
    const existingIds = new Set(allIds.map(r => r.id));

    // Find corrupted records (nombre is numeric)
    const corrupted = await conn.query(`
      SELECT id, nombre AS numeric_id, id_empresa
      FROM crm_jdl.encargados_empresa
      WHERE nombre REGEXP '^[0-9]+$'
    `);

    // Check which text names would collide
    const colliding = [];
    const noCollision = [];
    for (const r of corrupted) {
      if (existingIds.has(r.id)) {
        colliding.push(r);
      } else {
        noCollision.push(r);
      }
    }

    console.log(`Total corruptos: ${corrupted.length}`);
    console.log(`Con colision (id ya existe): ${colliding.length}`);
    console.log(`Sin colision: ${noCollision.length}`);
    if (colliding.length > 0) {
      console.log('\nIDs que ya existen y causan colision:');
      for (const r of colliding) {
        console.log(`  id="${r.id}" | numeric_id="${r.numeric_id}"`);
      }
    }

    console.log('\n=== EJECUTANDO FIX ===\n');

    // STEP 1: Fix JORGE CORTEZ
    const jorge = await conn.query(`
      UPDATE crm_jdl.encargados_empresa
      SET id = nombre, id_empresa = '0', nombre = 'JORGE CORTEZ'
      WHERE id = '0' AND nombre = '2252'
    `);
    console.log(`STEP 1 - JORGE CORTEZ: ${jorge.affectedRows} fila(s)`);

    // STEP 2: Mover IDs a temp (TODOS, incluyendo los que chocan)
    const toTemp = await conn.query(`
      UPDATE crm_jdl.encargados_empresa
      SET id = CONCAT('BAD_', nombre)
      WHERE nombre REGEXP '^[0-9]+$' AND id != '0'
    `);
    console.log(`STEP 2 - IDs a temp (BAD_): ${toTemp.affectedRows} fila(s)`);

    // STEP 3: Renombrar ids que chocan con TXT_ primero
    for (const r of colliding) {
      const newId = `TXT_${r.id}`;
      await conn.query(`
        UPDATE crm_jdl.encargados_empresa
        SET id = ?
        WHERE id = ?
      `, [newId, r.id]);
    }
    console.log(`STEP 3 - Colisiones renombradas a TXT_: ${colliding.length} fila(s)`);

    // STEP 4: Swap id <-> nombre
    const swap = await conn.query(`
      UPDATE crm_jdl.encargados_empresa
      SET id = nombre, nombre = id
      WHERE id LIKE 'BAD_%'
    `);
    console.log(`STEP 4 - Swap completado: ${swap.affectedRows} fila(s)`);

    // STEP 5: Limpiar prefijos BAD_ del nombre
    const cleanBad = await conn.query(`
      UPDATE crm_jdl.encargados_empresa
      SET nombre = SUBSTRING(nombre, 5)
      WHERE nombre LIKE 'BAD_%'
    `);
    console.log(`STEP 5 - BAD_ limpiado del nombre: ${cleanBad.affectedRows} fila(s)`);

    // STEP 6: Limpiar TXT_ de ids (ya no choca porque el swap movio los old ids a BAD_)
    const cleanTxt = await conn.query(`
      UPDATE crm_jdl.encargados_empresa
      SET id = SUBSTRING(id, 5)
      WHERE id LIKE 'TXT_%'
    `);
    console.log(`STEP 6 - TXT_ limpiado del id: ${cleanTxt.affectedRows} fila(s)`);

    // STEP 7: Limpiar cotizaciones
    const quotes = await conn.query(`
      SELECT COUNT(*) as cnt FROM crm_jdl.cotizaciones_evento
      WHERE id_encargado IN (
        SELECT id FROM crm_jdl.encargados_empresa WHERE id LIKE 'BAD_%'
      )
    `);
    console.log(`\nSTEP 7 - Cotizaciones a limpiar: ${quotes[0].cnt}`);
    if (quotes[0].cnt > 0) {
      const cleanQ = await conn.query(`
        UPDATE crm_jdl.cotizaciones_evento
        SET id_encargado = NULL
        WHERE id_encargado IN (
          SELECT id FROM crm_jdl.encargados_empresa WHERE id LIKE 'BAD_%'
        )
      `);
      console.log(`Cotizaciones limpiadas: ${cleanQ.affectedRows}`);
    }

    console.log('\n=== VERIFICACION ===');
    const rem1 = await conn.query("SELECT COUNT(*) as cnt FROM crm_jdl.encargados_empresa WHERE nombre REGEXP '^[0-9]+\$'");
    const rem2 = await conn.query("SELECT COUNT(*) as cnt FROM crm_jdl.encargados_empresa WHERE id LIKE 'BAD_%' OR id LIKE 'TXT_%'");
    console.log(`Corruptos restantes (nombre numerico): ${rem1[0].cnt}`);
    console.log(`Prefijos BAD_/TXT_ restantes: ${rem2[0].cnt}`);

    console.log('\n=== Preview: primeros 10 registros ===');
    const preview = await conn.query(`
      SELECT id, nombre, id_empresa, telefono
      FROM crm_jdl.encargados_empresa
      WHERE nombre REGEXP '^[0-9]+$'
      LIMIT 10
    `);
    for (const r of preview) {
      console.log(`  id="${r.id}" | nombre="${r.nombre}" | empresa=${r.id_empresa}`);
    }

  } finally {
    await conn.release();
    await pool.end();
  }
  console.log('\n✅ Done.');
}
main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
