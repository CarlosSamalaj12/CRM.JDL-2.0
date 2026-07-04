import pool from '../config/db.js';
import { emitChange } from '../helpers/socketEvents.js';
import { enviarNotificacionWebPush } from '../helpers/webPushHelper.js';

async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tareas_semanales (
      id INT AUTO_INCREMENT PRIMARY KEY,
      semana_lunes DATE NOT NULL,
      fecha_tarea DATE NOT NULL,
      contenido TEXT NOT NULL,
      completada TINYINT(1) NOT NULL DEFAULT 0,
      no_realizado TINYINT(1) NOT NULL DEFAULT 0,
      id_ocupacion VARCHAR(30) NULL,
      completada_en DATETIME NULL,
      usuario_id VARCHAR(100) NOT NULL,
      usuario_nombre VARCHAR(255) DEFAULT NULL,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
      actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_tareas_semanales_semana (semana_lunes),
      KEY idx_tareas_semanales_fecha (fecha_tarea),
      KEY idx_tareas_semanales_ocupacion (id_ocupacion)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tareas_semanales_historial (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tarea_id INT NOT NULL,
      accion VARCHAR(20) NOT NULL,
      contenido_previo TEXT NULL,
      contenido_nuevo TEXT NULL,
      usuario_id VARCHAR(100) NOT NULL,
      usuario_nombre VARCHAR(255) DEFAULT NULL,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
      KEY idx_tareas_semanales_historial_tarea (tarea_id),
      KEY idx_tareas_semanales_historial_semana (creado_en)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  try {
    const [colResult] = await pool.query("SHOW COLUMNS FROM tareas_semanales WHERE Field = 'id_ocupacion'");
    if (colResult.length === 0) {
      await pool.query('ALTER TABLE tareas_semanales ADD COLUMN id_ocupacion VARCHAR(30) NULL AFTER no_realizado, ADD KEY idx_tareas_semanales_ocupacion (id_ocupacion)');
    }
    const [colEquipo] = await pool.query("SHOW COLUMNS FROM tareas_semanales WHERE Field = 'equipo_id'");
    if (colEquipo.length === 0) {
      await pool.query('ALTER TABLE tareas_semanales ADD COLUMN equipo_id INT NULL AFTER id_ocupacion, ADD KEY idx_tareas_semanales_equipo (equipo_id)');
    }
  } catch (e) {
    // Column may already exist or table just created
  }
}

async function logHistory(tarea_id, accion, contenido_previo, contenido_nuevo, usuario_id, usuario_nombre) {
  await pool.query(
    'INSERT INTO tareas_semanales_historial (tarea_id, accion, contenido_previo, contenido_nuevo, usuario_id, usuario_nombre) VALUES (?, ?, ?, ?, ?, ?)',
    [tarea_id, accion, contenido_previo, contenido_nuevo, usuario_id, usuario_nombre]
  );
}

export async function getTareasSemana(req, res, next) {
  try {
    await ensureTables();
    const { semana_lunes } = req.params;
    const { usuario_id, equipo_id } = req.query;
    let sql = `SELECT t.*, e.nombre AS evento_institucion, e.nombre_salon AS evento_salon
       FROM tareas_semanales t
       LEFT JOIN eventos e ON t.id_ocupacion = e.id
       WHERE t.semana_lunes = ?`;
    const params = [semana_lunes];
    if (usuario_id || equipo_id) {
      const filters = [];
      if (usuario_id) { filters.push('t.usuario_id = ?'); params.push(usuario_id); }
      if (equipo_id) { filters.push('t.equipo_id = ?'); params.push(Number(equipo_id)); }
      if (filters.length > 0) sql += ` AND (${filters.join(' OR ')})`;
    }
    sql += ` ORDER BY t.fecha_tarea ASC, t.id ASC`;
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (error) { next(error); }
}

export async function getTareasByOcupacion(req, res, next) {
  try {
    await ensureTables();
    const { id_ocupacion } = req.params;
    const { usuario_id, equipo_id } = req.query;
    let sql = `SELECT t.*, e.nombre AS evento_institucion, e.nombre_salon AS evento_salon
       FROM tareas_semanales t
       LEFT JOIN eventos e ON t.id_ocupacion = e.id
       WHERE t.id_ocupacion = ?`;
    const params = [id_ocupacion];
    if (usuario_id || equipo_id) {
      const filters = [];
      if (usuario_id) { filters.push('t.usuario_id = ?'); params.push(usuario_id); }
      if (equipo_id) { filters.push('t.equipo_id = ?'); params.push(Number(equipo_id)); }
      if (filters.length > 0) sql += ` AND (${filters.join(' OR ')})`;
    }
    sql += ` ORDER BY t.fecha_tarea ASC, t.id ASC`;
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (error) { next(error); }
}

export async function createTarea(req, res, next) {
  try {
    await ensureTables();
    let { semana_lunes, fecha_tarea, contenido, id_ocupacion, usuario_id, usuario_nombre, equipo_id } = req.body;
    if (!usuario_id || !contenido?.trim()) {
      return res.status(400).json({ message: 'usuario_id y contenido son requeridos' });
    }
    if (!equipo_id) {
      const [userRows] = await pool.query('SELECT equipo_id FROM usuarios WHERE id = ?', [usuario_id]);
      if (userRows.length > 0 && userRows[0].equipo_id) {
        equipo_id = userRows[0].equipo_id;
      }
    }
    const [result] = await pool.query(
      'INSERT INTO tareas_semanales (semana_lunes, fecha_tarea, contenido, id_ocupacion, equipo_id, usuario_id, usuario_nombre) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [semana_lunes, fecha_tarea, contenido.trim(), id_ocupacion || null, equipo_id || null, usuario_id, usuario_nombre || null]
    );
    const [newTarea] = await pool.query('SELECT * FROM tareas_semanales WHERE id = ?', [result.insertId]);
    await logHistory(result.insertId, 'created', null, contenido.trim(), usuario_id, usuario_nombre);
    emitChange(req, 'tarea_semanal', 'created', { id: result.insertId, semana_lunes, fecha_tarea, id_ocupacion, equipo_id, usuario_id });

    // Obtener nombre del usuario que asigna (req.user)
    const creadorId = req.user?.id;
    let assignerName = 'Un administrador';
    if (creadorId) {
      const [assignerRow] = await pool.query('SELECT nombre FROM usuarios WHERE id = ?', [creadorId]);
      if (assignerRow.length > 0) {
        assignerName = assignerRow[0].nombre;
      }
    }

    // Si se asigna a otra persona, notificarle
    if (usuario_id && usuario_id !== creadorId) {
      const redirectUrl = id_ocupacion ? `/reserva/${id_ocupacion}` : '/calendar';
      const [notifResult] = await pool.query(
        'INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, idocupacion, comentario_id) VALUES (?, ?, ?, ?, ?, ?)',
        [usuario_id, 'tarea_asignada', 'Nueva tarea semanal asignada', `${assignerName} te asignó una tarea semanal`, id_ocupacion || null, result.insertId]
      );

      req.io.to(`usuario:${usuario_id}`).emit('notificacion:created', {
        id: notifResult.insertId,
        usuario_id: parseInt(usuario_id),
        tipo: 'tarea_asignada',
        titulo: 'Nueva tarea semanal asignada',
        mensaje: `${assignerName} te asignó una tarea semanal`,
        informe_id: null,
        idocupacion: id_ocupacion || null,
        comentario_id: result.insertId,
        leido: 0,
        fecha_creacion: new Date()
      });

      enviarNotificacionWebPush(
        usuario_id,
        'Nueva tarea semanal asignada',
        `${assignerName} te asignó: "${contenido.trim().slice(0, 100)}"`,
        {
          url: redirectUrl
        }
      ).catch(err => console.error('[WebPush] Error enviando push asignacion tarea semanal:', err));
    }

    res.status(201).json(newTarea[0]);
  } catch (error) { next(error); }
}

export async function updateTarea(req, res, next) {
  try {
    await ensureTables();
    const { id } = req.params;
    const { contenido, completada, no_realizado, id_ocupacion, usuario_id, usuario_nombre } = req.body;
    const [existing] = await pool.query('SELECT * FROM tareas_semanales WHERE id = ?', [id]);
    if (existing.length === 0) return res.status(404).json({ message: 'Tarea no encontrada' });
    const prev = existing[0];
    const fields = [];
    const params = [];
    if (contenido !== undefined) {
      if (!contenido.trim()) return res.status(400).json({ message: 'contenido no puede estar vacío' });
      fields.push('contenido = ?'); params.push(contenido.trim());
    }
    if (completada !== undefined) {
      fields.push('completada = ?'); params.push(completada ? 1 : 0);
      fields.push('no_realizado = ?'); params.push(completada ? 0 : 0);
      if (completada) {
        fields.push('completada_en = NOW()');
      } else {
        fields.push('completada_en = NULL');
      }
    }
    if (no_realizado !== undefined) {
      fields.push('no_realizado = ?'); params.push(no_realizado ? 1 : 0);
      fields.push('completada = ?'); params.push(0);
      fields.push('completada_en = NULL');
    }
    if (id_ocupacion !== undefined) {
      fields.push('id_ocupacion = ?'); params.push(id_ocupacion || null);
    }
    if (fields.length === 0) return res.status(400).json({ message: 'Sin campos para actualizar' });
    params.push(id);
    await pool.query(`UPDATE tareas_semanales SET ${fields.join(', ')} WHERE id = ?`, params);
    emitChange(req, 'tarea_semanal', 'updated', { id: Number(id), usuario_id, completada, no_realizado });
    const [updated] = await pool.query('SELECT * FROM tareas_semanales WHERE id = ?', [id]);
    let accion = 'updated';
    if (completada !== undefined) accion = completada ? 'completed' : 'uncompleted';
    if (no_realizado !== undefined) accion = 'no_realizado';
    if (contenido !== undefined && contenido.trim() !== prev.contenido) accion = 'edited';
    if (id_ocupacion !== undefined && String(id_ocupacion || '') !== String(prev.id_ocupacion || '')) accion = 'edited';
    await logHistory(id, accion, prev.contenido, updated[0].contenido, usuario_id, usuario_nombre);

    // Notify task creator when someone from another team completes it
    if (completada && prev.equipo_id && String(prev.usuario_id) !== String(usuario_id)) {
      try {
        const [teamRows] = await pool.query('SELECT nombre FROM equipos_trabajo WHERE id = ?', [prev.equipo_id]);
        const teamName = teamRows.length > 0 ? teamRows[0].nombre : 'Otro equipo';
        const titulo = 'Tarea completada';
        const mensaje = `El equipo "${teamName}" completó: ${prev.contenido}`;
        const notifIdOcupacion = String(prev.id_ocupacion || '');
        const [notifResult] = await pool.query(
          'INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, idocupacion, comentario_id) VALUES (?, ?, ?, ?, ?, ?)',
          [prev.usuario_id, 'tarea_completada', titulo, mensaje, notifIdOcupacion, Number(id)]
        );
        if (req.io) {
          req.io.to(`usuario:${prev.usuario_id}`).emit('notificacion:created', {
            id: notifResult.insertId,
            usuario_id: prev.usuario_id,
            tipo: 'tarea_completada',
            titulo,
            mensaje,
            informe_id: null,
            idocupacion: notifIdOcupacion,
            comentario_id: Number(id),
            leido: 0,
            fecha_creacion: new Date(),
          });
        }

        enviarNotificacionWebPush(
          prev.usuario_id,
          titulo,
          mensaje,
          {
            url: prev.id_ocupacion ? `/reserva/${prev.id_ocupacion}` : '/calendar'
          }
        ).catch(err => console.error('[WebPush] Error enviando push completada tarea:', err));
      } catch { /* notification is non-critical */ }
    }

    res.json(updated[0]);
  } catch (error) { next(error); }
}

export async function deleteTarea(req, res, next) {
  try {
    await ensureTables();
    const { id } = req.params;
    const [existing] = await pool.query('SELECT * FROM tareas_semanales WHERE id = ?', [id]);
    if (existing.length === 0) return res.status(404).json({ message: 'Tarea no encontrada' });
    const { usuario_id, usuario_nombre } = req.body;
    await logHistory(id, 'deleted', existing[0].contenido, null, usuario_id, usuario_nombre);
    await pool.query('DELETE FROM tareas_semanales WHERE id = ?', [id]);
    emitChange(req, 'tarea_semanal', 'deleted', { id: Number(id) });
    res.json({ message: 'Tarea eliminada' });
  } catch (error) { next(error); }
}

export async function getHistorial(req, res, next) {
  try {
    await ensureTables();
    const { semana_lunes } = req.params;
    const [rows] = await pool.query(
      `SELECT h.*, t.contenido AS contenido_actual
       FROM tareas_semanales_historial h
       LEFT JOIN tareas_semanales t ON h.tarea_id = t.id
       WHERE h.creado_en >= ? AND h.creado_en < DATE_ADD(?, INTERVAL 7 DAY)
       ORDER BY h.creado_en DESC
       LIMIT 200`,
      [semana_lunes, semana_lunes]
    );
    res.json(rows);
  } catch (error) { next(error); }
}

export async function getTareasMerged(req, res, next) {
  try {
    await ensureTables();
    const { semana_lunes } = req.params;
    const { usuario_id, equipo_id } = req.query;

    let sql = `SELECT t.*, e.nombre AS evento_institucion, e.nombre_salon AS evento_salon
       FROM tareas_semanales t
       LEFT JOIN eventos e ON t.id_ocupacion = e.id
       WHERE t.semana_lunes = ?`;
    const params = [semana_lunes];
    if (usuario_id || equipo_id) {
      const filters = [];
      if (usuario_id) { filters.push('t.usuario_id = ?'); params.push(usuario_id); }
      if (equipo_id) { filters.push('t.equipo_id = ?'); params.push(Number(equipo_id)); }
      if (filters.length > 0) sql += ` AND (${filters.join(' OR ')})`;
    }
    sql += ` ORDER BY t.fecha_tarea ASC, t.id ASC`;
    const [tareasSemanales] = await pool.query(sql, params);

    const [tareasEvento] = await pool.query(
      `SELECT te.id, te.id_ocupacion, te.contenido, te.completada,
              0 AS no_realizado, NULL AS completada_en,
              te.usuario_id, te.usuario_nombre, te.fecha_creacion AS creado_en,
              te.fecha_creacion AS actualizado_en,
              ev.FechaEvento AS fecha_tarea,
              e.nombre AS evento_institucion, e.nombre_salon AS evento_salon,
              'evento' AS _source
       FROM tareas_evento te
       JOIN tbl_seguimientocotizaciones ev ON te.id_ocupacion = ev.Idocupacion
       LEFT JOIN eventos e ON te.id_ocupacion = e.id
       WHERE YEARWEEK(ev.FechaEvento, 1) = YEARWEEK(?, 1)
       ORDER BY ev.FechaEvento ASC, te.id ASC`,
      [semana_lunes]
    );

    const marked = new Set();
    const merged = [];
    for (const t of tareasSemanales) {
      const key = `${t.fecha_tarea}-${t.contenido}-${t.id_ocupacion || ''}`;
      marked.add(key);
      merged.push({ ...t, _source: 'semanal' });
    }
    for (const t of tareasEvento) {
      const key = `${String(t.fecha_tarea || '').slice(0, 10)}-${t.contenido}-${t.id_ocupacion || ''}`;
      if (!marked.has(key)) {
        merged.push(t);
      }
    }

    merged.sort((a, b) => {
      const da = String(a.fecha_tarea || '').slice(0, 10);
      const db = String(b.fecha_tarea || '').slice(0, 10);
      if (da !== db) return da < db ? -1 : 1;
      return (a.id || 0) - (b.id || 0);
    });

    res.json(merged);
  } catch (error) { next(error); }
}

export async function logHistorialEntry(req, res, next) {
  try {
    await ensureTables();
    const { tarea_id, accion, contenido_previo, contenido_nuevo, usuario_id, usuario_nombre } = req.body;
    if (!tarea_id || !accion || !usuario_id) {
      return res.status(400).json({ message: 'tarea_id, accion y usuario_id son requeridos' });
    }
    await logHistory(tarea_id, accion, contenido_previo || null, contenido_nuevo || null, usuario_id, usuario_nombre || null);
    res.status(201).json({ message: 'ok' });
  } catch (error) { next(error); }
}

export async function autoMarcarNoRealizado(req, res, next) {
  try {
    await ensureTables();
    const hoy = new Date().toISOString().slice(0, 10);
    const [result] = await pool.query(
      'UPDATE tareas_semanales SET no_realizado = 1, completada = 0 WHERE fecha_tarea < ? AND completada = 0 AND no_realizado = 0',
      [hoy]
    );
    res.json({ actualizados: result.affectedRows });
  } catch (error) { next(error); }
}
