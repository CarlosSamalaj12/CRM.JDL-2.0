import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();

test('auth.js exporta optionalAuthenticate para rutas que admiten token sin bloquear clientes públicos', () => {
  const authPath = path.join(ROOT_DIR, 'backend/src/middlewares/auth.js');
  const authContent = fs.readFileSync(authPath, 'utf8');

  assert.ok(authContent.includes('export function optionalAuthenticate'), 'auth.js debe exportar optionalAuthenticate');
  assert.ok(authContent.includes('req.user = decoded;'), 'optionalAuthenticate debe decodificar y asignar req.user');
});

test('informeRoutes.js protege GET /:id con optionalAuthenticate para permitir lectura de versiones a usuarios autenticados', () => {
  const routesPath = path.join(ROOT_DIR, 'backend/src/routes/informeRoutes.js');
  const routesContent = fs.readFileSync(routesPath, 'utf8');

  assert.ok(routesContent.includes("import { authenticate, optionalAuthenticate, authorizeRoles }"), 'informeRoutes.js debe importar optionalAuthenticate');
  assert.ok(routesContent.includes("router.get('/:id', optionalAuthenticate, informeController.getInformeById);"), 'GET /:id debe usar optionalAuthenticate');
  assert.ok(routesContent.includes("router.get('/por-evento', optionalAuthenticate, informeController.getInformeByEventFields);"), 'GET /por-evento debe usar optionalAuthenticate');
});

test('informeController.js implementa canUserViewAllVersions normalizando roles y permitiendo a Admin, Vendedor, FrontOffice, Eventos y Coordinador', () => {
  const controllerPath = path.join(ROOT_DIR, 'backend/src/controllers/informeController.js');
  const controllerContent = fs.readFileSync(controllerPath, 'utf8');

  assert.ok(controllerContent.includes('function canUserViewAllVersions'), 'informeController.js debe implementar canUserViewAllVersions');
  assert.ok(controllerContent.includes("'admin', 'vendedor', 'frontoffice', 'recepcionista', 'eventos', 'coordinador'"), 'canUserViewAllVersions debe permitir todos los roles del CRM');

  // getInformeById debe usar canUserViewAllVersions
  const getByIdMatch = controllerContent.match(/export async function getInformeById[\s\S]*?\{([\s\S]*?)const isNumeric/);
  assert.ok(getByIdMatch, 'getInformeById debe existir');
  assert.ok(getByIdMatch[1].includes('canUserViewAllVersions(req.user)'), 'getInformeById debe usar canUserViewAllVersions');

  // getInformesByOcupacion debe usar canUserViewAllVersions
  const getByOcupMatch = controllerContent.match(/export async function getInformesByOcupacion[\s\S]*?\{([\s\S]*?)let query/);
  assert.ok(getByOcupMatch, 'getInformesByOcupacion debe existir');
  assert.ok(getByOcupMatch[1].includes('canUserViewAllVersions(req.user)'), 'getInformesByOcupacion debe usar canUserViewAllVersions');
});

