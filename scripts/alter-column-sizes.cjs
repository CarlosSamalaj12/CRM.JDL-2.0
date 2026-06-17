/**
 * Script para reducir columnas VARCHAR de 80/100 a 30 en la BD.
 * Usa SET FOREIGN_KEY_CHECKS = 0 para evitar errores por FK references.
 *
 * Uso: node scripts/alter-column-sizes.cjs
 */

const mariadb = require('mariadb');

const DB_PORT = Number(process.env.DB_PORT || 3306);
const DB_PASSWORD = process.env.DB_PASSWORD || '';

const DB_CONFIG = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: DB_PORT,
  user: process.env.DB_USER || 'root',
  password: DB_PASSWORD,
  database: process.env.DB_NAME || 'crm_jdl',
  collation: 'utf8mb4_unicode_ci',
};

const ALTER_STATEMENTS = [
  // Tablas principales
  { table: 'usuarios', column: 'id', type: 'VARCHAR(30)', nullable: 'NOT NULL' },
  { table: 'empresas', column: 'id', type: 'VARCHAR(30)', nullable: 'NOT NULL' },
  { table: 'encargados_empresa', column: 'id', type: 'VARCHAR(30)', nullable: 'NOT NULL' },
  { table: 'encargados_empresa', column: 'id_empresa', type: 'VARCHAR(30)', nullable: 'NOT NULL' },
  { table: 'eventos', column: 'id', type: 'VARCHAR(30)', nullable: 'NOT NULL' },
  { table: 'eventos', column: 'id_usuario', type: 'VARCHAR(30)', nullable: 'NULL' },
  { table: 'cotizaciones_evento', column: 'id_evento', type: 'VARCHAR(30)', nullable: 'NOT NULL' },
  { table: 'cotizaciones_evento', column: 'id_empresa', type: 'VARCHAR(30)', nullable: 'NULL' },
  { table: 'cotizaciones_evento', column: 'id_encargado', type: 'VARCHAR(30)', nullable: 'NULL' },
  { table: 'items_cotizacion_evento', column: 'id_evento', type: 'VARCHAR(30)', nullable: 'NOT NULL' },
  { table: 'items_cotizacion_evento', column: 'id_servicio', type: 'VARCHAR(30)', nullable: 'NULL' },
  { table: 'historial_evento', column: 'clave_evento', type: 'VARCHAR(30)', nullable: 'NULL' },
  { table: 'historial_evento', column: 'id_usuario_actor', type: 'VARCHAR(30)', nullable: 'NULL' },
  { table: 'recordatorios_evento', column: 'id', type: 'VARCHAR(30)', nullable: 'NOT NULL' },
  { table: 'recordatorios_evento', column: 'clave_evento', type: 'VARCHAR(30)', nullable: 'NOT NULL' },
  { table: 'recordatorios_evento', column: 'id_usuario_creador', type: 'VARCHAR(30)', nullable: 'NULL' },
  { table: 'anticipos_evento', column: 'id', type: 'VARCHAR(30)', nullable: 'NOT NULL' },
  { table: 'anticipos_evento', column: 'id_evento', type: 'VARCHAR(30)', nullable: 'NOT NULL' },
  { table: 'servicios', column: 'id', type: 'VARCHAR(30)', nullable: 'NOT NULL' },
  { table: 'cotizacion_versiones_evento', column: 'id_evento', type: 'VARCHAR(30)', nullable: 'NOT NULL' },
  { table: 'items_cotizacion_version_evento', column: 'id_evento', type: 'VARCHAR(30)', nullable: 'NOT NULL' },
  { table: 'items_cotizacion_version_evento', column: 'id_servicio', type: 'VARCHAR(30)', nullable: 'NULL' },
];

