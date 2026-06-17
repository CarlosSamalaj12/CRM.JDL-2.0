/**
 * Script final: limpia orphans y crea las 3 FK restantes.
 * Uso: node scripts/final-fk-fix.cjs
 */


const mariadb = require('mariadb');

const DB_CONFIG = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'crm_jdl',
  collation: 'utf8mb4_unicode_ci',
};

async function main() {
  let conn;
  try {
    conn = await mariadb.createConnection(DB_CONFIG);

    // 1. Mostrar orphaned rows antes de limpiar
    console.log('🔍 Orphans en tabla del módulo de informes:');
    const tables = [
      { table: 'informe_comentarios', nullable: true },
      { table: 'informe_historial', nullable: true },
      { table: 'event_notas', nullable: true },
    ];
    for (const t of tables) {
      const orphans = await conn.query(
        `SELECT c.usuario_id, COUNT(*) as cnt
         FROM \`${t.table}\` c
         LEFT JOIN usuarios u ON c.usuario_id = u.id
         WHERE c.usuario_id IS NOT NULL AND u.id IS NULL
         GROUP BY c.usuario_id`
      );
      if (orphans.length) {
        console.log(`\n  ⚠️  ${t.table}:`);
        for (const r of orphans) {
          console.log(`    usuario_id='${r.usuario_id}' — ${r.cnt} fila(s)`);
        }
      } else {
        console.log(`  ✅ ${t.table}: sin huérfanos`);
      }
    }

    // 2. Limpiar orphans: SET NULL (las columnas son NULL-able)
    console.log('\n🔧 Limpiando orphaned rows (SET NULL)...');
    for (const t of tables) {
      const result = await conn.query(
        `UPDATE \`${t.table}\` c
         LEFT JOIN usuarios u ON c.usuario_id = u.id
         SET c.usuario_id = NULL
         WHERE c.usuario_id IS NOT NULL AND u.id IS NULL`
      );
      if (result.affectedRows > 0) {
        console.log(`  ✅ ${t.table}: ${result.affectedRows} fila(s) actualizadas a NULL`);
      } else {
        console.log(`  ℹ️  ${t.table}: sin cambios`);
      }
    }

    // 3. Crear las 3 FK restantes
    console.log('\n🔧 Creando FK constraints...');
    const fks = [
      { name: 'fk_informe_comentarios_usuario', table: 'informe_comentarios', column: 'usuario_id', ref: 'usuarios', refCol: 'id', onDelete: 'SET NULL', onUpdate: 'CASCADE' },
      { name: 'fk_informe_historial_usuario', table: 'informe_historial', column: 'usuario_id', ref: 'usuarios', refCol: 'id', onDelete: 'SET NULL', onUpdate: 'CASCADE' },
      { name: 'fk_event_notas_usuario', table: 'event_notas', column: 'usuario_id', ref: 'usuarios', refCol: 'id', onDelete: 'SET NULL', onUpdate: 'CASCADE' },
    ];

    for (const fk of fks) {
      const existing = await conn.query(
        `SELECT constraint_name FROM information_schema.key_column_usage
         WHERE table_schema = ? AND table_name = ? AND constraint_name = ?`,
        [DB_CONFIG.database, fk.table, fk.name]
      );
      if (existing.length > 0) {
        console.log(`  ✅ ${fk.name}: ya existe`);
        continue;
      }

      const sql = `ALTER TABLE \`${fk.table}\` ADD CONSTRAINT \`${fk.name}\`
                   FOREIGN KEY (\`${fk.column}\`) REFERENCES \`${fk.ref}\`(\`${fk.refCol}\`)
                   ON DELETE ${fk.onDelete} ON UPDATE ${fk.onUpdate}`;
      try {
        console.log(`  🔄 ${fk.name}...`);
        await conn.query(sql);
        console.log(`     ✅ Creada`);
      } catch (err) {
        console.log(`     ❌ ${err.message}`);
      }
    }

    // 4. Verificación final
    console.log('\n🔍 Verificación final de FK:');
    const allFks = await conn.query(
      `SELECT table_name, constraint_name, column_name, referenced_table_name
       FROM information_schema.key_column_usage
       WHERE table_schema = ? AND constraint_name LIKE 'fk_%'
       ORDER BY table_name, constraint_name`,
      [DB_CONFIG.database]
    );
    for (const fk of allFks) {
      console.log(`  ✅ ${fk.table_name}.${fk.constraint_name} (${fk.column_name} → ${fk.referenced_table_name})`);
    }
    console.log(`\n📊 Total: ${allFks.length} FK constraints`);

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    if (conn) conn.end();
  }
}

main();
