import pool from '../config/db.js';

const OCCUPACION_JOIN = `
  (e.Idocupacion = i.id_ocupacion OR (e.Idocupacion = SUBSTRING_INDEX(i.id_ocupacion, '_s', 1) AND NOT EXISTS (SELECT 1 FROM tbl_seguimientocotizaciones e2 WHERE e2.Idocupacion = i.id_ocupacion)))
`;

async function fetchInformeWithDias(informeId) {
  const [infRows] = await pool.query(`
    SELECT i.id, i.id_ocupacion, i.version, i.fecha_creacion
    FROM informes_eventos i
    WHERE i.id = ?
  `, [informeId]);

  if (infRows.length === 0) return null;

  const currentInf = infRows[0];
  const cleanOcupacionId = String(currentInf.id_ocupacion || '').replace(/^#/, '').trim();
  const baseId = cleanOcupacionId.replace(/_(s|slot)\d+.*$/, '');

  // Obtener datos del evento/slot específico
  let eventData = null;
  // 1. Intentar coincidencia exacta con el slot asignado
  const [exactRows] = await pool.query(`
    SELECT e.Institucion, e.Pax, e.FechaEvento, e.Salon, e.TipoEvento,
           COALESCE(u.nombre_completo, u.nombre, e.Vendedor) AS Vendedor,
           e.HoraI, e.HoraF, e.EncargadoEvento, e.NoDoc,
           e.Telefono, ce.folio
    FROM tbl_seguimientocotizaciones e
    LEFT JOIN eventos ev ON (ev.id = e.Idocupacion OR REPLACE(ev.id, '#', '') = e.Idocupacion)
    LEFT JOIN cotizaciones_evento ce ON ev.id = ce.id_evento
    LEFT JOIN usuarios u ON ev.id_usuario = u.id
    WHERE e.Idocupacion = ? OR e.Idocupacion = ? OR REPLACE(e.Idocupacion, '#', '') = ?
    LIMIT 1
  `, [currentInf.id_ocupacion, cleanOcupacionId, cleanOcupacionId]);

  if (exactRows.length > 0) {
    eventData = exactRows[0];
  }

  // 2. Si no hubo coincidencia exacta o faltan datos generales (Institucion, Vendedor, folio), consultar evento base
  if (baseId && baseId !== cleanOcupacionId) {
    const [baseRows] = await pool.query(`
      SELECT e.Institucion, e.Pax, e.FechaEvento, e.Salon, e.TipoEvento,
             COALESCE(u.nombre_completo, u.nombre, e.Vendedor) AS Vendedor,
             e.HoraI, e.HoraF, e.EncargadoEvento, e.NoDoc,
             e.Telefono, ce.folio
      FROM tbl_seguimientocotizaciones e
      LEFT JOIN eventos ev ON (ev.id = e.Idocupacion OR REPLACE(ev.id, '#', '') = e.Idocupacion)
      LEFT JOIN cotizaciones_evento ce ON ev.id = ce.id_evento
      LEFT JOIN usuarios u ON ev.id_usuario = u.id
      WHERE e.Idocupacion = ? OR REPLACE(e.Idocupacion, '#', '') = ?
      LIMIT 1
    `, [baseId, baseId]);

    if (baseRows.length > 0) {
      const bRow = baseRows[0];
      if (!eventData) {
        eventData = bRow;
      } else {
        // Preservar Salon, Pax, FechaEvento, HoraI, HoraF del slot específico, pero heredar metadatos generales
        eventData.Institucion = eventData.Institucion || bRow.Institucion;
        eventData.Vendedor = eventData.Vendedor || bRow.Vendedor;
        eventData.TipoEvento = eventData.TipoEvento || bRow.TipoEvento;
        eventData.EncargadoEvento = eventData.EncargadoEvento || bRow.EncargadoEvento;
        eventData.NoDoc = eventData.NoDoc || bRow.NoDoc;
        eventData.Telefono = eventData.Telefono || bRow.Telefono;
        eventData.folio = eventData.folio || bRow.folio;
      }
    }
  }

  Object.assign(currentInf, eventData || {});

  // 1. Días guardados en este informe
  const [directDetails] = await pool.query(`
    SELECT d.*, m.nombre_menu, c.nombre AS categoria_nombre
    FROM informe_dias_detalle d
    LEFT JOIN cat_menus m ON d.menu_id = m.id
    LEFT JOIN cat_categorias_alimento c ON m.categoria_id = c.id
    WHERE d.informe_id = ?
    ORDER BY d.fecha_evento ASC, d.id ASC
  `, [currentInf.id]);

  const getIsoDateStr = (d) => {
    if (!d) return '';
    if (d instanceof Date) return d.toISOString().slice(0, 10);
    return String(d).slice(0, 10);
  };

  const getTime = (d) => {
    const s = getIsoDateStr(d);
    if (!s) return 0;
    const t = new Date(s + 'T12:00:00').getTime();
    return isNaN(t) ? 0 : t;
  };

  const detailsRows = directDetails.sort((a, b) => {
    return getTime(a.fecha_evento) - getTime(b.fecha_evento);
  });

  // Las fechas de los días del informe son definidas por el usuario/cocina y no deben desplazarse ciegamente al consultar.

  // Obtener slots de la serie del evento para mapear salón, pax y horario específicos de cada fecha
  try {
    const [seriesSlots] = await pool.query(`
      SELECT Idocupacion, FechaEvento, Salon, Pax, HoraI, HoraF, NoDoc
      FROM tbl_seguimientocotizaciones
      WHERE Idocupacion = ? OR Idocupacion = ? OR REPLACE(Idocupacion, '#', '') = ?
         OR Idocupacion = ? OR Idocupacion LIKE CONCAT(?, '_%')
    `, [currentInf.id_ocupacion, cleanOcupacionId, cleanOcupacionId, baseId, baseId]);

    for (const d of detailsRows) {
      const dIso = getIsoDateStr(d.fecha_evento);

      // 1. Buscar coincidencia exacta con el slot asignado al informe
      let slot = seriesSlots.find(s => {
        const sClean = String(s.Idocupacion || '').replace(/^#/, '').trim();
        return sClean === cleanOcupacionId;
      });

      // 2. Si el slot asignado no coincide con la fecha de este día, buscar por fecha y salón de montaje
      if (!slot || (dIso && getIsoDateStr(slot.FechaEvento) !== dIso)) {
        let parsedMontaje = null;
        try {
          parsedMontaje = typeof d.descripcion_montaje === 'string' ? JSON.parse(d.descripcion_montaje) : d.descripcion_montaje;
        } catch {}
        const targetSalon = parsedMontaje?.salon || parsedMontaje?.montajes?.[0]?.salon;
        if (targetSalon) {
          slot = seriesSlots.find(s => getIsoDateStr(s.FechaEvento) === dIso && String(s.Salon).trim().toLowerCase() === String(targetSalon).trim().toLowerCase());
        }
        if (!slot) {
          slot = seriesSlots.find(s => getIsoDateStr(s.FechaEvento) === dIso);
        }
      }

      if (slot) {
        d.slot_salon = slot.Salon || null;
        d.slot_pax = slot.Pax || null;
        d.slot_horario = (slot.HoraI && slot.HoraF) ? `${slot.HoraI} - ${slot.HoraF}` : (slot.HoraI || null);
        d.slot_nodoc = slot.NoDoc || null;
      }
    }
  } catch (err) {
    console.warn('[fetchInformeWithDias] No se pudieron cargar slots de la serie:', err.message);
  }

  const diaIds = detailsRows.map(d => d.id);
  const itemsPorDia = {};
  if (diaIds.length > 0) {
    const placeholders = diaIds.map(() => '?').join(',');
    const [items] = await pool.query(`
      SELECT d.*, i.nombre AS ingrediente_nombre, i.tipo AS ingrediente_tipo,
             o.nombre_opcion AS opcion_nombre
      FROM informe_dia_menu_detalle d
      JOIN cat_ingredientes i ON d.ingrediente_id = i.id
      LEFT JOIN cat_opciones_ingrediente o ON d.opcion_id = o.id
      WHERE d.dia_id IN (${placeholders})
      ORDER BY d.id ASC
    `, diaIds);

    for (const item of items) {
      if (!itemsPorDia[item.dia_id]) itemsPorDia[item.dia_id] = [];
      itemsPorDia[item.dia_id].push(item);
    }
  }

  const diasConItems = detailsRows.map(d => ({
    ...d,
    items: itemsPorDia[d.id] || [],
  }));

  return { ...currentInf, dias: diasConItems };
}

// --- INFORMES (ENCABEZADOS) ---
export async function createInforme(req, res, next) {
  try {
    const { id_ocupacion } = req.body;

    if (!id_ocupacion) {
      return res.status(400).json({ message: 'El id_ocupacion es obligatorio' });
    }

    const baseId = String(id_ocupacion).replace(/_(s|slot)\d+.*$/, '');

    // Calcular siguiente versión para esta ocupación o su grupo
    const [existing] = await pool.query(
      'SELECT COALESCE(MAX(version), 0) AS max_ver FROM informes_eventos WHERE id_ocupacion = ? OR id_ocupacion = ? OR id_ocupacion LIKE CONCAT(?, "_%")',
      [id_ocupacion, baseId, baseId]
    );
    const nextVersion = (existing[0]?.max_ver || 0) + 1;

    const [result] = await pool.query(
      'INSERT INTO informes_eventos (id_ocupacion, version) VALUES (?, ?)',
      [id_ocupacion, nextVersion]
    );

    // Registrar en historial
    try {
      await pool.query(
        'INSERT INTO informe_historial (informe_id, usuario_id, accion, descripcion) VALUES (?, ?, ?, ?)',
        [result.insertId, req.user?.id || null, 'CREAR_VERSION', `Se creó la versión ${nextVersion}`]
      );
    } catch { /* no crítico */ }

    const informeData = { id: result.insertId, id_ocupacion, version: nextVersion };
    res.status(201).json(informeData);
  } catch (error) { next(error); }
}

export async function getInformesByOcupacion(req, res, next) {
  try {
    const { id_ocupacion } = req.params;
    const baseId = String(id_ocupacion).replace(/_(s|slot)\d+.*$/, '');
    const rol = req.user?.rol;
    const puedeVerTodo = rol === 'Admin' || rol === 'Vendedor' || rol === 'FrontOffice';

    let query = `
      SELECT i.id, i.id_ocupacion, i.version, i.fecha_creacion,
             (SELECT COUNT(*) FROM informe_dias_detalle WHERE informe_id = i.id) AS total_dias
      FROM informes_eventos i
      WHERE i.id_ocupacion = ? OR i.id_ocupacion = ? OR i.id_ocupacion LIKE CONCAT(?, '_%')
      ORDER BY i.version DESC
    `;
    let params = [id_ocupacion, baseId, baseId];

    // Solo Admin y Vendedor ven todas las versiones;
    // los demás roles (Coordinador, FrontOffice) ven solo la última
    if (!puedeVerTodo) {
      query += ' LIMIT 1';
    }

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (error) { next(error); }
}

export async function getInformes(req, res, next) {
  try {
    const rol = req.user?.rol;
    const puedeVerTodo = rol === 'Admin' || rol === 'Vendedor' || rol === 'FrontOffice';

    let query = `
      SELECT i.id, i.id_ocupacion, i.version, i.fecha_creacion, e.Institucion, e.Pax, e.FechaEvento
      FROM informes_eventos i
      LEFT JOIN tbl_seguimientocotizaciones e ON ${OCCUPACION_JOIN}
    `;

    // No administradores/vendedores solo ven la última versión por ocupación
    if (!puedeVerTodo) {
      query = `
        SELECT i.id, i.id_ocupacion, i.version, i.fecha_creacion, e.Institucion, e.Pax, e.FechaEvento
        FROM informes_eventos i
        LEFT JOIN tbl_seguimientocotizaciones e ON ${OCCUPACION_JOIN}
        WHERE i.id = (
          SELECT i2.id FROM informes_eventos i2
          WHERE i2.id_ocupacion = i.id_ocupacion
          ORDER BY i2.version DESC LIMIT 1
        )
      `;
    }

    query += ' ORDER BY i.fecha_creacion DESC';

    const [rows] = await pool.query(query);
    res.json(rows);
  } catch (error) { next(error); }
}

export async function getInformeById(req, res, next) {
  try {
    const { id } = req.params;
    const rol = req.user?.rol;
    const puedeVerTodo = rol === 'Admin' || rol === 'Vendedor' || rol === 'FrontOffice';
    
    // Try by informes_eventos.id first (numeric), then by id_ocupacion (alphanumeric)
    const isNumeric = /^\d+$/.test(id);
    
    let result = null;
    if (isNumeric) {
      result = await fetchInformeWithDias(id);
      // Si no es Admin/Vendedor, verificar que sea la última versión
      if (result && !puedeVerTodo) {
        const [latest] = await pool.query(`
          SELECT id FROM informes_eventos
          WHERE id_ocupacion = ?
          ORDER BY version DESC LIMIT 1
        `, [result.id_ocupacion]);
        if (latest.length > 0 && latest[0].id !== result.id) {
          return res.status(403).json({ message: 'No tienes permiso para ver esta versión anterior' });
        }
      }
    }
    
    // If not found by id, try by id_ocupacion (get latest informe for that ocupacion or its group)
    if (!result) {
      const baseId = String(id).replace(/_(s|slot)\d+_\d{6,}$/, '');
      const [rows] = await pool.query(`
        SELECT id FROM informes_eventos
        WHERE id_ocupacion = ? OR id_ocupacion = ? OR id_ocupacion LIKE CONCAT(?, '_%')
        ORDER BY version DESC, fecha_creacion DESC
        LIMIT 1
      `, [id, baseId, baseId]);
      if (rows.length > 0) {
        result = await fetchInformeWithDias(rows[0].id);
      }
    }

    if (!result) {
      return res.status(404).json({ message: 'Informe no encontrado' });
    }

    res.json(result);
  } catch (error) { next(error); }
}

export async function getInformeByEventFields(req, res, next) {
  try {
    const { nombre, fecha, salon } = req.query;
    if (!fecha) {
      return res.status(400).json({ message: 'La fecha del evento es requerida' });
    }

    // Buscar en tbl_seguimientocotizaciones por fecha y opcionalmente nombre/salon
    let query = `SELECT Idocupacion FROM tbl_seguimientocotizaciones WHERE FechaEvento = ?`;
    const params = [fecha];

    if (nombre) {
      query += ` AND (TRIM(Institucion) = TRIM(?) OR TRIM(Institucion) LIKE TRIM(CONCAT('%', ?, '%')))`;
      params.push(nombre, nombre);
    }
    if (salon) {
      query += ` AND TRIM(Salon) = TRIM(?)`;
      params.push(salon);
    }
    query += ` ORDER BY Idocupacion DESC LIMIT 5`;

    const [rows] = await pool.query(query, params);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'No se encontró evento en la base de datos de informes' });
    }

    // Try each matching event until we find one with an informe
    for (const row of rows) {
      const id_ocupacion = String(row.Idocupacion);
      const [infRows] = await pool.query(`
        SELECT id FROM informes_eventos
        WHERE id_ocupacion = ?
        ORDER BY fecha_creacion DESC
        LIMIT 1
      `, [id_ocupacion]);

      if (infRows.length === 0) continue;

      const result = await fetchInformeWithDias(infRows[0].id);
      if (result) {
        return res.json(result);
      }
    }

    return res.status(404).json({ message: 'No se encontró informe para este evento' });
  } catch (error) { next(error); }
}

