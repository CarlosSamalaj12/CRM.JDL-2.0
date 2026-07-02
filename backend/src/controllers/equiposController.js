import pool from '../config/db.js';
import { emitChange } from '../helpers/socketEvents.js';

export async function getEquipos(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT e.id, e.nombre, e.descripcion, e.creado_en,
        (SELECT COUNT(*) FROM usuarios u WHERE u.equipo_id = e.id) AS miembros
       FROM equipos_trabajo e
       ORDER BY e.nombre ASC`
    );
    res.json(rows);
  } catch (error) { next(error); }
}

export async function createEquipo(req, res, next) {
  try {
    const { nombre, descripcion } = req.body;
    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ message: 'El nombre del equipo es requerido' });
    }
    const nombreTrim = nombre.trim();
    const [existing] = await pool.query('SELECT id FROM equipos_trabajo WHERE LOWER(nombre) = LOWER(?)', [nombreTrim]);
    if (existing.length > 0) {
      return res.status(409).json({ message: `Ya existe un equipo llamado "${nombreTrim}"` });
    }
    const [result] = await pool.query(
      'INSERT INTO equipos_trabajo (nombre, descripcion) VALUES (?, ?)',
      [nombreTrim, descripcion?.trim() || null]
    );
    emitChange(req, 'equipo_trabajo', 'created', { id: result.insertId });
    const [nuevo] = await pool.query('SELECT * FROM equipos_trabajo WHERE id = ?', [result.insertId]);
    res.status(201).json(nuevo[0]);
  } catch (error) { next(error); }
}

export async function updateEquipo(req, res, next) {
  try {
    const { id } = req.params;
    const { nombre, descripcion } = req.body;
    const updates = [];
    const values = [];
    if (nombre !== undefined) {
      const nombreTrim = nombre.trim();
      if (!nombreTrim) return res.status(400).json({ message: 'El nombre del equipo no puede estar vacío' });
      const [existing] = await pool.query('SELECT id FROM equipos_trabajo WHERE LOWER(nombre) = LOWER(?) AND id != ?', [nombreTrim, id]);
      if (existing.length > 0) {
        return res.status(409).json({ message: `Ya existe otro equipo llamado "${nombreTrim}"` });
      }
      updates.push('nombre = ?'); values.push(nombreTrim);
    }
    if (descripcion !== undefined) { updates.push('descripcion = ?'); values.push(descripcion?.trim() || null); }
    if (updates.length === 0) return res.status(400).json({ message: 'Sin campos para actualizar' });
    values.push(id);
    const [result] = await pool.query(
      `UPDATE equipos_trabajo SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Equipo no encontrado' });
    emitChange(req, 'equipo_trabajo', 'updated', { id });
    const [updated] = await pool.query('SELECT * FROM equipos_trabajo WHERE id = ?', [id]);
    res.json(updated[0]);
  } catch (error) { next(error); }
}

export async function deleteEquipo(req, res, next) {
  try {
    const { id } = req.params;
    await pool.query('UPDATE usuarios SET equipo_id = NULL WHERE equipo_id = ?', [id]);
    const [result] = await pool.query('DELETE FROM equipos_trabajo WHERE id = ?', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Equipo no encontrado' });
    emitChange(req, 'equipo_trabajo', 'deleted', { id });
    res.json({ message: 'Equipo eliminado' });
  } catch (error) { next(error); }
}
