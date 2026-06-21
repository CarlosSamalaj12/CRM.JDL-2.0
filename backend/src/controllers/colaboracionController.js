import pool from '../config/db.js';

// ==============================
// COMENTARIOS
// ==============================

export async function getComentarios(req, res, next) {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(`
      SELECT c.*, u.nombre AS usuario_nombre
      FROM informe_comentarios c
      LEFT JOIN usuarios u ON c.usuario_id = u.id
      WHERE c.informe_id = ?
      ORDER BY c.created_at ASC
    `, [id]);

    // Resolve mention names & reactions
    for (const row of rows) {
      try { row.reacciones = row.reacciones ? JSON.parse(row.reacciones) : {}; } catch { row.reacciones = {}; }
      if (row.mencion_a_id) {
        const ids = row.mencion_a_id.split(',').filter(Boolean);
        if (ids.length > 0) {
          const placeholders = ids.map(() => '?').join(',');
          const [users] = await pool.query(`SELECT id, nombre FROM usuarios WHERE id IN (${placeholders})`, ids);
          row.menciones = users;
        } else {
          row.menciones = [];
        }
      } else {
        row.menciones = [];
      }
    }

    // Organizar comentarios en estructura de hilos
    const comentariosMap = {};
    const comentariosRaiz = [];

    rows.forEach(c => {
      comentariosMap[c.id] = { ...c, respuestas: [] };
    });

    rows.forEach(c => {
      if (c.parent_id && comentariosMap[c.parent_id]) {
        comentariosMap[c.parent_id].respuestas.push(comentariosMap[c.id]);
      } else {
        comentariosRaiz.push(comentariosMap[c.id]);
      }
    });

    res.json(comentariosRaiz);
  } catch (error) { next(error); }
}

export async function createComentario(req, res, next) {
  try {
    const { id } = req.params;
    const { contenido, dia_id, mencion_a_id, parent_id } = req.body;
    const usuario_id = req.user?.id;
    console.log('[DEBUG] createComentario: id =', id, ', usuario_id =', usuario_id, ', parent_id =', parent_id);

    if (!usuario_id) {
      return res.status(401).json({ message: 'Debes iniciar sesión para comentar' });
    }

    // mencion_a_id can be an array of IDs or a comma-separated string
    let mencionStr = null;
    let mencionIds = [];
    if (mencion_a_id) {
      if (Array.isArray(mencion_a_id)) {
        mencionIds = mencion_a_id.map(id => String(id).trim()).filter(Boolean);
      } else if (typeof mencion_a_id === 'string') {
        mencionIds = mencion_a_id.split(',').map(id => id.trim()).filter(Boolean);
      } else {
        mencionIds = [String(mencion_a_id).trim()];
      }
      mencionStr = mencionIds.join(',');
    }

    const [result] = await pool.query(
      'INSERT INTO informe_comentarios (informe_id, dia_id, parent_id, usuario_id, contenido, mencion_a_id) VALUES (?, ?, ?, ?, ?, ?)',
      [id, dia_id || null, parent_id || null, usuario_id, contenido, mencionStr]
    );

    // Registrar en historial
    await pool.query(
      'INSERT INTO informe_historial (informe_id, usuario_id, accion, descripcion) VALUES (?, ?, ?, ?)',
      [id, usuario_id, 'comentario', parent_id ? 'Respondió a un comentario' : 'Agregó un comentario al informe']
    );

    // Si es una respuesta, notificar al autor del comentario padre
    if (parent_id) {
      const [parentComment] = await pool.query(
        'SELECT usuario_id FROM informe_comentarios WHERE id = ?',
        [parent_id]
      );
      
      if (parentComment.length > 0 && parentComment[0].usuario_id !== usuario_id) {
        const [userRow] = await pool.query('SELECT nombre FROM usuarios WHERE id = ?', [usuario_id]);
        const nombreUsuario = userRow[0]?.nombre || 'Alguien';
        
        await pool.query(
          'INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, informe_id, idocupacion, comentario_id) VALUES (?, ?, ?, ?, ?, (SELECT id_ocupacion FROM informes_eventos WHERE id = ?), ?)',
          [parentComment[0].usuario_id, 'respuesta', `${nombreUsuario} respondió a tu comentario`, `${nombreUsuario} respondió a tu comentario en el informe`, id, id, result.insertId]
        );
      }
    }

    // Si hay menciones, crear notificaciones
    if (mencionIds.length > 0) {
      const [userRow] = await pool.query('SELECT nombre FROM usuarios WHERE id = ?', [usuario_id]);
      const nombreUsuario = userRow[0]?.nombre || 'Alguien';
      for (const mid of mencionIds) {
        await pool.query(
          'INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, informe_id, idocupacion, comentario_id) VALUES (?, ?, ?, ?, ?, (SELECT id_ocupacion FROM informes_eventos WHERE id = ?), ?)',
          [mid, 'mencion', `Te mencionaron en un comentario`, `${nombreUsuario} te mencionó en el informe`, id, id, result.insertId]
        );
      }
    }

    // Obtener el comentario creado con datos del usuario
    const [newComment] = await pool.query(`
      SELECT c.*, u.nombre AS usuario_nombre
      FROM informe_comentarios c
      LEFT JOIN usuarios u ON c.usuario_id = u.id
      WHERE c.id = ?
    `, [result.insertId]);

    const comentario = newComment[0];
    const [inf] = await pool.query('SELECT id_ocupacion FROM informes_eventos WHERE id = ?', [id]);
    if (inf.length > 0) {
      // Emitir el evento con el informe_id incluido
      req.io.to(`evento:${inf[0].id_ocupacion}`).emit('comentario:created', {
        ...comentario,
        informe_id: parseInt(id)
      });
    }
    res.status(201).json(comentario);
  } catch (error) { next(error); }
}

