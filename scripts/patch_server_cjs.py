#!/usr/bin/env python3
"""Patch server.cjs to use real DB tables for services, categories, and subcategories."""

import re

with open("server.cjs", "r", encoding="utf-8") as f:
    content = f.read()

# ============================================================
# 1. Replace ensureServiceCatalogStructure()
# ============================================================
old_ensure = """async function ensureServiceCatalogStructure() {
  // Catalogo de servicios deshabilitado / removido.
}"""

new_ensure = """async function ensureServiceCatalogStructure() {
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
        nombre VARCHAR(200) NOT NULL,
        creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        activo TINYINT(1) NOT NULL DEFAULT 1,
        PRIMARY KEY (id),
        UNIQUE KEY uq_subcategorias_servicio (id_categoria, nombre),
        KEY idx_subcategorias_servicio_categoria (id_categoria),
        CONSTRAINT fk_subcategorias_categoria FOREIGN KEY (id_categoria) REFERENCES categorias_servicio (id) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
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
}"""

content = content.replace(old_ensure, new_ensure, 1)

# ============================================================
# 2. Replace helper functions (readCategorias... through recover...)
# ============================================================
old_helpers = """async function readCategoriasServicioFromTables() {
  return [];
}

async function readSubcategoriasServicioFromTables(categoriaId = null) {
  return [];
}

async function createCategoriaServicioInTable(nombre) {
  return { id: 1, nombre: str(nombre).trim() };
}

async function updateCategoriaServicioInTable(id, nombre) {
  return { id: Number(id), nombre: str(nombre).trim() };
}

async function createSubcategoriaServicioInTable(idCategoria, nombre) {
  return { id: 1, id_categoria: Number(idCategoria), nombre: str(nombre).trim() };
}

async function updateSubcategoriaServicioInTable(id, idCategoria, nombre) {
  return { id: Number(id), id_categoria: Number(idCategoria), nombre: str(nombre).trim() };
}

async function setCategoriaServicioActivoInTable(id, activo) {
  return { id: Number(id), activo: !!activo };
}

async function setSubcategoriaServicioActivoInTable(id, activo) {
  return { id: Number(id), activo: !!activo };
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
}"""

new_helpers = """async function readCategoriasServicioFromTables() {
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
}"""

content = content.replace(old_helpers, new_helpers, 1)

# ============================================================
# 3. Update readStateFromTables() to read from app_state_kv as fallback but read categories/services from tables
# ============================================================
# Replace the services reading section in readStateFromTables
old_services_read = """    let dbServicesList = [];
    const servicesRow = appStateRows.find((r) => String(r.clave) === "services");
    if (servicesRow?.valor_json) {
      try {
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
      } catch (_) {}
    }
    const bebidasCatalog = [];"""

new_services_read = """    let dbServicesList = [];
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
    const bebidasCatalog = [];"""

content = content.replace(old_services_read, new_services_read, 1)

# ============================================================
# 4. Replace the serviceCategories reading in readStateFromTables
# ============================================================
old_cat_read = """    const serviceCategoriesRow = appStateRows.find((r) => str(r.clave) === "serviceCategories");
    try {
      const parsed = JSON.parse(str(serviceCategoriesRow?.valor_json) || "[]");
      state.serviceCategories = Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      state.serviceCategories = [];
    }"""

new_cat_read = """    if (dbServiceCategories && dbServiceCategories.length > 0) {
      state.serviceCategories = dbServiceCategories;
    } else {
      const serviceCategoriesRow = appStateRows.find((r) => str(r.clave) === "serviceCategories");
      try {
        const parsed = JSON.parse(str(serviceCategoriesRow?.valor_json) || "[]");
        state.serviceCategories = Array.isArray(parsed) ? parsed : [];
      } catch (_) {
        state.serviceCategories = [];
      }
    }"""

content = content.replace(old_cat_read, new_cat_read, 1)

# ============================================================
# 5. Update writeStateToTables() to write services/categories to tables
# ============================================================
# Replace the app_state_kv writes for services and serviceCategories
old_svc_write = """    await conn.query(
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
    );"""

