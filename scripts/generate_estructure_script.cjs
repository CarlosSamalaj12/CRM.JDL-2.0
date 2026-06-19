#!/usr/bin/env node
/**
 * Script to generate a SQL file with:
 * - All table structures (CREATE TABLE) without data
 * - ONLY the usuarios table preserves its INSERT data
 *   (with date values converted to MySQL-compatible format)
 */

const fs = require('fs');
const path = require('path');

const backupPath = path.join(__dirname, '..', 'db', 'backup_completo.sql');
const outputPath = path.join(__dirname, '..', 'db', 'estructura_completa_con_usuarios.sql');

let content = fs.readFileSync(backupPath, 'utf-8');

// Normalize line endings
content = content.replace(/\r\n/g, '\n');

/**
 * Converts a JavaScript-style date string to MySQL datetime format.
 * Input:  'Thu Jun 18 2026 01:21:47 GMT-0600 (hora est?ndar central)'
 * Output: '2026-06-18 01:21:47'
 */
function convertJsDateToMySql(str) {
    // Remove surrounding quotes if present
    const clean = str.replace(/^'(.*)'$/, '$1');
    
    // Try to parse with Date
    const d = new Date(clean);
    if (!isNaN(d.getTime())) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        const seconds = String(d.getSeconds()).padStart(2, '0');
        return `'${year}-${month}-${day} ${hours}:${minutes}:${seconds}'`;
    }
    // If parsing fails, return original
    return str;
}

/**
 * Fixes date values in a line of SQL VALUES.
 * Looks for patterns like 'Day Mon DD YYYY HH:MM:SS GMT...' inside single-quoted strings
 * and converts them to MySQL datetime format.
 */
function fixDatesInLine(line) {
    // Pattern: 'Day Mon DD YYYY HH:MM:SS GMT±HHMM (anything...)' 
    // e.g., 'Thu Jun 18 2026 01:21:47 GMT-0600 (hora est?ndar central)'
    return line.replace(
        /'[A-Z][a-z]{2}\s[A-Z][a-z]{2}\s\d{2}\s\d{4}\s\d{2}:\d{2}:\d{2}\sGMT[+-]\d{4}\s\([^']*\)'/g,
        convertJsDateToMySql
    );
}

const lines = content.split('\n');

const outputLines = [
    '-- ============================================================',
    '-- ESTRUCTURA COMPLETA: crm_jdl',
    '-- Generado a partir de: backup_completo.sql',
    '-- Este script contiene:',
    '--   - CREATE TABLE de todas las tablas (sin datos)',
    '--   - INSERT de la tabla usuarios (con datos conservados)',
    '-- ============================================================',
    '',
    'SET FOREIGN_KEY_CHECKS = 0;',
    'SET UNIQUE_CHECKS = 0;',
    '',
];

let i = 0;
let usuariosInsertLines = [];

while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === '--') {
        const nextLine = i + 1 < lines.length ? lines[i + 1].trim() : '';
        if (nextLine.startsWith('-- Table:')) {
            const tableName = nextLine.replace('-- Table:', '').trim();

            outputLines.push('');
            outputLines.push('--');
            outputLines.push('-- Table: ' + tableName);
            outputLines.push('--');
            outputLines.push(`DROP TABLE IF EXISTS \`${tableName}\`;`);

            // Skip to CREATE TABLE
            i += 2;
            let createLines = [];
            let foundCreate = false;

            while (i < lines.length) {
                const cl = lines[i];
                const ct = cl.trim();

                if (ct.startsWith('--') && !ct.startsWith('-- Table:')) {
                    i++;
                    continue;
                }

                if (ct.startsWith('CREATE TABLE')) {
                    foundCreate = true;
                }

                if (foundCreate) {
                    if (ct.startsWith('INSERT INTO') || ct.startsWith('-- Table:')) {
                        i--;
                        break;
                    }
                    createLines.push(cl);
                    i++;
                    if (ct.endsWith(';')) break;
                    continue;
                }
                i++;
            }

            if (foundCreate) {
                for (const cl of createLines) outputLines.push(cl);
                outputLines.push('');

                // Skip blank/comment lines between CREATE and INSERT
                while (i < lines.length) {
                    const il = lines[i].trim();
                    if (il === '' || (il.startsWith('--') && !il.startsWith('-- Table:') && !il.startsWith('INSERT'))) {
                        i++;
                        continue;
                    }
                    break;
                }

                // For usuarios: capture and fix INSERT data
                if (tableName.toLowerCase() === 'usuarios') {
                    let capturing = false;
                    while (i < lines.length) {
                        const il = lines[i];
                        const it = il.trim();
                        if (it.startsWith('INSERT INTO')) {
                            capturing = true;
                        }
                        if (capturing) {
                            // Fix date values in this line
                            const fixedLine = fixDatesInLine(il);
                            usuariosInsertLines.push(fixedLine);
                            if (it.endsWith(';')) break;
                        } else {
                            break;
                        }
                        i++;
                    }

                    for (const ul of usuariosInsertLines) outputLines.push(ul);
                    if (usuariosInsertLines.length > 0) outputLines.push('');
                }

                // For non-usuarios tables: skip INSERT data
                if (tableName.toLowerCase() !== 'usuarios') {
                    while (i < lines.length) {
                        const il = lines[i].trim();
                        if (il.startsWith('INSERT INTO')) {
                            let done = false;
                            while (i < lines.length) {
                                if (lines[i].trim().endsWith(';')) {
                                    done = true;
                                    i++;
                                    break;
                                }
                                i++;
                            }
                            if (done) break;
                        } else {
                            break;
                        }
                    }
                }
            }
            continue;
        }
    }
    i++;
}

outputLines.push('');
outputLines.push('SET UNIQUE_CHECKS = 1;');
outputLines.push('SET FOREIGN_KEY_CHECKS = 1;');
outputLines.push('');
outputLines.push('-- ============================================================');
outputLines.push('-- FIN DEL SCRIPT');
outputLines.push('-- ============================================================');

fs.writeFileSync(outputPath, outputLines.join('\n'), 'utf-8');

console.log('Script generado exitosamente en: ' + outputPath);
console.log('   - Tablas incluidas: estructura (CREATE TABLE) para todas las tablas');
console.log('   - Datos de usuarios: ' + (usuariosInsertLines.length > 0 ? 'conservados (fechas convertidas a formato MySQL)' : 'NO encontrados'));
