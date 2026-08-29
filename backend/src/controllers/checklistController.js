import pool from '../config/db.js';

// ─── Helpers ────────────────────────────────────────────────
function str(v) { return v == null ? '' : String(v); }
function num(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }
function normId(id) { return String(id || '').trim(); }
function isAdminLike(rol) {
  const r = String(rol || '').trim().toLowerCase();
  return r === 'admin';
}

function buildTplFromRow(tplRow, secciones, itemsBySec) {
  return {
    id: num(tplRow.id),
    nombre: str(tplRow.nombre),
    active: Number(tplRow.activo) === 1,
    creadoPorId: tplRow.creado_por_id || null,
    creadoEn: tplRow.creado_en || null,
    actualizadoEn: tplRow.actualizado_en || null,
    sections: secciones
      .filter(s => num(s.plantilla_id) === num(tplRow.id))
      .sort((a, b) => (a.orden || 0) - (b.orden || 0))
      .map(s => ({
        id: num(s.id),
        name: str(s.nombre),
        type: str(s.tipo),
        orden: num(s.orden) || 0,
        items: (itemsBySec.get(num(s.id)) || [])
          .slice()
          .sort((a, b) => (a.orden || 0) - (b.orden || 0))
          .map(it => ({
            id: num(it.id),
            text: str(it.texto),
            type: it.tipo || undefined,
            orden: num(it.orden) || 0,
          })),
      })),
  };
}

// ─── GET /api/checklist/plantillas ──────────────────────────
export async function getPlantillas(req, res, next) {
  try {
    const includeInactive = String(req.query.includeInactive || '').toLowerCase() === 'true';
    const where = includeInactive ? '' : 'WHERE activo = 1';
    const [tpls] = await pool.query(`SELECT * FROM checklist_plantillas ${where} ORDER BY id`);
    if (!tpls.length) return res.json([]);
    const ids = tpls.map(t => t.id);
    const [secciones] = await pool.query(
      `SELECT * FROM checklist_plantilla_secciones WHERE plantilla_id IN (?) ORDER BY plantilla_id, orden, id`,
      [ids]
    );
    const secIds = secciones.map(s => s.id);
    let items = [];
    if (secIds.length) {
      [items] = await pool.query(
        `SELECT * FROM checklist_plantilla_items WHERE seccion_id IN (?) ORDER BY seccion_id, orden, id`,
        [secIds]
      );
    }
    const itemsBySec = new Map();
    for (const it of items) {
      const k = num(it.seccion_id);
      if (!itemsBySec.has(k)) itemsBySec.set(k, []);
      itemsBySec.get(k).push(it);
    }
    return res.json(tpls.map(t => buildTplFromRow(t, secciones, itemsBySec)));
  } catch (err) { next(err); }
}

// ─── GET /api/checklist/plantillas/:id ──────────────────────
export async function getPlantilla(req, res, next) {
  try {
    const id = num(req.params.id);
    if (!id) return res.status(400).json({ message: 'id requerido' });
    const [tpls] = await pool.query('SELECT * FROM checklist_plantillas WHERE id = ?', [id]);
    if (!tpls.length) return res.status(404).json({ message: 'Plantilla no encontrada' });
    const [secciones] = await pool.query(
      'SELECT * FROM checklist_plantilla_secciones WHERE plantilla_id = ? ORDER BY orden, id',
      [id]
    );
    const secIds = secciones.map(s => s.id);
    let items = [];
    if (secIds.length) {
      [items] = await pool.query(
        'SELECT * FROM checklist_plantilla_items WHERE seccion_id IN (?) ORDER BY orden, id',
        [secIds]
      );
    }
    const itemsBySec = new Map();
    for (const it of items) {
      const k = num(it.seccion_id);
      if (!itemsBySec.has(k)) itemsBySec.set(k, []);
      itemsBySec.get(k).push(it);
    }
    return res.json(buildTplFromRow(tpls[0], secciones, itemsBySec));
  } catch (err) { next(err); }
}

