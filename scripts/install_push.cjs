#!/usr/bin/env node
/**
 * Instala y configura Web Push en el proyecto CRM-JDL.
 * Uso: node scripts/install_push.cjs
 * 
 * 1. Genera VAPID keys si no existen en .env
 * 2. Modifica server.cjs para agregar push subscription routes
 * 3. Crea la tabla push_subscriptions en la BD
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const dotenv = require('dotenv');

// Cargar .env
dotenv.config();

const ENV_PATH = path.join(__dirname, '..', '.env');

// ─── 1. Generar VAPID keys si no existen ───
async function ensureVapidKeys() {
  let envContent = '';
  try {
    envContent = fs.readFileSync(ENV_PATH, 'utf8');
  } catch {
    envContent = '';
  }

  const hasPublic = envContent.includes('VAPID_PUBLIC_KEY=');
  const hasPrivate = envContent.includes('VAPID_PRIVATE_KEY=');

  if (!hasPublic || !hasPrivate) {
    console.log('[WEB PUSH] Generando VAPID keys...');
    try {
      const vapidOutput = execSync('npx web-push generate-vapid-keys --json', { encoding: 'utf8' });
      const parsed = JSON.parse(vapidOutput);
      
      const publicKey = parsed.publicKey || parsed.public_key || '';
      const privateKey = parsed.privateKey || parsed.private_key || '';

      if (!envContent.endsWith('\n')) envContent += '\n';
      if (!hasPublic) envContent += `\nVAPID_PUBLIC_KEY=${publicKey}\n`;
      if (!hasPrivate) envContent += `VAPID_PRIVATE_KEY=${privateKey}\n`;

      fs.writeFileSync(ENV_PATH, envContent, 'utf8');
      console.log('[WEB PUSH] ✓ VAPID keys generadas y guardadas en .env');
    } catch (err) {
      console.error('[WEB PUSH] ✗ Error generando VAPID keys:', err.message);
      console.log('[WEB PUSH] Genera las keys manualmente con: npx web-push generate-vapid-keys');
    }
  } else {
    console.log('[WEB PUSH] ✓ VAPID keys ya existen en .env');
  }
}

// ─── 2. Modificar server.cjs ───
function patchServerCjs() {
  const serverPath = path.join(__dirname, '..', 'server.cjs');
  let content = fs.readFileSync(serverPath, 'utf8');

  // 2a. Agregar require('web-push') después de googleCalendar
  const googleCalLine = `const { createGoogleEvent, createUserReminder, deleteUserReminder } = require("./googleCalendar.cjs");`;
  const webPushBlock = `${googleCalLine}
const webpush = require('web-push');

// VAPID keys para Web Push
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:sistema@jardinesdellago.com',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
  console.log('[WEB PUSH] VAPID configurado correctamente.');
} else {
  console.warn('[WEB PUSH] ⚠️ VAPID keys no configuradas en .env. Ejecuta: npx web-push generate-vapid-keys');
}`;

  if (!content.includes('webpush')) {
    content = content.replace(googleCalLine, webPushBlock);
    console.log('[WEB PUSH] ✓ require("web-push") agregado a server.cjs');
  } else {
    console.log('[WEB PUSH] ✓ web-push ya está importado');
  }

  // 2b. Agregar función ensurePushSubscriptionsTable
  const ensureFuncName = 'async function ensureMigrationLogTable';
  const ensureFuncBlock = `// ═══════════════════════════════════════════════════════
// WEB PUSH: Tabla de suscripciones push
// ═══════════════════════════════════════════════════════

async function ensurePushSubscriptionsTable() {
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.query(\`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        usuario_id VARCHAR(120) NOT NULL,
        endpoint TEXT NOT NULL,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        user_agent VARCHAR(500) NULL,
        creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_push_subscriptions_usuario (usuario_id),
        UNIQUE KEY uq_push_endpoint (endpoint(500))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    \`);
  } finally {
    if (conn) conn.release();
  }
}

// ═══════════════════════════════════════════════════════
// FIN WEB PUSH
// ═══════════════════════════════════════════════════════

async function ensureMigrationLogTable`;

  if (!content.includes('ensurePushSubscriptionsTable')) {
    content = content.replace(ensureFuncName, ensureFuncBlock);
    console.log('[WEB PUSH] ✓ ensurePushSubscriptionsTable agregada');
  } else {
    console.log('[WEB PUSH] ✓ ensurePushSubscriptionsTable ya existe');
  }

  // 2c. Agregar a MIGRATIONS
  const lastNameEntry = `{ name: 'NotificacionesComentarioId', fn: ensureNotificacionesComentarioId },`;
  const pushMigrationEntry = `  { name: 'NotificacionesComentarioId', fn: ensureNotificacionesComentarioId },
  { name: 'PushSubscriptions', fn: ensurePushSubscriptionsTable },`;

  if (!content.includes('PushSubscriptions')) {
    content = content.replace(lastNameEntry, pushMigrationEntry);
    console.log('[WEB PUSH] ✓ Migración PushSubscriptions agregada a MIGRATIONS');
  } else {
    console.log('[WEB PUSH] ✓ PushSubscriptions ya está en MIGRATIONS');
  }

  // 2d. Agregar rutas push API después de cargar reportsRouter
  const routeMountLine = `app.use("/api", reportsRouter.default);`;
  const pushRoutesBlock = `app.use("/api", reportsRouter.default);

    // ─── WEB PUSH: Rutas de suscripción ───
    // Endpoint para que el frontend obtenga la VAPID public key
    app.get("/api/push/vapid-public-key", (req, res) => {
      res.json({ publicKey: VAPID_PUBLIC_KEY });
    });

    // Suscribir (guardar subscription en DB)
    app.post("/api/push/subscribe", async (req, res, next) => {
      let conn;
      try {
        const { subscription, usuario_id } = req.body;
        if (!subscription || !subscription.endpoint || !subscription.keys) {
          return res.status(400).json({ message: 'Suscripción inválida' });
        }
        conn = await pool.getConnection();
        // Eliminar suscripción vieja del mismo endpoint si existe
        await conn.query("DELETE FROM push_subscriptions WHERE endpoint = ?", [subscription.endpoint]);
        await conn.query(
          "INSERT INTO push_subscriptions (usuario_id, endpoint, p256dh, auth, user_agent) VALUES (?, ?, ?, ?, ?)",
          [
            str(usuario_id || ''),
            subscription.endpoint,
            subscription.keys.p256dh || '',
            subscription.keys.auth || '',
            req.headers['user-agent'] || null
          ]
        );
        res.json({ message: 'Suscripción guardada' });
      } catch (error) {
        next(error);
      } finally {
        if (conn) conn.release();
      }
    });

    // Desuscribir (eliminar subscription)
    app.post("/api/push/unsubscribe", async (req, res, next) => {
      let conn;
      try {
        const { endpoint } = req.body;
        if (!endpoint) return res.status(400).json({ message: 'Endpoint requerido' });
        conn = await pool.getConnection();
        await conn.query("DELETE FROM push_subscriptions WHERE endpoint = ?", [endpoint]);
        res.json({ message: 'Suscripción eliminada' });
      } catch (error) {
        next(error);
      } finally {
        if (conn) conn.release();
      }
    });

    // Obtener suscripciones de un usuario
    app.get("/api/push/subscriptions/:usuario_id", async (req, res, next) => {
      let conn;
      try {
        conn = await pool.getConnection();
        const rows = await conn.query(
          "SELECT id, endpoint, p256dh, auth, user_agent, creado_en FROM push_subscriptions WHERE usuario_id = ? ORDER BY creado_en DESC",
          [req.params.usuario_id]
        );
        res.json(rows);
      } catch (error) {
        next(error);
      } finally {
        if (conn) conn.release();
      }
    });

    // Enviar notificación push a un usuario específico
    app.post("/api/push/send", async (req, res, next) => {
      let conn;
      try {
        const { usuario_id, title, body, url } = req.body;
        if (!usuario_id) return res.status(400).json({ message: 'usuario_id requerido' });
        if (!VAPID_PUBLIC_KEY) return res.status(500).json({ message: 'VAPID no configurado' });

        conn = await pool.getConnection();
        const rows = await conn.query(
          "SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE usuario_id = ?",
          [usuario_id]
        );

        if (rows.length === 0) {
          return res.status(404).json({ message: 'No hay suscripciones para este usuario' });
        }

        const payload = JSON.stringify({
          title: title || 'Jardines EMS',
          body: body || '',
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-72.png',
          url: url || '/',
          tag: 'notif_' + Date.now(),
          requireInteraction: true
        });

        const results = [];
        for (const row of rows) {
          try {
            const subscription = {
              endpoint: row.endpoint,
              keys: { p256dh: row.p256dh, auth: row.auth }
            };
            await webpush.sendNotification(subscription, payload);
            results.push({ endpoint: row.endpoint.slice(0, 50) + '...', status: 'ok' });
          } catch (err) {
            results.push({ endpoint: row.endpoint.slice(0, 50) + '...', status: 'error', message: err.message });
            // Si el endpoint ya no es válido, eliminarlo
            if (err.statusCode === 410) {
              await conn.query("DELETE FROM push_subscriptions WHERE endpoint = ?", [row.endpoint]);
            }
          }
        }

        res.json({ sent: results.filter(r => r.status === 'ok').length, failed: results.filter(r => r.status !== 'ok').length, results });
      } catch (error) {
        next(error);
      } finally {
        if (conn) conn.release();
      }
    });
    // ─── FIN WEB PUSH ───`;

  if (!content.includes('push/vapid-public-key')) {
    content = content.replace(routeMountLine, pushRoutesBlock);
    console.log('[WEB PUSH] ✓ Rutas push API agregadas');
  } else {
    console.log('[WEB PUSH] ✓ Rutas push API ya existen');
  }

  // 2e. Exponer VAPID_PUBLIC_KEY globalmente (para que esté disponible en las rutas)
  if (!content.includes('VAPID_PUBLIC_KEY_ENDPOINT')) {
    // Ya agregamos la variable arriba, asegurarnos que esté accesible
    console.log('[WEB PUSH] ✓ VAPID keys expuestas en el módulo');
  }

  fs.writeFileSync(serverPath, content, 'utf8');
  console.log('[WEB PUSH] ✓ server.cjs actualizado correctamente');
}

// ─── Ejecutar ───
async function main() {
  console.log('═'.repeat(50));
  console.log('  WEB PUSH - Instalación y Configuración');
  console.log('═'.repeat(50));

  await ensureVapidKeys();
  patchServerCjs();

  console.log('═'.repeat(50));
  console.log('  ✅ Instalación completada');
  console.log('  📌 1. Asegúrate de reiniciar el servidor');
  console.log('  📌 2. Si no se generaron VAPID keys, ejecuta manualmente:');
  console.log('     npx web-push generate-vapid-keys');
  console.log('     Luego agrega los valores a .env:');
  console.log('     VAPID_PUBLIC_KEY=...');
  console.log('     VAPID_PRIVATE_KEY=...');
  console.log('═'.repeat(50));
}

main().catch(err => {
  console.error('[WEB PUSH] Error:', err);
  process.exit(1);
});
