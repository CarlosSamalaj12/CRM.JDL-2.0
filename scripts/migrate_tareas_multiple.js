/**
 * Script de migración múltiple - Sistema de Tareas
 * 
 * Permite migrar a múltiples bases de datos de una sola vez.
 * 
 * Uso:
 *   node scripts/migrate_tareas_multiple.js
 * 
 * Configuración:
 *   Edita el array DATABASES abajo con tus conexiones
 */

const mysql = require('mysql2/promise');

// ============================================
// CONFIGURA AQUÍ TUS BASES DE DATOS
// ============================================
const DATABASES = [
  {
    name: 'Desarrollo Local',
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: 'Xvfv2du1p5xyZX',
    database: 'crm_jdl'
  },
  {
    name: 'Producción',
    host: 'appjardinesdellago.tech',
    port: 3306,
    user: 'root',
    password: 'TU_PASSWORD_AQUI', // ⚠️ CAMBIAR ESTO
    database: 'crm_jdl'
  },
  // Agrega más bases de datos aquí si es necesario
  // {
  //   name: 'Staging',
  //   host: 'staging.example.com',
  //   port: 3306,
  //   user: 'root',
  //   password: 'password',
  //   database: 'crm_jdl'
  // }
];
// ============================================

const createTableSQL = `
CREATE TABLE IF NOT EXISTS tareas_evento (
  id INT(11) NOT NULL AUTO_INCREMENT,
  id_ocupacion VARCHAR(30) NOT NULL,
  usuario_id VARCHAR(100) NOT NULL,
  usuario_nombre VARCHAR(255) DEFAULT NULL,
  contenido TEXT NOT NULL,
  completada TINYINT(1) NOT NULL DEFAULT 0,
  fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_tareas_evento_usuario (id_ocupacion, usuario_id),
  KEY idx_tareas_usuario (usuario_id),
  CONSTRAINT fk_tareas_evento_ocupacion 
    FOREIGN KEY (id_ocupacion) REFERENCES eventos (id) 
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

async function migrateDatabase(dbConfig) {
  let connection;
  
  try {
    console.log(`\n[${dbConfig.name}] Conectando...`);
    connection = await mysql.createConnection(dbConfig);
    console.log(`[${dbConfig.name}] ✓ Conexión establecida`);
    
    // Verificar requisitos
    const [tables] = await connection.query(
      "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'eventos'",
      [dbConfig.database]
    );
    
    if (tables.length === 0) {
      throw new Error('La tabla "eventos" no existe');
    }
    
    // Crear tabla
    await connection.query(createTableSQL);
    console.log(`[${dbConfig.name}] ✓ Tabla "tareas_evento" creada`);
    
    return { success: true, name: dbConfig.name };
    
  } catch (error) {
    console.error(`[${dbConfig.name}] ✗ Error: ${error.message}`);
    return { success: false, name: dbConfig.name, error: error.message };
    
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

async function migrateAll() {
  console.log('\n========================================');
  console.log('  MIGRACIÓN MÚLTIPLE - SISTEMA DE TAREAS');
  console.log('========================================');
  console.log(`\nBases de datos a migrar: ${DATABASES.length}`);
  
  DATABASES.forEach((db, index) => {
    console.log(`  ${index + 1}. ${db.name} (${db.host}:${db.port}/${db.database})`);
  });
  
  console.log('\nIniciando migración...\n');
  
  const results = [];
  
  for (const db of DATABASES) {
    const result = await migrateDatabase(db);
    results.push(result);
  }
  
  // Resumen
  console.log('\n========================================');
  console.log('  RESUMEN DE MIGRACIÓN');
  console.log('========================================\n');
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  if (successful.length > 0) {
    console.log(`✓ Exitosas: ${successful.length}`);
    successful.forEach(r => console.log(`  - ${r.name}`));
  }
  
  if (failed.length > 0) {
    console.log(`\n✗ Fallidas: ${failed.length}`);
    failed.forEach(r => console.log(`  - ${r.name}: ${r.error}`));
  }
  
  console.log(`\nTotal: ${successful.length}/${results.length} completadas`);
  console.log('\n========================================\n');
}

migrateAll();
