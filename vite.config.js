import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Cargar las variables de entorno del archivo .env
  const env = loadEnv(mode, process.cwd(), '');
  const backendPort = env.APP_PORT || '3000';

  return {
    plugins: [react()],
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
