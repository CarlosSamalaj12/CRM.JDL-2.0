/**
 * Script de migración: Convierte IDs de eventos antiguos (largos) al nuevo formato corto.
 *
 * Formato nuevo: evt_ + 8 chars hex (ej: evt_a1b2c3d4)
 * IDs expandidos: evt_a1b2c3d4_s1_20260620
 *
 * Uso: node scripts/migrate-event-ids.cjs
 */

const http = require('http');

const API_BASE = 'http://localhost:3000';

function uid(prefix = 'evt') {
  return `${prefix}_${Math.random().toString(16).slice(2, 10)}`;
}

function isOldLongId(id) {
  // IDs nuevos miden ~12 chars (evt_XXXXXXXX). IDs viejos son mucho más largos.
  const baseId = id.replace(/_(s|slot)\d+_\d{6,}$/, '');
  return baseId.length > 16;
}

function buildExpandedId(baseId, slotIdx, date) {
  const cleanDate = date.replace(/-/g, '');
  return `${baseId}_s${slotIdx + 1}_${cleanDate}`;
}

async function fetchState() {
  return new Promise((resolve, reject) => {
    http.get(`${API_BASE}/api/state`, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed?.state || parsed || {});
        } catch (e) {
          reject(new Error(`Error parsing state: ${e.message}`));
        }
      });
    }).on('error', reject);
  });
}

async function saveState(state) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ state });
    const req = http.request(`${API_BASE}/api/state`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ raw: data });
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log('🔍 Obteniendo estado actual...');
  const state = await fetchState();

  const events = Array.isArray(state.events) ? state.events : [];
  const changeHistory = (state.changeHistory && typeof state.changeHistory === 'object') ? state.changeHistory : {};
  const reminders = (state.reminders && typeof state.reminders === 'object') ? state.reminders : {};

  console.log(`📊 Eventos encontrados: ${events.length}`);

  // Identificar grupos de eventos que necesitan migración
  const groupsToMigrate = new Map(); // oldBaseId -> group events

  for (const ev of events) {
    const rawId = String(ev.id || '');
    // Limpiar sufijo de expansión para obtener el baseId
    const baseId = rawId.replace(/_(s|slot)\d+_\d{6,}$/, '');
    if (isOldLongId(baseId)) {
      if (!groupsToMigrate.has(baseId)) {
        groupsToMigrate.set(baseId, []);
      }
      groupsToMigrate.get(baseId).push(ev);
    }
  }

  if (groupsToMigrate.size === 0) {
    console.log('✅ No hay IDs antiguos que migrar.');
    return;
  }

  console.log(`🔄 Grupos a migrar: ${groupsToMigrate.size}`);

  // Mapa de old baseId -> new baseId
  const idMap = new Map();

  for (const [oldBaseId, groupEvents] of groupsToMigrate) {
    const newBaseId = uid('evt');
    idMap.set(oldBaseId, newBaseId);
    console.log(`  ${oldBaseId} → ${newBaseId} (${groupEvents.length} eventos)`);
  }

  // Reemplazar IDs en eventos
  let migratedCount = 0;
  const updatedEvents = events.map((ev) => {
    const rawId = String(ev.id || '');
    const oldBaseId = rawId.replace(/_(s|slot)\d+_\d{6,}$/, '');
    const suffix = rawId.slice(oldBaseId.length); // ej: _s1_20260618

    if (idMap.has(oldBaseId)) {
      const newBaseId = idMap.get(oldBaseId);
      const newId = suffix ? `${newBaseId}${suffix}` : newBaseId;
      migratedCount++;
      return { ...ev, id: newId, groupId: newBaseId };
    }
    // Si el evento ya tiene grupo pero el base cambió, actualizar groupId
    if (ev.groupId && idMap.has(String(ev.groupId))) {
      return { ...ev, groupId: idMap.get(String(ev.groupId)) };
    }
    return ev;
  });

  console.log(`✅ Eventos actualizados: ${migratedCount}`);

  // Reemplazar claves en changeHistory
  const updatedChangeHistory = {};
  for (const [key, entries] of Object.entries(changeHistory)) {
    if (!Array.isArray(entries)) {
      updatedChangeHistory[key] = entries;
      continue;
    }
    const oldBaseId = key.replace(/_(s|slot)\d+_\d{6,}$/, '');
    const suffix = key.slice(oldBaseId.length);
    if (idMap.has(oldBaseId)) {
      const newKey = suffix ? `${idMap.get(oldBaseId)}${suffix}` : idMap.get(oldBaseId);
      updatedChangeHistory[newKey] = entries;
      console.log(`  📋 changeHistory: ${key} → ${newKey}`);
    } else {
      updatedChangeHistory[key] = entries;
    }
  }

  // Reemplazar claves en reminders
  const updatedReminders = {};
  for (const [key, entries] of Object.entries(reminders)) {
    const oldBaseId = key.replace(/_(s|slot)\d+_\d{6,}$/, '');
    const suffix = key.slice(oldBaseId.length);
    if (idMap.has(oldBaseId)) {
      const newKey = suffix ? `${idMap.get(oldBaseId)}${suffix}` : idMap.get(oldBaseId);
      updatedReminders[newKey] = entries;
      console.log(`  🔔 reminders: ${key} → ${newKey}`);
    } else {
      updatedReminders[key] = entries;
    }
  }

  const updatedState = {
    ...state,
    events: updatedEvents,
    changeHistory: updatedChangeHistory,
    reminders: updatedReminders,
  };

  console.log('💾 Guardando estado migrado...');
  const result = await saveState(updatedState);

  if (result.ok === true) {
    console.log('✅ Migración completada exitosamente.');
  } else {
    console.log('⚠️ Respuesta del servidor:', JSON.stringify(result));
  }

  // Verificación final
  console.log('\n🔍 Verificando IDs después de la migración...');
  const finalEvents = updatedEvents.filter(e => isOldLongId(String(e.id || '').replace(/_(s|slot)\d+_\d{6,}$/, '')));
  if (finalEvents.length === 0) {
    console.log('✅ Todos los IDs están en el nuevo formato corto.');
  } else {
    console.log(`⚠️ Quedan ${finalEvents.length} eventos con IDs largos:`);
    finalEvents.forEach(e => console.log(`  ${e.id}`));
  }
}

main().catch((err) => {
  console.error('❌ Error en migración:', err.message);
  process.exit(1);
});
