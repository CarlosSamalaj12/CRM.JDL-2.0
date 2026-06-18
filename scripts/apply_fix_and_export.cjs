/**
 * Aplica las correcciones de constraints a la BD y exporta un backup limpio.
 * 
 * Uso: node scripts/apply_fix_and_export.cjs
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DB_CONFIG = {
  host: '127.0.0.1',
  port: 3306,
  user: 'root',
  password: '12031991',
};

async function main() {
  console.log('=== APLICANDO FIX DE CONSTRAINTS Y EXPORTANDO ===\n');
  
  // 1. Connect to DB
  const conn = await mysql.createConnection({ ...DB_CONFIG, connectTimeout: 5000, multipleStatements: true });
  console.log('✅ Conectado a MySQL');
  await conn.execute('USE crm_jdl');

  // 2. Apply the fix script line by line
  console.log('\n--- Paso 1: Corrigiendo constraints ---');
  const fixSql = fs.readFileSync(path.join(__dirname, '..', 'db', 'fix_existing_db_constraints.sql'), 'utf8');
  
  // Split by statements (semicolons) and execute each one
  const statements = fixSql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('SET') && !s.startsWith('SELECT'));
  
  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;
  
  for (const stmt of statements) {
    try {
      await conn.execute(stmt);
      successCount++;
    } catch (e) {
      if (e.message.includes('check that column/key exists') || e.message.includes('Cannot drop')) {
        skipCount++;
      } else {
        errorCount++;
        console.log(`   ⚠️  ${e.message.substring(0, 80)}`);
      }
    }
  }
  
  console.log(`   ✅ ${successCount} ALTER ejecutados`);
  console.log(`   ⏭️  ${skipCount} saltados (ya corregidos o no aplicables)`);
  if (errorCount > 0) console.log(`   ❌ ${errorCount} errores`);

  // 3. Verify no generic constraints remain
  console.log('\n--- Paso 2: Verificando ---');
  const [rows] = await conn.execute(
    "SELECT TABLE_NAME, CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = 'crm_jdl' AND CONSTRAINT_NAME IN ('1','2','3') AND CONSTRAINT_TYPE = 'FOREIGN KEY'"
  );
  
  if (rows.length === 0) {
    console.log('✅ NO quedan constraints genéricas. Todo correcto.');
  } else {
    console.log(`❌ Quedan ${rows.length} constraints genéricas:`);
    console.table(rows);
    console.log('Ejecuta el script manualmente en HeidiSQL si es necesario.');
  }
  
  // 4. Verify new fk_ constraints were created
  const [newFks] = await conn.execute(
    "SELECT TABLE_NAME, CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = 'crm_jdl' AND CONSTRAINT_NAME LIKE 'fk\\_informe\\_%' OR CONSTRAINT_NAME LIKE 'fk\\_cat\\_%' OR CONSTRAINT_NAME LIKE 'fk\\_menu\\_items\\_%' OR CONSTRAINT_NAME LIKE 'fk\\_platillo\\_componentes\\_%' ORDER BY TABLE_NAME"
  );
  console.log(`\n✅ Nuevas constraints creadas: ${newFks.length}`);
  console.table(newFks);
  
  // 5. Export the database (if mysqldump is available)
  console.log('\n--- Paso 3: Exportando BD ---');
  const outputPath = path.join(__dirname, '..', 'db', 'backup_limpio.sql');
  
  try {
    // Try using mysqldump
    const dumpCmd = `mysqldump --host=127.0.0.1 --port=3306 --user=root --password=12031991 --routines --triggers --events crm_jdl > "${outputPath}"`;
    execSync(dumpCmd, { stdio: 'pipe', timeout: 60000, shell: true });
    console.log(`✅ BD exportada a: db/backup_limpio.sql`);
    
    // Verify the export doesn't have generic constraints
    const exportContent = fs.readFileSync(outputPath, 'utf8');
    const genericCons = exportContent.match(/CONSTRAINT `[123]` FOREIGN KEY/g);
    if (genericCons) {
      console.log(`❌ La exportación aún contiene ${genericCons.length} constraints genéricas.`);
    } else {
      console.log('✅ La exportación NO contiene constraints genéricas.');
    }
    
    const fileSize = fs.statSync(outputPath).size;
    console.log(`📦 Tamaño del archivo: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);
    
  } catch (e) {
    console.log('⚠️  mysqldump no disponible. Exportando mediante consultas...');
    // Fallback: export using SELECT ... INTO OUTFILE or just list tables
    const [tables] = await conn.execute("SHOW TABLES");
    console.log(`   Tablas en BD: ${tables.length}`);
    console.log('   Para exportar, usa HeidiSQL o MySQL Workbench.');
    console.log(`   O instala MySQL Client y ejecuta:\n   mysqldump --host=127.0.0.1 --port=3306 --user=root --password=12031991 crm_jdl > db/backup_limpio.sql`);
  }

  await conn.end();
  console.log('\n=== PROCESO COMPLETADO ===');
}

main().catch(e => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
