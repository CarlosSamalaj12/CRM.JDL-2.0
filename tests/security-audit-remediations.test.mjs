import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('Seguridad: Rutas de imágenes prohíben archivos SVG para evitar Stored XSS', () => {
  const fileContent = fs.readFileSync(path.resolve('backend/src/routes/imagenesRoutes.js'), 'utf-8');
  assert.ok(!fileContent.includes('svg|') && !fileContent.includes('.svg'), 'imagenesRoutes.js no debe permitir extensiones .svg en el regex de subida');
  assert.ok(fileContent.includes('jpg|jpeg|png|gif|webp|bmp'), 'imagenesRoutes.js debe permitir formatos de imagen seguros');
});

test('Seguridad: Routers backend (events, catalogs, platillos, tareas) aplican autenticación obligatoria', () => {
  const routesToTest = [
    'backend/src/routes/events.js',
    'backend/src/routes/catalogRoutes.js',
    'backend/src/routes/platilloRoutes.js',
    'backend/src/routes/tareasRoutes.js',
    'backend/src/routes/tareasSemanalesRoutes.js'
  ];

  for (const relPath of routesToTest) {
    const content = fs.readFileSync(path.resolve(relPath), 'utf-8');
    assert.ok(
      content.includes('router.use(authenticate)'),
      `${relPath} debe montar router.use(authenticate) como middleware global`
    );
  }
});

test('Seguridad: Rutas de administración de usuarios exigen rol Admin', () => {
  const userRoutesContent = fs.readFileSync(path.resolve('backend/src/routes/userRoutes.js'), 'utf-8');
  assert.ok(userRoutesContent.includes("authorizeRoles('Admin')"), 'userRoutes.js debe proteger rutas sensibles con authorizeRoles(Admin)');
  
  const serverContent = fs.readFileSync(path.resolve('server.cjs'), 'utf-8');
  assert.ok(serverContent.includes('app.post("/api/users", authenticateJWT, requireRole("admin")'), 'server.cjs debe proteger POST /api/users con requireRole admin');
  assert.ok(serverContent.includes('app.delete("/api/users/:id", authenticateJWT, requireRole("admin")'), 'server.cjs debe proteger DELETE /api/users/:id con requireRole admin');
  assert.ok(serverContent.includes('app.put("/api/users/:id/toggle-active", authenticateJWT, requireRole("admin")'), 'server.cjs debe proteger toggle-active con requireRole admin');
});

test('Seguridad: Endpoints críticos de estado y empresas están protegidos con JWT', () => {
  const serverContent = fs.readFileSync(path.resolve('server.cjs'), 'utf-8');
  assert.ok(serverContent.includes('app.get("/api/state", authenticateJWT'), 'server.cjs debe proteger GET /api/state con authenticateJWT');
  assert.ok(serverContent.includes('app.put("/api/state", authenticateJWT'), 'server.cjs debe proteger PUT /api/state con authenticateJWT');
  assert.ok(serverContent.includes('app.delete("/api/companies/:id", authenticateJWT, requireRole("admin")'), 'server.cjs debe proteger DELETE /api/companies/:id con admin');
  assert.ok(serverContent.includes('app.get("/api/anticipos/:id/evidencia", authenticateJWT'), 'server.cjs debe proteger evidencia con authenticateJWT');
});

test('Seguridad: Renderizado de impresión aplica Content Security Policy estricto y permite impresión', () => {
  const serverContent = fs.readFileSync(path.resolve('server.cjs'), 'utf-8');
  assert.ok(serverContent.includes("app.post(\"/api/print/prepare\", authenticateJWT"), 'server.cjs debe proteger POST /api/print/prepare');
  assert.ok(serverContent.includes("Content-Security-Policy"), 'server.cjs debe emitir Content-Security-Policy en render/:id');
  assert.ok(serverContent.includes("default-src 'none'"), 'CSP debe bloquear default-src con none');
  assert.ok(serverContent.includes("script-src 'unsafe-inline'"), 'CSP debe permitir scripts para ejecutar window.print()');

  const printUtilsContent = fs.readFileSync(path.resolve('src/utils/printUtils.js'), 'utf-8');
  assert.ok(printUtilsContent.includes('class="print-toolbar-sticky"'), 'printUtils.js debe incluir la barra superior sticky de impresión');
  assert.ok(printUtilsContent.includes('id="btnPrintTop"'), 'printUtils.js debe incluir el botón superior de imprimir');
  assert.ok(printUtilsContent.includes('id="btnPrintBottom"'), 'printUtils.js debe incluir el botón inferior de imprimir');
  assert.ok(printUtilsContent.includes('window.print()'), 'printUtils.js debe invocar window.print');
  assert.ok(printUtilsContent.includes('.print-toolbar-sticky, .actions{ display:none !important; }'), 'printUtils.js debe ocultar controles al imprimir');
});

test('Seguridad: Autenticación Firebase en backend valida idToken criptográficamente', () => {
  const serverContent = fs.readFileSync(path.resolve('server.cjs'), 'utf-8');
  assert.ok(serverContent.includes("verifyFirebaseIdToken"), 'server.cjs debe llamar a verifyFirebaseIdToken en /api/auth/firebase');
  assert.ok(serverContent.includes("verifiedUid = decodedFirebase.sub"), 'server.cjs debe extraer el uid desde el token firmado y verificado');
});

test('Seguridad: Login local cuenta con protección de rate limiting contra fuerza bruta', () => {
  const serverContent = fs.readFileSync(path.resolve('server.cjs'), 'utf-8');
  assert.ok(serverContent.includes("checkLoginRateLimit"), 'server.cjs debe invocar checkLoginRateLimit en POST /api/login');
  assert.ok(serverContent.includes("resetLoginRateLimit"), 'server.cjs debe invocar resetLoginRateLimit tras éxito');
});
