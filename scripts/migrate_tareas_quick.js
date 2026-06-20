/**
 * Script de migración rápida - Sistema de Tareas
 * 
 * Uso directo con parámetros:
 *   node scripts/migrate_tareas_quick.js --host=IP --port=PUERTO --user=USUARIO --password=PASSWORD --database=DATABASE
 * 
 * Ejemplo:
 *   node scripts/migrate_tareas_quick.js --host=appjardinesdellago.tech --port=3306 --user=root --password=mipassword --database=crm_jdl
 * 
 * O usando variables de entorno:
 *   DB_HOST=appjardinesdellago.tech DB_PORT=3306 DB_USER=root DB_PASSWORD=mipassword DB_NAME=crm_jdl node scripts/migrate_tareas_quick.js
 */

const mysql = require('mysql2/promise');

// Parsear argumentos de línea de comandos
function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach(arg => {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      args[key] = value;
    }
  });
  return args;
}

// Configuración de la base de datos
const args = parseArgs();
const dbConfig = {
  host: args.host || process.env.DB_HOST || '127.0.0.1',
  port: parseInt(args.port || process.env.DB_PORT || '3306'),
  user: args.user || process.env.DB_USER || 'root',
  password: args.password || process.env.DB_PASSWORD || '',
  database: args.database || process.env.DB_NAME || 'crm_jdl',
};

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

async function migrate() {
  console.log('\n========================================');
  console.log('  MIGRACIÓN RÁPIDA - SISTEMA DE TAREAS');
  console.log('========================================\n');
  
  console.log(`Conectando a: ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}\n`);
  
  let connection;
  
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('✓ Conexión establecida');
    
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
    console.log('✓ Tabla "tareas_evento" creada');
    
    // Verificar
    const [result] = await connection.query(
      "SELECT COUNT(*) as count FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'tareas_evento'",
      [dbConfig.database]
    );
    
    if (result[0].count > 0) {
      console.log('✓ Migración completada exitosamente\n');
    } else {
      throw new Error('No se pudo verificar la creación de la tabla');
    }
    
  } catch (error) {
    console.error(`\n✗ Error: ${error.message}\n`);
    process.exit(1);
    
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

migrate();
