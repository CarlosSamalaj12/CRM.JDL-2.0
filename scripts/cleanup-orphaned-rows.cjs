/**
 * Script para limpiar datos huérfanos después de la migración de IDs de eventos.
 * 
 * Busca y elimina filas en eventos, cotizaciones, etc. que tengan IDs antiguos
 * que ya no existen en el estado actual.
 * 
 * Uso: node scripts/cleanup-orphaned-rows.cjs
 */

const http = require('http');
const mariadb = require('mariadb');

// Usar la misma config que server.cjs
const DB_PORT = Number(process.env.DB_PORT || 3306);
const DB_PASSWORD = process.env.DB_PASSWORD || '';

const DB_CONFIG = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: DB_PORT,
  user: process.env.DB_USER || 'root',
  password: DB_PASSWORD,
  database: process.env.DB_NAME || 'crm_jdl',
  collation: 'utf8mb4_unicode_ci',
};

const TABLES = [
  { name: 'eventos', idColumn: 'id' },
  { name: 'cotizaciones_evento', idColumn: 'id_evento' },
  { name: 'items_cotizacion_evento', idColumn: 'id_evento' },
  { name: 'cotizacion_versiones_evento', idColumn: 'id_evento' },
  { name: 'items_cotizacion_version_evento', idColumn: 'id_evento' },
  { name: 'anticipos_evento', idColumn: 'id_evento' },
  { name: 'recordatorios_evento', idColumn: 'clave_evento' },
];

function fetchState() {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:3000/api/state', (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed?.state || parsed || {});
        } catch (e) {
          reject(new Error('Error parsing state: ' + e.message));
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log('🔍 Obteniendo IDs activos desde el estado...');
  const state = await fetchState();
  const events = Array.isArray(state.events) ? state.events : [];

  const activeIds = new Set();
  for (const ev of events) {
    activeIds.add(String(ev.id));
    if (ev.groupId) activeIds.add(String(ev.groupId));
  }

  console.log('IDs activos (' + activeIds.size + '):');
  activeIds.forEach((id) => console.log('  ' + id));

  let conn;
  try {
    conn = await mariadb.createConnection(DB_CONFIG);

    let totalDeleted = 0;

    for (const table of TABLES) {
      const col = table.idColumn;

      // Count orphaned rows
      const countRows = await conn.query(
        'SELECT COUNT(*) as cnt FROM `' + table.name + '` WHERE `' + col + '` NOT IN (?)',
        [Array.from(activeIds)]
      );
      const orphanedCount = Number(countRows[0].cnt);

      if (orphanedCount === 0) {
        console.log('  ' + table.name + ': 0 huérfanos ✅');
        continue;
      }

      // Show them before deleting
      const orphanedRows = await conn.query(
        'SELECT `' + col + '`, LEFT(`' + col + '`, 60) as short_id FROM `' + table.name + '` WHERE `' + col + '` NOT IN (?) LIMIT 10',
        [Array.from(activeIds)]
      );

      console.log('  ' + table.name + ': ' + orphanedCount + ' huérfanos:');
      for (const row of orphanedRows) {
        console.log('    ' + row.short_id);
      }

      // Delete them
      const delResult = await conn.query(
        'DELETE FROM `' + table.name + '` WHERE `' + col + '` NOT IN (?)',
        [Array.from(activeIds)]
      );
      totalDeleted += orphanedCount;
      console.log('    → Eliminados ✅');
    }

    console.log('\n🧹 Total filas huérfanas eliminadas: ' + totalDeleted);

    // Also check historial_evento for orphaned keys
    const histCount = await conn.query(
      'SELECT COUNT(*) as cnt FROM historial_evento WHERE clave_evento NOT IN (?)',
      [Array.from(activeIds)]
    );
    const histOrphaned = Number(histCount[0].cnt);
    if (histOrphaned > 0) {
      const histRows = await conn.query(
        'SELECT clave_evento FROM historial_evento WHERE clave_evento NOT IN (?) LIMIT 5',
        [Array.from(activeIds)]
      );
      console.log('\n⚠️ historial_evento: ' + histOrphaned + ' huérfanos:');
      for (const row of histRows) {
        console.log('  ' + row.clave_evento);
      }
      await conn.query(
        'DELETE FROM historial_evento WHERE clave_evento NOT IN (?)',
        [Array.from(activeIds)]
      );
      console.log('  → Eliminados ✅');
    } else {
      console.log('\nhistorial_evento: 0 huérfanos ✅');
    }

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    if (conn) conn.end();
  }
}

main();
