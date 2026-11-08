import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

import './styles/global-scoped.css';
import './styles/design-system-scoped.css';
import './styles/responsive-mobile.css';

import { CURRENT_VERSION, forcePurgeAndLogout } from './services/versionService';

// ═══════════════════════════════════════════════════════════════
//  SERVICE WORKER — Único punto de registro y detección de
//  actualizaciones. NO registramos en /login para evitar que
//  un SW se entrometa en la pantalla de autenticación.
// ═══════════════════════════════════════════════════════════════
if ('serviceWorker' in navigator && window.location.pathname !== '/login') {
  const hadController = Boolean(navigator.serviceWorker.controller);
  let refreshing = false;

  // Cuando un NUEVO Service Worker reemplaza a uno anterior, forzar cierre de sesión y limpieza de caché
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return;
    if (!refreshing) {
      refreshing = true;
      forcePurgeAndLogout(CURRENT_VERSION);
    }
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`/sw.js?v=${CURRENT_VERSION}`, { updateViaCache: 'none' }).then((registration) => {
      // Periodic update check every 15 minutes in the background
      setInterval(() => {
        registration.update().catch(() => {});
      }, 1000 * 60 * 15);

      // Detectar cuando hay una nueva versión del SW (nuevo deploy)
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          // Cuando el nuevo SW termina de instalarse, notificar al usuario
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            window.dispatchEvent(
              new CustomEvent('sw-update-ready', { detail: newWorker })
            );
          }
        });
      });
    }).catch(() => {
      // SW registration failed — silencioso
    });
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
