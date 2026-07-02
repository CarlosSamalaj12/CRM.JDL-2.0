const fs = require("fs");
const path = require("path");
const mariadb = require("mariadb");
const dotenv = require("dotenv");

const ROOT_DIR = path.resolve(__dirname, "..");
const LEGACY_ROOT = path.resolve(ROOT_DIR, "..", "Informes Eventos orgn");
const LEGACY_UPLOADS_DIR = path.join(LEGACY_ROOT, "backend", "uploads");
const TARGET_UPLOADS_DIR = path.join(ROOT_DIR, "uploads");

dotenv.config({ path: path.join(ROOT_DIR, ".env") });

const targetConfig = {
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3307),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "2022",
  database: process.env.DB_NAME || "crm_jdl",
  multipleStatements: true,
};

const legacyConfig = {
  host: process.env.LEGACY_DB_HOST || "localhost",
  port: Number(process.env.LEGACY_DB_PORT || 3306),
  user: process.env.LEGACY_DB_USER || "it_app",
  password: process.env.LEGACY_DB_PASSWORD || "12031991",
  database: process.env.LEGACY_DB_NAME || "informes",
  multipleStatements: true,
};

const INFORMES_TABLES = [
  "cat_categorias_alimento",
  "cat_ingredientes",
  "cat_opciones_ingrediente",
  "cat_menus",
  "menu_items",
  "cat_platillos",
  "platillo_componentes",
  "informes_eventos",
  "informe_dias_detalle",
  "informe_dia_menu_detalle",
  "notificaciones",
  "informe_comentarios",
  "informe_lecturas",
  "informe_destacados",
  "informe_historial",
  "informe_imagenes",
  "event_notas",
  "evento_metadatos",
];

const OPTIONAL_CRM_TABLES = [
  "salones",
  "empresas",
  "encargados_empresa",
  "eventos",
  "cotizaciones_evento",
];

const DERIVED_CONFIG_TABLES = [
  "config_equipo",
  "config_tipo_silla",
  "config_tipo_mesa",
  "config_forma_pago",
];

function log(message = "") {
  process.stdout.write(`${message}\n`);
}

function sqlId(name) {
  return `\`${String(name).replace(/`/g, "``")}\``;
}

function normalizeRole(role) {
  const raw = String(role || "").trim().toLowerCase();
  if (raw === "admin") return "admin";
  if (raw === "frontoffice" || raw === "front_office") return "frontoffice";
  if (raw === "coordinador") return "coordinador";
  return "vendedor";
}

function mapMentionIds(raw, userIdMap) {
  if (raw === null || raw === undefined) return raw;
  const parts = String(raw)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (!parts.length) return raw;
  return parts.map((part) => userIdMap.get(part) || part).join(",");
}

function rewriteUserReferences(row, userIdMap) {
  const mapped = { ...row };
  const userKeys = ["usuario_id", "id_usuario", "creado_por", "actualizado_por"];

  for (const key of userKeys) {
    if (mapped[key] !== undefined && mapped[key] !== null) {
      const sourceId = String(mapped[key]);
      mapped[key] = userIdMap.get(sourceId) || sourceId;
    }
  }

  if (mapped.mencion_a_id !== undefined && mapped.mencion_a_id !== null) {
    mapped.mencion_a_id = mapMentionIds(mapped.mencion_a_id, userIdMap);
  }

  return mapped;
}

async function connect(config) {
  return mariadb.createConnection(config);
}

async function tableExists(conn, dbName, tableName) {
  const rows = await conn.query(
    `SELECT 1
       FROM information_schema.tables
      WHERE table_schema = ?
        AND table_name = ?
      LIMIT 1`,
    [dbName, tableName]
  );
  return rows.length > 0;
}

