const mariadb = require('mariadb');

async function main() {
  const conn = await mariadb.createConnection({
    host: '127.0.0.1',
    port: 3307,
    user: 'root',
    password: '2022',
    database: 'crm_jdl'
  });

  try {
    const query = `
      SELECT
        DATE_FORMAT(COALESCE(ice.fecha_servicio, e.FechaEvento), '%Y-%m-%d') AS FechaServicio,
        ice.id_evento AS Idocupacion,
        e.Institucion,
        e.Salon,
        COALESCE(sc.nombre, ice.nombre) AS Subcategoria,
        CASE
          WHEN LOWER(COALESCE(ice.nombre, '')) LIKE '%desayuno%' THEN 'desayunos'
          WHEN LOWER(COALESCE(ice.nombre, '')) LIKE '%refa%am%' OR LOWER(COALESCE(ice.nombre, '')) LIKE '%refa%a.m.%' OR LOWER(COALESCE(ice.nombre, '')) LIKE '%refacci%am%' OR LOWER(COALESCE(ice.nombre, '')) LIKE '%coffee%break%am%' OR LOWER(COALESCE(ice.nombre, '')) LIKE '%coffee%break%a.m.%' THEN 'refacciones_am'
          WHEN LOWER(COALESCE(ice.nombre, '')) LIKE '%almuerzo%' THEN 'almuerzos'
          WHEN LOWER(COALESCE(ice.nombre, '')) LIKE '%cena%' THEN 'cenas'
          WHEN LOWER(COALESCE(ice.nombre, '')) LIKE '%refa%pm%' OR LOWER(COALESCE(ice.nombre, '')) LIKE '%refa%p.m.%' OR LOWER(COALESCE(ice.nombre, '')) LIKE '%refacci%pm%' OR LOWER(COALESCE(ice.nombre, '')) LIKE '%coffee%break%pm%' OR LOWER(COALESCE(ice.nombre, '')) LIKE '%coffee%break%p.m.%' THEN 'refacciones_pm'
          WHEN LOWER(COALESCE(sc.nombre, '')) LIKE '%desayuno%' THEN 'desayunos'
          WHEN LOWER(COALESCE(sc.nombre, '')) LIKE '%refa%am%' OR LOWER(COALESCE(sc.nombre, '')) LIKE '%refa%a.m.%' OR LOWER(COALESCE(sc.nombre, '')) LIKE '%refacci%am%' THEN 'refacciones_am'
          WHEN LOWER(COALESCE(sc.nombre, '')) LIKE '%almuerzo%' THEN 'almuerzos'
          WHEN LOWER(COALESCE(sc.nombre, '')) LIKE '%cena%' THEN 'cenas'
          WHEN LOWER(COALESCE(sc.nombre, '')) LIKE '%refa%pm%' OR LOWER(COALESCE(sc.nombre, '')) LIKE '%refa%p.m.%' OR LOWER(COALESCE(sc.nombre, '')) LIKE '%refacci%pm%' THEN 'refacciones_pm'
          ELSE 'otros'
        END AS TipoServicio,
        SUM(
          CASE
            WHEN ice.id_evento = (
              SELECT MIN(ice2.id_evento)
              FROM items_cotizacion_evento ice2
              LEFT JOIN tbl_seguimientocotizaciones e2 ON ice2.id_evento = e2.Idocupacion
              WHERE SUBSTRING_INDEX(ice2.id_evento, '_s', 1) = SUBSTRING_INDEX(ice.id_evento, '_s', 1)
                AND COALESCE(ice2.fecha_servicio, e2.FechaEvento) = COALESCE(ice.fecha_servicio, e.FechaEvento)
            ) THEN ice.cantidad
            ELSE 0
          END
        ) AS cantidad
      FROM items_cotizacion_evento ice
      JOIN (
        SELECT DISTINCT Idocupacion, FechaEvento, Institucion, Salon, Vendedor
        FROM tbl_seguimientocotizaciones
        WHERE Estatuscotizacion IN (4, 7, 8)
      ) e ON ice.id_evento = e.Idocupacion
      LEFT JOIN servicios s ON ice.id_servicio = s.id
      LEFT JOIN subcategorias_servicio sc ON s.id_subcategoria = sc.id
      WHERE 1=1
        AND YEARWEEK(COALESCE(ice.fecha_servicio, e.FechaEvento), 1) = YEARWEEK('2026-08-04', 1)
      GROUP BY DATE_FORMAT(COALESCE(ice.fecha_servicio, e.FechaEvento), '%Y-%m-%d'), ice.id_evento, TipoServicio
      ORDER BY DATE_FORMAT(COALESCE(ice.fecha_servicio, e.FechaEvento), '%Y-%m-%d') ASC, TipoServicio ASC
    `;

    console.time('WeeklyServices query execution');
    const rows = await conn.query(query);
    console.timeEnd('WeeklyServices query execution');
    console.log(`Total services fetched: ${rows.length}`);
  } catch (err) {
    console.error('Query failed:', err);
  } finally {
    await conn.end();
  }
}

main();
