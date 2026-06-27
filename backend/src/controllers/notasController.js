import pool from '../config/db.js';

export async function getNotas(req, res, next) {
  try {
    const { idocupacion } = req.params;
    const [rows] = await pool.query(`
      SELECT n.*, u.nombre AS usuario_nombre
      FROM event_notas n
      LEFT JOIN usuarios u ON n.usuario_id = u.id
      WHERE n.idocupacion = ?
      ORDER BY n.created_at ASC
    `, [idocupacion]);

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
    res.json(rows);
  } catch (error) { next(error); }
}

export async function toggleReaccionNota(req, res, next) {
  try {
    const { id } = req.params;
    const { reaccion } = req.body;
    const usuario_id = req.user?.id;
    if (!usuario_id) return res.status(401).json({ message: 'No autenticado' });
    if (!reaccion) return res.status(400).json({ message: 'Reacción requerida' });

    const [rows] = await pool.query('SELECT reacciones FROM event_notas WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Nota no encontrada' });

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
    await pool.query('UPDATE event_notas SET reacciones = ? WHERE id = ?', [jsonStr, id]);

    const [updated] = await pool.query(`
      SELECT n.*, u.nombre AS usuario_nombre
      FROM event_notas n
      LEFT JOIN usuarios u ON n.usuario_id = u.id
      WHERE n.id = ?
    `, [id]);

    const nota = updated[0];
    if (nota) {
      try { nota.reacciones = nota.reacciones ? JSON.parse(nota.reacciones) : {}; } catch { nota.reacciones = {}; }
      req.io.to(`evento:${nota.idocupacion}`).emit('nota:created', nota);
    }
    res.json(nota);
  } catch (error) { next(error); }
}

export async function createNota(req, res, next) {
  try {
    const { idocupacion } = req.params;
    const { contenido, mencion_a_id } = req.body;
    const usuario_id = req.user?.id;
    console.log('[DEBUG] createNota: idocupacion =', idocupacion, ', usuario_id =', usuario_id);

    if (!usuario_id) {
      return res.status(401).json({ message: 'Debes iniciar sesión' });
    }

    if (!contenido || !contenido.trim()) {
      return res.status(400).json({ message: 'El contenido es obligatorio' });
    }

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
      'INSERT INTO event_notas (idocupacion, usuario_id, contenido, mencion_a_id) VALUES (?, ?, ?, ?)',
      [idocupacion, usuario_id, contenido, mencionStr]
    );

    if (mencionIds.length > 0) {
      const [userRow] = await pool.query('SELECT nombre FROM usuarios WHERE id = ?', [usuario_id]);
      const nombreUsuario = userRow[0]?.nombre || 'Alguien';
      const notaId = result.insertId;
      for (const mid of mencionIds) {
        await pool.query(
          'INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, idocupacion, comentario_id) VALUES (?, ?, ?, ?, ?, ?)',
          [mid, 'mencion', `Te mencionaron en una nota`, `${nombreUsuario} te mencionó en una nota del evento`, idocupacion, notaId]
        );
        req.io.to(`usuario:${mid}`).emit('notificacion:created', {
          tipo: 'mencion',
          titulo: `Te mencionaron en una nota`,
          mensaje: `${nombreUsuario} te mencionó en una nota del evento`,
          nota_id: notaId,
          idocupacion
        });
      }
    }

    const [newNota] = await pool.query(`
      SELECT n.*, u.nombre AS usuario_nombre
      FROM event_notas n
      LEFT JOIN usuarios u ON n.usuario_id = u.id
      WHERE n.id = ?
    `, [result.insertId]);

    const nota = newNota[0];
    req.io.to(`evento:${idocupacion}`).emit('nota:created', nota);
    res.status(201).json(nota);
  } catch (error) { next(error); }
}
