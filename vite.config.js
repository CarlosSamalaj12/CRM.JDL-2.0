import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Lee dist/version.json si existe (lo escribe bump-sw-version.cjs después del build).
// En dev (npm run dev) no existe aún → usamos "0.0.0-dev".
function getBuildVersion() {
  try {
    const pubPath = path.resolve(__dirname, 'public', 'version.json');
    if (fs.existsSync(pubPath)) {
      const v = JSON.parse(fs.readFileSync(pubPath, 'utf8'));
      if (v.version) return v.version;
    }
    const distPath = path.resolve(__dirname, 'dist', 'version.json');
    if (fs.existsSync(distPath)) {
      const v = JSON.parse(fs.readFileSync(distPath, 'utf8'));
      if (v.version) return v.version;
    }
    const swPath = path.resolve(__dirname, 'public', 'sw.js');
    if (fs.existsSync(swPath)) {
      const content = fs.readFileSync(swPath, 'utf8');
      const match = content.match(/const\s+VERSION\s*=\s*'([^']+)'/);
      if (match && match[1]) return match[1];
    }
  } catch (err) {
    console.error('[vite.config.js] Error en getBuildVersion:', err);
  }
  return '0.0.0-dev';
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Cargar las variables de entorno del archivo .env
  const env = loadEnv(mode, process.cwd(), '');
  const backendPort = env.APP_PORT || '3000';

  return {
    plugins: [react()],
    // Inyecta la versión actual del bundle al frontend como variable global.
    // Accesible vía import.meta.env.VITE_APP_VERSION
    define: {
      __APP_VERSION__: JSON.stringify(getBuildVersion()),
    },
    server: {
      proxy: {
        '/api': {
          target: `http://127.0.0.1:${backendPort}`,
          changeOrigin: true,
          configure: (proxy) => {
            proxy.on('error', (err, req, res) => {
              // Silencia el error mientras el backend termina de inicializar (arranque en frío)
              if (err?.code === 'ECONNREFUSED') {
                if (res && !res.headersSent && typeof res.writeHead === 'function') {
                  res.writeHead(503, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ error: 'Backend iniciando, esperando conexión...' }));
                }
                return;
              }
              if (['ECONNABORTED', 'ECONNRESET', 'EPIPE'].includes(err?.code)) return;
              console.error('[vite] Error proxy API:', err?.message || err);
            });
          }
        },
        // Socket.IO: necesita ws:true para el handshake WebSocket
        '/socket.io': {
          target: `http://127.0.0.1:${backendPort}`,
          changeOrigin: true,
          ws: true,
          rewrite: (path) => path,
          configure: (proxy) => {
            // Silencia errores inofensivos de desconexión abrupta o arranque en frío
            proxy.on('error', (err) => {
              if (['ECONNABORTED', 'ECONNRESET', 'EPIPE', 'ECONNREFUSED'].includes(err?.code)) return;
              console.error('[vite] Error proxy Socket.IO:', err?.message || err);
            });
            proxy.on('proxyReqWs', (_proxyReq, _req, socket) => {
              const origEmit = socket.emit;
              socket.emit = function (event, ...args) {
                if (event === 'error') {
                  const err = args[0];
                  if (['ECONNABORTED', 'ECONNRESET', 'EPIPE', 'ECONNREFUSED'].includes(err?.code)) {
                    return false;
                  }
                }
                return origEmit.apply(this, [event, ...args]);
              };
            });
          }
        }
      }
    },
    build: {
      chunkSizeWarningLimit: 3000
    }
  };
})