// ─── POST /api/checklist/plantillas ─────────────────────────
// Body: { nombre, activo?, secciones: [{ nombre, tipo, orden, items: [{ texto, tipo, orden }] }] }
export async function createPlantilla(req, res, next) {
  let conn;
  try {
    if (!isAdminLike(req.user?.rol)) {
      return res.status(403).json({ message: 'Solo administradores pueden crear plantillas' });
    }
    const { nombre, activo, secciones } = req.body || {};
    const name = str(nombre).trim();
    if (!name) return res.status(400).json({ message: 'nombre requerido' });
    const secs = Array.isArray(secciones) ? secciones : [];

    conn = await pool.getConnection();
    await conn.beginTransaction();
    const [tplRes] = await conn.query(
      'INSERT INTO checklist_plantillas (nombre, activo, creado_por_id) VALUES (?, ?, ?)',
      [name, activo === false ? 0 : 1, req.user?.id || null]
    );
    const tplId = tplRes.insertId;
    for (let s = 0; s < secs.length; s++) {
      const sec = secs[s] || {};
      const [secRes] = await conn.query(
        'INSERT INTO checklist_plantilla_secciones (plantilla_id, nombre, tipo, orden) VALUES (?, ?, ?, ?)',
        [tplId, str(sec.nombre).trim() || 'Sin nombre', str(sec.tipo) === 'evaluacion' ? 'evaluacion' : 'operativa', num(sec.orden) ?? s]
      );
      const secId = secRes.insertId;
      const items = Array.isArray(sec.items) ? sec.items : [];
      for (let i = 0; i < items.length; i++) {
        const it = items[i] || {};
        await conn.query(
          'INSERT INTO checklist_plantilla_items (seccion_id, texto, tipo, orden) VALUES (?, ?, ?, ?)',
          [secId, str(it.text || it.texto).trim() || 'Sin texto', it.tipo || null, num(it.orden) ?? i]
        );
      }
    }
    await conn.commit();
    return res.status(201).json(await fetchPlantillaCompleta(conn, tplId));
  } catch (err) {
    if (conn) {
      try { await conn.rollback(); } catch (_) {}
    }
    next(err);
  } finally {
    if (conn) conn.release();
  }
}

// ─── PUT /api/checklist/plantillas/:id ──────────────────────
export async function updatePlantilla(req, res, next) {
  let conn;
  try {
    if (!isAdminLike(req.user?.rol)) {
      return res.status(403).json({ message: 'Solo administradores pueden actualizar plantillas' });
    }
    const id = num(req.params.id);
    if (!id) return res.status(400).json({ message: 'id requerido' });
    const { nombre, activo, secciones } = req.body || {};
    const name = str(nombre).trim();
    if (!name) return res.status(400).json({ message: 'nombre requerido' });
    const secs = Array.isArray(secciones) ? secciones : [];

    conn = await pool.getConnection();
    await conn.beginTransaction();
    const [exists] = await conn.query('SELECT id FROM checklist_plantillas WHERE id = ?', [id]);
    if (!exists.length) {
      await conn.rollback();
      return res.status(404).json({ message: 'Plantilla no encontrada' });
    }
    await conn.query(
      'UPDATE checklist_plantillas SET nombre = ?, activo = ? WHERE id = ?',
      [name, activo === false ? 0 : 1, id]
    );
    // CASCADE borra secciones e items antiguos
    await conn.query('DELETE FROM checklist_plantilla_secciones WHERE plantilla_id = ?', [id]);
    for (let s = 0; s < secs.length; s++) {
      const sec = secs[s] || {};
      const [secRes] = await conn.query(
        'INSERT INTO checklist_plantilla_secciones (plantilla_id, nombre, tipo, orden) VALUES (?, ?, ?, ?)',
        [id, str(sec.nombre).trim() || 'Sin nombre', str(sec.tipo) === 'evaluacion' ? 'evaluacion' : 'operativa', num(sec.orden) ?? s]
      );
      const secId = secRes.insertId;
      const items = Array.isArray(sec.items) ? sec.items : [];
      for (let i = 0; i < items.length; i++) {
        const it = items[i] || {};
        await conn.query(
          'INSERT INTO checklist_plantilla_items (seccion_id, texto, tipo, orden) VALUES (?, ?, ?, ?)',
          [secId, str(it.text || it.texto).trim() || 'Sin texto', it.tipo || null, num(it.orden) ?? i]
        );
      }
    }
    await conn.commit();
    return res.json(await fetchPlantillaCompleta(conn, id));
  } catch (err) {
    if (conn) {
      try { await conn.rollback(); } catch (_) {}
    }
    next(err);
  } finally {
    if (conn) conn.release();
  }
}

