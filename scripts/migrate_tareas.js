/**
 * Script de migración - Sistema de Tareas por Evento
 * 
 * Este script crea la tabla tareas_evento en la base de datos especificada.
 * 
 * Uso:
 *   node scripts/migrate_tareas.js
 * 
 * Configuración:
 *   El script usa las variables de entorno del archivo .env
 *   Si no están definidas, usa los valores por defecto
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Configuración de la base de datos
const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'crm_jdl',
};

// SQL para crear la tabla
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

// Función para crear interfaz de lectura
function createReadlineInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

// Función para preguntar al usuario
function question(rl, query) {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
}

// Función principal de migración
async function migrate() {
  const rl = createReadlineInterface();
  
  console.log('\n========================================');
  console.log('  MIGRACIÓN - SISTEMA DE TAREAS');
  console.log('========================================\n');
  
  console.log('Configuración de base de datos:');
  console.log(`  Host: ${dbConfig.host}`);
  console.log(`  Puerto: ${dbConfig.port}`);
  console.log(`  Usuario: ${dbConfig.user}`);
  console.log(`  Base de datos: ${dbConfig.database}`);
  console.log('');
  
  // Confirmar migración
  const confirm = await question(rl, '¿Deseas continuar con la migración? (s/n): ');
  
  if (confirm.toLowerCase() !== 's') {
    console.log('\nMigración cancelada.');
    rl.close();
    return;
  }
  
  let connection;
  
  try {
    console.log('\nConectando a la base de datos...');
    
    connection = await mysql.createConnection(dbConfig);
    
    console.log('✓ Conexión establecida\n');
    
    // Verificar que existe la tabla eventos (requisito)
    console.log('Verificando requisitos...');
    const [tables] = await connection.query(
      "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'eventos'",
      [dbConfig.database]
    );
    
    if (tables.length === 0) {
      throw new Error('La tabla "eventos" no existe. Esta tabla es un requisito para crear tareas_evento.');
    }
    console.log('✓ Tabla "eventos" existe\n');
    
    // Verificar si la tabla ya existe
    const [existingTables] = await connection.query(
      "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'tareas_evento'",
      [dbConfig.database]
    );
    
    if (existingTables.length > 0) {
      console.log('⚠ La tabla "tareas_evento" ya existe.');
      const overwrite = await question(rl, '¿Deseas recrearla? (s/n): ');
      
      if (overwrite.toLowerCase() === 's') {
        console.log('\nEliminando tabla existente...');
        await connection.query('DROP TABLE tareas_evento');
        console.log('✓ Tabla eliminada\n');
      } else {
        console.log('\nMigración cancelada.');
        rl.close();
        await connection.end();
        return;
      }
    }
    
    // Crear la tabla
    console.log('Creando tabla "tareas_evento"...');
    await connection.query(createTableSQL);
    console.log('✓ Tabla creada exitosamente\n');
    
    // Verificar creación
    console.log('Verificando creación...');
    const [verification] = await connection.query(
      `SELECT 
        TABLE_NAME,
        TABLE_ROWS,
        CREATE_TIME
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'tareas_evento'`,
      [dbConfig.database]
    );
    
    if (verification.length > 0) {
      console.log('✓ Verificación exitosa');
      console.log(`  Tabla: ${verification[0].TABLE_NAME}`);
      console.log(`  Filas: ${verification[0].TABLE_ROWS}`);
      console.log(`  Creada: ${verification[0].CREATE_TIME}\n`);
    }
    
    console.log('========================================');
    console.log('  MIGRACIÓN COMPLETADA EXITOSAMENTE');
    console.log('========================================\n');
    
  } catch (error) {
    console.error('\n✗ Error durante la migración:');
    console.error(`  ${error.message}\n`);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('No se pudo conectar al servidor MySQL.');
      console.error('Verifica que el servidor esté corriendo y las credenciales sean correctas.\n');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('Acceso denegado. Verifica el usuario y contraseña.\n');
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      console.error(`La base de datos "${dbConfig.database}" no existe.\n`);
    }
    
    process.exit(1);
    
  } finally {
    if (connection) {
      await connection.end();
      console.log('Conexión cerrada.\n');
    }
    rl.close();
  }
}

// Ejecutar migración
migrate();
