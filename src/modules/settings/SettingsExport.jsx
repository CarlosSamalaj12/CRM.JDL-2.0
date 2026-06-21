import { useState } from 'react';
import { toast } from '../../utils/toast';
import { exportRowsToExcel, getLatestQuoteSnapshot, getQuoteTotals, loadCrmState } from './settingsDataUtils';

const companyColumns = [
  { key: 'empresa_id', label: 'Empresa ID *', description: 'Identificador unico (obligatorio). Debe ser el mismo al importar encargados.' },
  { key: 'nombre_comercial', label: 'Nombre comercial *', description: 'Nombre visible de la institucion o cliente (obligatorio).' },
  { key: 'razon_social_facturar', label: 'Razon social / Facturar a', description: 'Nombre fiscal usado para facturacion.' },
  { key: 'nit', label: 'NIT', description: 'NIT de facturacion; usar CF si no existe.' },
  { key: 'correo_empresa', label: 'Correo empresa', description: 'Correo general de la empresa.' },
  { key: 'telefono_empresa', label: 'Telefono empresa', description: 'Telefono general de contacto.' },
  { key: 'direccion_empresa', label: 'Direccion empresa', description: 'Direccion fiscal o comercial.' },
  { key: 'tipo_evento_preferido', label: 'Tipo evento preferido', description: 'Clasificacion habitual: Social, Corporativo, etc.' },
  { key: 'notas_empresa', label: 'Notas', description: 'Observaciones sobre la empresa.' },
];

const managerColumns = [
  { key: 'empresa_id', label: 'Empresa ID *', description: 'Identificador de la empresa a la que pertenece (obligatorio). DEBE existir en el sistema.' },
  { key: 'encargado_id', label: 'Encargado ID', description: 'Identificador unico del encargado (opcional, se genera automatico).' },
  { key: 'nombre_encargado', label: 'Nombre encargado *', description: 'Nombre completo del contacto (obligatorio).' },
  { key: 'telefono_encargado', label: 'Telefono encargado', description: 'Telefono directo del encargado.' },
  { key: 'correo_encargado', label: 'Correo encargado', description: 'Correo electronico del encargado.' },
  { key: 'direccion_encargado', label: 'Direccion encargado', description: 'Direccion del encargado si aplica.' },
];

const eventColumns = [
  { key: 'evento_id', label: 'Evento ID', description: 'Identificador unico del bloque o reserva.' },
  { key: 'grupo_id', label: 'Grupo ID', description: 'Agrupa eventos con varias fechas o salones.' },
  { key: 'nombre_evento', label: 'Nombre evento', description: 'Nombre de la reserva o actividad.' },
  { key: 'estado', label: 'Estado', description: 'Estado comercial/operativo actual.' },
  { key: 'fecha_inicio_evento', label: 'Fecha inicio evento', description: 'Inicio general del evento.' },
  { key: 'fecha_fin_evento', label: 'Fecha fin evento', description: 'Fin general del evento.' },
  { key: 'fecha_bloque', label: 'Fecha bloque', description: 'Fecha especifica de este salon/horario.' },
  { key: 'hora_inicio', label: 'Hora inicio', description: 'Hora inicial del bloque.' },
  { key: 'hora_final', label: 'Hora final', description: 'Hora final del bloque.' },
  { key: 'salon_principal', label: 'Salon principal', description: 'Salon base del evento.' },
  { key: 'salones', label: 'Salones', description: 'Salones asociados, separados por coma.' },
  { key: 'vendedor_id', label: 'Vendedor ID', description: 'Usuario responsable.' },
  { key: 'vendedor', label: 'Vendedor', description: 'Nombre del usuario responsable.' },
  { key: 'pax_total', label: 'PAX total', description: 'Personas totales del evento.' },
  { key: 'pax_bloque', label: 'PAX bloque', description: 'Personas asignadas al bloque si aplica.' },
  { key: 'empresa_id', label: 'Empresa ID', description: 'Identificador de empresa para relacionar.' },
  { key: 'empresa', label: 'Empresa', description: 'Nombre de la empresa/institucion.' },
  { key: 'encargado_id', label: 'Encargado ID', description: 'Identificador del encargado relacionado.' },
  { key: 'encargado', label: 'Encargado', description: 'Nombre del encargado del evento.' },
  { key: 'tipo_evento', label: 'Tipo evento', description: 'Clasificacion del evento.' },
  { key: 'notas', label: 'Notas', description: 'Notas internas del evento.' },
  { key: 'cotizacion_version', label: 'Cotizacion version', description: 'Ultima version cotizada disponible.' },
  { key: 'subtotal_cotizacion', label: 'Subtotal cotizacion', description: 'Subtotal calculado de la cotizacion.' },
  { key: 'descuento_cotizacion', label: 'Descuento cotizacion', description: 'Descuento calculado.' },
  { key: 'total_cotizacion', label: 'Total cotizacion', description: 'Total final calculado.' },
  { key: 'ultima_cotizacion', label: 'Ultima cotizacion', description: 'Fecha/hora de la ultima cotizacion enviada o guardada.' },
];