export async function updateInforme(req, res, next) {
  try {
    const { id } = req.params;
    const { fecha_creacion } = req.body;

    // Evitar SET ? vacío (syntax error)
    const updates = {};
    if (fecha_creacion) updates.fecha_creacion = fecha_creacion;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'No hay campos para actualizar' });
    }

    const [result] = await pool.query(
      'UPDATE informes_eventos SET ? WHERE id = ?',
      [updates, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Informe no encontrado' });
    }

    // Registrar en historial
    try {
      await pool.query(
        'INSERT INTO informe_historial (informe_id, usuario_id, accion, descripcion) VALUES (?, ?, ?, ?)',
        [id, req.user?.id || null, 'ACTUALIZAR', 'Se actualizó el informe']
      );
    } catch { /* no crítico */ }

    res.json({ message: 'ok' });
  } catch (error) { next(error); }
}

export async function deleteInformeDias(req, res, next) {
  try {
    const { id } = req.params; // informe_id

    // Eliminar detalles de menú de todos los días del informe
    await pool.query(
      'DELETE FROM informe_dia_menu_detalle WHERE dia_id IN (SELECT id FROM informe_dias_detalle WHERE informe_id = ?)',
      [id]
    );

    // Eliminar días del informe
    await pool.query('DELETE FROM informe_dias_detalle WHERE informe_id = ?', [id]);

    // Registrar en historial
    try {
      await pool.query(
        'INSERT INTO informe_historial (informe_id, usuario_id, accion, descripcion) VALUES (?, ?, ?, ?)',
        [id, req.user?.id || null, 'REEMPLAZAR_DIAS', 'Se reemplazaron los días del informe']
      );
    } catch { /* no crítico */ }

    res.json({ message: 'ok' });
  } catch (error) { next(error); }
}

