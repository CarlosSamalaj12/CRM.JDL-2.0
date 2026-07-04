import pool from '../config/db.js';

export async function guardarToken(req, res, next) {
  try {
    const usuario_id = req.user?.id;
    const { token, dispositivo } = req.body;

    if (!usuario_id) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    if (!token) {
      return res.status(400).json({ error: 'Token es requerido' });
    }

    // Insertar token vinculando al usuario
    await pool.query(
      `INSERT INTO usuarios_fcm_tokens (usuario_id, token, dispositivo) 
       VALUES (?, ?, ?) 
       ON DUPLICATE KEY UPDATE dispositivo = VALUES(dispositivo)`,
      [usuario_id, token, dispositivo || null]
    );

    res.status(200).json({ message: 'Token FCM guardado con éxito' });
  } catch (error) {
    next(error);
  }
}
