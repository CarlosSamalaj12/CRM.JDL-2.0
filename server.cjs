const path = require("path");
const express = require("express");
const mariadb = require("mariadb");
const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const { createGoogleEvent, createUserReminder, deleteUserReminder } = require("./googleCalendar.cjs");

const JWT_SECRET = process.env.JWT_SECRET || 'sistema_informes_secret_key_change_in_prod';

// Normaliza roles del CRM a formato capitalizado que esperan los controllers de Informes Eventos
// 'admin' → 'Admin', 'vendedor' → 'Vendedor', 'recepcionista' → 'FrontOffice'
function normalizeRoleForJWT(role) {
  const raw = String(role || '').trim().toLowerCase();
  if (raw === 'admin') return 'Admin';
  if (raw === 'recepcionista' || raw === 'frontoffice' || raw === 'front_office') return 'FrontOffice';
  if (raw === 'vendedor' || raw === 'vendedor(a)' || raw === 'sales') return 'Vendedor';
  return raw ? raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase() : 'Vendedor';
}

const APP_PORT = Number(process.env.APP_PORT || 3000);
const DB_HOST = process.env.DB_HOST || "127.0.0.1";
const DB_PORT = Number(process.env.DB_PORT || 3306);
const DB_USER = process.env.DB_USER || "root";
const DB_PASSWORD = process.env.DB_PASSWORD || "";
const DB_NAME = process.env.DB_NAME || "crm_jdl";

const REQUIRED_TABLES = [
  "salones",
  "usuarios",
  "empresas",
  "encargados_empresa",
  "eventos",
  "cotizaciones_evento",
  "items_cotizacion_evento",
  "cotizacion_versiones_evento",
  "items_cotizacion_version_evento",
  "historial_evento",
  "recordatorios_evento",
  "anticipos_evento",
];

const pool = mariadb.createPool({
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  connectionLimit: 5,
  collation: "utf8mb4_unicode_ci",
});

let io;
const app = express();
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,PATCH,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  
  // Desactivar caché del navegador para todas las rutas de la API para evitar datos obsoletos (stale state)
  if (req.path.startsWith("/api/")) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});
app.use(express.json({ limit: "25mb" }));

function hashPasswordScrypt(password, saltHex) {
  return new Promise((resolve, reject) => {
    const salt = Buffer.from(saltHex, "hex");
    crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(derivedKey.toString("hex"));
    });
  });
}

async function ensurePasswordHash(rawPassword) {
  const value = String(rawPassword || "").trim();
  if (!value) return null;
  if (value.startsWith("scrypt$")) return value;
  const saltHex = crypto.randomBytes(16).toString("hex");
  const hashHex = await hashPasswordScrypt(value, saltHex);
  return `scrypt$16384$8$1$${saltHex}$${hashHex}`;
}

async function verifyPassword(rawPassword, storedPassword) {
  const raw = String(rawPassword || "");
  const stored = String(storedPassword || "");
  if (!stored) return false;
  if (!stored.startsWith("scrypt$")) {
    return stored === raw;
  }
  const parts = stored.split("$");
  if (parts.length !== 6) return false;
  const saltHex = parts[4];
  const expectedHex = parts[5];
  const gotHex = await hashPasswordScrypt(raw, saltHex);
  try {
    return crypto.timingSafeEqual(Buffer.from(expectedHex, "hex"), Buffer.from(gotHex, "hex"));
  } catch (_) {
    return false;
  }
}

function toIsoDate(value) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) {
    const clean = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(clean)) return clean.slice(0, 10);
    return "";
  }
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function toHHmm(value) {
  if (!value) return "";
  const raw = String(value);
  if (raw.length >= 5) return raw.slice(0, 5);
  return raw;
}

