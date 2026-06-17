import pool from '../config/db.js';

const OCCUPACION_JOIN = `
  CONVERT(i.id_ocupacion USING utf8mb4) COLLATE utf8mb4_unicode_ci =
  CONVERT(e.Idocupacion USING utf8mb4) COLLATE utf8mb4_unicode_ci
`;

// --- INFORMES (ENCABEZADOS) ---
export async function createInforme(req, res, next) {
  try {
    const { id_ocupacion } = req.body;

    if (!id_ocupacion) {
      return res.status(400).json({ message: 'El id_ocupacion es obligatorio' });
    }

    // Calcular siguiente versión para esta ocupación
    const [existing] = await pool.query(
      'SELECT COALESCE(MAX(version), 0) AS max_ver FROM informes_eventos WHERE id_ocupacion = ?',
      [id_ocupacion]
    );
    const nextVersion = (existing[0]?.max_ver || 0) + 1;

    const [result] = await pool.query(
      'INSERT INTO informes_eventos (id_ocupacion, version) VALUES (?, ?)',
      [id_ocupacion, nextVersion]
    );

    // Notificación — no crítica, si falla no debe impedir crear el informe
    try {
      const [evento] = await pool.query(
        'SELECT Institucion, FechaEvento FROM tbl_seguimientocotizaciones WHERE Idocupacion = ?',
        [id_ocupacion]
      );
      const nombre = evento[0]?.Institucion || `Ocupación #${id_ocupacion}`;
      await pool.query(
        'INSERT INTO notificaciones (tipo, titulo, mensaje, informe_id, idocupacion) VALUES (?, ?, ?, ?, ?)',
        ['informe', `Informe v${nextVersion} creado`, `Se creó la versión ${nextVersion} del informe para ${nombre}`, result.insertId, id_ocupacion]
      );
    } catch (notifErr) {
      console.error('Error al crear notificación (no crítico):', notifErr.message);
    }

    // Registrar en historial
    try {
      await pool.query(
        'INSERT INTO informe_historial (informe_id, usuario_id, accion, descripcion) VALUES (?, ?, ?, ?)',
        [result.insertId, req.user?.id || null, 'CREAR_VERSION', `Se creó la versión ${nextVersion}`]
      );
    } catch { /* no crítico */ }

    const informeData = { id: result.insertId, id_ocupacion, version: nextVersion };
    req.io.to(`evento:${id_ocupacion}`).emit('informe:created', informeData);
    res.status(201).json(informeData);
  } catch (error) { next(error); }
}

export async function getInformesByOcupacion(req, res, next) {
  try {
    const { id_ocupacion } = req.params;
    const rol = req.user?.rol;
    const puedeVerTodo = rol === 'Admin' || rol === 'Vendedor' || rol === 'FrontOffice';

    let query = `
      SELECT i.id, i.id_ocupacion, i.version, i.fecha_creacion,
             (SELECT COUNT(*) FROM informe_dias_detalle WHERE informe_id = i.id) AS total_dias
      FROM informes_eventos i
      WHERE i.id_ocupacion = ?
      ORDER BY i.version DESC
    `;
    let params = [id_ocupacion];

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
    
    let rows;
    if (isNumeric) {
      [rows] = await pool.query(`
        SELECT i.id, i.id_ocupacion, i.version, i.fecha_creacion, e.Institucion, e.Pax, e.FechaEvento, e.Salon, e.TipoEvento, e.Vendedor, e.HoraI, e.HoraF, e.EncargadoEvento, e.NoDoc
        FROM informes_eventos i
        LEFT JOIN tbl_seguimientocotizaciones e ON ${OCCUPACION_JOIN}
        WHERE i.id = ?
      `, [id]);

      // Si no es Admin/Vendedor, verificar que sea la última versión
      if (!puedeVerTodo && rows.length > 0) {
        const [latest] = await pool.query(`
          SELECT id FROM informes_eventos
          WHERE id_ocupacion = ?
          ORDER BY version DESC LIMIT 1
        `, [rows[0].id_ocupacion]);
        if (latest.length > 0 && latest[0].id !== rows[0].id) {
          return res.status(403).json({ message: 'No tienes permiso para ver esta versión anterior' });
        }
      }
    }
    
    // If not found by id, try by id_ocupacion (get latest informe for that ocupacion)
    if (!rows || rows.length === 0) {
      [rows] = await pool.query(`
        SELECT i.id, i.id_ocupacion, i.version, i.fecha_creacion, e.Institucion, e.Pax, e.FechaEvento, e.Salon, e.TipoEvento, e.Vendedor, e.HoraI, e.HoraF, e.EncargadoEvento, e.NoDoc
        FROM informes_eventos i
        LEFT JOIN tbl_seguimientocotizaciones e ON ${OCCUPACION_JOIN}
        WHERE i.id_ocupacion = ?
        ORDER BY i.fecha_creacion DESC
        LIMIT 1
      `, [id]);
    }

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Informe no encontrado' });
    }

    // Get Details (Days)
    const [detailsRows] = await pool.query(`
      SELECT d.*, m.nombre_menu, c.nombre AS categoria_nombre
      FROM informe_dias_detalle d
      LEFT JOIN cat_menus m ON d.menu_id = m.id
      LEFT JOIN cat_categorias_alimento c ON m.categoria_id = c.id
      WHERE d.informe_id = ?
      ORDER BY d.fecha_evento ASC
    `, [rows[0].id]);

    // Get detailed menu items for each day
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
        ORDER BY i.tipo, i.nombre
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

    res.json({
      ...rows[0],
      dias: diasConItems
    });
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

    const [inf] = await pool.query('SELECT id_ocupacion FROM informes_eventos WHERE id = ?', [id]);
    if (inf.length > 0) {
      req.io.to(`evento:${inf[0].id_ocupacion}`).emit('informe:updated', { id, id_ocupacion: inf[0].id_ocupacion });
    }
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
    const { informe_id, fecha_evento, menu_id, descripcion_montaje } = req.body;
    const [result] = await pool.query(
      'INSERT INTO informe_dias_detalle (informe_id, fecha_evento, menu_id, descripcion_montaje) VALUES (?, ?, ?, ?)',
      [informe_id, fecha_evento, menu_id || null, descripcion_montaje || null]
    );
    const [inf2] = await pool.query('SELECT id_ocupacion FROM informes_eventos WHERE id = ?', [informe_id]);
    const diaData = { id: result.insertId, informe_id, fecha_evento, menu_id, descripcion_montaje };
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
      ORDER BY i.tipo, i.nombre
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