// Helper: re-fetch plantilla completa
async function fetchPlantillaCompleta(conn, id) {
  const [tpls] = await conn.query('SELECT * FROM checklist_plantillas WHERE id = ?', [id]);
  if (!tpls.length) return null;
  const [secciones] = await conn.query(
    'SELECT * FROM checklist_plantilla_secciones WHERE plantilla_id = ? ORDER BY orden, id',
    [id]
  );
  const secIds = secciones.map(s => s.id);
  let items = [];
  if (secIds.length) {
    [items] = await conn.query(
      'SELECT * FROM checklist_plantilla_items WHERE seccion_id IN (?) ORDER BY orden, id',
      [secIds]
    );
  }
  const itemsBySec = new Map();
  for (const it of items) {
    const k = num(it.seccion_id);
    if (!itemsBySec.has(k)) itemsBySec.set(k, []);
    itemsBySec.get(k).push(it);
  }
  return buildTplFromRow(tpls[0], secciones, itemsBySec);
}

// ─── PATCH /api/checklist/plantillas/:id/activo ──────────────
export async function setPlantillaActivo(req, res, next) {
  try {
    if (!isAdminLike(req.user?.rol)) {
      return res.status(403).json({ message: 'Solo administradores' });
    }
    const id = num(req.params.id);
    if (!id) return res.status(400).json({ message: 'id requerido' });
    const { activo } = req.body || {};
    const [resu] = await pool.query(
      'UPDATE checklist_plantillas SET activo = ? WHERE id = ?',
      [activo === false ? 0 : 1, id]
    );
    if (!resu.affectedRows) return res.status(404).json({ message: 'Plantilla no encontrada' });
    return res.json({ ok: true, id, activo: activo !== false });
  } catch (err) { next(err); }
}

// ─── DELETE /api/checklist/plantillas/:id ───────────────────
export async function deletePlantilla(req, res, next) {
  try {
    if (!isAdminLike(req.user?.rol)) {
      return res.status(403).json({ message: 'Solo administradores' });
    }
    const id = num(req.params.id);
    if (!id) return res.status(400).json({ message: 'id requerido' });
    const [resu] = await pool.query('DELETE FROM checklist_plantillas WHERE id = ?', [id]);
    if (!resu.affectedRows) return res.status(404).json({ message: 'Plantilla no encontrada' });
    return res.json({ ok: true, deleted: id });
  } catch (err) { next(err); }
}

// ─── GET /api/checklist/eventos/:eventoId ───────────────────
export async function getEvento(req, res, next) {
  try {
    const eventoId = normId(req.params.eventoId);
    if (!eventoId) return res.status(400).json({ message: 'eventoId requerido' });
    const [rows] = await pool.query(
      'SELECT * FROM checklist_eventos WHERE evento_id = ?',
      [eventoId]
    );
    const tabs = { operativa: null, evaluacion: null };
    for (const ce of rows) {
      const tab = ce.tab;
      if (tab !== 'operativa' && tab !== 'evaluacion') continue;
      const [items] = await pool.query(
        'SELECT * FROM checklist_evento_items WHERE checklist_evento_id = ? ORDER BY id',
        [ce.id]
      );
      tabs[tab] = {
        checklistEventoId: num(ce.id),
        plantillaId: num(ce.plantilla_id),
        notas: ce.notas || '',
        items: items.map(it => ({
          id: num(it.id),
          itemId: num(it.item_id),
          text: str(it.texto_snapshot),
          sectionName: str(it.seccion_nombre_snapshot),
          sectionType: str(it.seccion_tipo_snapshot),
          type: it.tipo_snapshot || undefined,
          status: it.status || null,
          rating: it.rating || null,
          comment: it.comentario || '',
        })),
        actualizadoEn: ce.actualizado_en || null,
      };
    }
    return res.json(tabs);
  } catch (err) { next(err); }
}

