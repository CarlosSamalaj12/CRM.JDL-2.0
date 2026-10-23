import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test('UserModal.jsx: blindaje contra null en backdrop y sincronización con isOpen', () => {
  const content = fs.readFileSync(path.join(rootDir, 'src/modules/settings/UserModal.jsx'), 'utf8');

  // 1. Debe existir backdropRef y estado isOpen
  assert.ok(content.includes('const backdropRef = useRef(null);'), 'UserModal debe definir backdropRef');
  assert.ok(content.includes('const [isOpen, setIsOpen] = useState(false);'), 'UserModal debe definir estado isOpen');

  // 2. handleClose debe verificar backdrop defensivamente antes de acceder a .hidden
  assert.ok(
    content.includes('if (backdrop) {') && content.includes('backdrop.hidden = true;'),
    'handleClose debe verificar existencia de backdrop antes de mutar hidden'
  );
  assert.ok(
    !content.includes("document.getElementById('userBackdrop').hidden = true;"),
    'No debe existir document.getElementById(userBackdrop).hidden = true sin chequeo'
  );

  // 3. handleClose debe sincronizar setIsOpen(false)
  assert.ok(content.includes('setIsOpen(false);'), 'handleClose debe actualizar setIsOpen(false)');

  // 4. El JSX debe enlazar ref={backdropRef} y hidden={!isOpen}
  assert.ok(content.includes('ref={backdropRef}'), 'Backdrop debe incluir ref={backdropRef}');
  assert.ok(content.includes('hidden={!isOpen}'), 'Backdrop debe sincronizar atributo hidden con !isOpen');
});

test('CompanyModal.jsx: blindaje contra null en companyBackdrop', () => {
  const content = fs.readFileSync(path.join(rootDir, 'src/modules/settings/CompanyModal.jsx'), 'utf8');
  assert.ok(
    content.includes('const backdrop = document.getElementById(\'companyBackdrop\');') &&
    content.includes('if (backdrop) backdrop.hidden = true;'),
    'CompanyModal debe verificar backdrop antes de mutar hidden'
  );
});

test('stateService.js: preservación de caché ante errores HTTP en loadState', () => {
  const content = fs.readFileSync(path.join(rootDir, 'src/services/stateService.js'), 'utf8');

  // Debe verificar !response.ok y retornar cachedState sin corromperlo
  assert.ok(content.includes('if (!response.ok) {'), 'loadState debe verificar if (!response.ok)');
  assert.ok(content.includes('Preservando estado en caché'), 'loadState debe advertir y preservar caché');
  assert.ok(content.includes('Array.isArray(state.users)'), 'loadState debe verificar estructura válida antes de guardar en caché');
});

test('SettingsUsers.jsx: tolerancia a fallos en equipos y arrays seguros', () => {
  const content = fs.readFileSync(path.join(rootDir, 'src/modules/settings/SettingsUsers.jsx'), 'utf8');

  // getEquipos no debe romper fetchUsersAndTeams si falla
  assert.ok(content.includes('getEquipos().catch('), 'SettingsUsers debe capturar error en getEquipos()');
  // safeEquipos y safeUsers previenen crashes en sorting y filtering
  assert.ok(content.includes('const safeEquipos = Array.isArray(equipos) ? equipos : [];'), 'SettingsUsers debe proteger safeEquipos');
  assert.ok(content.includes('const safeUsers = Array.isArray(users) ? users : [];'), 'SettingsUsers debe proteger safeUsers');
});

test('server.cjs: readStateFromTables preserva usuarios con nombre o nombre_completo', () => {
  const content = fs.readFileSync(path.join(rootDir, 'server.cjs'), 'utf8');

  assert.ok(
    content.includes('name: str(u.nombre || u.nombre_completo)'),
    'readStateFromTables debe resolver name con fallback a u.nombre_completo'
  );
  assert.ok(
    content.includes('fullName: str(u.nombre_completo || u.nombre)'),
    'readStateFromTables debe resolver fullName con fallback a u.nombre'
  );
  assert.ok(
    content.includes('.filter((u) => u.id && (u.name || u.fullName))'),
    'readStateFromTables debe filtrar verificando u.name o u.fullName'
  );
});
