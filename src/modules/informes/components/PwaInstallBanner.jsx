import { useState, useEffect } from 'react';

/**
 * Banner que guía a los usuarios de iOS a añadir la app a la pantalla de inicio
 * para poder recibir notificaciones push. También muestra un botón de
 * activación de notificaciones para todos los usuarios.
 */
export default function PwaInstallBanner({ onEnableNotifications, isPushSubscribed, isPushSupported }) {
  const [showIosBanner, setShowIosBanner] = useState(false);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem('pwa_ios_banner_dismissed') === 'true');

  // Detectar iOS (Safari en iPhone/iPad)
  useEffect(() => {
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isStandalone = window.navigator.standalone === true;
    const isInApp = /^((?!chrome|android).)*safari/i.test(navigator.userAgent) || /iphone|ipad|ipod/i.test(navigator.userAgent);

    // Mostrar banner solo en iOS cuando NO está en modo standalone (no añadido a home screen)
    if (isIos && !isStandalone && isInApp && !dismissed) {
      setShowIosBanner(true);
    }
  }, [dismissed]);

  const dismissIosBanner = () => {
    setShowIosBanner(false);
    setDismissed(true);
    localStorage.setItem('pwa_ios_banner_dismissed', 'true');
  };

  // Determinar qué mostrar
  const showPushButton = isPushSupported && !isPushSubscribed;

  return (
    <>
      {/* Banner iOS: "Añadir a pantalla de inicio" */}
      {showIosBanner && (
        <div className="pwa-ios-banner">
          <div className="pwa-ios-banner-content">
            <div className="pwa-ios-banner-icon">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="3" ry="3" />
                <line x1="12" y1="8" x2="12" y2="16" />
                <line x1="8" y1="12" x2="16" y2="12" />
              </svg>
            </div>
            <div className="pwa-ios-banner-text">
              <strong>Activa notificaciones en iPhone</strong>
              <p>
                Para recibir notificaciones, añade esta app a tu pantalla de inicio:
              </p>
              <ol>
                <li>Toca <strong>Compartir</strong> <span className="pwa-ios-icon">↑</span></li>
                <li>Selecciona <strong>Añadir a pantalla de inicio</strong></li>
                <li>Abre la app desde el icono en tu pantalla de inicio</li>
              </ol>
            </div>
            <button className="pwa-ios-banner-close" onClick={dismissIosBanner} aria-label="Cerrar">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Botón para activar notificaciones push */}
      {showPushButton && (
        <button
          className="btn-ghost btn-sm pwa-enable-push"
          onClick={onEnableNotifications}
          data-tooltip="Activar notificaciones push"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            fontSize: '0.75rem',
          }}
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          Activar notificaciones
        </button>
      )}

      {/* Confirmación de suscripción activa */}
      {isPushSubscribed && (
        <span
          className="pwa-push-active"
          data-tooltip="Notificaciones push activas"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem',
            fontSize: '0.7rem',
            color: 'var(--success-color)',
          }}
        >
          <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
            <circle cx="12" cy="12" r="10" />
          </svg>
          Push activo
        </span>
      )}
    </>
  );
}
