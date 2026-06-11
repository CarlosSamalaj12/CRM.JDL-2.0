const fs = require("fs");
const path = require("path");
require("dotenv").config();
const mariadb = require("mariadb");

const DB_HOST = process.env.DB_HOST || "127.0.0.1";
const DB_PORT = Number(process.env.DB_PORT || 3307);
const DB_USER = process.env.DB_USER || "root";
const DB_PASSWORD = process.env.DB_PASSWORD || "";
const DB_NAME = process.env.DB_NAME || "crm_jdl";

function formatDate(date) {
  const pad = (n) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function escapeString(val) {
  return val
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r");
}

async function main() {
  console.log(`Conectando a la base de datos ${DB_NAME} en ${DB_HOST}:${DB_PORT}...`);
  
  let conn;
  try {
    conn = await mariadb.createConnection({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME,
      multipleStatements: false,
    });
    
    console.log("Conexión exitosa. Obteniendo tablas...");
    
    // Obtener todas las tablas
    const tablesResult = await conn.query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
    const tables = tablesResult.map(row => Object.values(row)[0]);
    
    console.log(`Se encontraron ${tables.length} tablas: ${tables.join(", ")}`);
    
    const sqlLines = [];
    sqlLines.push("-- ------------------------------------------------------");
    sqlLines.push(`-- Respaldo de Base de Datos: ${DB_NAME}`);
    sqlLines.push(`-- Generado el: ${new Date().toLocaleString()}`);
    sqlLines.push("-- ------------------------------------------------------");
    sqlLines.push("");
    sqlLines.push("SET FOREIGN_KEY_CHECKS = 0;");
    sqlLines.push("");
    
    for (const table of tables) {
      console.log(`Exportando tabla: ${table}...`);
      sqlLines.push(`--`);
      sqlLines.push(`-- Estructura de tabla para la tabla \`${table}\``);
      sqlLines.push(`--`);
      sqlLines.push(`DROP TABLE IF EXISTS \`${table}\`;`);
      
      // Obtener estructura
      const createTableResult = await conn.query(`SHOW CREATE TABLE \`${table}\``);
      const createTableSql = createTableResult[0]["Create Table"];
      sqlLines.push(`${createTableSql};`);
      sqlLines.push("");
      
      // Obtener datos
      sqlLines.push(`--`);
      sqlLines.push(`-- Volcado de datos para la tabla \`${table}\``);
      sqlLines.push(`--`);
      
      const rows = await conn.query(`SELECT * FROM \`${table}\``);
      if (rows.length > 0) {
        const columns = Object.keys(rows[0]);
        const colsStr = columns.map(c => `\`${c}\``).join(", ");
        
        // Escribir en chunks de 100 filas
        const chunkSize = 100;
        for (let i = 0; i < rows.length; i += chunkSize) {
          const chunk = rows.slice(i, i + chunkSize);
          const valuesStr = chunk.map(row => {
            const rowVals = columns.map(col => {
              const val = row[col];
              if (val === null || val === undefined) return "NULL";
              if (typeof val === "boolean") return val ? "1" : "0";
              if (typeof val === "number") return val;
              if (val instanceof Date) return `'${formatDate(val)}'`;
              if (Buffer.isBuffer(val)) return `X'${val.toString("hex")}'`;
              return `'${escapeString(String(val))}'`;
            });
            return `(${rowVals.join(", ")})`;
          }).join(",\n");
          
          sqlLines.push(`INSERT INTO \`${table}\` (${colsStr}) VALUES\n${valuesStr};`);
        }
      } else {
        sqlLines.push(`-- (Sin registros en \`${table}\`)`);
      }
      sqlLines.push("");
    }
    
    sqlLines.push("SET FOREIGN_KEY_CHECKS = 1;");
    
    const now = new Date();
    const pad = (n) => n.toString().padStart(2, '0');
    const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

    const outputDir = path.join(__dirname, "..", "db");
    const backupsDir = path.join(outputDir, "backups");
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }
    
    const backupFileName = `crm_jdl_backup_${timestamp}.sql`;
    const outputPathTimestamp = path.join(backupsDir, backupFileName);
    const outputPathLatest = path.join(outputDir, "crm_jdl_backup.sql");
    
    const sqlContent = sqlLines.join("\n");
    fs.writeFileSync(outputPathTimestamp, sqlContent, "utf8");
    fs.writeFileSync(outputPathLatest, sqlContent, "utf8");
    
    console.log("");
    console.log(`¡Respaldo completado con éxito!`);
    console.log(`Copia histórica guardada en: ${outputPathTimestamp}`);
    console.log(`Última copia actualizada en: ${outputPathLatest}`);
    console.log(`Tamaño: ${(fs.statSync(outputPathLatest).size / 1024).toFixed(2)} KB`);
  } catch (error) {
    console.error("Error al exportar la base de datos:", error);
    process.exitCode = 1;
  } finally {
    if (conn) {
      await conn.end();
    }
  }
}

main();
