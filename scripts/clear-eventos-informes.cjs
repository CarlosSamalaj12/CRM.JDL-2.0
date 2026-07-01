/**
 * Script para eliminar todos los EVENTOS e INFORMES de la base de datos.
 * 
 * Conserva intactos:
 *   - Salones
 *   - Usuarios
 *   - Empresas y encargados
 *   - Servicios, categorías y subcategorías
 *   - Catálogo de ingredientes, opciones, categorías de alimento
 *   - Catálogo de menús y platillos
 *   - Configuraciones (equipos, tipos de silla/mesa, formas de pago)
 *   - Plantillas de cotización y contrato
 *   - Secuencia de documentos
 * 
 * Elimina:
 *   - Eventos y sus cotizaciones, items, versiones
 *   - Anticipos e historial de anticipos
 *   - Historial de eventos, recordatorios
 *   - Solicitudes de autorización de descuento
 *   - Informes de eventos (informes_eventos, días, menús, comentarios, etc.)
 *   - Imágenes de informes, lecturas, destacados, historial
 *   - Notas de kanban (event_notas)
 *   - Metadatos de eventos (evento_metadatos)
 *   - Notificaciones
 *   - Datos de eventos en app_state_kv y crm_app_state
 *
 * Uso: node scripts/clear-eventos-informes.cjs --yes
 */

require("dotenv").config();
const mariadb = require("mariadb");

const DB_HOST = process.env.DB_HOST || "127.0.0.1";
const DB_PORT = Number(process.env.DB_PORT || 3306);
const DB_USER = process.env.DB_USER || "root";
const DB_PASSWORD = process.env.DB_PASSWORD || "";
const DB_NAME = process.env.DB_NAME || "crm_jdl";

