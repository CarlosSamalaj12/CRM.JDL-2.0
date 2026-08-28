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

// ── Buscar la versión actual: prioridad a public/version.json, luego package.json ──
const versionRegex = /^(const\s+VERSION\s*=\s*')([^']+)(';?.*)$/m;
const PUB_VERSION_PATH = path.join(__dirname, '..', 'public', 'version.json');
const PKG_JSON_PATH = path.join(__dirname, '..', 'package.json');

let oldVersion = '2.1.38';
let content;

// Leemos package.json como base sólida
if (fs.existsSync(PKG_JSON_PATH)) {
  try {
    const pkg = JSON.parse(fs.readFileSync(PKG_JSON_PATH, 'utf8'));
    if (pkg && pkg.version && pkg.version !== '0.0.0') {
      oldVersion = pkg.version;
    }
  } catch {}
}

// Siempre leemos public/sw.js como el template de código base
try {
  content = fs.readFileSync(SRC_PATH, 'utf8');
} catch (err) {
  console.error(`[bump-sw-version] Error leyendo ${SRC_PATH}: ${err.message}`);
  process.exit(1);
}

// Leemos el valor actual desde public/version.json si existe para no perder la secuencia
if (fs.existsSync(PUB_VERSION_PATH)) {
  try {
    const rawVersionData = JSON.parse(fs.readFileSync(PUB_VERSION_PATH, 'utf8'));
    if (rawVersionData && rawVersionData.version) {
      oldVersion = rawVersionData.version;
      console.log(`[bump-sw-version] Leyendo versión base desde public/version.json: ${oldVersion}`);
    }
  } catch {}
} else if (fs.existsSync(OUT_PATH)) {
  try {
    const distContent = fs.readFileSync(OUT_PATH, 'utf8');
    const distMatch = distContent.match(versionRegex);
    if (distMatch && distMatch[2] && distMatch[2].startsWith('2.')) {
      oldVersion = distMatch[2];
      console.log(`[bump-sw-version] Leyendo versión base desde dist/sw.js: ${oldVersion}`);
    }
  } catch {}
} else {
  console.log(`[bump-sw-version] Usando versión base desde package.json: ${oldVersion}`);
}

// ── Buscar la línea de VERSION en el template para reemplazar ──
const match = content.match(versionRegex);
if (!match) {
  console.error(`[bump-sw-version] No se encontró la constante VERSION en template sw.js`);
  process.exit(1);
}
const prefix = match[1];   // const VERSION = '
const suffix = match[3];   // ';

// ── Calcular la nueva versión (ej: "2.0" -> "2.1", "2.9" -> "2.10", "2026-07-22-01" -> "2.0.0") ──
let newVersion;
if (oldVersion.includes('.') && !oldVersion.includes('-')) {
  const parts = oldVersion.split('.').map(x => parseInt(x, 10) || 0);
  if (parts.length > 0) {
    parts[parts.length - 1]++;
    newVersion = parts.join('.');
  } else {
    newVersion = '2.0.0';
  }
} else {
  // Transición: Si venía en formato de fecha, iniciamos en 2.0.0
  newVersion = '2.0.0';
}

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
  const minVersionFromEnv = process.env.APP_MIN_VERSION;
  const minVersion = minVersionFromEnv || newVersion;
  const versionInfo = {
    version: newVersion,
    minVersion,
    required: !!minVersionFromEnv,
    message: process.env.APP_UPDATE_MESSAGE || '',
    deployedAt: new Date().toISOString(),
  };
  const versionJsonPath = path.join(distDir, 'version.json');
  fs.writeFileSync(versionJsonPath, JSON.stringify(versionInfo, null, 2), 'utf8');
  console.log(`[bump-sw-version] ✅ version.json escrito en dist: ${JSON.stringify(versionInfo)}`);

  // ── Escribir también public/version.json (fuente de verdad) ──
  // Si NO lo hacemos, vite build (que corre después) copia public/ → dist/
  // y pisa el dist/version.json con la versión vieja.
  // El sw.js de public/ se mantiene intacto a propósito (para no chocar con git);
  // pero version.json es solo metadata numérica y debe quedar sincronizada.
  if (fs.existsSync(PUB_VERSION_PATH)) {
    try {
      fs.writeFileSync(PUB_VERSION_PATH, JSON.stringify(versionInfo, null, 2), 'utf8');
      console.log(`[bump-sw-version] ✅ public/version.json actualizado: ${newVersion}`);
    } catch (err) {
      console.warn(`[bump-sw-version] ⚠️ No se pudo actualizar public/version.json: ${err.message}`);
    }
  } else {
    // Si no existía, lo creamos para que el siguiente build tenga la base
    try {
      fs.writeFileSync(PUB_VERSION_PATH, JSON.stringify(versionInfo, null, 2), 'utf8');
      console.log(`[bump-sw-version] ✅ public/version.json creado: ${newVersion}`);
    } catch (err) {
      console.warn(`[bump-sw-version] ⚠️ No se pudo crear public/version.json: ${err.message}`);
    }
  }
} catch (err) {
  console.error(`[bump-sw-version] Error escribiendo ${OUT_PATH}: ${err.message}`);
  process.exit(1);
}
