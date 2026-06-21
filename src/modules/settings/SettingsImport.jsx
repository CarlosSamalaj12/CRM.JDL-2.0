import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { toast } from '../../utils/toast';
import api from '../../services/api';
import {
  IMPORT_EVENT_COLUMNS,
  IMPORT_COMPANY_COLUMNS,
  IMPORT_MANAGER_COLUMNS,
  COMPANY_COLUMN_DESCRIPTIONS,
  MANAGER_COLUMN_DESCRIPTIONS,
  downloadCsvTemplate,
  importEventRows,
  loadCrmState,
  parseCsvRows,
  saveCrmState,
  normalizeImportHeader,
  validateCompanyRows,
  validateManagerRows,
  validateEventRows,
  buildCompanyPayload,
  buildManagerPayload,
} from './settingsDataUtils';

export default function SettingsImport() {
  const eventsInputRef = useRef(null);
  const companiesInputRef = useRef(null);
  const managersInputRef = useRef(null);
  const overlayRef = useRef(null);
  const overlayBodyRef = useRef(null);
  const cancelRef = useRef(false);
  const pendingImportRef = useRef(null);
  const confirmingRef = useRef(false);
  const [working, setWorking] = useState('');
  const [dragOver, setDragOver] = useState('');
  const dragCounter = useRef({ empresas: 0, encargados: 0, eventos: 0 });

  const showOverlay = (mode, errors) => {
    if (!overlayRef.current || !overlayBodyRef.current) return;
    overlayRef.current.style.display = 'flex';
    const confirmPhase = overlayBodyRef.current.querySelector('.import-confirm-phase');
    const progressPhase = overlayBodyRef.current.querySelector('.import-progress-phase');
    const errorsPhase = overlayBodyRef.current.querySelector('.import-errors-phase');
    [confirmPhase, progressPhase, errorsPhase].forEach(el => {
      if (el) el.style.display = 'none';
    });
    if (mode === 'confirm' && confirmPhase) confirmPhase.style.display = '';
    else if (mode === 'errors' && errorsPhase) {
      errorsPhase.style.display = '';
      // Populate error list
      const listEl = errorsPhase.querySelector('.import-errors-list');
      if (listEl && errors) {
        listEl.innerHTML = errors.map(e =>
          `<div style="padding:8px 10px;border-bottom:1px solid #fee2e2;font-size:12.5px;text-align:left;display:flex;gap:8px">
            <span style="color:#94a3b8;white-space:nowrap;min-width:40px">Fila ${e.row}</span>
            <span style="color:#dc2626;font-weight:600;white-space:nowrap">${escHtml(e.field)}</span>
            <span style="color:#475569">${escHtml(e.message)}</span>
          </div>`
        ).join('');
      }
    } else if (progressPhase) progressPhase.style.display = '';
  };

  const hideOverlay = () => {
    if (overlayRef.current) {
      overlayRef.current.style.display = 'none';
    }
  };

  const startImport = () => {
    const pending = pendingImportRef.current;
    if (!pending) return;
    showOverlay('importing');
    setTimeout(() => executeImport(pending.type, pending.rows, pending.state), 100);
  };

  const cancelImport = () => {
    cancelRef.current = true;
    hideOverlay();
    pendingImportRef.current = null;
    setWorking('');
    toast('Importación cancelada.');
  };

  // Escape HTML to prevent injection in error messages
  const escHtml = (str) => {
    const div = document.createElement('div');
    div.textContent = String(str ?? '');
    return div.innerHTML;
  };

  // Shared progress updater for validation & import phases
  const updateProgress = (current, total) => {
    const textEl = overlayBodyRef.current?.querySelector('.import-progress-text');
    const barEl = overlayBodyRef.current?.querySelector('.import-progress-bar');
    if (textEl) textEl.textContent = `${current.toLocaleString()} / ${total.toLocaleString()}`;
    if (barEl && total > 0) barEl.style.width = `${Math.round((current / total) * 100)}%`;
  };

  const handleDragEnter = (type) => (e) => {
    if (working) return;
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current[type] += 1;
    setDragOver(type);
  };

  const handleDragLeave = (type) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current[type] -= 1;
    if (dragCounter.current[type] <= 0) {
      dragCounter.current[type] = 0;
      setDragOver('');
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (type) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current[type] = 0;
    setDragOver('');
    const files = e.dataTransfer?.files;
    if (files?.length > 0) {
      handleFile(type, files[0]);
    }
  };

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
      'empresa_id': 'cmp_001',
      'nombre_comercial': 'Empresa Ejemplo, S.A.',
      'razon_social_facturar': 'Empresa Ejemplo Sociedad Anonima',
      'nit': '1234567-8',
      'correo_empresa': 'compras@empresa.com',
      'telefono_empresa': '5555-1234',
      'direccion_empresa': 'Ciudad de Guatemala',
      'tipo_evento_preferido': 'Corporativo',
      'notas_empresa': 'Cliente frecuente',
    });
  };

  const downloadManagersTemplate = () => {
    downloadCsvTemplate('plantilla_importar_encargados_crm', IMPORT_MANAGER_COLUMNS, {
      'empresa_id': 'cmp_001',
      'encargado_id': 'mgr_001',
      'nombre_encargado': 'Ana Lopez',
      'telefono_encargado': '5555-5678',
      'correo_encargado': 'ana@empresa.com',
      'direccion_encargado': 'Ciudad de Guatemala',
    });
  };

  const handleFile = async (type, file) => {
    if (!file || working) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['csv', 'xlsx', 'xls'].includes(ext)) {
      toast('Solo se aceptan archivos CSV (.csv) o Excel (.xlsx / .xls).');
      return;    }
      setWorking(type);
    const clearFileInput = (t) => {
      if (t === 'eventos' && eventsInputRef.current) eventsInputRef.current.value = '';
      if (t === 'empresas' && companiesInputRef.current) companiesInputRef.current.value = '';
      if (t === 'encargados' && managersInputRef.current) managersInputRef.current.value = '';
    };
    try {
      let rows;
      if (ext === 'csv') {
        const text = await file.text();
        rows = parseCsvRows(text);
      } else {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
          toast('El archivo Excel no contiene hojas de cálculo.');
          return;
        }
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '', header: 1 });
        if (jsonData.length < 2) {
          toast('El archivo Excel no tiene suficientes filas. Debe tener encabezados + al menos 1 fila de datos.');
          return;
        }
        const headers = jsonData[0].map(h => normalizeImportHeader(String(h ?? '')));
        rows = jsonData.slice(1)
          .map(values => {
            const obj = {};
            headers.forEach((header, idx) => {
              if (header && values[idx] !== undefined) obj[header] = String(values[idx] ?? '').trim();
            });
            return obj;
          })
          .filter(obj => Object.values(obj).some(v => String(v || '').trim()));
      }
      if (!rows.length) {
        toast('El archivo no tiene filas para importar. Verifica que tenga datos después de la fila de encabezados.');
        return;
      }

      const state = await loadCrmState();

      // ===== FASE 1: VALIDACIÓN =====
      showOverlay('progress');
      const phaseEl = overlayBodyRef.current?.querySelector('.import-progress-phase');
      if (phaseEl) {
        const heading = phaseEl.querySelector('div:nth-child(2)');
        if (heading) heading.textContent = 'Analizando archivo...';
      }

      let validation;
      try {
        const onValProgress = (current, total) => {
          if (cancelRef.current) throw new Error('CANCELLED');
          updateProgress(current, total);
        };
        if (type === 'empresas') {
          validation = await validateCompanyRows(state, rows, onValProgress);
        } else if (type === 'encargados') {
          validation = await validateManagerRows(state, rows, onValProgress);
        } else {
          validation = await validateEventRows(state, rows, onValProgress);
        }
      } catch (err) {
        if (err.message === 'CANCELLED') {
          toast('Análisis cancelado.');
          return;
        }
        throw err;
      }

      hideOverlay();

      if (validation.valid) {
        confirmingRef.current = true;
        pendingImportRef.current = { type, rows, state };
        showOverlay('confirm');
        return; // wait for user to click "Importar ahora" in overlay
      } else {
        confirmingRef.current = true;
        showOverlay('errors', validation.errors);
        return;
      }
    } catch (err) {
      console.error('Error importando:', err);
      toast(`${err.message || 'Error al importar'}. Verifica que el archivo esté en formato CSV o Excel correcto.`);
      setWorking('');
      hideOverlay();
      clearFileInput(type);
    } finally {
      if (!confirmingRef.current) {
        setWorking('');
        hideOverlay();
        clearFileInput(type);
      }
      confirmingRef.current = false;
    }
  };

  // ===== FASE 2: EJECUTAR IMPORTACIÓN (llamado desde overlay) =====
  const executeImport = async (type, rows, state) => {
    try {
      if (type === 'empresas') {
        const payload = buildCompanyPayload(rows);
        const res = await api.post('/api/import/companies', { companies: payload });
        toast(`Importación lista: ${res.count || payload.length} empresa(s) importada(s).`);
      } else if (type === 'encargados') {
        const payload = buildManagerPayload(rows);
        const res = await api.post('/api/import/managers', { managers: payload });
        toast(`Importación lista: ${res.count || payload.length} encargado(s) importado(s).`);
      } else {
        const result = await importEventRows(state, rows, (c, t) => {
          if (cancelRef.current) throw new Error('CANCELLED');
          updateProgress(c, t);
        });
        await saveCrmState(state);
        toast(`Importación lista: ${result.imported} evento(s)${result.skipped ? `, ${result.skipped} fila(s) omitida(s)` : ''}.`);
      }
    } catch (err) {
      if (err.message === 'CANCELLED') {
        toast('Importación cancelada.');
      } else {
        console.error('Error importando:', err);
        toast(`${err.message || 'Error al importar'}. Verifica el archivo.`);
      }
    } finally {
      setWorking('');
      hideOverlay();
      pendingImportRef.current = null;
      clearFileInput(type);
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
        .settings-import-card {
          transition: none;
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
          transition: background 0.15s ease, color 0.15s ease;
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
          transition: background 0.15s ease;
          box-shadow: none !important;
        }
        .settings-import-btn-primary:hover {
          background: var(--ui-primary-strong) !important;
        }
        .settings-import-card-dragover {
          border-color: #6366f1 !important;
          background: #eef2ff !important;
          box-shadow: 0 0 0 3px rgba(99,102,241,0.2), inset 0 0 0 1px rgba(99,102,241,0.1) !important;
          transition: background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .settings-import-drop-hint {
          text-align: center;
          padding: 8px 12px;
          background: #6366f1;
          color: #fff;
          font-size: 13px;
          font-weight: 700;
          border-radius: 10px;
        }
        .settings-required-badge {
          display: inline-block;
          background: #fee2e2;
          color: #dc2626;
          font-size: 10px;
          font-weight: 700;
          padding: 1px 6px;
          border-radius: 4px;
          margin-left: 4px;
        }
        .settings-column-badge.required {
          border-color: #dc2626 !important;
          background: #fef2f2 !important;
          color: #dc2626 !important;
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
        Carga masivamente reservas, empresas o encargados. Descarga la plantilla, llénala en Excel y súbela. <strong>Importa primero empresas y luego encargados.</strong>
      </p>

      <div ref={overlayRef} data-mode="" style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(15,23,42,0.5)', zIndex: 99999,
        display: 'none', alignItems: 'center', justifyContent: 'center',
      }}>
        <div ref={overlayBodyRef} style={{
          background: '#fff', borderRadius: '16px', padding: '32px',
          width: 'min(90vw, 420px)', textAlign: 'center',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          position: 'relative',
        }}>
          {/* ===== MODO CONFIRMACIÓN ===== */}
          <div className="import-confirm-phase">
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
            <div style={{ fontWeight: 700, fontSize: '17px', color: '#16a34a', marginBottom: '8px' }}>
              Datos validados correctamente
            </div>
            <div className="import-confirm-msg" style={{ fontSize: '14px', color: '#475569', marginBottom: '20px', lineHeight: 1.5 }}>
              Los datos se ven correctos. ¿Deseas importarlos?
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={cancelImport}
                style={{
                  padding: '10px 24px',
                  background: '#f1f5f9',
                  color: '#475569',
                  border: '1px solid #cbd5e1',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={startImport}
                className="settings-import-btn-primary"
                style={{
                  padding: '10px 24px',
                  background: '#2563eb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(37,99,235,0.3)',
                }}
              >
                Importar ahora
              </button>
            </div>
          </div>

          {/* ===== MODO ERRORES ===== */}
          <div className="import-errors-phase" style={{ display: 'none' }}>
            <div style={{ fontSize: '40px', marginBottom: '8px' }}>❌</div>
            <div style={{ fontWeight: 700, fontSize: '16px', color: '#dc2626', marginBottom: '4px' }}>
              Errores de validación
            </div>
            <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '14px' }}>
              Corrige estos errores en tu archivo y vuelve a subirlo.
            </div>
            <div className="import-errors-list" style={{
              maxHeight: '260px', overflowY: 'auto', textAlign: 'left',
              border: '1px solid #fecaca', borderRadius: '10px',
              background: '#fef2f2', marginBottom: '14px',
            }}></div>
            <button
              type="button"
              onClick={() => { hideOverlay(); setWorking(''); }}
              style={{
                padding: '10px 28px',
                background: '#64748b',
                color: '#fff',
                border: 'none',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Entendido
            </button>
          </div>

          {/* ===== MODO PROGRESO ===== */}
          <div className="import-progress-phase" style={{ display: 'none' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>⏳</div>
            <div style={{ fontWeight: 700, fontSize: '16px', color: '#0f172a', marginBottom: '8px' }}>
              Importando {working === 'empresas' ? 'empresas' : working === 'encargados' ? 'encargados' : 'eventos'}...
            </div>
            <div className="import-progress-text" style={{ fontSize: '14px', color: '#64748b', marginBottom: '20px' }}>
              0 / 0
            </div>
            <div style={{ width: '100%', height: '12px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
              <div className="import-progress-bar" style={{
                width: '0%',
                height: '100%', borderRadius: '999px',
                background: 'linear-gradient(90deg, #3b82f6, #6366f1)',
                transition: 'width 0.1s linear',
              }} />
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '12px' }}>
              No cierres esta ventana. Esto puede tardar unos segundos.
            </div>
            <button
              type="button"
              onClick={cancelImport}
              style={{
                marginTop: '16px',
                padding: '8px 24px',
                background: '#ef4444',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>

      <div className="settings-import-grid">
        <div
          className={`settings-import-card ${dragOver === 'empresas' ? 'settings-import-card-dragover' : ''}`}
          onDragEnter={handleDragEnter('empresas')}
          onDragLeave={handleDragLeave('empresas')}
          onDragOver={handleDragOver}
          onDrop={handleDrop('empresas')}
        >
          <h4 className="settings-import-card-title">1. Importar Empresas</h4>
          <p className="settings-import-card-desc">
            <strong>Paso 1:</strong> Carga tu catálogo de empresas / instituciones. Cada fila debe tener un <strong style={{color:'#dc2626'}}>empresa_id</strong> único. Luego podrás importar los encargados vinculados a ese ID.
          </p>
          {dragOver === 'empresas' && (
            <div className="settings-import-drop-hint">📂 Suelta el archivo aquí</div>
          )}
          <div className="settings-import-card-actions">
            <button className="settings-import-btn-outline" type="button" onClick={downloadCompanyTemplate}>
              📥 Descargar plantilla
            </button>
            <button className="settings-import-btn-primary" type="button" disabled={!!working} onClick={() => companiesInputRef.current?.click()}>
              {working === 'empresas' ? 'Importando...' : '📂 Subir archivo'}
            </button>
          </div>
        </div>

        <div
          className={`settings-import-card ${dragOver === 'encargados' ? 'settings-import-card-dragover' : ''}`}
          onDragEnter={handleDragEnter('encargados')}
          onDragLeave={handleDragLeave('encargados')}
          onDragOver={handleDragOver}
          onDrop={handleDrop('encargados')}
        >
          <h4 className="settings-import-card-title">2. Importar Encargados</h4>
          <p className="settings-import-card-desc">
            <strong>Paso 2:</strong> Carga los contactos encargados vinculándolos a una empresa existente. El campo <strong style={{color:'#dc2626'}}>empresa_id</strong> debe coincidir con una empresa ya importada.
          </p>
          {dragOver === 'encargados' && (
            <div className="settings-import-drop-hint">📂 Suelta el archivo aquí</div>
          )}
          <div className="settings-import-card-actions">
            <button className="settings-import-btn-outline" type="button" onClick={downloadManagersTemplate}>
              📥 Descargar plantilla
            </button>
            <button className="settings-import-btn-primary" type="button" disabled={!!working} onClick={() => managersInputRef.current?.click()}>
              {working === 'encargados' ? 'Importando...' : '📂 Subir archivo'}
            </button>
          </div>
        </div>

        <div
          className={`settings-import-card ${dragOver === 'eventos' ? 'settings-import-card-dragover' : ''}`}
          onDragEnter={handleDragEnter('eventos')}
          onDragLeave={handleDragLeave('eventos')}
          onDragOver={handleDragOver}
          onDrop={handleDrop('eventos')}
        >
          <h4 className="settings-import-card-title">3. Importar Eventos</h4>
          <p className="settings-import-card-desc">
            Carga bloques de fechas, horarios y salones. El CRM vinculará las empresas y encargados correspondientes.
          </p>
          {dragOver === 'eventos' && (
            <div className="settings-import-drop-hint">📂 Suelta el archivo aquí</div>
          )}
          <div className="settings-import-card-actions">
            <button className="settings-import-btn-outline" type="button" onClick={downloadEventsTemplate}>
              📥 Descargar plantilla
            </button>
            <button className="settings-import-btn-primary" type="button" disabled={!!working} onClick={() => eventsInputRef.current?.click()}>
              {working === 'eventos' ? 'Importando...' : '📂 Subir archivo'}
            </button>
          </div>
        </div>
      </div>

      {/* Columnas de Empresas */}
      <details className="settings-columns-details" style={{marginTop:'16px'}}>
        <summary style={{ fontSize: '13px', fontWeight: '700', cursor: 'pointer', color: '#6366f1', outline: 'none' }}>
          📋 Columnas para importar EMPRESAS
        </summary>
        <div style={{ marginTop: '12px', borderTop: '1px solid #e2e8f0', paddingTop: '8px' }}>
          <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '10px' }}>
            Las columnas marcadas con <span style={{color:'#dc2626',fontWeight:700}}>rojo</span> son obligatorias. Las demás son opcionales.
          </p>
          <div className="settings-column-badges" style={{ marginBottom: '10px' }}>
            {IMPORT_COMPANY_COLUMNS.map(col => {
              const cleanCol = col.replace(' *', '');
              const isRequired = col.includes('*');
              return (
                <span key={col} className={`settings-column-badge ${isRequired ? 'required' : ''}`} 
                  title={COMPANY_COLUMN_DESCRIPTIONS[cleanCol] || ''}
                  style={{ cursor: 'help' }}>
                  {cleanCol}
                  {isRequired && <span className="settings-required-badge">OBLIGATORIO</span>}
                </span>
              );
            })}
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8', lineHeight: 1.6 }}>
            <strong>Formatos aceptados:</strong> CSV (.csv), Excel (.xlsx) o Excel 97-2003 (.xls).
            <br />Primera fila: nombres de columna. Filas siguientes: tus datos.
          </div>
        </div>
      </details>

      {/* Columnas de Encargados */}
      <details className="settings-columns-details">
        <summary style={{ fontSize: '13px', fontWeight: '700', cursor: 'pointer', color: '#6366f1', outline: 'none' }}>
          📋 Columnas para importar ENCARGADOS
        </summary>
        <div style={{ marginTop: '12px', borderTop: '1px solid #e2e8f0', paddingTop: '8px' }}>
          <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '10px' }}>
            Las columnas marcadas con <span style={{color:'#dc2626',fontWeight:700}}>rojo</span> son obligatorias. <strong style={{color:'#dc2626'}}>Importa primero las empresas</strong> para que el empresa_id haga match.
          </p>
          <div className="settings-column-badges">
            {IMPORT_MANAGER_COLUMNS.map(col => {
              const cleanCol = col.replace(' *', '');
              const isRequired = col.includes('*');
              return (
                <span key={col} className={`settings-column-badge ${isRequired ? 'required' : ''}`}
                  title={MANAGER_COLUMN_DESCRIPTIONS[cleanCol] || ''}
                  style={{ cursor: 'help' }}>
                  {cleanCol}
                  {isRequired && <span className="settings-required-badge">OBLIGATORIO</span>}
                </span>
              );
            })}
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8', lineHeight: 1.6, marginTop:'8px' }}>
            <strong>Importante:</strong> El <strong>empresa_id</strong> debe coincidir exactamente con el ID de una empresa ya cargada en el sistema.
            Si no coincide, esa fila se omitirá.
          </div>
        </div>
      </details>

      <input ref={eventsInputRef} type="file" id="settingsImportEventsFile" accept=".csv,.xlsx,.xls" hidden onChange={(event) => handleFile('eventos', event.target.files?.[0])} />
      <input ref={companiesInputRef} type="file" id="settingsImportCompaniesFile" accept=".csv,.xlsx,.xls" hidden onChange={(event) => handleFile('empresas', event.target.files?.[0])} />
      <input ref={managersInputRef} type="file" id="settingsImportManagersFile" accept=".csv,.xlsx,.xls" hidden onChange={(event) => handleFile('encargados', event.target.files?.[0])} />
    </div>
  );
}


