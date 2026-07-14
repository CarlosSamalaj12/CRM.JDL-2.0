const mariadb = require('mariadb');
async function main() {
  const pool = mariadb.createPool({
    host: '127.0.0.1', port: 3306, user: 'root', password: 'Xvfv2du1p5xyZX', database: 'crm_jdl', connectTimeout: 10000
  });
  const conn = await pool.getConnection();

  try {
    console.log('=== Analisis ===\n');
    // Get all current IDs
    const all = await conn.query('SELECT id, nombre, id_empresa FROM crm_jdl.encargados_empresa');
    const idSet = new Set(all.map(r => r.id));

    // Find corrupted (nombre is numeric)
    const corrupted = all.filter(r => /^\d+$/.test(String(r.nombre)));
    console.log(`Corruptos: ${corrupted.length}`);
    console.log(`Total IDs en tabla: ${all.length}`);

    // For each corrupted record, after renaming its id to TXT_xxx,
    // the swap will put its nombre (numeric) into id.
    // If that numeric value already exists as an ID -> collision!
    const willCollide = corrupted.filter(r => idSet.has(r.nombre));
    console.log(`Chocaran al swap (nombre ya existe como id): ${willCollide.length}`);
    if (willCollide.length > 0) {
      console.log('\nIDs numericos que ya existen y causaran colision:');
      for (const r of willCollide) {
        console.log(`  "${r.nombre}" ya existe como id. Registro corrupto: id="${r.id}"`);
      }
    }

    // Step 1: Rename CORRUPTED IDs to TMP_ (avoiding TXT_ prefix issue)
    console.log('\n=== STEP 1: Renombrar IDs corruptos a TMP_ ===');
    for (const r of corrupted) {
      const tmpId = `TMP_${r.id}`;
      await conn.query('UPDATE crm_jdl.encargados_empresa SET id = ? WHERE id = ?', [tmpId, r.id]);
    }
    console.log(`  -> ${corrupted.length} renombrados`);

    // Step 2: Rename COLLIDING numeric IDs to NUM_ (they exist as valid IDs)
    console.log('\n=== STEP 2: Renombrar IDs numericos que chocan a NUM_ ===');
    for (const r of willCollide) {
      const tmpId = `NUM_${r.nombre}`;
      await conn.query('UPDATE crm_jdl.encargados_empresa SET id = ? WHERE id = ?', [tmpId, r.nombre]);
      console.log(`  "${r.nombre}" -> "${tmpId}"`);
    }
    console.log(`  -> ${willCollide.length} renombrados`);

    // Step 3: Swap corrupted (TMP_) records
    console.log('\n=== STEP 3: Swap TMP_ records (id <-> nombre) ===');
    const swap1 = await conn.query(`
      UPDATE crm_jdl.encargados_empresa
      SET id = nombre, nombre = id
      WHERE id LIKE 'TMP_%'
    `);
    console.log(`  -> ${swap1.affectedRows} swapados`);

    // Step 4: Swap colliding (now NUM_) records
    console.log('\n=== STEP 4: Swap NUM_ records (id <-> nombre) ===');
    const swap2 = await conn.query(`
      UPDATE crm_jdl.encargados_empresa
      SET id = nombre, nombre = id
      WHERE id LIKE 'NUM_%'
    `);
    console.log(`  -> ${swap2.affectedRows} swapados`);

    // Step 5: Clean prefixes
    console.log('\n=== STEP 5: Limpiar prefijos ===');
    const clean1 = await conn.query(`UPDATE crm_jdl.encargados_empresa SET nombre = SUBSTRING(nombre, 5) WHERE nombre LIKE 'TMP_%'`);
    const clean2 = await conn.query(`UPDATE crm_jdl.encargados_empresa SET nombre = SUBSTRING(nombre, 5) WHERE nombre LIKE 'NUM_%'`);
    console.log(`  TMP_ limpiados del nombre: ${clean1.affectedRows}`);
    console.log(`  NUM_ limpiados del nombre: ${clean2.affectedRows}`);

    // Step 6: JORGE CORTEZ
    console.log('\n=== STEP 6: Fix JORGE CORTEZ ===');
    const jorge = await conn.query(`
      UPDATE crm_jdl.encargados_empresa
      SET id = '2252', id_empresa = '0', nombre = 'JORGE CORTEZ'
      WHERE id = '0' AND nombre = '2252'
    `);
    console.log(`  -> ${jorge.affectedRows} fila(s)`);

    // Step 7: Clean quotes
    console.log('\n=== STEP 7: Limpiar cotizaciones ===');
    const quotes = await conn.query(`
      SELECT COUNT(*) as cnt FROM crm_jdl.cotizaciones_evento
      WHERE id_encargado IN (
        SELECT id FROM crm_jdl.encargados_empresa
        WHERE id LIKE 'TMP_%' OR id LIKE 'NUM_%'
      )
    `);
    console.log(`  Cotizaciones a limpiar: ${quotes[0].cnt}`);
    if (quotes[0].cnt > 0) {
      const cleanQ = await conn.query(`
        UPDATE crm_jdl.cotizaciones_evento
        SET id_encargado = NULL
        WHERE id_encargado IN (
          SELECT id FROM crm_jdl.encargados_empresa
          WHERE id LIKE 'TMP_%' OR id LIKE 'NUM_%'
        )
      `);
      console.log(`  Limpiadas: ${cleanQ.affectedRows}`);
    }

    // Verify
    console.log('\n=== VERIFICACION ===');
    const rem1 = await conn.query("SELECT COUNT(*) as cnt FROM crm_jdl.encargados_empresa WHERE nombre REGEXP '^[0-9]+\$'");
    const rem2 = await conn.query("SELECT COUNT(*) as cnt FROM crm_jdl.encargados_empresa WHERE id LIKE 'TMP_%' OR id LIKE 'NUM_%'");
    console.log(`Corruptos restantes (nombre numerico): ${rem1[0].cnt}`);
    console.log(`Prefijos restantes: ${rem2[0].cnt}`);

    // Show sample of normalized records
    console.log('\n=== Preview: primeros 10 normalizados ===');
    const preview = await conn.query(`
      SELECT id, nombre, id_empresa, telefono
      FROM crm_jdl.encargados_empresa
      WHERE id LIKE 'TMP_%'
      LIMIT 10
    `);
    for (const r of preview) {
      console.log(`  id="${r.id}" | nombre="${r.nombre}" | empresa=${r.id_empresa} | tel=${r.telefono || '-'}`);
    }

  } finally {
    await conn.release();
    await pool.end();
  }
  console.log('\n✅ Done.');
}
main().catch(e => { console.error('ERROR:', e.message, e.stack); process.exit(1); });
