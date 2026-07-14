const mariadb = require('mariadb');
async function main() {
  const pool = mariadb.createPool({
    host: '127.0.0.1', port: 3306, user: 'root', password: 'Xvfv2du1p5xyZX', database: 'crm_jdl', connectTimeout: 5000
  });
  const conn = await pool.getConnection();

  try {
    // ================================================================
    // 1. Fix JORGE CORTEZ (caso especial)
    // ================================================================
    console.log('STEP 1: JORGE CORTEZ');
    const jorge = await conn.query(`
      UPDATE crm_jdl.encargados_empresa
      SET id = '2252', id_empresa = '0', nombre = 'JORGE CORTEZ'
      WHERE id = '0' AND nombre = '2252'
    `);
    console.log(`  -> ${jorge.affectedRows} fila(s)`);

    // ================================================================
    // 2. Encontrar corrupted records y sus target IDs (texto -> id)
    // ================================================================
    console.log('\nSTEP 2: Identificar registros corruptos');
    const corrupted = await conn.query(`
      SELECT id, nombre AS text_name, id_empresa
      FROM crm_jdl.encargados_empresa
      WHERE nombre REGEXP '^[0-9]+$' AND id != '0'
    `);
    console.log(`  -> ${corrupted.length} registros corruptos`);

    // Todos los IDs actuales en la tabla
    const allIds = await conn.query('SELECT id FROM crm_jdl.encargados_empresa');
    const existingIds = new Set(allIds.map(r => r.id));

    // Cuantos text_names chocarian con IDs existentes?
    const willCollide = corrupted.filter(r => existingIds.has(r.text_name));
    console.log(`  -> ${willCollide.length} causaran colision de PK al swap`);

    // ================================================================
    // 3. Renombrar IDs que chocarían a IDs temporales
    // ================================================================
    console.log('\nSTEP 3: Renombrar IDs que colisionan');
    for (const r of willCollide) {
      const tmpId = `TXT_${r.id}`;
      await conn.query('UPDATE crm_jdl.encargados_empresa SET id = ? WHERE id = ?', [tmpId, r.id]);
      console.log(`  "${r.id}" -> "${tmpId}"`);
    }
    console.log(`  -> ${willCollide.length} renombrados`);

    // ================================================================
    // 4. Limpiar cotizaciones ANTES del swap
    // ================================================================
    console.log('\nSTEP 4: Limpiar cotizaciones (antes del swap)');
    const quotes = await conn.query(`
      SELECT COUNT(*) as cnt FROM crm_jdl.cotizaciones_evento
      WHERE id_encargado IN (${corrupted.map(r => `'${r.id}'`).join(',')})
    `);
    console.log(`  -> ${quotes[0].cnt} cotizaciones referencian los IDs corruptos`);
    if (quotes[0].cnt > 0) {
      const cleanQ = await conn.query(`
        UPDATE crm_jdl.cotizaciones_evento
        SET id_encargado = NULL
        WHERE id_encargado IN (${corrupted.map(r => `'${r.id}'`).join(',')})
      `);
      console.log(`  -> ${cleanQ.affectedRows} limpiadas`);
    }

    // ================================================================
    // 5. SWAP id <-> nombre para registros corruptos
    // ================================================================
    console.log('\nSTEP 5: Swap id <-> nombre');
    const swap = await conn.query(`
      UPDATE crm_jdl.encargados_empresa
      SET id = nombre, nombre = id
      WHERE nombre REGEXP '^[0-9]+$' AND id != '0'
    `);
    console.log(`  -> ${swap.affectedRows} swapados`);

    // ================================================================
    // 6. Limpiar prefijos TXT_ de los IDs
    // ================================================================
    console.log('\nSTEP 6: Limpiar prefijos TXT_');
    const cleanTxt = await conn.query(`
      UPDATE crm_jdl.encargados_empresa
      SET id = SUBSTRING(id, 5)
      WHERE id LIKE 'TXT_%'
    `);
    console.log(`  -> ${cleanTxt.affectedRows} limpiados`);

    // ================================================================
    // VERIFICACION
    // ================================================================
    console.log('\n=== VERIFICACION ===');
    const rem1 = await conn.query("SELECT COUNT(*) as cnt FROM crm_jdl.encargados_empresa WHERE nombre REGEXP '^[0-9]+\$'");
    console.log(`Corruptos restantes (nombre numerico): ${rem1[0].cnt}`);

    const rem2 = await conn.query("SELECT COUNT(*) as cnt FROM crm_jdl.encargados_empresa WHERE id LIKE 'TXT_%'");
    console.log(`Prefijos TXT_ restantes: ${rem2[0].cnt}`);

    console.log('\n=== Preview: primeros 10 normalizados ===');
    const preview = await conn.query(`
      SELECT id, nombre, id_empresa, telefono
      FROM crm_jdl.encargados_empresa
      WHERE id IN (${corrupted.map(r => `'${r.text_name}'`).join(',')})
      LIMIT 10
    `);
    for (const r of preview) {
      console.log(`  id="${r.id}" | nombre="${r.nombre}" | empresa=${r.id_empresa} | tel=${r.telefono || '-'}`);
    }

  } finally {
    await conn.release();
    await pool.end();
  }
  console.log('\n✅ Proceso completo.');
}
main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