function asDate(value) {
  const v = String(value || "").trim();
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function asTime(value) {
  const v = String(value || "").trim();
  if (!v) return null;
  const match = v.match(/^(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (match) {
    const hh = match[1];
    const mm = match[2];
    const ss = match[3] || "00";
    return `${hh}:${mm}:${ss}`;
  }
  return null;
}

function asDateTime(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

async function ensureAppStateExtraStructure() {
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.query(`
      CREATE TABLE IF NOT EXISTS app_state_kv (
        clave VARCHAR(120) NOT NULL,
        valor_json LONGTEXT NULL,
        actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (clave)
      )
    `);
  } finally {
    if (conn) conn.release();
  }
}

async function ensureUsersExtendedStructure() {
  let conn;
  try {
    conn = await pool.getConnection();
    const cols = await conn.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = ? AND table_name = 'usuarios'`,
      [DB_NAME]
    );
    const colSet = new Set(cols.map((r) => String(r.column_name || "").toLowerCase()));
    if (!colSet.has("nombre_usuario")) {
      await conn.query("ALTER TABLE usuarios ADD COLUMN nombre_usuario VARCHAR(120) NULL");
    }
    if (!colSet.has("nombre_completo")) {
      await conn.query("ALTER TABLE usuarios ADD COLUMN nombre_completo VARCHAR(200) NULL");
    }
    if (!colSet.has("correo")) {
      await conn.query("ALTER TABLE usuarios ADD COLUMN correo VARCHAR(200) NULL");
    }
    if (!colSet.has("telefono")) {
      await conn.query("ALTER TABLE usuarios ADD COLUMN telefono VARCHAR(80) NULL");
    }
    if (!colSet.has("contrasena")) {
      await conn.query("ALTER TABLE usuarios ADD COLUMN contrasena VARCHAR(255) NULL");
    }
    if (!colSet.has("firma_data_url")) {
      await conn.query("ALTER TABLE usuarios ADD COLUMN firma_data_url LONGTEXT NULL");
    }
    if (!colSet.has("avatar_data_url")) {
      await conn.query("ALTER TABLE usuarios ADD COLUMN avatar_data_url LONGTEXT NULL");
    }
    if (!colSet.has("activo")) {
      await conn.query("ALTER TABLE usuarios ADD COLUMN activo TINYINT(1) NOT NULL DEFAULT 1");
    }
    if (!colSet.has("influye_meta_ventas")) {
      await conn.query("ALTER TABLE usuarios ADD COLUMN influye_meta_ventas TINYINT(1) NOT NULL DEFAULT 0");
    }
    if (!colSet.has("metas_mensuales_json")) {
      await conn.query("ALTER TABLE usuarios ADD COLUMN metas_mensuales_json LONGTEXT NULL");
    }
    if (!colSet.has("tiers_comision_json")) {
      await conn.query("ALTER TABLE usuarios ADD COLUMN tiers_comision_json LONGTEXT NULL");
    }
    if (!colSet.has("rol")) {
      await conn.query("ALTER TABLE usuarios ADD COLUMN rol VARCHAR(50) NOT NULL DEFAULT 'vendedor'");
    }
  } finally {
    if (conn) conn.release();
  }
}

function str(value) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function sanitizeUtf16String(value) {
  return String(value || "")
    .replace(/\u0000/g, "")
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, "")
    .replace(/(^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "$1");
}

function sanitizeJsonValue(value) {
  if (typeof value === "string") return sanitizeUtf16String(value);
  if (Array.isArray(value)) return value.map((v) => sanitizeJsonValue(v));
  if (!value || typeof value !== "object") return value;
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    out[sanitizeUtf16String(k)] = sanitizeJsonValue(v);
  }
  return out;
}

function safeJsonStringify(value) {
  try {
    return JSON.stringify(sanitizeJsonValue(value));
  } catch (_) {
    return null;
  }
}

function normalizeQuantityMode(mode) {
  const m = String(mode || "").trim().toUpperCase();
  return m === "PAX" ? "PAX" : "MANUAL";
}

function normalizeDiscountType(type) {
  return String(type || "").trim().toUpperCase() === "PERCENT" ? "PERCENT" : "AMOUNT";
}

function normalizeMenuDishType(type) {
  const value = String(type || "").trim().toUpperCase();
  if (value === "VEGETARIANO") return "VEGETARIANO";
  if (value === "VEGANO") return "VEGANO";
  return "NORMAL";
}

function parseQuoteCodeNumber(rawCode) {
  const m = String(rawCode || "").trim().toUpperCase().match(/^COT-(\d{1,})$/);
  if (!m) return 0;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function formatQuoteCode(num) {
  const n = Math.max(1, Number(num || 1));
  return `COT-${String(Math.floor(n)).padStart(3, "0")}`;
}

async function ensureDocumentSequenceStructure() {
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.query(`
      CREATE TABLE IF NOT EXISTS doc_sequence (
        scope VARCHAR(40) NOT NULL,
        last_value BIGINT UNSIGNED NOT NULL DEFAULT 0,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (scope)
      )
    `);
    await conn.query(
      `INSERT INTO doc_sequence (scope, last_value) VALUES ('COT', 0)
       ON DUPLICATE KEY UPDATE scope = VALUES(scope)`
    );
  } finally {
    if (conn) conn.release();
  }
}

async function ensureDocSequenceAtLeast(conn, scope, minValue) {
  const safeMin = Math.max(0, Number(minValue || 0));
  await conn.query(
    `UPDATE doc_sequence
     SET last_value = GREATEST(last_value, ?)
     WHERE scope = ?`,
    [safeMin, String(scope || "COT").trim() || "COT"]
  );
}

async function reserveNextDocCodeInConn(conn, scope = "COT") {
  const key = String(scope || "COT").trim() || "COT";
  await conn.query(
    `INSERT INTO doc_sequence (scope, last_value) VALUES (?, 0)
     ON DUPLICATE KEY UPDATE scope = VALUES(scope)`,
    [key]
  );
  await conn.query(
    `UPDATE doc_sequence
     SET last_value = last_value + 1
     WHERE scope = ?`,
    [key]
  );
  const rows = await conn.query(
    `SELECT last_value FROM doc_sequence WHERE scope = ? LIMIT 1`,
    [key]
  );
  const value = Number(rows?.[0]?.last_value || 1);
  return formatQuoteCode(value);
}

async function reserveNextDocCode(scope = "COT") {
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const code = await reserveNextDocCodeInConn(conn, scope);
    await conn.commit();
    return code;
  } catch (error) {
    if (conn) await conn.rollback();
    throw error;
  } finally {
    if (conn) conn.release();
  }
}

function buildQuoteItemPrimaryKey(eventId, item, idx) {
  const e = str(eventId).trim() || "ev";
  const raw = str(item?.rowId).trim() || `row_${idx + 1}`;
  const composed = `${e.slice(0, 100)}__${raw.slice(0, 50)}__${idx + 1}`;
  return composed.slice(0, 200);
}

function calculateQuoteTotals(quote) {
  const q = quote && typeof quote === "object" ? quote : {};
  const items = Array.isArray(q.items) ? q.items : [];
  const subtotal = items.reduce((acc, x) => acc + Number(x?.qty || 0) * Number(x?.price || 0), 0);
  const discountType = normalizeDiscountType(q.discountType);
  const discountValueRaw = Math.max(0, Number(q.discountValue || 0));
  const discountValue = Number.isFinite(discountValueRaw) ? discountValueRaw : 0;
  const discountAmount = discountType === "PERCENT"
    ? Math.max(0, Math.min(subtotal, subtotal * Math.min(100, discountValue) / 100))
    : Math.max(0, Math.min(subtotal, discountValue));
  const total = Math.max(0, subtotal - discountAmount);
  return { subtotal, discountType, discountValue, discountAmount, total };
}

async function ensureServiceCatalogStructure() {
  let conn;
  try {
    conn = await pool.getConnection();
    // Ensure categorias_servicio table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS categorias_servicio (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        nombre VARCHAR(200) NOT NULL,
        creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        activo TINYINT(1) NOT NULL DEFAULT 1,
        PRIMARY KEY (id),
        UNIQUE KEY uq_categorias_servicio_nombre (nombre)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    // Ensure subcategorias_servicio table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS subcategorias_servicio (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        id_categoria BIGINT UNSIGNED NOT NULL,
        nombre VARCHAR(500) NOT NULL,
        creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        activo TINYINT(1) NOT NULL DEFAULT 1,
        PRIMARY KEY (id),
        UNIQUE KEY uq_subcategorias_servicio (id_categoria, nombre),
        KEY idx_subcategorias_servicio_categoria (id_categoria),
        CONSTRAINT fk_subcategorias_categoria FOREIGN KEY (id_categoria) REFERENCES categorias_servicio (id) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    // Ensure subcategorias_servicio.nombre column is expanded to VARCHAR(500) if table already exists
    try {
      await conn.query("ALTER TABLE subcategorias_servicio MODIFY COLUMN nombre VARCHAR(500) NOT NULL");
    } catch (_) {}
    // Ensure servicios table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS servicios (
        id VARCHAR(30) NOT NULL,
        nombre VARCHAR(300) NOT NULL,
        precio DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        descripcion TEXT NULL,
        id_categoria BIGINT UNSIGNED NULL,
        id_subcategoria BIGINT UNSIGNED NULL,
        modo_cantidad VARCHAR(12) NOT NULL DEFAULT 'MANUAL',
        activo TINYINT(1) NOT NULL DEFAULT 1,
        creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_servicios_categoria (id_categoria),
        KEY idx_servicios_subcategoria (id_subcategoria),
        CONSTRAINT fk_servicios_categoria FOREIGN KEY (id_categoria) REFERENCES categorias_servicio (id) ON DELETE SET NULL ON UPDATE CASCADE,
        CONSTRAINT fk_servicios_subcategoria FOREIGN KEY (id_subcategoria) REFERENCES subcategorias_servicio (id) ON DELETE SET NULL ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    // Ensure activo column exists on servicios (legacy tables might not have it)
    try {
      const cols = await conn.query(
        "SELECT column_name FROM information_schema.columns WHERE table_schema = ? AND table_name = 'servicios' AND column_name = 'activo'",
        [DB_NAME]
      );
      if (cols.length === 0) {
        await conn.query("ALTER TABLE servicios ADD COLUMN activo TINYINT(1) NOT NULL DEFAULT 1");
      }
    } catch (_) {}
  } finally {
    if (conn) conn.release();
  }
}

async function ensureQuoteVersionStructure() {
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.query(`
      CREATE TABLE IF NOT EXISTS cotizacion_versiones_evento (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        id_evento VARCHAR(30) NOT NULL,
        version_num INT NOT NULL,
        subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
        descuento_tipo VARCHAR(12) NOT NULL DEFAULT 'AMOUNT',
        descuento_valor DECIMAL(12,2) NOT NULL DEFAULT 0,
        descuento_monto DECIMAL(12,2) NOT NULL DEFAULT 0,
        total_neto DECIMAL(12,2) NOT NULL DEFAULT 0,
        cotizado_en_iso VARCHAR(40) NULL,
        json_crudo LONGTEXT NULL,
        creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_cotizacion_version_evento (id_evento, version_num),
        KEY idx_cotizacion_version_evento (id_evento)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await conn.query(`
      CREATE TABLE IF NOT EXISTS items_cotizacion_version_evento (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        id_evento VARCHAR(30) NOT NULL,
        version_num INT NOT NULL,
        fila_num INT NOT NULL,
        id_servicio VARCHAR(30) NULL,
        fecha_servicio DATE NULL,
        cantidad DECIMAL(12,2) NOT NULL DEFAULT 0,
        precio DECIMAL(12,2) NOT NULL DEFAULT 0,
        nombre VARCHAR(240) NOT NULL,
        descripcion TEXT NULL,
        PRIMARY KEY (id),
        KEY idx_items_cotizacion_version_evento (id_evento, version_num)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    const versionTableMeta = await conn.query(
      `SELECT table_name, table_collation
       FROM information_schema.tables
       WHERE table_schema = ? AND table_name IN ('cotizacion_versiones_evento','items_cotizacion_version_evento')`,
      [DB_NAME]
    );
    for (const row of versionTableMeta) {
      const tableName = String(row.table_name || "");
      const collation = String(row.table_collation || "").toLowerCase();
      if (tableName && !collation.startsWith("utf8mb4_")) {
        await conn.query(`ALTER TABLE ${tableName} CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
      }
    }

    const itemCols = await conn.query(
      `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = ? AND table_name IN ('items_cotizacion_evento','items_cotizacion_version_evento')`,
      [DB_NAME]
    );
    const itemMap = new Map();
    for (const row of itemCols) {
      const t = String(row.table_name || "").toLowerCase();
      const c = String(row.column_name || "").toLowerCase();
      if (!itemMap.has(t)) itemMap.set(t, new Set());
      itemMap.get(t).add(c);
    }
    const itemTables = ["items_cotizacion_evento", "items_cotizacion_version_evento"];
    for (const table of itemTables) {
      const set = itemMap.get(table) || new Set();
      if (!set.has("precio_unitario")) {
        await conn.query(`ALTER TABLE ${table} ADD COLUMN precio_unitario DECIMAL(12,2) NOT NULL DEFAULT 0`);
      }
      if (!set.has("modo_cantidad")) {
        await conn.query(`ALTER TABLE ${table} ADD COLUMN modo_cantidad VARCHAR(12) NOT NULL DEFAULT 'MANUAL'`);
      }
      if (!set.has("total_linea")) {
        await conn.query(`ALTER TABLE ${table} ADD COLUMN total_linea DECIMAL(12,2) NOT NULL DEFAULT 0`);
      }
    }

    const cotizacionCols = await conn.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = ? AND table_name = 'cotizaciones_evento'`,
      [DB_NAME]
    );
    const cotizacionColSet = new Set(cotizacionCols.map((r) => String(r.column_name || "").toLowerCase()));
    if (!cotizacionColSet.has("version_actual")) {
      await conn.query("ALTER TABLE cotizaciones_evento ADD COLUMN version_actual INT NOT NULL DEFAULT 1");
    }
    if (!cotizacionColSet.has("subtotal")) {
      await conn.query("ALTER TABLE cotizaciones_evento ADD COLUMN subtotal DECIMAL(12,2) NOT NULL DEFAULT 0");
    }
    if (!cotizacionColSet.has("descuento_tipo")) {
      await conn.query("ALTER TABLE cotizaciones_evento ADD COLUMN descuento_tipo VARCHAR(12) NOT NULL DEFAULT 'AMOUNT'");
    }
    if (!cotizacionColSet.has("descuento_valor")) {
      await conn.query("ALTER TABLE cotizaciones_evento ADD COLUMN descuento_valor DECIMAL(12,2) NOT NULL DEFAULT 0");
    }
    if (!cotizacionColSet.has("descuento_monto")) {
      await conn.query("ALTER TABLE cotizaciones_evento ADD COLUMN descuento_monto DECIMAL(12,2) NOT NULL DEFAULT 0");
    }
    if (!cotizacionColSet.has("total_neto")) {
      await conn.query("ALTER TABLE cotizaciones_evento ADD COLUMN total_neto DECIMAL(12,2) NOT NULL DEFAULT 0");
    }

    const versionCols = await conn.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = ? AND table_name = 'cotizacion_versiones_evento'`,
      [DB_NAME]
    );
    const versionColSet = new Set(versionCols.map((r) => String(r.column_name || "").toLowerCase()));
    if (!versionColSet.has("subtotal")) {
      await conn.query("ALTER TABLE cotizacion_versiones_evento ADD COLUMN subtotal DECIMAL(12,2) NOT NULL DEFAULT 0");
    }
    if (!versionColSet.has("descuento_tipo")) {
      await conn.query("ALTER TABLE cotizacion_versiones_evento ADD COLUMN descuento_tipo VARCHAR(12) NOT NULL DEFAULT 'AMOUNT'");
    }
    if (!versionColSet.has("descuento_valor")) {
      await conn.query("ALTER TABLE cotizacion_versiones_evento ADD COLUMN descuento_valor DECIMAL(12,2) NOT NULL DEFAULT 0");
    }
    if (!versionColSet.has("descuento_monto")) {
      await conn.query("ALTER TABLE cotizacion_versiones_evento ADD COLUMN descuento_monto DECIMAL(12,2) NOT NULL DEFAULT 0");
    }
    if (!versionColSet.has("total_neto")) {
      await conn.query("ALTER TABLE cotizacion_versiones_evento ADD COLUMN total_neto DECIMAL(12,2) NOT NULL DEFAULT 0");
    }
  } finally {
    if (conn) conn.release();
  }
}

async function ensureEventDateRangeStructure() {
  let conn;
  try {
    conn = await pool.getConnection();
    const cols = await conn.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = ? AND table_name = 'eventos'`,
      [DB_NAME]
    );
    const colSet = new Set(cols.map((r) => String(r.column_name || "").toLowerCase()));
    if (!colSet.has("fecha_inicio_reserva")) {
      await conn.query("ALTER TABLE eventos ADD COLUMN fecha_inicio_reserva DATE NULL AFTER fecha_evento");
    }
    if (!colSet.has("fecha_fin_reserva")) {
      await conn.query("ALTER TABLE eventos ADD COLUMN fecha_fin_reserva DATE NULL AFTER fecha_inicio_reserva");
    }
  } finally {
    if (conn) conn.release();
  }
}

async function ensureAdvancesStructure() {
  let conn;
  try {
    conn = await pool.getConnection();
    const idMetaRows = await conn.query(
      `SELECT column_type, character_set_name, collation_name
       FROM information_schema.columns
       WHERE table_schema = ? AND table_name = 'eventos' AND column_name = 'id'
       LIMIT 1`,
      [DB_NAME]
    );
    const idMeta = idMetaRows?.[0] || {};
    const colType = String(idMeta.column_type || "varchar(30)").trim();
    const charset = String(idMeta.character_set_name || "").trim();
    const collation = String(idMeta.collation_name || "").trim();
    const idEventoColumnSql = [
      colType,
      charset ? `CHARACTER SET ${charset}` : "",
      collation ? `COLLATE ${collation}` : "",
      "NOT NULL",
    ].filter(Boolean).join(" ");

    await conn.query(`
      CREATE TABLE IF NOT EXISTS anticipos_evento (
        id VARCHAR(100) NOT NULL,
        id_evento ${idEventoColumnSql},
        fecha_anticipo DATE NOT NULL,
        monto DECIMAL(12,2) NOT NULL DEFAULT 0,
        tipo_pago VARCHAR(40) NOT NULL DEFAULT 'Efectivo',
        descripcion VARCHAR(255) NULL,
        creado_en_iso VARCHAR(50) NULL,
        creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_anticipos_evento (id_evento, fecha_anticipo)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    try {
      await conn.query(`ALTER TABLE anticipos_evento MODIFY COLUMN id_evento ${idEventoColumnSql}`);
    } catch (_) {
      // Keep startup resilient even if existing data/definition blocks MODIFY.
    }

    const eventosTableRows = await conn.query(
      `SELECT engine
       FROM information_schema.tables
       WHERE table_schema = ? AND table_name = 'eventos'
       LIMIT 1`,
      [DB_NAME]
    );
    const eventosEngine = String(eventosTableRows?.[0]?.engine || "").trim().toUpperCase();
    const fkRows = await conn.query(
      `SELECT constraint_name
       FROM information_schema.table_constraints
       WHERE table_schema = ? AND table_name = 'anticipos_evento' AND constraint_type = 'FOREIGN KEY'`,
      [DB_NAME]
    );
    const fkSet = new Set(fkRows.map((r) => String(r.constraint_name || "").toLowerCase()));

    if (eventosEngine === "INNODB" && !fkSet.has("fk_anticipos_evento")) {
      try {
        await conn.query(`
          ALTER TABLE anticipos_evento
          ADD CONSTRAINT fk_anticipos_evento
            FOREIGN KEY (id_evento) REFERENCES eventos(id)
            ON DELETE CASCADE
            ON UPDATE CASCADE
        `);
      } catch (fkError) {
        console.warn("No se pudo agregar FK fk_anticipos_evento:", fkError?.message || fkError);
      }
    }

    // === Migracion: columnas adicionales para normalizar pagos ===
    const migrationColumns = [
      { name: "numero_boleta", sql: "ALTER TABLE anticipos_evento ADD COLUMN numero_boleta VARCHAR(100) NULL" },
      { name: "id_usuario_creador", sql: "ALTER TABLE anticipos_evento ADD COLUMN id_usuario_creador VARCHAR(100) NULL" },
      { name: "nombre_usuario_creador", sql: "ALTER TABLE anticipos_evento ADD COLUMN nombre_usuario_creador VARCHAR(255) NULL" },
      { name: "nombre_evidencia", sql: "ALTER TABLE anticipos_evento ADD COLUMN nombre_evidencia VARCHAR(255) NULL" },
      { name: "tipo_evidencia", sql: "ALTER TABLE anticipos_evento ADD COLUMN tipo_evidencia VARCHAR(100) NULL" },
      { name: "datos_evidencia", sql: "ALTER TABLE anticipos_evento ADD COLUMN datos_evidencia MEDIUMTEXT NULL" },
      { name: "editado_por_id", sql: "ALTER TABLE anticipos_evento ADD COLUMN editado_por_id VARCHAR(100) NULL" },
      { name: "editado_por_nombre", sql: "ALTER TABLE anticipos_evento ADD COLUMN editado_por_nombre VARCHAR(255) NULL" },
      { name: "editado_en_iso", sql: "ALTER TABLE anticipos_evento ADD COLUMN editado_en_iso VARCHAR(50) NULL" },
    ];
    for (const col of migrationColumns) {
      try {
        const exists = await conn.query(
          `SELECT 1 FROM information_schema.columns WHERE table_schema = ? AND table_name = 'anticipos_evento' AND column_name = ? LIMIT 1`,
          [DB_NAME, col.name]
        );
        if (exists.length === 0) {
          await conn.query(col.sql);
        }
      } catch (_) {}
    }

    // === Crear tabla historial_anticipos para bitacora de operaciones ===
    await conn.query(`
      CREATE TABLE IF NOT EXISTS historial_anticipos (
        id VARCHAR(100) NOT NULL,
        id_anticipo VARCHAR(100) NOT NULL,
        id_evento ${idEventoColumnSql},
        accion VARCHAR(20) NOT NULL DEFAULT 'added',
        id_usuario_actor VARCHAR(100) NULL,
        nombre_usuario_actor VARCHAR(255) NULL,
        detalle TEXT NULL,
        creado_en_iso VARCHAR(50) NULL,
        creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_historial_anticipos_evento (id_evento),
        KEY idx_historial_anticipos_anticipo (id_anticipo)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  } finally {
    if (conn) conn.release();
  }
}

async function ensureMenuMontajeCatalogStructure() {
  // Catalogo de menus y montajes deshabilitado / removido.
}

async function ensureQuoteItemPrimaryKeyColumnSize() {
  let conn;
  try {
    conn = await pool.getConnection();
    const cols = await conn.query(
      `SELECT column_name, character_maximum_length FROM information_schema.columns WHERE table_schema = ? AND table_name = 'items_cotizacion_evento' AND column_name = 'id'`,
      [DB_NAME]
    );
    if (cols.length > 0) {
      const currentLen = Number(cols[0].character_maximum_length);
      if (currentLen < 200) {
        await conn.query("ALTER TABLE items_cotizacion_evento MODIFY COLUMN id VARCHAR(200) NOT NULL");
      }
    }
  } finally {
    if (conn) conn.release();
  }
}

async function ensureRequiredTables() {
  let conn;
  try {
    conn = await pool.getConnection();
    const rows = await conn.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = ?`,
      [DB_NAME]
    );
    const existing = new Set(rows.map((r) => String(r.table_name || "").toLowerCase()));
    const missing = REQUIRED_TABLES.filter((t) => !existing.has(t));
    if (missing.length) {
      throw new Error(`Faltan tablas requeridas: ${missing.join(", ")}`);
    }
  } finally {
    if (conn) conn.release();
  }
}

async function readStateFromTables() {
  let conn;
  try {
    conn = await pool.getConnection();

    const [
      salones,
      usuarios,
      empresas,
      encargados,
      eventos,
      historial,
      recordatorios,
      appStateRows,
      dbAnticipos,
    ] = await Promise.all([
      conn.query("SELECT id, nombre FROM salones ORDER BY id"),
      conn.query("SELECT id, nombre, nombre_usuario, nombre_completo, correo, telefono, contrasena, firma_data_url, avatar_data_url, activo, influye_meta_ventas, metas_mensuales_json, tiers_comision_json, rol FROM usuarios ORDER BY creado_en, id"),
      conn.query("SELECT id, nombre, encargado_principal, correo, nit, razon_social, tipo_evento, direccion, telefono, notas FROM empresas ORDER BY creado_en, id"),
      conn.query("SELECT id, id_empresa, nombre, telefono, correo, direccion FROM encargados_empresa ORDER BY creado_en, id"),
      conn.query("SELECT id, id_grupo, nombre, nombre_salon, fecha_evento, fecha_inicio_reserva, fecha_fin_reserva, hora_inicio, hora_fin, estado, id_usuario, pax, notas, cotizacion_json FROM eventos ORDER BY fecha_evento, hora_inicio, id"),
      conn.query("SELECT clave_evento, cambiado_en_iso, id_usuario_actor, nombre_actor, cambio_texto FROM historial_evento ORDER BY id DESC"),
      conn.query("SELECT id, clave_evento, fecha_recordatorio, hora_recordatorio, medio, notas, creado_en_iso, id_usuario_creador FROM recordatorios_evento ORDER BY id"),
      conn.query("SELECT clave, valor_json FROM app_state_kv WHERE clave IN ('services','serviceCategories','quickTemplates','quoteServiceTemplates','disabledCompanies','disabledServices','disabledManagers','disabledSalones','globalMonthlyGoals','checklistTemplates','checklistTemplateItems','checklistTemplateSections','menuMontajeSections','menuMontajeBebidas','eventChecklists','occupancyWeeklyOps','salonCapacities','salonOccupancyEnabled')"),
      conn.query("SELECT id, id_evento, fecha_anticipo, monto, tipo_pago, descripcion, numero_boleta, id_usuario_creador, nombre_usuario_creador, nombre_evidencia, tipo_evidencia, datos_evidencia, creado_en_iso FROM anticipos_evento ORDER BY fecha_anticipo, id"),
    ]);

    let dbServicesList = [];
    let dbServiceCategories = null;
    try {
      const svcRows = await conn.query("SELECT s.id, s.nombre, s.precio, s.descripcion, s.id_categoria, s.id_subcategoria, s.modo_cantidad, s.activo, c.nombre AS cat_nombre, sc.nombre AS sub_nombre FROM servicios s LEFT JOIN categorias_servicio c ON c.id = s.id_categoria LEFT JOIN subcategorias_servicio sc ON sc.id = s.id_subcategoria ORDER BY s.id");
      dbServicesList = svcRows.map((r) => ({
        id: str(r.id),
        name: str(r.nombre).trim(),
        price: Number(r.precio || 0),
        description: str(r.descripcion || "").trim(),
        category: str(r.cat_nombre || "").trim() || "General",
        subcategory: str(r.sub_nombre || "").trim(),
        quantityMode: String(r.modo_cantidad || "MANUAL").trim(),
        active: Number(r.activo) !== 0
      }));
      // Read categories from tables too
      const catRows = await conn.query("SELECT c.id, c.nombre, c.activo, sc.id AS sc_id, sc.nombre AS sc_nombre, sc.activo AS sc_activo FROM categorias_servicio c LEFT JOIN subcategorias_servicio sc ON sc.id_categoria = c.id ORDER BY c.id, sc.id");
      const catMap = {};
      for (const r of catRows) {
        const catId = String(r.id);
        if (!catMap[catId]) {
          catMap[catId] = { id: catId, name: str(r.nombre).trim(), subcategories: [] };
        }
        if (r.sc_id) {
          catMap[catId].subcategories.push({ id: String(r.sc_id), name: str(r.sc_nombre).trim() });
        }
      }
      dbServiceCategories = Object.values(catMap);
    } catch (_) {
      // Fallback to app_state_kv on error
      try {
        const servicesRow = appStateRows.find((r) => String(r.clave) === "services");
        if (servicesRow?.valor_json) {
          const parsed = JSON.parse(servicesRow.valor_json);
          if (Array.isArray(parsed)) {
            dbServicesList = parsed.map((s) => ({
              id: String(s.id),
              name: String(s.name),
              price: Number(s.price || 0),
              description: String(s.description || s.desc || ""),
              category: String(s.category || 'General'),
              subcategory: String(s.subcategory || ''),
              quantityMode: String(s.quantityMode || 'MANUAL'),
              active: s.active !== false
            }));
          }
        }
      } catch (__) {}
    }
    const bebidasCatalog = [];

    const hasData = salones.length || usuarios.length || empresas.length || eventos.length;
    if (!hasData) return null;

    const dbPlatosFuertes = [];
    const dbPreparaciones = [];
    const dbSalsas = [];
    const dbGuarniciones = [];
    const dbPostres = [];
    const dbBebidas = [];
    const dbComentarios = [];
    const dbMontajeTipos = [];
    const dbMontajeAdicionales = [];
    const sugSalsas = [];
    const sugPostres = [];
    const sugGuarniciones = [];
    const sugBebidas = [];
    const sugMontajeTipos = [];
    const sugMontajeAdicionales = [];

    const menuCatalogList = [];
    for (const r of dbPlatosFuertes) {
      menuCatalogList.push({
        id: Number(r.id),
        kind: "plato_fuerte",
        name: str(r.nombre),
        active: Number(r.activo) !== 0,
        dishType: str(r.tipo_plato || "NORMAL"),
        noProtein: Number(r.es_sin_proteina) !== 0,
      });
    }
    for (const r of dbPreparaciones) {
      menuCatalogList.push({
        id: Number(r.id),
        kind: "preparacion",
        name: str(r.nombre),
        active: Number(r.activo) !== 0,
        proteinId: String(r.id_plato_fuerte),
      });
    }
    for (const r of dbSalsas) {
      menuCatalogList.push({
        id: Number(r.id),
        kind: "salsa",
        name: str(r.nombre),
        active: Number(r.activo) !== 0,
      });
    }
    for (const r of dbGuarniciones) {
      menuCatalogList.push({
        id: Number(r.id),
        kind: "guarnicion",
        name: str(r.nombre),
        active: Number(r.activo) !== 0,
      });
    }
    for (const r of dbPostres) {
      menuCatalogList.push({
        id: Number(r.id),
        kind: "postre",
        name: str(r.nombre),
        active: Number(r.activo) !== 0,
      });
    }
    for (const r of dbBebidas) {
      menuCatalogList.push({
        id: Number(r.id),
        kind: "bebida",
        name: str(r.nombre),
        active: Number(r.activo) !== 0,
      });
    }
    for (const r of dbComentarios) {
      menuCatalogList.push({
        id: Number(r.id),
        kind: "comentario",
        name: str(r.nombre),
        active: Number(r.activo) !== 0,
      });
    }
    for (const r of dbMontajeTipos) {
      menuCatalogList.push({
        id: Number(r.id),
        kind: "montaje_tipo",
        name: str(r.nombre),
        active: Number(r.activo) !== 0,
      });
    }
    for (const r of dbMontajeAdicionales) {
      menuCatalogList.push({
        id: Number(r.id),
        kind: "montaje_adicional",
        name: str(r.nombre),
        active: Number(r.activo) !== 0,
        tipo: str(r.tipo),
      });
    }

    const suggestionsMap = new Map();
    function getOrCreateSuggestion(pfId, prepId) {
      const key = `${pfId}|${prepId}`;
      if (!suggestionsMap.has(key)) {
        suggestionsMap.set(key, {
          proteinId: String(pfId),
          preparationId: String(prepId),
          salsas: [],
          guarniciones: [],
          postres: [],
          bebidas: [],
          montajeTipos: [],
          montajeAdicionales: [],
        });
      }
      return suggestionsMap.get(key);
    }
    for (const r of sugSalsas) {
      const s = getOrCreateSuggestion(r.id_plato_fuerte, r.id_preparacion);
      s.salsas.push(Number(r.id_salsa));
    }
    for (const r of sugPostres) {
      const s = getOrCreateSuggestion(r.id_plato_fuerte, r.id_preparacion);
      s.postres.push(Number(r.id_postre));
    }
    for (const r of sugGuarniciones) {
      const s = getOrCreateSuggestion(r.id_plato_fuerte, r.id_preparacion);
      s.guarniciones.push(Number(r.id_guarnicion));
    }
    for (const r of sugBebidas) {
      const s = getOrCreateSuggestion(r.id_plato_fuerte, r.id_preparacion);
      s.bebidas.push(Number(r.id_bebida));
    }
    for (const r of sugMontajeTipos) {
      const s = getOrCreateSuggestion(r.id_plato_fuerte, r.id_preparacion);
      s.montajeTipos.push(Number(r.id_montaje_tipo));
    }
    for (const r of sugMontajeAdicionales) {
      const s = getOrCreateSuggestion(r.id_plato_fuerte, r.id_preparacion);
      s.montajeAdicionales.push(Number(r.id_adicional));
    }
    const menuSuggestionsList = Array.from(suggestionsMap.values());

    const managersByCompany = new Map();
    for (const m of encargados) {
      const companyId = str(m.id_empresa);
      if (!companyId) continue;
      if (!managersByCompany.has(companyId)) managersByCompany.set(companyId, []);
      managersByCompany.get(companyId).push({
        id: str(m.id),
        name: str(m.nombre),
        phone: str(m.telefono),
        email: str(m.correo),
        address: str(m.direccion),
      });
    }

    const state = {
      salones: salones.map((r) => str(r.nombre)).filter(Boolean),
      users: usuarios.map((u) => {
        let monthlyGoals = [];
        try {
          const parsed = JSON.parse(str(u.metas_mensuales_json) || "[]");
          if (Array.isArray(parsed)) {
            monthlyGoals = parsed
              .map((g) => ({
                month: str(g?.month),
                amount: Number(g?.amount || 0),
              }))
              .filter((g) => /^\d{4}-\d{2}$/.test(g.month) && Number.isFinite(g.amount) && g.amount > 0);
          }
        } catch (_) { }
        let goalTiers = [];
        try {
          const parsed = JSON.parse(str(u.tiers_comision_json) || "[]");
          if (Array.isArray(parsed)) {
            goalTiers = parsed
              .map((t) => ({
                name: str(t?.name || ''),
                amount: Math.max(0, Number(t?.amount || 0)),
                percentage: Math.max(0, Number(t?.percentage || 0)),
              }))
              .filter((t) => t.amount > 0);
          }
        } catch (_) { }
        return {
          id: str(u.id),
          name: str(u.nombre),
          username: str(u.nombre_usuario),
          fullName: str(u.nombre_completo) || str(u.nombre),
          email: str(u.correo),
          phone: str(u.telefono),
          password: str(u.contrasena),
          signatureDataUrl: str(u.firma_data_url),
          avatarDataUrl: str(u.avatar_data_url),
          active: Number(u.activo) !== 0,
          salesTargetEnabled: Number(u.influye_meta_ventas) !== 0,
          monthlyGoals,
          goalTiers,
          role: str(u.rol || 'vendedor'),
        };
      }).filter((u) => u.id && u.name),
      companies: empresas.map((c) => ({
        id: str(c.id),
        name: str(c.nombre),
        owner: str(c.encargado_principal),
        email: str(c.correo),
        nit: str(c.nit) || "CF",
        businessName: str(c.razon_social) || str(c.nombre),
        eventType: str(c.tipo_evento) || "Social",
        address: str(c.direccion),
        phone: str(c.telefono),
        notes: str(c.notes),
        managers: managersByCompany.get(str(c.id)) || [],
      })),
      services: dbServicesList,
      quickTemplates: [],
      quoteServiceTemplates: [],
      disabledCompanies: [],
      disabledServices: [],
      disabledManagers: [],
      disabledSalones: [],
      globalMonthlyGoals: [],
      checklistTemplates: [],
      checklistTemplateItems: [],
      checklistTemplateSections: ["General"],
      menuMontajeSections: ["General"],
      menuMontajeBebidas: (Array.isArray(bebidasCatalog) ? bebidasCatalog : []).map((b) => ({
        id: str(b.id),
        nombre: str(b.nombre),
        activo: Number(b.activo) !== 0,
      })),
      menuCatalog: menuCatalogList,
      menuSuggestions: menuSuggestionsList,
      eventChecklists: {},
      occupancyWeeklyOps: {},
      salonCapacities: {},
      changeHistory: {},
      reminders: {},
      events: (() => {
        const advancesByEvent = new Map();
        for (const a of dbAnticipos) {
          const eid = str(a.id_evento);
          if (!eid) continue;
          if (!advancesByEvent.has(eid)) advancesByEvent.set(eid, []);
          advancesByEvent.get(eid).push({
            id: str(a.id),
            amount: Number(a.monto),
            paymentType: str(a.tipo_pago),
            date: toIsoDate(a.fecha_anticipo),
            voucherNumber: str(a.numero_boleta || ""),
            description: str(a.descripcion || ""),
            evidenceDataUrl: str(a.datos_evidencia || ""),
            evidenceName: str(a.nombre_evidencia || ""),
            evidenceType: str(a.tipo_evidencia || ""),
            createdAt: str(a.creado_en_iso || ""),
            createdByUserId: str(a.id_usuario_creador || ""),
            createdByName: str(a.nombre_usuario_creador || ""),
          });
        }
        return eventos.map((e) => {
          let quote = null;
          if (e.cotizacion_json) {
            try {
              quote = JSON.parse(e.cotizacion_json);
            } catch (_) {
              quote = null;
            }
          }
          const tableAdvances = advancesByEvent.get(str(e.id));
          if (tableAdvances && tableAdvances.length > 0) {
            if (!quote || typeof quote !== "object") quote = {};
            quote.advances = tableAdvances;
          }
          return {
            id: str(e.id),
            groupId: e.id_grupo ? str(e.id_grupo) : null,
            name: str(e.nombre),
            salon: str(e.nombre_salon),
            date: toIsoDate(e.fecha_evento),
            eventDateStart: toIsoDate(e.fecha_inicio_reserva) || toIsoDate(e.fecha_evento),
            eventDateEnd: toIsoDate(e.fecha_fin_reserva) || toIsoDate(e.fecha_inicio_reserva) || toIsoDate(e.fecha_evento),
            endDate: toIsoDate(e.fecha_fin_reserva) || toIsoDate(e.fecha_inicio_reserva) || toIsoDate(e.fecha_evento),
            status: str(e.estado),
            startTime: toHHmm(e.hora_inicio),
            endTime: toHHmm(e.hora_fin),
            userId: str(e.id_usuario),
            pax: e.pax === null || e.pax === undefined ? null : Number(e.pax),
            notes: str(e.notes),
            quote,
          };
        });
      })(),
    };

    for (const row of historial) {
      const key = str(row.clave_evento);
      if (!key) continue;
      if (!Array.isArray(state.changeHistory[key])) state.changeHistory[key] = [];
      state.changeHistory[key].push({
        at: str(row.cambiado_en_iso) || new Date().toISOString(),
        actorUserId: str(row.id_usuario_actor),
        actorName: str(row.nombre_actor) || "Sistema",
        change: str(row.cambio_texto),
      });
    }

    const quickTemplatesRow = appStateRows.find((r) => str(r.clave) === "quickTemplates");
    const quoteServiceTemplatesRow = appStateRows.find((r) => str(r.clave) === "quoteServiceTemplates");
    if (quickTemplatesRow?.valor_json) {
      try {
        const parsed = JSON.parse(quickTemplatesRow.valor_json);
        state.quickTemplates = Array.isArray(parsed) ? parsed : [];
      } catch (_) {
        state.quickTemplates = [];
      }
    }
    if (quoteServiceTemplatesRow?.valor_json) {
      try {
        const parsed = JSON.parse(quoteServiceTemplatesRow.valor_json);
        state.quoteServiceTemplates = Array.isArray(parsed) ? parsed : [];
      } catch (_) {
        state.quoteServiceTemplates = [];
      }
    }
    const disabledCompaniesRow = appStateRows.find((r) => str(r.clave) === "disabledCompanies");
    const disabledServicesRow = appStateRows.find((r) => str(r.clave) === "disabledServices");
    const disabledManagersRow = appStateRows.find((r) => str(r.clave) === "disabledManagers");
    const disabledSalonesRow = appStateRows.find((r) => str(r.clave) === "disabledSalones");
    const globalMonthlyGoalsRow = appStateRows.find((r) => str(r.clave) === "globalMonthlyGoals");
    const checklistTemplatesRow = appStateRows.find((r) => str(r.clave) === "checklistTemplates");
    const checklistTemplateItemsRow = appStateRows.find((r) => str(r.clave) === "checklistTemplateItems");
    const checklistTemplateSectionsRow = appStateRows.find((r) => str(r.clave) === "checklistTemplateSections");
    const menuMontajeSectionsRow = appStateRows.find((r) => str(r.clave) === "menuMontajeSections");
    const menuMontajeBebidasRow = appStateRows.find((r) => str(r.clave) === "menuMontajeBebidas");
    const eventChecklistsRow = appStateRows.find((r) => str(r.clave) === "eventChecklists");
    const occupancyWeeklyOpsRow = appStateRows.find((r) => str(r.clave) === "occupancyWeeklyOps");
    const salonCapacitiesRow = appStateRows.find((r) => str(r.clave) === "salonCapacities");
    const salonOccupancyEnabledRow = appStateRows.find((r) => str(r.clave) === "salonOccupancyEnabled");

    const parseArray = (row) => {
      if (!row?.valor_json) return [];
      try {
        const parsed = JSON.parse(row.valor_json);
        return Array.isArray(parsed) ? parsed.map((x) => str(x)).filter(Boolean) : [];
      } catch (_) {
        return [];
      }
    };
    state.disabledCompanies = parseArray(disabledCompaniesRow);
    state.disabledServices = parseArray(disabledServicesRow);
    state.disabledManagers = parseArray(disabledManagersRow);
    state.disabledSalones = parseArray(disabledSalonesRow);
    try {
      const parsed = JSON.parse(str(globalMonthlyGoalsRow?.valor_json) || "[]");
      state.globalMonthlyGoals = Array.isArray(parsed)
        ? parsed
          .map((g) => ({
            month: str(g?.month),
            amount: Math.max(0, Number(g?.amount || 0)),
            active: g?.active === false ? false : true,
          }))
          .filter((g) => /^\d{4}-\d{2}$/.test(g.month))
          .sort((a, b) => a.month.localeCompare(b.month))
        : [];
    } catch (_) {
      state.globalMonthlyGoals = [];
    }
    try {
      const parsed = JSON.parse(str(checklistTemplatesRow?.valor_json) || "[]");
      state.checklistTemplates = Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      state.checklistTemplates = [];
    }
    try {
      const parsed = JSON.parse(str(checklistTemplateItemsRow?.valor_json) || "[]");
      state.checklistTemplateItems = Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      state.checklistTemplateItems = [];
    }
    try {
      const parsed = JSON.parse(str(checklistTemplateSectionsRow?.valor_json) || '["General"]');
      state.checklistTemplateSections = Array.isArray(parsed)
        ? parsed.map((s) => str(s)).filter(Boolean)
        : ["General"];
      if (!state.checklistTemplateSections.length) state.checklistTemplateSections = ["General"];
    } catch (_) {
      state.checklistTemplateSections = ["General"];
    }
    try {
      const parsed = JSON.parse(str(menuMontajeSectionsRow?.valor_json) || '["General"]');
      state.menuMontajeSections = Array.isArray(parsed)
        ? parsed.map((s) => str(s)).filter(Boolean)
        : ["General"];
      if (!state.menuMontajeSections.length) state.menuMontajeSections = ["General"];
    } catch (_) {
      state.menuMontajeSections = ["General"];
    }
    if (!Array.isArray(state.menuMontajeBebidas) || !state.menuMontajeBebidas.length) {
      try {
        const parsed = JSON.parse(str(menuMontajeBebidasRow?.valor_json) || "[]");
        state.menuMontajeBebidas = Array.isArray(parsed)
          ? parsed
            .map((b) => ({
              id: str(b?.id),
              nombre: str(b?.nombre || b?.name),
              activo: b?.activo === false ? false : true,
            }))
            .filter((b) => b.id && b.nombre)
          : [];
      } catch (_) {
        state.menuMontajeBebidas = [];
      }
    }
    try {
      const parsed = JSON.parse(str(eventChecklistsRow?.valor_json) || "{}");
      state.eventChecklists = (parsed && typeof parsed === "object") ? parsed : {};
    } catch (_) {
      state.eventChecklists = {};
    }
    try {
      const parsed = JSON.parse(str(occupancyWeeklyOpsRow?.valor_json) || "{}");
      state.occupancyWeeklyOps = (parsed && typeof parsed === "object") ? parsed : {};
    } catch (_) {
      state.occupancyWeeklyOps = {};
    }
    try {
      const parsed = JSON.parse(str(salonCapacitiesRow?.valor_json) || "{}");
      state.salonCapacities = (parsed && typeof parsed === "object") ? parsed : {};
    } catch (_) {
      state.salonCapacities = {};
    }
    try {
      const parsed = JSON.parse(str(salonOccupancyEnabledRow?.valor_json) || "[]");
      state.salonOccupancyEnabled = Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      state.salonOccupancyEnabled = [];
    }

    if (dbServiceCategories && dbServiceCategories.length > 0) {
      state.serviceCategories = dbServiceCategories;
    } else {
      const serviceCategoriesRow = appStateRows.find((r) => str(r.clave) === "serviceCategories");
      try {
        const parsed = JSON.parse(str(serviceCategoriesRow?.valor_json) || "[]");
        state.serviceCategories = Array.isArray(parsed) ? parsed : [];
      } catch (_) {
        state.serviceCategories = [];
      }
    }

    for (const row of recordatorios) {
      const key = str(row.clave_evento);
      if (!key) continue;
      if (!Array.isArray(state.reminders[key])) state.reminders[key] = [];
      state.reminders[key].push({
        id: str(row.id),
        date: toIsoDate(row.fecha_recordatorio),
        time: toHHmm(row.hora_recordatorio),
        channel: str(row.medio),
        notes: str(row.notas),
        createdAt: str(row.creado_en_iso) || new Date().toISOString(),
        createdByUserId: str(row.id_usuario_creador),
      });
    }

    return { state, updatedAt: new Date().toISOString() };
  } finally {
    if (conn) conn.release();
  }
}

async function readSalonesFromTables() {
  let conn;
  try {
    conn = await pool.getConnection();
    const rows = await conn.query("SELECT nombre FROM salones ORDER BY id");
    return rows.map((r) => str(r.nombre)).filter(Boolean);
  } finally {
    if (conn) conn.release();
  }
}

async function readCategoriasServicioFromTables() {
  let conn;
  try {
    conn = await pool.getConnection();
    const rows = await conn.query("SELECT id, nombre, activo FROM categorias_servicio ORDER BY id");
    return rows.map((r) => ({ id: Number(r.id), nombre: str(r.nombre).trim(), activo: Number(r.activo) !== 0 }));
  } finally {
    if (conn) conn.release();
  }
}

async function readSubcategoriasServicioFromTables(categoriaId = null) {
  let conn;
  try {
    conn = await pool.getConnection();
    let rows;
    if (categoriaId) {
      rows = await conn.query("SELECT id, id_categoria, nombre, activo FROM subcategorias_servicio WHERE id_categoria = ? ORDER BY id", [Number(categoriaId)]);
    } else {
      rows = await conn.query("SELECT id, id_categoria, nombre, activo FROM subcategorias_servicio ORDER BY id_categoria, id");
    }
    return rows.map((r) => ({ id: Number(r.id), id_categoria: Number(r.id_categoria), nombre: str(r.nombre).trim(), activo: Number(r.activo) !== 0 }));
  } finally {
    if (conn) conn.release();
  }
}

async function createCategoriaServicioInTable(nombre) {
  let conn;
  try {
    conn = await pool.getConnection();
    const result = await conn.query("INSERT INTO categorias_servicio (nombre) VALUES (?)", [str(nombre).trim() || "Sin nombre"]);
    return { id: Number(result.insertId), nombre: str(nombre).trim(), activo: true };
  } finally {
    if (conn) conn.release();
  }
}

async function updateCategoriaServicioInTable(id, nombre) {
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.query("UPDATE categorias_servicio SET nombre = ? WHERE id = ?", [str(nombre).trim() || "Sin nombre", Number(id)]);
    return { id: Number(id), nombre: str(nombre).trim() };
  } finally {
    if (conn) conn.release();
  }
}

async function createSubcategoriaServicioInTable(idCategoria, nombre) {
  let conn;
  try {
    conn = await pool.getConnection();
    const result = await conn.query("INSERT INTO subcategorias_servicio (id_categoria, nombre) VALUES (?, ?)", [Number(idCategoria), str(nombre).trim() || "Sin nombre"]);
    return { id: Number(result.insertId), id_categoria: Number(idCategoria), nombre: str(nombre).trim(), activo: true };
  } finally {
    if (conn) conn.release();
  }
}

async function updateSubcategoriaServicioInTable(id, idCategoria, nombre) {
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.query("UPDATE subcategorias_servicio SET id_categoria = ?, nombre = ? WHERE id = ?", [Number(idCategoria), str(nombre).trim() || "Sin nombre", Number(id)]);
    return { id: Number(id), id_categoria: Number(idCategoria), nombre: str(nombre).trim() };
  } finally {
    if (conn) conn.release();
  }
}

async function setCategoriaServicioActivoInTable(id, activo) {
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.query("UPDATE categorias_servicio SET activo = ? WHERE id = ?", [activo ? 1 : 0, Number(id)]);
    return { id: Number(id), activo: !!activo };
  } finally {
    if (conn) conn.release();
  }
}