export async function deleteInforme(req, res, next) {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM informes_eventos WHERE id = ?', [id]);
    res.status(204).send();
  } catch (error) { next(error); }
}

// --- DETALLE DE DÍAS ---
export async function createInformeDia(req, res, next) {
  try {
    const { informe_id, fecha_evento, menu_id, descripcion_montaje, comentario_menu } = req.body;
    const [result] = await pool.query(
      'INSERT INTO informe_dias_detalle (informe_id, fecha_evento, menu_id, descripcion_montaje, comentario_menu) VALUES (?, ?, ?, ?, ?)',
      [informe_id, fecha_evento, menu_id || null, descripcion_montaje || null, comentario_menu || null]
    );
    const [inf2] = await pool.query('SELECT id_ocupacion FROM informes_eventos WHERE id = ?', [informe_id]);
    const diaData = { id: result.insertId, informe_id, fecha_evento, menu_id, descripcion_montaje, comentario_menu };
    if (inf2.length > 0) {
      req.io.to(`evento:${inf2[0].id_ocupacion}`).emit('informe:dia-created', diaData);
    }
    res.status(201).json(diaData);
  } catch (error) { next(error); }
}

export async function deleteInformeDia(req, res, next) {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM informe_dias_detalle WHERE id = ?', [id]);
    res.status(204).send();
  } catch (error) { next(error); }
}

