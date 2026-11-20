import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test('Lógica pura de filtrado de vendedores y administradores activos', () => {
  const mockUsers = [
    { id: 1, name: 'Carlos Morales', role: 'vendedor', active: true },
    { id: 2, name: 'Andrea Gómez', role: 'vendedor', active: true },
    { id: 3, name: 'Usuario Desactivado', role: 'vendedor', active: false },
    { id: 4, name: 'Admin General', role: 'admin', active: true },
    { id: 5, name: 'Admin Inactivo', role: 'admin', active: false },
    { id: 6, name: 'Recepcionista', role: 'recepcionista', active: true },
    { id: 7, name: 'Vendedor Legacy', role: 'Vendedor', active: undefined } // active no false = activo
  ];

  const filterActiveUsersForReservation = (users) => {
    return (users || []).filter(u => {
      const role = String(u.role || u.rol || '').trim().toLowerCase();
      const isActive = u.active !== false;
      return (role === 'vendedor' || role === 'admin') && isActive;
    });
  };

  const activeAllowedUsers = filterActiveUsersForReservation(mockUsers);

  assert.strictEqual(activeAllowedUsers.length, 4, 'Debe incluir vendedores y administradores activos (4 en total)');
  assert.ok(activeAllowedUsers.some(u => u.name === 'Carlos Morales'));
  assert.ok(activeAllowedUsers.some(u => u.name === 'Andrea Gómez'));
  assert.ok(activeAllowedUsers.some(u => u.name === 'Admin General'), 'Debe incluir al administrador activo');
  assert.ok(activeAllowedUsers.some(u => u.name === 'Vendedor Legacy'));
  assert.ok(!activeAllowedUsers.some(u => u.name === 'Usuario Desactivado'), 'No debe incluir vendedores desactivados');
  assert.ok(!activeAllowedUsers.some(u => u.name === 'Admin Inactivo'), 'No debe incluir admins desactivados');
  assert.ok(!activeAllowedUsers.some(u => u.name === 'Recepcionista'), 'No debe incluir recepcionistas');
});

test('SellerSelector.jsx y sellerSelector.css existen y contienen las directivas de Stitch MCP', () => {
  const componentPath = path.join(rootDir, 'src', 'modules', 'calendar', 'components', 'SellerSelector.jsx');
  const cssPath = path.join(rootDir, 'src', 'modules', 'calendar', 'components', 'sellerSelector.css');

  assert.ok(fs.existsSync(componentPath), 'SellerSelector.jsx debe existir');
  assert.ok(fs.existsSync(cssPath), 'sellerSelector.css debe existir');

  const compCode = fs.readFileSync(componentPath, 'utf-8');
  assert.ok(compCode.includes("(role === 'vendedor' || role === 'admin') && isActive"), 'Debe filtrar role vendedor y admin activos');
  assert.ok(compCode.includes('isHistoricalUser'), 'Debe contemplar usuarios históricos inactivos');
  assert.ok(compCode.includes('createPortal'), 'Debe usar createPortal para evitar cortes de overflow');
  assert.ok(compCode.includes('searchQuery'), 'Debe contar con buscador en tiempo real');
  assert.ok(compCode.includes('ADMIN'), 'Debe contar con badge distintivo para ADMIN');
});

test('ReservationForm.jsx integra SellerSelector en Desktop y Mobile', () => {
  const resFormPath = path.join(rootDir, 'src', 'modules', 'calendar', 'components', 'ReservationForm.jsx');
  const resCode = fs.readFileSync(resFormPath, 'utf-8');

  assert.ok(resCode.includes("import SellerSelector from './SellerSelector'"), 'Debe importar SellerSelector');
  assert.ok(resCode.includes('<SellerSelector'), 'Debe montar SellerSelector');
  assert.ok(resCode.includes('isMobile={true}'), 'Debe contemplar la variante móvil');
  assert.ok(!resCode.includes('className="res-bento-user-select"'), 'No debe tener el select nativo obsoleto en Desktop');
});

test('Filtros en Topbar, PosiblesVentas, Customers, Search y Reports exigen usuarios activos con rol vendedor', () => {
  const topbarPath = path.join(rootDir, 'src', 'layouts', 'MainLayout', 'components', 'Topbar.jsx');
  const topbarCode = fs.readFileSync(topbarPath, 'utf-8');
  assert.ok(topbarCode.includes("r === 'vendedor' && isActive"), 'Topbar debe filtrar solo vendedores activos');

  const pvPath = path.join(rootDir, 'src', 'modules', 'posiblesVentas', 'PosiblesVentasModule.jsx');
  const pvCode = fs.readFileSync(pvPath, 'utf-8');
  assert.ok(pvCode.includes("r === 'vendedor' && isActive"), 'Posibles Ventas debe filtrar solo vendedores activos');

  const custPath = path.join(rootDir, 'src', 'modules', 'customers', 'CustomersModule.jsx');
  const custCode = fs.readFileSync(custPath, 'utf-8');
  assert.ok(custCode.includes("role === 'vendedor' && isActive"), 'Customers debe filtrar solo vendedores activos');

  const searchPath = path.join(rootDir, 'src', 'modules', 'search', 'SearchModule.jsx');
  const searchCode = fs.readFileSync(searchPath, 'utf-8');
  assert.ok(searchCode.includes("r === 'vendedor' && isActive"), 'Search debe filtrar solo vendedores activos');

  const repVentasPath = path.join(rootDir, 'src', 'modules', 'reports', 'ReportsVentas.jsx');
  const repVentasCode = fs.readFileSync(repVentasPath, 'utf-8');
  assert.ok(repVentasCode.includes("r === 'vendedor' && isActive"), 'ReportsVentas debe filtrar solo vendedores activos');
});
