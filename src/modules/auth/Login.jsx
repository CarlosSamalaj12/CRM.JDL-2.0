import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import authService from '../../services/authService';
import firebaseService from '../../services/firebase';

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [loginUsers, setLoginUsers] = useState([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Redirect to calendar immediately if session is already active
  useEffect(() => {
    if (authService.getCurrentUser()) {
      navigate('/calendar');
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
        Swal.fire({
          icon: 'success',
          title: '¡Sesión Iniciada!',
          text: `Bienvenido, ${localUser.fullName || localUser.name}`,
          timer: 1500,
          showConfirmButton: false
        });
        setTimeout(() => navigate('/calendar'), 1500);
      } catch (err) {
        if (!cancelled) {
          console.error('Google redirect login error detail:', err);
          document.activeElement?.blur();
          Swal.fire({ icon: 'error', title: 'Error de Autenticación', text: err.message || 'No se pudo completar el inicio de sesión con Google.' });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    completeRedirectLogin();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  // Fetch login users on mount
  useEffect(() => {
    authService.getLoginUsers().then(setLoginUsers);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target) &&
          inputRef.current && !inputRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filteredUsers = loginUsers.filter(u =>
    (u.fullName || u.name || u.username || '').toLowerCase().includes(username.toLowerCase())
  );

  const selectUser = (u) => {
    setUsername(u.fullName || u.name || u.username || '');
    setShowDropdown(false);
  };

  // Handle local login
  const handleLocalLogin = async () => {
    if (!username.trim()) {
      document.activeElement?.blur();
      Swal.fire({ icon: 'warning', title: 'Usuario requerido', text: 'Selecciona o escribe tu nombre de usuario.' });
      return;
    }
    setLoading(true);
    try {
      const matchedUser = loginUsers.find(u =>
        (u.fullName || u.name || u.username || '').toLowerCase() === username.toLowerCase()
      );
      const userId = matchedUser?.id || username;
      const localUser = await authService.loginLocal(userId, password);
      document.activeElement?.blur();
      Swal.fire({
        icon: 'success', title: '¡Sesión Iniciada!',
        text: `Bienvenido, ${localUser.fullName || localUser.name}`,
        timer: 1500, showConfirmButton: false
      });
      setTimeout(() => navigate('/calendar'), 1500);
    } catch (err) {
      document.activeElement?.blur();
      Swal.fire({ icon: 'error', title: 'Error de Autenticación', text: err.message || 'Credenciales inválidas.' });
    } finally {
      setLoading(false);
    }
  };

  // Handle Google Login via Firebase
  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const firebaseUser = await firebaseService.loginWithGoogle();
      if (!firebaseUser) return;
      const localUser = await authService.loginFirebase(firebaseUser);
      document.activeElement?.blur();
      Swal.fire({
        icon: 'success', title: '¡Sesión Iniciada!',
        text: `Bienvenido, ${localUser.fullName || localUser.name}`,
        timer: 1500, showConfirmButton: false
      });
      setTimeout(() => navigate('/calendar'), 1500);
    } catch (err) {
      console.error('Google login error detail:', err);
      if (
        err.code === 'auth/operation-not-allowed' || 
        err.code === 'auth/api-key-not-valid' ||
        err.message?.includes('api-key-not-valid') ||
        err.message?.includes('API key not valid') ||
        err.message?.includes('dummy') || 
        err.message?.includes('AIzaSyDummy')
      ) {
        document.activeElement?.blur();
        Swal.fire({
          icon: 'warning', title: 'Configuración de Firebase Requerida',
          html: '<div style="text-align: left; font-size: 14px; line-height: 1.6; color: #475569;">' +
                '<p>Para que el inicio de sesión con Google funcione con tus credenciales reales, debes configurar tus variables de Firebase en el archivo <code>.env</code> de tu frontend.</p>' +
                '<p><strong>Pasos para configurarlo:</strong></p>' +
                '<ol>' +
                '  <li>Abre el archivo <code>react/CRM.JDL/.env</code>.</li>' +
                '  <li>Reemplaza los valores de <code>VITE_FIREBASE_API_KEY</code>, etc., con tus credenciales de la consola de Firebase.</li>' +
                '  <li>Reinicia tu servidor de React.</li>' +
                '</ol>' +
                '<p style="margin-top: 15px; font-size: 12px; color: #94a3b8;">* Si necesitas ayuda, consulta la guía <code>auth_implementation_walkthrough.md</code> en tus archivos.</p>' +
                '</div>',
          confirmButtonColor: '#0b1c30', confirmButtonText: 'Entendido'
        });
      } else {
        document.activeElement?.blur();
        Swal.fire({ icon: 'error', title: 'Error de Autenticación', text: err.message || 'No se pudo iniciar sesión con tu cuenta de Google.' });
      }
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: '12px 14px', fontSize: '14px',
    border: '1px solid #cbd5e1', borderRadius: '8px', outline: 'none',
    background: '#fff', color: '#0f172a', boxSizing: 'border-box'
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
              <div className="loginBrandEyebrow">Bienvenidos al CRM de</div>
              <h1 className="loginBrandTitle" id="loginTitle">HOTEL JARDINES DEL LAGO</h1>
              <div className="loginBrandSub">Inicia sesión para continuar</div>
            </div>
          </div>

          {/* FORMULARIO DE INICIO DE SESIÓN LOCAL */}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
            {/* SELECTOR DE USUARIO (combobox) */}
            <div style={{ position: 'relative' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>
                Usuario
              </label>
              <input
                ref={inputRef}
                className="loginInput"
                type="text"
                placeholder="Selecciona o escribe tu usuario..."
                value={username}
                onChange={(e) => { setUsername(e.target.value); setShowDropdown(true); }}
                onFocus={() => setShowDropdown(true)}
                style={inputStyle}
                autoComplete="off"
              />
              {showDropdown && filteredUsers.length > 0 && (
                <div
                  ref={dropdownRef}
                  style={{
                    position: 'absolute', top: '100%', left: 0, right: 0,
                    background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px',
                    maxHeight: '180px', overflowY: 'auto', zIndex: 100,
                    boxShadow: '0 8px 16px rgba(0,0,0,0.1)', marginTop: '2px'
                  }}
                >
                  {filteredUsers.map(u => (
                    <div
                      key={u.id}
                      onClick={() => selectUser(u)}
                      style={{
                        padding: '10px 14px', cursor: 'pointer', fontSize: '13px',
                        borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '8px'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700', color: '#64748b', flexShrink: 0 }}>
                        {(u.fullName || u.name || '?')[0].toUpperCase()}
                      </span>
                      <span>{u.fullName || u.name || u.username}</span>
                      {u.role && <span style={{ fontSize: '11px', color: '#94a3b8', marginLeft: 'auto' }}>{u.role}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* CONTRASEÑA */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>
                Contraseña
              </label>
              <input
                className="loginInput"
                type="password"
                placeholder="Ingresa tu contraseña..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLocalLogin()}
                style={inputStyle}
              />
            </div>

            {/* BOTÓN DE INICIO DE SESIÓN LOCAL */}
            <button
              type="button"
              className="loginBtn"
              onClick={handleLocalLogin}
              disabled={loading}
              style={{
                width: '100%', padding: '12px', background: '#0b1c30', border: 'none',
                borderRadius: '8px', fontSize: '14px', fontWeight: '700', color: 'white',
                cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
                transition: 'all 0.3s ease'
              }}
            >
              {loading ? 'Autenticando...' : 'Iniciar Sesión'}
            </button>
          </div>

          {/* DIVISOR */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>o</span>
            <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
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

          {/* ENLACE PARA OMITIR LOGIN */}
          <div style={{ textAlign: 'center', marginTop: '16px' }}>
            <button
              type="button"
              onClick={() => navigate('/calendar')}
              style={{
                background: 'none', border: 'none', color: '#94a3b8',
                fontSize: '13px', cursor: 'pointer', textDecoration: 'underline', padding: '8px'
              }}
            >
              Entrar sin iniciar sesión
            </button>
          </div>
        </section>

        {/* SOPORTE */}
        <div className="loginSupportWidget">
          <button className="loginSupportBtn" id="btnLoginSupport" type="button" aria-expanded="false" aria-controls="loginSupportPanel">
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
        @keyframes spin { to { transform: rotate(360deg); } }
        .loginGoogleBtn:hover {
          background: #14283f !important;
          transform: translateY(-2px);
          box-shadow: 0 12px 24px rgba(11,28,48,0.3) !important;
        }
        .loginGoogleBtn:active { transform: translateY(0); }

        /* Responsive overrides using high specificity prefix to counter global-scoped.css */
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
            min-height: 200px !important;
            height: 200px !important;
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
            background: linear-gradient(135deg, #f0f4f8, #e2e8f0) !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
          }
          body:not(.informes-theme) .loginShell.loginShell {
            border: none !important;
            box-shadow: none !important;
            background: transparent !important;
            max-width: 100% !important;
          }
          body:not(.informes-theme) .loginVisualPanel.loginVisualPanel {
            display: none !important;
          }
          body:not(.informes-theme) .loginCard.loginCard {
            border-radius: 16px !important;
            background: #ffffff !important;
            border: 1px solid rgba(148,163,184,0.16) !important;
            box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04) !important;
            padding: 30px 20px !important;
          }
          body:not(.informes-theme) .loginBrandTitle.loginBrandTitle {
            font-size: 20px !important;
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
