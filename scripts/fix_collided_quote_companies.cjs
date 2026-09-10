const mariadb = require('mariadb');
require('dotenv').config();

const pool = mariadb.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'crm_jdl'
});

function uid(prefix = 'cmp') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

async function runMigration({ dryRun = true } = {}) {
  let conn;
  try {
    conn = await pool.getConnection();
    console.log(`[MIGRATION] Starting quote company collision fix (dryRun: ${dryRun})...`);

    // 1. Get all companies currently in DB
    const dbCompanies = await conn.query("SELECT id, nombre, encargado_principal FROM empresas");
    const companyByName = new Map();
    const companyById = new Map();
    for (const c of dbCompanies) {
      companyById.set(String(c.id).trim(), c);
      if (c.nombre) {
        companyByName.set(String(c.nombre).trim().toLowerCase(), c);
      }
    }

    // 2. Get events with quotes
    const events = await conn.query("SELECT id, id_grupo, nombre, cotizacion_json FROM eventos WHERE cotizacion_json IS NOT NULL");
    console.log(`[MIGRATION] Total events with quote: ${events.length}`);

    let fixedCount = 0;
    let skippedCount = 0;
    const createdCompanies = new Map(); // nameLower -> companyId

    for (const ev of events) {
      let q;
      try {
        q = JSON.parse(ev.cotizacion_json);
      } catch (_) {
        continue;
      }

      if (!q || typeof q !== 'object') continue;

      const rawCompId = String(q.companyId || '').trim();
      const rawCompName = String(q.companyName || '').trim();
      const rawContact = String(q.contact || q.managerName || '').trim();

      if (!rawCompName) {
        skippedCount++;
        continue;
      }

      // Check if the assigned companyId in the catalog matches the quote company name
      const catalogCompany = companyById.get(rawCompId);
      const catalogName = catalogCompany ? String(catalogCompany.nombre || '').trim() : '';

      // Problem condition:
      // 1) The companyId is 10, 100, 1000 or any ID where the catalog company name is completely different from the quote companyName.
      // (e.g. quote is "CONSTRUCCIONES FACILES S.A." but catalog company 10 is "60 AÑOS MIRNA CANO")
      const isMismatch = catalogCompany && rawCompName.toLowerCase() !== catalogName.toLowerCase();
      const isSuspectId = ['10', '100', '1000', '0'].includes(rawCompId) && isMismatch;
      const isOrphan = rawCompId && !catalogCompany;

      if (!isMismatch && !isSuspectId && !isOrphan) {
        skippedCount++;
        continue;
      }

      fixedCount++;
      const nameKey = rawCompName.toLowerCase();
      let targetCompanyId = createdCompanies.get(nameKey) || (companyByName.get(nameKey)?.id);

      if (!targetCompanyId) {
        targetCompanyId = `cmp_leg_${ev.id.replace(/[^a-zA-Z0-9_]/g, '')}`.slice(0, 45);
        createdCompanies.set(nameKey, targetCompanyId);

        if (!dryRun) {
          await conn.query(
            `INSERT INTO empresas (id, nombre, encargado_principal, correo, nit, razon_social, tipo_evento, direccion, telefono, notas)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE nombre = VALUES(nombre)`,
            [
              targetCompanyId,
              rawCompName,
              rawContact || null,
              q.email || null,
              q.nit || 'CF',
              q.billTo || rawCompName,
              q.eventType || 'Social',
              q.address || null,
              q.phone || null,
              'Migrado automáticamente para desvincular colisión de ID'
            ]
          );

          // Insert manager if contact name exists
          if (rawContact) {
            const targetMgrId = q.managerId && !String(q.managerId).startsWith('10') ? q.managerId : `mgr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
            await conn.query(
              `INSERT INTO encargados_empresa (id, id_empresa, nombre, telefono, correo, direccion)
               VALUES (?, ?, ?, ?, ?, ?)
               ON DUPLICATE KEY UPDATE nombre = VALUES(nombre)`,
              [
                targetMgrId,
                targetCompanyId,
                rawContact,
                q.phone || null,
                q.email || null,
                q.address || null
              ]
            );
            q.managerId = targetMgrId;
          }
        }
      }

      if (fixedCount <= 10 || fixedCount % 50 === 0) {
        console.log(`[MIGRATION] Event ${ev.id} ("${ev.nombre}"): compId "${rawCompId}" (${catalogName || 'NO CATALOG'}) -> "${targetCompanyId}" ("${rawCompName}"), contact: "${rawContact}"`);
      }

      if (!dryRun) {
        q.companyId = targetCompanyId;
        q.managerName = rawContact || q.managerName || '';
        q.contact = rawContact || q.contact || '';
        const updatedJson = JSON.stringify(q);

        await conn.query("UPDATE eventos SET cotizacion_json = ? WHERE id = ?", [updatedJson, ev.id]);

        // Also update cotizaciones_evento if exists
        await conn.query(
          `UPDATE cotizaciones_evento
           SET id_empresa = ?, nombre_empresa = ?, nombre_encargado = ?, contacto = ?
           WHERE id_evento = ?`,
          [targetCompanyId, rawCompName, rawContact || null, rawContact || null, ev.id]
        );
      }
    }

    console.log(`\n[MIGRATION] Completed! Fixed: ${fixedCount}, Skipped: ${skippedCount}, New companies registered: ${createdCompanies.size}`);
    conn.release();
  } catch (err) {
    console.error('[MIGRATION ERROR]', err);
  } finally {
    process.exit(0);
  }
}

const isExecute = process.argv.includes('--execute');
runMigration({ dryRun: !isExecute });
