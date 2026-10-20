import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

test('posiblesVentasController.js previene duplicación de filas en eventos multi-slot (sin id_grupo en JOIN)', () => {
  const code = fs.readFileSync(path.join(projectRoot, 'backend/src/controllers/posiblesVentasController.js'), 'utf8');

  // 1. LINKED_EVENT_JOIN debe unir por id primario y baseId, pero NUNCA por id_grupo
  assert.ok(code.includes('e_direct.id = pv.evento_id'), 'Debe unir por e_direct.id');
  assert.ok(code.includes("SUBSTRING_INDEX(pv.evento_id, '_s', 1)"), 'Debe soportar baseId sin sufijo _s');
  assert.ok(!code.includes('e_direct.id_grupo = pv.evento_id'), 'NO debe contener e_direct.id_grupo en LINKED_EVENT_JOIN para evitar duplicación');
});

test('PosiblesVentasModule.jsx elimina botón Sincronizar, deduplica leads y sincroniza paginación en filtros', () => {
  const code = fs.readFileSync(path.join(projectRoot, 'src/modules/posiblesVentas/PosiblesVentasModule.jsx'), 'utf8');

  // 1. Botón Sincronizar eliminado (se actualiza automáticamente por WebSockets)
  assert.ok(!code.includes('Sincronizar\n'), 'No debe renderizar botón de texto Sincronizar');
  assert.ok(!code.includes('>Sincronizar<'), 'No debe haber botón con etiqueta Sincronizar');

  // 2. Deduplicación defensiva en loadLeads
  assert.ok(code.includes('new Map()'), 'loadLeads debe usar Map o Set para deduplicar por ID');

  // 3. Paginación segura con safePage clamp
  assert.ok(code.includes('safePage = Math.min'), 'paginatedLeads debe acotar safePage con Math.min');

  // 4. Reseteo de currentPage en clics de pestañas de estado
  assert.ok(code.includes("setEstadoFilter('all'); setCurrentPage(1);"), 'Todos debe reiniciar a página 1');
  assert.ok(code.includes("setEstadoFilter(e.key); setCurrentPage(1);"), 'Pestañas de estado deben reiniciar a página 1');

  // 5. Aislamiento estricto de leads eliminados y no contaminación de leads activos
  assert.ok(code.includes('!item.deletedAt'), 'loadLeads debe excluir prospectos eliminados');
  assert.ok(code.includes('!l.deletedAt'), 'filteredLeads debe excluir defensivamente cualquier lead con deletedAt');

  // 6. Contenedores y tarjetas con keys unívocas para prevenir colisión y congelamiento de React
  assert.ok(code.includes('pv-view-activas'), 'Contenedor activo debe tener key unívoca para forzar reconciliación limpia');
  assert.ok(code.includes('pv-view-eliminadas'), 'Contenedor de eliminadas debe tener key unívoca');
  assert.ok(code.includes('pv-active-lead-'), 'Tarjetas activas deben tener prefijo unívoco en key');
  assert.ok(code.includes('pv-deleted-lead-'), 'Tarjetas eliminadas deben tener prefijo unívoco en key');
  assert.ok(code.includes("setVista('activas'); setEstadoFilter('ganada');"), 'Clic en KPI Ganada debe activar vista activas');
});
