import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import authService from '../../services/authService';
import firebaseService from '../../services/firebase';

export default function Login() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Redirect to calendar immediately if session is already active
  useEffect(() => {
    if (authService.getCurrentUser()) {
      navigate('/calendar');
    }
  }, [navigate]);

  // Handle Google Login via Firebase
  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      // 1. Sign in with Firebase popup
      const firebaseUser = await firebaseService.loginWithGoogle();
      
      // 2. Synchronize identity with local MariaDB backend
      const localUser = await authService.loginFirebase(firebaseUser);
      
      Swal.fire({
        icon: 'success',
        title: '¡Sesión Iniciada!',
        text: `Bienvenido, ${localUser.fullName || localUser.name}`,
        timer: 1500,
        showConfirmButton: false
      });
      
      setTimeout(() => {
        navigate('/calendar');
      }, 1500);

    } catch (err) {
      console.error('Google login error detail:', err);
      
      // Safe fallback prompt if Firebase is not yet configured or is using default dummy credentials
      if (
        err.code === 'auth/operation-not-allowed' || 
        err.code === 'auth/api-key-not-valid' ||
        err.message?.includes('api-key-not-valid') ||
        err.message?.includes('API key not valid') ||
        err.message?.includes('dummy') || 
        err.message?.includes('AIzaSyDummy')
      ) {
        Swal.fire({
          icon: 'warning',
          title: 'Configuración de Firebase Requerida',
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
          confirmButtonColor: '#0b1c30',
          confirmButtonText: 'Entendido'
        });
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Error de Autenticación',
          text: err.message || 'No se pudo iniciar sesión con tu cuenta de Google.',
          confirmButtonColor: '#0b1c30'
        });
      }
    } finally {
      setLoading(false);
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
        <section className="loginCard" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '40px' }}>
          <div className="loginBrand" style={{ marginBottom: '35px' }}>
            <div className="loginBrandBadge">
              <img src="/Oficial_JDL_acua.png" alt="Logo Jardines del Lago" className="loginLogoImg" />
            </div>
            <div>
              <div className="loginBrandEyebrow">Bienvenidos al CRM de</div>
              <h1 className="loginBrandTitle" id="loginTitle">HOTEL JARDINES DEL LAGO</h1>
              <div className="loginBrandSub">Acceso seguro mediante cuenta de Google</div>
            </div>
          </div>

          {/* ICONO CENTRAL DE SEGURIDAD PREMIUM */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '35px' }}>
            <div style={{
              width: '100px',
              height: '100px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid #bbf7d0',
              boxShadow: '0 10px 25px -5px rgba(34, 197, 94, 0.1)',
              position: 'relative'
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: '48px', color: '#16a34a' }}>admin_panel_settings</span>
              <div style={{
                position: 'absolute',
                bottom: '-2px',
                right: '-2px',
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                background: '#16a34a',
                border: '3px solid white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'white', fontWeight: 'bold' }}>check</span>
              </div>
            </div>
          </div>

          {/* MENSAJE DE SEGURIDAD */}
          <div style={{ textAlign: 'center', marginBottom: '30px' }}>
            <p style={{ fontSize: '14px', color: '#64748b', margin: '0 0 8px 0', fontWeight: '500' }}>
              Para garantizar la seguridad del sistema
            </p>
            <span style={{ fontSize: '12px', color: '#94a3b8', background: '#f8fafc', padding: '6px 12px', borderRadius: '20px', border: '1px solid #f1f5f9', display: 'inline-block' }}>
              🔑 Cuentas personales o corporativas autorizadas.
            </span>
          </div>

          {/* BOTÓN ÚNICO DE GOOGLE LOGIN CORPORATIVO */}
          <div style={{ width: '100%' }}>
            <button 
              className="loginGoogleBtn" 
              id="btnGoogleLogin" 
              type="button" 
              onClick={handleGoogleLogin}
              disabled={loading}
              style={{ 
                width: '100%', 
                padding: '16px', 
                background: '#0b1c30', 
                border: 'none', 
                borderRadius: '12px', 
                fontSize: '16px', 
                fontWeight: '700', 
                color: 'white', 
                cursor: loading ? 'not-allowed' : 'pointer', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                gap: '12px', 
                boxShadow: '0 8px 20px rgba(11,28,48,0.2)',
                transition: 'all 0.3s ease',
                transform: loading ? 'scale(0.98)' : 'none',
                opacity: loading ? 0.8 : 1
              }}
            >
              {loading ? (
                <span className="loginBtnLoading" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="loginSpinner" style={{ display: 'inline-block', width: '18px', height: '18px', border: '3px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></span>
                  <span>Autenticando...</span>
                </span>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" style={{ width: '22px', height: '22px', display: 'block' }} aria-hidden="true">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Continuar con Google</span>
                </>
              )}
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
        .loginGoogleBtn:active {
          transform: translateY(0);
        }
      `}</style>
    </div>
  );
}
