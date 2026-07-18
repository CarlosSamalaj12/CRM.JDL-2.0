require('dotenv').config();
const mariadb = require('mariadb');

const pool = mariadb.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'crm_jdl',
  connectionLimit: 1
});

async function main() {
  const conn = await pool.getConnection();
  try {
    const rows = await conn.query(`
      SELECT e.id, e.titulo, e.fecha_inicio, e.fecha_fin, e.estado, e.salon_id, e.empresa_id,
             s.nombre as salon_nombre, emp.nombre as empresa_nombre
      FROM eventos e
      LEFT JOIN salones s ON e.salon_id = s.id
      LEFT JOIN empresas emp ON e.empresa_id = emp.id
      WHERE DATE(e.fecha_inicio) = '2026-08-01' OR DATE(e.fecha_fin) = '2026-08-01'
         OR (e.fecha_inicio <= '2026-08-01 23:59:59' AND e.fecha_fin >= '2026-08-01 00:00:00')
      ORDER BY e.fecha_inicio
    `);
    console.log('Eventos en agosto 1:', rows.length);
    console.log(JSON.stringify(rows, null, 2));
  } finally {
    await conn.end();
  }
}

main().catch(console.error);
