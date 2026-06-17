/**
 * Script para diagnosticar y resolver los errores restantes de FK:
 * - Error 1005 (errno: 150) en informe_comentarios, informe_historial, event_notas
 * - Error 1452 en informe_lecturas, notificaciones
 *
 * Uso: node scripts/fix-remaining-fks.cjs
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
  console.log('🔧 Diagnosticando errores de FK restantes...\n');

  let conn;
  try {
    conn = await mariadb.createConnection(DB_CONFIG);

    // 1. Diagnosticar charset/collation de las columnas involucradas
    console.log('🔍 1. Verificando charset y collation de las columnas...\n');

    const affectedTables = [
      { table: 'informe_comentarios', column: 'usuario_id' },
      { table: 'informe_lecturas', column: 'usuario_id' },
      { table: 'informe_destacados', column: 'usuario_id' },
      { table: 'informe_historial', column: 'usuario_id' },
      { table: 'notificaciones', column: 'usuario_id' },
      { table: 'event_notas', column: 'usuario_id' },
    ];

    const colInfo = await conn.query(
      `SELECT table_name, column_name, column_type, character_set_name, collation_name, is_nullable
       FROM information_schema.columns
       WHERE table_schema = ? AND table_name IN (?) AND column_name = ?`,
      [DB_CONFIG.database, affectedTables.map(t => t.table), 'usuario_id']
    );
    for (const c of colInfo) {
      console.log(`  ${c.table_name}.${c.column_name}: ${c.column_type} | charset=${c.character_set_name} | collation=${c.collation_name} | nullable=${c.is_nullable}`);
    }

    // También verificar usuarios.id
    const refCol = await conn.query(
      `SELECT table_name, column_name, column_type, character_set_name, collation_name
       FROM information_schema.columns
       WHERE table_schema = ? AND table_name = 'usuarios' AND column_name = 'id'`,
      [DB_CONFIG.database]
    );
    for (const c of refCol) {
      console.log(`  usuarios.id: ${c.column_type} | charset=${c.character_set_name} | collation=${c.collation_name}`);
    }

    // 2. Verificar orphaned rows en informe_lecturas (usuario_id NOT NULL)
    console.log('\n🔍 2. Buscando orphaned rows en informe_lecturas...');
    const orphanLecturas = await conn.query(
      `SELECT DISTINCT l.usuario_id
       FROM informe_lecturas l
       LEFT JOIN usuarios u ON l.usuario_id = u.id
       WHERE u.id IS NULL`
    );
    if (orphanLecturas.length) {
      console.log(`  ⚠️  ${orphanLecturas.length} usuario_id(s) huérfano(s) en informe_lecturas:`);
      for (const r of orphanLecturas) {
        console.log(`    - '${r.usuario_id}'`);
      }
    } else {
      console.log('  ✅ No hay huérfanos en informe_lecturas');
    }

    // 3. Verificar orphaned rows en notificaciones
    console.log('\n🔍 3. Buscando orphaned rows en notificaciones...');
    const orphanNotif = await conn.query(
      `SELECT DISTINCT n.usuario_id
       FROM notificaciones n
       LEFT JOIN usuarios u ON n.usuario_id = u.id
       WHERE n.usuario_id IS NOT NULL AND u.id IS NULL`
    );
    if (orphanNotif.length) {
      console.log(`  ⚠️  ${orphanNotif.length} usuario_id(s) huérfano(s) en notificaciones:`);
      for (const r of orphanNotif) {
        console.log(`    - '${r.usuario_id}'`);
      }
    } else {
      console.log('  ✅ No hay huérfanos en notificaciones');
    }

    // 4. Verificar otros posibles orphaned rows en las demás tablas
    console.log('\n🔍 4. Verificando más orphaned rows...');
    const checkTables = [
      { table: 'informe_comentarios', column: 'usuario_id', nullable: true },
      { table: 'informe_historial', column: 'usuario_id', nullable: true },
      { table: 'event_notas', column: 'usuario_id', nullable: true },
      { table: 'informe_destacados', column: 'usuario_id', nullable: false },
    ];
    for (const t of checkTables) {
      const orphans = await conn.query(
        `SELECT DISTINCT c.${t.column}
         FROM \`${t.table}\` c
         LEFT JOIN usuarios u ON c.${t.column} = u.id
         WHERE c.${t.column} IS NOT NULL AND u.id IS NULL`
      );
      if (orphans.length) {
        console.log(`  ⚠️  ${t.table}.${t.column}: ${orphans.length} huérfano(s)`);
        for (const r of orphans) {
          const val = r[Object.keys(r)[0]];
          console.log(`    - '${val}'`);
        }
      } else {
        console.log(`  ✅ ${t.table}.${t.column}: sin huérfanos`);
      }
    }

    // 5. Si hay orphaned rows en informe_lecturas o notificaciones, ofrecer soluciones
    const fixActions = [];

    // Para informe_lecturas: eliminar las filas huérfanas (CASCADE no funcionará con datos inválidos)
    if (orphanLecturas.length) {
      console.log('\n🔧 5. Eliminando filas huérfanas en informe_lecturas...');
      const del = await conn.query(
        `DELETE FROM informe_lecturas
         WHERE usuario_id IN (SELECT l.usuario_id FROM informe_lecturas l LEFT JOIN usuarios u ON l.usuario_id = u.id WHERE u.id IS NULL)`
      );
      console.log(`  Eliminadas ${del.affectedRows} filas`);
    }

    if (orphanNotif.length) {
      console.log('\n🔧 6. Actualizando usuario_id a NULL en notificaciones (SET NULL)...');
      for (const r of orphanNotif) {
        if (r.usuario_id !== null) {
          const upd = await conn.query(
            `UPDATE notificaciones SET usuario_id = NULL WHERE usuario_id = ?`,
            [r.usuario_id]
          );
          console.log(`  Actualizadas ${upd.affectedRows} filas con usuario_id='${r.usuario_id}' → NULL`);
        }
      }
    }

    // 7. Reintentar crear las FK faltantes
    console.log('\n🔧 7. Reintentando crear FK constraints...\n');

    const remainingFks = [
      { name: 'fk_informe_comentarios_usuario', table: 'informe_comentarios', column: 'usuario_id', ref: 'usuarios', refCol: 'id', onDelete: 'SET NULL', onUpdate: 'CASCADE' },
      { name: 'fk_informe_lecturas_usuario', table: 'informe_lecturas', column: 'usuario_id', ref: 'usuarios', refCol: 'id', onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      { name: 'fk_informe_historial_usuario', table: 'informe_historial', column: 'usuario_id', ref: 'usuarios', refCol: 'id', onDelete: 'SET NULL', onUpdate: 'CASCADE' },
      { name: 'fk_notificaciones_usuario', table: 'notificaciones', column: 'usuario_id', ref: 'usuarios', refCol: 'id', onDelete: 'SET NULL', onUpdate: 'CASCADE' },
      { name: 'fk_event_notas_usuario', table: 'event_notas', column: 'usuario_id', ref: 'usuarios', refCol: 'id', onDelete: 'SET NULL', onUpdate: 'CASCADE' },
    ];

    let created = 0;
    let errors = 0;

    for (const fk of remainingFks) {
      try {
        const sql = `ALTER TABLE \`${fk.table}\` ADD CONSTRAINT \`${fk.name}\`
                     FOREIGN KEY (\`${fk.column}\`) REFERENCES \`${fk.ref}\`(\`${fk.refCol}\`)
                     ON DELETE ${fk.onDelete} ON UPDATE ${fk.onUpdate}`;
        console.log(`  🔄 ${fk.name}...`);
        await conn.query(sql);
        console.log(`     ✅ Creada`);
        created++;
      } catch (err) {
        console.log(`     ❌ ERROR: ${err.message}`);
        errors++;
      }
    }

    console.log(`\n📊 Resultado:`);
    console.log(`  ✅ Creadas: ${created}`);
    console.log(`  ❌ Errores: ${errors}`);

    if (errors > 0) {
      console.log('\n⚠️  Todavía hay errores. Los errores 1005 (errno: 150) pueden deberse a:');
      console.log('   1. Diferencia de charset/collation entre las columnas');
      console.log('   2. La columna referenciada (usuarios.id) no tiene índice (sí tiene: PRIMARY KEY)');
      console.log('   3. La columna origen tiene VARCHAR(80) y la referencia VARCHAR(30)');
      console.log('\n   Si el charset/collation coinciden, la causa más probable es #3.');
      console.log('   Solución: reducir usuario_id en la tabla del informe a VARCHAR(30).');
    }

  } catch (err) {
    console.error('❌ Error de conexión:', err.message);
    process.exit(1);
  } finally {
    if (conn) conn.end();
  }
}

main();
