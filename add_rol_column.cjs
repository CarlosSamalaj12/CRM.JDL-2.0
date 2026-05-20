const mariadb = require("mariadb");

const DB_HOST = "127.0.0.1";
const DB_PORT = 3307;
const DB_USER = "root";
const DB_PASSWORD = "2022";
const DB_NAME = "crm_jdl";

const pool = mariadb.createPool({
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  connectionLimit: 1,
});

async function main() {
  let conn;
  try {
    conn = await pool.getConnection();
    
    console.log("Adding 'rol' column to 'usuarios' table...");
    try {
      await conn.query("ALTER TABLE usuarios ADD COLUMN rol VARCHAR(50) NOT NULL DEFAULT 'vendedor'");
      console.log("Column 'rol' added successfully!");
    } catch (err) {
      if (err.sqlState === '42S21' || err.message.includes("Duplicate column name")) {
        console.log("Column 'rol' already exists.");
      } else {
        throw err;
      }
    }

    console.log("Setting 'sistemashotel@jardinesdellago.com' role to 'admin'...");
    await conn.query("UPDATE usuarios SET rol = 'admin' WHERE correo = 'sistemashotel@jardinesdellago.com'");
    
    console.log("Setting 'kevinbixcul@gmail.com' role to 'admin'...");
    await conn.query("UPDATE usuarios SET rol = 'admin' WHERE correo = 'kevinbixcul@gmail.com'");

    const rows = await conn.query("SELECT id, nombre, correo, rol, activo FROM usuarios");
    console.log("=== UPDATED DATABASE USERS ===");
    console.log(JSON.stringify(rows, null, 2));

  } catch (err) {
    console.error("Migration error:", err);
  } finally {
    if (conn) conn.end();
    pool.end();
  }
}

main();
