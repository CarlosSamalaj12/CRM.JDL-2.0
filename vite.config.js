import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs';
import path from 'path';

// Lee dist/version.json si existe (lo escribe bump-sw-version.cjs después del build).
// En dev (npm run dev) no existe aún → usamos "0.0.0-dev".
function getBuildVersion() {
  try {
    const pubPath = path.join(process.cwd(), 'public', 'version.json');
    if (fs.existsSync(pubPath)) {
      const v = JSON.parse(fs.readFileSync(pubPath, 'utf8'));
      if (v.version) return v.version;
    }
    const distPath = path.join(process.cwd(), 'dist', 'version.json');
    if (fs.existsSync(distPath)) {
      const v = JSON.parse(fs.readFileSync(distPath, 'utf8'));
      if (v.version) return v.version;
    }
    const swPath = path.join(process.cwd(), 'public', 'sw.js');
    if (fs.existsSync(swPath)) {
      const content = fs.readFileSync(swPath, 'utf8');
      const match = content.match(/const\s+VERSION\s*=\s*'([^']+)'/);
      if (match && match[1]) return match[1];
    }
  } catch {}
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
          changeOrigin: true
        }
      }
    },
    build: {
      chunkSizeWarningLimit: 3000
    }
  };
})