new_svc_write = """    // Write to app_state_kv (backward compat)
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
    }"""

content = content.replace(old_svc_write, new_svc_write, 1)

# ============================================================
# 6. Replace the DELETE subcategory endpoint to use the new helper
# ============================================================
old_delete_endpoint = """// ==================== ELIMINAR SUBCATEGORIA DIRECTAMENTE EN app_state_kv ====================

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
    const updated = categories.map((cat) => {
      if (String(cat.id) === catId) {
        const subs = Array.isArray(cat.subcategories) ? cat.subcategories.filter((s) => String(s.id) !== subId) : [];
        if (subs.length !== (Array.isArray(cat.subcategories) ? cat.subcategories.length : 0)) found = true;
        return { ...cat, subcategories: subs };
      }
      return cat;
    });
    if (!found) {
      return res.status(404).json({ message: "Subcategoria no encontrada." });
    }
    await conn.query(
      "INSERT INTO app_state_kv (clave, valor_json) VALUES ('serviceCategories', ?) ON DUPLICATE KEY UPDATE valor_json = VALUES(valor_json)",
      [JSON.stringify(updated)]
    );
    return res.json({ ok: true, message: "Subcategoria eliminada correctamente." });
  } catch (error) {
    console.error("Error al eliminar subcategoria:", error);
    return res.status(500).json({ message: "Error al eliminar subcategoria.", detail: error.message });
  } finally {
    if (conn) conn.release();
  }
});"""

new_delete_endpoint = """// ==================== ELIMINAR SUBCATEGORIA ====================

app.delete("/api/categorias-servicio/:catId/subcategorias/:subId", async (req, res) => {
  try {
    const result = await deleteSubcategoriaServicioFromTable(req.params.subId);
    return res.json({ ok: true, message: "Subcategoria eliminada correctamente." });
  } catch (error) {
    console.error("Error al eliminar subcategoria:", error);
    return res.status(500).json({ message: "Error al eliminar subcategoria.", detail: error.message });
  }
});"""

content = content.replace(old_delete_endpoint, new_delete_endpoint, 1)

# ============================================================
# 7. Add service CRUD endpoints (place after the DELETE subcategory endpoint)
# ============================================================
service_endpoints = """

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
});"""

# Insert service endpoints after the DELETE subcategory endpoint closing
insert_marker = "});\n\n// ==================== CATEGORY DELETE ENDPOINT"
# No, let me look for a better insertion point. I'll insert after the SUB delete endpoint that we just replaced.
# The new endpoint ends with a specific pattern
insert_after = "  }\n});\n\n// ==================== CATEGORY DELETE ENDPOINT"
# Actually, let me just append after the last delete endpoint closing. Since the new_delete_endpoint
# ends with "  }\n});" and then we want to add more routes, let me just append at a specific place.

# Let me use a different approach - find the exact location
# The new service endpoints will be added right after the DELETE subcategory route (which ends with "});")
insert_point = """  }
});"""

# Let me insert the service endpoints after the subcategory delete endpoint, which ends differently
# Actually, since I'm replacing the old one, the new one will be in the file. Let me find it by looking
# for the exact text that follows the new delete endpoint.
# I'll search for a unique text and insert after it.

# Actually, let me just look for the line after the new subcategory delete endpoint.
# The new one ends with:
#   }
# });

# And the next line in the file would be app.post("/api/service-catalog/recover"
# So let me insert between them.

old_recover_marker = """  }
});

app.post("/api/service-catalog/recover\""""

# First, check if the service endpoints were already inserted
if '"/api/servicios"' in content:
    print("Service endpoints already exist, skipping insertion.")
else:
    new_section = """  }
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

app.post("/api/service-catalog/recover\""""
    content = content.replace(old_recover_marker, new_section, 1)

# ============================================================
# Write back
# ============================================================
with open("server.cjs", "w", encoding="utf-8") as f:
    f.write(content)

print("✅ server.cjs patched successfully!")