function parseJsonSafe(value, fallback) {
  try {
    const parsed = JSON.parse(String(value || ""));
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
}

async function tableExists(conn, tableName) {
  try {
    const rows = await conn.query("SHOW TABLES LIKE ?", [String(tableName || "").trim()]);
    return Array.isArray(rows) && rows.length > 0;
  } catch { return false; }
}

async function countRows(conn, tableName) {
  if (!(await tableExists(conn, tableName))) return 0;
  try {
    const rows = await conn.query(`SELECT COUNT(*) AS total FROM \`${tableName}\``);
    return Number(rows?.[0]?.total || 0);
  } catch { return 0; }
}

async function safeDelete(conn, tableName) {
  if (!(await tableExists(conn, tableName))) return 0;
  const before = await countRows(conn, tableName);
  if (before > 0) {
    try {
      await conn.query(`DELETE FROM \`${tableName}\``);
    } catch (err) {
      console.warn(`  ⚠️  Error al eliminar ${tableName}: ${err.message}`);
      return -1;
    }
  }
  return before;
}

async function main() {
  const force = process.argv.includes("--yes");
  if (!force) {
    console.error("═══════════════════════════════════════════════════");
    console.error("  Este script ELIMINARÁ todos los eventos e informes");
    console.error("  de la base de datos.");
    console.error("");
    console.error("  CONSERVA: usuarios, salones, empresas, servicios,");
    console.error("  catálogos de menús/platillos/ingredientes y configs.");
    console.error("");
    console.error(`  Base de datos: ${DB_NAME} @ ${DB_HOST}:${DB_PORT}`);
    console.error("═══════════════════════════════════════════════════");
    console.error("Ejecute: node scripts/clear-eventos-informes.cjs --yes");
    process.exit(1);
  }

  const conn = await mariadb.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    multipleStatements: false,
  });

  const counts = {};

  try {
    await conn.beginTransaction();
    await conn.query("SET FOREIGN_KEY_CHECKS = 0");

    console.log("\n🧹 Eliminando datos de EVENTOS e INFORMES...\n");

    // ─── Informes (orden inverso por FK) ───
    const informeTables = [
      "informe_imagenes",
      "informe_historial",
      "informe_destacados",
      "informe_lecturas",
      "informe_comentarios",
      "informe_dia_menu_detalle",
      "informe_dias_detalle",
      "informes_eventos",
    ];
    for (const table of informeTables) {
      const n = await safeDelete(conn, table);
      if (n >= 0) console.log(`  🗑️  ${table}: ${n} filas eliminadas`);
      counts[table] = n;
    }

    // ─── Eventos relacionados ───
    const eventRelatedTables = [
      "items_cotizacion_version_evento",
      "items_cotizacion_evento",
      "cotizacion_versiones_evento",
      "cotizaciones_evento",
      "historial_anticipos",
      "anticipos_evento",
      "recordatorios_evento",
      "historial_evento",
      "solicitudes_autorizacion",
      "event_notas",
      "evento_metadatos",
      "notificaciones",
    ];
    for (const table of eventRelatedTables) {
      const n = await safeDelete(conn, table);
      if (n >= 0) console.log(`  🗑️  ${table}: ${n} filas eliminadas`);
      counts[table] = n;
    }

    // ─── Eventos (tabla principal) ───
    const eventosCount = await safeDelete(conn, "eventos");
    if (eventosCount >= 0) console.log(`  🗑️  eventos: ${eventosCount} filas eliminadas`);
    counts.eventos = eventosCount;

    // ─── Limpiar datos de eventos en app_state_kv ───
    if (await tableExists(conn, "app_state_kv")) {
      const kvKeysToClear = [
        "eventChecklists",
        "occupancyWeeklyOps",
      ];
      for (const key of kvKeysToClear) {
        const defaultVal = key === "eventChecklists" ? "{}" : key === "occupancyWeeklyOps" ? "{}" : "[]";
        try {
          await conn.query(
            `INSERT INTO app_state_kv (clave, valor_json) VALUES (?, ?)
             ON DUPLICATE KEY UPDATE valor_json = VALUES(valor_json)`,
            [key, defaultVal]
          );
        } catch (err) {
          console.warn(`  ⚠️  Error al resetear app_state_kv.${key}: ${err.message}`);
        }
      }
      console.log("  🗑️  app_state_kv: claves de eventos reiniciadas");
    }

    // ─── Limpiar datos de eventos en crm_app_state ───
    if (await tableExists(conn, "crm_app_state")) {
      try {
        const stateRows = await conn.query(
          "SELECT state_json FROM crm_app_state WHERE id = 1 LIMIT 1"
        );
        if (stateRows?.[0]) {
          const state = parseJsonSafe(stateRows[0].state_json, {});
          state.events = [];
          state.changeHistory = {};
          state.reminders = {};
          state.eventChecklists = {};
          state.discountAuthRequests = [];
          state.occupancyWeeklyOps = {};

          await conn.query(
            `INSERT INTO crm_app_state (id, state_json)
             VALUES (1, ?)
             ON DUPLICATE KEY UPDATE state_json = VALUES(state_json), updated_at = CURRENT_TIMESTAMP`,
            [JSON.stringify(state)]
          );
          console.log("  🗑️  crm_app_state: eventos e informes removidos del state_json");
        }
      } catch (err) {
        console.warn(`  ⚠️  Error al limpiar crm_app_state: ${err.message}`);
      }
    }

    await conn.query("SET FOREIGN_KEY_CHECKS = 1");
    await conn.commit();

    // ─── Resumen ───
    console.log("\n═══════════════════════════════════════════════════");
    console.log("  ✅  LIMPIEZA COMPLETADA");
    console.log("═══════════════════════════════════════════════════");
    console.log(`  Eventos eliminados:         ${counts.eventos ?? 0}`);
    console.log(`  Informes eliminados:       ${(counts.informes_eventos ?? 0) + (counts.informe_dias_detalle ?? 0)}`);
    console.log(`  Cotizaciones eliminadas:   ${(counts.cotizaciones_evento ?? 0) + (counts.cotizacion_versiones_evento ?? 0)}`);
    console.log(`  Anticipos eliminados:      ${(counts.anticipos_evento ?? 0) + (counts.historial_anticipos ?? 0)}`);
    console.log(`  Recordatorios eliminados:  ${counts.recordatorios_evento ?? 0}`);
    console.log(`  Notas/notificaciones:      ${(counts.event_notas ?? 0) + (counts.notificaciones ?? 0)}`);
    console.log("");
    console.log("  Se conservaron: usuarios, salones, empresas,");
    console.log("  servicios, catálogos y configuraciones.");
    console.log("═══════════════════════════════════════════════════\n");

  } catch (error) {
    try { await conn.rollback(); } catch {}
    console.error("\n❌  ERROR durante la limpieza:", error.message || error);
    process.exitCode = 1;
  } finally {
    await conn.end();
  }
}

main();
