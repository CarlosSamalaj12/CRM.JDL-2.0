/**
 * Importa db/Informes.sql (corregido) en la BD y exporta un backup completo.
 * 
 * Uso: node scripts/import_and_export.cjs
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const DB_CONFIG = { host: '127.0.0.1', port: 3306, user: 'root', password: '12031991' };

async function main() {
  console.log('=== IMPORTANDO Informes.sql Y EXPORTANDO BACKUP ===\n');

  // 1. Leer el archivo SQL corregido
  console.log('Leyendo db/Informes.sql (corregido)...');
  const sqlContent = fs.readFileSync(path.join(__dirname, '..', 'db', 'Informes.sql'), 'utf8');
  console.log(`Archivo leído: ${(sqlContent.length / 1024).toFixed(0)} KB`);

  // 2. Verificar que no tenga constraints genéricas
  const checkContent = sqlContent.replace(/\r\n/g, '\n');
  const badCons = checkContent.match(/CONSTRAINT `[123]` FOREIGN KEY/g);
  if (badCons) {
    console.log(`❌ ERROR: Aún quedan ${badCons.length} constraints genéricas. Ejecuta primero: node scripts/fix_informes_sql.cjs`);
    process.exit(1);
  }
  console.log('✅ Archivo verificado - sin constraints genéricas');

  // 3. Conectar a MySQL
  const conn = await mysql.createConnection({ ...DB_CONFIG, connectTimeout: 5000, multipleStatements: true });
  console.log('✅ Conectado a MySQL');
  await conn.execute('USE crm_jdl');

  // 4. Importar el SQL
  console.log('\n--- Paso 1: Importando Informes.sql ---');
  
  // Split by semicolons and execute each statement individually
  const statements = sqlContent
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);
  
  console.log(`Total de statements: ${statements.length}`);
  
  let imported = 0;
  let skipped = 0;
  let errors = 0;
  
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    try {
      await conn.execute(stmt);
      imported++;
      if (imported % 20 === 0) process.stdout.write(`  ${imported}/${statements.length}...\r`);
    } catch (e) {
      // Ignore "already exists" and "duplicate" errors
      if (e.message.includes('already exists') || 
          e.message.includes('Duplicate entry') && e.message.includes('PRIMARY') ||
          e.message.includes('Table') && e.message.includes('already exists')) {
        skipped++;
      } else {
        errors++;
        if (errors <= 5) {
          console.log(`\n❌ Error en statement ${i}: ${e.message.substring(0, 100)}`);
        }
      }
    }
  }
  
  console.log(`\n✅ Importados: ${imported}`);
  console.log(`⏭️  Saltados (ya existen): ${skipped}`);
  if (errors > 0) console.log(`❌ Errores: ${errors}`);

  // 5. Verificar las tablas de informes
  console.log('\n--- Paso 2: Verificando tablas importadas ---');
  const informesTables = [
    'cat_categorias_alimento', 'cat_ingredientes', 'cat_menus', 
    'cat_opciones_ingrediente', 'cat_platillos', 'config_equipo',
    'config_tipo_mesa', 'config_tipo_silla', 'event_notas',
    'evento_metadatos', 'informe_comentarios', 'informe_destacados',
    'informe_dia_menu_detalle', 'informe_dias_detalle', 'informe_historial',
    'informe_imagenes', 'informe_lecturas', 'informes_eventos',
    'menu_items', 'notificaciones', 'platillo_componentes'
  ];
  
  const [existingTables] = await conn.execute(
    "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = 'crm_jdl'"
  );
  const existingNames = existingTables.map(t => t.TABLE_NAME);
  
  let allOk = true;
  for (const tbl of informesTables) {
    const exists = existingNames.includes(tbl);
    if (!exists) {
      console.log(`❌ Falta: ${tbl}`);
      allOk = false;
    }
  }
  if (allOk) console.log('✅ Todas las tablas de informes existen');

  // 6. Verificar constraints
  console.log('\n--- Paso 3: Verificando constraints ---');
  const [badCons2] = await conn.execute(
    "SELECT TABLE_NAME, CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = 'crm_jdl' AND CONSTRAINT_NAME IN ('1','2','3') AND CONSTRAINT_TYPE = 'FOREIGN KEY'"
  );
  if (badCons2.length === 0) {
    console.log('✅ NO hay constraints genéricas');
  } else {
    console.log(`❌ Quedan ${badCons2.length}:`);
    console.table(badCons2);
  }

  // 7. Contar datos importados
  console.log('\n--- Paso 4: Datos importados ---');
  const dataTables = [
    'cat_categorias_alimento', 'cat_ingredientes', 'cat_menus',
    'cat_opciones_ingrediente', 'cat_platillos', 'config_equipo',
    'config_tipo_mesa', 'config_tipo_silla', 'informes_eventos',
    'informe_dias_detalle', 'informe_dia_menu_detalle', 'menu_items',
    'platillo_componentes'
  ];
  
  for (const tbl of dataTables) {
    if (existingNames.includes(tbl)) {
      const [rows] = await conn.execute(`SELECT COUNT(*) as cnt FROM \`${tbl}\``);
      console.log(`  ${tbl}: ${rows[0].cnt} registros`);
    }
  }

  // 8. Exportar la BD completa (usando Node.js)
  console.log('\n--- Paso 5: Exportando BD completa ---');
  const outputPath = path.join(__dirname, '..', 'db', 'backup_completo.sql');
  
  // Get all tables
  const [allTables] = await conn.execute(
    "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = 'crm_jdl' AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME"
  );
  
  let exportSql = '-- ============================================================\n';
  exportSql += '-- BACKUP COMPLETO: crm_jdl\n';
  exportSql += '-- Generado el: ' + new Date().toISOString() + '\n';
  exportSql += '-- Constraints corregidas con nombres descriptivos\n';
  exportSql += '-- ============================================================\n\n';
  exportSql += 'SET FOREIGN_KEY_CHECKS = 0;\n';
  exportSql += 'SET UNIQUE_CHECKS = 0;\n\n';
  
  for (const tbl of allTables) {
    const tableName = tbl.TABLE_NAME;
    
    // Get CREATE TABLE
    const [createResult] = await conn.execute(`SHOW CREATE TABLE \`${tableName}\``);
    const createStmt = createResult[0]['Create Table'];
    
    exportSql += `--\n-- Table: ${tableName}\n--\n`;
    exportSql += `DROP TABLE IF EXISTS \`${tableName}\`;\n`;
    exportSql += createStmt + ';\n\n';
    
    // Get data
    const [dataRows] = await conn.execute(`SELECT * FROM \`${tableName}\``);
    if (dataRows.length > 0) {
      const columns = Object.keys(dataRows[0]);
      const colNames = columns.map(c => '`' + c + '`').join(', ');
      
      // Batch INSERTs (100 rows per INSERT)
      const batchSize = 100;
      for (let i = 0; i < dataRows.length; i += batchSize) {
        const batch = dataRows.slice(i, i + batchSize);
        const values = batch.map(row => {
          return '(' + columns.map(col => {
            const val = row[col];
            if (val === null || val === undefined) return 'NULL';
            if (typeof val === 'number') return val.toString();
            return "'" + String(val).replace(/'/g, "''") + "'";
          }).join(', ') + ')';
        }).join(',\n    ');
        
        exportSql += `INSERT INTO \`${tableName}\` (${colNames}) VALUES\n    ${values};\n`;
      }
    }
    
    exportSql += '\n';
  }
  
  exportSql += 'SET UNIQUE_CHECKS = 1;\n';
  exportSql += 'SET FOREIGN_KEY_CHECKS = 1;\n';
  
  fs.writeFileSync(outputPath, exportSql, 'utf8');
  const fileSize = fs.statSync(outputPath).size;
  console.log(`✅ BD exportada a: db/backup_completo.sql`);
  console.log(`📦 Tamaño: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);
  
  // Verify export doesn't have generic constraints
  const exportContent = fs.readFileSync(outputPath, 'utf8');
  const badInExport = exportContent.match(/CONSTRAINT `[123]` FOREIGN KEY/g);
  if (badInExport) {
    console.log(`❌ La exportación tiene ${badInExport.length} constraints genéricas`);
  } else {
    console.log('✅ La exportación NO contiene constraints genéricas');
  }

  await conn.end();
  console.log('\n=== PROCESO COMPLETADO ===');
}

main().catch(e => {
  console.error('\n❌ ERROR FATAL:', e.message);
  process.exit(1);
});
