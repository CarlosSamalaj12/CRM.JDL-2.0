require('dotenv').config();
const mariadb = require('mariadb');
(async () => {
  const pool = mariadb.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'crm_jdl',
    connectionLimit: 2,
    acquireTimeout: 8000,
  });
  let conn;
  try {
    conn = await pool.getConnection();
    const cols = await conn.query(
      "SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT " +
      "FROM information_schema.columns " +
      "WHERE table_schema = ? AND table_name = 'posibles_ventas' AND column_name = 'asignado_en'",
      [process.env.DB_NAME || 'crm_jdl']
    );
    const idx = await conn.query(
      "SELECT INDEX_NAME, COLUMN_NAME, SEQ_IN_INDEX " +
      "FROM information_schema.statistics " +
      "WHERE table_schema = ? AND table_name = 'posibles_ventas' " +
      "AND index_name = 'idx_posibles_ventas_asignado_en' ORDER BY SEQ_IN_INDEX",
      [process.env.DB_NAME || 'crm_jdl']
    );
    const sample = await conn.query(
      "SELECT id, nombre_cliente, vendedor_id, asignado_en, creado_en " +
      "FROM posibles_ventas WHERE deleted_at IS NULL ORDER BY id DESC LIMIT 3"
    );
    console.log('COLUMNA:', JSON.stringify(cols, null, 2));
    console.log('INDICE:', JSON.stringify(idx, null, 2));
    console.log('MUESTRA:', JSON.stringify(sample, null, 2));
  } catch (err) {
    console.error('ERR:', err.message);
    process.exit(1);
  } finally {
    if (conn) conn.release();
    await pool.end();
  }
})();
