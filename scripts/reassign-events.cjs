const http = require('http');

const API_BASE = 'http://localhost:3000';
const OLD_USER_ID = 'Keg6VRrMFLdJK9aslxy7sG2mxFI2';
const NEW_USER_ID = 'usr_1781742734393';

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`Error parseando JSON: ${e.message}`)); }
      });
    }).on('error', reject);
  });
}

function putJson(url, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/state',
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    };
    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(responseData)); }
        catch (e) { reject(new Error(`Error parseando respuesta: ${e.message}`)); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log('🔍 Obteniendo estado actual...');
  const response = await fetchJson(`${API_BASE}/api/state`);
  const state = response?.state || response;
  
  if (!state || !state.events) {
    console.error('❌ No se pudo obtener el estado de la API');
    process.exit(1);
  }

  const orphaned = state.events.filter(ev => String(ev.userId || '').trim() === OLD_USER_ID);
  
  if (orphaned.length === 0) {
    console.log('✅ No hay eventos con el ID huérfano. Nada que reasignar.');
    process.exit(0);
  }

  console.log(`📋 Encontrados ${orphaned.length} eventos con userId = ${OLD_USER_ID}:`);
  orphaned.forEach(ev => {
    console.log(`   - [${ev.id}] ${ev.name || 'Sin nombre'} | ${ev.date || '?'} | ${ev.salon || '?'}`);
  });

  // Reasignar
  const updatedEvents = state.events.map(ev => {
    if (String(ev.userId || '').trim() === OLD_USER_ID) {
      return { ...ev, userId: NEW_USER_ID };
    }
    return ev;
  });

  // Guardar
  const updatedState = { ...state, events: updatedEvents };
  
  console.log(`\n💾 Guardando estado con ${orphaned.length} eventos reasignados a ${NEW_USER_ID}...`);
  
  // PUT the state back
  const result = await putJson('/api/state', { state: updatedState });
  
  if (result && result.ok !== false) {
    console.log(`✅ Reasignación completada: ${orphaned.length} eventos actualizados.`);
  } else {
    console.log(`⚠️ Respuesta del servidor:`, JSON.stringify(result).slice(0, 500));
  }
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
