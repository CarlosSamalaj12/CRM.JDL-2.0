// Script standalone: genera managers para empresas con encargado_principal
// legacy. Idempotente: si la empresa ya tiene managers, no hace nada.
//
// Ejecutar con: node migrate_managers.cjs

const mariadb = require('mariadb');

const DB_HOST = process.env.DB_HOST || '127.0.0.1';
const DB_PORT = Number(process.env.DB_PORT || 3306);
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || 'Xvfv2du1p5xyZX';
const DB_NAME = process.env.DB_NAME || 'crm_jdl';

async function main() {
  const conn = await mariadb.createConnection({
    host: DB_HOST, port: DB_PORT, user: DB_USER, password: DB_PASSWORD, database: DB_NAME,
  });

  try {
    console.log('[MIGRATION] Buscando empresas con encargado_principal pero sin managers...');
    const rows = await conn.query(`
      SELECT e.id, e.nombre, e.encargado_principal, e.correo, e.telefono, e.direccion
      FROM empresas e
      LEFT JOIN (
        SELECT id_empresa, COUNT(*) AS total
        FROM encargados_empresa
        GROUP BY id_empresa
      ) m ON m.id_empresa = e.id
      WHERE e.encargado_principal IS NOT NULL
        AND TRIM(e.encargado_principal) <> ''
        AND (m.total IS NULL OR m.total = 0)
      ORDER BY e.id
    `);
    console.log(`[MIGRATION] Encontradas: ${rows.length}`);

    if (rows.length === 0) {
      console.log('[MIGRATION] Nada que migrar. Saliendo.');
      return;
    }

    let inserted = 0;
    let errors = 0;
    for (const row of rows) {
      const companyId = String(row.id || '').trim();
      if (!companyId) continue;
      const managerName = String(row.encargado_principal || '').trim();
      if (!managerName) continue;
      const managerId = `mgr_mig_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      try {
        await conn.query(
          `INSERT INTO encargados_empresa
            (id, id_empresa, nombre, telefono, correo, direccion)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            managerId,
            companyId,
            managerName,
            String(row.telefono || '').trim() || null,
            String(row.correo || '').trim() || null,
            String(row.direccion || '').trim() || null,
          ]
        );
        inserted++;
        process.stdout.write(`\r[MIGRATION] Progreso: ${inserted}/${rows.length} (${Math.round(inserted * 100 / rows.length)}%)`);
      } catch (err) {
        errors++;
        console.error(`\n[MIGRATION] Error insertando manager para ${row.nombre} (${companyId}): ${err.message}`);
      }
    }
    console.log(`\n[MIGRATION] Listo. Insertados: ${inserted}, errores: ${errors}`);

    // Resumen final
    const total = await conn.query('SELECT COUNT(*) as total FROM encargados_empresa');
    console.log(`[MIGRATION] Total managers en BD ahora: ${total[0].total}`);

    const sinMgr = await conn.query(`
      SELECT COUNT(*) as total
      FROM empresas e
      WHERE NOT EXISTS (SELECT 1 FROM encargados_empresa ee WHERE ee.id_empresa = e.id)
    `);
    console.log(`[MIGRATION] Empresas SIN manager: ${sinMgr[0].total}`);

    const huerfanos = await conn.query(`
      SELECT COUNT(*) as total
      FROM encargados_empresa ee
      LEFT JOIN empresas e ON e.id = ee.id_empresa
      WHERE e.id IS NULL
    `);
    console.log(`[MIGRATION] Encargados huerfanos: ${huerfanos[0].total}`);
  } finally {
    await conn.end();
  }
}

main().catch(err => {
  console.error('[MIGRATION] Error fatal:', err.message);
  process.exit(1);
});
