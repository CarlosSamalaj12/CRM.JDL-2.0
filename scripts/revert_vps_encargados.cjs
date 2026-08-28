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

    // 1. Eliminar cualquier encargado generado automáticamente
    const delMgr = await conn.query("DELETE FROM encargados_empresa WHERE id LIKE 'mgr_%_1'");
    console.log(`✅ Encargados autogenerados eliminados: ${delMgr.affectedRows || 0}`);

    // 2. Obtener lista de encargados legítimos que los usuarios crearon
    const legitManagers = await conn.query(
      "SELECT id, id_empresa, nombre FROM encargados_empresa WHERE id NOT LIKE 'mgr_%_1' ORDER BY creado_en ASC"
    );
    console.log(`ℹ️ Encargados legítimos encontrados en la BD: ${legitManagers.length}`);

    // Crear mapa de empresa -> encargado legítimo
    const legitByCompany = new Map();
    for (const m of legitManagers) {
      if (m.id_empresa && !legitByCompany.has(String(m.id_empresa))) {
        legitByCompany.set(String(m.id_empresa), m.nombre);
      }
    }

    const legitCompanyIds = Array.from(legitByCompany.keys());
    console.log(`ℹ️ Empresas con encargado legítimo: ${legitCompanyIds.length}`);

    // 3. Restaurar a NULL todas las empresas que NO tienen encargado legítimo
    let resetSql = "UPDATE empresas SET encargado_principal = NULL";
    if (legitCompanyIds.length > 0) {
      const quotedIds = legitCompanyIds.map(id => `'${id}'`).join(',');
      resetSql += ` WHERE id NOT IN (${quotedIds})`;
    }
    const resetRes = await conn.query(resetSql);
    console.log(`✅ Empresas restauradas a NULL (sin encargado erróneo): ${resetRes.affectedRows || 0}`);

    // 4. Restaurar el nombre original del encargado legítimo en las empresas que sí lo tenían
    let restoredLegitCount = 0;
    for (const [companyId, managerName] of legitByCompany.entries()) {
      await conn.query("UPDATE empresas SET encargado_principal = ? WHERE id = ?", [managerName, companyId]);
      restoredLegitCount++;
    }
    console.log(`✅ Empresas legítimas confirmadas con su encargado original: ${restoredLegitCount}`);

    // 5. Eliminar items de cotizaciones duplicados con sufijos multislot si existen
    const delItems = await conn.query("DELETE FROM items_cotizacion_evento WHERE id_evento LIKE '%_s%'");
    console.log(`✅ Items duplicados multislot eliminados: ${delItems.affectedRows || 0}`);

    console.log('\n========================================');
    console.log('🎉 ¡REVERSIÓN COMPLETADA EXITOSAMENTE!');
    console.log('========================================');
  } catch (err) {
    console.error('❌ Error ejecutando reversión:', err);
  } finally {
    if (conn) conn.release();
    await pool.end();
  }
}

main();
