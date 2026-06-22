// scripts/migrate_service_tables.cjs
// Migrates services, categories and subcategories from app_state_kv to dedicated tables
// Run: node scripts/migrate_service_tables.cjs
const mariadb = require("mariadb");
require("dotenv").config();

const pool = mariadb.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "crm_jdl",
  connectionLimit: 1,
  collation: "utf8mb4_unicode_ci",
});

function truncate(val, maxLen) {
  const s = String(val || "").trim();
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen - 3) + "...";
}

async function run() {
  let conn;
  try {
    conn = await pool.getConnection();

    // 1. Ensure columns have proper size
    try {
      await conn.query("ALTER TABLE categorias_servicio MODIFY COLUMN nombre VARCHAR(200) NOT NULL");
      console.log("✅ Resized categorias_servicio.nombre to VARCHAR(200)");
    } catch (_) {}
    try {
      await conn.query("ALTER TABLE subcategorias_servicio MODIFY COLUMN nombre VARCHAR(200) NOT NULL");
      console.log("✅ Resized subcategorias_servicio.nombre to VARCHAR(200)");
    } catch (_) {}
    try {
      await conn.query("ALTER TABLE servicios MODIFY COLUMN nombre VARCHAR(300) NOT NULL");
      console.log("✅ Resized servicios.nombre to VARCHAR(300)");
    } catch (_) {}
    try {
      const cols = await conn.query(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = ? AND table_name = 'servicios' AND column_name = 'activo'`,
        [process.env.DB_NAME || "crm_jdl"]
      );
      if (cols.length === 0) {
        await conn.query("ALTER TABLE servicios ADD COLUMN activo TINYINT(1) NOT NULL DEFAULT 1");
        console.log("✅ Added 'activo' column to servicios");
      }
    } catch (err) {
      console.warn("⚠️ Could not add activo column:", err.message);
    }

    // 2. Read existing data from app_state_kv
    const kvRows = await conn.query(
      `SELECT clave, valor_json FROM app_state_kv WHERE clave IN ('serviceCategories','services')`
    );
    const kvMap = {};
    for (const row of kvRows) kvMap[row.clave] = row.valor_json;

    const categories = kvMap.serviceCategories ? JSON.parse(kvMap.serviceCategories) : [];
    const services = kvMap.services ? JSON.parse(kvMap.services) : [];

    console.log(`📦 Found ${categories.length} categories, ${services.length} services in app_state_kv`);

    if (categories.length === 0 && services.length === 0) {
      console.log("ℹ️ No data to migrate. Tables are ready.");
      return;
    }

    await conn.beginTransaction();

    // 3. Clear existing data
    await conn.query("SET FOREIGN_KEY_CHECKS = 0");
    await conn.query("DELETE FROM servicios");
    await conn.query("DELETE FROM subcategorias_servicio");
    await conn.query("DELETE FROM categorias_servicio");

    // 4. Migrate categories and subcategories
    const catIdMap = {}; // old frontend ID -> new DB auto-increment ID
    for (const cat of categories) {
      const catName = truncate(cat.name, 195);
      const result = await conn.query(
        "INSERT INTO categorias_servicio (nombre) VALUES (?)",
        [catName || "Sin nombre"]
      );
      const newId = Number(result.insertId);
      catIdMap[String(cat.id)] = newId;
      console.log(`  📁 Category: ${catName} (ID ${cat.id} → ${newId})`);

      // Migrate subcategories
      const subs = Array.isArray(cat.subcategories) ? cat.subcategories : [];
      for (const sub of subs) {
        const subName = truncate(sub.name, 195);
        const subResult = await conn.query(
          "INSERT INTO subcategorias_servicio (id_categoria, nombre) VALUES (?, ?)",
          [newId, subName || "Sin nombre"]
        );
        const newSubId = Number(subResult.insertId);
        catIdMap[`sub_${String(sub.id)}`] = { dbId: newSubId, name: subName };
      }
      const subCount = subs.length;
      if (subCount > 0) console.log(`    📂 ${subCount} subcategories migrated`);
    }

    // 5. Migrate services
    let migratedServices = 0;
    for (const svc of services) {
      const svcId = String(svc.id || `svc_${Date.now()}_${Math.random().toString(36).slice(2,7)}`);
      const svcName = truncate(svc.name, 295);

      // Map category by name
      let finalCategoriaId = null;
      const catName = String(svc.category || "General").trim();
      if (catName) {
        const catRow = await conn.query(
          "SELECT id FROM categorias_servicio WHERE nombre = ? LIMIT 1",
          [catName || "Sin nombre"]
        );
        if (catRow.length > 0) finalCategoriaId = Number(catRow[0].id);
      }

      // Map subcategory by name within this category
      let dbSubcategoriaId = null;
      const subName = String(svc.subcategory || "").trim();
      if (subName && finalCategoriaId) {
        const subRow = await conn.query(
          "SELECT id FROM subcategorias_servicio WHERE id_categoria = ? AND nombre = ? LIMIT 1",
          [finalCategoriaId, subName]
        );
        if (subRow.length > 0) dbSubcategoriaId = Number(subRow[0].id);
      }

      await conn.query(
        `INSERT INTO servicios (id, nombre, precio, descripcion, id_categoria, id_subcategoria, modo_cantidad, activo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           nombre = VALUES(nombre),
           precio = VALUES(precio),
           descripcion = VALUES(descripcion),
           id_categoria = VALUES(id_categoria),
           id_subcategoria = VALUES(id_subcategoria),
           modo_cantidad = VALUES(modo_cantidad),
           activo = VALUES(activo)`,
        [
          svcId,
          svcName || "Sin nombre",
          Number(svc.price || 0),
          String(svc.description || "").trim() || null,
          finalCategoriaId,
          dbSubcategoriaId,
          String(svc.quantityMode || "MANUAL").trim(),
          svc.active !== false ? 1 : 0,
        ]
      );
      migratedServices++;
    }

    await conn.query("SET FOREIGN_KEY_CHECKS = 1");
    await conn.commit();
    console.log(`\n✅ Migration complete!`);
    const catsMigrated = Object.keys(catIdMap).filter(k => !k.startsWith('sub_')).length;
    const subsMigrated = categories.reduce((acc, c) => acc + (c.subcategories?.length || 0), 0);
    console.log(`   - ${catsMigrated} categories`);
    console.log(`   - ${subsMigrated} subcategories`);
    console.log(`   - ${migratedServices} services`);
  } catch (error) {
    if (conn) {
      try { await conn.query("SET FOREIGN_KEY_CHECKS = 1"); } catch (_) {}
      await conn.rollback();
    }
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    if (conn) conn.release();
    await pool.end();
  }
}

run();
