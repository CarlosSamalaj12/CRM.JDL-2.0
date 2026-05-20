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
    const cols = await conn.query("DESCRIBE usuarios");
    console.log("=== USUARIOS COLUMNS PORT 3307 ===");
    console.log(cols);
    const rows = await conn.query("SELECT * FROM usuarios LIMIT 5");
    console.log("=== USUARIOS ROWS PORT 3307 ===");
    console.log(JSON.stringify(rows, null, 2));
  } catch (err) {
    console.error("Error connecting to database:", err);
  } finally {
    if (conn) conn.end();
    pool.end();
  }
}

main();
