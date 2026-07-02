import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import authService from '../../services/authService';
import firebaseService from '../../services/firebase';
import { useAuth } from '../informes/context/AuthContext';

function getHomePath(user) {
  if (!user) return '/login';
  const role = String(user.role || '').trim().toLowerCase();
  if (['admin', 'vendedor', 'recepcionista', 'frontoffice', 'front_office'].includes(role)) {
    return '/calendar';
  }
  if (['eventos', 'coordinador'].includes(role)) {
    return '/kanban';
  }
  return '/kanban';
}

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  let navigate;
  try {
    navigate = useNavigate();
  } catch (_err) {
    navigate = (path) => { window.location.href = path; };
  }
  const { syncSession } = useAuth();
  const googleLoginRef = useRef(false);

  useEffect(() => {
    toast.success('Sistema listo', { id: 'sistema-listo', duration: 3000 });
  }, []);

  // Redirect to correct home path immediately if session is already active
  useEffect(() => {
    const user = authService.getCurrentUser();
    if (user) {
      navigate(getHomePath(user));
    }
  }, [navigate]);

  // Complete Google redirect login when popup auth is blocked by the browser.
  useEffect(() => {
    let cancelled = false;

    const completeRedirectLogin = async () => {
      try {
        const firebaseUser = await firebaseService.getGoogleRedirectUser();
        if (!firebaseUser || cancelled) return;

        setLoading(true);
        const localUser = await authService.loginFirebase(firebaseUser);
        if (cancelled) return;

        document.activeElement?.blur();
        toast.success(`Bienvenido, ${localUser.fullName || localUser.name}`, { duration: 2000 });
        syncSession();
        const homePath = getHomePath(localUser);
        setTimeout(() => navigate(homePath), 500);
      } catch (err) {
        if (!cancelled) {
          console.error('Google redirect login error detail:', err);
          document.activeElement?.blur();
          toast.error(err.message || 'No se pudo completar el inicio de sesión con Google.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    completeRedirectLogin();

    return () => {
      cancelled = true;
    };
  }, [navigate, syncSession]);

  // Handle Google Login via Firebase
  const handleGoogleLogin = async () => {
    if (googleLoginRef.current) return;
    googleLoginRef.current = true;
    setLoading(true);

    let loadingToast = null;
    try {
      const firebaseUser = await firebaseService.loginWithGoogle();
      if (!firebaseUser) {
        // Redireccionando a Google — no reseteamos loading, la página se recargará
        return;
      }

      loadingToast = toast.loading('Sincronizando con el servidor...');

      const localUser = await authService.loginFirebase(firebaseUser);
      document.activeElement?.blur();
      if (loadingToast) toast.dismiss(loadingToast);
      toast.success(`Bienvenido, ${localUser.fullName || localUser.name}`, { duration: 2000 });
      syncSession();
      const homePath = getHomePath(localUser);
      setTimeout(() => navigate(homePath), 500);
    } catch (err) {
      console.error('Google login error detail:', err);
      if (loadingToast) toast.dismiss(loadingToast);
      
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
      }, 1000);
    }
  };



  return (
    <div className="loginScreen" id="loginScreen">
      <div className="loginShell" role="dialog" aria-labelledby="loginTitle" aria-modal="true">
        
        {/* PANEL VISUAL IZQUIERDO */}
        <section className="loginVisualPanel" aria-label="Hotel Jardines del Lago">
          <img className="loginVisualImage" src="/montaje.jpg" alt="Montaje Gestion de Reservas" />
          <div className="loginVisualShade"></div>
          <div className="loginVisualBrand">
            <img src="/Oficial_JDL_blanco.png" alt="Logo Jardines del Lago" className="loginVisualLogo" />
            <div>
              <strong>Hotel Jardines del Lago</strong>
              <span>Panajachel, Sololá</span>
            </div>
          </div>
          <div className="loginVisualQuote">
            <span>Hotel Jardines del Lago</span>
            <strong>Gestión de Reservas</strong>
          </div>
        </section>

        {/* CARD DE INICIO DE SESIÓN */}
        <section className="loginCard" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div className="loginBrand" style={{ marginBottom: '25px' }}>
            <div className="loginBrandBadge">
              <img src="/Oficial_JDL_acua.png" alt="Logo Jardines del Lago" className="loginLogoImg" />
            </div>
            <div>
              <div className="loginBrandEyebrow">Bienvenidos al EMS de</div>
              <h1 className="loginBrandTitle" id="loginTitle">HOTEL JARDINES DEL LAGO</h1>
              <div className="loginBrandSub">Inicia sesión para continuar</div>
            </div>
          </div>



          {/* BOTÓN DE GOOGLE LOGIN */}
          <div style={{ width: '100%' }}>
            <button 
              className="loginGoogleBtn" 
              id="btnGoogleLogin" 
              type="button" 
              onClick={handleGoogleLogin}
              disabled={loading}
              style={{ 
                width: '100%', padding: '14px', background: '#0b1c30', border: 'none',
                borderRadius: '10px', fontSize: '14px', fontWeight: '700', color: 'white',
                cursor: loading ? 'not-allowed' : 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center', gap: '10px',
                boxShadow: '0 8px 20px rgba(11,28,48,0.2)', transition: 'all 0.3s ease',
                transform: loading ? 'scale(0.98)' : 'none', opacity: loading ? 0.8 : 1
              }}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ display: 'inline-block', width: '18px', height: '18px', border: '3px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></span>
                  <span>Autenticando...</span>
                </span>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" style={{ width: '20px', height: '20px', display: 'block' }} aria-hidden="true">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                  </svg>
                  <span>Continuar con Google</span>
                </>
              )}
            </button>
          </div>
        </section>

        {/* SOPORTE */}
        {isSupportOpen && (
          <div className="qp-support-modal-backdrop" onClick={() => setIsSupportOpen(false)}>
            <div className="qp-support-modal" onClick={e => e.stopPropagation()}>
              <div className="qp-support-modal-header">
                <span className="material-symbols-outlined">support_agent</span>
                <span>Soporte Técnico</span>
                <button className="qp-support-modal-close" onClick={() => setIsSupportOpen(false)}>
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              <div className="qp-support-modal-body">
                <div className="qp-support-contact">
                  <img src="https://ui-avatars.com/api/?name=Sistemas+Hoteles&background=14b8a6&color=fff&size=40" alt="SH" className="qp-support-avatar" />
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
                  <img src="https://ui-avatars.com/api/?name=Sistemas+JDL&background=14b8a6&color=fff&size=40" alt="SJ" className="qp-support-avatar" />
                  <div className="qp-support-info">
                    <span className="qp-support-name">Sistemas JDL</span>
                    <a href="mailto:sistema@jardinesdellago.com" className="qp-support-email">
                      <span className="material-symbols-outlined">mail</span>
                      sistema@jardinesdellago.com
                    </a>
                    <a href="tel:+50256325547" className="qp-support-phone">
                      <span className="material-symbols-outlined">call</span>
                      +502 56325547
                    </a>
                  </div>
                </div>
                <div className="qp-support-hours">
                  <span className="material-symbols-outlined">schedule</span>
                  Lun-Sáb 8:00-18:00
                </div>
              </div>
            </div>
          </div>
        )}
        <div className="loginSupportWidget">
          <button className="loginSupportBtn" id="btnLoginSupport" type="button" onClick={() => setIsSupportOpen(true)}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 12a8 8 0 0 1 16 0"></path>
              <path d="M5 13h3v5H5a2 2 0 0 1-2-2v-1a2 2 0 0 1 2-2z"></path>
              <path d="M19 13h-3v5h3a2 2 0 0 0 2-2v-1a2 2 0 0 0-2-2z"></path>
              <path d="M16 18c0 1.7-1.3 3-3 3h-1"></path>
            </svg>
            <span>Soporte</span>
          </button>
        </div>
      </div>
      <style>{`
        /* ═══════════════════════════════════════════
           KEYFRAMES
           ═══════════════════════════════════════════ */
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes loginFadeIn {
          from { opacity: 0; transform: scale(0.96); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes loginSlideUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes loginLogoPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(51,182,222,0.3); }
          50%       { box-shadow: 0 0 0 12px rgba(51,182,222,0); }
        }
        @keyframes loginBgAurora {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes loginFadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes loginDropdownIn {
          from { opacity: 0; transform: translateY(-4px) scaleY(0.96); }
          to   { opacity: 1; transform: translateY(0) scaleY(1); }
        }
        @keyframes loginModalIn {
          from { opacity: 0; transform: scale(0.92) translateY(12px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }

        /* ═══════════════════════════════════════════
           LOGIN SCREEN — Aurora background
           ═══════════════════════════════════════════ */
        body:not(.informes-theme) .loginScreen.loginScreen {
          animation: loginFadeIn 0.6s ease-out;
          background:
            radial-gradient(1200px 700px at 15% 5%, rgba(14,165,233,0.24), transparent 55%),
            radial-gradient(1000px 700px at 90% 20%, rgba(59,130,246,0.25), transparent 60%),
            rgba(2,6,23,0.86);
          background-size: 200% 200%;
          animation: loginBgAurora 18s ease-in-out infinite, loginFadeIn 0.6s ease-out;
        }

        /* ═══════════════════════════════════════════
           LOGIN SHELL — entrance animation
           ═══════════════════════════════════════════ */
        body:not(.informes-theme) .loginShell.loginShell {
          animation: loginFadeIn 0.5s ease-out;
        }

        /* ═══════════════════════════════════════════
           VISUAL PANEL
           ═══════════════════════════════════════════ */
        body:not(.informes-theme) .loginVisualPanel.loginVisualPanel {
          animation: loginSlideUp 0.6s ease-out 0.1s both;
        }

        /* ═══════════════════════════════════════════
           LOGIN CARD — staggered entrance
           ═══════════════════════════════════════════ */
        body:not(.informes-theme) .loginCard.loginCard {
          animation: loginSlideUp 0.5s ease-out 0.15s both;
        }

        /* ═══════════════════════════════════════════
           BRAND BADGE — pulse glow
           ═══════════════════════════════════════════ */
        body:not(.informes-theme) .loginBrandBadge.loginBrandBadge {
          animation: loginLogoPulse 2.8s ease-in-out infinite;
        }

        /* ═══════════════════════════════════════════
           INPUTS — improved focus & transitions
           ═══════════════════════════════════════════ */
        body:not(.informes-theme) .loginInput.loginInput {
          transition: all 0.2s ease !important;
        }
        body:not(.informes-theme) .loginInput.loginInput:focus {
          border-color: rgba(51,182,222,0.7) !important;
          box-shadow: 0 0 0 3px rgba(51,182,222,0.15), 0 8px 20px rgba(11,28,48,0.08) !important;
          transform: translateY(-1px);
        }
        body:not(.informes-theme) .loginInput.loginInput:hover {
          border-color: rgba(148,163,184,0.5);
        }

        /* ═══════════════════════════════════════════
           LOGIN BUTTON — refined hover/active
           ═══════════════════════════════════════════ */
        body:not(.informes-theme) .loginBtn.loginBtn {
          position: relative;
          overflow: hidden;
          transition: all 0.25s ease !important;
        }
        body:not(.informes-theme) .loginBtn.loginBtn::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.08), transparent 50%);
          opacity: 0;
          transition: opacity 0.25s ease;
        }
        body:not(.informes-theme) .loginBtn.loginBtn:hover:not(:disabled)::before {
          opacity: 1;
        }
        body:not(.informes-theme) .loginBtn.loginBtn:hover:not(:disabled) {
          background: #14283f !important;
          transform: translateY(-1px);
          box-shadow: 0 8px 24px rgba(11,28,48,0.25) !important;
        }
        body:not(.informes-theme) .loginBtn.loginBtn:active:not(:disabled) {
          transform: translateY(0) scale(0.98);
        }

        /* ═══════════════════════════════════════════
           GOOGLE BUTTON — refined hover/active
           ═══════════════════════════════════════════ */
        .loginGoogleBtn {
          position: relative;
          overflow: hidden;
          transition: all 0.25s ease !important;
        }
        .loginGoogleBtn::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.1), transparent 50%);
          opacity: 0;
          transition: opacity 0.25s ease;
        }
        .loginGoogleBtn:hover:not(:disabled)::before {
          opacity: 1;
        }
        .loginGoogleBtn:hover:not(:disabled) {
          background: #14283f !important;
          transform: translateY(-2px);
          box-shadow: 0 12px 24px rgba(11,28,48,0.3) !important;
        }
        .loginGoogleBtn:active:not(:disabled) {
          transform: translateY(0) scale(0.97) !important;
        }

        /* ═══════════════════════════════════════════
           SUPPORT BUTTON — slide-in
           ═══════════════════════════════════════════ */
        body:not(.informes-theme) .loginSupportWidget.loginSupportWidget {
          animation: loginSlideUp 0.5s ease-out 0.35s both;
        }

        /* ═══════════════════════════════════════════
           USER DROPDOWN — smooth animation
           ═══════════════════════════════════════════ */
        .loginDropdown.loginDropdown {
          animation: loginDropdownIn 0.15s ease-out;
          transform-origin: top center;
        }
        .loginDropdown.loginDropdown .loginDropdownItem {
          transition: background 0.12s ease, transform 0.1s ease;
        }
        .loginDropdown.loginDropdown .loginDropdownItem:hover {
          background: #eef2ff !important;
        }
        .loginDropdown.loginDropdown .loginDropdownItem:active {
          transform: scale(0.98);
        }

        /* ═══════════════════════════════════════════
           SKIP LINK — hover refinement
           ═══════════════════════════════════════════ */
        .loginSkipBtn.loginSkipBtn {
          transition: all 0.2s ease;
        }
        .loginSkipBtn.loginSkipBtn:hover {
          color: #64748b !important;
          text-decoration-color: #64748b;
        }

        /* ═══════════════════════════════════════════
           SUPPORT MODAL — entrance animation
           ═══════════════════════════════════════════ */
        .qp-support-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.6);
          z-index: 999999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          animation: loginFadeIn 0.15s ease-out;
        }
        .qp-support-modal {
          width: min(380px, 90vw);
          background: #ffffff;
          border: 1px solid rgba(148, 163, 184, 0.2);
          border-radius: 16px;
          box-shadow: 0 24px 60px rgba(0, 0, 0, 0.15);
          overflow: hidden;
          animation: loginModalIn 0.25s ease-out;
        }
        .qp-support-modal-header {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 16px 18px;
          border-bottom: 1px solid #e2e8f0;
          color: #0f172a;
          font-size: 15px;
          font-weight: 800;
        }
        .qp-support-modal-header span.material-symbols-outlined:first-child {
          font-size: 22px;
          color: #14b8a6;
        }
        .qp-support-modal-close {
          margin-left: auto;
          background: transparent !important;
          border: none !important;
          color: #94a3b8 !important;
          cursor: pointer;
          padding: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          box-shadow: none !important;
          outline: none !important;
          transition: all 0.15s ease;
        }
        .qp-support-modal-close span {
          font-size: 20px;
          color: #94a3b8 !important;
          transition: color 0.15s ease;
        }
        .qp-support-modal-close:hover {
          background: #f1f5f9 !important;
        }
        .qp-support-modal-close:hover span {
          color: #0f172a !important;
        }
        .qp-support-modal-body {
          padding: 18px;
          display: flex;
          flex-direction: column;
          gap: 14px;
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
          transition: transform 0.2s ease;
        }
        .qp-support-contact:hover .qp-support-avatar {
          transform: scale(1.08);
        }
        .qp-support-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 0;
          flex: 1;
        }
        .qp-support-name {
          color: #0f172a;
          font-size: 13px;
          font-weight: 700;
        }
        .qp-support-email,
        .qp-support-phone {
          display: flex;
          align-items: center;
          gap: 6px;
          color: #64748b !important;
          font-size: 11.5px;
          font-weight: 600;
          text-decoration: none;
          transition: color 0.15s, transform 0.15s;
          word-break: break-all;
        }
        .qp-support-email:hover,
        .qp-support-phone:hover {
          color: #14b8a6 !important;
          transform: translateX(2px);
        }
        .qp-support-email span.material-symbols-outlined,
        .qp-support-phone span.material-symbols-outlined {
          font-size: 15px;
          color: #64748b !important;
          flex-shrink: 0;
          transition: color 0.15s;
        }
        .qp-support-email:hover span.material-symbols-outlined,
        .qp-support-phone:hover span.material-symbols-outlined {
          color: #14b8a6 !important;
        }
        .qp-support-divider {
          height: 1px;
          background: #e2e8f0;
          margin: 0;
        }
        .qp-support-hours {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #94a3b8;
          font-size: 11px;
          font-weight: 700;
          padding-top: 4px;
        }
        .qp-support-hours span.material-symbols-outlined {
          font-size: 16px;
          color: #94a3b8 !important;
        }

        /* ═══════════════════════════════════════════
           RESPONSIVE OVERRIDES
           ═══════════════════════════════════════════ */
        @media (max-width: 1024px) {
          body:not(.informes-theme) .loginShell.loginShell {
            grid-template-columns: 1fr !important;
            min-height: auto !important;
            height: auto !important;
            width: 100% !important;
            max-width: 480px !important;
            margin: 0 auto !important;
            overflow: visible !important;
            box-shadow: 0 10px 25px rgba(15,23,42,0.08) !important;
          }
          body:not(.informes-theme) .loginVisualPanel.loginVisualPanel {
            min-height: 260px !important;
            height: 260px !important;
          }
          body:not(.informes-theme) .loginVisualQuote.loginVisualQuote {
            bottom: 20px !important;
            left: 20px !important;
            right: 20px !important;
          }
          body:not(.informes-theme) .loginVisualQuote strong {
            font-size: 24px !important;
          }
          body:not(.informes-theme) .loginCard.loginCard {
            padding: 24px 20px 30px !important;
          }
          body:not(.informes-theme) .loginBrandBadge.loginBrandBadge {
            width: 80px !important;
            height: 80px !important;
            flex-basis: 80px !important;
          }
          body:not(.informes-theme) .loginLogoImg.loginLogoImg {
            width: 64px !important;
            height: 64px !important;
          }
          body:not(.informes-theme) .loginBrandTitle.loginBrandTitle {
            font-size: 22px !important;
          }
        }

        @media (max-width: 640px) {
          body:not(.informes-theme) .loginScreen.loginScreen {
            padding: 12px !important;
            background: #f0f4f8 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            animation: none !important;
          }
          body:not(.informes-theme) .loginShell.loginShell {
            border: none !important;
            box-shadow: 0 10px 30px -5px rgba(0,0,0,0.1) !important;
            background: #ffffff !important;
            max-width: 100% !important;
            border-radius: 16px !important;
            overflow: hidden !important;
          }
          body:not(.informes-theme) .loginVisualPanel.loginVisualPanel {
            display: block !important;
            min-height: 220px !important;
            height: 220px !important;
          }
          body:not(.informes-theme) .loginVisualImage.loginVisualImage {
            object-position: center 30% !important;
          }
          body:not(.informes-theme) .loginVisualShade.loginVisualShade {
            background: linear-gradient(180deg, rgba(3,7,18,.10), rgba(3,7,18,.18) 42%, rgba(3,7,18,.62)) !important;
          }
          body:not(.informes-theme) .loginVisualBrand.loginVisualBrand {
            padding: 12px 16px !important;
          }
          body:not(.informes-theme) .loginVisualLogo.loginVisualLogo {
            width: 28px !important;
            height: 28px !important;
          }
          body:not(.informes-theme) .loginVisualBrand strong {
            font-size: 11px !important;
          }
          body:not(.informes-theme) .loginVisualBrand span {
            display: none !important;
          }
          body:not(.informes-theme) .loginVisualQuote.loginVisualQuote {
            display: none !important;
          }
          body:not(.informes-theme) .loginCard.loginCard {
            border-radius: 0 !important;
            background: #ffffff !important;
            border: none !important;
            box-shadow: none !important;
            padding: 24px 20px 30px !important;
          }
          body:not(.informes-theme) .loginBrandTitle.loginBrandTitle {
            font-size: 18px !important;
          }
          body:not(.informes-theme) .loginBrandBadge.loginBrandBadge {
            width: 56px !important;
            height: 56px !important;
            flex-basis: 56px !important;
          }
          body:not(.informes-theme) .loginLogoImg.loginLogoImg {
            width: 44px !important;
            height: 44px !important;
          }
          body:not(.informes-theme) .loginSupportWidget.loginSupportWidget {
            position: fixed !important;
            left: 16px !important;
            bottom: 16px !important;
          }
        }
      `}</style>
    </div>
  );
}
