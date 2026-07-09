import React, { useState } from 'react';
import { toast } from '../../utils/toast';

export default function SettingsUpdateCheck() {
  const [checking, setChecking] = useState(false);

  const handleCheckUpdate = async () => {
    if (!('serviceWorker' in navigator)) {
      toast('El navegador no soporta actualizaciones de PWA.');
      return;
    }

    setChecking(true);
    try {
      // 1. Obtener el Service Worker activo
      const registration = await navigator.serviceWorker.ready;
      
      // 2. Forzar al navegador a revisar el archivo sw.js en el servidor
      await registration.update();
      
      // 3. Dar un pequeño delay para simular búsqueda y permitir que se cargue si hay update
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // 4. Revisar si hay un worker esperando o instalándose
      if (registration.waiting || registration.installing) {
        toast('¡Actualización encontrada! Cargando nueva versión...');
      } else {
        toast('¡Estás al día! Usando la versión más reciente del sistema.');
      }
    } catch (err) {
      console.error('Error buscando actualizaciones:', err);
      toast('Error al buscar actualizaciones.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="settings-section-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>📱 PWA y Versión del Sistema</div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
            Verifica si estás utilizando la versión más reciente del sistema o fuerza una actualización de la aplicación
          </div>
        </div>
        <button
          className="qp-btn-primary"
          type="button"
          disabled={checking}
          onClick={handleCheckUpdate}
          style={{
            padding: '6px 12px',
            fontSize: '12px',
            fontWeight: 700,
            borderRadius: '6px',
            background: checking ? '#cbd5e1' : '#005954',
            color: '#fff',
            border: 'none',
            cursor: checking ? 'not-allowed' : 'pointer'
          }}
        >
          {checking ? 'Buscando...' : 'Buscar actualizaciones'}
        </button>
      </div>
      <div style={{
        padding: '12px 16px', background: '#f8fafc',
        borderRadius: '10px', border: '1px solid #e2e8f0',
        fontSize: '11px', color: '#64748b', lineHeight: 1.6
      }}>
        Este CRM funciona como una Aplicación Web Progresiva (PWA). Al hacer clic en <b>Buscar actualizaciones</b>, el navegador verificará en el servidor si se han publicado cambios nuevos. Si hay una nueva versión disponible, aparecerá un banner de aviso en la parte superior para cargarla de forma inmediata.
      </div>
    </div>
  );
}
