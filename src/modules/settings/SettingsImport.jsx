import { useRef, useState } from 'react';
import { toast } from '../../utils/toast';
import {
  IMPORT_EVENT_COLUMNS,
  IMPORT_COMPANY_COLUMNS,
  IMPORT_MANAGER_COLUMNS,
  downloadCsvTemplate,
  importEventRows,
  importCompanyRows,
  importManagerRows,
  loadCrmState,
  parseCsvRows,
  saveCrmState,
} from './settingsDataUtils';

export default function SettingsImport() {
  const eventsInputRef = useRef(null);
  const companiesInputRef = useRef(null);
  const managersInputRef = useRef(null);
  const [working, setWorking] = useState('');

  const downloadEventsTemplate = () => {
    downloadCsvTemplate('plantilla_importar_eventos_crm', IMPORT_EVENT_COLUMNS, {
      evento_id: 'evt_001',
      grupo_id: '',
      nombre_evento: 'Capacitacion anual',
      estado: 'Confirmado',
      fecha_inicio_evento: '2026-05-20',
      fecha_fin_evento: '2026-05-20',
      fecha_bloque: '2026-05-20',
      hora_inicio: '08:00',
      hora_final: '12:00',
      salon_principal: 'Atitlan',
      salones: 'Atitlan, Toliman',
      vendedor_id: '',
      vendedor: 'Maria Perez',
      pax_total: '120',
      pax_bloque: '60',
      empresa_id: 'cmp_001',
      empresa: 'Empresa Ejemplo, S.A.',
      encargado_id: 'mgr_001',
      encargado: 'Ana Lopez',
      tipo_evento: 'Corporativo',
      notas: 'Montaje escuela',
      total_cotizacion: '14500.00',
    });
  };

  const downloadCompanyTemplate = () => {
    downloadCsvTemplate('plantilla_importar_empresas_crm', IMPORT_COMPANY_COLUMNS, {
      empresa_id: 'cmp_001',
      nombre_comercial: 'Empresa Ejemplo, S.A.',
      razon_social_facturar: 'Empresa Ejemplo Sociedad Anonima',
      nit: '1234567-8',
      correo_empresa: 'compras@empresa.com',
      telefono_empresa: '5555-1234',
      direccion_empresa: 'Ciudad de Guatemala',
      tipo_evento_preferido: 'Corporativo',
      notas_empresa: 'Cliente frecuente',
    });
  };

  const downloadManagersTemplate = () => {
    downloadCsvTemplate('plantilla_importar_encargados_crm', IMPORT_MANAGER_COLUMNS, {
      empresa_id: 'cmp_001',
      encargado_id: 'mgr_001',
      nombre_encargado: 'Ana Lopez',
      telefono_encargado: '5555-5678',
      correo_encargado: 'ana@empresa.com',
      direccion_encargado: 'Ciudad de Guatemala',
    });
  };

  const handleFile = async (type, file) => {
    if (!file || working) return;
    if (!/\.csv$/i.test(file.name)) {
      toast('Guarda la plantilla como CSV UTF-8 antes de importarla.');
      return;
    }
    setWorking(type);
    try {
      const text = await file.text();
      const rows = parseCsvRows(text);
      if (!rows.length) {
        toast('El archivo no tiene filas para importar.');
        return;
      }
      const state = await loadCrmState();
      if (type === 'eventos') {
        const result = importEventRows(state, rows);
        await saveCrmState(state);
        toast(`Importacion lista: ${result.imported} evento(s)${result.skipped ? `, ${result.skipped} fila(s) omitida(s)` : ''}.`);
      } else if (type === 'empresas') {
        const result = importCompanyRows(state, rows);
        await saveCrmState(state);
        toast(`Importacion lista: ${result.companiesTouched} empresa(s) procesadas.`);
      } else {
        const result = importManagerRows(state, rows);
        await saveCrmState(state);
        toast(`Importacion lista: ${result.managersTouched} encargado(s)${result.skipped ? `, ${result.skipped} fila(s) omitidas (sin empresa_id valido)` : ''}.`);
      }
    } catch (err) {
      console.error('Error importando:', err);
      const statusPart = err.status ? ` (HTTP ${err.status})` : '';
      let detailPart = '';
      if (err.details) {
        try {
          detailPart = ': ' + (typeof err.details === 'string' ? err.details : JSON.stringify(err.details)).slice(0, 200);
        } catch {
          detailPart = ': ' + String(err.details).slice(0, 200);
        }
      }
      const codePart = err.code && err.code !== 'API_ERROR' ? ` [${err.code}]` : '';
      toast(`${err.message || 'Error del servidor'}${statusPart}${codePart}${detailPart}`);
    } finally {
      setWorking('');
      if (type === 'eventos' && eventsInputRef.current) eventsInputRef.current.value = '';
      if (type === 'empresas' && companiesInputRef.current) companiesInputRef.current.value = '';
      if (type === 'encargados' && managersInputRef.current) managersInputRef.current.value = '';
    }
  };

  return (
    <div className="settings-data-section">
      <style>{`
        .settings-import-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin: 12px 0 6px 0;
        }
        .settings-import-card {
          border: 1px solid var(--ui-border);
          border-radius: 14px;
          padding: 16px;
          background: var(--ui-surface-soft) !important;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .settings-import-card-title {
          font-size: 14px;
          font-weight: 800;
          color: var(--ui-text) !important;
          margin: 0;
        }
        .settings-import-card-desc {
          font-size: 12.5px;
          color: var(--ui-text-soft) !important;
          line-height: 1.45;
          margin: 0;
          flex-grow: 1;
        }
        .settings-import-card-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .settings-import-btn-outline {
          min-height: 36px;
          padding: 0 12px;
          background: var(--ui-surface) !important;
          color: var(--ui-text-soft) !important;
          border: 1px solid var(--ui-border-strong) !important;
          border-radius: 10px;
          font-size: 12.5px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: none !important;
        }
        .settings-import-btn-outline:hover {
          background: var(--ui-surface-muted) !important;
          color: var(--ui-text) !important;
        }
        .settings-import-btn-primary {
          min-height: 36px;
          padding: 0 12px;
          background: var(--ui-primary) !important;
          color: #ffffff !important;
          border: 1px solid transparent !important;
          border-radius: 10px;
          font-size: 12.5px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: none !important;
        }
        .settings-import-btn-primary:hover {
          background: var(--ui-primary-strong) !important;
        }
        @media (max-width: 860px) {
          .settings-import-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        @media (max-width: 640px) {
          .settings-import-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <p className="settings-data-desc">
        Carga masivamente reservas, salones o contactos corporativos descargando la plantilla del sistema, completándola en Excel y subiéndola en formato CSV UTF-8.
      </p>

      <div className="settings-import-grid">
        <div className="settings-import-card">
          <h4 className="settings-import-card-title">1. Importar Eventos</h4>
          <p className="settings-import-card-desc">
            Carga bloques de fechas, horarios y salones. El CRM vinculará las empresas y encargados correspondientes o los creará en el momento.
          </p>
          <div className="settings-import-card-actions">
            <button 
              className="settings-import-btn-outline" 
              type="button" 
              onClick={downloadEventsTemplate}
            >
              Descargar plantilla
            </button>
            <button 
              className="settings-import-btn-primary" 
              type="button" 
              disabled={!!working}
              onClick={() => eventsInputRef.current?.click()}
            >
              {working === 'eventos' ? 'Importando...' : 'Subir CSV'}
            </button>
          </div>
        </div>

        <div className="settings-import-card">
          <h4 className="settings-import-card-title">2. Importar Empresas</h4>
          <p className="settings-import-card-desc">
            Carga o actualiza tu catálogo de empresas / instituciones. Cada fila debe tener un <strong>empresa_id</strong> único. Luego podrás importar los encargados vinculados a ese ID.
          </p>
          <div className="settings-import-card-actions">
            <button 
              className="settings-import-btn-outline" 
              type="button" 
              onClick={downloadCompanyTemplate}
            >
              Descargar plantilla
            </button>
            <button 
              className="settings-import-btn-primary" 
              type="button" 
              disabled={!!working}
              onClick={() => companiesInputRef.current?.click()}
            >
              {working === 'empresas' ? 'Importando...' : 'Subir CSV'}
            </button>
          </div>
        </div>

        <div className="settings-import-card">
          <h4 className="settings-import-card-title">3. Importar Encargados</h4>
          <p className="settings-import-card-desc">
            Carga los contactos encargados vinculándolos a una empresa existente. El campo <strong>empresa_id</strong> debe coincidir con el ID de una empresa ya importada en el sistema.
          </p>
          <div className="settings-import-card-actions">
            <button 
              className="settings-import-btn-outline" 
              type="button" 
              onClick={downloadManagersTemplate}
            >
              Descargar plantilla
            </button>
            <button 
              className="settings-import-btn-primary" 
              type="button" 
              disabled={!!working}
              onClick={() => managersInputRef.current?.click()}
            >
              {working === 'encargados' ? 'Importando...' : 'Subir CSV'}
            </button>
          </div>
        </div>
      </div>

      <details className="settings-columns-details">
        <summary style={{ fontSize: '13px', fontWeight: '700', cursor: 'pointer', color: 'var(--ui-primary)', outline: 'none' }}>
          Ver columnas y formato requerido para la importación
        </summary>
        <div style={{ marginTop: '12px', borderTop: '1px solid var(--ui-border)', paddingTop: '8px' }}>
          <div className="settings-columns-details-title" style={{ marginTop: 0 }}>Columnas requeridas para Eventos</div>
          <div className="settings-column-badges" style={{ marginBottom: '10px' }}>
            {IMPORT_EVENT_COLUMNS.map(col => (
              <span key={col} className="settings-column-badge">{col}</span>
            ))}
          </div>

          <div className="settings-columns-details-title">Columnas requeridas para Empresas</div>
          <div className="settings-column-badges" style={{ marginBottom: '10px' }}>
            {IMPORT_COMPANY_COLUMNS.map(col => (
              <span key={col} className="settings-column-badge">{col}</span>
            ))}
          </div>

          <div className="settings-columns-details-title">Columnas requeridas para Encargados</div>
          <div className="settings-column-badges">
            {IMPORT_MANAGER_COLUMNS.map(col => (
              <span key={col} className="settings-column-badge">{col}</span>
            ))}
          </div>
        </div>
      </details>

      <input ref={eventsInputRef} type="file" id="settingsImportEventsFile" accept=".csv" hidden onChange={(event) => handleFile('eventos', event.target.files?.[0])} />
      <input ref={companiesInputRef} type="file" id="settingsImportCompaniesFile" accept=".csv" hidden onChange={(event) => handleFile('empresas', event.target.files?.[0])} />
      <input ref={managersInputRef} type="file" id="settingsImportManagersFile" accept=".csv" hidden onChange={(event) => handleFile('encargados', event.target.files?.[0])} />
    </div>
  );
}
