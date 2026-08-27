import pool from '../backend/src/config/db.js';

async function deepSearch() {
  console.log('=== DEEP SEARCH INCLUDING DELETED / DELETED_AT IS NOT NULL ===\n');

  const [tables] = await pool.query('SHOW TABLES');
  const tableNames = tables.map(r => Object.values(r)[0]);

  for (const t of tableNames) {
    try {
      const [rows] = await pool.query(`SELECT * FROM \`${t}\``);
      const matches = rows.filter(r => {
        const s = JSON.stringify(r).toLowerCase();
        return s.includes('f5c3dd54') || s.includes('dvv') || (s.includes('walter') && s.includes('2026-10-06'));
      });

      if (matches.length) {
        console.log(`\n================ MATCH IN [${t}] (${matches.length} rows) ================`);
        console.log(matches);
      }
    } catch (e) {
      console.error(`Error searching table ${t}:`, e.message);
    }
  }

  process.exit(0);
}

deepSearch().catch(err => { console.error(err); process.exit(1); });
