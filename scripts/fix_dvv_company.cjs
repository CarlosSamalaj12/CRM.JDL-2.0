const mariadb = require('mariadb');
require('dotenv').config();

const pool = mariadb.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'crm_jdl'
});

async function fix() {
  let conn;
  try {
    conn = await pool.getConnection();
    console.log('[FIX] Verificando empresa DVV INTERNATIONAL...');

    // 1. Buscar si ya existe DVV INTERNATIONAL en empresas
    const [existingComp] = await conn.query(
      "SELECT id, nombre, encargado_principal FROM empresas WHERE LOWER(TRIM(nombre)) = 'dvv international' LIMIT 1"
    );

    let compId;
    if (existingComp) {
      compId = String(existingComp.id);
      console.log(`[FIX] Empresa existente encontrada: ID ${compId} ("${existingComp.nombre}")`);
    } else {
      compId = `cmp_dvv_intl_${Date.now()}`;
      await conn.query(
        `INSERT INTO empresas (id, nombre, encargado_principal, correo, nit, razon_social, tipo_evento, direccion, telefono, notas)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          compId,
          'DVV INTERNATIONAL',
          'ANA ZAPETA',
          'ana.zapeta@dvv-international.org',
          'CF',
          'DVV INTERNATIONAL',
          'Corporativo',
          'Ciudad',
          '54891266',
          'Registrada para desvincular colisión con BODA CLAUDIA RIOS'
        ]
      );
      console.log(`[FIX] Creada nueva empresa para DVV INTERNATIONAL: ID ${compId}`);
    }

    // 2. Actualizar cotizaciones_evento para COT-172536
    const [coti] = await conn.query(
      "SELECT id_evento, codigo, id_empresa, json_crudo FROM cotizaciones_evento WHERE codigo = 'COT-172536' OR id_evento = 'evt_f5c3dd54'"
    );

    if (coti) {
      let rawJson = {};
      try {
        rawJson = typeof coti.json_crudo === 'string' ? JSON.parse(coti.json_crudo) : (coti.json_crudo || {});
      } catch (_) {}

      rawJson.companyId = compId;
      rawJson.companyName = 'DVV INTERNATIONAL';

      await conn.query(
        "UPDATE cotizaciones_evento SET id_empresa = ?, json_crudo = ? WHERE id_evento = ?",
        [compId, JSON.stringify(rawJson), coti.id_evento]
      );
      console.log(`[FIX] Actualizado cotizaciones_evento (${coti.id_evento}): id_empresa -> ${compId}`);
    }

    // 3. Actualizar eventos (evt_f5c3dd54 y sus slots)
    const evRows = await conn.query(
      "SELECT id, nombre, cotizacion_json FROM eventos WHERE id = 'evt_f5c3dd54' OR id_grupo = 'evt_f5c3dd54' OR id LIKE 'evt_f5c3dd54%'"
    );

    for (const ev of evRows) {
      let q = {};
      try {
        q = typeof ev.cotizacion_json === 'string' ? JSON.parse(ev.cotizacion_json) : (ev.cotizacion_json || {});
      } catch (_) {}

      q.companyId = compId;
      q.companyName = 'DVV INTERNATIONAL';

      await conn.query(
        "UPDATE eventos SET cotizacion_json = ? WHERE id = ?",
        [JSON.stringify(q), ev.id]
      );
      console.log(`[FIX] Actualizado evento ${ev.id}: companyId -> ${compId}`);
    }

    console.log('[FIX] Proceso completado exitosamente.');
  } catch (err) {
    console.error('[FIX] Error:', err);
  } finally {
    if (conn) conn.release();
    await pool.end();
  }
}

fix();
