const mariadb = require('mariadb');

async function main() {
  const pool = mariadb.createPool({
    host: '127.0.0.1',
    port: 3307,
    user: 'root',
    password: '2022',
    database: 'crm_jdl',
    connectionLimit: 1
  });
  
  let conn;
  try {
    conn = await pool.getConnection();
    const cols = await conn.query('SHOW COLUMNS FROM salones');
    console.log('Columns of salones:', cols);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    if (conn) conn.release();
    await pool.end();
  }
}

main();
