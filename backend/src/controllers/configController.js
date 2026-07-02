import pool from '../config/db.js';
import { emitChange } from '../helpers/socketEvents.js';

// ─── GENERIC CRUD HELPER ───
function makeCrud(table, entity) {
  return {
    async getAll(req, res, next) {
      try {
        const [rows] = await pool.query(`SELECT * FROM ${table} ORDER BY nombre ASC`);
        res.json(rows);
      } catch (error) { next(error); }
    },
    async create(req, res, next) {
      try {
        const { nombre } = req.body;
        if (!nombre || !String(nombre).trim()) return res.status(400).json({ message: 'Nombre requerido' });
        const nombreTrim = String(nombre).trim();
        const [existing] = await pool.query(`SELECT id FROM ${table} WHERE LOWER(nombre) = LOWER(?)`, [nombreTrim]);
        if (existing.length > 0) {
          return res.status(409).json({ message: `Ya existe un registro con el nombre "${nombreTrim}"` });
        }
        const [result] = await pool.query(`INSERT INTO ${table} (nombre) VALUES (?)`, [nombreTrim]);
        emitChange(req, entity, 'created', { id: result.insertId });
        res.status(201).json({ id: result.insertId, nombre: nombreTrim, activo: 1 });
      } catch (error) { next(error); }
    },
    async update(req, res, next) {
      try {
        const { id } = req.params;
        const { nombre, activo } = req.body;
        if (nombre !== undefined) {
          const nombreTrim = String(nombre).trim();
          if (!nombreTrim) return res.status(400).json({ message: 'El nombre no puede estar vacío' });
          const [existing] = await pool.query(`SELECT id FROM ${table} WHERE LOWER(nombre) = LOWER(?) AND id != ?`, [nombreTrim, id]);
          if (existing.length > 0) {
            return res.status(409).json({ message: `Ya existe otro registro con el nombre "${nombreTrim}"` });
          }
          await pool.query(`UPDATE ${table} SET nombre = ? WHERE id = ?`, [nombreTrim, id]);
        }
        if (activo !== undefined) await pool.query(`UPDATE ${table} SET activo = ? WHERE id = ?`, [activo, id]);
        emitChange(req, entity, 'updated', { id });
        res.json({ message: 'Actualizado' });
      } catch (error) { next(error); }
    },
    async remove(req, res, next) {
      try {
        const { id } = req.params;
        await pool.query(`DELETE FROM ${table} WHERE id = ?`, [id]);
        emitChange(req, entity, 'deleted', { id });
        res.json({ message: 'Eliminado' });
      } catch (error) { next(error); }
    },
  };
}

// ─── EXPORT CRUD FOR EACH TABLE ───
export const equipoCtrl = makeCrud('config_equipo', 'equipo');
export const sillaCtrl = makeCrud('config_tipo_silla', 'tipo_silla');
export const mesaCtrl = makeCrud('config_tipo_mesa', 'tipo_mesa');
export const formaPagoCtrl = makeCrud('config_forma_pago', 'forma_pago');
