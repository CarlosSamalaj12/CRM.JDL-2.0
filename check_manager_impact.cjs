const mariadb = require('mariadb');
async function main() {
  const pool = mariadb.createPool({
    host: '127.0.0.1', port: 3306, user: 'root', password: 'Xvfv2du1p5xyZX', database: 'crm_jdl', connectTimeout: 5000
  });
  const conn = await pool.getConnection();

  // Describe the cotizaciones_evento table
  const cols = await conn.query("DESCRIBE cotizaciones_evento");
  console.log('cotizaciones_evento columns:');
  console.log(cols.map(c => c.Field).join(', '));

  // Check quotes referencing the corrupted managers (where id_encargado matches the corrupt id)
  const quotes = await conn.query(`
    SELECT c.id_evento, c.nombre_encargado, c.id_encargado, e.nombre AS event_name
    FROM cotizaciones_evento c
    LEFT JOIN eventos e ON c.id_evento = e.id
    WHERE c.id_encargado IN (
      SELECT id FROM encargados_empresa WHERE nombre REGEXP '^[0-9]+$'
    )
    LIMIT 10
  `);
  console.log('\nCotizaciones referencing corrupted managers:');
  console.log(JSON.stringify(quotes, null, 2));

  await conn.release();
  await pool.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