// ─── PUT /api/checklist/eventos/:eventoId/:tab ─────────────
// Body: { plantillaId, notas, items: [{itemId, status, rating, comentario}] }
export async function saveEventoTab(req, res, next) {
  let conn;
  try {
    const eventoId = normId(req.params.eventoId);
    const tab = str(req.params.tab);
    if (!eventoId) return res.status(400).json({ message: 'eventoId requerido' });
    if (tab !== 'operativa' && tab !== 'evaluacion') {
      return res.status(400).json({ message: 'tab debe ser operativa o evaluacion' });
    }
    const { plantillaId, notas, items } = req.body || {};
    const userId = req.user?.id || null;

    conn = await pool.getConnection();
    await conn.beginTransaction();

    // UPSERT checklist_eventos
    const [ceRows] = await conn.query(
      'SELECT id FROM checklist_eventos WHERE evento_id = ? AND tab = ? FOR UPDATE',
      [eventoId, tab]
    );
    let ceId;
    if (ceRows.length) {
      ceId = ceRows[0].id;
      await conn.query(
        'UPDATE checklist_eventos SET plantilla_id = ?, notas = ?, actualizado_por_id = ? WHERE id = ?',
        [num(plantillaId), notas || null, userId, ceId]
      );
    } else {
      const [ins] = await conn.query(
        'INSERT INTO checklist_eventos (evento_id, tab, plantilla_id, notas, actualizado_por_id) VALUES (?, ?, ?, ?, ?)',
        [eventoId, tab, num(plantillaId), notas || null, userId]
      );
      ceId = ins.insertId;
    }

    // Historial a nivel de tab
    await conn.query(
      `INSERT INTO checklist_evento_historial
         (checklist_evento_id, evento_id, usuario_id, usuario_nombre, accion, cambios_json)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [ceId, eventoId, userId, req.user?.nombre || req.user?.fullName || null,
       'tab_guardada', JSON.stringify({ plantillaId: num(plantillaId), notas: notas || null })]
    );

    // UPSERT items
    const incoming = Array.isArray(items) ? items : [];
    for (const raw of incoming) {
      const itemId = num(raw.itemId);
      if (!itemId) continue;
      // Traer el item de la plantilla para snapshot si existe
      const [tplItemRows] = await conn.query(
        'SELECT texto, tipo FROM checklist_plantilla_items WHERE id = ?',
        [itemId]
      );
      // Traer la sección de la plantilla
      const [tplSecRows] = itemId
        ? await conn.query(
            `SELECT s.nombre, s.tipo FROM checklist_plantilla_items i
               JOIN checklist_plantilla_secciones s ON s.id = i.seccion_id
              WHERE i.id = ?`,
            [itemId]
          )
        : [[]];
      const secNombre = tplSecRows[0]?.nombre || '';
      const secTipo = tplSecRows[0]?.tipo || tab;
      const itemTexto = tplItemRows[0]?.texto || '';
      const itemTipo = tplItemRows[0]?.tipo || null;

      // Estado previo
      const [prevRows] = await conn.query(
        'SELECT id, status, rating, comentario FROM checklist_evento_items WHERE checklist_evento_id = ? AND item_id = ?',
        [ceId, itemId]
      );
      const prev = prevRows[0] || null;
      const nextStatus = tab === 'operativa' ? (raw.status === 'cumplido' ? 'cumplido' : 'pendiente') : null;
      const nextRating = tab === 'evaluacion' ? (raw.rating || null) : null;
      const nextComment = raw.comentario || null;

      if (prev) {
        await conn.query(
          `UPDATE checklist_evento_items
             SET status = ?, rating = ?, comentario = ?, actualizado_por_id = ?,
                 texto_snapshot = ?, seccion_nombre_snapshot = ?, seccion_tipo_snapshot = ?, tipo_snapshot = ?
           WHERE id = ?`,
          [nextStatus, nextRating, nextComment, userId, itemTexto, secNombre, secTipo, itemTipo, prev.id]
        );
        // Historial granular por cambio
        if ((prev.status || null) !== (nextStatus || null)) {
          await conn.query(
            `INSERT INTO checklist_evento_historial
               (checklist_evento_id, checklist_evento_item_id, evento_id, usuario_id, usuario_nombre, accion, cambios_json)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [ceId, prev.id, eventoId, userId, req.user?.nombre || req.user?.fullName || null,
             'item_status', JSON.stringify({ antes: prev.status || null, despues: nextStatus || null })]
          );
        }
        if ((prev.rating || null) !== (nextRating || null)) {
          await conn.query(
            `INSERT INTO checklist_evento_historial
               (checklist_evento_id, checklist_evento_item_id, evento_id, usuario_id, usuario_nombre, accion, cambios_json)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [ceId, prev.id, eventoId, userId, req.user?.nombre || req.user?.fullName || null,
             'item_rating', JSON.stringify({ antes: prev.rating || null, despues: nextRating || null })]
          );
        }
        if ((prev.comentario || null) !== (nextComment || null)) {
          await conn.query(
            `INSERT INTO checklist_evento_historial
               (checklist_evento_id, checklist_evento_item_id, evento_id, usuario_id, usuario_nombre, accion, cambios_json)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [ceId, prev.id, eventoId, userId, req.user?.nombre || req.user?.fullName || null,
             'item_comentario', JSON.stringify({ antes: prev.comentario || null, despues: nextComment || null })]
          );
        }
      } else {
        const [ins] = await conn.query(
          `INSERT INTO checklist_evento_items
             (checklist_evento_id, item_id, texto_snapshot, seccion_nombre_snapshot, seccion_tipo_snapshot, tipo_snapshot, status, rating, comentario, actualizado_por_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [ceId, itemId, itemTexto, secNombre, secTipo, itemTipo, nextStatus, nextRating, nextComment, userId]
        );
        await conn.query(
          `INSERT INTO checklist_evento_historial
             (checklist_evento_id, checklist_evento_item_id, evento_id, usuario_id, usuario_nombre, accion, cambios_json)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [ceId, ins.insertId, eventoId, userId, req.user?.nombre || req.user?.fullName || null,
           'snapshot_creado', JSON.stringify({ status: nextStatus, rating: nextRating })]
        );
      }
    }
    await conn.commit();

    // Responder con el estado actual del tab
    const [reRows] = await pool.query(
      'SELECT * FROM checklist_eventos WHERE id = ?',
      [ceId]
    );
    const [itemRows] = await pool.query(
      'SELECT * FROM checklist_evento_items WHERE checklist_evento_id = ? ORDER BY id',
      [ceId]
    );
    return res.json({
      checklistEventoId: num(ceId),
      plantillaId: num(reRows[0]?.plantilla_id),
      notas: reRows[0]?.notas || '',
      items: itemRows.map(it => ({
        id: num(it.id),
        itemId: num(it.item_id),
        text: str(it.texto_snapshot),
        sectionName: str(it.seccion_nombre_snapshot),
        sectionType: str(it.seccion_tipo_snapshot),
        type: it.tipo_snapshot || undefined,
        status: it.status || null,
        rating: it.rating || null,
        comment: it.comentario || '',
      })),
    });
  } catch (err) {
    if (conn) {
      try { await conn.rollback(); } catch (_) {}
    }
    next(err);
  } finally {
    if (conn) conn.release();
  }
}

