/**
 * Script de diagnóstico: verifica datos de comida en items_cotizacion_evento
 * 
 * Uso:
 *   node scripts/diagnostico_comida.cjs [IdOcupacion]
 *   
 * Si no se pasa IdOcupacion, muestra un resumen de la semana actual.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mariadb = require('mariadb');
const DB_NAME = process.env.DB_NAME || 'crm_jdl';

const pool = mariadb.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: DB_NAME,
  connectionLimit: 1,
});

async function main() {
  let conn;
  try {
    conn = await pool.getConnection();
    const args = process.argv.slice(2);
    const idOcupacion = args[0] ? Number(args[0]) : null;

    console.log('══════════════════════════════════════════════');
    console.log('  DIAGNÓSTICO DE DATOS DE COMIDA');
    console.log('══════════════════════════════════════════════\n');

    if (idOcupacion) {
      await diagnosticarEvento(conn, idOcupacion);
    } else {
      // Semana actual (lunes a domingo)
      const weekSql = `
        SELECT MIN(FechaEvento) AS inicio_semana
        FROM tbl_seguimientocotizaciones
        WHERE Estatuscotizacion IN (4, 7, 8)
          AND YEARWEEK(FechaEvento, 1) = YEARWEEK(CURDATE(), 1)
      `;
      const [weekRow] = await conn.query(weekSql);
      if (weekRow.inicio_semana) {
        console.log(`  Semana actual (desde ${weekRow.inicio_semana})\n`);
      }
      await listarEventosSemana(conn, idOcupacion);
    }
  } catch (err) {
    console.error('ERROR de conexión:', err.message);
    console.error('Asegúrate de que el servidor MariaDB esté corriendo.');
  } finally {
    if (conn) conn.end();
    await pool.end();
  }
}

async function listarEventosSemana(conn) {
  console.log('  EVENTOS EN SEMANA ACTUAL (confirmados/pre-reserva/mto):');
  console.log('  ─────────────────────────────────────────────────────');

  const rows = await conn.query(`
    SELECT 
      Idocupacion,
      FechaEvento,
      Institucion,
      Salon,
      Estatuscotizacion,
      Pax
    FROM tbl_seguimientocotizaciones
    WHERE Estatuscotizacion IN (4, 7, 8)
      AND YEARWEEK(FechaEvento, 1) = YEARWEEK(CURDATE(), 1)
    ORDER BY FechaEvento ASC, Idocupacion ASC
  `);

  if (rows.length === 0) {
    console.log('  (sin eventos esta semana)');
    console.log('\n  Para diagnosticar un evento específico:');
    console.log('  node scripts/diagnostico_comida.cjs <IdOcupacion>\n');
    return;
  }

  // Agrupar por Idocupacion
  const grouped = {};
  for (const r of rows) {
    if (!grouped[r.Idocupacion]) grouped[r.Idocupacion] = [];
    grouped[r.Idocupacion].push(r);
  }

  for (const [id, evts] of Object.entries(grouped)) {
    console.log(`\n  📌 Idocupacion: ${id}`);
    console.log(`     Institución: ${evts[0].Institucion}`);
    console.log(`     Filas en tbl_seguimientocotizaciones: ${evts.length}`);
    for (const e of evts) {
      console.log(`       • ${e.FechaEvento} | Salón: ${e.Salon} | Pax: ${e.Pax} | Estatus: ${e.Estatuscotizacion}`);
    }

    // Items de comida para este evento
    const items = await conn.query(`
      SELECT 
        ice.id, ice.nombre, ice.cantidad, ice.precio_unitario,
        ice.fecha_servicio,
        sc.nombre AS subcategoria,
        s.nombre AS servicio
      FROM items_cotizacion_evento ice
      LEFT JOIN servicios s ON ice.id_servicio = s.id
      LEFT JOIN subcategorias_servicio sc ON s.id_subcategoria = sc.id
      WHERE ice.id_evento = ?
      ORDER BY ice.fecha_servicio ASC, sc.nombre ASC
    `, [id]);

    console.log(`     Items en cotización: ${items.length}`);
    
    if (items.length === 0) {
      console.log('       (sin items)');
    } else {
      const conFecha = items.filter(i => i.fecha_servicio);
      const sinFecha = items.filter(i => !i.fecha_servicio);
      console.log(`       • Con fecha_servicio: ${conFecha.length}`);
      console.log(`       • Sin fecha_servicio: ${sinFecha.length}`);

      // Agrupar por fecha_servicio
      const porFecha = {};
      for (const it of items) {
        const f = it.fecha_servicio ? it.fecha_servicio.toISOString().slice(0, 10) : '(SIN FECHA)';
        if (!porFecha[f]) porFecha[f] = [];
        porFecha[f].push(it);
      }
      for (const [fecha, its] of Object.entries(porFecha)) {
        console.log(`       ─ ${fecha}:`);
        for (const it of its) {
          const tipo = clasificarComida(it.subcategoria || it.nombre);
          console.log(`          ${it.cantidad} × ${it.nombre} (${it.subcategoria || '—'}) → tipo: ${tipo}`);
        }
      }
    }
  }

  console.log('\n  Para diagnosticar un evento específico:');
  console.log('  node scripts/diagnostico_comida.cjs <IdOcupacion>\n');
}

async function diagnosticarEvento(conn, idOcupacion) {
  // 1. Datos del evento
  const eventos = await conn.query(`
    SELECT Idocupacion, FechaEvento, Institucion, Salon, Estatuscotizacion
    FROM tbl_seguimientocotizaciones
    WHERE Idocupacion = ?
    ORDER BY FechaEvento ASC
  `, [idOcupacion]);

  console.log(`  EVENTO Idocupacion = ${idOcupacion}`);
  console.log('  ─────────────────────────────────────────────');
  console.log(`  Filas en tbl_seguimientocotizaciones: ${eventos.length}`);
  for (const e of eventos) {
    console.log(`    • ${e.FechaEvento} | ${e.Institucion} | ${e.Salon} | Estatus: ${e.Estatuscotizacion}`);
  }
  console.log();

  // 2. Items de comida
  console.log('  ITEMS EN items_cotizacion_evento:');
  console.log('  ─────────────────────────────────');
  const items = await conn.query(`
    SELECT 
      ice.id, ice.nombre, ice.cantidad, ice.precio_unitario,
      ice.fecha_servicio,
      sc.nombre AS subcategoria,
      s.nombre AS servicio
    FROM items_cotizacion_evento ice
    LEFT JOIN servicios s ON ice.id_servicio = s.id
    LEFT JOIN subcategorias_servicio sc ON s.id_subcategoria = sc.id
    WHERE ice.id_evento = ?
    ORDER BY ice.fecha_servicio ASC, sc.nombre ASC
  `, [idOcupacion]);

  console.log(`  Total items: ${items.length}`);
  console.log();

  if (items.length > 0) {
    // Por fecha_servicio
    console.log('  📅 POR FECHA_SERVICIO:');
    const conFecha = items.filter(i => i.fecha_servicio);
    const sinFecha = items.filter(i => !i.fecha_servicio);
    console.log(`    Con fecha_servicio: ${conFecha.length}`);
    console.log(`    Sin fecha_servicio (NULL): ${sinFecha.length}`);
    console.log();

    if (conFecha.length > 0) {
      console.log('  Items CON fecha:');
      const porFecha = {};
      for (const it of conFecha) {
        const f = it.fecha_servicio.toISOString().slice(0, 10);
        if (!porFecha[f]) porFecha[f] = [];
        porFecha[f].push(it);
      }
      for (const [f, its] of Object.entries(porFecha).sort()) {
        console.log(`    ${f}:`);
        for (const it of its) {
          const tipo = clasificarComida(it.subcategoria || it.nombre);
          console.log(`      ${it.cantidad} × ${it.nombre} (${it.subcategoria || '—'}) → ${tipo}`);
        }
      }
      console.log();
    }

    if (sinFecha.length > 0) {
      console.log('  Items SIN fecha (NULL — se agruparían por FechaEvento del evento):');
      const porTipo = {};
      for (const it of sinFecha) {
        const tipo = clasificarComida(it.subcategoria || it.nombre);
        if (!porTipo[tipo]) porTipo[tipo] = 0;
        porTipo[tipo] += Number(it.cantidad) || 0;
        console.log(`    ${it.cantidad} × ${it.nombre} (${it.subcategoria || '—'}) → ${tipo}`);
      }
      console.log('\n  Totales por tipo (sin fecha):');
      for (const [tipo, cant] of Object.entries(porTipo)) {
        console.log(`    ${tipo}: ${cant}`);
      }
      console.log();

      // SIMULACIÓN de getWeeklyServices con COALESCE
      console.log('  🔍 SIMULACIÓN de getWeeklyServices (COALESCE a FechaEvento):');
      for (const e of eventos) {
        const fechaEvento = e.FechaEvento.toISOString().slice(0, 10);
        const porTipoFecha = {};
        for (const it of sinFecha) {
          const tipo = clasificarComida(it.subcategoria || it.nombre);
          if (!porTipoFecha[tipo]) porTipoFecha[tipo] = 0;
          porTipoFecha[tipo] += Number(it.cantidad) || 0;
        }
        console.log(`    ${fechaEvento} (Salón: ${e.Salon}):`);
        for (const [tipo, cant] of Object.entries(porTipoFecha)) {
          if (cant > 0) console.log(`      ${tipo}: ${cant}`);
        }
      }
      console.log();

      // ⚠️ VERIFICACIÓN: ¿múltiples filas con mismo Idocupacion?
      if (eventos.length > 1) {
        console.log('  ⚠️  ¡ATENCIÓN! Múltiples filas con el mismo Idocupacion.');
        console.log('     Esto significa que el JOIN en getWeeklyServices DUPLICARÍA los items.');
        console.log('     Cada item se multiplicaría por', eventos.length, 'en el JOIN.');
        
        // Mostrar cómo quedaría
        console.log('\n     Resultado INCORRECTO del JOIN (items ×', eventos.length, 'filas):');
        const totalesInflados = {};
        for (const it of sinFecha) {
          const tipo = clasificarComida(it.subcategoria || it.nombre);
          if (!totalesInflados[tipo]) totalesInflados[tipo] = 0;
          totalesInflados[tipo] += (Number(it.cantidad) || 0) * eventos.length;
        }
        for (const [tipo, cant] of Object.entries(totalesInflados)) {
          console.log(`       ${tipo}: ${cant} (en lugar de ${Math.round(cant / eventos.length)})`);
        }
      }
    }
  }

  // 3. Resumen de comida como aparece en getEvents
  console.log('  📊 COMO APARECE EN getEvents (subconsultas sin fecha):');
  const totals = await conn.query(`
    SELECT
      (SELECT COALESCE(SUM(ice.cantidad), 0)
       FROM items_cotizacion_evento ice
       LEFT JOIN servicios s ON ice.id_servicio = s.id
       LEFT JOIN subcategorias_servicio sc ON s.id_subcategoria = sc.id
       WHERE ice.id_evento = ?
         AND LOWER(COALESCE(sc.nombre, ice.nombre)) LIKE '%desayuno%'
      ) AS cant_desayunos,
      (SELECT COALESCE(SUM(ice.cantidad), 0)
       FROM items_cotizacion_evento ice
       LEFT JOIN servicios s ON ice.id_servicio = s.id
       LEFT JOIN subcategorias_servicio sc ON s.id_subcategoria = sc.id
       WHERE ice.id_evento = ?
         AND LOWER(COALESCE(sc.nombre, ice.nombre)) LIKE '%refacciones%am%'
      ) AS cant_refacciones_am,
      (SELECT COALESCE(SUM(ice.cantidad), 0)
       FROM items_cotizacion_evento ice
       LEFT JOIN servicios s ON ice.id_servicio = s.id
       LEFT JOIN subcategorias_servicio sc ON s.id_subcategoria = sc.id
       WHERE ice.id_evento = ?
         AND LOWER(COALESCE(sc.nombre, ice.nombre)) LIKE '%almuerzo%'
      ) AS cant_almuerzos,
      (SELECT COALESCE(SUM(ice.cantidad), 0)
       FROM items_cotizacion_evento ice
       LEFT JOIN servicios s ON ice.id_servicio = s.id
       LEFT JOIN subcategorias_servicio sc ON s.id_subcategoria = sc.id
       WHERE ice.id_evento = ?
         AND LOWER(COALESCE(sc.nombre, ice.nombre)) LIKE '%refacciones%pm%'
      ) AS cant_refacciones_pm,
      (SELECT COALESCE(SUM(ice.cantidad), 0)
       FROM items_cotizacion_evento ice
       LEFT JOIN servicios s ON ice.id_servicio = s.id
       LEFT JOIN subcategorias_servicio sc ON s.id_subcategoria = sc.id
       WHERE ice.id_evento = ?
         AND LOWER(COALESCE(sc.nombre, ice.nombre)) LIKE '%cenas%'
      ) AS cant_cenas
  `, [idOcupacion, idOcupacion, idOcupacion, idOcupacion, idOcupacion]);

  const t = totals[0];
  console.log(`    Desayunos:    ${t.cant_desayunos}`);
  console.log(`    Ref. AM:      ${t.cant_refacciones_am}`);
  console.log(`    Almuerzos:    ${t.cant_almuerzos}`);
  console.log(`    Ref. PM:      ${t.cant_refacciones_pm}`);
  console.log(`    Cenas:        ${t.cant_cenas}`);
  console.log();

  // 4. Resolver duplicados
  console.log('  🔎 VERIFICACIÓN DE DUPLICADOS Idocupacion:');
  const dups = await conn.query(`
    SELECT Idocupacion, COUNT(*) AS filas, GROUP_CONCAT(DISTINCT DATE(FechaEvento) ORDER BY FechaEvento) AS fechas, GROUP_CONCAT(DISTINCT Salon) AS salones
    FROM tbl_seguimientocotizaciones
    WHERE Estatuscotizacion IN (4, 7, 8)
      AND Idocupacion = ?
    GROUP BY Idocupacion
    HAVING COUNT(*) > 1
  `, [idOcupacion]);
  
  if (dups.length > 0) {
    console.log(`    ⚠️  ¡Idocupacion ${idOcupacion} aparece ${dups[0].filas} veces!`);
    console.log(`       Fechas: ${dups[0].fechas}`);
    console.log(`       Salones: ${dups[0].salones}`);
    console.log('    Esto causa DUPLICACIÓN en el JOIN de getWeeklyServices.\n');
  } else {
    console.log('    ✅ Idocupacion único (sin duplicados en tbl_seguimientocotizaciones).\n');
  }

  console.log('══════════════════════════════════════════════');
}

function clasificarComida(nombre) {
  if (!nombre) return 'otros';
  const n = nombre.toLowerCase();
  if (n.includes('desayuno')) return 'desayunos';
  if (n.includes('refacciones') && n.includes('am')) return 'refacciones_am';
  if (n.includes('almuerzo')) return 'almuerzos';
  if (n.includes('refacciones') && n.includes('pm')) return 'refacciones_pm';
  if (n.includes('cena')) return 'cenas';
  return 'otros';
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
