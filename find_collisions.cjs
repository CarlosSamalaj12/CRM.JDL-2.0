const mariadb = require('mariadb');
async function main() {
  const pool = mariadb.createPool({
    host: '127.0.0.1', port: 3306, user: 'root', password: 'Xvfv2du1p5xyZX', database: 'crm_jdl', connectTimeout: 5000
  });
  const conn = await pool.getConnection();
  const allIds = await conn.query('SELECT id FROM crm_jdl.encargados_empresa');
  const existingIds = new Set(allIds.map(r => r.id));

  const corrupted = await conn.query(`
    SELECT id, nombre AS text_name, id_empresa
    FROM crm_jdl.encargados_empresa
    WHERE nombre REGEXP '^[0-9]+$' AND id != '0'
  `);

  const colliding = corrupted.filter(r => existingIds.has(r.text_name));
  console.log(`Colisiones (${colliding.length}):`);
  for (const r of colliding) {
    console.log(`  UPDATE crm_jdl.encargados_empresa SET id = 'TXT_${r.id}' WHERE id = '${r.id}';`);
  }

  await conn.release();
  await pool.end();
}
main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
