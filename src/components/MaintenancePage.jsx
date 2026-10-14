import React, { useEffect, useState } from 'react';
import { CURRENT_VERSION } from '../services/versionService';
import './maintenance.css';

const ADMIN_CODE = 'JDL-ADMIN-2026';

export default function MaintenancePage({ onBypassSuccess }) {
  const [retrying, setRetrying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [inputCode, setInputCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  // Soportar activación/desactivación automática vía query param ?admin-code=JDL-ADMIN-2026
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('admin-code');
    if (code && code.trim().toUpperCase() === ADMIN_CODE) {
      handleDisableMaintenance(code.trim().toUpperCase());
    }
  }, []);

  // Polling silencioso en segundo plano para recargar automáticamente si otro admin quita el mantenimiento
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/maintenance-status');
        const data = await res.json();
        if (data && data.maintenanceMode === false) {
          window.location.reload();
        }
      } catch (_) {}
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      const res = await fetch('/api/maintenance-status');
      const data = await res.json();
      if (data && data.maintenanceMode === false) {
        window.location.reload();
        return;
      }
    } catch (_) {}
    setTimeout(() => {
      setRetrying(false);
    }, 700);
  };

  const handleCopyEmail = (email, id) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(email);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
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

  const displayVersion = CURRENT_VERSION && CURRENT_VERSION !== '0.0.0-dev' 
    ? (CURRENT_VERSION.startsWith('v') ? CURRENT_VERSION : `v${CURRENT_VERSION}`)
    : 'v2.1.20';

  return (
    <div className="maint-page-root">
      {/* Barra superior con marca institucional y badge global */}
      <header className="maint-top-bar">
        <div className="maint-brand">
          <div className="maint-logo-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>
              <path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>
              <path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>
            </svg>
          </div>
          <div className="maint-brand-text">
            <span className="maint-brand-name">Jardines del Lago</span>
            <span className="maint-brand-sub">HOTEL & RESORT LAKE VIEW</span>
          </div>
        </div>

        <div className="maint-badge-global">
          <span className="maint-dot-amber"></span>
          <span>Mantenimiento Preventivo Global</span>
        </div>
      </header>

      {/* Tarjeta Bento Ejecutiva */}
      <main className="maint-card">
        {/* Cinta superior ámbar */}
        <div className="maint-card-ribbon">
          <div className="maint-ribbon-title">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            <span>Optimización y despliegue de infraestructura de alta disponibilidad</span>
          </div>
          <span className="maint-ribbon-badge">Fase 2 de 2</span>
        </div>

        {/* Cuerpo de la tarjeta */}
        <div className="maint-card-body">
          {/* Ícono de herramienta con versión */}
          <div className="maint-icon-wrap">
            <div className="maint-icon-box">
              <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
              </svg>
            </div>
            <span className="maint-version-pill">{displayVersion}</span>
          </div>

          <h1 className="maint-title">Sistema en Mantenimiento</h1>
          <p className="maint-subtitle">
            Estamos realizando tareas de mantenimiento programadas para mejorar tu experiencia.
            El sistema estar&aacute; disponible nuevamente en unos momentos.
          </p>

          {/* Botón único de Reintentar ahora */}
          <div className="maint-action-wrap">
            <button
              onClick={handleRetry}
              disabled={retrying}
              className="maint-btn-retry"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  animation: retrying ? 'spin 1s linear infinite' : 'none',
                  transition: 'transform 0.3s'
                }}
              >
                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                <path d="M3 3v5h5"/>
                <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
                <path d="M16 16h5v5"/>
              </svg>
              <span>{retrying ? 'Verificando servicio...' : 'Reintentar ahora'}</span>
            </button>
          </div>

          {/* Divisor canales de soporte */}
          <div className="maint-divider-row">
            <div className="maint-divider-line"></div>
            <span className="maint-divider-text">Canales de Soporte Directo</span>
            <div className="maint-divider-line"></div>
          </div>

          {/* Cuadrícula de tarjetas de soporte */}
          <div className="maint-support-grid">
            {/* Tarjeta 1: Área de Sistemas */}
            <div className="maint-support-card">
              <div className="maint-support-header">
                <div className="maint-support-title-wrap">
                  <div className="maint-support-icon-badge">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/>
                      <rect x="2" y="14" width="20" height="8" rx="2" ry="2"/>
                      <line x1="6" y1="6" x2="6.01" y2="6"/>
                      <line x1="6" y1="18" x2="6.01" y2="18"/>
                    </svg>
                  </div>
                  <div className="maint-support-titles">
                    <span className="maint-support-name">&Aacute;rea de Sistemas</span>
                    <span className="maint-support-dept">Soporte t&eacute;cnico TI</span>
                  </div>
                </div>
                <span className="maint-status-pill">Disponible</span>
              </div>

              {/* Teléfono y WhatsApp */}
              <div className="maint-contact-row">
                <div className="maint-contact-info">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                  </svg>
                  <span>5414 0195</span>
                </div>
                <div className="maint-contact-actions">
                  <a href="tel:54140195" className="maint-pill-btn">Llamar</a>
                  <a href="https://wa.me/50254140195" target="_blank" rel="noopener noreferrer" className="maint-pill-btn maint-pill-btn-wa">WhatsApp</a>
                </div>
              </div>

              {/* Correo y Copiar */}
              <div className="maint-contact-row">
                <div className="maint-contact-info">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                  <span>sistemas@jardinesdellago.com</span>
                </div>
                <div className="maint-contact-actions">
                  <button
                    type="button"
                    onClick={() => handleCopyEmail('sistemas@jardinesdellago.com', 'sistemas')}
                    className="maint-pill-btn"
                  >
                    {copiedId === 'sistemas' ? '¡Copiado!' : 'Copiar'}
                  </button>
                </div>
              </div>
            </div>

            {/* Tarjeta 2: Recepción & Hotel */}
            <div className="maint-support-card">
              <div className="maint-support-header">
                <div className="maint-support-title-wrap">
                  <div className="maint-support-icon-badge">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 21h18"/>
                      <path d="M19 21v-4"/>
                      <path d="M19 11V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v16"/>
                      <path d="M9 7h2"/>
                      <path d="M13 7h2"/>
                      <path d="M9 11h2"/>
                      <path d="M13 11h2"/>
                      <path d="M9 15h2"/>
                      <path d="M13 15h2"/>
                    </svg>
                  </div>
                  <div className="maint-support-titles">
                    <span className="maint-support-name">Recepci&oacute;n & Hotel</span>
                    <span className="maint-support-dept">Operaciones y Reservas</span>
                  </div>
                </div>
                <span className="maint-status-pill">24/7 Activo</span>
              </div>

              {/* Teléfono y WhatsApp */}
              <div className="maint-contact-row">
                <div className="maint-contact-info">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                  </svg>
                  <span>5517 8100</span>
                </div>
                <div className="maint-contact-actions">
                  <a href="tel:55178100" className="maint-pill-btn">Llamar</a>
                  <a href="https://wa.me/50255178100" target="_blank" rel="noopener noreferrer" className="maint-pill-btn maint-pill-btn-wa">WhatsApp</a>
                </div>
              </div>

              {/* Correo y Copiar */}
              <div className="maint-contact-row">
                <div className="maint-contact-info">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                  <span>sistemashotel@jardinesdellago.com</span>
                </div>
                <div className="maint-contact-actions">
                  <button
                    type="button"
                    onClick={() => handleCopyEmail('sistemashotel@jardinesdellago.com', 'hotel')}
                    className="maint-pill-btn"
                  >
                    {copiedId === 'hotel' ? '¡Copiado!' : 'Copiar'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Pie de página con botón de Administrador y Derechos Reservados */}
      <footer className="maint-footer">
        <button
          onClick={() => {
            setShowModal(true);
            setErrorMsg('');
            setSuccessMsg('');
            setInputCode('');
          }}
          disabled={loading}
          className="maint-btn-admin"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          <span>{loading ? 'Procesando...' : 'Acceso de administrador'}</span>
        </button>

        <p className="maint-copyright">
          &copy; 2026 Jardines del Lago. Todos los derechos reservados.
        </p>
      </footer>

      {/* Modal interactivo de Acceso de Administrador */}
      {showModal && (
        <div className="maint-modal-backdrop">
          <div className="maint-modal-dialog">
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
                  Ingresa tu contrase&ntilde;a para autorizar acciones administrativas.
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

            {/* Input de Contraseña (sin revelar la clave en placeholder) */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Contrase&ntilde;a de Administrador:
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
                  placeholder="••••••••••••"
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
