const mysql = require('mysql2/promise');

async function main() {
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'crm_jdl'
  });
  
  try {
    const [tables] = await connection.query('SHOW TABLES');
    console.log('Tables:', tables);
    
    const [kvRows] = await connection.query('SELECT clave FROM app_state_kv');
    console.log('KV keys:', kvRows.map(r => r.clave));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await connection.end();
  }
}

main();
