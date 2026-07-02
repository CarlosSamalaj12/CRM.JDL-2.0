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

async function main() {
  let conn;
  try {
    conn = await pool.getConnection();
    console.log('Conectado a:', process.env.DB_NAME || 'crm_jdl');

    // 1. Ver cuántos registros hay
    const [before] = await conn.query('SELECT COUNT(*) as total, COUNT(DISTINCT Idocupacion) as unicos FROM tbl_seguimientocotizaciones');
    console.log(`\nAntes: ${before.total} registros, ${before.unicos} Idocupacion únicos`);

    // 2. Buscar duplicados
    const dups = await conn.query(
      `SELECT Idocupacion, Institucion, FechaEvento, FechaSalida, Salon, COUNT(*) as cantidad
       FROM tbl_seguimientocotizaciones
       GROUP BY Idocupacion
       HAVING COUNT(*) > 1
       ORDER BY cantidad DESC, Idocupacion`
    );
    console.log(`\nDuplicados encontrados: ${dups.length}`);
    if (dups.length > 0) {
      console.log('\nDetalle de duplicados:');
      dups.forEach(d => {
        console.log(`  Idocupacion: ${d.Idocupacion} | ${d.Institucion} | ${d.FechaEvento} | ${d.Salon} -> ${d.cantidad} veces`);
      });

      // 3. Eliminar duplicados con SELECT DISTINCT + tabla temporal
      console.log('\nEliminando duplicados...');
      await conn.query('DROP TABLE IF EXISTS tbl_seguimientocotizaciones_temp');
      await conn.query('CREATE TABLE tbl_seguimientocotizaciones_temp AS SELECT DISTINCT * FROM tbl_seguimientocotizaciones');
      await conn.query('TRUNCATE TABLE tbl_seguimientocotizaciones');
      await conn.query('INSERT INTO tbl_seguimientocotizaciones SELECT * FROM tbl_seguimientocotizaciones_temp');
      await conn.query('DROP TABLE IF EXISTS tbl_seguimientocotizaciones_temp');
      console.log('Duplicados eliminados correctamente.');
    } else {
      console.log('No hay duplicados que eliminar.');
    }

    // 4. Verificar después
    const [after] = await conn.query('SELECT COUNT(*) as total, COUNT(DISTINCT Idocupacion) as unicos FROM tbl_seguimientocotizaciones');
    console.log(`\nDespués: ${after.total} registros, ${after.unicos} Idocupacion únicos`);

    if (after.total === after.unicos) {
      console.log('\n✅ Base de datos limpia: todos los Idocupacion son únicos.');
    } else {
      console.log(`\n⚠️  Quedan ${after.total - after.unicos} registros duplicados.`);
    }

  } catch (err) {
    console.error('ERROR:', err.message);
  } finally {
    if (conn) conn.release();
    await pool.end();
  }
}

main();
