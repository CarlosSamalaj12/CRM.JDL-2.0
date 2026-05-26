import { useState } from 'react';
import { exportRowsToExcel, getLatestQuoteSnapshot, getQuoteTotals, loadCrmState } from './settingsDataUtils';

const companyColumns = [
  { key: 'empresa_id', label: 'Empresa ID', description: 'Identificador unico para relacionar eventos y encargados.' },
  { key: 'nombre_comercial', label: 'Nombre comercial', description: 'Nombre visible de la institucion o cliente.' },
  { key: 'razon_social_facturar', label: 'Razon social / Facturar a', description: 'Nombre fiscal usado para documentos.' },
  { key: 'nit', label: 'NIT', description: 'NIT de facturacion; usar CF si no existe.' },
  { key: 'correo_empresa', label: 'Correo empresa', description: 'Correo general de la empresa.' },
  { key: 'telefono_empresa', label: 'Telefono empresa', description: 'Telefono general de contacto.' },
  { key: 'direccion_empresa', label: 'Direccion empresa', description: 'Direccion fiscal o comercial.' },
  { key: 'tipo_evento_preferido', label: 'Tipo evento preferido', description: 'Clasificacion habitual: Social, Corporativo, Individual, etc.' },
  { key: 'notas', label: 'Notas', description: 'Observaciones internas para migracion.' },
  { key: 'estado', label: 'Estado', description: 'Activa o Inactiva segun configuracion actual.' },
];

const managerColumns = [
  { key: 'encargado_id', label: 'Encargado ID', description: 'Identificador unico del responsable.' },
  { key: 'empresa_id', label: 'Empresa ID', description: 'Identificador de la empresa a la que pertenece.' },
  { key: 'empresa_nombre', label: 'Empresa nombre', description: 'Nombre comercial para validacion humana.' },
  { key: 'nombre_encargado', label: 'Nombre encargado', description: 'Nombre completo del contacto.' },
  { key: 'telefono', label: 'Telefono', description: 'Telefono directo del encargado.' },
  { key: 'correo', label: 'Correo', description: 'Correo directo del encargado.' },
  { key: 'direccion', label: 'Direccion', description: 'Direccion del encargado si aplica.' },
  { key: 'estado', label: 'Estado', description: 'Activo o Inactivo segun configuracion actual.' },
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
          notas: String(company.notes || ''),
          estado: disabledCompanies.has(String(company.id || '')) ? 'Inactiva' : 'Activa',
        }));
        if (!rows.length) return alert('No hay empresas para exportar.');
        exportRowsToExcel({
          title: 'CRM Jardines - Exportacion de empresas',
          subtitle: 'Catalogo de empresas preparado para importarse al nuevo sistema.',
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
            notas: 'Cliente frecuente',
            estado: 'Activa',
          },
          rows,
          fileBase: 'exportacion_empresas_nuevo_sistema',
        });
      }

      if (type === 'encargados') {
        const rows = [];
        for (const company of companies) {
          for (const manager of company.managers || []) {
            rows.push({
              encargado_id: String(manager.id || ''),
              empresa_id: String(company.id || ''),
              empresa_nombre: String(company.name || ''),
              nombre_encargado: String(manager.name || ''),
              telefono: String(manager.phone || ''),
              correo: String(manager.email || ''),
              direccion: String(manager.address || ''),
              estado: disabledManagers.has(String(manager.id || '')) ? 'Inactivo' : 'Activo',
            });
          }
        }
        if (!rows.length) return alert('No hay encargados para exportar.');
        exportRowsToExcel({
          title: 'CRM Jardines - Exportacion de encargados',
          subtitle: 'Contactos responsables vinculados a empresas para importarse al nuevo sistema.',
          columns: managerColumns,
          example: {
            encargado_id: 'mgr_001',
            empresa_id: 'cmp_001',
            empresa_nombre: 'Empresa Ejemplo, S.A.',
            nombre_encargado: 'Ana Lopez',
            telefono: '5555-5678',
            correo: 'ana@empresa.com',
            direccion: 'Ciudad de Guatemala',
            estado: 'Activo',
          },
          rows,
          fileBase: 'exportacion_encargados_nuevo_sistema',
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
        if (!rows.length) return alert('No hay eventos para exportar.');
        exportRowsToExcel({
          title: 'CRM Jardines - Exportacion de eventos',
          subtitle: 'Eventos y reservas preparados para importarse al nuevo sistema. Cada fila representa un bloque de fecha, salon y horario.',
          columns: eventColumns,
          example: {
            evento_id: 'evt_001',
            grupo_id: 'grp_001',
            nombre_evento: 'Capacitacion anual',
            estado: 'Confirmado',
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
      alert(err.message || 'No se pudo exportar.');
    } finally {
      setWorking('');
    }
  };

  return (
    <div className="settingsExportPanel" aria-label="Exportar datos por Excel">
      <div className="settingsExportIntro">
        <strong>Migracion por Excel</strong>
        <span>Descarga eventos, empresas o encargados con las columnas sugeridas, una fila de ejemplo y los datos actuales del CRM.</span>
      </div>
      <div className="moduleActionGrid settingsActionGridEnhanced">
        <button className="moduleActionBtn settingsHubBtn" id="btnSettingsExportEventsExcel" type="button" onClick={() => handleExport('eventos')}>
          <span className="actionCardInner"><span className="actionCardText"><span className="actionCardLabel">{working === 'eventos' ? 'Exportando...' : 'Exportar eventos'}</span><span className="actionCardMeta">Reservas, salones, empresa, encargado y cotizacion</span></span></span>
        </button>
        <button className="moduleActionBtn settingsHubBtn" id="btnSettingsExportCompaniesExcel" type="button" onClick={() => handleExport('empresas')}>
          <span className="actionCardInner"><span className="actionCardText"><span className="actionCardLabel">{working === 'empresas' ? 'Exportando...' : 'Exportar empresas'}</span><span className="actionCardMeta">Catalogo de clientes, facturacion y contacto</span></span></span>
        </button>
        <button className="moduleActionBtn settingsHubBtn" id="btnSettingsExportManagersExcel" type="button" onClick={() => handleExport('encargados')}>
          <span className="actionCardInner"><span className="actionCardText"><span className="actionCardLabel">{working === 'encargados' ? 'Exportando...' : 'Exportar encargados'}</span><span className="actionCardMeta">Responsables relacionados a cada empresa</span></span></span>
        </button>
      </div>
      <div className="settingsExportExample">
        <strong>Ejemplo de columnas</strong>
        <span>Eventos: evento_id, nombre_evento, fecha_inicio_evento, fecha_fin_evento, salon_principal, empresa_id, encargado_id, vendedor, pax_total, total_cotizacion.</span>
        <span>Empresas: empresa_id, nombre_comercial, razon_social_facturar, nit, correo_empresa, telefono_empresa, direccion_empresa, tipo_evento_preferido.</span>
        <span>Encargados: encargado_id, empresa_id, empresa_nombre, nombre_encargado, telefono, correo, direccion.</span>
      </div>
    </div>
  );
}
