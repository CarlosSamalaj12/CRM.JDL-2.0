const mariadb = require('mariadb');
async function main() {
  const pool = mariadb.createPool({
    host: '127.0.0.1', port: 3306, user: 'root', password: 'Xvfv2du1p5xyZX', database: 'crm_jdl', connectTimeout: 5000
  });
  const conn = await pool.getConnection();

  console.log('╔═══════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║        ENCARGADOS EMPRESA CORRUPTOS (id y nombre invertidos)                ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════════════════╝\n');

  const bad = await conn.query(`
    SELECT id AS incorrecto_id, id_empresa AS incorrecto_id_empresa, nombre AS incorrecto_nombre, telefono
    FROM encargados_empresa
    WHERE nombre REGEXP '^[0-9]+$'
    ORDER BY CAST(nombre AS UNSIGNED)
  `);

  console.log(`Total corrupto: ${bad.length}\n`);
  console.log('  # | ID (actual)                | Nombre (actual)          | ID Empresa | Telefono');
  console.log(' ---|----------------------------|---------------------------|------------|----------');
  for (let i = 0; i < bad.length; i++) {
    const r = bad[i];
    console.log(
      `  ${String(i + 1).padStart(2)} | ${String(r.incorrecto_id).padEnd(26)} | ${String(r.incorrecto_nombre).padEnd(25)} | ${String(r.incorrecto_id_empresa).padEnd(10)} | ${r.telefono || '-'}`
    );
  }

  console.log('\n\n╔═══════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║  COTIZACIONES QUE REFERENCIAN ENCARGADOS CORRUPTOS                        ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════════════════╝\n');

  const quotes = await conn.query(`
    SELECT c.id_evento, c.id_encargado, c.nombre_encargado, e.nombre AS evento_nombre
    FROM cotizaciones_evento c
    LEFT JOIN eventos e ON c.id_evento = e.id
    WHERE c.id_encargado IN (
      SELECT id FROM encargados_empresa WHERE nombre REGEXP '^[0-9]+$'
    )
    ORDER BY c.id_encargado
  `);

  console.log(`Total cotizaciones afectadas: ${quotes.length}\n`);
  for (const q of quotes) {
    console.log(`  Evento: "${q.evento_nombre || q.id_evento}"`);
    console.log(`  id_encargado en cotizacion: "${q.id_encargado}"`);
    console.log('  ---');
  }

  await conn.release();
  await pool.end();
}
main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
