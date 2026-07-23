#!/usr/bin/env node
/**
 * bump-sw-version.cjs
 *
 * Actualiza automáticamente la constante VERSION en public/sw.js
 * con el formato YYYY-MM-DD-NN donde NN se incrementa por cada deploy
 * del mismo día.
 *
 * ⚠️ Importante: Este script NO modifica public/sw.js directamente
 *    para evitar conflictos con git pull. En su lugar, escribe el
 *    archivo versionado en dist/sw.js (después de que Vite ya copió
 *    la versión base desde public/).
 *
 * Uso:
 *   node scripts/bump-sw-version.cjs
 *
 * Integración (package.json):
 *   "scripts": {
 *     "build": "vite build && node scripts/bump-sw-version.cjs",
 *     "predeploy": "node scripts/bump-sw-version.cjs"
 *   }
 */

const fs = require('fs');
const path = require('path');

const SRC_PATH = path.join(__dirname, '..', 'public', 'sw.js');
const OUT_PATH = path.join(__dirname, '..', 'dist', 'sw.js');

// ── Buscar la versión actual: prioridad a dist/sw.js (último build) ──
//    Si existe dist/sw.js, usamos esa como base para mantener la
//    secuencia aunque se hagan múltiples builds el mismo día.
//    Si no existe (primer build), usamos public/sw.js.
const versionRegex = /^(const\s+VERSION\s*=\s*')(\d{4}-\d{2}-\d{2}-\d{2})(';?.*)$/m;

let sourcePath = SRC_PATH;
let content;
if (fs.existsSync(OUT_PATH)) {
  try {
    const distContent = fs.readFileSync(OUT_PATH, 'utf8');
    const distMatch = distContent.match(versionRegex);
    if (distMatch) {
      content = distContent;
      sourcePath = 'dist/sw.js';
      console.log(`[bump-sw-version] Leyendo versión desde ${sourcePath}`);
    }
  } catch {}
}

if (!content) {
  try {
    content = fs.readFileSync(SRC_PATH, 'utf8');
    sourcePath = 'public/sw.js';
  } catch (err) {
    console.error(`[bump-sw-version] Error leyendo ${SRC_PATH}: ${err.message}`);
    process.exit(1);
  }
}

// ── Buscar la línea de VERSION ──
const match = content.match(versionRegex);

if (!match) {
  console.error(`[bump-sw-version] No se encontró la constante VERSION en ${sourcePath}`);
  console.error('[bump-sw-version] Buscaba el patrón: const VERSION = \'YYYY-MM-DD-NN\';');
  process.exit(1);
}

const prefix = match[1];   // const VERSION = '
const oldVersion = match[2]; // YYYY-MM-DD-NN
const suffix = match[3];   // ';

// ── Calcular la nueva versión ──
const today = new Date();
const yyyy = today.getFullYear();
const mm = String(today.getMonth() + 1).padStart(2, '0');
const dd = String(today.getDate()).padStart(2, '0');
const todayStr = `${yyyy}-${mm}-${dd}`;

const oldDatePart = oldVersion.slice(0, 10); // YYYY-MM-DD
const oldSeq = parseInt(oldVersion.slice(11), 10); // NN

let newSeq;
if (oldDatePart === todayStr) {
  // Mismo día → incrementar secuencia
  newSeq = Math.min(oldSeq + 1, 99);
} else {
  // Día diferente → reiniciar secuencia
  newSeq = 1;
}

const newVersion = `${todayStr}-${String(newSeq).padStart(2, '0')}`;
const newContent = content.replace(versionRegex, `${prefix}${newVersion}${suffix}`);

// ── Escribir SOLO en dist/sw.js (NO tocar public/sw.js) ──
try {
  // Asegurar que el directorio dist existe (si Vite ya corrió debería existir)
  const distDir = path.dirname(OUT_PATH);
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }
  fs.writeFileSync(OUT_PATH, newContent, 'utf8');
  console.log(`[bump-sw-version] ✅ VERSION actualizada: ${oldVersion} → ${newVersion} (dist/sw.js)`);
  console.log(`[bump-sw-version] 💡 NOTA: public/sw.js NO fue modificado — sin conflictos git.`);

  // ── Escribir dist/version.json (lo lee el server en GET /api/version) ──
  //    Schema:
  //      {
  //        "version":      "2026-07-18-04",   // versión actual del deploy
  //        "minVersion":   "2026-07-15-01",   // versión mínima requerida (opcional)
  //        "required":     false,             // si true, fuerza actualización en clientes viejos
  //        "message":      "Mensaje opcional para mostrar al usuario",
  //        "deployedAt":   "2026-07-18T20:30:00.000Z"
  //      }
  //    minVersion se puede sobreescribir vía variable de entorno APP_MIN_VERSION.
  //    Si no se define, se calcula como (newVersion con secuencia 01) — i.e. "el mismo día".
  const minVersionFromEnv = process.env.APP_MIN_VERSION;
  const minVersion = minVersionFromEnv || `${todayStr}-01`;
  const versionInfo = {
    version: newVersion,
    minVersion,
    required: !!minVersionFromEnv,
    message: process.env.APP_UPDATE_MESSAGE || '',
    deployedAt: new Date().toISOString(),
  };
  const versionJsonPath = path.join(distDir, 'version.json');
  fs.writeFileSync(versionJsonPath, JSON.stringify(versionInfo, null, 2), 'utf8');
  const pubVersionPath = path.join(__dirname, '..', 'public', 'version.json');
  fs.writeFileSync(pubVersionPath, JSON.stringify(versionInfo, null, 2), 'utf8');
  console.log(`[bump-sw-version] ✅ version.json escrito en dist y public: ${JSON.stringify(versionInfo)}`);
} catch (err) {
  console.error(`[bump-sw-version] Error escribiendo ${OUT_PATH}: ${err.message}`);
  process.exit(1);
}
