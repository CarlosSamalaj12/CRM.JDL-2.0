import pool from './backend/src/config/db.js';

async function test() {
  const LINKED_EVENT_JOIN = `
    LEFT JOIN eventos e_direct
      ON e_direct.id = pv.evento_id
      OR (
        e_direct.id = SUBSTRING_INDEX(pv.evento_id, '_s', 1)
        AND NOT EXISTS (SELECT 1 FROM eventos e_sub WHERE e_sub.id = pv.evento_id)
      )
    LEFT JOIN usuarios u_direct
      ON u_direct.id = e_direct.id_usuario
    LEFT JOIN tbl_seguimientocotizaciones ev
      ON ev.Idocupacion = pv.evento_id
      OR (
        ev.Idocupacion = SUBSTRING_INDEX(pv.evento_id, '_s', 1)
        AND NOT EXISTS (SELECT 1 FROM tbl_seguimientocotizaciones ev_sub WHERE ev_sub.Idocupacion = pv.evento_id)
      )
    LEFT JOIN usuarios u_legacy
      ON TRIM(u_legacy.nombre) = TRIM(ev.Vendedor)
  `;

  const [rows] = await pool.query(`
    SELECT pv.id, pv.nombre_cliente, e_direct.id as ed_id, ev.Idocupacion as ev_id, u_legacy.id as ul_id
    FROM posibles_ventas pv
    ${LINKED_EVENT_JOIN}
    WHERE pv.deleted_at IS NOT NULL AND pv.id = 9
  `);
  console.log('Result count for ID 9:', rows.length, rows);
  process.exit(0);
}
test();
