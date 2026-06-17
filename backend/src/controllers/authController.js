import pool from '../config/db.js';

export async function me(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT id, nombre, nombre_completo, nombre_usuario, correo AS email, rol, creado_en AS fecha_creacion
       FROM usuarios WHERE id = ?`,
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    res.json(rows[0]);
  } catch (error) {
    next(error);
  }
}