// --- DETALLE PERSONALIZADO DEL MENÚ POR DÍA ---
export async function getDiaMenuDetalle(req, res, next) {
  try {
    const { dia_id } = req.params;
    const [rows] = await pool.query(`
      SELECT d.*, i.nombre AS ingrediente_nombre, i.tipo AS ingrediente_tipo,
             o.nombre_opcion AS opcion_nombre
      FROM informe_dia_menu_detalle d
      JOIN cat_ingredientes i ON d.ingrediente_id = i.id
      LEFT JOIN cat_opciones_ingrediente o ON d.opcion_id = o.id
      WHERE d.dia_id = ?
      ORDER BY d.id ASC
    `, [dia_id]);
    res.json(rows);
  } catch (error) { next(error); }
}

export async function saveDiaMenuDetalle(req, res, next) {
  try {
    const { dia_id } = req.params;
    const { items } = req.body; // array de { menu_item_id, ingrediente_id, opcion_id, metodo_preparacion, cantidad_total, notas }

    if (!Array.isArray(items)) {
      return res.status(400).json({ message: 'Se requiere un array "items"' });
    }

    // Reemplazar configuración anterior
    await pool.query('DELETE FROM informe_dia_menu_detalle WHERE dia_id = ?', [dia_id]);

    if (items.length === 0) {
      return res.json({ message: 'ok', insertados: 0 });
    }

    const values = items.map(item => [
      dia_id,
      item.menu_item_id || null,
      item.ingrediente_id,
      item.opcion_id || null,
      item.metodo_preparacion || null,
      item.cantidad_total || 0,
      item.notas || null,
    ]);

    const [result] = await pool.query(
      'INSERT INTO informe_dia_menu_detalle (dia_id, menu_item_id, ingrediente_id, opcion_id, metodo_preparacion, cantidad_total, notas) VALUES ?',
      [values]
    );

    res.status(201).json({ message: 'ok', insertados: result.affectedRows });
  } catch (error) { next(error); }
}

