import pool from '../config/db.js';
import path from 'path';
import fs from 'fs';

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
    const url = `/uploads/${req.file.filename}`;
    const descripcion = req.body.descripcion || null;
    const dia_id = req.body.dia_id || null;

    const [result] = await pool.query(
      'INSERT INTO informe_imagenes (informe_id, dia_id, url, descripcion) VALUES (?, ?, ?, ?)',
      [id, dia_id, url, descripcion]
    );

    const [newImg] = await pool.query('SELECT * FROM informe_imagenes WHERE id = ?', [result.insertId]);
    res.status(201).json(newImg[0]);
  } catch (error) { next(error); }
}

export async function deleteImagen(req, res, next) {
  try {
    const { imgId } = req.params;
    const [img] = await pool.query('SELECT * FROM informe_imagenes WHERE id = ?', [imgId]);
    if (img.length > 0 && img[0].url && img[0].url.startsWith('/uploads/')) {
      const filePath = path.join(process.cwd(), img[0].url);
      try { fs.unlinkSync(filePath); } catch { /* file may not exist */ }
    }
    await pool.query('DELETE FROM informe_imagenes WHERE id = ?', [imgId]);
    res.json({ message: 'Imagen eliminada' });
  } catch (error) { next(error); }
}
