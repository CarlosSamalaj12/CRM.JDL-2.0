import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

import './styles/global-scoped.css';
import './styles/design-system-scoped.css';
import './styles/responsive-mobile.css';

// ── Service Worker: register + update detection ──
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((registration) => {
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