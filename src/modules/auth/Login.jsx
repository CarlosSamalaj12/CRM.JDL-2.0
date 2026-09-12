import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import authService from '../../services/authService';
import firebaseService, { auth } from '../../services/firebase';
import { useAuth } from '../informes/context/AuthContext';
import { CURRENT_VERSION } from '../../services/versionService';

function getHomePath(user) {
  if (!user) return '/login';
  const role = String(user.rol || user.role || '').trim().toLowerCase();
  if (['admin', 'vendedor', 'recepcionista', 'frontoffice', 'front_office'].includes(role)) {
    return '/calendar';
  }
  if (['eventos', 'coordinador'].includes(role)) {
    return '/kanban';
  }
  return '/kanban';
}

export default function Login() {
  const [searchParams] = useSearchParams();
  const initialIsUpdated = searchParams.get('update') === '1';
  const updateVersion = searchParams.get('v') || '';
  const [showUpdateNotice, setShowUpdateNotice] = useState(initialIsUpdated);
  const startedAt = typeof window !== 'undefined' ? localStorage.getItem('google_auth_started_at') : null;
  const isRecentAuth = startedAt && (Date.now() - Number(startedAt) < 120000);
  const isPendingRedirect = typeof window !== 'undefined' && (sessionStorage.getItem('pending_google_redirect') === '1' || Boolean(isRecentAuth));
  const [loading, setLoading] = useState(isPendingRedirect);
  const [verifyingText, setVerifyingText] = useState(isPendingRedirect ? 'Verificando cuenta de Google...' : '');
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const navigate = useNavigate();
  const { user: contextUser, syncSession } = useAuth();
  const googleLoginRef = useRef(false);

  useEffect(() => {
    // Si viene de una actualización (?update=1), purgar cualquier sesión residual una sola vez al entrar
    if (initialIsUpdated) {
      authService.clearSession();
      sessionStorage.removeItem('login_redirect_count');
      sessionStorage.removeItem('last_login_redirect_time');
      // Limpiar query params de la barra de direcciones para evitar rebotes
      window.history.replaceState({}, document.title, window.location.pathname);
    } else {
      // ── Detector de bucles de redirección (Auto-limpieza de caché) ──
      const now = Date.now();
      const lastRedirectStr = sessionStorage.getItem('last_login_redirect_time');
      const redirectCountStr = sessionStorage.getItem('login_redirect_count');
      
      let lastRedirect = lastRedirectStr ? Number(lastRedirectStr) : 0;
      let redirectCount = redirectCountStr ? Number(redirectCountStr) : 0;
      
      const diff = now - lastRedirect;
      if (lastRedirect > 0 && diff > 500 && diff < 8000) {
        redirectCount += 1;
        sessionStorage.setItem('login_redirect_count', String(redirectCount));
      } else if (lastRedirect === 0 || diff >= 8000) {
        redirectCount = 0;
        sessionStorage.setItem('login_redirect_count', '0');
      }
      sessionStorage.setItem('last_login_redirect_time', String(now));
      
      if (redirectCount >= 8) {
        console.warn('[Auto-Limpieza] Detectado bucle de redirección persistente. Limpiando caché...');
        localStorage.clear();
        
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.getRegistrations().then((registrations) => {
            for (let reg of registrations) reg.unregister();
          }).catch(() => {});
        }
        
        if ('caches' in window) {
          caches.keys().then((keys) => {
            return Promise.all(keys.map(key => caches.delete(key)));
          }).catch(() => {});
        }
        
        sessionStorage.removeItem('login_redirect_count');
        sessionStorage.removeItem('last_login_redirect_time');
        
        toast.error('Conflicto de caché detectado. Limpiando memoria y reiniciando...', { 
          id: 'cache-cleanup', 
          duration: 4000 
        });
        
        setTimeout(() => {
          window.location.reload();
        }, 1500);
        return;
      }
    }
  }, []);

  // Redirigir si ya hay una sesión activa legítima al cargar la página
  useEffect(() => {
    if (initialIsUpdated) return;
    const user = authService.getCurrentUser();
    if (user) {
      navigate(getHomePath(user), { replace: true });
    }
  }, [navigate]);

  // Sincronización de usuario de Google (Redirect nativo, onAuthStateChanged o Popup)
  useEffect(() => {
    let cancelled = false;

    // 1. Resolver resultado de redirección (si el navegador venía de una redirección de Google)
    const completeRedirectLogin = async () => {
      try {
        const startedAt = typeof window !== 'undefined' ? localStorage.getItem('google_auth_started_at') : null;
        const isRecent = startedAt && (Date.now() - Number(startedAt) < 120000);
        const isPending = (typeof window !== 'undefined' && sessionStorage.getItem('pending_google_redirect') === '1') || isRecent;
        
        if (isPending) {
          setLoading(true);
          setVerifyingText('Verificando acceso con Google Workspace...');
        }

        const firebaseUser = await firebaseService.getGoogleRedirectUser();
        if (!firebaseUser || cancelled) {
          if (isPending && !cancelled) {
            setLoading(false);
            setVerifyingText('');
          }
          return;
        }

        const localSession = authService.getCurrentUser();
        if (localSession) {
          navigate(getHomePath(localSession), { replace: true });
          return;
        }

        setLoading(true);
        setVerifyingText('Sincronizando sesión corporativa...');
        const localUser = await authService.loginFirebase(firebaseUser);
        if (cancelled) return;

        document.activeElement?.blur();
        sessionStorage.removeItem('login_redirect_count');
        sessionStorage.removeItem('last_login_redirect_time');
        sessionStorage.removeItem('pending_google_redirect');
        try { localStorage.removeItem('google_auth_started_at'); } catch {}
        setShowUpdateNotice(false);

        toast.success(`Bienvenido, ${localUser.fullName || localUser.name}`, { duration: 2000 });
        syncSession();
        const homePath = getHomePath(localUser);
        setTimeout(() => { navigate(homePath, { replace: true }); }, 300);
      } catch (err) {
        sessionStorage.removeItem('pending_google_redirect');
        try { localStorage.removeItem('google_auth_started_at'); } catch {}
        if (!cancelled) {
          console.error('Google redirect login error detail:', err);
          document.activeElement?.blur();
          toast.error(err.message || 'No se pudo completar el inicio de sesión con Google.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setVerifyingText('');
        }
      }
    };

    completeRedirectLogin();

    // 2. Suscripción proactiva a onAuthStateChanged para sesiones demoradas o restauradas por IndexedDB
    const unsubscribeAuth = auth.onAuthStateChanged(async (firebaseUser) => {
      if (!firebaseUser || cancelled) return;
      const existingUser = authService.getCurrentUser();
      if (existingUser) return;

      try {
        setLoading(true);
        setVerifyingText('Restaurando sesión corporativa...');
        const localUser = await authService.loginFirebase(firebaseUser);
        if (cancelled) return;

        sessionStorage.removeItem('login_redirect_count');
        sessionStorage.removeItem('last_login_redirect_time');
        sessionStorage.removeItem('pending_google_redirect');
        try { localStorage.removeItem('google_auth_started_at'); } catch {}
        setShowUpdateNotice(false);

        toast.success(`Bienvenido, ${localUser.fullName || localUser.name}`, { duration: 2000 });
        syncSession();
        const homePath = getHomePath(localUser);
        setTimeout(() => { navigate(homePath, { replace: true }); }, 300);
      } catch (err) {
        if (!cancelled) {
          console.error('[Login] Error sincronizando sesión desde onAuthStateChanged:', err);
          setLoading(false);
          setVerifyingText('');
        }
      }
    });

    return () => {
      cancelled = true;
      if (unsubscribeAuth) unsubscribeAuth();
    };
  }, [navigate, syncSession]);

  // Handle Google Login via Firebase
  const handleGoogleLogin = async () => {
    if (googleLoginRef.current) return;
    googleLoginRef.current = true;

    // IMPORTANTE: NO llamamos a setLoading(true) aquí antes de signInWithPopup.
    // En iOS Safari y Android Chrome, cualquier mutación de DOM o deshabilitar el botón
    // antes de abrir la ventana destruye el "User Activation Token" (gesto táctil),
    // haciendo que el navegador móvil bloquee el popup como 'auth/popup-blocked'.
    let loadingToast = null;
    try {
      const firebaseUser = await firebaseService.loginWithGoogle();
      if (!firebaseUser) {
        // Redireccionando a Google (fallback nativo si el navegador bloqueó el popup)
        setLoading(true);
        setVerifyingText('Conectando con Google Workspace...');
        return;
      }

      // Usuario autenticado con éxito por popup
      setLoading(true);
      setVerifyingText('Sincronizando con el servidor corporativo...');
      loadingToast = toast.loading('Sincronizando con el servidor...');

      const localUser = await authService.loginFirebase(firebaseUser);
      document.activeElement?.blur();
      if (loadingToast) toast.dismiss(loadingToast);

      sessionStorage.removeItem('login_redirect_count');
      sessionStorage.removeItem('last_login_redirect_time');
      try { localStorage.removeItem('google_auth_started_at'); } catch {}
      setShowUpdateNotice(false);

      toast.success(`Bienvenido, ${localUser.fullName || localUser.name}`, { duration: 2000 });
      syncSession();
      const homePath = getHomePath(localUser);
      setTimeout(() => { navigate(homePath, { replace: true }); }, 300);
    } catch (err) {
      console.error('Google login error detail:', err);
      if (loadingToast) toast.dismiss(loadingToast);
      try { localStorage.removeItem('google_auth_started_at'); } catch {}
      
      if (
        err.code === 'auth/operation-not-allowed' ||
        err.code === 'auth/api-key-not-valid' ||
        err.message?.includes('api-key-not-valid') ||
        err.message?.includes('API key not valid') ||
        err.message?.includes('dummy') ||
        err.message?.includes('AIzaSyDummy')
      ) {
        document.activeElement?.blur();
        toast('Configuración de Firebase Requerida — Para que el inicio de sesión con Google funcione, configura tus variables de Firebase en el archivo .env', { duration: Infinity, icon: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> });
      } else if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        document.activeElement?.blur();
        toast.error('Inicio de sesión cancelado o ventana cerrada.');
      } else {
        document.activeElement?.blur();
        toast.error(err.message || 'No se pudo iniciar sesión con tu cuenta de Google.', { duration: 4000 });
      }
    } finally {
      // Pequeño cooldown para evitar re-clics inmediatos
      setTimeout(() => {
        googleLoginRef.current = false;
        setLoading(false);
      }, 600);
    }
  };

  const displayVersion = CURRENT_VERSION && !CURRENT_VERSION.startsWith('0.0.0-') ? CURRENT_VERSION : '2.1.78';

  return (
    <div className="loginScreen" id="loginScreen">
      <div className="loginShell" role="dialog" aria-labelledby="loginTitle" aria-modal="true">
        
        {/* ═══════════════════════════════════════════════════════════
            PANEL VISUAL IZQUIERDO (HERO & EXPERIENCIA PANORÁMICA)
           ═══════════════════════════════════════════════════════════ */}
        <section className="loginVisualPanel" aria-label="Hotel Jardines del Lago">
          <img className="loginVisualImage" src="/montaje.jpg" alt="Montaje Gestion de Reservas" />
          <div className="loginVisualShade" />

          {/* Barra Superior Translúcida (Pills de Estado) */}
          <div className="loginVisualTopBar">
            <div className="loginGlassPill">
              <span className="loginPillDot" />
              <span>SISTEMA ACTIVO</span>
              <span className="loginPillSep">•</span>
              <span>Panajachel, Sololá</span>
            </div>

            <div className="loginGlassPill">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
              </svg>
              <span>En Línea</span>
            </div>
          </div>

          {/* Contenido Inferior de Identidad */}
          <div className="loginVisualBottom">
            <div className="loginVisualHeroBrand">
              <img 
                src="/Oficial_JDL_blanco.png" 
                alt="Hotel Jardines del Lago" 
                className="loginVisualHeroLogo" 
              />
              <div className="loginVisualHeroBrandText">
                <div className="loginVisualEyebrow">
                  <span className="loginAccentBar" />
                  <span>HOTEL JARDINES DEL LAGO</span>
                </div>
                <h2 className="loginVisualTitle">Gestión de Eventos</h2>
              </div>
            </div>
            
            <div className="loginVisualDivider" />

            <div className="loginVisualFooterRow">
              <div className="loginVisualSecurity">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
                <span>TLS 1.3 Seguro • Conexión Cifrada</span>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════
            PANEL DERECHO (CARD DE INICIO DE SESIÓN EJECUTIVA)
           ═══════════════════════════════════════════════════════════ */}
        <section className="loginCard">
          
          {/* Header Corporativo: Logo + Título + Selector Idioma */}
          <div className="loginHeaderRow">
            <div className="loginHeaderBrand">
              <div className="loginHeaderLogoBox" title="Hotel Jardines del Lago">
                <img src="/icons/icon-512.png" alt="Emblema Jardines del Lago" className="loginHeaderLogo" />
              </div>
              <div className="loginHeaderBrandText">
                <div className="loginHeaderBrandName">Jardines del Lago</div>
                <div className="loginHeaderBrandSub">HOTEL & CENTRO DE CONVENCIONES</div>
              </div>
            </div>

            <div className="loginLangPill" title="Idioma del sistema">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              <span>ES</span>
            </div>
          </div>

          {/* Titular Principal de Bienvenida */}
          <div className="loginIntroBlock">
            <h1 className="loginMainTitle" id="loginTitle">Bienvenido al EMS</h1>
            <p className="loginMainSubtitle">
              Sistema de Gestión de <strong>Hotel Jardines del Lago</strong>. Inicia sesión con tus credenciales de colaborador para gestionar reservas, salones y eventos.
            </p>
          </div>

          {/* Tarjeta de Estado del Sistema / Novedades */}
          <div className="loginUpdateBanner" role="status">
            <div className="loginUpdateIconBox">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3z" />
              </svg>
            </div>
            <div className="loginUpdateContent">
              <strong className="loginUpdateTitle">
                {showUpdateNotice 
                  ? `Sistema actualizado (v${displayVersion})`
                  : `Sistema actualizado (v${displayVersion})`}
              </strong>
              <p className="loginUpdateDesc">
                {showUpdateNotice
                  ? 'Se han aplicado las últimas mejoras del sistema y cerrado las sesiones previas de forma segura.'
                  : 'Optimizaciones en el motor de disponibilidad y sincronización en tiempo real de villas habilitadas.'}
              </p>
            </div>
          </div>

          {/* Indicador de verificación corporativa en progreso (útil para móviles y conexiones lentas) */}
          {loading && verifyingText && (
            <div className="loginVerifyingNotice" style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              padding: '11px 16px',
              background: 'rgba(2, 132, 199, 0.08)',
              border: '1px solid rgba(2, 132, 199, 0.28)',
              borderRadius: '12px',
              marginBottom: '16px',
              color: '#0369a1',
              fontSize: '0.88rem',
              fontWeight: 600,
              boxShadow: '0 2px 8px rgba(2, 132, 199, 0.08)'
            }}>
              <span className="loginSpinner" style={{ borderColor: '#0284c7', borderTopColor: 'transparent', width: '16px', height: '16px', borderWidth: '2px' }} />
              <span>{verifyingText}</span>
            </div>
          )}

          {/* Botón Principal: Continuar con Google Workspace */}
          <div className="loginGoogleBtnContainer">
            <button 
              className="loginGoogleBtn" 
              id="btnGoogleLogin" 
              type="button" 
              onClick={handleGoogleLogin}
              disabled={loading}
            >
              {loading ? (
                <span className="loginLoadingState">
                  <span className="loginSpinner" />
                  <span>{verifyingText || 'Autenticando...'}</span>
                </span>
              ) : (
                <>
                  <svg className="loginGoogleIcon" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                  </svg>
                  <span>Continuar con Google Workspace</span>
                </>
              )}
            </button>
          </div>

          {/* Nota de Restricción de Dominio Corporativo */}
          <div className="loginDomainNote">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="20" height="14" x="2" y="7" rx="2" ry="2" />
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
            </svg>
            <span>Acceso seguro exclusivo para cuentas <strong>@jardinesdellago.com</strong></span>
          </div>

          {/* Tarjeta de Seguridad Centralizada Zero-Trust */}
          <div className="loginSsoCard">
            <div className="loginSsoIconBox">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            </div>
            <div className="loginSsoContent">
              <div className="loginSsoTitle">AUTENTICACIÓN CORPORATIVA CENTRALIZADA (SSO)</div>
              <div className="loginSsoDesc">
                Políticas Zero-Trust y encriptación TLS 1.3 de extremo a extremo aplicadas a todas las sesiones activas.
              </div>
            </div>
          </div>

          {/* Enlace a Soporte IT */}
          <div className="loginHelpRow">
            <button 
              type="button" 
              className="loginHelpBtn" 
              onClick={() => setIsSupportOpen(true)}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span>¿Problemas de acceso? Contactar a Soporte IT</span>
            </button>
          </div>

          {/* Footer Corporativo Inferior */}
          <footer className="loginFooter">
            <div className="loginFooterLeft">
              © 2026 Hotel Jardines del Lago. EMS v{displayVersion}
            </div>
            <div className="loginFooterRight">
              <span>Términos de Servicio</span>
            </div>
          </footer>

        </section>

        {/* ═══════════════════════════════════════════════════════════
            MODAL DE SOPORTE TÉCNICO INTERNO
           ═══════════════════════════════════════════════════════════ */}
        {isSupportOpen && (
          <div className="qp-support-modal-backdrop" onClick={() => setIsSupportOpen(false)}>
            <div className="qp-support-modal" onClick={e => e.stopPropagation()}>
              <div className="qp-support-modal-header">
                <span className="material-symbols-outlined">support_agent</span>
                <span>Soporte Técnico de Sistemas</span>
                <button className="qp-support-modal-close" onClick={() => setIsSupportOpen(false)} aria-label="Cerrar modal">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              <div className="qp-support-modal-body">
                <div className="qp-support-contact">
                  <img src="https://ui-avatars.com/api/?name=Sistemas+Hoteles&background=0284c7&color=fff&size=40" alt="SH" className="qp-support-avatar" />
                  <div className="qp-support-info">
                    <span className="qp-support-name">Sistemas Hoteles</span>
                    <a href="mailto:sistemashotel@jardinesdellago.com" className="qp-support-email">
                      <span className="material-symbols-outlined">mail</span>
                      sistemashotel@jardinesdellago.com
                    </a>
                    <a href="tel:+50255178100" className="qp-support-phone">
                      <span className="material-symbols-outlined">call</span>
                      +502 5517 8100
                    </a>
                  </div>
                </div>
                <div className="qp-support-divider" />
                <div className="qp-support-contact">
                  <img src="https://ui-avatars.com/api/?name=Sistemas+JDL&background=0284c7&color=fff&size=40" alt="SJ" className="qp-support-avatar" />
                  <div className="qp-support-info">
                    <span className="qp-support-name">Sistemas JDL</span>
                    <a href="mailto:sistema@jardinesdellago.com" className="qp-support-email">
                      <span className="material-symbols-outlined">mail</span>
                      sistema@jardinesdellago.com
                    </a>
                    <a href="tel:+50254140195" className="qp-support-phone">
                      <span className="material-symbols-outlined">call</span>
                      +502 5414 0195
                    </a>
                  </div>
                </div>
                <div className="qp-support-hours">
                  <span className="material-symbols-outlined">schedule</span>
                  Horario de atención: Lun-Sáb 8:00 - 18:00
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ═══════════════════════════════════════════════════════════
          ESTILOS CSS ULTRA-MODERNOS Y FIDEDIGNOS AL DISEÑO
         ═══════════════════════════════════════════════════════════ */}
      <style>{`
        @keyframes loginFadeIn {
          from { opacity: 0; transform: scale(0.985); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes loginSpin {
          to { transform: rotate(360deg); }
        }
        @keyframes pulseGlow {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%      { opacity: 0.5; transform: scale(1.2); }
        }

        /* ── Pantalla Completa ── */
        body:not(.informes-theme) .loginScreen.loginScreen {
          min-height: 100vh !important;
          width: 100% !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          background: radial-gradient(circle at 50% 30%, #f1f5f9 0%, #e2e8f0 100%) !important;
          padding: 24px !important;
          box-sizing: border-box !important;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
        }

        /* ── Shell / Card Contenedor Principal ── */
        body:not(.informes-theme) .loginShell.loginShell {
          width: min(1040px, 100%) !important;
          min-height: 610px !important;
          background: #ffffff !important;
          border-radius: 20px !important;
          box-shadow: 0 25px 60px -15px rgba(15, 23, 42, 0.12), 0 0 0 1px rgba(226, 232, 240, 0.8) !important;
          display: grid !important;
          grid-template-columns: 1.08fr 1fr !important;
          overflow: hidden !important;
          position: relative !important;
          animation: loginFadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) both !important;
        }

        /* ═══════════════════════════════════════════
           PANEL VISUAL IZQUIERDO (HERO)
           ═══════════════════════════════════════════ */
        body:not(.informes-theme) .loginVisualPanel.loginVisualPanel {
          position: relative !important;
          display: flex !important;
          flex-direction: column !important;
          justify-content: space-between !important;
          padding: 32px 34px !important;
          overflow: hidden !important;
          box-sizing: border-box !important;
        }

        .loginVisualImage {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center 55%;
          z-index: 1;
        }

        .loginVisualShade {
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, rgba(15, 23, 42, 0.35) 0%, rgba(15, 23, 42, 0.08) 35%, rgba(15, 23, 42, 0.86) 100%);
          z-index: 2;
        }

        .loginVisualTopBar {
          position: relative;
          z-index: 3;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .loginGlassPill {
          background: rgba(15, 23, 42, 0.45);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.22);
          border-radius: 9999px;
          padding: 6px 14px;
          font-size: 11.5px;
          font-weight: 600;
          color: #f8fafc;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          letter-spacing: 0.3px;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.15);
        }

        .loginPillDot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #38bdf8;
          box-shadow: 0 0 8px #38bdf8;
          animation: pulseGlow 2.5s infinite ease-in-out;
        }

        .loginPillSep {
          color: rgba(255, 255, 255, 0.4);
          font-weight: 400;
        }

        .loginVisualBottom {
          position: relative;
          z-index: 3;
          margin-top: auto;
        }

        .loginVisualHeroBrand {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 14px;
        }

        .loginVisualHeroLogo {
          width: 58px;
          height: 58px;
          object-fit: contain;
          filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.5));
          flex-shrink: 0;
        }

        .loginVisualHeroBrandText {
          display: flex;
          flex-direction: column;
        }

        .loginVisualEyebrow {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 4px;
        }

        .loginAccentBar {
          width: 20px;
          height: 2px;
          background: #38bdf8;
          border-radius: 2px;
        }

        .loginVisualEyebrow span:last-child {
          font-size: 11.5px;
          font-weight: 800;
          letter-spacing: 1.5px;
          color: #38bdf8;
          text-transform: uppercase;
        }

        .loginVisualTitle {
          font-size: 32px;
          font-weight: 700;
          color: #ffffff;
          letter-spacing: -0.5px;
          margin: 0;
          line-height: 1.15;
          text-shadow: 0 2px 10px rgba(0, 0, 0, 0.35);
        }

        .loginVisualDivider {
          width: 100%;
          height: 1px;
          background: rgba(255, 255, 255, 0.2);
          margin-bottom: 14px;
        }

        .loginVisualFooterRow {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          gap: 12px;
        }

        .loginVisualSecurity {
          display: inline-flex !important;
          align-items: center !important;
          gap: 7px !important;
          font-size: 12px !important;
          font-weight: 600 !important;
          color: #ffffff !important;
          text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5) !important;
        }
        .loginVisualSecurity span {
          color: #ffffff !important;
        }

        /* ═══════════════════════════════════════════
           PANEL DERECHO (CARD FORMULARIO)
           ═══════════════════════════════════════════ */
        body:not(.informes-theme) .loginCard.loginCard {
          padding: 36px 38px !important;
          display: flex !important;
          flex-direction: column !important;
          justify-content: space-between !important;
          box-sizing: border-box !important;
          background: #ffffff !important;
          position: relative !important;
        }

        .loginHeaderRow {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 26px;
        }

        .loginHeaderBrand {
          display: flex;
          align-items: center;
          gap: 15px;
        }

        .loginHeaderLogoBox {
          width: 58px;
          height: 58px;
          border-radius: 14px;
          border: 1px solid #e2e8f0;
          background: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          box-shadow: 0 4px 14px rgba(15, 23, 42, 0.06);
          padding: 5px;
          box-sizing: border-box;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .loginHeaderLogoBox:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 18px rgba(0, 122, 135, 0.12);
        }

        .loginHeaderLogo {
          width: 100%;
          height: 100%;
          object-fit: contain;
          filter: drop-shadow(0 1px 2px rgba(0, 122, 135, 0.15));
        }

        .loginHeaderBrandText {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .loginHeaderBrandName {
          font-size: 23px;
          font-weight: 800;
          color: #0f172a;
          line-height: 1.1;
          letter-spacing: -0.4px;
        }

        .loginHeaderBrandSub {
          font-size: 10.5px;
          font-weight: 800;
          letter-spacing: 1.2px;
          color: #007a87;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .loginLangPill {
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 5px 10px;
          font-size: 12px;
          font-weight: 600;
          color: #475569;
          display: flex;
          align-items: center;
          gap: 6px;
          background: #ffffff;
          box-shadow: 0 1px 2px rgba(0,0,0,0.03);
        }

        /* ── Titulares de Bienvenida ── */
        .loginIntroBlock {
          margin-bottom: 22px;
        }

        .loginMainTitle {
          font-size: 27px;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.6px;
          margin: 0 0 8px 0;
          line-height: 1.2;
        }

        .loginMainSubtitle {
          font-size: 13.5px;
          color: #64748b;
          line-height: 1.48;
          margin: 0;
        }

        /* ── Banner de Actualización de Versión ── */
        .loginUpdateBanner {
          background: #ecfdf5;
          border: 1px solid #a7f3d0;
          border-radius: 12px;
          padding: 12px 14px;
          margin-bottom: 18px;
          display: flex;
          align-items: center;
          gap: 12px;
          box-shadow: 0 1px 4px rgba(16, 185, 129, 0.06);
        }

        .loginUpdateIconBox {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #a7f3d0;
          color: #047857;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .loginUpdateContent {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .loginUpdateTitle {
          font-size: 13px;
          font-weight: 700;
          color: #065f46;
        }

        .loginUpdateDesc {
          font-size: 11.5px;
          color: #334155;
          line-height: 1.4;
          margin: 0;
        }

        /* ── Botón de Continuar con Google Workspace ── */
        .loginGoogleBtnContainer {
          width: 100%;
          margin-bottom: 10px;
        }

        .loginGoogleBtn {
          width: 100%;
          height: 48px;
          border-radius: 12px;
          border: 1.5px solid #cbd5e1;
          background: #ffffff;
          color: #1e293b;
          font-size: 14.5px;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
        }

        .loginGoogleBtn:hover:not(:disabled) {
          border-color: #94a3b8;
          background: #f8fafc;
          box-shadow: 0 4px 14px rgba(15, 23, 42, 0.08);
          transform: translateY(-1px);
        }

        .loginGoogleBtn:active:not(:disabled) {
          transform: translateY(0);
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
        }

        .loginGoogleBtn:disabled {
          opacity: 0.75;
          cursor: not-allowed;
          background: #f1f5f9;
        }

        .loginGoogleIcon {
          width: 20px;
          height: 20px;
          display: block;
          flex-shrink: 0;
        }

        .loginLoadingState {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #475569;
        }

        .loginSpinner {
          width: 18px;
          height: 18px;
          border: 2.5px solid #cbd5e1;
          border-top-color: #0284c7;
          border-radius: 50%;
          animation: loginSpin 0.75s linear infinite;
        }

        /* ── Nota de Acceso Seguro Exclusivo ── */
        .loginDomainNote {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          font-size: 11.5px;
          color: #64748b;
          margin-bottom: 18px;
        }

        .loginDomainNote svg {
          color: #64748b;
          flex-shrink: 0;
        }

        .loginDomainNote strong {
          color: #0f172a;
          font-weight: 700;
        }

        /* ── Tarjeta SSO Centralizada ── */
        .loginSsoCard {
          background: #f0f9ff;
          border: 1px solid #e0f2fe;
          border-radius: 12px;
          padding: 13px 15px;
          display: flex;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 20px;
        }

        .loginSsoIconBox {
          margin-top: 1px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .loginSsoContent {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .loginSsoTitle {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.5px;
          color: #0f172a;
          text-transform: uppercase;
        }

        .loginSsoDesc {
          font-size: 11.5px;
          color: #64748b;
          line-height: 1.45;
        }

        /* ── Enlace de Soporte IT ── */
        .loginHelpRow {
          display: flex;
          justify-content: center;
          margin-bottom: 24px;
        }

        .loginHelpBtn {
          background: transparent !important;
          border: none !important;
          outline: none !important;
          box-shadow: none !important;
          color: #0284c7 !important;
          font-size: 12.5px !important;
          font-weight: 600 !important;
          display: inline-flex !important;
          align-items: center !important;
          gap: 6px !important;
          cursor: pointer !important;
          padding: 0 !important;
          border-radius: 0 !important;
          transition: color 0.15s ease !important;
        }

        .loginHelpBtn:hover {
          color: #0369a1 !important;
          text-decoration: underline !important;
          background: transparent !important;
        }

        /* ── Footer ── */
        .loginFooter {
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          font-size: 11px !important;
          color: #94a3b8 !important;
          border-top: 1px solid #f1f5f9 !important;
          padding-top: 16px !important;
          margin-top: auto !important;
          width: 100% !important;
          box-sizing: border-box !important;
          gap: 8px !important;
        }

        .loginFooterLeft {
          font-weight: 500 !important;
          font-size: 10.5px !important;
          color: #94a3b8 !important;
          white-space: nowrap !important;
        }

        .loginFooterRight {
          display: flex !important;
          align-items: center !important;
          gap: 6px !important;
          font-size: 10.5px !important;
          color: #94a3b8 !important;
          white-space: nowrap !important;
        }

        /* ═══════════════════════════════════════════
           MODAL DE SOPORTE TÉCNICO
           ═══════════════════════════════════════════ */
        .qp-support-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.65);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          z-index: 99999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          animation: loginFadeIn 0.2s ease-out;
        }

        .qp-support-modal {
          width: min(390px, 94vw);
          background: #ffffff;
          border-radius: 16px;
          box-shadow: 0 24px 60px rgba(15, 23, 42, 0.25);
          overflow: hidden;
          animation: loginFadeIn 0.25s ease-out;
        }

        .qp-support-modal-header {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 16px 20px;
          border-bottom: 1px solid #e2e8f0;
          background: #f8fafc;
        }

        .qp-support-modal-header span.material-symbols-outlined {
          color: #0284c7;
          font-size: 22px;
        }

        .qp-support-modal-header span:nth-child(2) {
          font-size: 15px;
          font-weight: 700;
          color: #0f172a;
          flex: 1;
        }

        .qp-support-modal-close {
          background: none;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 4px;
          border-radius: 6px;
          transition: background 0.15s;
        }

        .qp-support-modal-close:hover {
          background: #e2e8f0;
        }

        .qp-support-modal-close span {
          color: #64748b;
          font-size: 20px;
        }

        .qp-support-modal-body {
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .qp-support-contact {
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }

        .qp-support-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .qp-support-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .qp-support-name {
          font-size: 13.5px;
          font-weight: 700;
          color: #0f172a;
        }

        .qp-support-email,
        .qp-support-phone {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: #64748b;
          text-decoration: none;
          transition: color 0.15s;
        }

        .qp-support-email:hover,
        .qp-support-phone:hover {
          color: #0284c7;
        }

        .qp-support-email span.material-symbols-outlined,
        .qp-support-phone span.material-symbols-outlined {
          font-size: 15px;
          color: #94a3b8;
        }

        .qp-support-divider {
          height: 1px;
          background: #f1f5f9;
        }

        .qp-support-hours {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11.5px;
          color: #94a3b8;
          font-weight: 600;
          padding-top: 4px;
          border-top: 1px solid #f1f5f9;
        }

        .qp-support-hours span.material-symbols-outlined {
          font-size: 16px;
          color: #94a3b8;
        }

        /* ═══════════════════════════════════════════
           ADAPTABILIDAD RESPONSIVA (MOBILE & TABLET)
           ═══════════════════════════════════════════ */
        @media (max-width: 960px) {
          body:not(.informes-theme) .loginScreen.loginScreen {
            padding: 16px !important;
          }

          body:not(.informes-theme) .loginShell.loginShell {
            grid-template-columns: 1fr !important;
            max-width: 500px !important;
            min-height: auto !important;
            border-radius: 18px !important;
          }

          body:not(.informes-theme) .loginVisualPanel.loginVisualPanel {
            min-height: 240px !important;
            height: 240px !important;
            padding: 20px !important;
          }

          .loginVisualHeroLogo {
            width: 46px !important;
            height: 46px !important;
          }

          .loginVisualTitle {
            font-size: 24px !important;
            margin-bottom: 0 !important;
          }

          .loginGlassPill {
            padding: 4px 10px !important;
            font-size: 10.5px !important;
          }

          body:not(.informes-theme) .loginCard.loginCard {
            padding: 30px 24px 26px !important;
          }

          .loginHeaderLogoBox {
            width: 48px !important;
            height: 48px !important;
          }

          .loginHeaderBrandName {
            font-size: 18px !important;
          }

          .loginMainTitle {
            font-size: 23px !important;
          }
        }

        @media (max-width: 480px) {
          body:not(.informes-theme) .loginScreen.loginScreen {
            padding: 10px !important;
          }

          body:not(.informes-theme) .loginShell.loginShell {
            border-radius: 16px !important;
            box-shadow: 0 10px 30px rgba(15, 23, 42, 0.1) !important;
          }

          body:not(.informes-theme) .loginVisualPanel.loginVisualPanel {
            min-height: 200px !important;
            height: 200px !important;
            padding: 16px !important;
          }

          .loginVisualHeroLogo {
            width: 40px !important;
            height: 40px !important;
          }

          .loginVisualTitle {
            font-size: 20px !important;
            margin-bottom: 0 !important;
          }

          body:not(.informes-theme) .loginCard.loginCard {
            padding: 24px 16px 20px !important;
          }

          .loginHeaderLogoBox {
            width: 44px !important;
            height: 44px !important;
          }

          .loginHeaderBrandName {
            font-size: 17px !important;
          }

          .loginFooter {
            flex-direction: column !important;
            gap: 8px !important;
            text-align: center !important;
          }

          .loginFooterRight {
            justify-content: center !important;
          }
        }
      `}</style>
    </div>
  );
}
