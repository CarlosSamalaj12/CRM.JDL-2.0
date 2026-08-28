const path = require('path');
const mariadb = require('mariadb');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = mariadb.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'crm_jdl',
});

async function main() {
  let conn;
  try {
    conn = await pool.getConnection();
    console.log('Conectado a la base de datos...');

    const delItems = await conn.query("DELETE FROM items_cotizacion_evento WHERE id_evento LIKE '%_s%'");
    console.log(`✅ Items duplicados multislot eliminados: ${delItems.affectedRows || 0}`);

    const delMgr = await conn.query("DELETE FROM encargados_empresa WHERE id LIKE 'mgr_%_1'");
    console.log(`✅ Encargados generados eliminados: ${delMgr.affectedRows || 0}`);

    const legit = await conn.query("SELECT DISTINCT id_empresa FROM encargados_empresa WHERE id NOT LIKE 'mgr_%_1'");
    const legitIds = legit.map(e => `'${e.id_empresa}'`).filter(Boolean).join(',');

    let sql = "UPDATE empresas SET encargado_principal = NULL";
    if (legitIds && legitIds.length > 0) {
      sql += ` WHERE id NOT IN (${legitIds})`;
    }
    const updEmp = await conn.query(sql);
    console.log(`✅ Empresas restauradas a NULL: ${updEmp.affectedRows || 0}`);

    console.log('\n🎉 ¡Limpieza completada con éxito en el VPS!');
  } catch (err) {
    console.error('❌ Error ejecutando script:', err);
  } finally {
    if (conn) conn.release();
    await pool.end();
  }
}

main();