async function setSubcategoriaServicioActivoInTable(id, activo) {
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.query("UPDATE subcategorias_servicio SET activo = ? WHERE id = ?", [activo ? 1 : 0, Number(id)]);
    return { id: Number(id), activo: !!activo };
  } finally {
    if (conn) conn.release();
  }
}

async function deleteCategoriaServicioFromTable(id) {
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.query("DELETE FROM categorias_servicio WHERE id = ?", [Number(id)]);
    return { deleted: true };
  } finally {
    if (conn) conn.release();
  }
}

async function deleteSubcategoriaServicioFromTable(id) {
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.query("DELETE FROM subcategorias_servicio WHERE id = ?", [Number(id)]);
    return { deleted: true };
  } finally {
    if (conn) conn.release();
  }
}

// ==================== SERVICE CRUD HELPERS ====================

async function readServiciosFromTables() {
  let conn;
  try {
    conn = await pool.getConnection();
    const rows = await conn.query(
      "SELECT s.id, s.nombre, s.precio, s.descripcion, s.id_categoria, s.id_subcategoria, s.modo_cantidad, s.activo, c.nombre AS cat_nombre, sc.nombre AS sub_nombre FROM servicios s LEFT JOIN categorias_servicio c ON c.id = s.id_categoria LEFT JOIN subcategorias_servicio sc ON sc.id = s.id_subcategoria ORDER BY s.id"
    );
    return rows.map((r) => ({
      id: str(r.id),
      name: str(r.nombre).trim(),
      price: Number(r.precio || 0),
      description: str(r.descripcion || "").trim(),
      category: str(r.cat_nombre || "").trim() || "General",
      subcategory: str(r.sub_nombre || "").trim(),
      quantityMode: str(r.modo_cantidad || "MANUAL").trim(),
      id_categoria: r.id_categoria ? Number(r.id_categoria) : null,
      id_subcategoria: r.id_subcategoria ? Number(r.id_subcategoria) : null,
      active: Number(r.activo) !== 0,
    }));
  } finally {
    if (conn) conn.release();
  }
}

