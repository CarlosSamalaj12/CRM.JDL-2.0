import pool from '../config/db.js';

/**
 * Bloque reutilizable para unir `notificaciones` con su `posible_venta`
 * ligada y, si existe, con el `evento` correspondiente.
 *
 * Tolera los ids con sufijo `_s<n>_<ts>` que genera el slot-expander
 * (un grupo de slots comparte el mismo id base y todos los slots de un
 * mismo `evento` tienen el mismo `estado`).
 *
 * Devuelve:
 *   - `evento_id_lookup`  → el id que matchea (puede ser el id base o el
 *                           de un slot concreto), o NULL si no hay evento.
 *   - `evento_estado`     → el estado actual del evento, o NULL.
 *
 * La subquery correlacionada se evalúa de forma lazy: el `IF(... IS NOT NULL, ...)`
 * garantiza que el subquery SOLO corre cuando `pv.evento_id` existe. Esto
 * evita trabajo wasted para notifs que no son `posible_venta` (donde el LEFT
 * JOIN da NULL) y para leads aún no convertidos a reserva.
 */
const POSIBLE_VENTA_ENRICH = `
  LEFT JOIN posibles_ventas pv
    ON pv.id = n.idocupacion
   AND n.tipo = 'posible_venta'
`;
const POSIBLE_VENTA_ENRICH_COLUMNS = `
  , IF(pv.evento_id IS NOT NULL, pv.evento_id, NULL) AS evento_id_lookup
  , IF(pv.evento_id IS NOT NULL, (
      SELECT e.estado
        FROM eventos e
       WHERE e.id = pv.evento_id
          OR e.id = SUBSTRING_INDEX(pv.evento_id, '_s', 1)
       LIMIT 1
    ), NULL) AS evento_estado
`;

/**
 * Predicado SQL para excluir las notifs `posible_venta` cuya reserva ligada
 * ya está en Seguimiento. Aplica el mismo matching con sufijo.
 */
function seguimientoExcludeClause() {
  return `
    NOT (
      n.tipo = 'posible_venta'
      AND pv.evento_id IS NOT NULL
      AND (
        SELECT e.estado
          FROM eventos e
         WHERE e.id = pv.evento_id
            OR e.id = SUBSTRING_INDEX(pv.evento_id, '_s', 1)
         LIMIT 1
      ) = 'Seguimiento'
    )
  `;
}

/**
 * Limpia las filas traídas por la query enriquecida antes de devolver al
 * cliente: omite las que ya están en Seguimiento y reasigna los nombres
 * de campo a camelCase para el frontend.
 */
function annotateAndFilterNotifs(rows) {
  const out = [];
  for (const r of rows) {
    if (r.tipo === 'posible_venta' && r.evento_estado === 'Seguimiento') {
      // Ya tiene seguimiento: la notif ya cumplió su propósito y la
      // ocultamos del listado (y del contador).
      continue;
    }
    out.push({
      ...r,
      // Solo exponer el alias enriquecido a las notifs de posible_venta;
      // para el resto los campos quedan en null.
      eventoId: r.tipo === 'posible_venta' ? (r.evento_id_lookup || null) : null,
      eventoEstado: r.tipo === 'posible_venta' ? (r.evento_estado || null) : null,
    });
  }
  return out;
}

export async function getNotificaciones(req, res, next) {
  try {
    const usuario_id = req.user?.id;
    const { solo_no_leidas } = req.query;

    const whereLeido = solo_no_leidas === 'true' ? 'AND n.leido = 0' : '';

    // El filtrado de Seguimiento se hace en SQL (no en JS) para garantizar
    // que el `LIMIT 20` traiga SIEMPRE hasta 20 notifs VISIBLES, no 20
    // brutas con algunas filtradas después.
    const query = `
      SELECT n.* ${POSIBLE_VENTA_ENRICH_COLUMNS}
        FROM notificaciones n
        ${POSIBLE_VENTA_ENRICH}
       WHERE (n.usuario_id = ? OR n.usuario_id IS NULL)
         ${whereLeido}
         AND ${seguimientoExcludeClause()}
       ORDER BY n.fecha_creacion DESC
       LIMIT 20
    `;
    const [rows] = await pool.query(query, [usuario_id]);
    res.json(annotateAndFilterNotifs(rows));
  } catch (error) { next(error); }
}

export async function getNoLeidasCount(req, res, next) {
  try {
    const usuario_id = req.user?.id;
    const query = `
      SELECT COUNT(*) AS count
        FROM notificaciones n
        ${POSIBLE_VENTA_ENRICH}
       WHERE (n.usuario_id = ? OR n.usuario_id IS NULL)
         AND n.leido = 0
         AND ${seguimientoExcludeClause()}
    `;
    const [rows] = await pool.query(query, [usuario_id]);
    res.json({ count: rows[0].count });
  } catch (error) { next(error); }
}

export async function marcarLeida(req, res, next) {
  try {
    const { id } = req.params;
    const usuario_id = req.user?.id;
    await pool.query(
      'UPDATE notificaciones SET leido = 1 WHERE id = ? AND (usuario_id = ? OR usuario_id IS NULL)',
      [id, usuario_id]
    );
    res.json({ message: 'Notificación marcada como leída' });
  } catch (error) { next(error); }
}

export async function marcarTodasLeidas(req, res, next) {
  try {
    const usuario_id = req.user?.id;
    // Marca como leídas todas las que aún se muestran en el listado (las
    // de posible_venta con reserva en Seguimiento ya están "ocultas" y
    // el cliente las ignora).
    const query = `
      UPDATE notificaciones n
        ${POSIBLE_VENTA_ENRICH}
       SET n.leido = 1
     WHERE (n.usuario_id = ? OR n.usuario_id IS NULL)
       AND n.leido = 0
       AND ${seguimientoExcludeClause()}
    `;
    await pool.query(query, [usuario_id]);
    res.json({ message: 'Todas las notificaciones marcadas como leídas' });
  } catch (error) { next(error); }
}
