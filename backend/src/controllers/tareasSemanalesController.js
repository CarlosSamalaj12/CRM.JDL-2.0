import pool from '../config/db.js';

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
    const [rows] = await pool.query(
      `SELECT t.*, e.nombre AS evento_institucion, e.nombre_salon AS evento_salon
       FROM tareas_semanales t
       LEFT JOIN eventos e ON t.id_ocupacion = e.id
       WHERE t.semana_lunes = ?
       ORDER BY t.fecha_tarea ASC, t.id ASC`,
      [semana_lunes]
    );
    res.json(rows);
  } catch (error) { next(error); }
}

export async function getTareasByOcupacion(req, res, next) {
  try {
    await ensureTables();
    const { id_ocupacion } = req.params;
    const [rows] = await pool.query(
      `SELECT t.*, e.nombre AS evento_institucion, e.nombre_salon AS evento_salon
       FROM tareas_semanales t
       LEFT JOIN eventos e ON t.id_ocupacion = e.id
       WHERE t.id_ocupacion = ?
       ORDER BY t.fecha_tarea ASC, t.id ASC`,
      [id_ocupacion]
    );
    res.json(rows);
  } catch (error) { next(error); }
}

export async function createTarea(req, res, next) {
  try {
    await ensureTables();
    const { semana_lunes, fecha_tarea, contenido, id_ocupacion, usuario_id, usuario_nombre } = req.body;
    if (!usuario_id || !contenido?.trim()) {
      return res.status(400).json({ message: 'usuario_id y contenido son requeridos' });
    }
    const [result] = await pool.query(
      'INSERT INTO tareas_semanales (semana_lunes, fecha_tarea, contenido, id_ocupacion, usuario_id, usuario_nombre) VALUES (?, ?, ?, ?, ?, ?)',
      [semana_lunes, fecha_tarea, contenido.trim(), id_ocupacion || null, usuario_id, usuario_nombre || null]
    );
    const [newTarea] = await pool.query('SELECT * FROM tareas_semanales WHERE id = ?', [result.insertId]);
    await logHistory(result.insertId, 'created', null, contenido.trim(), usuario_id, usuario_nombre);
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
    const [updated] = await pool.query('SELECT * FROM tareas_semanales WHERE id = ?', [id]);
    let accion = 'updated';
    if (completada !== undefined) accion = completada ? 'completed' : 'uncompleted';
    if (no_realizado !== undefined) accion = 'no_realizado';
    if (contenido !== undefined && contenido.trim() !== prev.contenido) accion = 'edited';
    if (id_ocupacion !== undefined && String(id_ocupacion || '') !== String(prev.id_ocupacion || '')) accion = 'edited';
    await logHistory(id, accion, prev.contenido, updated[0].contenido, usuario_id, usuario_nombre);
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

    const [tareasSemanales] = await pool.query(
      `SELECT t.*, e.nombre AS evento_institucion, e.nombre_salon AS evento_salon
       FROM tareas_semanales t
       LEFT JOIN eventos e ON t.id_ocupacion = e.id
       WHERE t.semana_lunes = ?
       ORDER BY t.fecha_tarea ASC, t.id ASC`,
      [semana_lunes]
    );

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