export default function SettingsExport() {
  const [working, setWorking] = useState('');

  const handleExport = async (type) => {
    if (working) return;
    setWorking(type);
    try {
      const state = await loadCrmState();
      const companies = Array.isArray(state.companies) ? state.companies : [];
      const disabledCompanies = new Set((state.disabledCompanies || []).map(String));
      const disabledManagers = new Set((state.disabledManagers || []).map(String));

      if (type === 'empresas') {
        const rows = companies.map((company) => ({
          empresa_id: String(company.id || ''),
          nombre_comercial: String(company.name || ''),
          razon_social_facturar: String(company.billTo || company.businessName || company.name || ''),
          nit: String(company.nit || 'CF'),
          correo_empresa: String(company.email || ''),
          telefono_empresa: String(company.phone || ''),
          direccion_empresa: String(company.address || ''),
          tipo_evento_preferido: String(company.eventType || ''),
          notas_empresa: String(company.notes || ''),
        }));
        if (!rows.length) {
          toast('No hay empresas para exportar.');
          setWorking('');
          return;
        }
        exportRowsToExcel({
          title: 'CRM Jardines - Exportacion de empresas',
          subtitle: 'Catalogo de empresas. Importa primero las empresas, luego los encargados.',
          columns: companyColumns,
          example: {
            empresa_id: 'cmp_001',
            nombre_comercial: 'Empresa Ejemplo, S.A.',
            razon_social_facturar: 'Empresa Ejemplo Sociedad Anonima',
            nit: '1234567-8',
            correo_empresa: 'compras@empresa.com',
            telefono_empresa: '5555-1234',
            direccion_empresa: 'Ciudad de Guatemala',
            tipo_evento_preferido: 'Corporativo',
            notas_empresa: 'Cliente frecuente',
          },
          rows,
          fileBase: 'exportacion_empresas',
        });
      }

      if (type === 'encargados') {
        const rows = [];
        for (const company of companies) {
          for (const manager of company.managers || []) {
            rows.push({
              empresa_id: String(company.id || ''),
              encargado_id: String(manager.id || ''),
              nombre_encargado: String(manager.name || ''),
              telefono_encargado: String(manager.phone || ''),
              correo_encargado: String(manager.email || ''),
              direccion_encargado: String(manager.address || ''),
            });
          }
        }
        if (!rows.length) {
          toast('No hay encargados para exportar.');
          setWorking('');
          return;
        }
        exportRowsToExcel({
          title: 'CRM Jardines - Exportacion de encargados',
          subtitle: 'Contactos responsables vinculados a empresas. El empresa_id debe coincidir con empresas ya importadas.',
          columns: managerColumns,
          example: {
            empresa_id: 'cmp_001',
            encargado_id: 'mgr_001',
            nombre_encargado: 'Ana Lopez',
            telefono_encargado: '5555-5678',
            correo_encargado: 'ana@empresa.com',
            direccion_encargado: 'Ciudad de Guatemala',
          },
          rows,
          fileBase: 'exportacion_encargados',
        });
      }

      if (type === 'eventos') {
        const users = Array.isArray(state.users) ? state.users : [];
        const rows = (state.events || []).map((event) => {
          const quote = getLatestQuoteSnapshot(event) || {};
          const totals = getQuoteTotals(quote);
          const company = companies.find((item) => String(item.id || '') === String(quote.companyId || ''));
          const manager = company?.managers?.find((item) => String(item.id || '') === String(quote.managerId || ''));
          const user = users.find((item) => String(item.id || '') === String(event.userId || ''));
          const salones = Array.isArray(event.salones) && event.salones.length ? event.salones : [event.salon];
          return {
            evento_id: String(event.id || ''),
            grupo_id: String(event.groupId || ''),
            nombre_evento: String(event.name || ''),
            estado: String(event.status || ''),
            fecha_inicio_evento: String(event.eventDateStart || event.date || ''),
            fecha_fin_evento: String(event.eventDateEnd || event.endDate || event.date || ''),
            fecha_bloque: String(event.date || ''),
            hora_inicio: String(event.startTime || ''),
            hora_final: String(event.endTime || ''),
            salon_principal: String(event.mainSalon || event.salon || ''),
            salones: salones.map((item) => String(item || '').trim()).filter(Boolean).join(', '),
            vendedor_id: String(event.userId || ''),
            vendedor: String(user?.fullName || user?.name || ''),
            pax_total: String(event.pax || ''),
            pax_bloque: String(event.slotPax || ''),
            empresa_id: String(quote.companyId || ''),
            empresa: String(company?.name || quote.companyName || ''),
            encargado_id: String(quote.managerId || ''),
            encargado: String(manager?.name || quote.contact || quote.manager || ''),
            tipo_evento: String(quote.eventType || company?.eventType || ''),
            notas: String(event.notes || ''),
            cotizacion_version: quote.version ? String(quote.version) : '',
            subtotal_cotizacion: Number(totals.subtotal || 0).toFixed(2),
            descuento_cotizacion: Number(totals.discountAmount || 0).toFixed(2),
            total_cotizacion: Number(totals.total || 0).toFixed(2),
            ultima_cotizacion: String(quote.quotedAt || quote.docDate || ''),
          };
        });
        if (!rows.length) {
          toast('No hay eventos para exportar.');
          setWorking('');
          return;
        }
        exportRowsToExcel({
          title: 'CRM Jardines - Exportacion de eventos',
          subtitle: 'Eventos y reservas preparados para importarse al nuevo sistema. Cada fila representa un bloque de fecha, salon y horario.',
          columns: eventColumns,
          example: {
            evento_id: 'evt_001',
            grupo_id: 'grp_001',
            nombre_evento: 'Capacitacion anual',
            circle: 'Confirmado',
            fecha_inicio_evento: '2026-05-20',
            fecha_fin_evento: '2026-05-20',
            fecha_bloque: '2026-05-20',
            hora_inicio: '08:00',
            hora_final: '12:00',
            salon_principal: 'Atitlan',
            salones: 'Atitlan, Toliman',
            vendedor_id: 'usr_001',
            vendedor: 'Maria Perez',
            pax_total: '120',
            pax_bloque: '60',
            empresa_id: 'cmp_001',
            empresa: 'Empresa Ejemplo, S.A.',
            encargado_id: 'mgr_001',
            encargado: 'Ana Lopez',
            tipo_evento: 'Corporativo',
            notas: 'Montaje escuela',
            cotizacion_version: '2',
            subtotal_cotizacion: '15000.00',
            descuento_cotizacion: '500.00',
            total_cotizacion: '14500.00',
            ultima_cotizacion: '2026-05-01 10:30',
          },
          rows,
          fileBase: 'exportacion_eventos_nuevo_sistema',
        });
      }
    } catch (err) {
      console.error('Error exportando:', err);
      toast(err.message || 'No se pudo exportar.');
    } finally {
      setWorking('');
    }
  };

  return (
    <div className="settings-data-section">
      <style>{`
        .settings-data-section {
          display: flex;
          flex-direction: column;
          gap: 16px;
          text-align: left;
        }
        .settings-data-desc {
          font-size: 13.5px;
          color: var(--ui-text-soft) !important;
          line-height: 1.5;
          margin: 0;
        }
        .settings-data-actions {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          margin: 4px 0;
        }
        .settings-data-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          min-height: 40px;
          padding: 0 16px;
          background: var(--ui-primary-soft) !important;
          color: var(--ui-primary) !important;
          border: 1px solid transparent !important;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: none !important;
        }
        .settings-data-btn:hover {
          background: var(--ui-primary) !important;
          color: #ffffff !important;
        }
        .settings-data-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .settings-data-btn svg {
          width: 16px;
          height: 16px;
          fill: none;
          stroke: currentColor;
          stroke-width: 2.5;
        }
        .settings-columns-details {
          background: var(--ui-surface-muted) !important;
          border-radius: 14px;
          padding: 12px 16px;
          border: 1px solid var(--ui-border);
        }
        .settings-columns-details-title {
          font-size: 11px;
          font-weight: 800;
          color: var(--ui-text) !important;
          margin: 8px 0 6px 0;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .settings-column-badges {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .settings-column-badge {
          font-size: 11px;
          padding: 3px 8px;
          background: var(--ui-surface) !important;
          border: 1px solid var(--ui-border-strong) !important;
          border-radius: 6px;
          color: var(--ui-text-soft) !important;
          font-family: var(--ui-font);
        }
      `}</style>
      
      <p className="settings-data-desc">
        Descarga archivos en formato Excel con la estructura de datos recomendada para respaldar o transferir la información de eventos, empresas o contactos comerciales.
      </p>

      <div className="settings-data-actions">
        <button 
          className="settings-data-btn" 
          type="button" 
          disabled={!!working}
          onClick={() => handleExport('eventos')}
        >
          <svg viewBox="0 0 24 24" stroke="currentColor">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          {working === 'eventos' ? 'Exportando...' : 'Exportar Eventos'}
        </button>

        <button 
          className="settings-data-btn" 
          type="button" 
          disabled={!!working}
          onClick={() => handleExport('empresas')}
        >
          <svg viewBox="0 0 24 24" stroke="currentColor">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          {working === 'empresas' ? 'Exportando...' : 'Exportar Empresas'}
        </button>

        <button 
          className="settings-data-btn" 
          type="button" 
          disabled={!!working}
          onClick={() => handleExport('encargados')}
        >
          <svg viewBox="0 0 24 24" stroke="currentColor">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          {working === 'encargados' ? 'Exportando...' : 'Exportar Encargados'}
        </button>
      </div>

      <details className="settings-columns-details">
        <summary style={{ fontSize: '13px', fontWeight: '700', cursor: 'pointer', color: 'var(--ui-primary)', outline: 'none' }}>
          Ver columnas y campos incluidos en el reporte
        </summary>
        <div style={{ marginTop: '12px', borderTop: '1px solid var(--ui-border)', paddingTop: '8px' }}>
          <div className="settings-columns-details-title" style={{ marginTop: 0 }}>Columnas de Eventos</div>
          <div className="settings-column-badges" style={{ marginBottom: '10px' }}>
            {eventColumns.map(col => (
              <span key={col.key} className="settings-column-badge" title={col.description}>{col.label}</span>
            ))}
          </div>
          
          <div className="settings-columns-details-title">Columnas de Empresas</div>
          <div className="settings-column-badges" style={{ marginBottom: '10px' }}>
            {companyColumns.map(col => (
              <span key={col.key} className="settings-column-badge" title={col.description}>{col.label}</span>
            ))}
          </div>

          <div className="settings-columns-details-title">Columnas de Encargados</div>
          <div className="settings-column-badges">
            {managerColumns.map(col => (
              <span key={col.key} className="settings-column-badge" title={col.description}>{col.label}</span>
            ))}
          </div>
        </div>
      </details>
    </div>
  );
}
