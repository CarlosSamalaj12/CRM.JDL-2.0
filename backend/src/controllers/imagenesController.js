import pool from '../config/db.js';
import { emitChange } from '../helpers/socketEvents.js';

export async function getImagenes(req, res, next) {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      'SELECT * FROM informe_imagenes WHERE informe_id = ? ORDER BY created_at ASC',
      [id]
    );
    res.json(rows);
  } catch (error) { next(error); }
}

export async function createImagen(req, res, next) {
  try {
    const { id } = req.params;
    const { url, descripcion, dia_id } = req.body;

    if (!url) {
      return res.status(400).json({ message: 'La URL de la imagen es obligatoria' });
    }

    const [result] = await pool.query(
      'INSERT INTO informe_imagenes (informe_id, dia_id, url, descripcion) VALUES (?, ?, ?, ?)',
      [id, dia_id || null, url, descripcion || null]
    );

    emitChange(req, 'informe_imagen', 'created', { id: result.insertId, informe_id: id });
    const [newImg] = await pool.query('SELECT * FROM informe_imagenes WHERE id = ?', [result.insertId]);
    res.status(201).json(newImg[0]);
  } catch (error) { next(error); }
}

export async function uploadImagenFile(req, res, next) {
  try {
    const { id } = req.params;
    if (!req.file) {
      return res.status(400).json({ message: 'El archivo es obligatorio' });
    }

    // Convertir el buffer en memoria a Base64 — sin guardar nada en disco
    const base64 = req.file.buffer.toString('base64');
    const mimeType = req.file.mimetype || 'image/jpeg';
    const dataUrl = `data:${mimeType};base64,${base64}`;

    const descripcion = req.body.descripcion || null;
    const dia_id = req.body.dia_id || null;

    const [result] = await pool.query(
      'INSERT INTO informe_imagenes (informe_id, dia_id, url, descripcion) VALUES (?, ?, ?, ?)',
      [id, dia_id, dataUrl, descripcion]
    );

    emitChange(req, 'informe_imagen', 'created', { id: result.insertId, informe_id: id });
    const [newImg] = await pool.query('SELECT * FROM informe_imagenes WHERE id = ?', [result.insertId]);
    res.status(201).json(newImg[0]);
  } catch (error) { next(error); }
}

export async function deleteImagen(req, res, next) {
  try {
    const { imgId } = req.params;
    // Las imágenes ya no son archivos físicos, solo se elimina el registro de BD
    await pool.query('DELETE FROM informe_imagenes WHERE id = ?', [imgId]);
    emitChange(req, 'informe_imagen', 'deleted', { id: imgId });
    res.json({ message: 'Imagen eliminada' });
  } catch (error) { next(error); }
}
