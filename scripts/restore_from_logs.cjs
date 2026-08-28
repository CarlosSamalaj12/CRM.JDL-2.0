const path = require('path');
const fs = require('fs');
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
    console.log('--- 1. CONEXION EXITOSA A MARIADB ---');

    // 1. Verificar cotizaciones_evento
    const quotesCount = await conn.query("SELECT COUNT(*) as c FROM cotizaciones_evento WHERE nombre_encargado IS NOT NULL AND nombre_encargado != ''");
    console.log(`ℹ️ Cotizaciones con encargado histórico intacto: ${quotesCount[0].c}`);

    // 2. Eliminar encargados autogenerados de la tabla encargados_empresa
    const delMgr = await conn.query("DELETE FROM encargados_empresa WHERE id LIKE 'mgr_%_1'");
    console.log(`✅ Encargados autogenerados eliminados: ${delMgr.affectedRows || 0}`);

    // 3. Obtener encargados legítimos que existían originalmente
    const legitManagers = await conn.query(
      "SELECT id, id_empresa, nombre FROM encargados_empresa WHERE id NOT LIKE 'mgr_%_1' ORDER BY creado_en ASC"
    );
    console.log(`ℹ️ Encargados legítimos encontrados: ${legitManagers.length}`);

    const legitByCompany = new Map();
    for (const m of legitManagers) {
      if (m.id_empresa && !legitByCompany.has(String(m.id_empresa))) {
        legitByCompany.set(String(m.id_empresa), m.nombre);
      }
    }

    const legitCompanyIds = Array.from(legitByCompany.keys());

    // 4. Restaurar a NULL las empresas que NO tenían encargado antes
    let resetSql = "UPDATE empresas SET encargado_principal = NULL";
    if (legitCompanyIds.length > 0) {
      const quotedIds = legitCompanyIds.map(id => `'${id}'`).join(',');
      resetSql += ` WHERE id NOT IN (${quotedIds})`;
    }
    const resetRes = await conn.query(resetSql);
    console.log(`✅ Empresas restauradas a NULL (su estado original sin encargado inventado): ${resetRes.affectedRows || 0}`);

    // 5. Restaurar el nombre de las que SÍ tenían encargado legítimo
    let restoredLegit = 0;
    for (const [companyId, managerName] of legitByCompany.entries()) {
      await conn.query("UPDATE empresas SET encargado_principal = ? WHERE id = ?", [managerName, companyId]);
      restoredLegit++;
    }
    console.log(`✅ Empresas legítimas restauradas con su encargado exacto: ${restoredLegit}`);

    // 6. Eliminar items de cotizaciones duplicados con sufijo _s si existen
    const delItems = await conn.query("DELETE FROM items_cotizacion_evento WHERE id_evento LIKE '%_s%'");
    console.log(`✅ Items duplicados multislot eliminados: ${delItems.affectedRows || 0}`);

    console.log('\n======================================================');
    console.log('🎉 BASE DE DATOS RESTAURADA A SU ESTADO EXACTO PREVIO');
    console.log('======================================================');
  } catch (err) {
    console.error('❌ Error durante la restauración:', err);
  } finally {
    if (conn) conn.release();
    await pool.end();
  }
}

main();