async function getColumns(conn, dbName, tableName) {
  const rows = await conn.query(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema = ?
        AND table_name = ?
      ORDER BY ordinal_position`,
    [dbName, tableName]
  );
  return rows.map((row) => row.column_name);
}

async function queryRows(conn, sql, params = []) {
  const result = await conn.query(sql, params);
  return Array.isArray(result) ? result : [];
}

async function ensureTargetSchema(conn) {
  log("Creando/ajustando esquema del modulo Informes en crm_jdl...");

  const alterQueries = [
    "ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS rol VARCHAR(50) DEFAULT 'vendedor'",
    "ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255) NULL",
  ];

  for (const query of alterQueries) {
    try {
      await conn.query(query);
      log(`  OK ${query}`);
    } catch (error) {
      log(`  WARN ${query} -> ${error.message}`);
    }
  }

  const createViewSql = `
    CREATE OR REPLACE VIEW tbl_seguimientocotizaciones AS
    SELECT
      e.id AS Idocupacion,
      e.nombre AS Institucion,
      e.pax AS Pax,
      CASE
        WHEN e.estado = 'Confirmado' THEN 4
        WHEN e.estado = 'Pre reserva' OR e.estado = 'Pre-reserva' THEN 7
        WHEN e.estado = 'Mantenimiento' OR e.estado = 'Mantenimiento Realizado' THEN 8
        ELSE 1
      END AS Estatuscotizacion,
      COALESCE(u.nombre, e.id_usuario) AS Vendedor,
      e.fecha_evento AS FechaEvento,
      e.fecha_fin_reserva AS FechaSalida,
      e.hora_inicio AS HoraI,
      e.hora_fin AS HoraF,
      COALESCE(c.tipo_evento, 'Evento') AS TipoEvento,
      c.telefono AS Telefono,
      e.nombre_salon AS Salon,
      c.nombre_encargado AS EncargadoEvento,
      c.codigo AS NoDoc
    FROM eventos e
    LEFT JOIN (
      SELECT id_evento, tipo_evento, telefono, nombre_encargado, codigo
      FROM cotizaciones_evento
      GROUP BY id_evento
    ) c ON e.id = c.id_evento
    LEFT JOIN usuarios u ON e.id_usuario = u.id
  `;
  await conn.query(createViewSql);
  log("  OK vista tbl_seguimientocotizaciones");

  const createTables = [
    `CREATE TABLE IF NOT EXISTS cat_categorias_alimento (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nombre VARCHAR(150) NOT NULL UNIQUE,
      fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS cat_ingredientes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nombre VARCHAR(150) NOT NULL,
      tipo VARCHAR(50) NOT NULL DEFAULT 'otros',
      fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS cat_opciones_ingrediente (
      id INT AUTO_INCREMENT PRIMARY KEY,
      ingrediente_id INT NOT NULL,
      nombre_opcion VARCHAR(150) NOT NULL,
      FOREIGN KEY (ingrediente_id) REFERENCES cat_ingredientes(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS cat_menus (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nombre_menu VARCHAR(150) NOT NULL,
      descripcion TEXT,
      categoria_id INT DEFAULT NULL,
      fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (categoria_id) REFERENCES cat_categorias_alimento(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS menu_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      menu_id INT NOT NULL,
      ingrediente_id INT NOT NULL,
      opcion_id INT DEFAULT NULL,
      cantidad DECIMAL(10,2) NOT NULL DEFAULT 1,
      FOREIGN KEY (menu_id) REFERENCES cat_menus(id) ON DELETE CASCADE,
      FOREIGN KEY (ingrediente_id) REFERENCES cat_ingredientes(id),
      FOREIGN KEY (opcion_id) REFERENCES cat_opciones_ingrediente(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS cat_platillos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nombre_platillo VARCHAR(150) NOT NULL,
      descripcion TEXT,
      categoria_id INT DEFAULT NULL,
      precio_base DECIMAL(10,2) DEFAULT 0,
      fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (categoria_id) REFERENCES cat_categorias_alimento(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS platillo_componentes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      platillo_id INT NOT NULL,
      ingrediente_id INT NOT NULL,
      opcion_id INT DEFAULT NULL,
      tipo_componente VARCHAR(100) NOT NULL DEFAULT 'proteina',
      cantidad DECIMAL(10,2) NOT NULL DEFAULT 1,
      orden INT DEFAULT 0,
      FOREIGN KEY (platillo_id) REFERENCES cat_platillos(id) ON DELETE CASCADE,
      FOREIGN KEY (ingrediente_id) REFERENCES cat_ingredientes(id),
      FOREIGN KEY (opcion_id) REFERENCES cat_opciones_ingrediente(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS informes_eventos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      id_ocupacion VARCHAR(255) NOT NULL,
      version INT DEFAULT 1,
      fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS informe_dias_detalle (
      id INT AUTO_INCREMENT PRIMARY KEY,
      informe_id INT NOT NULL,
      fecha_evento DATE NOT NULL,
      menu_id INT DEFAULT NULL,
      descripcion_montaje TEXT,
      FOREIGN KEY (informe_id) REFERENCES informes_eventos(id) ON DELETE CASCADE,
      FOREIGN KEY (menu_id) REFERENCES cat_menus(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS notificaciones (
      id INT AUTO_INCREMENT PRIMARY KEY,
      usuario_id VARCHAR(80) DEFAULT NULL,
      tipo VARCHAR(60) NOT NULL DEFAULT 'informe',
      titulo VARCHAR(180),
      mensaje TEXT,
      informe_id INT,
      idocupacion VARCHAR(255) DEFAULT NULL,
      leido TINYINT(1) DEFAULT 0,
      fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS informe_dia_menu_detalle (
      id INT AUTO_INCREMENT PRIMARY KEY,
      dia_id INT NOT NULL,
      menu_item_id INT DEFAULT NULL,
      ingrediente_id INT NOT NULL,
      opcion_id INT DEFAULT NULL,
      metodo_preparacion VARCHAR(100) DEFAULT NULL,
      cantidad_total DECIMAL(10,2) DEFAULT 0,
      notas TEXT,
      FOREIGN KEY (dia_id) REFERENCES informe_dias_detalle(id) ON DELETE CASCADE,
      FOREIGN KEY (ingrediente_id) REFERENCES cat_ingredientes(id),
      FOREIGN KEY (opcion_id) REFERENCES cat_opciones_ingrediente(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS informe_comentarios (
      id INT AUTO_INCREMENT PRIMARY KEY,
      informe_id INT NOT NULL,
      dia_id INT DEFAULT NULL,
      usuario_id VARCHAR(80) NOT NULL,
      contenido TEXT NOT NULL,
      mencion_a_id VARCHAR(255) DEFAULT NULL,
      reacciones TEXT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (informe_id) REFERENCES informes_eventos(id) ON DELETE CASCADE,
      FOREIGN KEY (dia_id) REFERENCES informe_dias_detalle(id) ON DELETE CASCADE,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS informe_lecturas (
      id INT AUTO_INCREMENT PRIMARY KEY,
      informe_id INT NOT NULL,
      usuario_id VARCHAR(80) NOT NULL,
      leido_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_lectura (informe_id, usuario_id),
      FOREIGN KEY (informe_id) REFERENCES informes_eventos(id) ON DELETE CASCADE,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS informe_destacados (
      id INT AUTO_INCREMENT PRIMARY KEY,
      informe_id INT NOT NULL,
      dia_id INT DEFAULT NULL,
      usuario_id VARCHAR(80) NOT NULL,
      razon VARCHAR(255),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (informe_id) REFERENCES informes_eventos(id) ON DELETE CASCADE,
      FOREIGN KEY (dia_id) REFERENCES informe_dias_detalle(id) ON DELETE CASCADE,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS informe_historial (
      id INT AUTO_INCREMENT PRIMARY KEY,
      informe_id INT NOT NULL,
      usuario_id VARCHAR(80) NOT NULL,
      accion VARCHAR(100) NOT NULL,
      descripcion TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (informe_id) REFERENCES informes_eventos(id) ON DELETE CASCADE,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS informe_imagenes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      informe_id INT NOT NULL,
      dia_id INT DEFAULT NULL,
      url TEXT NOT NULL,
      descripcion VARCHAR(255) DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (informe_id) REFERENCES informes_eventos(id) ON DELETE CASCADE,
      FOREIGN KEY (dia_id) REFERENCES informe_dias_detalle(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS event_notas (
      id INT AUTO_INCREMENT PRIMARY KEY,
      idocupacion VARCHAR(255) NOT NULL,
      usuario_id VARCHAR(80) NOT NULL,
      contenido TEXT NOT NULL,
      mencion_a_id VARCHAR(255) DEFAULT NULL,
      reacciones TEXT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS evento_metadatos (
      id_ocupacion VARCHAR(255) PRIMARY KEY,
      desayunos INT DEFAULT 0,
      habitaciones TEXT NULL,
      tiene_alertas TINYINT(1) DEFAULT 0,
      alertas_text TEXT NULL,
      fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS config_equipo (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nombre VARCHAR(150) NOT NULL,
      activo TINYINT(1) NOT NULL DEFAULT 1,
      fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS config_tipo_silla (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nombre VARCHAR(150) NOT NULL,
      activo TINYINT(1) NOT NULL DEFAULT 1,
      fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS config_tipo_mesa (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nombre VARCHAR(150) NOT NULL,
      activo TINYINT(1) NOT NULL DEFAULT 1,
      fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS config_forma_pago (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nombre VARCHAR(200) NOT NULL,
      activo TINYINT(1) NOT NULL DEFAULT 1,
      fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_config_forma_pago_nombre (nombre)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ];

  await conn.query("SET FOREIGN_KEY_CHECKS = 0");
  for (const statement of createTables) {
    await conn.query(statement);
  }
  await conn.query("SET FOREIGN_KEY_CHECKS = 1");
}

async function countRows(conn, tableName) {
  const rows = await queryRows(conn, `SELECT COUNT(*) AS total FROM ${sqlId(tableName)}`);
  return Number(rows[0]?.total || 0);
}

async function clearTables(conn, tableNames) {
  await conn.query("SET FOREIGN_KEY_CHECKS = 0");
  for (const tableName of tableNames) {
    if (await tableExists(conn, targetConfig.database, tableName)) {
      await conn.query(`DELETE FROM ${sqlId(tableName)}`);
    }
  }
  await conn.query("SET FOREIGN_KEY_CHECKS = 1");
}

async function ensureNamedCategory(conn, cache, nombre) {
  const key = String(nombre || "").trim();
  if (!key) return null;
  if (cache.has(key)) return cache.get(key);

  const existing = await queryRows(
    conn,
    `SELECT id FROM cat_categorias_alimento WHERE nombre = ? LIMIT 1`,
    [key]
  );
  let id = existing[0]?.id;
  if (!id) {
    const result = await conn.query(
      `INSERT INTO cat_categorias_alimento (nombre) VALUES (?)`,
      [key]
    );
    id = Number(result.insertId);
  }
  cache.set(key, Number(id));
  return Number(id);
}

async function ensureNamedIngredient(conn, cache, nombre, tipo) {
  const safeName = String(nombre || "").trim();
  const safeType = String(tipo || "otros").trim() || "otros";
  const key = `${safeType}::${safeName}`.toLowerCase();
  if (!safeName) return null;
  if (cache.has(key)) return cache.get(key);

  const existing = await queryRows(
    conn,
    `SELECT id FROM cat_ingredientes WHERE nombre = ? AND tipo = ? LIMIT 1`,
    [safeName, safeType]
  );
  let id = existing[0]?.id;
  if (!id) {
    const result = await conn.query(
      `INSERT INTO cat_ingredientes (nombre, tipo) VALUES (?, ?)`,
      [safeName, safeType]
    );
    id = Number(result.insertId);
  }
  cache.set(key, Number(id));
  return Number(id);
}

function normalizeMenuPayload(rawPayload) {
  if (!rawPayload) return [];
  try {
    const data = typeof rawPayload === "string" ? JSON.parse(rawPayload) : rawPayload;
    if (Array.isArray(data?.menuMontajeEntries)) return data.menuMontajeEntries;
    if (Array.isArray(data?.menuMontajeVersions)) {
      const latest = data.menuMontajeVersions[data.menuMontajeVersions.length - 1];
      if (Array.isArray(latest?.entries)) return latest.entries;
    }
    return [];
  } catch {
    return [];
  }
}

async function deriveInformesCatalogFromCurrentCrm(conn) {
  log("");
  log("Poblando catalogos de Informes desde datos reales del CRM actual...");

  const existingCatalogCount =
    (await countRows(conn, "cat_ingredientes")) +
    (await countRows(conn, "cat_platillos")) +
    (await countRows(conn, "cat_menus"));

  if (existingCatalogCount > 0) {
    log("  SKIP catalogos derivados: ya existen datos en tablas cat_*");
    return false;
  }

  await clearTables(conn, [
    "menu_items",
    "platillo_componentes",
    "cat_menus",
    "cat_platillos",
    "cat_opciones_ingrediente",
    "cat_ingredientes",
    "cat_categorias_alimento",
  ]);

  const categoryCache = new Map();
  const ingredientCache = new Map();
  const sourceIngredientMap = new Map();
  const platilloMap = new Map();

  const [proteinas, salsas, guarniciones, postres, bebidas, equipos] = await Promise.all([
    queryRows(conn, "SELECT id, nombre, tipo_plato FROM menu_platos_fuertes WHERE activo = 1 ORDER BY nombre"),
    queryRows(conn, "SELECT id, nombre FROM menu_salsas WHERE activo = 1 ORDER BY nombre"),
    queryRows(conn, "SELECT id, nombre FROM menu_guarniciones WHERE activo = 1 ORDER BY nombre"),
    queryRows(conn, "SELECT id, nombre FROM menu_postres WHERE activo = 1 ORDER BY nombre"),
    queryRows(conn, "SELECT id, nombre FROM menu_bebidas WHERE activo = 1 ORDER BY nombre"),
    queryRows(conn, "SELECT id, nombre, tipo FROM montaje_adicionales WHERE activo = 1 ORDER BY nombre"),
  ]);

  const generalCategoryId = await ensureNamedCategory(conn, categoryCache, "Menus CRM");
  const normalCategoryId = await ensureNamedCategory(conn, categoryCache, "Platos Fuertes");
  const vegetarianoCategoryId = await ensureNamedCategory(conn, categoryCache, "Platos Vegetarianos");

  for (const row of proteinas) {
    const ingredientId = await ensureNamedIngredient(conn, ingredientCache, row.nombre, "proteina");
    sourceIngredientMap.set(`proteina:${row.id}`, ingredientId);

    const categoryId =
      String(row.tipo_plato || "").toUpperCase() === "VEGETARIANO"
        ? vegetarianoCategoryId
        : normalCategoryId;

    const result = await conn.query(
      `INSERT INTO cat_platillos (nombre_platillo, descripcion, categoria_id, precio_base)
       VALUES (?, ?, ?, 0)`,
      [row.nombre, `Importado desde menu_platos_fuertes`, categoryId]
    );
    platilloMap.set(Number(row.id), Number(result.insertId));
  }

  for (const row of salsas) {
    const ingredientId = await ensureNamedIngredient(conn, ingredientCache, row.nombre, "salsa");
    sourceIngredientMap.set(`salsa:${row.id}`, ingredientId);
  }
  for (const row of guarniciones) {
    const ingredientId = await ensureNamedIngredient(conn, ingredientCache, row.nombre, "guarnicion");
    sourceIngredientMap.set(`guarnicion:${row.id}`, ingredientId);
  }
  for (const row of postres) {
    const ingredientId = await ensureNamedIngredient(conn, ingredientCache, row.nombre, "postre");
    sourceIngredientMap.set(`postre:${row.id}`, ingredientId);
  }
  for (const row of bebidas) {
    const ingredientId = await ensureNamedIngredient(conn, ingredientCache, row.nombre, "bebida");
    sourceIngredientMap.set(`bebida:${row.id}`, ingredientId);
  }

  for (const row of equipos) {
    if (String(row.tipo || "").toUpperCase() === "EQUIPO") {
      await conn.query(
        `INSERT INTO config_equipo (nombre, activo) VALUES (?, 1)
         ON DUPLICATE KEY UPDATE nombre = VALUES(nombre)`,
        [row.nombre]
      );
    }
  }

  const cotizaciones = await queryRows(
    conn,
    `SELECT id_evento, json_crudo FROM cotizaciones_evento WHERE json_crudo IS NOT NULL`
  );
  const eventos = await queryRows(
    conn,
    `SELECT id, cotizacion_json FROM eventos WHERE cotizacion_json IS NOT NULL`
  );

  const menuMap = new Map();

  async function ensureMenu(entry, fallbackName) {
    const nombre =
      String(entry?.menuTitle || "").trim() ||
      String(fallbackName || "").trim() ||
      "Menu CRM sin titulo";
    const key = nombre.toLowerCase();
    if (menuMap.has(key)) return menuMap.get(key);

    const result = await conn.query(
      `INSERT INTO cat_menus (nombre_menu, descripcion, categoria_id)
       VALUES (?, ?, ?)`,
      [
        nombre,
        String(entry?.menuDescription || entry?.menuNotes || "").trim() || null,
        generalCategoryId,
      ]
    );
    const menuId = Number(result.insertId);
    menuMap.set(key, menuId);
    return menuId;
  }

  async function appendMenuItems(payloadEntries, fallbackName) {
    for (const entry of payloadEntries) {
      const lineItems = Array.isArray(entry?.lineItems) ? entry.lineItems : [];
      if (!lineItems.length) continue;

      const menuId = await ensureMenu(entry, fallbackName);

      for (const lineItem of lineItems) {
        const proteinIngredientId = sourceIngredientMap.get(`proteina:${lineItem.platoId}`);
        if (proteinIngredientId) {
          await conn.query(
            `INSERT INTO menu_items (menu_id, ingrediente_id, opcion_id, cantidad)
             VALUES (?, ?, NULL, ?)`,
            [menuId, proteinIngredientId, Number(lineItem.qty || 1)]
          );
        }

        const collections = [
          ["salsa", Array.isArray(lineItem.salsaIds) ? lineItem.salsaIds : [], lineItem.salsaQtys || {}],
          ["guarnicion", Array.isArray(lineItem.guarnicionIds) ? lineItem.guarnicionIds : [], lineItem.guarnicionQtys || {}],
          ["postre", Array.isArray(lineItem.postreIds) ? lineItem.postreIds : [], lineItem.postreQtys || {}],
          ["bebida", Array.isArray(lineItem.bebidaIds) ? lineItem.bebidaIds : [], lineItem.bebidaQtys || {}],
        ];

        for (const [tipo, ids, qtyMap] of collections) {
          for (const sourceId of ids) {
            const ingredientId = sourceIngredientMap.get(`${tipo}:${sourceId}`);
            if (!ingredientId) continue;
            const qtyValue = Number(qtyMap?.[sourceId] || 1) || 1;
            await conn.query(
              `INSERT INTO menu_items (menu_id, ingrediente_id, opcion_id, cantidad)
               VALUES (?, ?, NULL, ?)`,
              [menuId, ingredientId, qtyValue]
            );
          }
        }
      }
    }
  }

  for (const row of cotizaciones) {
    await appendMenuItems(normalizeMenuPayload(row.json_crudo), row.id_evento);
  }
  for (const row of eventos) {
    await appendMenuItems(normalizeMenuPayload(row.cotizacion_json), row.id);
  }

  log(`  OK ingredientes: ${await countRows(conn, "cat_ingredientes")}`);
  log(`  OK platillos: ${await countRows(conn, "cat_platillos")}`);
  log(`  OK menus: ${await countRows(conn, "cat_menus")}`);
  log(`  OK items de menu: ${await countRows(conn, "menu_items")}`);
  return true;
}

async function buildUserIdMap(sourceConn, targetConn) {
  const sourceHasUsers = await tableExists(sourceConn, legacyConfig.database, "usuarios");
  if (!sourceHasUsers) {
    return new Map();
  }

  log("Fusionando usuarios del sistema viejo con usuarios del CRM...");

  const sourceRows = await queryRows(
    sourceConn,
    `SELECT id, nombre, email, password_hash, rol, activo
       FROM usuarios`
  );
  const targetRows = await queryRows(
    targetConn,
    `SELECT id, correo
       FROM usuarios`
  );

  const byEmail = new Map();
  for (const row of targetRows) {
    const email = String(row.correo || "").trim().toLowerCase();
    if (email) {
      byEmail.set(email, String(row.id));
    }
  }

  const map = new Map();

  for (const row of sourceRows) {
    const sourceId = String(row.id);
    const email = String(row.email || "").trim().toLowerCase();
    const existingTargetId = email ? byEmail.get(email) : null;

    if (existingTargetId) {
      map.set(sourceId, existingTargetId);
      continue;
    }

    const targetId = `legacy_inf_${sourceId}`.slice(0, 80);
    await targetConn.query(
      `INSERT INTO usuarios (
         id,
         nombre,
         nombre_usuario,
         nombre_completo,
         correo,
         contrasena,
         password_hash,
         activo,
         rol
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         nombre = VALUES(nombre),
         nombre_completo = VALUES(nombre_completo),
         correo = COALESCE(VALUES(correo), correo),
         password_hash = COALESCE(VALUES(password_hash), password_hash),
         activo = VALUES(activo),
         rol = VALUES(rol)`,
      [
        targetId,
        row.nombre || email || targetId,
        null,
        row.nombre || email || targetId,
        email || null,
        null,
        row.password_hash || null,
        row.activo === undefined || row.activo === null ? 1 : Number(row.activo) ? 1 : 0,
        normalizeRole(row.rol),
      ]
    );

    if (email) {
      byEmail.set(email, targetId);
    }
    map.set(sourceId, targetId);
  }

  log(`  OK usuarios mapeados: ${map.size}`);
  return map;
}

async function upsertRows(targetConn, tableName, rows) {
  if (!rows.length) {
    return 0;
  }

  const columns = Object.keys(rows[0]);
  const insertSql = `
    INSERT INTO ${sqlId(tableName)} (${columns.map(sqlId).join(", ")})
    VALUES (${columns.map(() => "?").join(", ")})
    ON DUPLICATE KEY UPDATE ${columns
      .filter((column) => column !== "id")
      .map((column) => `${sqlId(column)} = VALUES(${sqlId(column)})`)
      .join(", ")}
  `;

  let count = 0;
  for (const row of rows) {
    const values = columns.map((column) =>
      row[column] === undefined ? null : row[column]
    );
    await targetConn.query(insertSql, values);
    count += 1;
  }
  return count;
}

async function copyTableData(sourceConn, targetConn, tableName, userIdMap) {
  const sourceExists = await tableExists(sourceConn, legacyConfig.database, tableName);
  const targetExists = await tableExists(targetConn, targetConfig.database, tableName);

  if (!sourceExists) {
    log(`  SKIP ${tableName}: no existe en la BD origen`);
    return 0;
  }
  if (!targetExists) {
    log(`  SKIP ${tableName}: no existe en la BD destino`);
    return 0;
  }

  const sourceColumns = await getColumns(sourceConn, legacyConfig.database, tableName);
  const targetColumns = new Set(await getColumns(targetConn, targetConfig.database, tableName));
  const commonColumns = sourceColumns.filter((column) => targetColumns.has(column));

  if (!commonColumns.length) {
    log(`  SKIP ${tableName}: sin columnas comunes`);
    return 0;
  }

  const rows = await queryRows(
    sourceConn,
    `SELECT ${commonColumns.map(sqlId).join(", ")} FROM ${sqlId(tableName)}`
  );

  const normalizedRows = rows.map((row) => rewriteUserReferences(row, userIdMap));
  const copied = await upsertRows(targetConn, tableName, normalizedRows);
  log(`  OK ${tableName}: ${copied} filas`);
  return copied;
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function copyLegacyUploads() {
  ensureDir(TARGET_UPLOADS_DIR);

  if (!fs.existsSync(LEGACY_UPLOADS_DIR)) {
    log("Uploads legacy no encontrados; se omite copia de imagenes.");
    return 0;
  }

  const files = fs
    .readdirSync(LEGACY_UPLOADS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile());

  let copied = 0;
  for (const entry of files) {
    const sourceFile = path.join(LEGACY_UPLOADS_DIR, entry.name);
    const targetFile = path.join(TARGET_UPLOADS_DIR, entry.name);
    if (!fs.existsSync(targetFile)) {
      fs.copyFileSync(sourceFile, targetFile);
      copied += 1;
    }
  }

  log(`Uploads copiados desde Informes legacy: ${copied}`);
  return copied;
}

async function importLegacyData(targetConn) {
  let sourceConn;
  try {
    sourceConn = await connect(legacyConfig);
  } catch (error) {
    log("");
    log("No fue posible conectarse a la BD legacy de Informes.");
    log(`  ${error.message}`);
    log("El esquema del modulo si quedo aplicado, pero la migracion de datos reales queda pendiente hasta tener acceso.");
    const derived = await deriveInformesCatalogFromCurrentCrm(targetConn);
    return { imported: false, derivedFromCrm: derived, reason: error.message };
  }

  try {
    const userIdMap = await buildUserIdMap(sourceConn, targetConn);

    log("");
    log("Importando tablas propias del modulo Informes...");
    await targetConn.query("SET FOREIGN_KEY_CHECKS = 0");
    for (const tableName of INFORMES_TABLES) {
      await copyTableData(sourceConn, targetConn, tableName, userIdMap);
    }
    await targetConn.query("SET FOREIGN_KEY_CHECKS = 1");

    log("");
    log("Intentando fusionar tablas compartidas utiles para CRM...");
    for (const tableName of OPTIONAL_CRM_TABLES) {
      await copyTableData(sourceConn, targetConn, tableName, userIdMap);
    }

    copyLegacyUploads();
    return { imported: true };
  } finally {
    if (sourceConn) {
      await sourceConn.end();
    }
  }
}

async function summarizeCounts(conn) {
  const summary = {};
  for (const tableName of INFORMES_TABLES) {
    if (await tableExists(conn, targetConfig.database, tableName)) {
      const rows = await queryRows(
        conn,
        `SELECT COUNT(*) AS total FROM ${sqlId(tableName)}`
      );
      summary[tableName] = Number(rows[0]?.total || 0);
    }
  }
  return summary;
}

async function main() {
  log("=== Integracion real del modulo Informes sobre CRM ===");
  log(
    `Destino: ${targetConfig.database} @ ${targetConfig.host}:${targetConfig.port}`
  );
  log(
    `Origen legacy: ${legacyConfig.database} @ ${legacyConfig.host}:${legacyConfig.port}`
  );

  let targetConn;
  try {
    targetConn = await connect(targetConfig);
    await ensureTargetSchema(targetConn);
    const importResult = await importLegacyData(targetConn);
    const counts = await summarizeCounts(targetConn);

    log("");
    log("Resumen de tablas Informes en CRM:");
    for (const [tableName, total] of Object.entries(counts)) {
      log(`  ${tableName}: ${total}`);
    }

    log("");
    if (importResult.imported) {
      log("Integracion completada: esquema, datos legacy y uploads procesados.");
    } else if (importResult.derivedFromCrm) {
      log("Integracion parcial: catalogos del modulo poblados desde datos reales del CRM actual; falta la BD legacy para historicos completos.");
    } else {
      log("Integracion parcial: esquema aplicado, pero sin datos legacy por falta de acceso a la BD origen.");
    }
  } catch (error) {
    log("");
    log(`Error durante la integracion: ${error.stack || error.message}`);
    process.exitCode = 1;
  } finally {
    if (targetConn) {
      await targetConn.end();
    }
  }
}

main();