// ─── GET /api/checklist/eventos/:eventoId/historial ────────
export async function getHistorial(req, res, next) {
  try {
    const eventoId = normId(req.params.eventoId);
    if (!eventoId) return res.status(400).json({ message: 'eventoId requerido' });
    const limit = Math.max(1, Math.min(500, num(req.query.limit) || 100));
    const tab = str(req.query.tab);
    const tabFilter = (tab === 'operativa' || tab === 'evaluacion') ? 'AND ce.tab = ?' : '';
    const params = [eventoId];
    if (tabFilter) params.push(tab);
    params.push(limit);
    const [rows] = await pool.query(
      `SELECT h.*, ce.tab
         FROM checklist_evento_historial h
         JOIN checklist_eventos ce ON ce.id = h.checklist_evento_id
        WHERE h.evento_id = ? ${tabFilter}
        ORDER BY h.creado_en DESC
        LIMIT ?`,
      params
    );
    return res.json(rows.map(r => ({
      id: num(r.id),
      checklistEventoId: num(r.checklist_evento_id),
      checklistEventoItemId: num(r.checklist_evento_item_id),
      eventoId: r.evento_id,
      tab: r.tab,
      usuarioId: r.usuario_id,
      usuarioNombre: r.usuario_nombre,
      accion: r.accion,
      cambios: r.cambios_json ? safeParse(r.cambios_json) : null,
      creadoEn: r.creado_en,
    })));
  } catch (err) { next(err); }
}

