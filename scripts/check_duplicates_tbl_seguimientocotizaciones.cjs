/**
 * Script para detectar registros duplicados en tbl_seguimientocotizaciones.
 * Busca Idocupacion que aparecen más de una vez y muestra sus detalles.
 */
const mariadb = require('mariadb');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function main() {
  const pool = mariadb.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3307),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '2022',
    database: process.env.DB_NAME || 'crm_jdl',
    connectionLimit: 2,
    collation: 'utf8mb4_unicode_ci',
  });

  let conn;
  try {
    conn = await pool.getConnection();

    // 1. Encontrar Idocupacion duplicados
    const duplicates = await conn.query(`
      SELECT Idocupacion, Institucion, COUNT(*) AS cantidad
      FROM tbl_seguimientocotizaciones
      GROUP BY Idocupacion
      HAVING COUNT(*) > 1
      ORDER BY cantidad DESC
    `);

    if (!duplicates || duplicates.length === 0) {
      console.log('✅ No se encontraron Idocupacion duplicados en tbl_seguimientocotizaciones.');
    } else {
      console.log(`🔴 Se encontraron ${duplicates.length} evento(s) con Idocupacion duplicado:\n`);
      for (const dup of duplicates) {
        console.log(`═══ Idocupacion: ${dup.Idocupacion} (${dup.Institucion}) — ${dup.cantidad} registros ═══`);
        const rows = await conn.query(`SELECT Idocupacion, Institucion, FechaEvento, FechaSalida, HoraI, HoraF, Salon, Estatuscotizacion, Vendedor FROM tbl_seguimientocotizaciones WHERE Idocupacion = ? ORDER BY FechaEvento ASC`, [dup.Idocupacion]);
        rows.forEach((r, i) => {
          console.log(`  [${i + 1}] Fecha: ${(r.FechaEvento || '').toString().slice(0,10) || '?'} | Salón: ${r.Salon || '?'} | Horario: ${(r.HoraI || '').toString().slice(0,5) || '?'}-${(r.HoraF || '').toString().slice(0,5) || '?'} | Pax: ${r.Pax || 0} | Vendedor: ${r.Vendedor || '?'} | Estatus: ${r.Estatuscotizacion || '?'}`);
        });
        console.log('');
      }
    }

    console.log(`🔴 Se encontraron ${duplicates.length} evento(s) con Idocupacion duplicado:\n`);

    for (const dup of duplicates) {
      console.log(`═══ Idocupacion: ${dup.Idocupacion} (${dup.Institucion}) — ${dup.cantidad} registros ═══`);

      // Mostrar todos los registros de este Idocupacion
      const rows = await conn.query(`
        SELECT Idocupacion, Institucion, FechaEvento, FechaSalida, HoraI, HoraF, Salon, Estatuscotizacion, Vendedor
        FROM tbl_seguimientocotizaciones
        WHERE Idocupacion = ?
        ORDER BY FechaEvento ASC
      `, [dup.Idocupacion]);

      rows.forEach((r, i) => {
        console.log(`  [${i + 1}] Fecha: ${(r.FechaEvento || '').toString().slice(0,10) || '?'} | Salón: ${r.Salon || '?'} | Horario: ${(r.HoraI || '').toString().slice(0,5) || '?'}-${(r.HoraF || '').toString().slice(0,5) || '?'} | Pax: ${r.Pax || 0} | Vendedor: ${r.Vendedor || '?'} | Estatus: ${r.Estatuscotizacion || '?'}`);
      });
      console.log('');
    }

    // 2. Resumen general de tbl_seguimientocotizaciones
    const totalRows = await conn.query(`SELECT COUNT(*) AS total FROM tbl_seguimientocotizaciones`);
    const uniqueRows = await conn.query(`SELECT COUNT(DISTINCT Idocupacion) AS unicos FROM tbl_seguimientocotizaciones`);
    console.log(`📊 tbl_seguimientocotizaciones: ${totalRows[0].total} registros totales, ${uniqueRows[0].unicos} Idocupacion únicos.`);

    // 3. Verificar la tabla eventos (porque el JOIN LEFT JOIN eventos ev ON e.Idocupacion = ev.id puede causar duplicados)
    console.log('\n--- Verificando tabla eventos ---');
    const evDuplicates = await conn.query(`
      SELECT e.id, e.nombre, COUNT(*) AS cantidad
      FROM eventos e
      GROUP BY e.id
      HAVING COUNT(*) > 1
      ORDER BY cantidad DESC
    `);
    if (!evDuplicates || evDuplicates.length === 0) {
      console.log('✅ No se encontraron id duplicados en la tabla eventos.');
    } else {
      console.log(`🔴 Se encontraron ${evDuplicates.length} id(s) duplicados en eventos:\n`);
      for (const d of evDuplicates) {
        console.log(`  id: ${d.id} (${d.nombre}) — ${d.cantidad} registros`);
        const evRows = await conn.query(`SELECT id, id_ocupacion, nombre, estado, fecha FROM eventos WHERE id = ? ORDER BY id`, [d.id]);
        evRows.forEach((r, i) => {
          console.log(`    [${i + 1}] id_ocupacion: ${r.id_ocupacion || '?'} | nombre: ${r.nombre || '?'} | estado: ${r.estado || '?'} | fecha: ${(r.fecha || '').toString().slice(0,10) || '?'}`);
        });
      }
    }

    // 4. Verificar tabla evento_metadatos (LEFT JOIN m ON e.Idocupacion = m.id_ocupacion)
    console.log('\n--- Verificando tabla evento_metadatos ---');
    const mdDuplicates = await conn.query(`
      SELECT id_ocupacion, COUNT(*) AS cantidad
      FROM evento_metadatos
      GROUP BY id_ocupacion
      HAVING COUNT(*) > 1
      ORDER BY cantidad DESC
      LIMIT 10
    `);
    if (!mdDuplicates || mdDuplicates.length === 0) {
      console.log('✅ No se encontraron id_ocupacion duplicados en evento_metadatos.');
    } else {
      console.log(`🔴 Se encontraron ${mdDuplicates.length} id_ocupacion duplicados en evento_metadatos:`);
      for (const d of mdDuplicates) {
        console.log(`  id_ocupacion: ${d.id_ocupacion} — ${d.cantidad} registros`);
      }
    }
    const totalMd = await conn.query(`SELECT COUNT(*) AS total FROM evento_metadatos`);
    const uniqueMd = await conn.query(`SELECT COUNT(DISTINCT id_ocupacion) AS unicos FROM evento_metadatos`);
    console.log(`📊 evento_metadatos: ${totalMd[0].total} registros totales, ${uniqueMd[0].unicos} id_ocupacion únicos.`);

    // 5. Total general
    const totalEv = await conn.query(`SELECT COUNT(*) AS total FROM eventos`);
    const uniqueEv = await conn.query(`SELECT COUNT(DISTINCT id) AS unicos FROM eventos`);
    console.log(`\n📊 eventos: ${totalEv[0].total} registros totales, ${uniqueEv[0].unicos} id únicos.`);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    if (conn) conn.release();
    await pool.end();
  }
}

main();
