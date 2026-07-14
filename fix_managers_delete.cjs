const mariadb = require('mariadb');
async function main() {
  const pool = mariadb.createPool({
    host: '127.0.0.1', port: 3306, user: 'root', password: 'Xvfv2du1p5xyZX', database: 'crm_jdl', connectTimeout: 10000
  });
  const conn = await pool.getConnection();

  try {
    console.log('=== STEP 1: Contar corruptos ===');
    const count = await conn.query("SELECT COUNT(*) as cnt FROM crm_jdl.encargados_empresa WHERE nombre REGEXP '^[0-9]+\$' AND id != '0'");
    console.log(`  Corruptos a borrar: ${count[0].cnt}`);

    console.log('\n=== STEP 2: Limpiar cotizaciones ===');
    const q1 = await conn.query(`
      SELECT COUNT(*) as cnt FROM crm_jdl.cotizaciones_evento
      WHERE id_encargado IN (SELECT id FROM crm_jdl.encargados_empresa WHERE nombre REGEXP '^[0-9]+\$' AND id != '0')
    `);
    console.log(`  Cotizaciones a limpiar: ${q1[0].cnt}`);
    if (q1[0].cnt > 0) {
      const q2 = await conn.query(`
        UPDATE crm_jdl.cotizaciones_evento
        SET id_encargado = NULL
        WHERE id_encargado IN (
          SELECT id FROM crm_jdl.encargados_empresa WHERE nombre REGEXP '^[0-9]+\$' AND id != '0'
        )
      `);
      console.log(`  Limpiadas: ${q2.affectedRows}`);
    }

    console.log('\n=== STEP 3: Fix JORGE CORTEZ ===');
    const j = await conn.query(`
      UPDATE crm_jdl.encargados_empresa
      SET id = '2252', id_empresa = '0', nombre = 'JORGE CORTEZ'
      WHERE id = '0' AND nombre = '2252'
    `);
    console.log(`  -> ${j.affectedRows}`);

    console.log('\n=== STEP 4: Borrar 57 corruptos ===');
    const d = await conn.query(`
      DELETE FROM crm_jdl.encargados_empresa
      WHERE nombre REGEXP '^[0-9]+\$' AND id != '0'
    `);
    console.log(`  Borrados: ${d.affectedRows}`);

    console.log('\n=== VERIFICACION ===');
    const rem = await conn.query("SELECT COUNT(*) as cnt FROM crm_jdl.encargados_empresa WHERE nombre REGEXP '^[0-9]+\$'");
    console.log(`Corruptos restantes: ${rem[0].cnt}`);

    console.log('\n=== Encargados validos restantes ===');
    const remaining = await conn.query(`
      SELECT id, nombre, id_empresa, telefono
      FROM crm_jdl.encargados_empresa
      WHERE nombre NOT REGEXP '^[0-9]+\$'
      ORDER BY nombre
      LIMIT 20
    `);
    for (const r of remaining) {
      console.log(`  id="${r.id}" | "${r.nombre}" | empresa=${r.id_empresa} | tel=${r.telefono || '-'}`);
    }

  } finally {
    await conn.release();
    await pool.end();
  }
  console.log('\n✅ Done.');
}
main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
