#!/usr/bin/env node
/**
 * Agrega autenticación JWT a los endpoints push en server.cjs
 * Uso: node scripts/auth_push.cjs
 */

const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, '..', 'server.cjs');
let content = fs.readFileSync(serverPath, 'utf8');

// ─── 1. Reemplazar las rutas push para agregar autenticación ───

const oldRoutes = `    // ─── WEB PUSH: Rutas de suscripción ───
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

const newRoutes = `    // ─── WEB PUSH: Rutas de suscripción ───

    // Middleware inline de autenticación JWT para endpoints push
    function authenticatePushJWT(req, res, next) {
      const header = req.headers.authorization;
      if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Token requerido' });
      }
      try {
        const token = header.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
      } catch {
        return res.status(401).json({ message: 'Token inválido o expirado' });
      }
    }

    // Endpoint público: obtener VAPID public key (no requiere auth)
    app.get("/api/push/vapid-public-key", (req, res) => {
      res.json({ publicKey: VAPID_PUBLIC_KEY });
    });

    // Suscribir (protegido) - usa el usuario_id del token JWT
    app.post("/api/push/subscribe", authenticatePushJWT, async (req, res, next) => {
      let conn;
      try {
        const { subscription } = req.body;
        if (!subscription || !subscription.endpoint || !subscription.keys) {
          return res.status(400).json({ message: 'Suscripción inválida' });
        }
        const usuario_id = req.user.id || req.user.sub || '';
        conn = await pool.getConnection();
        await conn.query("DELETE FROM push_subscriptions WHERE endpoint = ?", [subscription.endpoint]);
        await conn.query(
          "INSERT INTO push_subscriptions (usuario_id, endpoint, p256dh, auth, user_agent) VALUES (?, ?, ?, ?, ?)",
          [
            str(usuario_id),
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

    // Desuscribir (protegido)
    app.post("/api/push/unsubscribe", authenticatePushJWT, async (req, res, next) => {
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

    // Obtener suscripciones del usuario autenticado (protegido)
    app.get("/api/push/subscriptions", authenticatePushJWT, async (req, res, next) => {
      let conn;
      try {
        const usuario_id = req.user.id || req.user.sub || '';
        conn = await pool.getConnection();
        const rows = await conn.query(
          "SELECT id, endpoint, p256dh, auth, user_agent, creado_en FROM push_subscriptions WHERE usuario_id = ? ORDER BY creado_en DESC",
          [usuario_id]
        );
        res.json(rows);
      } catch (error) {
        next(error);
      } finally {
        if (conn) conn.release();
      }
    });

    // Enviar notificación push al usuario autenticado (protegido)
    app.post("/api/push/send", authenticatePushJWT, async (req, res, next) => {
      let conn;
      try {
        const { title, body, url } = req.body;
        const usuario_id = req.user.id || req.user.sub || '';
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

if (content.includes(oldRoutes)) {
  content = content.replace(oldRoutes, newRoutes);
  fs.writeFileSync(serverPath, content, 'utf8');
  console.log('✅ Autenticación JWT agregada a endpoints push en server.cjs');
} else {
  // Try to find the push routes section with different line endings
  const searchStr = 'WEB PUSH: Rutas de suscripción';
  const idx = content.indexOf(searchStr);
  if (idx === -1) {
    console.log('❌ No se encontraron las rutas push en server.cjs');
    process.exit(1);
  }
  console.log('⚠️ No se pudo hacer match exacto. Intentando reemplazo por marcador...');
  
  // Find the full block between the markers
  const startMarker = '// ─── WEB PUSH: Rutas de suscripción ───';
  const endMarker = '// ─── FIN WEB PUSH ───';
  const startIdx = content.indexOf(startMarker);
  const endIdx = content.indexOf(endMarker);
  
  if (startIdx !== -1 && endIdx !== -1) {
    const blockToReplace = content.substring(startIdx, endIdx + endMarker.length);
    content = content.replace(blockToReplace, newRoutes.trimStart());
    fs.writeFileSync(serverPath, content, 'utf8');
    console.log('✅ Autenticación JWT agregada (reemplazo por marcador)');
  } else {
    console.log('❌ No se pudieron encontrar los marcadores push');
    process.exit(1);
  }
}
