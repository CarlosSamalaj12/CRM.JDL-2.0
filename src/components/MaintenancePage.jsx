import React, { useEffect, useState } from 'react';

const ADMIN_CODE = 'JDL-ADMIN-2026';

export default function MaintenancePage({ onBypassSuccess }) {
  const [timeLeft, setTimeLeft] = useState(30);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [inputCode, setInputCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Soportar activación/desactivación automática vía query param ?admin-code=JDL-ADMIN-2026
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('admin-code');
    if (code && code.trim().toUpperCase() === ADMIN_CODE) {
      handleDisableMaintenance(code.trim().toUpperCase());
    }
  }, []);

  // Polling automático cada 30s para detectar cuando se desactive el modo mantenimiento
  useEffect(() => {
    const interval = setInterval(async () => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          fetch('/api/maintenance-status')
            .then(r => r.json())
            .then(data => {
              if (data.maintenanceMode === false) {
                window.location.reload();
              } else {
                setTimeLeft(30);
              }
            })
            .catch(() => {
              setTimeLeft(30);
            });
          return 30;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleRetry = () => {
    window.location.reload();
  };

  async function handleDisableMaintenance(codeToUse) {
    const code = String(codeToUse || inputCode || '').trim().toUpperCase();
    if (!code) {
      setErrorMsg('Ingresa la contraseña de administrador.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const token = localStorage.getItem('token');
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      };

      // 1. Llamar al endpoint dedicado del servidor
      let res = await fetch('/api/maintenance/disable', {
        method: 'POST',
        headers,
        body: JSON.stringify({ code })
      });

      // 2. Fallback a PUT /api/settings/maintenanceMode si el endpoint no existiera
      if (!res.ok && res.status === 404) {
        res = await fetch('/api/settings/maintenanceMode', {
          method: 'PUT',
          headers,
          body: JSON.stringify({ value: false })
        });
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || 'Contraseña de administrador incorrecta.');
      }

      setSuccessMsg('✅ Modo mantenimiento desactivado. Entrando al sistema...');
      sessionStorage.setItem('crm_maintenance_bypass', 'true');
      window.dispatchEvent(new CustomEvent('maintenanceStatusChanged', { detail: { maintenanceMode: false } }));

      if (onBypassSuccess) {
        onBypassSuccess();
      }

      setTimeout(() => {
        const currentUser = localStorage.getItem('user');
        window.location.href = currentUser ? '/settings' : '/login';
      }, 600);
    } catch (err) {
      console.error('Error al desactivar mantenimiento:', err);
      setErrorMsg(err.message || 'Error al desactivar el modo mantenimiento.');
      setLoading(false);
    }
  }

  async function handleBypassOnly(codeToUse) {
    const code = String(codeToUse || inputCode || '').trim().toUpperCase();
    if (!code) {
      setErrorMsg('Ingresa la contraseña de administrador.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch('/api/maintenance/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      }).catch(() => null);

      let isValid = false;
      if (res && res.ok) {
        isValid = true;
      } else if (code === ADMIN_CODE) {
        isValid = true;
      }

      if (!isValid) {
        throw new Error('Contraseña de administrador incorrecta.');
      }

      setSuccessMsg('✅ Acceso de administrador verificado. Abriendo CRM...');
      sessionStorage.setItem('crm_maintenance_bypass', 'true');

      if (onBypassSuccess) {
        onBypassSuccess();
      }

      setTimeout(() => {
        const currentUser = localStorage.getItem('user');
        window.location.href = currentUser ? '/settings' : '/login';
      }, 500);
    } catch (err) {
      setErrorMsg(err.message || 'Contraseña de administrador incorrecta.');
      setLoading(false);
    }
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: '#f8fafc',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      padding: '24px',
      textAlign: 'center'
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        maxWidth: '460px',
        width: '100%'
      }}>
        <div style={{
          width: '72px',
          height: '72px',
          borderRadius: '50%',
          background: '#fef3c7',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '20px'
        }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
        </div>

        <h1 style={{
          fontSize: '26px',
          fontWeight: 800,
          margin: '0 0 6px',
          color: '#0f172a',
          letterSpacing: '-0.5px'
        }}>
          Sistema en Mantenimiento
        </h1>

        <p style={{
          fontSize: '15px',
          color: '#475569',
          lineHeight: 1.7,
          margin: '0 0 28px'
        }}>
          Estamos realizando tareas de mantenimiento programadas.
          El sistema estar&aacute; disponible nuevamente en unos momentos.
        </p>

        <div style={{
          display: 'flex',
          gap: '10px',
          alignItems: 'center',
          marginBottom: '28px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            fontSize: '13px',
            color: '#64748b'
          }}>
            Reintentando en
            <span style={{
              fontVariantNumeric: 'tabular-nums',
              fontWeight: 700,
              fontSize: '16px',
              color: '#d97706',
              minWidth: '28px',
              display: 'inline-block'
            }}>
              {timeLeft}s
            </span>
          </div>

          <button
            onClick={handleRetry}
            style={{
              padding: '8px 20px',
              background: '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Reintentar ahora
          </button>
        </div>

        <div style={{
          padding: '16px 20px',
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          width: '100%'
        }}>
          <p style={{
            fontSize: '12px',
            color: '#64748b',
            margin: '0 0 12px',
            lineHeight: 1.6,
            textAlign: 'center'
          }}>
            Soporte t&eacute;cnico:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '20px',
              flexWrap: 'wrap'
            }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', minWidth: '70px', textAlign: 'right' }}>Sistemas</div>
              <a href="tel:54140195" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', textDecoration: 'none', color: '#0f172a', fontSize: '13px', fontWeight: 500 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>5414 0195
              </a>
              <a href="mailto:sistemas@jardinesdellago.com" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', textDecoration: 'none', color: '#0f172a', fontSize: '13px', fontWeight: 500 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>sistemas@jardinesdellago.com
              </a>
              <a href="https://wa.me/50254140195" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', textDecoration: 'none', color: '#0f172a', fontSize: '13px', fontWeight: 500 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#22c55e"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>5414 0195
              </a>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '20px',
              flexWrap: 'wrap'
            }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', minWidth: '70px', textAlign: 'right' }}>Hotel</div>
              <a href="tel:55178100" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', textDecoration: 'none', color: '#0f172a', fontSize: '13px', fontWeight: 500 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>5517 8100
              </a>
              <a href="mailto:sistemashotel@jardinesdellago.com" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', textDecoration: 'none', color: '#0f172a', fontSize: '13px', fontWeight: 500 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>sistemashotel@jardinesdellago.com
              </a>
              <a href="https://wa.me/50255178100" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', textDecoration: 'none', color: '#0f172a', fontSize: '13px', fontWeight: 500 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#22c55e"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>5517 8100
              </a>
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            setShowModal(true);
            setErrorMsg('');
            setSuccessMsg('');
            setInputCode('');
          }}
          disabled={loading}
          style={{
            marginTop: '20px',
            background: 'none',
            border: 'none',
            color: '#64748b',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            textDecoration: 'underline',
            textUnderlineOffset: '3px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          {loading ? 'Procesando...' : 'Acceso de administrador'}
        </button>
      </div>

      {/* Modal interactivo de Acceso de Administrador */}
      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          zIndex: 999999
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            width: '100%',
            maxWidth: '430px',
            padding: '24px',
            textAlign: 'left',
            position: 'relative'
          }}>
            {/* Cabecera del Modal */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: '#eff6ff',
                color: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>
                  Acceso de Administrador
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
                  Ingresa la contraseña para quitar el modo mantenimiento.
                </p>
              </div>
            </div>

            {/* Mensajes de Alerta */}
            {errorMsg && (
              <div style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#991b1b',
                padding: '10px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 600,
                marginBottom: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span>⚠️</span>
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                color: '#166534',
                padding: '10px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 600,
                marginBottom: '14px'
              }}>
                {successMsg}
              </div>
            )}

            {/* Input de Contraseña */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Contraseña / Código de Administrador:
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleDisableMaintenance();
                    }
                  }}
                  autoFocus
                  placeholder="Ej: JDL-ADMIN-2026"
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '10px 40px 10px 12px',
                    border: '1.5px solid #cbd5e1',
                    borderRadius: '8px',
                    fontSize: '14px',
                    color: '#0f172a',
                    fontWeight: 600,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    padding: '4px'
                  }}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
              </div>
            </div>

            {/* Acciones */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                type="button"
                onClick={() => handleDisableMaintenance()}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '11px',
                  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: '0 2px 4px rgba(37, 99, 235, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                {loading ? 'Procesando...' : '🔓 Quitar Modo Mantenimiento'}
              </button>

              <button
                type="button"
                onClick={() => handleBypassOnly()}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: '#f8fafc',
                  color: '#334155',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                🔑 Solo Entrar como Administrador (Bypass)
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowModal(false);
                  setErrorMsg('');
                  setSuccessMsg('');
                }}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '8px',
                  background: 'transparent',
                  color: '#64748b',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
