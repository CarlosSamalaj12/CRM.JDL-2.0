import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

import './styles/global-scoped.css';
import './styles/design-system-scoped.css';
import './styles/responsive-mobile.css';

// ═══════════════════════════════════════════════════════════════
//  SERVICE WORKER — Único punto de registro y detección de
//  actualizaciones. NO registramos en /login para evitar que
//  un SW se entrometa en la pantalla de autenticación.
//  (index.html ya limpia SWs viejos y cachés al entrar a /login)
// ═══════════════════════════════════════════════════════════════
if ('serviceWorker' in navigator && window.location.pathname !== '/login') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      // Periodic update check every 5 minutes in the background
      setInterval(() => {
        registration.update().catch(() => {});
      }, 1000 * 60 * 5);

      // Detectar cuando hay una nueva versión del SW (nuevo deploy)
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          // Cuando el nuevo SW termina de instalarse, notificar al usuario
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // Hay una nueva versión — disparar evento para que el banner lo muestre
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