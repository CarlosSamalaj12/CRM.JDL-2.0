import pool from '../config/db.js';
import { emitChange } from '../helpers/socketEvents.js';

// ─── Guardar/actualizar montaje de un día ───
export async function saveMontaje(req, res, next) {
  try {
    const { dia_id } = req.params;
    const { tipo_montaje, num_personas, ubicacion, horario, observaciones,
            equipo_necesario, manteleria, cristaleria, mesas, sillas,
            estacion_cafe, estacion_bebidas, buffet, servicio_emplatado,
            desayunos, habitaciones } = req.body;

    const montajeJson = JSON.stringify({
      tipo_montaje, num_personas, ubicacion, horario, observaciones,
      equipo_necesario, manteleria, cristaleria, mesas, sillas,
      estacion_cafe, estacion_bebidas, buffet, servicio_emplatado,
      desayunos, habitaciones,
      actualizado: new Date().toISOString(),
    });

    await pool.query(
      'UPDATE informe_dias_detalle SET descripcion_montaje = ? WHERE id = ?',
      [montajeJson, dia_id]
    );

    // Registrar en historial (obtener informe_id del día)
    const [diaRow] = await pool.query('SELECT informe_id FROM informe_dias_detalle WHERE id = ?', [dia_id]);
    if (diaRow.length > 0 && req.user?.id) {
      await pool.query(
        'INSERT INTO informe_historial (informe_id, usuario_id, accion, descripcion) VALUES (?, ?, ?, ?)',
        [diaRow[0].informe_id, req.user.id, 'montaje', 'Actualizó la descripción de montaje']
      );
    }

    emitChange(req, 'montaje', 'updated', { dia_id });
    res.json({ message: 'Montaje guardado correctamente', montaje: JSON.parse(montajeJson) });
  } catch (error) { next(error); }
}

// ─── Obtener montaje de un día ───
export async function getMontaje(req, res, next) {
  try {
    const { dia_id } = req.params;
    const [rows] = await pool.query(
      'SELECT id, descripcion_montaje FROM informe_dias_detalle WHERE id = ?',
      [dia_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Día no encontrado' });
    }

    let montaje = {};
    if (rows[0].descripcion_montaje) {
      try {
        montaje = JSON.parse(rows[0].descripcion_montaje);
      } catch {
        montaje = { descripcion: rows[0].descripcion_montaje };
      }
    }

    res.json({ dia_id: Number(dia_id), ...montaje });
  } catch (error) { next(error); }
}

// ─── Obtener tipos de montaje sugeridos ───
export async function getTiposMontaje(req, res, next) {
  const tipos = [
    'Escuela', 'Imperial', 'Banquete', 'Cóctel', 'Auditorio',
    'Mesa redonda', 'Buffet', 'U', 'Presidencial', 'Personalizado'
  ];
  res.json(tipos);
}
