const mariadb = require('mariadb');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

function formatQuoteCode(num) {
  return `COT-${String(Math.floor(num)).padStart(3, '0')}`;
}

function parseQuoteCodeNumber(rawCode) {
  const m = String(rawCode || '').trim().toUpperCase().match(/^COT-(\d{1,})$/);
  if (!m) return 0;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

async function main() {
  const pool = mariadb.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3307),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '2022',
    database: process.env.DB_NAME || 'crm_jdl',
    connectionLimit: 2,
    collation: 'utf8mb4_unicode_ci',
  });

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    // 1. Find duplicate codigos
    const duplicates = await conn.query(`
      SELECT codigo, COUNT(*) AS cantidad
      FROM cotizaciones_evento
      WHERE codigo IS NOT NULL AND codigo != ''
      GROUP BY codigo
      HAVING COUNT(*) > 1
      ORDER BY codigo
    `);

    if (!duplicates || duplicates.length === 0) {
      console.log('No se encontraron codigos duplicados en cotizaciones_evento.');
    } else {
      console.log(`Se encontraron ${duplicates.length} codigos duplicados:\n`);

      // Get current max from doc_sequence to start from there
      const seqRow = await conn.query(
        `SELECT last_value FROM doc_sequence WHERE scope = 'COT' LIMIT 1`,
      );
      let nextSeqNum = Math.max(1, Number(seqRow?.[0]?.last_value || 0));

      // Also check max existing codigo in DB to be safe
      const maxExisting = await conn.query(`
        SELECT MAX(CAST(SUBSTRING(codigo, 5) AS UNSIGNED)) AS max_num
        FROM cotizaciones_evento
        WHERE codigo REGEXP '^COT-[0-9]+$'
      `);
      const maxExistingNum = Number(maxExisting?.[0]?.max_num || 0);
      if (maxExistingNum >= nextSeqNum) {
        nextSeqNum = maxExistingNum + 1;
      }

      const usedCodes = new Set();

      for (const dup of duplicates) {
        const codigo = dup.codigo;
        const rows = await conn.query(
          `SELECT id_evento, codigo, json_crudo FROM cotizaciones_evento WHERE codigo = ? ORDER BY id_evento ASC`,
          [codigo],
        );

        console.log(`  ${codigo} aparece ${rows.length} veces:`);

        // Keep the first one, reassign the rest
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          if (i === 0) {
            usedCodes.add(row.codigo);
            console.log(`    [${i + 1}] ${row.id_evento} -> CONSERVADO`);
            continue;
          }

          // Generate a new unique code
          let newCode = '';
          for (let guard = 0; guard < 5000; guard++) {
            const candidate = formatQuoteCode(nextSeqNum);
            nextSeqNum++;
            if (!usedCodes.has(candidate)) {
              newCode = candidate;
              break;
            }
          }

          if (!newCode) {
            console.error(`  ERROR: No se pudo generar codigo unico para ${row.id_evento}`);
            continue;
          }
          usedCodes.add(newCode);

          // Update json_crudo if it has the old code
          let newJsonCrudo = row.json_crudo;
          if (newJsonCrudo && typeof newJsonCrudo === 'string') {
            try {
              const parsed = JSON.parse(newJsonCrudo);
              if (parsed.code === codigo) {
                parsed.code = newCode;
                newJsonCrudo = JSON.stringify(parsed);
              }
            } catch (e) {
              // ignore parse errors
            }
          }

          // Update cotizaciones_evento
          await conn.query(
            `UPDATE cotizaciones_evento SET codigo = ?, json_crudo = ? WHERE id_evento = ?`,
            [newCode, newJsonCrudo, row.id_evento],
          );

          // Also update eventos.cotizacion_json if the quote code matches
          const evRows = await conn.query(
            `SELECT id, cotizacion_json FROM eventos WHERE id = ? AND cotizacion_json IS NOT NULL`,
            [row.id_evento],
          );
          if (evRows.length > 0) {
            const ev = evRows[0];
            if (ev.cotizacion_json && typeof ev.cotizacion_json === 'string') {
              try {
                const evParsed = JSON.parse(ev.cotizacion_json);
                if (evParsed.code === codigo) {
                  evParsed.code = newCode;
                  await conn.query(
                    `UPDATE eventos SET cotizacion_json = ? WHERE id = ?`,
                    [JSON.stringify(evParsed), row.id_evento],
                  );
                }
              } catch (e) {
                // ignore parse errors
              }
            }
          }

          console.log(`    [${i + 1}] ${row.id_evento} -> ${newCode}`);
        }
        console.log('');
      }

      // Update doc_sequence to ensure no reuse
      const finalSeqNum = nextSeqNum - 1;
      await conn.query(
        `UPDATE doc_sequence SET last_value = GREATEST(last_value, ?) WHERE scope = 'COT'`,
        [finalSeqNum],
      );
      console.log(`Secuencia COT actualizada a ${finalSeqNum}\n`);
    }

    // 2. Add UNIQUE constraint on codigo
    try {
      await conn.query(
        `ALTER TABLE cotizaciones_evento ADD UNIQUE INDEX uq_cotizaciones_codigo (codigo)`,
      );
      console.log('Restriccion UNIQUE agregada en cotizaciones_evento.codigo');
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        console.error('ERROR: Aun existen duplicados. Revise los datos e intente de nuevo.');
        await conn.rollback();
        return;
      }
      if (err.code === 'ER_DUP_FIELDNAME' || err.message?.includes('Duplicate key name')) {
        console.log('La restriccion UNIQUE ya existe.');
      } else {
        throw err;
      }
    }

    await conn.commit();
    console.log('\nScript completado exitosamente.');

  } catch (err) {
    console.error('Error:', err);
    if (conn) {
      try { await conn.rollback(); } catch (e) {}
    }
  } finally {
    if (conn) conn.release();
    await pool.end();
  }
}

main();
