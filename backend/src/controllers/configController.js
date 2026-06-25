import pool from '../config/db.js';

// ─── GENERIC CRUD HELPER ───
function makeCrud(table) {
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
        if (!nombre) return res.status(400).json({ message: 'Nombre requerido' });
        const [result] = await pool.query(`INSERT INTO ${table} (nombre) VALUES (?)`, [nombre]);
        res.status(201).json({ id: result.insertId, nombre, activo: 1 });
      } catch (error) { next(error); }
    },
    async update(req, res, next) {
      try {
        const { id } = req.params;
        const { nombre, activo } = req.body;
        if (nombre !== undefined) await pool.query(`UPDATE ${table} SET nombre = ? WHERE id = ?`, [nombre, id]);
        if (activo !== undefined) await pool.query(`UPDATE ${table} SET activo = ? WHERE id = ?`, [activo, id]);
        res.json({ message: 'Actualizado' });
      } catch (error) { next(error); }
    },
    async remove(req, res, next) {
      try {
        const { id } = req.params;
        await pool.query(`DELETE FROM ${table} WHERE id = ?`, [id]);
        res.json({ message: 'Eliminado' });
      } catch (error) { next(error); }
    },
  };
}

// ─── EXPORT CRUD FOR EACH TABLE ───
export const equipoCtrl = makeCrud('config_equipo');
export const sillaCtrl = makeCrud('config_tipo_silla');
export const mesaCtrl = makeCrud('config_tipo_mesa');
export const formaPagoCtrl = makeCrud('config_forma_pago');
