import { useState } from 'react';
import SettingsUsers from './SettingsUsers';
import SettingsEquipos from './SettingsEquipos';

export default function SettingsUsuariosManager({ inline, onBack }) {
  const [activeTab, setActiveTab] = useState('usuarios'); // 'usuarios' | 'equipos'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, gap: '10px', width: '100%' }}>
      {/* ── STICKY TOP HEADER WITH LIGHT BLUE SWITCHER ── */}
      <div
        style={{
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          background: '#ffffff',
          paddingBottom: '8px',
          borderBottom: '1.5px solid #cbd5e1'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {onBack && (
              <button
                type="button"
                className="settings-secondary-btn"
                onClick={onBack}
                style={{ padding: '4px 10px', fontSize: '11.5px', background: '#ffffff', borderColor: '#cbd5e1', color: '#334155' }}
              >
                ← Volver a Ajustes
              </button>
            )}
            <h2 style={{ fontSize: '19px', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              👥 Gestión de Accesos, Usuarios y Equipos
            </h2>
          </div>

          {/* Switcher Limpio: Usuarios - Equipos */}
          <div
            style={{
              display: 'inline-flex',
              background: '#e0f2fe',
              borderRadius: '10px',
              padding: '4px',
              gap: '4px',
              border: '1px solid #bae6fd'
            }}
          >
            <button
              type="button"
              onClick={() => setActiveTab('usuarios')}
              style={{
                padding: '7px 22px',
                fontSize: '13px',
                fontWeight: 800,
                borderRadius: '7px',
                border: 'none',
                cursor: 'pointer',
                background: activeTab === 'usuarios' ? '#0284c7' : 'transparent',
                color: activeTab === 'usuarios' ? '#ffffff' : '#0369a1',
                boxShadow: activeTab === 'usuarios' ? '0 2px 6px rgba(2, 132, 199, 0.25)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              Usuarios
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('equipos')}
              style={{
                padding: '7px 22px',
                fontSize: '13px',
                fontWeight: 800,
                borderRadius: '7px',
                border: 'none',
                cursor: 'pointer',
                background: activeTab === 'equipos' ? '#0284c7' : 'transparent',
                color: activeTab === 'equipos' ? '#ffffff' : '#0369a1',
                boxShadow: activeTab === 'equipos' ? '0 2px 6px rgba(2, 132, 199, 0.25)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              Equipos
            </button>
          </div>
        </div>

        <p style={{ fontSize: '11.5px', color: '#64748b', margin: '0' }}>
          {activeTab === 'usuarios'
            ? 'Administra las cuentas de usuario, asigna roles (Admin, Vendedor, Recepcionista) y controla accesos.'
            : 'Organiza el equipo en áreas de trabajo (ej: Bodega, Contabilidad, Ventas) para asignación de tareas.'}
        </p>
      </div>

      {/* ── TAB CONTENT (EXCLUSIVO 1 TABLA A LA VEZ CON SCROLL INTERNO) ── */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {activeTab === 'usuarios' ? (
          <SettingsUsers />
        ) : (
          <SettingsEquipos />
        )}
      </div>
    </div>
  );
}