async function createServicioInTable(svc) {
  let conn;
  try {
    conn = await pool.getConnection();
    const svcId = str(svc.id).trim() || ("svc_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7));
    await conn.query(
      "INSERT INTO servicios (id, nombre, precio, descripcion, id_categoria, id_subcategoria, modo_cantidad, activo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        svcId,
        str(svc.name || "Sin nombre").trim(),
        Number(svc.price || 0),
        str(svc.description || "").trim() || null,
        svc.id_categoria ? Number(svc.id_categoria) : null,
        svc.id_subcategoria ? Number(svc.id_subcategoria) : null,
        String(svc.quantityMode || "MANUAL").trim(),
        svc.active !== false ? 1 : 0,
      ]
    );
    return { id: svcId, ...svc };
  } finally {
    if (conn) conn.release();
  }
}

async function updateServicioInTable(svc) {
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.query(
      "UPDATE servicios SET nombre = ?, precio = ?, descripcion = ?, id_categoria = ?, id_subcategoria = ?, modo_cantidad = ?, activo = ? WHERE id = ?",
      [
        str(svc.name || "Sin nombre").trim(),
        Number(svc.price || 0),
        str(svc.description || "").trim() || null,
        svc.id_categoria ? Number(svc.id_categoria) : null,
        svc.id_subcategoria ? Number(svc.id_subcategoria) : null,
        String(svc.quantityMode || "MANUAL").trim(),
        svc.active !== false ? 1 : 0,
        str(svc.id).trim(),
      ]
    );
    return { ...svc };
  } finally {
    if (conn) conn.release();
  }
}

async function deleteServicioFromTable(id) {
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.query("DELETE FROM servicios WHERE id = ?", [str(id).trim()]);
    return { deleted: true };
  } finally {
    if (conn) conn.release();
  }
}

async function recoverServiceCatalogFromServices(options = {}) {
  return { updated: 0, categoriesCreated: 0 };
}

async function readSimpleMenuCatalog(kind) {
  return [];
}

async function createSimpleMenuCatalog(kind, nombre, extras = {}) {
  return;
}

async function readPreparacionesByPlato(idPlatoFuerte) {
  return [];
}

async function createPreparacionForPlato(idPlatoFuerte, nombre) {
  return;
}

async function updateSimpleMenuCatalog(kind, id, changes = {}) {
  return;
}

async function updatePreparacionById(id, changes = {}) {
  return;
}

async function readMenuSuggestionLinks({ idPlatoFuerte, idPreparacion }) {
  return {
    salsaIds: [],
    postreIds: [],
    guarnicionIds: [],
    bebidaIds: [],
    montajeTipoIds: [],
    montajeAdicionalIds: []
  };
}

async function saveMenuSuggestionLinks({ idPlatoFuerte, idPreparacion, salsaIds, postreIds, guarnicionIds, bebidaIds, montajeTipoIds, montajeAdicionalIds }) {
  return;
}

async function readLoginUsers() {
  let conn;
  try {
    conn = await pool.getConnection();
    const rows = await conn.query(
      `
        SELECT id, nombre, nombre_usuario, nombre_completo, avatar_data_url, firma_data_url, rol
        FROM usuarios
        WHERE activo = 1
        ORDER BY nombre_completo, nombre_usuario, nombre
      `
    );
    return rows
      .map((r) => ({
        id: str(r.id),
        name: str(r.nombre),
        fullName: str(r.nombre_completo) || str(r.nombre),
        username: str(r.nombre_usuario),
        avatarDataUrl: str(r.avatar_data_url),
        signatureDataUrl: str(r.firma_data_url),
        role: str(r.rol || 'vendedor'),
      }))
      .filter((u) => u.id);
  } finally {
    if (conn) conn.release();
  }
}

async function authenticateUser(userId, password) {
  let conn;
  try {
    conn = await pool.getConnection();
    const rows = await conn.query(
      `
        SELECT id, nombre, nombre_usuario, nombre_completo, correo, contrasena, avatar_data_url, firma_data_url, rol
        FROM usuarios
        WHERE id = ? AND activo = 1
        LIMIT 1
      `,
      [str(userId).trim()]
    );
    const row = rows?.[0];
    if (!row) return null;
    const ok = await verifyPassword(password, str(row.contrasena));
    if (!ok) return null;
    return {
      id: str(row.id),
      name: str(row.nombre),
      fullName: str(row.nombre_completo) || str(row.nombre),
      username: str(row.nombre_usuario),
      email: str(row.correo),
      avatarDataUrl: str(row.avatar_data_url),
      signatureDataUrl: str(row.firma_data_url),
      role: str(row.rol || 'vendedor'),
    };
  } finally {
    if (conn) conn.release();
  }
}

async function ensureDefaultUserCarlos() {
  let conn;
  try {
    conn = await pool.getConnection();
    const username = "csamalaj";
    const existing = await conn.query(
      "SELECT id FROM usuarios WHERE nombre_usuario = ? LIMIT 1",
      [username]
    );
    if (existing.length) return;
    const id = `usr_${Date.now()}`;
    const passwordHash = await ensurePasswordHash("12031991");
    await conn.query(
      `
        INSERT INTO usuarios
          (id, nombre, nombre_usuario, nombre_completo, correo, telefono, contrasena, firma_data_url, avatar_data_url, activo, rol)
        VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, 1, 'admin')
      `,
      [
        id,
        "Carlos Roberto Samalaj",
        username,
        "Carlos Roberto Samalaj",
        "sistemas@jardinesdellago.com",
        "56325547",
        passwordHash,
      ]
    );
  } finally {
    if (conn) conn.release();
  }
}