async function main() {
  console.log('🔧 Iniciando migración de columnas VARCHAR(80/100) → VARCHAR(30)...\n');

  let conn;
  try {
    conn = await mariadb.createConnection(DB_CONFIG);

    // Deshabilitar FK checks globalmente para evitar errores por referencias cruzadas
    console.log('🔓 Deshabilitando FOREIGN_KEY_CHECKS...');
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');

    // Eliminar FK constraints específicas que bloquean MODIFY COLUMN en ciertas tablas
    // Consultar dinámicamente todas las FK que referencian las columnas que vamos a modificar
    console.log('  Buscando FK constraints que referencian columnas objetivo...');
    const referencingFks = await conn.query(
      `SELECT kcu.table_name, kcu.constraint_name, kcu.column_name
       FROM information_schema.key_column_usage kcu
       WHERE kcu.referenced_table_schema = ?
         AND kcu.referenced_table_name IN ('usuarios','empresas','eventos')
         AND kcu.referenced_column_name IN ('id')`,
      [DB_CONFIG.database]
    );
    for (const fk of referencingFks) {
      try {
        await conn.query(`ALTER TABLE \`${fk.table_name}\` DROP FOREIGN KEY \`${fk.constraint_name}\``);
        console.log(`  🗑️  FK ${fk.constraint_name} eliminada de ${fk.table_name}.${fk.column_name}`);
      } catch (e) {
        if (!e.message.includes('does not exist')) {
          console.log(`  ⚠️  Error al eliminar FK ${fk.constraint_name} de ${fk.table_name}: ${e.message}`);
        }
      }
    }


    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const stmt of ALTER_STATEMENTS) {
      try {
        // Verificar si la columna existe y su tipo actual
        const current = await conn.query(
          `SELECT column_type, character_maximum_length
           FROM information_schema.columns
           WHERE table_schema = ? AND table_name = ? AND column_name = ?`,
          [DB_CONFIG.database, stmt.table, stmt.column]
        );

        if (current.length === 0) {
          console.log(`  ⏩ ${stmt.table}.${stmt.column}: columna no existe, saltando`);
          skipCount++;
          continue;
        }

        const currentLen = Number(current[0].character_maximum_length);
        const currentType = String(current[0].column_type || '').toLowerCase();
        const targetLen = parseInt(stmt.type.match(/\d+/)?.[0] || '30');

        if (currentLen <= targetLen && !currentType.includes('varchar(100)')) {
          console.log(`  ✅ ${stmt.table}.${stmt.column}: ya es ${currentType} (<= ${targetLen}), saltando`);
          skipCount++;
          continue;
        }

        // Construir y ejecutar ALTER TABLE
        // PRIMARY KEY es un constraint a nivel tabla, se preserva automáticamente
        const alterSql = `ALTER TABLE \`${stmt.table}\` MODIFY COLUMN \`${stmt.column}\` ${stmt.type} ${stmt.nullable}`;
        console.log(`  🔄 ${stmt.table}.${stmt.column}: ${currentType} → ${stmt.type}`);
        await conn.query(alterSql);
        successCount++;
      } catch (err) {
        console.log(`  ❌ ${stmt.table}.${stmt.column}: ERROR - ${err.message}`);
        errorCount++;
      }
    }

    // Re-habilitar FK checks
    console.log('\n🔒 Re-habilitando FOREIGN_KEY_CHECKS...');
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');

    // Verificar estado final de columnas clave
    console.log('\n🔍 Verificación final:');
    const verifyTables = ['eventos', 'usuarios', 'empresas', 'encargados_empresa', 'anticipos_evento', 'servicios', 'recordatorios_evento'];
    for (const table of verifyTables) {
      const cols = await conn.query(
        `SELECT column_name, column_type, character_maximum_length
         FROM information_schema.columns
         WHERE table_schema = ? AND table_name = ? AND (column_name = 'id' OR column_name LIKE 'id_%' OR column_name LIKE '%_id%' OR column_name = 'clave_evento')`,
        [DB_CONFIG.database, table]
      );
      console.log(`  --- ${table} ---`);
      for (const c of cols) {
        const badge = c.character_maximum_length <= 30 ? '✅' : '⚠️';
        console.log(`    ${badge} ${c.column_name}: ${c.column_type} (${c.character_maximum_length} chars)`);
      }
    }

    console.log(`\n📊 Resumen:`);
    console.log(`  ✅ Modificadas: ${successCount}`);
    console.log(`  ⏩ Saltadas: ${skipCount}`);
    console.log(`  ❌ Errores: ${errorCount}`);

    if (errorCount > 0) {
      console.log('\n⚠️  Hubo errores. Revisa los mensajes anteriores.');
      process.exit(1);
    } else {
      console.log('\n✅ Migración completada exitosamente.');
      console.log('\n💡 Las FK constraints se recrearán automáticamente al reiniciar el servidor.');
    }

  } catch (err) {
    console.error('❌ Error de conexión:', err.message);
    process.exit(1);
  } finally {
    if (conn) conn.end();
  }
}

main();
