import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();

test('ReportsVentas.jsx define estructura moderna de columnas visibles sin inputs de checkbox desfigurados', () => {
  const ventasPath = path.join(projectRoot, 'src', 'modules', 'reports', 'ReportsVentas.jsx');
  const code = fs.readFileSync(ventasPath, 'utf8');

  // Verifica que existe la lista de definiciones enriquecida
  assert.ok(code.includes('COLUMN_DEFINITIONS = ['), 'Debe definir COLUMN_DEFINITIONS');
  assert.ok(code.includes('DEFAULT_VISIBLE_COLUMNS = {'), 'Debe definir DEFAULT_VISIBLE_COLUMNS');
  assert.ok(code.includes('STORAGE_KEY_VENTAS_COLUMNS'), 'Debe persistir en localStorage con clave dedicada');

  // Verifica que NO se usan inputs checkbox crudos en el modal que sufran distorsión global
  assert.ok(!code.includes('type="checkbox"\n                    checked={visibleColumns'), 'NO debe usar input checkbox crudo vulnerable a distorsión de CSS');

  // Verifica acciones rápidas
  assert.ok(code.includes('handleSelectAllColumns'), 'Debe tener acción para mostrar todas');
  assert.ok(code.includes('handleSelectMinimalColumns'), 'Debe tener acción para columnas esenciales');
  assert.ok(code.includes('handleResetColumns'), 'Debe tener acción para restablecer');

  // Verifica protección contra deseleccionar todas
  assert.ok(code.includes('currentActiveCount <= 1'), 'Debe proteger para evitar dejar la tabla sin columnas');

  // Verifica insignia de conteo dinámico en el botón de la tabla
  assert.ok(code.includes('{visibleCount}/{totalColumns}'), 'Debe mostrar el conteo de columnas activas en el botón de la tabla');

  // Verifica soporte de tecla Escape
  assert.ok(code.includes("e.key === 'Escape'"), 'Debe cerrar el modal al presionar Escape');
});
