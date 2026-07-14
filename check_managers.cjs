const mariadb = require('mariadb');
async function main() {
  const pool = mariadb.createPool({
    host: '127.0.0.1', port: 3306, user: 'root', password: 'Xvfv2du1p5xyZX', database: 'crm_jdl', connectTimeout: 5000
  });
  const conn = await pool.getConnection();

  // Find records where 'nombre' is just a number
  const numericNombre = await conn.query("SELECT id, id_empresa, nombre, telefono FROM encargados_empresa WHERE nombre REGEXP '^[0-9]+$' ORDER BY id");
  console.log('Registros con nombre numerico (corruptos):');
  console.log(JSON.stringify(numericNombre, null, 2));

  // Also check quotes that reference a manager
  const quotes = await conn.query("SELECT id, id_evento, id_encargado, nombre_encargado FROM cotizaciones_evento WHERE id_encargado IS NOT NULL AND id_encargado != '' LIMIT 20");
  console.log('\nCotizaciones con id_encargado:');
  console.log(JSON.stringify(quotes, null, 2));

  await conn.release();
  await pool.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
