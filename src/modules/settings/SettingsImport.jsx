import { useRef, useState } from 'react';
import {
  IMPORT_EVENT_COLUMNS,
  IMPORT_MANAGER_COLUMNS,
  downloadCsvTemplate,
  importEventRows,
  importManagersCompaniesRows,
  loadCrmState,
  parseCsvRows,
  saveCrmState,
} from './settingsDataUtils';

export default function SettingsImport() {
  const eventsInputRef = useRef(null);
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

  const downloadManagersTemplate = () => {
    downloadCsvTemplate('plantilla_importar_encargados_empresas_crm', IMPORT_MANAGER_COLUMNS, {
      empresa_id: 'cmp_001',
      nombre_comercial: 'Empresa Ejemplo, S.A.',
      razon_social_facturar: 'Empresa Ejemplo Sociedad Anonima',
      nit: '1234567-8',
      correo_empresa: 'compras@empresa.com',
      telefono_empresa: '5555-1234',
      direccion_empresa: 'Ciudad de Guatemala',
      tipo_evento_preferido: 'Corporativo',
      notas_empresa: 'Cliente frecuente',
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
      alert('Guarda la plantilla como CSV UTF-8 antes de importarla.');
      return;
    }
    setWorking(type);
    try {
      const text = await file.text();
      const rows = parseCsvRows(text);
      if (!rows.length) {
        alert('El archivo no tiene filas para importar.');
        return;
      }
      const state = await loadCrmState();
      if (type === 'eventos') {
        const result = importEventRows(state, rows);
        await saveCrmState(state);
        alert(`Importacion lista: ${result.imported} evento(s)${result.skipped ? `, ${result.skipped} fila(s) omitida(s)` : ''}.`);
      } else {
        const result = importManagersCompaniesRows(state, rows);
        await saveCrmState(state);
        alert(`Importacion lista: ${result.companiesTouched} empresa(s), ${result.managersTouched} encargado(s).`);
      }
    } catch (err) {
      console.error('Error importando:', err);
      alert(err.message || 'No se pudo leer el archivo CSV.');
    } finally {
      setWorking('');
      if (type === 'eventos' && eventsInputRef.current) eventsInputRef.current.value = '';
      if (type === 'encargados' && managersInputRef.current) managersInputRef.current.value = '';
    }
  };

  return (
    <div className="settingsExportPanel" aria-label="Importar datos desde Excel">
      <div className="settingsExportIntro">
        <strong>Importacion por plantilla</strong>
        <span>Descarga la plantilla, llenala en Excel y guardala como CSV UTF-8 para cargar eventos o encargados con su empresa.</span>
      </div>

      <div className="moduleActionGrid settingsActionGridEnhanced" style={{ gridTemplateColumns: 'repeat(2, minmax(240px, 1fr))' }}>
        <section className="settingsExportExample" style={{ margin: 0 }}>
          <strong>Importar eventos</strong>
          <span>Usa empresa_id/encargado_id o los nombres para relacionarlos. Si la empresa o encargado no existen, el CRM los crea.</span>
          <div className="rightActions" style={{ justifyContent: 'flex-start', marginTop: 14 }}>
            <button className="btn-ghost" id="btnSettingsDownloadEventsTemplate" type="button" onClick={downloadEventsTemplate}>Descargar plantilla</button>
            <button className="btn-cotizar" id="btnSettingsImportEventsCsv" type="button" onClick={() => eventsInputRef.current?.click()}>{working === 'eventos' ? 'Importando...' : 'Importar CSV'}</button>
          </div>
        </section>

        <section className="settingsExportExample" style={{ margin: 0 }}>
          <strong>Importar encargados con empresa</strong>
          <span>Cada fila puede crear o actualizar una empresa y agregar su encargado relacionado.</span>
          <div className="rightActions" style={{ justifyContent: 'flex-start', marginTop: 14 }}>
            <button className="btn-ghost" id="btnSettingsDownloadManagersTemplate" type="button" onClick={downloadManagersTemplate}>Descargar plantilla</button>
            <button className="btn-cotizar" id="btnSettingsImportManagersCsv" type="button" onClick={() => managersInputRef.current?.click()}>{working === 'encargados' ? 'Importando...' : 'Importar CSV'}</button>
          </div>
        </section>
      </div>

      <div className="settingsExportExample">
        <strong>Formato para importar</strong>
        <span>Eventos: evento_id, nombre_evento, estado, fecha_inicio_evento, fecha_fin_evento, fecha_bloque, hora_inicio, hora_final, salon_principal, empresa_id, empresa, encargado_id, encargado, pax_total.</span>
        <span>Encargados con empresa: empresa_id, nombre_comercial, razon_social_facturar, nit, correo_empresa, telefono_empresa, direccion_empresa, encargado_id, nombre_encargado, telefono_encargado, correo_encargado.</span>
      </div>

      <input ref={eventsInputRef} type="file" id="settingsImportEventsFile" accept=".csv" hidden onChange={(event) => handleFile('eventos', event.target.files?.[0])} />
      <input ref={managersInputRef} type="file" id="settingsImportManagersFile" accept=".csv" hidden onChange={(event) => handleFile('encargados', event.target.files?.[0])} />
    </div>
  );
}