async function writeStateToTables(state) {
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();
    await conn.query("SET FOREIGN_KEY_CHECKS = 0");

    const salones = Array.isArray(state.salones) ? state.salones : [];
    const users = Array.isArray(state.users) ? state.users : [];
    const companies = Array.isArray(state.companies) ? state.companies : [];
    const services = Array.isArray(state.services) ? state.services : [];
    const serviceCategories = Array.isArray(state.serviceCategories) ? state.serviceCategories : [];
    const quickTemplates = Array.isArray(state.quickTemplates) ? state.quickTemplates : [];
    const quoteServiceTemplates = Array.isArray(state.quoteServiceTemplates) ? state.quoteServiceTemplates : [];
    const disabledCompanies = Array.isArray(state.disabledCompanies) ? state.disabledCompanies : [];
    const disabledServices = Array.isArray(state.disabledServices) ? state.disabledServices : [];
    const disabledManagers = Array.isArray(state.disabledManagers) ? state.disabledManagers : [];
    const disabledSalones = Array.isArray(state.disabledSalones) ? state.disabledSalones : [];
    const globalMonthlyGoals = Array.isArray(state.globalMonthlyGoals) ? state.globalMonthlyGoals : [];
    const checklistTemplates = Array.isArray(state.checklistTemplates) ? state.checklistTemplates : [];
    const checklistTemplateItems = Array.isArray(state.checklistTemplateItems) ? state.checklistTemplateItems : [];
    const checklistTemplateSections = Array.isArray(state.checklistTemplateSections) ? state.checklistTemplateSections : [];
    const menuMontajeSections = Array.isArray(state.menuMontajeSections) ? state.menuMontajeSections : [];
    const menuMontajeBebidas = Array.isArray(state.menuMontajeBebidas) ? state.menuMontajeBebidas : [];
    const eventChecklists = (state.eventChecklists && typeof state.eventChecklists === "object") ? state.eventChecklists : {};
    const occupancyWeeklyOps = (state.occupancyWeeklyOps && typeof state.occupancyWeeklyOps === "object") ? state.occupancyWeeklyOps : {};
    const salonCapacities = (state.salonCapacities && typeof state.salonCapacities === "object") ? state.salonCapacities : {};
    const salonOccupancyEnabled = Array.isArray(state.salonOccupancyEnabled) ? state.salonOccupancyEnabled : [];
    const events = Array.isArray(state.events)
      ? state.events.map((e) => ({ ...e, salon: e?.salon ?? "" }))
      : [];
    const changeHistory = (state.changeHistory && typeof state.changeHistory === "object") ? state.changeHistory : {};
    const reminders = (state.reminders && typeof state.reminders === "object") ? state.reminders : {};
    const usedQuoteCodes = new Set();
    let maxDesiredQuoteCodeNum = 0;

    for (const e of events) {
      const q = (e?.quote && typeof e.quote === "object") ? e.quote : null;
      if (!q) continue;
      const codeNum = parseQuoteCodeNumber(q.code);
      if (codeNum > maxDesiredQuoteCodeNum) maxDesiredQuoteCodeNum = codeNum;
    }
    if (maxDesiredQuoteCodeNum > 0) {
      await ensureDocSequenceAtLeast(conn, "COT", maxDesiredQuoteCodeNum);
    }

    // === UPSERT: salones, usuarios, empresas (delete+rewrite for config tables) ===
    await conn.query("DELETE FROM encargados_empresa");
    await conn.query("DELETE FROM empresas");
    await conn.query("DELETE FROM usuarios");
    await conn.query("DELETE FROM salones");

    for (const roomName of salones) {
      const nombre = str(roomName).trim();
      if (!nombre) continue;
      await conn.query("INSERT INTO salones (nombre) VALUES (?)", [nombre]);
    }

    // Validate no duplicate emails before inserting
    const seenEmails = new Set();
    const seenIds = new Set();
    for (const u of users) {
      const id = str(u?.id).trim();
      if (!id || seenIds.has(id)) continue;
      seenIds.add(id);
      const emailCheck = str(u?.email).trim().toLowerCase();
      if (emailCheck && seenEmails.has(emailCheck)) {
        console.warn(`[writeStateToTables] Email duplicado omitido: "${emailCheck}"`);
        continue;
      }
      if (emailCheck) seenEmails.add(emailCheck);
      const nombre = str(u?.name || u?.fullName).trim();
      const username = str(u?.username).trim() || null;
      const fullName = str(u?.fullName || u?.name).trim() || null;
      const email = str(u?.email).trim() || null;
      const phone = str(u?.phone).trim() || null;
      const passwordRaw = str(u?.password || u?.passwordHash).trim() || null;
      const password = passwordRaw ? await ensurePasswordHash(passwordRaw) : null;
      const signatureDataUrl = str(u?.signatureDataUrl).trim() || null;
      const avatarDataUrl = str(u?.avatarDataUrl).trim() || null;
      const active = u?.active === false ? 0 : 1;
      const salesTargetEnabled = u?.salesTargetEnabled === true ? 1 : 0;
      const monthlyGoals = Array.isArray(u?.monthlyGoals)
        ? u.monthlyGoals
          .map((g) => ({ month: str(g?.month), amount: Math.max(0, Number(g?.amount || 0)) }))
          .filter((g) => /^\d{4}-\d{2}$/.test(g.month) && Number.isFinite(g.amount) && g.amount > 0)
        : [];
      const goalTiers = Array.isArray(u?.goalTiers)
        ? u.goalTiers
          .map((t) => ({
            name: str(t?.name || ''),
            amount: Math.max(0, Number(t?.amount || 0)),
            percentage: Math.max(0, Number(t?.percentage || 0)),
          }))
          .filter((t) => t.amount > 0)
        : [];
      const rol = str(u?.role || u?.rol || 'vendedor').trim();
      if (!id || !nombre) continue;
      await conn.query(
        `
          INSERT INTO usuarios
            (id, nombre, nombre_usuario, nombre_completo, correo, telefono, contrasena, firma_data_url, avatar_data_url, activo, influye_meta_ventas, metas_mensuales_json, tiers_comision_json, rol)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            nombre = VALUES(nombre),
            nombre_usuario = VALUES(nombre_usuario),
            nombre_completo = VALUES(nombre_completo),
            correo = VALUES(correo),
            telefono = VALUES(telefono),
            contrasena = VALUES(contrasena),
            firma_data_url = VALUES(firma_data_url),
            avatar_data_url = VALUES(avatar_data_url),
            activo = VALUES(activo),
            influye_meta_ventas = VALUES(influye_meta_ventas),
            metas_mensuales_json = VALUES(metas_mensuales_json),
            tiers_comision_json = VALUES(tiers_comision_json),
            rol = VALUES(rol)
        `,
        [
          id,
          nombre,
          username,
          fullName,
          email,
          phone,
          password,
          signatureDataUrl,
          avatarDataUrl,
          active,
          salesTargetEnabled,
          JSON.stringify(monthlyGoals),
          JSON.stringify(goalTiers),
          rol,
        ]
      );
    }

    for (const c of companies) {
      const id = str(c?.id).trim();
      if (!id) continue;
      await conn.query(
        `
          INSERT INTO empresas
            (id, nombre, encargado_principal, correo, nit, razon_social, tipo_evento, direccion, telefono, notas)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            nombre = VALUES(nombre),
            encargado_principal = VALUES(encargado_principal),
            correo = VALUES(correo),
            nit = VALUES(nit),
            razon_social = VALUES(razon_social),
            tipo_evento = VALUES(tipo_evento),
            direccion = VALUES(direccion),
            telefono = VALUES(telefono),
            notas = VALUES(notas)
        `,
        [
          id,
          str(c?.name).trim() || "Empresa",
          str(c?.owner).trim() || null,
          str(c?.email).trim() || null,
          str(c?.nit).trim() || null,
          str(c?.businessName).trim() || null,
          str(c?.eventType).trim() || null,
          str(c?.address).trim() || null,
          str(c?.phone).trim() || null,
          str(c?.notes).trim() || null,
        ]
      );

      const managers = Array.isArray(c?.managers) ? c.managers : [];
      for (const m of managers) {
        const managerId = str(m?.id).trim();
        const managerName = str(m?.name).trim();
        if (!managerId || !managerName) continue;
        await conn.query(
          `
            INSERT INTO encargados_empresa
              (id, id_empresa, nombre, telefono, correo, direccion)
            VALUES (?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              nombre = VALUES(nombre),
              telefono = VALUES(telefono),
              correo = VALUES(correo),
              direccion = VALUES(direccion)
          `,
          [
            managerId,
            id,
            managerName,
            str(m?.phone).trim() || null,
            str(m?.email).trim() || null,
            str(m?.address).trim() || null,
          ]
        );
      }
    }

    // Las tablas de servicios y categorias fueron eliminadas y se manejan en el modulo de informes.

    // === UPSERT: eventos (preservar existentes, no borrar) ===
    for (const e of events) {
      const id = str(e?.id).trim();
      if (!id) continue;
      await conn.query(
        `
          INSERT INTO eventos
            (id, id_grupo, nombre, nombre_salon, fecha_evento, fecha_inicio_reserva, fecha_fin_reserva, hora_inicio, hora_fin, estado, id_usuario, pax, notas, cotizacion_json)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            id_grupo = VALUES(id_grupo),
            nombre = VALUES(nombre),
            nombre_salon = VALUES(nombre_salon),
            fecha_evento = VALUES(fecha_evento),
            fecha_inicio_reserva = VALUES(fecha_inicio_reserva),
            fecha_fin_reserva = VALUES(fecha_fin_reserva),
            hora_inicio = VALUES(hora_inicio),
            hora_fin = VALUES(hora_fin),
            estado = VALUES(estado),
            id_usuario = VALUES(id_usuario),
            pax = VALUES(pax),
            notas = VALUES(notas),
            cotizacion_json = VALUES(cotizacion_json)
        `,
        [
          id,
          str(e?.groupId).trim() || null,
          str(e?.name).trim() || "(sin nombre)",
          str(e?.salon).trim() || "(sin salon)",
          asDate(e?.date) || "1970-01-01",
          asDate(e?.eventDateStart || e?.reservationDateStart || e?.seriesDateStart || e?.date) || "1970-01-01",
          asDate(e?.eventDateEnd || e?.reservationDateEnd || e?.seriesDateEnd || e?.endDate || e?.eventDateStart || e?.reservationDateStart || e?.seriesDateStart || e?.date) || "1970-01-01",
          asTime(e?.startTime) || "00:00:00",
          asTime(e?.endTime) || "00:30:00",
          str(e?.status).trim() || "Lista de Espera",
          str(e?.userId).trim() || null,
          e?.pax === null || e?.pax === undefined || e?.pax === "" ? null : Math.max(0, Number(e.pax)),
          str(e?.notes).trim() || null,
          e?.quote && typeof e.quote === "object" ? JSON.stringify(Object.assign({}, e.quote, { advances: undefined })) : e?.quote ? JSON.stringify(e.quote) : null,
        ]
      );

      // === UPSERT: anticipos_evento (normalizar pagos en tabla propia) ===
      const existingAdvancesById = new Map();
      try {
        const dbExisting = await conn.query("SELECT id, creado_en_iso, id_usuario_creador, nombre_usuario_creador FROM anticipos_evento WHERE id_evento = ?", [id]);
        for (const ea of dbExisting) {
          existingAdvancesById.set(str(ea.id), { createdAt: str(ea.creado_en_iso || ""), createdByUserId: str(ea.id_usuario_creador || ""), createdByName: str(ea.nombre_usuario_creador || "") });
        }
      } catch (_) {}

      const advanceLogs = Array.isArray(e?.quote?.advanceLogs) ? e.quote.advanceLogs : [];
      const nowIso = new Date().toISOString();

      if (e?.quote && typeof e.quote === "object") {
        const incomingAdvances = Array.isArray(e.quote.advances) ? e.quote.advances : [];
        const incomingIds = new Set(incomingAdvances.map(a => str(a.id)));

        // Borrar solo los que ya no estan en la lista entrante y registrarlos en historial
        for (const [existingId, _] of existingAdvancesById) {
          if (!incomingIds.has(existingId)) {
            const delLog = advanceLogs.findLast(l => str(l.tone) === "deleted");
            const actorId = str(delLog?.actorId || "").trim() || null;
            const actorName = str(delLog?.actorName || "Sistema").trim();
            const detalle = str(delLog?.change || "Anticipo eliminado").trim();
            const logAt = str(delLog?.at || nowIso).trim();
            await conn.query(
              `INSERT INTO historial_anticipos (id, id_anticipo, id_evento, accion, id_usuario_actor, nombre_usuario_actor, detalle, creado_en_iso) VALUES (?, ?, ?, 'deleted', ?, ?, ?, ?)`,
              [`ha_${Date.now()}_${Math.random().toString(36).slice(2,7)}`, existingId, id, actorId, actorName, detalle, logAt]
            );
          }
        }

        const deleteIds = [...existingAdvancesById.keys()].filter(eid => !incomingIds.has(eid));
        if (deleteIds.length > 0) {
          const placeholders = deleteIds.map(() => "?").join(",");
          await conn.query(`DELETE FROM anticipos_evento WHERE id_evento = ? AND id IN (${placeholders})`, [id, ...deleteIds]);
        }

        // Insertar o actualizar cada advance con ON DUPLICATE KEY UPDATE
        for (const adv of incomingAdvances) {
          const advId = str(adv.id).trim() || `adv_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
          const existingMeta = existingAdvancesById.get(advId);
          let editadoPorId = null;
          let editadoPorNombre = null;
          let editadoEnIso = null;
          if (existingMeta) {
            const editedLog = advanceLogs.findLast(l => str(l.tone) === "edited");
            editadoPorId = str(editedLog?.actorId || "").trim() || null;
            editadoPorNombre = str(editedLog?.actorName || "").trim() || null;
            editadoEnIso = str(editedLog?.at || "").trim() || null;
          }
          await conn.query(
            `INSERT INTO anticipos_evento
               (id, id_evento, fecha_anticipo, monto, tipo_pago, descripcion, numero_boleta, id_usuario_creador, nombre_usuario_creador, nombre_evidencia, tipo_evidencia, datos_evidencia, creado_en_iso, editado_por_id, editado_por_nombre, editado_en_iso)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               fecha_anticipo = VALUES(fecha_anticipo),
               monto = VALUES(monto),
               tipo_pago = VALUES(tipo_pago),
               descripcion = VALUES(descripcion),
               numero_boleta = VALUES(numero_boleta),
               nombre_evidencia = VALUES(nombre_evidencia),
               tipo_evidencia = VALUES(tipo_evidencia),
               datos_evidencia = VALUES(datos_evidencia),
               editado_por_id = VALUES(editado_por_id),
               editado_por_nombre = VALUES(editado_por_nombre),
               editado_en_iso = VALUES(editado_en_iso)`,
            [
              advId,
              id,
              asDate(adv.date || ""),
              Math.max(0, Number(adv.amount || 0)),
              str(adv.paymentType || "Efectivo").trim(),
              str(adv.description || "").trim() || null,
              str(adv.voucherNumber || "").trim() || null,
              existingMeta?.createdByUserId || str(adv.createdByUserId || "").trim() || null,
              existingMeta?.createdByName || str(adv.createdByName || "").trim() || null,
              str(adv.evidenceName || "").trim() || null,
              str(adv.evidenceType || "").trim() || null,
              str(adv.evidenceDataUrl || "").trim() || null,
              existingMeta?.createdAt || str(adv.createdAt || "").trim() || null,
              editadoPorId,
              editadoPorNombre,
              editadoEnIso,
            ]
          );
          const accion = existingMeta ? "edited" : "added";
          const logEntry = advanceLogs.findLast(l => str(l.tone) === accion);
          let haActorId = str(logEntry?.actorId || "").trim() || null;
          let haActorName = str(logEntry?.actorName || "").trim() || "Sistema";
          let haDetalle = str(logEntry?.change || "").trim();
          let haAt = str(logEntry?.at || "").trim() || nowIso;
          if (!logEntry) {
            haActorId = str(adv.createdByUserId || "").trim() || null;
            haActorName = str(adv.createdByName || "").trim() || "Sistema";
            haDetalle = `${accion === "added" ? "Agregado" : "Editado"} anticipo: Q ${Math.max(0, Number(adv.amount || 0)).toFixed(2)}`;
            haAt = str(adv.createdAt || "").trim() || nowIso;
          }
          await conn.query(
            `INSERT INTO historial_anticipos (id, id_anticipo, id_evento, accion, id_usuario_actor, nombre_usuario_actor, detalle, creado_en_iso) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [`ha_${Date.now()}_${Math.random().toString(36).slice(2,7)}`, advId, id, accion, haActorId, haActorName, haDetalle, haAt]
          );
        }
      } else if (existingAdvancesById.size > 0) {
        // Evento sin quote: eliminar todos los advances y registrarlos en historial
        for (const [deletedId, _] of existingAdvancesById) {
          const delLog = advanceLogs.findLast(l => str(l.tone) === "deleted");
          const actorId = str(delLog?.actorId || "").trim() || null;
          const actorName = str(delLog?.actorName || "Sistema").trim();
          const detalle = str(delLog?.change || "Anticipo eliminado").trim();
          const logAt = str(delLog?.at || nowIso).trim();
          await conn.query(
            `INSERT INTO historial_anticipos (id, id_anticipo, id_evento, accion, id_usuario_actor, nombre_usuario_actor, detalle, creado_en_iso) VALUES (?, ?, ?, 'deleted', ?, ?, ?, ?)`,
            [`ha_${Date.now()}_${Math.random().toString(36).slice(2,7)}`, deletedId, id, actorId, actorName, detalle, logAt]
          );
        }
        await conn.query("DELETE FROM anticipos_evento WHERE id_evento = ?", [id]);
      }

      // === UPSERT: cotizaciones (borrar y re-insertar items de la cotizacion) ===
      if (e?.quote && typeof e.quote === "object") {
        const q = e.quote;
        const desiredCodeNum = parseQuoteCodeNumber(q.code);
        const desiredCode = desiredCodeNum > 0 ? formatQuoteCode(desiredCodeNum) : "";
        if (desiredCode && !usedQuoteCodes.has(desiredCode)) {
          q.code = desiredCode;
          usedQuoteCodes.add(desiredCode);
        } else {
          let nextCode = "";
          for (let guard = 0; guard < 5000; guard++) {
            const candidate = await reserveNextDocCodeInConn(conn, "COT");
            if (!usedQuoteCodes.has(candidate)) {
              nextCode = candidate;
              break;
            }
          }
          if (!nextCode) {
            throw new Error("No se pudo reservar un codigo de cotizacion unico.");
          }
          q.code = nextCode;
          usedQuoteCodes.add(nextCode);
        }
        const quoteTotals = calculateQuoteTotals(q);
        const currentVersion = Math.max(1, Number(q.version || 1));
        await conn.query(
          `
            INSERT INTO cotizaciones_evento
              (id_evento, id_empresa, id_encargado, nombre_empresa, nombre_encargado, contacto, correo, facturar_a, direccion, tipo_evento, lugar, horario_texto, codigo, fecha_documento, telefono, nit, personas, fecha_evento, folio, fecha_fin, fecha_max_pago, tipo_pago, notas_internas, notas, version_actual, subtotal, descuento_tipo, descuento_valor, descuento_monto, total_neto, cotizado_en_iso, json_crudo)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              id_empresa = VALUES(id_empresa),
              id_encargado = VALUES(id_encargado),
              nombre_empresa = VALUES(nombre_empresa),
              nombre_encargado = VALUES(nombre_encargado),
              contacto = VALUES(contacto),
              correo = VALUES(correo),
              facturar_a = VALUES(facturar_a),
              direccion = VALUES(direccion),
              tipo_evento = VALUES(tipo_evento),
              lugar = VALUES(lugar),
              horario_texto = VALUES(horario_texto),
              codigo = VALUES(codigo),
              fecha_documento = VALUES(fecha_documento),
              telefono = VALUES(telefono),
              nit = VALUES(nit),
              personas = VALUES(personas),
              fecha_evento = VALUES(fecha_evento),
              folio = VALUES(folio),
              fecha_fin = VALUES(fecha_fin),
              fecha_max_pago = VALUES(fecha_max_pago),
              tipo_pago = VALUES(tipo_pago),
              notas_internas = VALUES(notas_internas),
              notas = VALUES(notas),
              version_actual = VALUES(version_actual),
              subtotal = VALUES(subtotal),
              descuento_tipo = VALUES(descuento_tipo),
              descuento_valor = VALUES(descuento_valor),
              descuento_monto = VALUES(descuento_monto),
              total_neto = VALUES(total_neto),
              cotizado_en_iso = VALUES(cotizado_en_iso),
              json_crudo = VALUES(json_crudo)
          `,
          [
            id,
            str(q.companyId).trim() || null,
            str(q.managerId).trim() || null,
            str(q.companyName).trim() || null,
            str(q.managerName).trim() || null,
            str(q.contact).trim() || null,
            str(q.email).trim() || null,
            str(q.billTo).trim() || null,
            str(q.address).trim() || null,
            str(q.eventType).trim() || null,
            str(q.venue).trim() || null,
            str(q.schedule).trim() || null,
            str(q.code).trim() || null,
            asDate(q.docDate),
            str(q.phone).trim() || null,
            str(q.nit).trim() || null,
            q.people === null || q.people === undefined || q.people === "" ? null : Math.max(0, Number(q.people)),
            asDate(q.eventDate),
            str(q.folio).trim() || null,
            asDate(q.endDate),
            asDate(q.dueDate),
            str(q.paymentType).trim() || null,
            str(q.internalNotes).trim() || null,
            str(q.notes).trim() || null,
            currentVersion,
            Number(quoteTotals.subtotal || 0),
            normalizeDiscountType(q.discountType),
            Number(quoteTotals.discountValue || 0),
            Number(quoteTotals.discountAmount || 0),
            Number(quoteTotals.total || 0),
            str(q.quotedAt).trim() || null,
            safeJsonStringify(q),
          ]
        );

        // Borrar items viejos y re-insertar los nuevos
        await conn.query("DELETE FROM items_cotizacion_evento WHERE id_evento = ?", [id]);
        const items = Array.isArray(q.items) ? q.items : [];
        for (let itemIdx = 0; itemIdx < items.length; itemIdx++) {
          const item = items[itemIdx];
          const itemId = buildQuoteItemPrimaryKey(id, item, itemIdx);
          await conn.query(
            `
              INSERT INTO items_cotizacion_evento
                (id, id_evento, id_servicio, fecha_servicio, cantidad, precio, precio_unitario, modo_cantidad, total_linea, nombre, descripcion)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON DUPLICATE KEY UPDATE
                id_evento = VALUES(id_evento),
                id_servicio = VALUES(id_servicio),
                fecha_servicio = VALUES(fecha_servicio),
                cantidad = VALUES(cantidad),
                precio = VALUES(precio),
                precio_unitario = VALUES(precio_unitario),
                modo_cantidad = VALUES(modo_cantidad),
                total_linea = VALUES(total_linea),
                nombre = VALUES(nombre),
                descripcion = VALUES(descripcion)
            `,
            [
              itemId,
              id,
              str(item?.serviceId).trim() || null,
              asDate(item?.serviceDate),
              Number(item?.qty || 0),
              Number(item?.price || 0),
              Number(item?.unitPrice || item?.price || 0),
              normalizeQuantityMode(item?.quantityMode),
              Number(item?.qty || 0) * Number(item?.price || 0),
              str(item?.name || item?.description).trim() || "(sin descripcion)",
              str(item?.description).trim() || null,
            ]
          );
        }

        // Versiones: borrar viejas y re-insertar nuevas
        await conn.query("DELETE FROM cotizacion_versiones_evento WHERE id_evento = ?", [id]);
        await conn.query("DELETE FROM items_cotizacion_version_evento WHERE id_evento = ?", [id]);
        const versionRows = [];
        const rawVersions = Array.isArray(q.versions) ? q.versions : [];
        for (const v of rawVersions) {
          if (!v || typeof v !== "object") continue;
          const versionNum = Math.max(1, Number(v.version || 0));
          versionRows.push({
            version: versionNum,
            snapshot: { ...v, version: versionNum, versions: [] },
          });
        }
        const currentVersionForRows = Math.max(1, Number(q.version || (versionRows.length + 1)));
        if (!versionRows.some((x) => Number(x.version) === currentVersionForRows)) {
          versionRows.push({
            version: currentVersionForRows,
            snapshot: { ...q, version: currentVersionForRows, versions: [] },
          });
        }
        versionRows.sort((a, b) => Number(a.version) - Number(b.version));

        for (const v of versionRows) {
          const vTotals = calculateQuoteTotals(v.snapshot);
          await conn.query(
            `
              INSERT INTO cotizacion_versiones_evento
                (id_evento, version_num, subtotal, descuento_tipo, descuento_valor, descuento_monto, total_neto, cotizado_en_iso, json_crudo)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
              id,
              Number(v.version),
              Number(vTotals.subtotal || 0),
              normalizeDiscountType(v.snapshot?.discountType),
              Number(vTotals.discountValue || 0),
              Number(vTotals.discountAmount || 0),
              Number(vTotals.total || 0),
              str(v.snapshot?.quotedAt).trim() || null,
              safeJsonStringify(v.snapshot),
            ]
          );

          const itemsVersion = Array.isArray(v.snapshot?.items) ? v.snapshot.items : [];
          for (let idx = 0; idx < itemsVersion.length; idx++) {
            const item = itemsVersion[idx];
            await conn.query(
              `
                INSERT INTO items_cotizacion_version_evento
                  (id_evento, version_num, fila_num, id_servicio, fecha_servicio, cantidad, precio, precio_unitario, modo_cantidad, total_linea, nombre, descripcion)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `,
              [
                id,
                Number(v.version),
                idx + 1,
                str(item?.serviceId).trim() || null,
                asDate(item?.serviceDate),
                Number(item?.qty || 0),
                Number(item?.price || 0),
                Number(item?.unitPrice || item?.price || 0),
                normalizeQuantityMode(item?.quantityMode),
                Number(item?.qty || 0) * Number(item?.price || 0),
                str(item?.name || item?.description).trim() || "(sin descripcion)",
                str(item?.description).trim() || null,
              ]
            );
          }
        }
      }
    }

    // === UPSERT: historial_evento (limpiar y re-insertar para evitar duplicación) ===
    await conn.query("DELETE FROM historial_evento");
    for (const [eventKey, rows] of Object.entries(changeHistory)) {
      if (!Array.isArray(rows)) continue;
      for (const row of rows) {
        await conn.query(
          `
            INSERT INTO historial_evento
              (clave_evento, cambiado_en_iso, cambiado_en, id_usuario_actor, nombre_actor, cambio_texto)
            VALUES (?, ?, ?, ?, ?, ?)
          `,
          [
            str(eventKey).trim(),
            str(row?.at).trim() || null,
            asDateTime(row?.at),
            str(row?.actorUserId).trim() || null,
            str(row?.actorName).trim() || null,
            str(row?.change).trim() || "",
          ]
        );
      }
    }

    // === UPSERT: recordatorios (preservar y agregar nuevos) ===
    for (const [eventKey, rows] of Object.entries(reminders)) {
      if (!Array.isArray(rows)) continue;
      for (const row of rows) {
        const reminderId = str(row?.id).trim() || `rem_${Math.random().toString(16).slice(2)}`;
        await conn.query(
          `
            INSERT INTO recordatorios_evento
              (id, clave_evento, fecha_recordatorio, hora_recordatorio, medio, notas, creado_en_iso, creado_en, id_usuario_creador)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              clave_evento = VALUES(clave_evento),
              fecha_recordatorio = VALUES(fecha_recordatorio),
              hora_recordatorio = VALUES(hora_recordatorio),
              medio = VALUES(medio),
              notas = VALUES(notas),
              creado_en_iso = VALUES(creado_en_iso),
              creado_en = VALUES(creado_en),
              id_usuario_creador = VALUES(id_usuario_creador)
          `,
          [
            reminderId,
            str(eventKey).trim(),
            asDate(row?.date),
            asTime(row?.time),
            str(row?.channel).trim() || "(sin canal)",
            str(row?.notes).trim() || null,
            str(row?.createdAt).trim() || null,
            asDateTime(row?.createdAt),
            str(row?.createdByUserId).trim() || null,
          ]
        );
      }
    }

    await conn.query(
      `
        INSERT INTO app_state_kv (clave, valor_json)
        VALUES ('quickTemplates', ?)
        ON DUPLICATE KEY UPDATE valor_json = VALUES(valor_json)
      `,
      [JSON.stringify(quickTemplates)]
    );
    await conn.query(
      `
        INSERT INTO app_state_kv (clave, valor_json)
        VALUES ('quoteServiceTemplates', ?)
        ON DUPLICATE KEY UPDATE valor_json = VALUES(valor_json)
      `,
      [JSON.stringify(quoteServiceTemplates)]
    );
    await conn.query(
      `
        INSERT INTO app_state_kv (clave, valor_json)
        VALUES ('disabledCompanies', ?)
        ON DUPLICATE KEY UPDATE valor_json = VALUES(valor_json)
      `,
      [JSON.stringify(disabledCompanies)]
    );
    await conn.query(
      `
        INSERT INTO app_state_kv (clave, valor_json)
        VALUES ('disabledServices', ?)
        ON DUPLICATE KEY UPDATE valor_json = VALUES(valor_json)
      `,
      [JSON.stringify(disabledServices)]
    );
    await conn.query(
      `
        INSERT INTO app_state_kv (clave, valor_json)
        VALUES ('disabledManagers', ?)
        ON DUPLICATE KEY UPDATE valor_json = VALUES(valor_json)
      `,
      [JSON.stringify(disabledManagers)]
    );
    await conn.query(
      `
        INSERT INTO app_state_kv (clave, valor_json)
        VALUES ('disabledSalones', ?)
        ON DUPLICATE KEY UPDATE valor_json = VALUES(valor_json)
      `,
      [JSON.stringify(disabledSalones)]
    );
    await conn.query(
      `
        INSERT INTO app_state_kv (clave, valor_json)
        VALUES ('globalMonthlyGoals', ?)
        ON DUPLICATE KEY UPDATE valor_json = VALUES(valor_json)
      `,
      [
        JSON.stringify(
          globalMonthlyGoals
            .map((g) => ({
              month: str(g?.month),
              amount: Math.max(0, Number(g?.amount || 0)),
              active: g?.active === false ? false : true,
            }))
            .filter((g) => /^\d{4}-\d{2}$/.test(g.month))
        ),
      ]
    );
    await conn.query(
      `
        INSERT INTO app_state_kv (clave, valor_json)
        VALUES ('checklistTemplates', ?)
        ON DUPLICATE KEY UPDATE valor_json = VALUES(valor_json)
      `,
      [JSON.stringify(checklistTemplates)]
    );
    await conn.query(
      `
        INSERT INTO app_state_kv (clave, valor_json)
        VALUES ('checklistTemplateItems', ?)
        ON DUPLICATE KEY UPDATE valor_json = VALUES(valor_json)
      `,
      [JSON.stringify(checklistTemplateItems)]
    );
    await conn.query(
      `
        INSERT INTO app_state_kv (clave, valor_json)
        VALUES ('checklistTemplateSections', ?)
        ON DUPLICATE KEY UPDATE valor_json = VALUES(valor_json)
      `,
      [JSON.stringify(checklistTemplateSections.map((s) => str(s)).filter(Boolean))]
    );
    await conn.query(
      `
        INSERT INTO app_state_kv (clave, valor_json)
        VALUES ('menuMontajeSections', ?)
        ON DUPLICATE KEY UPDATE valor_json = VALUES(valor_json)
      `,
      [JSON.stringify(menuMontajeSections.map((s) => str(s)).filter(Boolean))]
    );
    await conn.query(
      `
        INSERT INTO app_state_kv (clave, valor_json)
        VALUES ('menuMontajeBebidas', ?)
        ON DUPLICATE KEY UPDATE valor_json = VALUES(valor_json)
      `,
      [
        JSON.stringify(
          menuMontajeBebidas
            .map((b) => ({ id: str(b?.id), nombre: str(b?.nombre || b?.name), activo: b?.activo === false ? false : true }))
            .filter((b) => b.id && b.nombre)
        ),
      ]
    );
    await conn.query(
      `
        INSERT INTO app_state_kv (clave, valor_json)
        VALUES ('eventChecklists', ?)
        ON DUPLICATE KEY UPDATE valor_json = VALUES(valor_json)
      `,
      [JSON.stringify(eventChecklists)]
    );
    await conn.query(
      `
        INSERT INTO app_state_kv (clave, valor_json)
        VALUES ('occupancyWeeklyOps', ?)
        ON DUPLICATE KEY UPDATE valor_json = VALUES(valor_json)
      `,
      [JSON.stringify(occupancyWeeklyOps)]
    );
    await conn.query(
      `
        INSERT INTO app_state_kv (clave, valor_json)
        VALUES ('salonCapacities', ?)
        ON DUPLICATE KEY UPDATE valor_json = VALUES(valor_json)
      `,
      [JSON.stringify(salonCapacities)]
    );
    await conn.query(
      `
        INSERT INTO app_state_kv (clave, valor_json)
        VALUES ('salonOccupancyEnabled', ?)
        ON DUPLICATE KEY UPDATE valor_json = VALUES(valor_json)
      `,
      [JSON.stringify(salonOccupancyEnabled)]
    );
    // Write to app_state_kv (backward compat)
    // Write to app_state_kv (backward compat)
    await conn.query(
      `
        INSERT INTO app_state_kv (clave, valor_json)
        VALUES ('services', ?)
        ON DUPLICATE KEY UPDATE valor_json = VALUES(valor_json)
      `,
      [JSON.stringify(services)]
    );
    await conn.query(
      `
        INSERT INTO app_state_kv (clave, valor_json)
        VALUES ('serviceCategories', ?)
        ON DUPLICATE KEY UPDATE valor_json = VALUES(valor_json)
      `,
      [JSON.stringify(serviceCategories)]
    );
    // Write services to dedicated tables
    await conn.query("DELETE FROM servicios");
    await conn.query("DELETE FROM subcategorias_servicio");
    await conn.query("DELETE FROM categorias_servicio");
    for (const cat of serviceCategories) {
      const catResult = await conn.query("INSERT INTO categorias_servicio (nombre) VALUES (?)", [str(cat.name || "").trim() || "Sin nombre"]);
      const catId = Number(catResult.insertId);
      const subs = Array.isArray(cat.subcategories) ? cat.subcategories : [];
      for (const sub of subs) {
        const subResult = await conn.query("INSERT INTO subcategorias_servicio (id_categoria, nombre) VALUES (?, ?)", [catId, str(sub.name || "").trim() || "Sin nombre"]);
        sub._dbId = Number(subResult.insertId);
      }
    }
    // Build a map of subcategory names to IDs for service linking
    const allSubs = await conn.query("SELECT id, nombre, id_categoria FROM subcategorias_servicio");
    const subByName = {};
    for (const srow of allSubs) {
      const key = String(srow.id_categoria) + "::" + str(srow.nombre).trim().toLowerCase();
      subByName[key] = Number(srow.id);
    }
    const allCats = await conn.query("SELECT id, nombre FROM categorias_servicio");
    const catByName = {};
    for (const crow of allCats) {
      catByName[str(crow.nombre).trim().toLowerCase()] = Number(crow.id);
    }
    for (const svc of services) {
      const catName = str(svc.category || "General").trim();
      const catId = catByName[catName.toLowerCase()] || null;
      let subId = null;
      const subName = str(svc.subcategory || "").trim();
      if (subName && catId) {
        subId = subByName[String(catId) + "::" + subName.toLowerCase()] || null;
      }
      const svcId = str(svc.id).trim();
      if (!svcId) continue;
      await conn.query(
        "INSERT INTO servicios (id, nombre, precio, descripcion, id_categoria, id_subcategoria, modo_cantidad, activo) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE nombre = VALUES(nombre), precio = VALUES(precio), descripcion = VALUES(descripcion), id_categoria = VALUES(id_categoria), id_subcategoria = VALUES(id_subcategoria), modo_cantidad = VALUES(modo_cantidad), activo = VALUES(activo)",
        [svcId, str(svc.name || "Sin nombre").trim(), Number(svc.price || 0), str(svc.description || "").trim() || null, catId, subId, String(svc.quantityMode || "MANUAL").trim(), svc.active !== false ? 1 : 0]
      );
    }
    // Las tablas de menu y sugerencias de montaje fueron eliminadas y se manejan en el modulo de informes.

    await conn.query("SET FOREIGN_KEY_CHECKS = 1");
    await conn.commit();
  } catch (error) {
    if (conn) {
      try {
        await conn.query("SET FOREIGN_KEY_CHECKS = 1");
      } catch (err) {}
      await conn.rollback();
    }
    throw error;
  } finally {
    if (conn) conn.release();
  }
}

app.get("/api/health", async (_req, res) => {
  try {
    let conn;
    try {
      conn = await pool.getConnection();
      await conn.query("SELECT 1");
    } finally {
      if (conn) conn.release();
    }
    return res.json({ ok: true, db: "connected" });
  } catch (error) {
    return res.status(500).json({ ok: false, db: "error", message: error.message });
  }
});

// ==================== IMPORTACIÓN MASIVA DIRECTA A TABLAS ====================

app.post("/api/import/companies", async (req, res) => {
  const companies = req.body && req.body.companies;
  if (!Array.isArray(companies) || !companies.length) {
    return res.status(400).json({ message: "Se requiere un array de empresas." });
  }
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const BATCH = 1000;
    for (let i = 0; i < companies.length; i += BATCH) {
      const batch = companies.slice(i, i + BATCH);
      const placeholders = batch.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ");
      const values = [];
      for (const c of batch) {
        values.push(
          str(c?.id),
          str(c?.name).trim() || "Empresa",
          str(c?.owner).trim() || null,
          str(c?.email).trim() || null,
          str(c?.nit).trim() || null,
          str(c?.businessName).trim() || null,
          str(c?.eventType).trim() || null,
          str(c?.address).trim() || null,
          str(c?.phone).trim() || null,
          str(c?.notes).trim() || null
        );
      }
      await conn.query(
        `
          INSERT INTO empresas (id, nombre, encargado_principal, correo, nit, razon_social, tipo_evento, direccion, telefono, notas)
          VALUES ${placeholders}
          ON DUPLICATE KEY UPDATE
            nombre = VALUES(nombre),
            encargado_principal = VALUES(encargado_principal),
            correo = VALUES(correo),
            nit = VALUES(nit),
            razon_social = VALUES(razon_social),
            tipo_evento = VALUES(tipo_evento),
            direccion = VALUES(direccion),
            telefono = VALUES(telefono),
            notas = VALUES(notas)
        `,
        values
      );
    }
    await conn.commit();
    console.log(`[${new Date().toLocaleTimeString()}] ✅ Importadas ${companies.length} empresas vía /api/import/companies`);
    return res.json({ ok: true, count: companies.length });
  } catch (error) {
    if (conn) await conn.rollback();
    console.error(`[${new Date().toLocaleTimeString()}] ❌ Error en /api/import/companies:`, error);
    return res.status(500).json({ message: "Error al importar empresas.", detail: error.message });
  } finally {
    if (conn) conn.release();
  }
});

app.post("/api/import/managers", async (req, res) => {
  const managers = req.body && req.body.managers;
  if (!Array.isArray(managers) || !managers.length) {
    return res.status(400).json({ message: "Se requiere un array de encargados." });
  }
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const BATCH = 1000;
    for (let i = 0; i < managers.length; i += BATCH) {
      const batch = managers.slice(i, i + BATCH);
      const placeholders = batch.map(() => "(?, ?, ?, ?, ?, ?)").join(", ");
      const values = [];
      for (const m of batch) {
        values.push(
          str(m?.id),
          str(m?.companyId),
          str(m?.name).trim() || "Encargado",
          str(m?.phone).trim() || null,
          str(m?.email).trim() || null,
          str(m?.address).trim() || null
        );
      }
      await conn.query(
        `
          INSERT INTO encargados_empresa (id, id_empresa, nombre, telefono, correo, direccion)
          VALUES ${placeholders}
          ON DUPLICATE KEY UPDATE
            nombre = VALUES(nombre),
            telefono = VALUES(telefono),
            correo = VALUES(correo),
            direccion = VALUES(direccion)
        `,
        values
      );
    }
    await conn.commit();
    console.log(`[${new Date().toLocaleTimeString()}] ✅ Importados ${managers.length} encargados vía /api/import/managers`);
    return res.json({ ok: true, count: managers.length });
  } catch (error) {
    if (conn) await conn.rollback();
    console.error(`[${new Date().toLocaleTimeString()}] ❌ Error en /api/import/managers:`, error);
    return res.status(500).json({ message: "Error al importar encargados.", detail: error.message });
  } finally {
    if (conn) conn.release();
  }
});

app.get("/api/state", async (_req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  console.log(`[${new Date().toLocaleTimeString()}] 🔍 GET /api/state - Consultando base de datos MariaDB...`);
  try {
    const result = await readStateFromTables();
    if (!result) {
      console.log(`[${new Date().toLocaleTimeString()}] ℹ️ Base de datos vacía, sirviendo estado predeterminado para sincronización.`);
      // Si la base de datos relacional está vacía, devolvemos un estado base inicial
      // para evitar errores 404 y permitir la inicialización/sincronización fluida desde el cliente.
      const defaultState = {
        salones: ["Arenal", "Santa Isabel", "Rancho Grande", "Jardincito", "Casa Flores", "Hotel Principal"],
        users: [
          { id: "usr_carlos", name: "Carlos" },
          { id: "usr_ana", name: "Ana" },
          { id: "usr_recepcion", name: "Recepcion" },
          { id: "usr_ventas", name: "Ventas" }
        ],
        companies: [],
        services: [],
        events: [],
        changeHistory: {},
        reminders: {}
      };
      return res.json(defaultState);
    }
    console.log(`[${new Date().toLocaleTimeString()}] ✅ Consulta exitosa. Retornando ${result?.state?.events?.length || 0} eventos desde MariaDB.`);
    return res.json(result);
  } catch (error) {
    console.error(`[${new Date().toLocaleTimeString()}] ❌ Error en GET /api/state:`, error);
    return res.status(500).json({ message: "No se pudo leer el estado desde tablas.", detail: error.message });
  }
});

app.get("/api/salones", async (_req, res) => {
  try {
    const salones = await readSalonesFromTables();
    return res.json({ salones });
  } catch (error) {
    return res.status(500).json({ message: "No se pudieron leer los salones.", detail: error.message });
  }
});

app.get("/api/login-users", async (_req, res) => {
  try {
    const users = await readLoginUsers();
    return res.json({ users });
  } catch (error) {
    return res.status(500).json({ message: "No se pudo cargar usuarios para login.", detail: error.message });
  }
});

app.post("/api/login", async (req, res) => {
  const userId = str(req.body?.userId).trim();
  const password = str(req.body?.password);
  if (!userId || !password) {
    return res.status(400).json({ ok: false, message: "Credenciales incompletas." });
  }
  try {
    const user = await authenticateUser(userId, password);
    if (!user) {
      return res.status(401).json({ ok: false, message: "Usuario o contrasena incorrecta." });
    }
    const token = jwt.sign(
      {
        id: user.id,
        nombre: user.name,
        email: user.email || `${user.id}@dominio.com`,
        rol: normalizeRoleForJWT(user.role)
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    return res.json({ ok: true, user, token });
  } catch (error) {
    return res.status(500).json({ ok: false, message: "Error validando credenciales.", detail: error.message });
  }
});

app.post("/api/auth/firebase", async (req, res) => {
  const uid = str(req.body?.uid).trim();
  const email = str(req.body?.email).trim();
  const displayName = str(req.body?.displayName || email.split("@")[0]).trim();
  const photoURL = str(req.body?.photoURL).trim() || null;

  if (!uid || !email) {
    return res.status(400).json({ ok: false, message: "Datos de autenticación Firebase incompletos." });
  }

  const lowerEmail = email.toLowerCase();
  const isAdminEmail = lowerEmail === "sistemashotel@jardinesdellago.com";

  let conn;
  try {
    conn = await pool.getConnection();
    
    // 1. Buscar si el ID de Firebase ya existe
    const existingById = await conn.query(
      "SELECT id, nombre, nombre_usuario, nombre_completo, correo, telefono, avatar_data_url, firma_data_url, activo, rol FROM usuarios WHERE id = ? LIMIT 1",
      [uid]
    );

    if (existingById.length > 0) {
      const u = existingById[0];
      if (Number(u.activo) === 0) {
        return res.status(403).json({ ok: false, message: "El usuario está inactivo. Contacta al administrador." });
      }

      // Si es el correo del admin, asegurar de que siempre tenga el rol 'admin'
      if (isAdminEmail && u.rol !== "admin") {
        await conn.query("UPDATE usuarios SET rol = 'admin' WHERE id = ?", [uid]);
        u.rol = "admin";
      }

      const token = jwt.sign(
        {
          id: str(u.id),
          nombre: str(u.nombre),
          email: str(u.correo || email),
          rol: normalizeRoleForJWT(u.rol)
        },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      return res.json({
        ok: true,
        user: {
          id: str(u.id),
          name: str(u.nombre),
          fullName: str(u.nombre_completo) || str(u.nombre),
          username: str(u.nombre_usuario),
          avatarDataUrl: str(u.avatar_data_url),
          signatureDataUrl: str(u.firma_data_url),
          role: str(u.rol || 'vendedor'),
        },
        token
      });
    }

    // 2. Buscar si ya existe un usuario local con el mismo correo para vincularlo
    const existingByEmail = await conn.query(
      "SELECT id, nombre, nombre_usuario, nombre_completo, avatar_data_url, firma_data_url, activo, rol FROM usuarios WHERE correo = ? LIMIT 1",
      [email]
    );

    if (existingByEmail.length > 0) {
      const u = existingByEmail[0];
      if (Number(u.activo) === 0) {
        return res.status(403).json({ ok: false, message: "El usuario está inactivo. Contacta al administrador." });
      }
      
      const oldId = u.id;
      let targetRole = u.rol || 'vendedor';
      if (isAdminEmail) {
        targetRole = 'admin';
      }

      await conn.beginTransaction();
      await conn.query("SET FOREIGN_KEY_CHECKS = 0");
      
      // Actualizar la tabla usuarios
      await conn.query(
        "UPDATE usuarios SET id = ?, avatar_data_url = COALESCE(avatar_data_url, ?), rol = ? WHERE id = ?",
        [uid, photoURL, targetRole, oldId]
      );
      
      // Actualizar referencias en eventos
      await conn.query(
        "UPDATE eventos SET id_usuario = ? WHERE id_usuario = ?",
        [uid, oldId]
      );

      // Actualizar referencias en historial
      await conn.query(
        "UPDATE historial_evento SET id_usuario_actor = ? WHERE id_usuario_actor = ?",
        [uid, oldId]
      );

      // Actualizar referencias en recordatorios
      await conn.query(
        "UPDATE recordatorios_evento SET id_usuario_creador = ? WHERE id_usuario_creador = ?",
        [uid, oldId]
      );

      await conn.query("SET FOREIGN_KEY_CHECKS = 1");
      await conn.commit();

      const token = jwt.sign(
        {
          id: uid,
          nombre: str(u.nombre),
          email: email,
          rol: normalizeRoleForJWT(targetRole)
        },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      return res.json({
        ok: true,
        user: {
          id: uid,
          name: str(u.nombre),
          fullName: str(u.nombre_completo) || str(u.nombre),
          username: str(u.nombre_usuario),
          avatarDataUrl: str(u.avatar_data_url) || photoURL,
          signatureDataUrl: str(u.firma_data_url),
          role: targetRole,
        },
        token
      });
    }

    // 3. Si no existe en la BD:
    // Si es el Admin principal (sistemashotel@jardinesdellago.com), lo creamos AUTOMÁTICAMENTE como admin.
    if (isAdminEmail) {
      const username = "admin_jdl";
      await conn.query(
        `
          INSERT INTO usuarios
            (id, nombre, nombre_usuario, nombre_completo, correo, contrasena, avatar_data_url, activo, rol)
          VALUES (?, ?, ?, ?, ?, NULL, ?, 1, 'admin')
        `,
        [uid, displayName, username, displayName, email, photoURL]
      );

      const token = jwt.sign(
        {
          id: uid,
          nombre: displayName,
          email: email,
          rol: 'Admin'
        },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      return res.json({
        ok: true,
        user: {
          id: uid,
          name: displayName,
          fullName: displayName,
          username: username,
          avatarDataUrl: photoURL,
          signatureDataUrl: null,
          role: 'admin',
        },
        token
      });
    }

    // Para cualquier otro correo que NO existe pre-registrado, BLOQUEAMOS el acceso
    return res.status(403).json({
      ok: false,
      message: "Acceso no autorizado. Tu correo no está pre-registrado en el sistema. Solicita acceso al administrador."
    });

  } catch (error) {
    if (conn) {
      try {
        await conn.query("SET FOREIGN_KEY_CHECKS = 1");
        await conn.rollback();
      } catch (_) {}
    }
    console.error("Error syncing Firebase user with MariaDB:", error);
    return res.status(500).json({ ok: false, message: "Error al sincronizar autenticación con base de datos.", detail: error.message });
  } finally {
    if (conn) conn.release();
  }
});


app.post("/api/doc-code-next", async (_req, res) => {
  try {
    const code = await reserveNextDocCode("COT");
    return res.json({ ok: true, code });
  } catch (error) {
    return res.status(500).json({ ok: false, message: "No se pudo generar codigo de documento.", detail: error.message });
  }
});

app.get("/api/categorias-servicio", async (_req, res) => {
  try {
    const categorias = await readCategoriasServicioFromTables();
    return res.json({ categorias });
  } catch (error) {
    return res.status(500).json({ message: "No se pudieron leer las categorias.", detail: error.message });
  }
});

app.post("/api/categorias-servicio", async (req, res) => {
  try {
    const categoria = await createCategoriaServicioInTable(req.body?.nombre);
    return res.json({ ok: true, categoria });
  } catch (error) {
    return res.status(400).json({ message: "No se pudo crear la categoria.", detail: error.message });
  }
});

app.put("/api/categorias-servicio/:id", async (req, res) => {
  try {
    const categoria = await updateCategoriaServicioInTable(req.params?.id, req.body?.nombre);
    return res.json({ ok: true, categoria });
  } catch (error) {
    return res.status(400).json({ message: "No se pudo actualizar la categoria.", detail: error.message });
  }
});

app.patch("/api/categorias-servicio/:id/activo", async (req, res) => {
  try {
    const categoria = await setCategoriaServicioActivoInTable(req.params?.id, req.body?.activo);
    return res.json({ ok: true, categoria });
  } catch (error) {
    return res.status(400).json({ message: "No se pudo actualizar el estado de la categoria.", detail: error.message });
  }
});

app.get("/api/subcategorias-servicio", async (req, res) => {
  try {
    const categoriaIdRaw = req.query?.categoria_id;
    const categoriaId = categoriaIdRaw === undefined ? null : Number(categoriaIdRaw);
    const subcategorias = await readSubcategoriasServicioFromTables(
      Number.isFinite(categoriaId) ? categoriaId : null
    );
    return res.json({ subcategorias });
  } catch (error) {
    return res.status(500).json({ message: "No se pudieron leer las subcategorias.", detail: error.message });
  }
});

app.post("/api/subcategorias-servicio", async (req, res) => {
  try {
    const subcategoria = await createSubcategoriaServicioInTable(req.body?.id_categoria, req.body?.nombre);
    return res.json({ ok: true, subcategoria });
  } catch (error) {
    return res.status(400).json({ message: "No se pudo crear la subcategoria.", detail: error.message });
  }
});

app.put("/api/subcategorias-servicio/:id", async (req, res) => {
  try {
    const subcategoria = await updateSubcategoriaServicioInTable(
      req.params?.id,
      req.body?.id_categoria,
      req.body?.nombre
    );
    return res.json({ ok: true, subcategoria });
  } catch (error) {
    return res.status(400).json({ message: "No se pudo actualizar la subcategoria.", detail: error.message });
  }
});

app.patch("/api/subcategorias-servicio/:id/activo", async (req, res) => {
  try {
    const subcategoria = await setSubcategoriaServicioActivoInTable(req.params?.id, req.body?.activo);
    return res.json({ ok: true, subcategoria });
  } catch (error) {
    return res.status(400).json({ message: "No se pudo actualizar el estado de la subcategoria.", detail: error.message });
  }
});

// ==================== ELIMINAR SUBCATEGORIA DIRECTAMENTE EN app_state_kv ====================

app.delete("/api/categorias-servicio/:catId/subcategorias/:subId", async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const rows = await conn.query(
      "SELECT valor_json FROM app_state_kv WHERE clave = 'serviceCategories' LIMIT 1"
    );
    let categories = [];
    if (rows.length > 0 && rows[0].valor_json) {
      try {
        categories = JSON.parse(rows[0].valor_json);
        if (!Array.isArray(categories)) categories = [];
      } catch (_) {
        categories = [];
      }
    }
    const catId = String(req.params.catId || '');
    const subId = String(req.params.subId || '');
    let found = false;
    const updated = categories.map(c => {
      if (String(c.id) !== catId) return c;
      const subs = Array.isArray(c.subcategories) ? c.subcategories : [];
      const filtered = subs.filter(s => String(s.id) !== subId);
      if (filtered.length !== subs.length) found = true;
      return { ...c, subcategories: filtered };
    });
    if (!found) {
      return res.status(404).json({ message: "Subcategoria no encontrada." });
    }
    await conn.query(
      `INSERT INTO app_state_kv (clave, valor_json) VALUES ('serviceCategories', ?)
       ON DUPLICATE KEY UPDATE valor_json = VALUES(valor_json)`,
      [JSON.stringify(updated)]
    );
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ message: "Error al eliminar subcategoria.", detail: error.message });
  } finally {
    if (conn) conn.release();
  }
});

// ==================== SERVICE CRUD ENDPOINTS ====================

app.get("/api/servicios", async (_req, res) => {
  try {
    const servicios = await readServiciosFromTables();
    return res.json({ servicios });
  } catch (error) {
    return res.status(500).json({ message: "No se pudieron leer los servicios.", detail: error.message });
  }
});

app.post("/api/servicios", async (req, res) => {
  try {
    const svc = await createServicioInTable(req.body);
    return res.json({ ok: true, servicio: svc });
  } catch (error) {
    return res.status(400).json({ message: "No se pudo crear el servicio.", detail: error.message });
  }
});

app.put("/api/servicios/:id", async (req, res) => {
  try {
    const svc = await updateServicioInTable({ ...req.body, id: req.params.id });
    return res.json({ ok: true, servicio: svc });
  } catch (error) {
    return res.status(400).json({ message: "No se pudo actualizar el servicio.", detail: error.message });
  }
});

app.delete("/api/servicios/:id", async (req, res) => {
  try {
    await deleteServicioFromTable(req.params.id);
    return res.json({ ok: true, message: "Servicio eliminado correctamente." });
  } catch (error) {
    return res.status(500).json({ message: "Error al eliminar servicio.", detail: error.message });
  }
});

// ==================== CATEGORY DELETE ENDPOINT ====================

app.delete("/api/categorias-servicio/:id", async (req, res) => {
  try {
    await deleteCategoriaServicioFromTable(req.params.id);
    return res.json({ ok: true, message: "Categoria eliminada correctamente." });
  } catch (error) {
    return res.status(500).json({ message: "Error al eliminar categoria.", detail: error.message });
  }
});

// ==================== CATEGORY WITH SUBCATEGORIES (GET with subs nested) ====================

app.get("/api/categorias-servicio/full", async (_req, res) => {
  try {
    const cats = await readCategoriasServicioFromTables();
    const subs = await readSubcategoriasServicioFromTables();
    const subMap = {};
    for (const sub of subs) {
      const catId = String(sub.id_categoria);
      if (!subMap[catId]) subMap[catId] = [];
      subMap[catId].push({ id: String(sub.id), name: sub.nombre });
    }
    const full = cats.map((c) => ({ id: String(c.id), name: c.nombre, subcategories: subMap[String(c.id)] || [] }));
    return res.json({ categorias: full });
  } catch (error) {
    return res.status(500).json({ message: "Error al leer categorias.", detail: error.message });
  }
});

app.post("/api/service-catalog/recover", async (req, res) => {
  try {
    const forceRelink = req.body?.forceRelink === true;
    const result = await recoverServiceCatalogFromServices({ forceRelink });
    return res.json({ ok: true, ...result });
  } catch (error) {
    return res.status(400).json({ message: "No se pudo recuperar el catalogo de servicios.", detail: error.message });
  }
});

app.get("/api/menu-catalog/:kind", async (req, res) => {
  try {
    const kind = str(req.params?.kind).trim();
    if (kind === "preparacion") {
      const platoId = Number(req.query?.plato_id);
      const rows = await readPreparacionesByPlato(platoId);
      return res.json({ items: rows });
    }
    const rows = await readSimpleMenuCatalog(kind);
    return res.json({ items: rows });
  } catch (error) {
    return res.status(500).json({ message: "No se pudo leer el catalogo de Menu & Montaje.", detail: error.message });
  }
});

app.post("/api/menu-catalog/:kind", async (req, res) => {
  try {
    const kind = str(req.params?.kind).trim();
    const nombre = str(req.body?.nombre).trim();
    if (kind === "preparacion") {
      const idPlatoFuerte = Number(req.body?.id_plato_fuerte);
      await createPreparacionForPlato(idPlatoFuerte, nombre);
      return res.json({ ok: true });
    }
    await createSimpleMenuCatalog(kind, nombre, {
      tipo: req.body?.tipo,
      tipo_plato: req.body?.tipo_plato,
      es_sin_proteina: req.body?.es_sin_proteina,
    });
    return res.json({ ok: true });
  } catch (error) {
    return res.status(400).json({ message: "No se pudo guardar el catalogo de Menu & Montaje.", detail: error.message });
  }
});

app.put("/api/menu-catalog/:kind/:id", async (req, res) => {
  try {
    const kind = str(req.params?.kind).trim();
    const id = Number(req.params?.id);
    if (kind === "preparacion") {
      await updatePreparacionById(id, {
        nombre: req.body?.nombre,
        activo: req.body?.activo,
        id_plato_fuerte: req.body?.id_plato_fuerte,
      });
      return res.json({ ok: true });
    }
    await updateSimpleMenuCatalog(kind, id, {
      nombre: req.body?.nombre,
      activo: req.body?.activo,
      tipo: req.body?.tipo,
      tipo_plato: req.body?.tipo_plato,
      es_sin_proteina: req.body?.es_sin_proteina,
    });
    return res.json({ ok: true });
  } catch (error) {
    return res.status(400).json({ message: "No se pudo actualizar el catalogo de Menu & Montaje.", detail: error.message });
  }
});

app.get("/api/menu-suggestions", async (req, res) => {
  try {
    const idPlatoFuerte = Number(req.query?.plato_id);
    const idPreparacion = Number(req.query?.preparacion_id);
    const payload = await readMenuSuggestionLinks({ idPlatoFuerte, idPreparacion });
    return res.json(payload);
  } catch (error) {
    return res.status(400).json({ message: "No se pudieron leer las sugerencias de Menu.", detail: error.message });
  }
});

app.put("/api/menu-suggestions", async (req, res) => {
  try {
    await saveMenuSuggestionLinks({
      idPlatoFuerte: req.body?.id_plato_fuerte,
      idPreparacion: req.body?.id_preparacion,
      salsaIds: req.body?.salsaIds,
      postreIds: req.body?.postreIds,
      guarnicionIds: req.body?.guarnicionIds,
      bebidaIds: req.body?.bebidaIds,
      montajeTipoIds: req.body?.montajeTipoIds,
      montajeAdicionalIds: req.body?.montajeAdicionalIds,
    });
    return res.json({ ok: true });
  } catch (error) {
    return res.status(400).json({ message: "No se pudieron guardar las sugerencias de Menu.", detail: error.message });
  }
});

app.get("/api/anticipos/historial/:eventId", async (req, res) => {
  const eventId = str(req.params.eventId || "").trim();
  if (!eventId) return res.status(400).json({ message: "eventId requerido." });
  let conn;
  try {
    conn = await pool.getConnection();
    const rows = await conn.query(
      "SELECT id, id_anticipo, id_evento, accion, id_usuario_actor, nombre_usuario_actor, detalle, creado_en_iso FROM historial_anticipos WHERE id_evento = ? ORDER BY creado_en_iso DESC, creado_en DESC",
      [eventId]
    );
    const result = rows.map(r => ({
      id: str(r.id),
      advanceId: str(r.id_anticipo),
      action: str(r.accion),
      actorId: str(r.id_usuario_actor || ""),
      actorName: str(r.nombre_usuario_actor || ""),
      detail: str(r.detalle || ""),
      createdAt: str(r.creado_en_iso || ""),
    }));
    return res.json(result);
  } catch (error) {
    console.error("Error al obtener historial_anticipos:", error.message);
    return res.status(500).json({ message: error.message });
  } finally {
    if (conn) conn.release();
  }
});

app.get("/api/reportes/menu-items", async (req, res) => {
  const idsParam = str(req.query.ids || "").trim();
  if (!idsParam) return res.json({});
  const eventIds = idsParam.split(",").map((s) => str(s).trim()).filter(Boolean);
  if (!eventIds.length) return res.json({});
  let conn;
  try {
    conn = await pool.getConnection();
    const placeholders = eventIds.map(() => "?").join(",");
    const [rows] = await conn.query(
      `SELECT i.tipo, i.nombre, SUM(COALESCE(d.cantidad_total,1)) as total
       FROM informes_eventos ie
       JOIN informe_dias_detalle dd ON ie.id = dd.informe_id
       JOIN informe_dia_menu_detalle d ON dd.id = d.dia_id
       JOIN cat_ingredientes i ON d.ingrediente_id = i.id
       WHERE ie.id_ocupacion IN (${placeholders})
       GROUP BY i.tipo, i.nombre
       ORDER BY i.tipo, total DESC`,
      eventIds
    );
    if (!Array.isArray(rows)) return res.json({});
    const result = {};
    for (const r of rows) {
      const tipo = str(r.tipo || "otro").trim();
      if (!result[tipo]) result[tipo] = [];
      result[tipo].push({ nombre: str(r.nombre), total: Number(r.total || 0) });
    }
    return res.json(result);
  } catch (error) {
    console.error("Error en menu-items:", error.message);
    return res.status(500).json({ message: error.message });
  } finally {
    if (conn) conn.release();
  }
});

app.put("/api/state", async (req, res) => {
  console.log(`[${new Date().toLocaleTimeString()}] 💾 PUT /api/state - Solicitud de guardado recibida. Sincronizando con MariaDB...`);
  const nextState = req.body && req.body.state;
  if (!nextState || typeof nextState !== "object" || Array.isArray(nextState)) {
    console.error(`[${new Date().toLocaleTimeString()}] ❌ Body inválido recibido en PUT /api/state.`);
    return res.status(400).json({ message: "Body invalido. Use { state: {...} }." });
  }

  try {
    // Obtener eventos actuales de MariaDB antes del guardado para comparar
    let oldEvents = [];
    try {
      const currentState = await readStateFromTables();
      oldEvents = currentState?.events || [];
    } catch (err) {
      console.warn("⚠️ No se pudieron precargar los eventos anteriores para la comparación de Google Calendar:", err.message);
    }

    // 🛡️ SEGURIDAD: Fusionar state entrante con estado actual de BD
    // writeStateToTables hace DELETE+INSERT destructivo. Si falta una clave, se pierde.
    let mergedState = { ...nextState };
    try {
      const currentResult = await readStateFromTables();
      if (currentResult && currentResult.state) {
        const current = currentResult.state;
        for (const [key, value] of Object.entries(current)) {
          if (!(key in nextState)) {
            mergedState[key] = value;
          }
        }
        console.log(`[${new Date().toLocaleTimeString()}] 🛡️ Merge: ${Object.keys(nextState).length} claves request + preservadas ${Object.keys(current).length - Object.keys(nextState).length} de BD.`);
      }
    } catch (err) {
      console.warn("⚠️ No se pudo leer estado actual para merge, usando solo request:", err.message);
    }

    await writeStateToTables(mergedState);
    console.log(`[${new Date().toLocaleTimeString()}] ✅ ¡Éxito! BD actualizada (${(mergedState.events?.length || nextState.events?.length || 0)} eventos).`);

    // Emitir actualización vía Socket.io en tiempo real a todos los clientes
    if (io) {
      io.emit("state-updated", { timestamp: Date.now() });
      console.log(`[${new Date().toLocaleTimeString()}] 📡 Evento 'state-updated' emitido vía Socket.io a los clientes.`);
    }

    // Google Calendar sync desactivado del calendario general.

    return res.json({ ok: true });
  } catch (error) {
    console.error(`[${new Date().toLocaleTimeString()}] ❌ Error crítico al escribir en MariaDB:`, error);
    return res.status(500).json({ message: "No se pudo guardar en tablas reales.", detail: error.message });
  }
});

// ==========================================
// GOOGLE CALENDAR OAUTH2 AUTHENTICATION ROUTES
// ==========================================

function updateEnvFile(key, value) {
  const envPath = path.join(__dirname, ".env");
  let content = "";
  if (fs.existsSync(envPath)) {
    content = fs.readFileSync(envPath, "utf8");
  }

  const regex = new RegExp(`^${key}=.*$`, "m");
  if (regex.test(content)) {
    content = content.replace(regex, `${key}=${value}`);
  } else {
    if (content.endsWith("\n") || content.length === 0) {
      content += `${key}=${value}\n`;
    } else {
      content += `\n${key}=${value}\n`;
    }
  }
  fs.writeFileSync(envPath, content, "utf8");
}

app.get("/auth/google", (req, res) => {
  try {
    const authUrl = getAuthUrl();
    console.log(`[${new Date().toLocaleTimeString()}] 🔗 Redirigiendo al usuario a la pantalla de consentimiento de Google...`);
    return res.redirect(authUrl);
  } catch (error) {
    console.error("❌ Error al generar URL de autenticación de Google:", error.message);
    return res.status(500).send(`
      <div style="font-family: sans-serif; padding: 40px; text-align: center;">
        <h2 style="color: #dc2626;">Error al iniciar la autenticación</h2>
        <p>${error.message}</p>
        <p>Asegúrate de tener configuradas las variables <b>GOOGLE_CLIENT_ID</b> y <b>GOOGLE_CLIENT_SECRET</b> en tu archivo .env.</p>
      </div>
    `);
  }
});

app.get("/auth/google/callback", async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.status(400).send("Falta el código de autorización.");
  }

  try {
    const tokens = await handleAuthCallback(code);
    console.log("🔑 Google OAuth Tokens recibidos:", JSON.stringify(tokens, null, 2));
    
    if (tokens.refresh_token) {
      // Guardar automáticamente el refresh_token en el archivo .env
      updateEnvFile("GOOGLE_REFRESH_TOKEN", tokens.refresh_token);
      console.log(`[${new Date().toLocaleTimeString()}] 💾 ¡GOOGLE_REFRESH_TOKEN guardado en .env de forma automática!`);

      return res.send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <title>Google Calendar OAuth</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              background: linear-gradient(135deg, #0b1c30 0%, #060b13 100%);
              color: #e2e8f0;
              height: 100vh;
              margin: 0;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .card {
              background: rgba(255, 255, 255, 0.05);
              backdrop-filter: blur(16px);
              border: 1px solid rgba(255, 255, 255, 0.1);
              border-radius: 24px;
              padding: 48px;
              max-width: 500px;
              width: 100%;
              text-align: center;
              box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
            }
            h1 {
              font-size: 28px;
              margin-bottom: 16px;
              background: linear-gradient(90deg, #18c5bc 0%, #2563eb 100%);
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
            }
            p {
              line-height: 1.6;
              color: #94a3b8;
            }
            .token-box {
              background: rgba(0, 0, 0, 0.3);
              border: 1px solid rgba(255, 255, 255, 0.05);
              padding: 12px;
              border-radius: 12px;
              font-family: monospace;
              font-size: 13px;
              word-break: break-all;
              margin: 20px 0;
              text-align: left;
              user-select: all;
            }
            .badge {
              display: inline-block;
              padding: 6px 12px;
              border-radius: 20px;
              font-size: 12px;
              font-weight: 800;
              text-transform: uppercase;
              margin-bottom: 20px;
            }
            .badge.success {
              background: rgba(16, 185, 129, 0.15);
              color: #10b981;
              border: 1px solid rgba(16, 185, 129, 0.3);
            }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="badge success">Éxito</div>
            <h1>¡Autenticación Exitosa!</h1>
            <p>Hemos obtenido el <b>refresh_token</b> de Google y lo hemos guardado automáticamente en tu archivo <b>.env</b>.</p>
            <div class="token-box">${tokens.refresh_token}</div>
            <p>Por favor, <b>reinicia tu servidor de Node</b> para cargar las nuevas variables de entorno y activar la sincronización en tiempo real.</p>
          </div>
        </body>
        </html>
      `);
    } else {
      console.warn("⚠️ Google no retornó un refresh_token nuevo (la app ya estaba vinculada anteriormente).");
      return res.send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <title>Google Calendar OAuth</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              background: linear-gradient(135deg, #0b1c30 0%, #060b13 100%);
              color: #e2e8f0;
              height: 100vh;
              margin: 0;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .card {
              background: rgba(255, 255, 255, 0.05);
              backdrop-filter: blur(16px);
              border: 1px solid rgba(255, 255, 255, 0.1);
              border-radius: 24px;
              padding: 48px;
              max-width: 500px;
              width: 100%;
              text-align: center;
              box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
            }
            h1 {
              font-size: 26px;
              margin-bottom: 16px;
              background: linear-gradient(90deg, #f59e0b 0%, #dc2626 100%);
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
            }
            p {
              line-height: 1.6;
              color: #94a3b8;
            }
            .badge {
              display: inline-block;
              padding: 6px 12px;
              border-radius: 20px;
              font-size: 12px;
              font-weight: 800;
              text-transform: uppercase;
              margin-bottom: 20px;
            }
            .badge.warning {
              background: rgba(245, 158, 11, 0.15);
              color: #f59e0b;
              border: 1px solid rgba(245, 158, 11, 0.3);
            }
            ol {
              text-align: left;
              color: #cbd5e1;
              padding-left: 20px;
              line-height: 1.8;
              font-size: 14px;
            }
            .btn {
              display: inline-block;
              margin-top: 20px;
              padding: 12px 28px;
              background: #f59e0b;
              color: #0b1c30;
              text-decoration: none;
              font-weight: 800;
              border-radius: 12px;
              box-shadow: 0 4px 15px rgba(245, 158, 11, 0.3);
              transition: all 0.2s ease;
            }
            .btn:hover {
              transform: translateY(-2px);
              box-shadow: 0 6px 20px rgba(245, 158, 11, 0.5);
            }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="badge warning">Atención</div>
            <h1>Conexión Parcial</h1>
            <p>Google no ha devuelto un <b>refresh_token</b> nuevo porque tu cuenta ya estaba vinculada anteriormente.</p>
            <p>Para solucionar esto y obtener el token de conexión persistente:</p>
            <ol>
              <li>Ve a <a href="https://myaccount.google.com/connections" target="_blank" style="color: #18c5bc; font-weight: 700;">Conexiones de tu cuenta de Google</a>.</li>
              <li>Busca la aplicación de tu CRM y haz clic en <b>"Eliminar todo el acceso"</b>.</li>
              <li>Regresa aquí y haz clic en el siguiente botón para volver a autorizar de forma limpia.</li>
            </ol>
            <a href="/auth/google" class="btn">Volver a Intentar</a>
          </div>
        </body>
        </html>
      `);
    }
  } catch (error) {
    console.error("❌ Error en el callback de autenticación de Google:", error.message);
    return res.status(500).send(`Error en el callback de autenticación: ${error.message}`);
  }
});

app.get("/auth/google/sync", async (req, res) => {
  console.log(`[${new Date().toLocaleTimeString()}] 🔄 Iniciando sincronización forzada de todos los eventos desde MariaDB a Google Calendar...`);
  let conn;
  try {
    conn = await pool.getConnection();
    const dbEvents = await conn.query("SELECT id, nombre, fecha_evento FROM eventos");
    console.log(`[DEBUG SYNC] Direct query returned ${dbEvents?.length || 0} rows from 'eventos' table.`);
    if (dbEvents && dbEvents.length > 0) {
      console.log("[DEBUG SYNC] Sample event row:", JSON.stringify(dbEvents[0]));
    }

    const currentState = await readStateFromTables();
    console.log(`[DEBUG SYNC] readStateFromTables result: ${currentState ? "not null" : "null"}`);
    if (currentState) {
      console.log(`[DEBUG SYNC] currentState.state.events.length: ${currentState.state?.events?.length || 0}`);
      console.log(`[DEBUG SYNC] currentState.state.salones.length: ${currentState.state?.salones?.length || 0}`);
    }

    const events = currentState?.state?.events || [];
    
    if (events.length === 0) {
      return res.send(`
        <div style="font-family: sans-serif; padding: 40px; text-align: center; background: #0b1c30; color: #e2e8f0; height: 100vh; display: flex; align-items: center; justify-content: center;">
          <div style="background: rgba(255,255,255,0.05); padding: 40px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1);">
            <h2>Sincronización Completa</h2>
            <p style="color: #94a3b8;">No se encontraron eventos en la base de datos MariaDB para sincronizar.</p>
            <a href="http://localhost:5173/calendar" style="display: inline-block; margin-top: 20px; padding: 12px 28px; background: #18c5bc; color: #0b1c30; text-decoration: none; font-weight: 800; border-radius: 12px;">Volver al Calendario</a>
          </div>
        </div>
      `);
    }

      // Google Calendar sync desactivado del calendario general.

    return res.send(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>Google Calendar Sync</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: linear-gradient(135deg, #0b1c30 0%, #060b13 100%);
            color: #e2e8f0;
            height: 100vh;
            margin: 0;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .card {
            background: rgba(255, 255, 255, 0.05);
            backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 24px;
            padding: 48px;
            max-width: 500px;
            width: 100%;
            text-align: center;
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
          }
          h1 {
            font-size: 28px;
            margin-bottom: 16px;
            background: linear-gradient(90deg, #18c5bc 0%, #2563eb 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
          }
          p {
            line-height: 1.6;
            color: #94a3b8;
          }
          .badge {
            display: inline-block;
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 800;
            text-transform: uppercase;
            margin-bottom: 20px;
            background: rgba(24, 197, 188, 0.15);
            color: #18c5bc;
            border: 1px solid rgba(24, 197, 188, 0.3);
          }
          .btn {
            display: inline-block;
            margin-top: 20px;
            padding: 12px 28px;
            background: #18c5bc;
            color: #0b1c30;
            text-decoration: none;
            font-weight: 800;
            border-radius: 12px;
            box-shadow: 0 4px 15px rgba(24, 197, 188, 0.3);
            transition: all 0.2s ease;
          }
          .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(24, 197, 188, 0.5);
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="badge">Sincronización</div>
          <h1>¡Sincronización Completa!</h1>
          <p>Hemos sincronizado exitosamente tus <b>${events.length} eventos anteriores</b> registrados en MariaDB con tu Google Calendar.</p>
          <a href="http://localhost:5173/calendar" class="btn">Volver al Calendario</a>
        </div>
      </body>
      </html>
    `);

  } catch (error) {
    console.error("❌ Error durante la sincronización forzada:", error);
    return res.status(500).send(`Error de sincronización: ${error.message}`);
  } finally {
    if (conn) conn.release();
  }
});

app.post("/api/calendar/invite", async (req, res) => {
  const { date, time, eventName, email, notes, reminderId } = req.body;
  if (!date || !time || !eventName) {
    return res.status(400).json({ error: "Faltan campos requeridos: date, time, eventName" });
  }
  if (!email) {
    return res.status(400).json({ error: "El email del usuario es requerido para crear la cita en Google Calendar" });
  }

  try {
    const result = await createUserReminder({
      userEmail: email,
      eventName,
      date,
      time,
      notes: notes || '',
      reminderId,
    });

    if (!result.ok) {
      return res.status(500).json({ error: "No se pudo crear la cita en Google Calendar" });
    }

    const modeMsg = result.mode === 'direct'
      ? `Cita creada directamente en el calendario de ${email}`
      : `Invitación enviada a ${email} (acepta el email para ver la cita en tu calendario)`;

    console.log(`[${new Date().toLocaleTimeString()}] 📅 ${modeMsg}`);
    return res.json({ ok: true, message: modeMsg, mode: result.mode });
  } catch (error) {
    console.error("❌ Error creando cita en Google Calendar:", error.message);
    return res.status(500).json({ error: "Error creando evento en Google Calendar", details: error.message });
  }
});

app.post("/api/calendar/delete-reminder", async (req, res) => {
  const { reminderId, email } = req.body;
  if (!reminderId) {
    return res.status(400).json({ error: "reminderId es requerido" });
  }

  try {
    const result = await deleteUserReminder(reminderId, email);
    return res.json({ ok: true });
  } catch (error) {
    console.error("❌ Error eliminando cita de Google Calendar:", error.message);
    return res.status(500).json({ error: "Error eliminando cita de Google Calendar", details: error.message });
  }
});

app.get("/manifest.json", (req, res) => {
  res.type("application/manifest+json");
  const fallbackPath = path.join(__dirname, "dist", "manifest.json");
  return res.sendFile(fallbackPath);
});

app.get("/sw.js", (req, res) => {
  res.setHeader("Cache-Control", "no-cache");
  res.type("application/javascript");
  const fallbackPath = path.join(__dirname, "dist", "sw.js");
  return res.sendFile(fallbackPath);
});

// Frontend desactivado en el puerto 3001 para que actúe 100% como API Backend.
// app.use(express.static(path.join(__dirname, "dist")));



async function start() {
  try {
    await ensureAppStateExtraStructure();
    await ensureServiceCatalogStructure();
    await ensureQuoteVersionStructure();
    await ensureEventDateRangeStructure();
    await ensureAdvancesStructure();
    await ensureMenuMontajeCatalogStructure();
    await ensureDocumentSequenceStructure();
    await ensureUsersExtendedStructure();
    await ensureQuoteItemPrimaryKeyColumnSize();
    await ensureRequiredTables();
    await ensureDefaultUserCarlos();

    // Crear directorio de uploads para imágenes de informes si no existe
    const uploadsDir = path.join(__dirname, "uploads");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    app.use("/uploads", express.static(uploadsDir));

    const server = http.createServer(app);
    io = new Server(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
      }
    });

    app.use((req, res, next) => {
      req.io = io;
      next();
    });

    io.on("connection", (socket) => {
      socket.on("join", (room) => socket.join(room));
      socket.on("leave", (room) => socket.leave(room));
    });

    // Cargar dinámicamente rutas ESM del módulo de informes
    const reportsRouter = await import("./backend/src/app_routes.js");
    app.use("/api", reportsRouter.default);

    // Error middleware global (después de todas las rutas)
    const { notFound, errorHandler } = await import("./backend/src/middlewares/errorHandler.js");
    app.use("/api", notFound);
    app.use("/api", errorHandler);

    // Fallback wildcard handler registered AFTER dynamic ESM routes
    app.get("*", (req, res) => {
      if (req.path.startsWith("/api/")) {
        return res.status(404).json({ message: "Ruta API no encontrada." });
      }
      return res.status(200).json({ 
        service: "CRM API Backend (server.cjs)",
        status: "online",
        message: "El servidor Node está funcionando únicamente como API. Para ver la interfaz, entra al puerto 5173 (Vite)."
      });
    });

    server.listen(APP_PORT, () => {
      console.log(`CRM y Socket.io listo en http://localhost:${APP_PORT}`);
      console.log(`MariaDB -> ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}`);
      console.log("Persistencia activa en tablas relacionales.");
    });
  } catch (error) {
    console.error("Error al iniciar el servidor:", error.message);
    process.exit(1);
  }
}

start();
