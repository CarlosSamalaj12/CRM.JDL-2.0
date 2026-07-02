const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '..', '.env') });

(async () => {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3307),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '2022',
    database: process.env.DB_NAME || 'crm_jdl',
  });

  // Check quickTemplates
  const [qt] = await pool.query("SELECT clave, LEFT(valor_json, 5000) as v FROM app_state_kv WHERE clave = 'quickTemplates' LIMIT 1");
  if (qt.length > 0) {
    console.log('quickTemplates:', qt[0].v.substring(0, 2000));
  }

  // Check contractTemplates
  const [ct] = await pool.query("SELECT clave, LEFT(valor_json, 5000) as v FROM app_state_kv WHERE clave = 'contractTemplates' LIMIT 1");
  if (ct.length > 0) {
    console.log('\ncontractTemplates:', ct[0].v.substring(0, 2000));
  }

  // Check services
  const [svc] = await pool.query("SELECT clave, LEFT(valor_json, 5000) as v FROM app_state_kv WHERE clave = 'services' LIMIT 1");
  if (svc.length > 0) {
    const val = svc[0].v;
    const idx = val.toLowerCase().indexOf('importado');
    if (idx >= 0) {
      console.log('\n\nFOUND importado in services at', idx, ':', val.substring(Math.max(0,idx-50), idx+100));
    } else {
      console.log('\nNo importado in services');
    }
  }

  // Search for any service name containing important keywords
  if (svc.length > 0) {
    const val = svc[0].v;
    // Show first few service names
    const names = val.match(/"name":"([^"]+)"/g);
    if (names) {
      console.log('\nSample service names:', names.slice(0, 20).join(', '));
    }
  }

  await pool.end();
})().catch(e => console.error(e));