function safeParse(s) {
  if (typeof s === 'object') return s;
  try { return JSON.parse(s); } catch (_) { return null; }
}

// ─── GET /api/checklist/snapshot ────────────────────────────
// Devuelve el shape key-value actual (usado por los reportes que aún leen del state)
export async function getSnapshot(req, res, next) {
  try {
    const tpls = await getPlantillasRaw();
    const sections = tpls.flatMap(t => t.sections.map(s => ({ nombre: s.name, tipo: s.type })));
    const sectionNames = [...new Set(sections.map(s => s.nombre))].filter(Boolean);
    const itemsFlat = tpls.flatMap(t => t.sections.flatMap(s => s.items.map(i => ({ id: i.id, text: i.text, type: i.type, section: s.name, sectionType: s.type }))));
    const eventChecklists = await getEventChecklistsRaw();
    return res.json({
      checklistTemplates: tpls.map(t => ({ id: t.id, name: t.nombre, active: t.active, sections: t.sections })),
      checklistTemplateItems: itemsFlat,
      checklistTemplateSections: sectionNames.length ? sectionNames : ['General'],
      eventChecklists,
    });
  } catch (err) { next(err); }
}

async function getPlantillasRaw() {
  const [tpls] = await pool.query('SELECT * FROM checklist_plantillas ORDER BY id');
  if (!tpls.length) return [];
  const ids = tpls.map(t => t.id);
  const [secciones] = await pool.query(
    'SELECT * FROM checklist_plantilla_secciones WHERE plantilla_id IN (?) ORDER BY plantilla_id, orden, id',
    [ids]
  );
  const secIds = secciones.map(s => s.id);
  let items = [];
  if (secIds.length) {
    [items] = await pool.query(
      'SELECT * FROM checklist_plantilla_items WHERE seccion_id IN (?) ORDER BY seccion_id, orden, id',
      [secIds]
    );
  }
  const itemsBySec = new Map();
  for (const it of items) {
    const k = num(it.seccion_id);
    if (!itemsBySec.has(k)) itemsBySec.set(k, []);
    itemsBySec.get(k).push(it);
  }
  return tpls.map(t => buildTplFromRow(t, secciones, itemsBySec));
}

async function getEventChecklistsRaw() {
  const [rows] = await pool.query('SELECT * FROM checklist_eventos ORDER BY id');
  const result = {};
  for (const ce of rows) {
    const eventoId = ce.evento_id;
    if (!result[eventoId]) result[eventoId] = {};
    const [items] = await pool.query(
      'SELECT * FROM checklist_evento_items WHERE checklist_evento_id = ? ORDER BY id',
      [ce.id]
    );
    const [history] = await pool.query(
      'SELECT * FROM checklist_evento_historial WHERE checklist_evento_id = ? AND checklist_evento_item_id IS NULL ORDER BY creado_en',
      [ce.id]
    );
    result[eventoId][ce.tab] = {
      templateId: num(ce.plantilla_id),
      notes: ce.notas || '',
      items: items.map(it => ({
        id: num(it.item_id),
        text: str(it.texto_snapshot),
        sectionName: str(it.seccion_nombre_snapshot),
        sectionType: str(it.seccion_tipo_snapshot),
        type: it.tipo_snapshot || undefined,
        status: it.status || null,
        rating: it.rating || null,
        comment: it.comentario || '',
      })),
      history: history.map(h => ({
        at: h.creado_en,
        userId: h.usuario_id,
        userName: h.usuario_nombre,
        changes: h.cambios_json ? safeParse(h.cambios_json) : null,
      })),
    };
  }
  return result;
}

