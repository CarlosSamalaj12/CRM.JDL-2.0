import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar .env desde la raíz de CRM.JDL
dotenv.config({ path: path.join(__dirname, '..', '..', '..', '.env') });

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3307),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '2022',
  database: process.env.DB_NAME || 'crm_jdl',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: '-06:00',
  connectTimeout: 10000,  // 10s — timeout de conexión inicial
  acquireTimeout: 15000,  // 15s — timeout si el pool está lleno
});

export default pool;
