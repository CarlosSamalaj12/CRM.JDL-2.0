const mariadb = require('mariadb');
require('dotenv').config();

const pool = mariadb.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3307),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '2022',
  database: process.env.DB_NAME || 'crm_jdl',
  connectionLimit: 1,
});

pool.getConnection()
  .then(c => {
    return c.query('SELECT DATABASE() as db, VERSION() as ver')
      .then(r => {
        console.log('Base de datos conectada:', r[0].db);
        console.log('Version:', r[0].ver);
        return c.query("SELECT TABLE_NAME, TABLE_SCHEMA FROM information_schema.TABLES WHERE TABLE_NAME LIKE '%seguimient%'");
      })
      .then(r => {
        console.log('\nTablas encontradas en information_schema:');
        if (r.length === 0) {
          console.log('  No se encontraron tablas con "seguimient"');
        } else {
          r.forEach(t => console.log('  Schema:', t.TABLE_SCHEMA, '| Tabla:', t.TABLE_NAME));
        }
        return c.query("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME LIKE '%cotizac%'", [process.env.DB_NAME || 'crm_jdl']);
      })
      .then(r => {
        console.log('\nTablas con "cotizac" en', process.env.DB_NAME + ':');
        r.forEach(t => console.log('  - ' + t.TABLE_NAME));
        c.release();
        pool.end();
      });
  })
  .catch(e => {
    console.error('ERROR:', e.message);
    pool.end();
  });
