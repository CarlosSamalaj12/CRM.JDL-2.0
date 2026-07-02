/**
 * Script de limpieza: Elimina items "Importado" de todas las cotizaciones.
 *
 * Uso: node scripts/cleanup_importado_items.cjs <TOKEN>
 * El TOKEN es el token JWT que está en localStorage (key: "token") del navegador.
 *
 * PASOS:
 * 1. Abre el CRM en el navegador
 * 2. Abre la consola (F12) y escribe: localStorage.getItem('token')
 * 3. Copia el token y ejecuta: node scripts/cleanup_importado_items.cjs <TOKEN>
 */

const http = require('http');
const https = require('https');
const url = require('url');

const API_BASE = process.env.VITE_API_URL || 'http://localhost:3000';
const token = process.argv[2];

if (!token) {
  console.error('❌ Debes proporcionar el token de autenticación.');
  console.error('   Abre el CRM, presiona F12 > Console y escribe:');
  console.error('   localStorage.getItem("token")');
  console.error('   Copia ese valor y ejecuta:');
  console.error('   node scripts/cleanup_importado_items.cjs <TOKEN>');
  process.exit(1);
}

function apiRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const parsed = url.parse(API_BASE);
    const transport = parsed.protocol === 'https:' ? https : http;
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path,
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };
    const req = transport.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

function hasImportadoItem(items) {
  if (!Array.isArray(items)) return false;
  return items.some((item) => {
    const name = String(item?.name || '').trim().toLowerCase();
    return name === 'importado';
  });
}

function removeImportadoItems(items) {
  if (!Array.isArray(items)) return [];
  return items.filter((item) => {
    const name = String(item?.name || '').trim().toLowerCase();
    return name !== 'importado';
  });
}

async function main() {
  console.log('🔍 Cargando estado desde el servidor...\n');

  const stateRes = await apiRequest('GET', '/api/state');
  if (stateRes.status !== 200) {
    console.error(`❌ Error al obtener estado: ${stateRes.status}`);
    console.error(stateRes.data);
    process.exit(1);
  }

  const state = stateRes.data?.state || stateRes.data;
  const events = Array.isArray(state.events) ? state.events : [];

  console.log(`📊 Total eventos: ${events.length}`);

  let eventsWithImportado = 0;
  let importadoItemsRemoved = 0;
  let totalVersionsFixed = 0;

  for (const ev of events) {
    const quote = ev?.quote;
    if (!quote || typeof quote !== 'object') continue;

    let changed = false;

    // Limpiar items principales
    if (hasImportadoItem(quote.items)) {
      const before = quote.items.length;
      quote.items = removeImportadoItems(quote.items);
      const removed = before - quote.items.length;
      importadoItemsRemoved += removed;
      changed = true;
      console.log(`  🧹 ${ev.id} (${ev.name || 'sin nombre'}): eliminados ${removed} item(s) "Importado" de items principales`);
    }

    // Limpiar versiones históricas
    const versions = Array.isArray(quote.versions) ? quote.versions : [];
    for (const ver of versions) {
      if (hasImportadoItem(ver.items)) {
        const before = ver.items.length;
        ver.items = removeImportadoItems(ver.items);
        const removed = before - ver.items.length;
        importadoItemsRemoved += removed;
        totalVersionsFixed += 1;
        changed = true;
        console.log(`  🧹 ${ev.id} v${ver.version || '?'}: eliminados ${removed} item(s) "Importado" de versión histórica`);
      }
    }

    // Si cambió el quote, recalcular totals solo si hay items
    if (changed && quote.items.length === 0 && (!versions.length || versions.every(v => v.items.length === 0))) {
      // Si después de limpiar no quedó nada, advertir pero no eliminar la cotización
      console.log(`  ⚠️  ${ev.id}: la cotización quedó sin items después de la limpieza`);
    }
    if (changed) eventsWithImportado += 1;
  }

  console.log(`\n📋 Resumen:`);
  console.log(`   Eventos afectados: ${eventsWithImportado}`);
  console.log(`   Items "Importado" eliminados: ${importadoItemsRemoved}`);
  console.log(`   Versiones históricas limpiadas: ${totalVersionsFixed}`);

  if (eventsWithImportado === 0) {
    console.log('\n✅ No se encontraron items "Importado" en ninguna cotización.');
    return;
  }

  console.log('\n💾 Guardando cambios en el servidor...');
  const saveRes = await apiRequest('PUT', '/api/state', { state });

  if (saveRes.status === 200) {
    console.log('\n✅ ¡Limpieza completada exitosamente!');
    console.log(`   Se eliminaron ${importadoItemsRemoved} items "Importado" de ${eventsWithImportado} evento(s).`);
    console.log('\n💡 Recarga el CRM en el navegador para ver los cambios.');
  } else {
    console.error(`\n❌ Error al guardar: ${saveRes.status}`);
    console.error(saveRes.data);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('❌ Error inesperado:', err);
  process.exit(1);
});