// ─── Actualizar detalle de un ítem individual (notas y/o cantidad_total) ───
export async function updateDiaMenuItem(req, res, next) {
  try {
    const { itemId } = req.params;
    const { notas, cantidad_total } = req.body;

    if (notas === undefined && cantidad_total === undefined) {
      return res.status(400).json({ message: 'Se requiere "notas" o "cantidad_total"' });
    }

    const updates = [];
    const values = [];

    if (notas !== undefined) {
      updates.push('notas = ?');
      values.push(notas ? String(notas).trim() : null);
    }
    if (cantidad_total !== undefined) {
      updates.push('cantidad_total = ?');
      const n = Number(cantidad_total);
      values.push(isNaN(n) || n <= 0 ? null : n);
    }

    values.push(itemId);
    await pool.query(
      `UPDATE informe_dia_menu_detalle SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    res.json({ message: 'ok', id: itemId, notas, cantidad_total });
  } catch (error) { next(error); }
}

export const updateDiaMenuItemNotas = updateDiaMenuItem;

// ─── Verificar si un evento tiene informes asociados y listar sus datos ───
export async function checkEventInformes(req, res, next) {
  try {
    const { eventId } = req.params;
    if (!eventId) return res.json({ hasInformes: false, informes: [] });

    const rawId = String(eventId).trim();
    const baseId = rawId.replace(/_(s|slot)\d+.*$/, '');

    const [rows] = await pool.query(`
      SELECT i.id, i.id_ocupacion, i.version, i.fecha_creacion,
             (SELECT COUNT(*) FROM informe_dias_detalle WHERE informe_id = i.id) AS total_dias
      FROM informes_eventos i
      WHERE i.id_ocupacion = ? OR i.id_ocupacion = ? OR i.id_ocupacion LIKE CONCAT(?, '_%')
      ORDER BY i.version DESC
    `, [rawId, baseId, baseId]);

    if (rows.length === 0) {
      return res.json({ hasInformes: false, informes: [] });
    }

    const infIds = rows.map(r => r.id);
    const placeholders = infIds.map(() => '?').join(',');
    const [dias] = await pool.query(`
      SELECT idd.id, idd.informe_id, idd.fecha_evento, idd.menu_id, idd.descripcion_montaje,
             cm.nombre_menu
      FROM informe_dias_detalle idd
      LEFT JOIN cat_menus cm ON idd.menu_id = cm.id
      WHERE idd.informe_id IN (${placeholders})
      ORDER BY idd.fecha_evento ASC, idd.id ASC
    `, infIds);

    const diasPorInforme = {};
    for (const d of dias) {
      if (!diasPorInforme[d.informe_id]) diasPorInforme[d.informe_id] = [];
      let parsed = null;
      try {
        parsed = typeof d.descripcion_montaje === 'string' ? JSON.parse(d.descripcion_montaje) : d.descripcion_montaje;
      } catch { parsed = {}; }
      diasPorInforme[d.informe_id].push({
        id: d.id,
        fecha: d.fecha_evento ? String(d.fecha_evento).slice(0, 10) : '',
        menu_nombre: d.nombre_menu || null,
        salon: parsed?.salon || parsed?.montajes?.[0]?.salon || '',
        horario: parsed?.horario || parsed?.montajes?.[0]?.horario || '',
      });
    }

    const enriched = rows.map(r => ({
      ...r,
      dias: diasPorInforme[r.id] || []
    }));

    res.json({ hasInformes: true, informes: enriched });
  } catch (error) { next(error); }
}

// ─── Transferir / Reasignar un informe a otro salón o slot ───
export async function reassignInformeSlot(req, res, next) {
  try {
    const { id } = req.params;
    const { targetSlotId, targetSalon, targetHorario, targetFecha, diaId } = req.body;

    if (!targetSlotId) {
      return res.status(400).json({ message: 'targetSlotId es requerido' });
    }

    const cleanSlotId = String(targetSlotId).replace(/^#/, '').trim();

    // Buscar informe por ID o id_ocupacion (con o sin #)
    const [infRows] = await pool.query(
      'SELECT id, id_ocupacion FROM informes_eventos WHERE id = ? OR id_ocupacion = ? OR REPLACE(id_ocupacion, "#", "") = ? LIMIT 1',
      [id, id, id]
    );
    if (infRows.length === 0) {
      return res.status(404).json({ message: 'Informe no encontrado' });
    }

    const currentInf = infRows[0];

    // Actualizar vinculación de ocupación en informes_eventos con ID limpio
    await pool.query(
      'UPDATE informes_eventos SET id_ocupacion = ? WHERE id = ?',
      [cleanSlotId, currentInf.id]
    );

    // Actualizar datos del salón y horario en informe_dias_detalle
    const [dias] = await pool.query(
      'SELECT id, fecha_evento, descripcion_montaje FROM informe_dias_detalle WHERE informe_id = ? ORDER BY fecha_evento ASC, id ASC',
      [currentInf.id]
    );

    let targetDia = null;
    if (diaId) {
      targetDia = dias.find(d => String(d.id) === String(diaId));
    } else if (targetFecha) {
      targetDia = dias.find(d => String(d.fecha_evento || '').slice(0, 10) === String(targetFecha).slice(0, 10));
    }
    if (!targetDia && dias.length > 0) {
      targetDia = dias[0];
    }

    if (targetDia) {
      let parsed = {};
      try {
        parsed = typeof targetDia.descripcion_montaje === 'string' ? JSON.parse(targetDia.descripcion_montaje) : (targetDia.descripcion_montaje || {});
      } catch { parsed = {}; }

      parsed._v = 2;
      if (targetSalon) parsed.salon = targetSalon;
      if (targetHorario) parsed.horario = targetHorario;
      if (Array.isArray(parsed.montajes) && parsed.montajes.length > 0) {
        parsed.montajes.forEach(m => {
          if (targetSalon) m.salon = targetSalon;
          if (targetHorario) m.horario = targetHorario;
        });
      } else if (targetSalon) {
        parsed.montajes = [{ salon: targetSalon, horario: targetHorario || '', tipo: 'Personalizado' }];
      }

      const newFecha = (targetFecha && /^\d{4}-\d{2}-\d{2}$/.test(targetFecha)) ? targetFecha : targetDia.fecha_evento;
      await pool.query(
        'UPDATE informe_dias_detalle SET fecha_evento = ?, descripcion_montaje = ? WHERE id = ?',
        [newFecha, JSON.stringify(parsed), targetDia.id]
      );
    }

    // Registrar en historial
    try {
      await pool.query(
        'INSERT INTO informe_historial (informe_id, usuario_id, accion, descripcion) VALUES (?, ?, ?, ?)',
        [currentInf.id, req.user?.id || null, 'REASIGNAR_SALON', `Informe reasignado a ocupación ${cleanSlotId}${targetSalon ? ` (${targetSalon})` : ''}`]
      );
    } catch { /* no crítico */ }

    if (req.io) {
      req.io.emit('state-updated', { type: 'informes', id: currentInf.id, id_ocupacion: cleanSlotId, timestamp: Date.now() });
      req.io.emit('informe:reassigned', { informeId: currentInf.id, targetSlotId: cleanSlotId, targetSalon, targetHorario, targetFecha });
    }

    res.json({
      ok: true,
      message: 'Informe transferido al salón exitosamente',
      informeId: currentInf.id,
      targetSlotId: cleanSlotId,
      targetSalon
    });
  } catch (error) { next(error); }
}
