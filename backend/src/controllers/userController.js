import bcrypt from 'bcryptjs';
import pool from '../config/db.js';

function normalizeRole(role) {
  return String(role || 'Vendedor').trim().toLowerCase();
}

// Listar todos los usuarios incluyendo inactivos.
export async function getUsers(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT
         id,
         nombre,
         correo AS email,
         rol,
         activo,
         creado_en AS fecha_creacion
       FROM usuarios
       ORDER BY nombre ASC`
    );
    res.json(rows);
  } catch (error) { next(error); }
}

export async function createUser(req, res, next) {
  try {
    const { nombre, email, password, rol } = req.body;
    if (!nombre || !email || !password) {
      return res.status(400).json({ message: 'Nombre, email y contrasena requeridos' });
    }

    const [existing] = await pool.query('SELECT id FROM usuarios WHERE correo = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ message: 'El email ya esta registrado' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const userId = `usr_${Date.now()}`;

    await pool.query(
      `INSERT INTO usuarios (
         id,
         nombre,
         nombre_completo,
         correo,
         contrasena,
         rol,
         activo
       ) VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [userId, nombre, nombre, email, passwordHash, normalizeRole(rol)]
    );

    res.status(201).json({
      id: userId,
      nombre,
      email,
      rol: rol || 'Vendedor',
      activo: 1,
    });
  } catch (error) { next(error); }
}

export async function updateUser(req, res, next) {
  try {
    const { id } = req.params;
    const { nombre, email, rol, password, activo } = req.body;

    if (nombre !== undefined) {
      await pool.query(
        'UPDATE usuarios SET nombre = ?, nombre_completo = ? WHERE id = ?',
        [nombre, nombre, id]
      );
    }
    if (email !== undefined) {
      await pool.query('UPDATE usuarios SET correo = ? WHERE id = ?', [email, id]);
    }
    if (rol !== undefined) {
      await pool.query('UPDATE usuarios SET rol = ? WHERE id = ?', [normalizeRole(rol), id]);
    }
    if (activo !== undefined) {
      await pool.query('UPDATE usuarios SET activo = ? WHERE id = ?', [activo, id]);
    }
    if (password) {
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);
      await pool.query('UPDATE usuarios SET contrasena = ? WHERE id = ?', [passwordHash, id]);
    }

    res.json({ message: 'Usuario actualizado' });
  } catch (error) { next(error); }
}

export async function toggleUserActive(req, res, next) {
  try {
    const { id } = req.params;
    const [rows] = await pool.query('SELECT activo FROM usuarios WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    const newState = rows[0].activo ? 0 : 1;
    await pool.query('UPDATE usuarios SET activo = ? WHERE id = ?', [newState, id]);
    res.json({ id, activo: newState });
  } catch (error) { next(error); }
}

export async function deleteUser(req, res, next) {
  try {
    const { id } = req.params;
    const [result] = await pool.query('DELETE FROM usuarios WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    res.json({ message: 'Usuario eliminado permanentemente' });
  } catch (error) { next(error); }
}
