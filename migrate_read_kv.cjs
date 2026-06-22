
const mariadb = require('mariadb');
require('dotenv').config();
const pool = mariadb.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'crm_jdl',
  connectionLimit: 1
});
(async () => {
  const conn = await pool.getConnection();
  try {
    const rows = await conn.query("SELECT clave, valor_json FROM app_state_kv WHERE clave IN ('services','serviceCategories')");
    const out = {};
    rows.forEach(r => { out[r.clave] = r.valor_json; });
    console.log(JSON.stringify(out));
  } finally { conn.release(); pool.end(); }
})();
