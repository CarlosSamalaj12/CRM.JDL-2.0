#!/usr/bin/env node
/**
 * bump-sw-version.cjs
 *
 * Actualiza automáticamente la constante VERSION en public/sw.js
 * con el formato YYYY-MM-DD-NN donde NN se incrementa por cada deploy
 * del mismo día.
 *
 * Uso:
 *   node scripts/bump-sw-version.cjs
 *
 * Integración (package.json):
 *   "scripts": {
 *     "build": "node scripts/bump-sw-version.cjs && vite build",
 *     "predeploy": "node scripts/bump-sw-version.cjs"
 *   }
 */

const fs = require('fs');
const path = require('path');

const SW_PATH = path.join(__dirname, '..', 'public', 'sw.js');

// ── Leer el archivo ──
let content;
try {
  content = fs.readFileSync(SW_PATH, 'utf8');
} catch (err) {
  console.error(`[bump-sw-version] Error leyendo ${SW_PATH}: ${err.message}`);
  process.exit(1);
}

// ── Buscar la línea de VERSION ──
const versionRegex = /^(const\s+VERSION\s*=\s*')(\d{4}-\d{2}-\d{2}-\d{2})(';?.*)$/m;
const match = content.match(versionRegex);

if (!match) {
  console.error('[bump-sw-version] No se encontró la constante VERSION en public/sw.js');
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

// ── Escribir el archivo ──
try {
  fs.writeFileSync(SW_PATH, newContent, 'utf8');
  console.log(`[bump-sw-version] ✅ VERSION actualizada: ${oldVersion} → ${newVersion}`);
} catch (err) {
  console.error(`[bump-sw-version] Error escribiendo ${SW_PATH}: ${err.message}`);
  process.exit(1);
}