// ─── POST /api/checklist/migrar ─────────────────────────────
// Lee las 4 claves de app_state_kv y las inserta en las tablas nuevas.
// Idempotente: si ya hay datos, no duplica.
export async function migrate(req, res, next) {
  let conn;
  try {
    if (!isAdminLike(req.user?.rol)) {
      return res.status(403).json({ message: 'Solo administradores' });
    }
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [kvRows] = await conn.query(
      `SELECT clave, valor_json FROM app_state_kv
        WHERE clave IN ('checklistTemplates','checklistTemplateItems','checklistTemplateSections','eventChecklists')`
    );
    const kv = {};
    for (const r of kvRows) {
      try { kv[r.clave] = JSON.parse(str(r.valor_json)); } catch (_) { kv[r.clave] = null; }
    }
    const plantillasRaw = Array.isArray(kv.checklistTemplates) ? kv.checklistTemplates : [];
    const eventChecklistsRaw = (kv.eventChecklists && typeof kv.eventChecklists === 'object') ? kv.eventChecklists : {};

    // Mapear IDs antiguos a nuevos IDs
    const tplIdMap = new Map();
    let tplsCreated = 0;
    let secsCreated = 0;
    let itemsCreated = 0;

    // Primero: cargar plantillas existentes para evitar duplicados
    const [existingTpls] = await conn.query('SELECT id, nombre FROM checklist_plantillas');
    const existingTplByName = new Map();
    for (const t of existingTpls) existingTplByName.set(str(t.nombre), num(t.id));

    for (const oldTpl of plantillasRaw) {
      const oldId = num(oldTpl.id);
      const nombre = str(oldTpl.name).trim();
      if (!nombre) continue;
      let tplId = existingTplByName.get(nombre);
      if (!tplId) {
        const [ins] = await conn.query(
          'INSERT INTO checklist_plantillas (nombre, activo) VALUES (?, ?)',
          [nombre, oldTpl.active === false ? 0 : 1]
        );
        tplId = num(ins.insertId);
        existingTplByName.set(nombre, tplId);
        tplsCreated++;
      }
      tplIdMap.set(oldId, tplId);

      const oldSections = Array.isArray(oldTpl.sections) ? oldTpl.sections : [];
      const oldItemIdMap = new Map();
      // Cargar secciones existentes de esta plantilla
      const [existingSecs] = await conn.query(
        'SELECT id, nombre FROM checklist_plantilla_secciones WHERE plantilla_id = ?',
        [tplId]
      );
      const existingSecByName = new Map();
      for (const s of existingSecs) existingSecByName.set(str(s.nombre), num(s.id));
      for (const oldSec of oldSections) {
        const secOldId = num(oldSec.id);
        const secNombre = str(oldSec.name).trim() || 'Sin nombre';
        let secId = existingSecByName.get(secNombre);
        if (!secId) {
          const [ins] = await conn.query(
            'INSERT INTO checklist_plantilla_secciones (plantilla_id, nombre, tipo, orden) VALUES (?, ?, ?, ?)',
            [tplId, secNombre, str(oldSec.type) === 'evaluacion' ? 'evaluacion' : 'operativa', num(oldSec.orden) ?? 0]
          );
          secId = num(ins.insertId);
          existingSecByName.set(secNombre, secId);
          secsCreated++;
        }
        // Cargar items existentes en esta sección
        const [existingItems] = await conn.query(
          'SELECT id, texto FROM checklist_plantilla_items WHERE seccion_id = ?',
          [secId]
        );
        const existingItemByText = new Map();
        for (const i of existingItems) existingItemByText.set(str(i.texto), num(i.id));
        const oldItems = Array.isArray(oldSec.items) ? oldSec.items : [];
        for (const oldItem of oldItems) {
          const itemOldId = num(oldItem.id);
          const itemTexto = str(oldItem.text).trim() || 'Sin texto';
          let itemId = existingItemByText.get(itemTexto);
          if (!itemId) {
            const [ins] = await conn.query(
              'INSERT INTO checklist_plantilla_items (seccion_id, texto, tipo, orden) VALUES (?, ?, ?, ?)',
              [secId, itemTexto, oldItem.type || null, num(oldItem.orden) ?? 0]
            );
            itemId = num(ins.insertId);
            existingItemByText.set(itemTexto, itemId);
            itemsCreated++;
          }
          oldItemIdMap.set(itemOldId, itemId);
        }
      }
    }

    // Ahora migrar las respuestas de eventos
    let eventsCreated = 0;
    let eventItemsCreated = 0;
    for (const [eventoIdStr, eventoData] of Object.entries(eventChecklistsRaw)) {
      if (!eventoData || typeof eventoData !== 'object') continue;
      for (const tab of ['operativa', 'evaluacion']) {
        const tabData = eventoData[tab];
        if (!tabData || typeof tabData !== 'object') continue;
        const tplNewId = num(tabData.templateId) ? tplIdMap.get(num(tabData.templateId)) : null;
        const notas = tabData.notes || null;
        const [ceIns] = await conn.query(
          'INSERT INTO checklist_eventos (evento_id, tab, plantilla_id, notas) VALUES (?, ?, ?, ?)',
          [eventoIdStr, tab, tplNewId, notas]
        );
        const ceId = num(ceIns.insertId);
        eventsCreated++;

        // Historial a nivel de tab
        await conn.query(
          `INSERT INTO checklist_evento_historial
             (checklist_evento_id, evento_id, accion, cambios_json)
           VALUES (?, ?, ?, ?)`,
          [ceId, eventoIdStr, 'tab_guardada', JSON.stringify({ origen: 'migracion_inicial' })]
        );

        const items = Array.isArray(tabData.items) ? tabData.items : [];
        for (const oldItem of items) {
          const oldItemId = num(oldItem.id);
          const newItemId = oldItemIdMap.get(oldItemId);
          if (!newItemId) {
            // El item no está en la plantilla migrada: crear item huérfano con snapshot
            const secNombre = str(oldItem.sectionName).trim() || 'General';
            const secTipo = str(oldItem.sectionType) === 'evaluacion' ? 'evaluacion' : 'operativa';
            const itemTexto = str(oldItem.text).trim() || 'Sin texto';
            const itemTipo = oldItem.type || null;
            await conn.query(
              `INSERT INTO checklist_evento_items
                 (checklist_evento_id, item_id, texto_snapshot, seccion_nombre_snapshot, seccion_tipo_snapshot, tipo_snapshot, status, rating, comentario)
               VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?)`,
              [ceId, itemTexto, secNombre, secTipo, itemTipo,
               tab === 'operativa' ? (oldItem.status || 'pendiente') : null,
               tab === 'evaluacion' ? (oldItem.rating || null) : null,
               oldItem.comment || null]
            );
          } else {
            const status = tab === 'operativa' ? (oldItem.status || 'pendiente') : null;
            const rating = tab === 'evaluacion' ? (oldItem.rating || null) : null;
            const comentario = oldItem.comment || null;
            await conn.query(
              `INSERT INTO checklist_evento_items
                 (checklist_evento_id, item_id, texto_snapshot, seccion_nombre_snapshot, seccion_tipo_snapshot, tipo_snapshot, status, rating, comentario)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [ceId, newItemId,
               str(oldItem.text).trim() || 'Sin texto',
               str(oldItem.sectionName).trim() || 'General',
               str(oldItem.sectionType) === 'evaluacion' ? 'evaluacion' : 'operativa',
               oldItem.type || null,
               status, rating, comentario]
            );
          }
          eventItemsCreated++;
        }
      }
    }
    await conn.commit();
    return res.json({
      ok: true,
      migrated: {
        plantillasCreadas: tplsCreated,
        seccionesCreadas: secsCreated,
        itemsCreados: itemsCreated,
        eventosCreados: eventsCreated,
        eventoItemsCreados: eventItemsCreated,
      },
    });
  } catch (err) {
    if (conn) {
      try { await conn.rollback(); } catch (_) {}
    }
    next(err);
  } finally {
    if (conn) conn.release();
  }
}
