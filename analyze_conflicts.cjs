const mariadb = require('mariadb');
async function main() {
  const pool = mariadb.createPool({
    host: '127.0.0.1', port: 3306, user: 'root', password: 'Xvfv2du1p5xyZX', database: 'crm_jdl', connectTimeout: 5000
  });
  const conn = await pool.getConnection();

  try {
    const all = await conn.query('SELECT id, nombre, id_empresa, telefono FROM crm_jdl.encargados_empresa');
    const idSet = new Set(all.map(r => r.id));

    const corrupted = all.filter(r => /^\d+$/.test(String(r.nombre)));
    const valid = all.filter(r => !/^\d+$/.test(String(r.nombre)));

    console.log('=== ANALISIS ===\n');
    console.log(`Total registros: ${all.length}`);
    console.log(`Corruptos (nombre es numerico): ${corrupted.length}`);
    console.log(`Validos: ${valid.length}\n`);

    // For each corrupted record, check if its numeric ID already exists
    const withCollision = [];
    const withoutCollision = [];
    for (const r of corrupted) {
      if (idSet.has(String(r.nombre))) {
        withCollision.push(r);
      } else {
        withoutCollision.push(r);
      }
    }

    console.log(`Con colision (su ID numerico ya existe): ${withCollision.length}`);
    console.log(`Sin colision (se puede swapear directo): ${withoutCollision.length}\n`);

    if (withoutCollision.length > 0) {
      console.log('=== SIN COLISION - SE PUEDEN SWAPEAR ===');
      for (const r of withoutCollision) {
        console.log(`  id="${r.id}" -> nombre="${r.nombre}" | empresa=${r.id_empresa}`);
      }
    }

    if (withCollision.length > 0) {
      console.log('\n=== CON COLISION - EL ID NUMERICO YA EXISTE ===');
      console.log('Cada registro corrupto tiene un ID numerico que YA existe como registro valido.');
      console.log('Esto significa que hay 2 registros para la MISMA empresa.\n');
      for (const r of withCollision) {
        const match = valid.find(v => v.id === r.nombre);
        console.log(`  CORRUPTO: id="${r.id}" | nombre="${r.nombre}" | empresa=${r.id_empresa}`);
        console.log(`  EXISTE:   id="${r.nombre}" | nombre="${match?.nombre || '?'}" | empresa=${match?.id_empresa || '?'}`);
        console.log('  ---');
      }
    }

    console.log('\n=== OPCIONES ===');
    console.log('1. Para los SIN colision: UPDATE directo para swapear');
    console.log('2. Para los CON colision: Merge o eliminar el corrupto');

  } finally {
    await conn.release();
    await pool.end();
  }
}
main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
