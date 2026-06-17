/**
 * Script para verificar y recrear FK constraints que pudieron haberse eliminado
 * durante la migración de VARCHAR(80/100) → VARCHAR(30).
 *
 * Basado en las definiciones de db/schema.sql y backend/src/migrations/migrate_informes_tables.sql
 *
 * Uso: node scripts/recreate-fk-constraints.cjs
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

async function main() {
  console.log('🔧 Verificando y recreando FOREIGN KEY constraints...\n');

  let conn;
  try {
    conn = await mariadb.createConnection(DB_CONFIG);

    // 1. Obtener FK existentes
    console.log('🔍 FK existentes en la base de datos:');
    const existingFks = await conn.query(
      `SELECT kcu.table_name, kcu.constraint_name, kcu.column_name,
              kcu.referenced_table_name, kcu.referenced_column_name
       FROM information_schema.key_column_usage kcu
       WHERE kcu.table_schema = ? AND kcu.referenced_table_name IS NOT NULL
       ORDER BY kcu.table_name, kcu.constraint_name`,
      [DB_CONFIG.database]
    );

    const fkSet = new Set();
    for (const fk of existingFks) {
      const key = `${fk.table_name}.${fk.constraint_name} -> ${fk.referenced_table_name}.${fk.referenced_column_name}`;
      fkSet.add(`${fk.table_name}.${fk.column_name}`);
      console.log(`  ✅ ${key}`);
    }
    console.log(`  Total: ${existingFks.length} FK constraints\n`);

    // 2. Definir todas las FK que DEBERÍAN existir (basadas en schema.sql + migraciones backend)
    const expectedFks = [
      // De schema.sql
      { name: 'fk_encargados_empresa', table: 'encargados_empresa', column: 'id_empresa', refTable: 'empresas', refColumn: 'id', onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      { name: 'fk_eventos_usuario', table: 'eventos', column: 'id_usuario', refTable: 'usuarios', refColumn: 'id', onDelete: 'SET NULL', onUpdate: 'CASCADE' },
      { name: 'fk_cotizaciones_evento', table: 'cotizaciones_evento', column: 'id_evento', refTable: 'eventos', refColumn: 'id', onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      { name: 'fk_items_cotizacion_evento', table: 'items_cotizacion_evento', column: 'id_evento', refTable: 'cotizaciones_evento', refColumn: 'id_evento', onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      { name: 'fk_anticipos_evento', table: 'anticipos_evento', column: 'id_evento', refTable: 'eventos', refColumn: 'id', onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      // FK de tablas del módulo de informes que referencian usuarios.id
      // (estas no tienen CONSTRAINT name explícito en el SQL, usaban nombres auto-generados)
      { name: 'fk_informe_comentarios_usuario', table: 'informe_comentarios', column: 'usuario_id', refTable: 'usuarios', refColumn: 'id', onDelete: 'SET NULL', onUpdate: 'CASCADE' },
      { name: 'fk_informe_lecturas_usuario', table: 'informe_lecturas', column: 'usuario_id', refTable: 'usuarios', refColumn: 'id', onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      { name: 'fk_informe_destacados_usuario', table: 'informe_destacados', column: 'usuario_id', refTable: 'usuarios', refColumn: 'id', onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      { name: 'fk_informe_historial_usuario', table: 'informe_historial', column: 'usuario_id', refTable: 'usuarios', refColumn: 'id', onDelete: 'SET NULL', onUpdate: 'CASCADE' },
      { name: 'fk_notificaciones_usuario', table: 'notificaciones', column: 'usuario_id', refTable: 'usuarios', refColumn: 'id', onDelete: 'SET NULL', onUpdate: 'CASCADE' },
      { name: 'fk_event_notas_usuario', table: 'event_notas', column: 'usuario_id', refTable: 'usuarios', refColumn: 'id', onDelete: 'SET NULL', onUpdate: 'CASCADE' },
    ];

    console.log('🔧 Verificando FK faltantes...\n');
    let createdCount = 0;
    let existingCount = 0;
    let errorCount = 0;

    for (const fk of expectedFks) {
      // Verificar si la columna ya tiene una FK
      const key = `${fk.table}.${fk.column}`;
      if (fkSet.has(key)) {
        console.log(`  ✅ ${fk.name} (${key}): ya existe`);
        existingCount++;
        continue;
      }

      // Verificar que la tabla y columnas existan antes de crear
      try {
        const tableCheck = await conn.query(
          `SELECT column_name FROM information_schema.columns
           WHERE table_schema = ? AND table_name = ? AND column_name = ?`,
          [DB_CONFIG.database, fk.table, fk.column]
        );
        if (tableCheck.length === 0) {
          console.log(`  ⏩ ${fk.name} (${key}): tabla/columna no existe, saltando`);
          existingCount++;
          continue;
        }

        const refCheck = await conn.query(
          `SELECT column_name FROM information_schema.columns
           WHERE table_schema = ? AND table_name = ? AND column_name = ?`,
          [DB_CONFIG.database, fk.refTable, fk.refColumn]
        );
        if (refCheck.length === 0) {
          console.log(`  ⏩ ${fk.name}: tabla referenciada ${fk.refTable}.${fk.refColumn} no existe, saltando`);
          existingCount++;
          continue;
        }

        const sql = `ALTER TABLE \`${fk.table}\`
                     ADD CONSTRAINT \`${fk.name}\`
                     FOREIGN KEY (\`${fk.column}\`) REFERENCES \`${fk.refTable}\`(\`${fk.refColumn}\`)
                     ON DELETE ${fk.onDelete} ON UPDATE ${fk.onUpdate}`;

        console.log(`  🔄 ${fk.name} (${key}): creando...`);
        await conn.query(sql);
        console.log(`     ✅ Creada`);
        createdCount++;
      } catch (err) {
        console.log(`  ❌ ${fk.name}: ERROR - ${err.message}`);
        errorCount++;
      }
    }

    console.log(`\n📊 Resumen:`);
    console.log(`  ✅ Ya existían: ${existingCount}`);
    console.log(`  🆕 Creadas: ${createdCount}`);
    console.log(`  ❌ Errores: ${errorCount}`);

    // Verificación final
    console.log('\n🔍 Verificación final de FK:');
    const finalFks = await conn.query(
      `SELECT kcu.table_name, kcu.constraint_name, kcu.column_name,
              kcu.referenced_table_name, kcu.referenced_column_name
       FROM information_schema.key_column_usage kcu
       WHERE kcu.table_schema = ? AND kcu.referenced_table_name IS NOT NULL
       ORDER BY kcu.table_name, kcu.constraint_name`,
      [DB_CONFIG.database]
    );
    for (const fk of finalFks) {
      console.log(`  ✅ ${fk.table_name}.${fk.constraint_name} -> ${fk.referenced_table_name}.${fk.referenced_column_name}`);
    }

  } catch (err) {
    console.error('❌ Error de conexión:', err.message);
    process.exit(1);
  } finally {
    if (conn) conn.end();
  }
}

main();