// ==============================
// LECTURAS (ENTERADO)
// ==============================

export async function marcarLeido(req, res, next) {
  try {
    const { id } = req.params;
    const usuario_id = req.user?.id;
    if (!usuario_id) return res.status(401).json({ message: 'No autenticado' });

    await pool.query(
      'INSERT INTO informe_lecturas (informe_id, usuario_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE leido_at = CURRENT_TIMESTAMP',
      [id, usuario_id]
    );

    await pool.query(
      'INSERT INTO informe_historial (informe_id, usuario_id, accion, descripcion) VALUES (?, ?, ?, ?)',
      [id, usuario_id, 'lectura', 'Marcó el informe como leído']
    );

    res.json({ message: 'ok' });
  } catch (error) { next(error); }
}

export async function getLecturas(req, res, next) {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(`
      SELECT l.*, u.nombre AS usuario_nombre
      FROM informe_lecturas l
      JOIN usuarios u ON l.usuario_id = u.id
      WHERE l.informe_id = ?
      ORDER BY l.leido_at ASC
    `, [id]);
    res.json(rows);
  } catch (error) { next(error); }
}

// ==============================
// DESTACADOS (ÉNFASIS)
// ==============================

export async function toggleDestacado(req, res, next) {
  try {
    const { id } = req.params;
    const { dia_id, razon } = req.body;
    const usuario_id = req.user?.id;
    if (!usuario_id) return res.status(401).json({ message: 'No autenticado' });

    const [existing] = await pool.query(
      'SELECT id FROM informe_destacados WHERE informe_id = ? AND dia_id IS NULL AND usuario_id = ?',
      [id, usuario_id]
    );

    if (existing.length > 0) {
      await pool.query('DELETE FROM informe_destacados WHERE id = ?', [existing[0].id]);
      res.json({ destacado: false });
    } else {
      await pool.query(
        'INSERT INTO informe_destacados (informe_id, dia_id, usuario_id, razon) VALUES (?, ?, ?, ?)',
        [id, dia_id || null, usuario_id, razon || null]
      );
      await pool.query(
        'INSERT INTO informe_historial (informe_id, usuario_id, accion, descripcion) VALUES (?, ?, ?, ?)',
        [id, usuario_id, 'destacado', 'Destacó una sección del informe']
      );
      res.json({ destacado: true });
    }
  } catch (error) { next(error); }
}

export async function getDestacados(req, res, next) {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(`
      SELECT d.*, u.nombre AS usuario_nombre
      FROM informe_destacados d
      JOIN usuarios u ON d.usuario_id = u.id
      WHERE d.informe_id = ?
      ORDER BY d.created_at DESC
    `, [id]);
    res.json(rows);
  } catch (error) { next(error); }
}

// ==============================
// HISTORIAL
// ==============================

export async function getHistorial(req, res, next) {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(`
      SELECT h.*, u.nombre AS usuario_nombre
      FROM informe_historial h
      JOIN usuarios u ON h.usuario_id = u.id
      WHERE h.informe_id = ?
      ORDER BY h.created_at DESC
      LIMIT 50
    `, [id]);
    res.json(rows);
  } catch (error) { next(error); }
}

// ==============================
// REACCIONES
// ==============================

export async function toggleReaccion(req, res, next) {
  try {
    const { id, comentarioId } = req.params;
    const { reaccion } = req.body;
    const usuario_id = req.user?.id;
    if (!usuario_id) return res.status(401).json({ message: 'No autenticado' });
    if (!reaccion) return res.status(400).json({ message: 'Reacción requerida' });

    const [rows] = await pool.query('SELECT reacciones FROM informe_comentarios WHERE id = ? AND informe_id = ?', [comentarioId, id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Comentario no encontrado' });

    let reacciones = {};
    try { reacciones = JSON.parse(rows[0].reacciones) || {}; } catch { reacciones = {}; }

    if (!reacciones[reaccion]) reacciones[reaccion] = [];
    const idx = reacciones[reaccion].indexOf(usuario_id);
    if (idx >= 0) {
      reacciones[reaccion].splice(idx, 1);
      if (reacciones[reaccion].length === 0) delete reacciones[reaccion];
    } else {
      reacciones[reaccion].push(usuario_id);
    }

    const jsonStr = Object.keys(reacciones).length > 0 ? JSON.stringify(reacciones) : null;
    await pool.query('UPDATE informe_comentarios SET reacciones = ? WHERE id = ?', [jsonStr, comentarioId]);

    const [updated] = await pool.query(`
      SELECT c.*, u.nombre AS usuario_nombre
      FROM informe_comentarios c
      LEFT JOIN usuarios u ON c.usuario_id = u.id
      WHERE c.id = ?
    `, [comentarioId]);

    const comentario = updated[0];
    const [inf] = await pool.query('SELECT id_ocupacion FROM informes_eventos WHERE id = ?', [id]);
    if (inf.length > 0) {
      req.io.to(`evento:${inf[0].id_ocupacion}`).emit('comentario:created', comentario);
    }
    res.json(comentario);
  } catch (error) { next(error); }
}

// ==============================
// USUARIOS PARA MENCIONES
// ==============================

export async function getUsuarios(req, res, next) {
  try {
    const [rows] = await pool.query('SELECT id, nombre, correo AS email, rol FROM usuarios WHERE activo = 1 ORDER BY nombre');
    res.json(rows);
  } catch (error) { next(error); }
}
