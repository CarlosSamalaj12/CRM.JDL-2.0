import pool from '../config/db.js';
import { emitChange } from '../helpers/socketEvents.js';

export async function getTareasUsuario(req, res, next) {
  try {
    const { id_ocupacion } = req.params;
    const { usuario_id } = req.query;
    
    if (!usuario_id) {
      return res.status(400).json({ message: 'usuario_id es requerido' });
    }
    
    const [rows] = await pool.query(
      'SELECT * FROM tareas_evento WHERE id_ocupacion = ? AND usuario_id = ? ORDER BY fecha_creacion DESC',
      [id_ocupacion, usuario_id]
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
}

export async function createTarea(req, res, next) {
  try {
    const { id_ocupacion } = req.params;
    const { usuario_id, usuario_nombre, contenido } = req.body;
    
    if (!usuario_id || !contenido?.trim()) {
      return res.status(400).json({ message: 'usuario_id y contenido son requeridos' });
    }
    
    const [result] = await pool.query(
      'INSERT INTO tareas_evento (id_ocupacion, usuario_id, usuario_nombre, contenido) VALUES (?, ?, ?, ?)',
      [id_ocupacion, usuario_id, usuario_nombre || null, contenido.trim()]
    );
    emitChange(req, 'tarea_evento', 'created', { id: result.insertId, id_ocupacion });
    
    const [newTarea] = await pool.query('SELECT * FROM tareas_evento WHERE id = ?', [result.insertId]);
    res.status(201).json(newTarea[0]);
  } catch (error) {
    next(error);
  }
}

export async function updateTarea(req, res, next) {
  try {
    const { id } = req.params;
    const { completada, contenido } = req.body;
    
    const fields = [];
    const params = [];
    
    if (completada !== undefined) {
      fields.push('completada = ?');
      params.push(completada ? 1 : 0);
    }
    if (contenido !== undefined) {
      fields.push('contenido = ?');
      params.push(contenido.trim());
    }
    
    if (fields.length === 0) {
      return res.status(400).json({ message: 'Sin campos para actualizar' });
    }
    
    params.push(id);
    await pool.query(`UPDATE tareas_evento SET ${fields.join(', ')} WHERE id = ?`, params);
    emitChange(req, 'tarea_evento', 'updated', { id });
    
    const [updated] = await pool.query('SELECT * FROM tareas_evento WHERE id = ?', [id]);
    res.json(updated[0]);
  } catch (error) {
    next(error);
  }
}

export async function deleteTarea(req, res, next) {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM tareas_evento WHERE id = ?', [id]);
    emitChange(req, 'tarea_evento', 'deleted', { id });
    res.json({ message: 'Tarea eliminada' });
  } catch (error) {
    next(error);
  }
}

export async function getTareasEvento(req, res, next) {
  try {
    const { id_ocupacion } = req.params;
    
    const [rows] = await pool.query(
      'SELECT * FROM tareas_evento WHERE id_ocupacion = ? ORDER BY usuario_id, fecha_creacion DESC',
      [id_ocupacion]
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
}
