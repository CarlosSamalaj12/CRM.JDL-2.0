import { useState, useMemo, useEffect, useCallback } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import {
  Handshake, ClipboardList, Clock, Eye, Trophy, XCircle,
  TrendingUp, AlertTriangle, Calendar, MapPin, Users, Phone,
  Mail, RefreshCw, Link as LinkIcon, RotateCcw, Trash2, Pencil,
  Search, Loader2, Inbox, BarChart3, Plus, X, ChevronDown,
} from 'lucide-react';
import api from '../../services/api';
import authService from '../../services/authService';
import MultiSelect from '../reports/components/MultiSelect';
import { useToast } from '../informes/context/ToastContext';

// ─── Wrapper de iconos minimalistas con color ─────────────────
// Uso: <Icon name="calendar" size={14} color="#475569" />
const ICONS = {
  handshake: Handshake,
  clipboard: ClipboardList,
  clock: Clock,
  eye: Eye,
  trophy: Trophy,
  xCircle: XCircle,
  trendingUp: TrendingUp,
  alertTriangle: AlertTriangle,
  calendar: Calendar,
  mapPin: MapPin,
  users: Users,
  phone: Phone,
  mail: Mail,
  refresh: RefreshCw,
  link: LinkIcon,
  rotateCcw: RotateCcw,
  trash: Trash2,
  pencil: Pencil,
  search: Search,
  loader: Loader2,
  inbox: Inbox,
  barChart: BarChart3,
  plus: Plus,
  x: X,
  chevronDown: ChevronDown,
};

function Icon({ name, size = 16, color, strokeWidth = 2, style, className }) {
  const Component = ICONS[name];
  if (!Component) return null;
  return (
    <Component
      size={size}
      color={color || 'currentColor'}
      strokeWidth={strokeWidth}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
      className={className}
    />
  );
}

// ─── Helpers de SweetAlert2 con el estilo del módulo ──────────
const swalBase = {
  background: '#f8fbff',
  color: '#0f172a',
  customClass: {
    title: 'pv-swal-title',
    htmlContainer: 'pv-swal-html',
    confirmButton: 'pv-swal-confirm',
    cancelButton: 'pv-swal-cancel',
  },
  buttonsStyling: false,
  reverseButtons: true,
  heightAuto: false,
};

function swalConfirmDelete(nombreCliente) {
  return Swal.fire({
    ...swalBase,
    icon: 'warning',
    iconColor: '#dc2626',
    title: '¿Eliminar evento asignado?',
    html: `Vas a eliminar el evento asignado de <strong>"${nombreCliente}"</strong>.<br>Esta acción no se puede deshacer.`,
    showCancelButton: true,
    confirmButtonText: '🗑️ Sí, eliminar',
    cancelButtonText: 'Cancelar',
  });
}

function swalError(title, message) {
  return Swal.fire({
    ...swalBase,
    icon: 'error',
    iconColor: '#dc2626',
    title,
    text: message,
    confirmButtonText: 'Entendido',
  });
}

function swalConfirmRestore(nombreCliente) {
  return Swal.fire({
    ...swalBase,
    icon: 'question',
    iconColor: '#0f766e',
    title: '¿Restaurar evento asignado?',
    html: `El evento asignado de <strong>"${nombreCliente}"</strong> volverá a estar activo y visible en la lista principal.`,
    showCancelButton: true,
    confirmButtonText: '↩️ Sí, restaurar',
    cancelButtonText: 'Cancelar',
  });
}

const SERVICIOS_FIJOS = ['Comida', 'Montaje', 'Decoración', 'Sonido', 'Iluminación', 'Habitaciones', 'Coordinación'];

const ESTADOS = [
  { key: 'pendiente', label: 'Pendiente', color: '#d97706', bg: '#fffbeb', border: '#fde68a', softBg: '#fef3c7' },
  { key: 'en_proceso', label: 'En proceso', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', softBg: '#dbeafe' },
  { key: 'ganada', label: 'Ganada', color: '#059669', bg: '#ecfdf5', border: '#a7f3d0', softBg: '#d1fae5' },
  { key: 'perdida', label: 'Perdida', color: '#dc2626', bg: '#fef2f2', border: '#fecaca', softBg: '#fee2e2' },
];

const ESTADO_MAP = Object.fromEntries(ESTADOS.map(e => [e.key, e]));

// Tarjetas de métricas (incluye conversión, sin seguimiento, eventos asignados y sin asignar)
const STAT_CARDS = [
  { key: 'total', label: 'Total', color: '#0f172a', bg: '#f8fafc', border: '#e2e8f0', icon: 'clipboard', isTotal: true },
  ...ESTADOS.map(e => ({
    ...e,
    label: e.label,
    icon: e.key === 'pendiente' ? 'clock'
        : e.key === 'en_proceso' ? 'eye'
        : e.key === 'ganada' ? 'trophy'
        : 'xCircle',
  })),
  { key: 'conversion', label: 'Conversión', color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe', icon: 'trendingUp', isRate: true },
  { key: 'eventos_asignados', label: 'Eventos Asignados', color: '#0f766e', bg: '#f0fdfa', border: '#99f6e4', icon: 'handshake' },
  { key: 'sin_asignar', label: 'Sin asignar', color: '#b45309', bg: '#fffbeb', border: '#fde68a', icon: 'alertTriangle' },
  { key: 'sin_seguimiento', label: 'Sin seguimiento', color: '#dc2626', bg: '#fef2f2', border: '#fecaca', icon: 'alertTriangle' },
];

// ─── Componentes auxiliares ─────────────────────────────────

function StatCard({ stat, value, pct, extra }) {
  return (
    <div style={{
      background: stat.bg,
      border: `1px solid ${stat.border}`,
      borderRadius: '14px',
      padding: '14px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      transition: 'transform 0.15s, box-shadow 0.15s',
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(15,23,42,0.06)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
    >
      <div style={{
        width: '38px', height: '38px', borderRadius: '10px',
        background: '#fff',
        border: `1px solid ${stat.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon name={stat.icon} size={20} color={stat.color} strokeWidth={2.2} />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{
          fontSize: '10.5px', fontWeight: 700, color: '#64748b',
          textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px',
        }}>{stat.label}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '22px', fontWeight: 900, color: stat.color, lineHeight: 1 }}>
            {value}{stat.isRate && <span style={{ fontSize: '14px', marginLeft: '1px' }}>%</span>}
          </span>
          {pct !== null && pct !== undefined && (
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8' }}>{pct}%</span>
          )}
          {extra && (
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8' }}>{extra}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function EstadoPill({ estado, size = 'md' }) {
  const est = ESTADO_MAP[estado] || ESTADO_MAP.pendiente;
  const padding = size === 'lg' ? '5px 12px' : '3px 10px';
  const fontSize = size === 'lg' ? '11.5px' : '10px';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      fontSize, fontWeight: 800, color: est.color,
      padding, borderRadius: '999px',
      background: est.softBg,
      border: `1px solid ${est.border}`,
      whiteSpace: 'nowrap',
    }}>
      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: est.color }} />
      {est.label}
    </span>
  );
}

function QuickFilterChip({ active, count, label, color, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '8px',
        padding: '8px 14px', borderRadius: '999px',
        border: active ? `1.5px solid ${color}` : '1.5px solid #e2e8f0',
        background: active ? `${color}10` : '#fff',
        color: active ? color : '#475569',
        fontSize: '12.5px', fontWeight: 700, cursor: 'pointer',
        transition: 'all 0.12s',
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.borderColor = '#cbd5e1'; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.borderColor = '#e2e8f0'; }}
    >
      {label}
      <span style={{
        background: active ? color : '#f1f5f9',
        color: active ? '#fff' : '#64748b',
        padding: '1px 7px', borderRadius: '999px',
        fontSize: '10.5px', fontWeight: 800, minWidth: '20px', textAlign: 'center',
      }}>{count}</span>
    </button>
  );
}

function ViewSegmented({ value, onChange, adminCount }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center',
      background: '#f1f5f9', borderRadius: '12px', padding: '4px',
      border: '1px solid #e2e8f0',
    }}>
      <button
        onClick={() => onChange('activas')}
        style={{
          padding: '7px 16px', borderRadius: '8px', border: 'none',
          background: value === 'activas' ? '#fff' : 'transparent',
          color: value === 'activas' ? '#0f172a' : '#64748b',
          fontWeight: value === 'activas' ? 800 : 600,
          fontSize: '12.5px', cursor: 'pointer',
          boxShadow: value === 'activas' ? '0 1px 3px rgba(15,23,42,0.08)' : 'none',
          transition: 'all 0.12s',
          display: 'inline-flex', alignItems: 'center', gap: '6px',
        }}
      >
        <Icon name="clipboard" size={14} color={value === 'activas' ? '#0f172a' : '#64748b'} strokeWidth={2.3} />
        Activas
      </button>
      <button
        onClick={() => onChange('eliminadas')}
        style={{
          padding: '7px 16px', borderRadius: '8px', border: 'none',
          background: value === 'eliminadas' ? '#fff' : 'transparent',
          color: value === 'eliminadas' ? '#dc2626' : '#64748b',
          fontWeight: value === 'eliminadas' ? 800 : 600,
          fontSize: '12.5px', cursor: 'pointer',
          boxShadow: value === 'eliminadas' ? '0 1px 3px rgba(220,38,38,0.15)' : 'none',
          transition: 'all 0.12s',
          display: 'inline-flex', alignItems: 'center', gap: '6px',
        }}
      >
        <Icon name="trash" size={14} color={value === 'eliminadas' ? '#dc2626' : '#64748b'} strokeWidth={2.3} />
        Eliminadas
        {adminCount > 0 && (
          <span style={{
            background: '#dc2626', color: '#fff',
            padding: '1px 6px', borderRadius: '999px',
            fontSize: '10px', fontWeight: 800, minWidth: '18px', textAlign: 'center',
          }}>{adminCount}</span>
        )}
      </button>
    </div>
  );
}

function DeletedLeadCard({ lead, restoring, onRestore }) {
  return (
    <div style={{
      display: 'flex', background: '#fff',
      border: '1px solid #fecaca', borderRadius: '14px',
      overflow: 'hidden', opacity: 0.95,
    }}>
      <div style={{ width: '5px', background: '#dc2626', flexShrink: 0 }} />
      <div style={{ flex: 1, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '50%',
            background: '#fef2f2', color: '#dc2626',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: '14px', flexShrink: 0,
          }}>
            {(lead.nombreCliente || '?').trim().charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '15.5px', fontWeight: 800, color: '#0f172a' }}>{lead.nombreCliente}</span>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '5px',
                fontSize: '10.5px', fontWeight: 800, color: '#dc2626',
                padding: '3px 10px', borderRadius: '999px',
                background: '#fef2f2', border: '1px solid #fecaca',
              }}>
                <Icon name="trash" size={12} color="#dc2626" strokeWidth={2.5} />
                Eliminada
              </span>
              {lead.estado && (
                <EstadoPill estado={lead.estado} />
              )}
            </div>
            <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '3px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
              {lead.vendedorNombre ? (
                <>
                  <Icon name="users" size={13} color="#94a3b8" strokeWidth={2.2} />
                  {lead.vendedorNombre}
                </>
              ) : (
                <>
                  <Icon name="alertTriangle" size={13} color="#d97706" strokeWidth={2.3} />
                  Sin vendedor asignado
                </>
              )}
            </div>
          </div>
        </div>

        {(lead.fechaEvento || (lead.salones || []).length > 0 || lead.pax) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', fontSize: '12px', color: '#334155', fontWeight: 600 }}>
            {lead.fechaEvento && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <Icon name="calendar" size={14} color="#94a3b8" strokeWidth={2.2} />
                {lead.fechaEvento}
              </span>
            )}
            {(lead.salones || []).length > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <Icon name="mapPin" size={14} color="#94a3b8" strokeWidth={2.2} />
                {(lead.salones || []).join(', ')}
              </span>
            )}
            {lead.pax ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <Icon name="users" size={14} color="#94a3b8" strokeWidth={2.2} />
                {lead.pax} pax
              </span>
            ) : null}
          </div>
        )}

        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexWrap: 'wrap', gap: '10px', paddingTop: '4px',
          borderTop: '1px dashed #fecaca',
        }}>
          <div style={{ fontSize: '11px', color: '#7f1d1d', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <Icon name="trash" size={13} color="#7f1d1d" strokeWidth={2.3} />
            Eliminada {lead.deletedAt ? `el ${new Date(String(lead.deletedAt).replace(' ', 'T')).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}
            {lead.deletedPorNombre ? ` por ${lead.deletedPorNombre}` : ''}
          </div>
          <button
            onClick={onRestore}
            disabled={restoring}
            style={{
              fontSize: '12px', fontWeight: 800, padding: '8px 14px', borderRadius: '8px',
              border: '1.5px solid #0f766e', background: restoring ? '#a7f3d0' : '#ccfbf1',
              color: '#0f766e', cursor: restoring ? 'default' : 'pointer',
              whiteSpace: 'nowrap', opacity: restoring ? 0.7 : 1,
              display: 'inline-flex', alignItems: 'center', gap: '6px',
            }}
          >
            {restoring ? (
              <>
                <Icon name="loader" size={13} color="#0f766e" className="pv-spin" strokeWidth={2.3} />
                Restaurando...
              </>
            ) : (
              <>
                <Icon name="rotateCcw" size={13} color="#0f766e" strokeWidth={2.3} />
                Restaurar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function VendedorCard({ row }) {
  const initial = (row.nombre || '?').trim().charAt(0).toUpperCase();
  const hue = (row.nombre || 'x').split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  const convColor = row.pctConversion >= 50 ? '#059669' : row.pctConversion >= 25 ? '#f59e0b' : '#ef4444';
  const isSinAsignar = !row.vendedorId;
  return (
    <div style={{
      background: '#fff', border: `1px solid ${isSinAsignar ? '#fde68a' : '#e2e8f0'}`, borderRadius: '12px',
      padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '12px',
    }}>
      <div style={{
        width: '36px', height: '36px', borderRadius: '50%',
        background: isSinAsignar ? '#fef3c7' : `hsl(${hue}, 65%, 88%)`,
        color: isSinAsignar ? '#b45309' : `hsl(${hue}, 50%, 35%)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 800, fontSize: '14px', flexShrink: 0,
      }}>
        {isSinAsignar ? (
          <Icon name="alertTriangle" size={18} color="#b45309" strokeWidth={2.4} />
        ) : initial}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {row.nombre}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            fontSize: '10.5px', fontWeight: 800, color: isSinAsignar ? '#b45309' : '#0f766e',
            padding: '3px 8px', borderRadius: '999px',
            background: isSinAsignar ? '#fef3c7' : '#f0fdfa',
            border: `1px solid ${isSinAsignar ? '#fde68a' : '#99f6e4'}`,
          }} title="Eventos asignados a este vendedor">
            <Icon name={isSinAsignar ? 'inbox' : 'handshake'} size={11} color={isSinAsignar ? '#b45309' : '#0f766e'} strokeWidth={2.4} />
            Eventos Asignados: {row.total}
          </span>
          <span style={{ fontSize: '10.5px', color: '#d97706', fontWeight: 700 }}>{row.pendiente} pend.</span>
          <span style={{ fontSize: '10.5px', color: '#047857', fontWeight: 700 }}>{row.ganada} gan.</span>
          <span style={{ fontSize: '10.5px', color: '#b91c1c', fontWeight: 700 }}>{row.perdida} perd.</span>
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: '14px', fontWeight: 900, color: convColor }}>{row.pctConversion}%</div>
        <div
          style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '3px' }}
          title={row.respuestaPromedioMs
            ? `Promedio de tiempo entre que se creó el evento asignado y el primer cambio de estado del vendedor (${row.nConSeguimiento} leads con seguimiento)`
            : 'Ningún lead de este vendedor tiene seguimiento todavía'}
        >
          {row.respuestaPromedioMs ? (
            <>
              <Icon name="clock" size={10} color="#94a3b8" strokeWidth={2.5} />
              {formatDuration(row.respuestaPromedioMs)}
            </>
          ) : '—'}
        </div>
      </div>
    </div>
  );
}

function LeadCard({ lead, userName, canEdit, canDelete, onEdit, onDelete, onConvert, onVerReserva }) {
  const est = ESTADO_MAP[lead.estado] || ESTADO_MAP.pendiente;
  const servicios = parseServicios(lead.servicios);
  const sinSegDias = diasDesde(lead.creadoEn);
  return (
    <div style={{
      display: 'flex',
      background: '#fff',
      border: '1px solid #e2e8f0',
      borderRadius: '14px',
      overflow: 'hidden',
      transition: 'border-color 0.15s, box-shadow 0.15s, transform 0.15s',
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(15,23,42,0.06)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      {/* Barra lateral con color del estado */}
      <div style={{ width: '5px', background: est.color, flexShrink: 0 }} />

      <div style={{ flex: 1, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px', minWidth: 0 }}>
        {/* Cabecera: nombre + estado + vendedor asignado */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '50%',
            background: `${est.color}15`, color: est.color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: '14px', flexShrink: 0,
          }}>
            {(lead.nombreCliente || '?').trim().charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '15.5px', fontWeight: 800, color: '#0f172a' }}>{lead.nombreCliente}</span>
              <EstadoPill estado={lead.estado} />
              {lead.eventoId && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  fontSize: '10.5px', fontWeight: 700, color: '#0f766e',
                  padding: '3px 9px', borderRadius: '999px',
                  background: '#ccfbf1', border: '1px solid #5eead4',
                }}>
                  <Icon name="link" size={12} color="#0f766e" strokeWidth={2.5} />
                  Vinculada
                </span>
              )}
            </div>
            {lead.vendedorNombre ? (
              <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '3px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <Icon name="users" size={13} color="#94a3b8" strokeWidth={2.2} />
                {lead.vendedorNombre}
              </div>
            ) : (
              <div style={{ fontSize: '11.5px', color: '#d97706', marginTop: '3px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <Icon name="alertTriangle" size={13} color="#d97706" strokeWidth={2.3} />
                Sin vendedor asignado
              </div>
            )}
          </div>
        </div>

        {/* Info del evento */}
        {(lead.fechaEvento || (lead.salones || []).length > 0 || lead.pax) && (
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: '6px 14px',
            fontSize: '12px', color: '#334155', fontWeight: 600,
          }}>
            {lead.fechaEvento && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <Icon name="calendar" size={14} color="#94a3b8" strokeWidth={2.2} />
                {lead.fechaEvento}
              </span>
            )}
            {(lead.salones || []).length > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <Icon name="mapPin" size={14} color="#94a3b8" strokeWidth={2.2} />
                {(lead.salones || []).join(', ')}
              </span>
            )}
            {lead.pax ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <Icon name="users" size={14} color="#94a3b8" strokeWidth={2.2} />
                {lead.pax} pax
              </span>
            ) : null}
          </div>
        )}

        {/* Contacto */}
        {(lead.telefono || lead.correo) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', fontSize: '12px', color: '#475569', fontWeight: 600 }}>
            {lead.telefono && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <Icon name="phone" size={14} color="#94a3b8" strokeWidth={2.2} />
                {lead.telefono}
              </span>
            )}
            {lead.correo && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <Icon name="mail" size={14} color="#94a3b8" strokeWidth={2.2} />
                {lead.correo}
              </span>
            )}
          </div>
        )}

        {/* Servicios */}
        {servicios.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
            {servicios.map((s, i) => (
              <span key={i} style={{
                fontSize: '10.5px', fontWeight: 700, color: '#0c4a6e',
                padding: '3px 10px', borderRadius: '999px',
                background: '#f0f9ff', border: '1px solid #bae6fd',
              }}>{s}</span>
            ))}
          </div>
        )}

        {/* Notas */}
        {lead.notas && (
          <div style={{
            fontSize: '12px', color: '#475569', lineHeight: 1.5,
            background: '#f8fafc', borderRadius: '8px',
            padding: '8px 12px', borderLeft: `3px solid ${est.color}`,
          }}>{lead.notas}</div>
        )}

        {/* Footer: seguimiento + meta + acciones */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexWrap: 'wrap', gap: '10px', paddingTop: '4px',
          borderTop: '1px dashed #f1f5f9',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {lead.ultimoSeguimientoEn ? (
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Icon name="refresh" size={12} color="#94a3b8" strokeWidth={2.3} />
                Seg: {formatFechaCorta(lead.ultimoSeguimientoEn)}
              </span>
            ) : (
              <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Icon name="alertTriangle" size={12} color="#dc2626" strokeWidth={2.3} />
                Sin seguimiento{sinSegDias !== null ? ` (${sinSegDias}d)` : ''}
              </span>
            )}
            <span style={{ fontSize: '11px', color: '#cbd5e1', fontWeight: 600 }}>
              · {userName(lead.creadoPorId) || lead.creadoPorNombre || '—'} ·
              {lead.creadoEn ? ` ${new Date(String(lead.creadoEn).replace(' ', 'T')).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}` : ''}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            {/* Estado derivado (automático) — no editable */}
            <EstadoPill estado={lead.estado} />
            <span
              title="El estado se calcula automáticamente desde el calendario y la fecha del evento"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '3px',
                fontSize: '10.5px', fontWeight: 700, color: '#94a3b8',
                padding: '4px 7px', borderRadius: '6px',
                background: '#f1f5f9', border: '1px solid #e2e8f0',
              }}
            >
              <Icon name="lock" size={10} color="#94a3b8" strokeWidth={2.5} />
              Auto
            </span>
            {lead.eventoId ? (
              <button onClick={onVerReserva} title="Abrir la reserva vinculada"
                style={btnAction('#0f766e', '#ccfbf1', '#5eead4')}>
                <Icon name="link" size={13} color="#0f766e" strokeWidth={2.3} />
                Ver reserva
              </button>
            ) : (
              <button onClick={onConvert} title="Convertir en reserva del calendario"
                style={btnAction('#0f766e', '#ccfbf1', '#5eead4')}>
                <Icon name="calendar" size={13} color="#0f766e" strokeWidth={2.3} />
                Convertir
              </button>
            )}
            {canEdit && (
              <button onClick={onEdit} title="Editar"
                style={{ ...btnAction('#475569', '#fff', '#e2e8f0'), padding: '6px 9px' }}>
                <Icon name="pencil" size={13} color="#475569" strokeWidth={2.3} />
              </button>
            )}
            {canDelete && (
              <button onClick={onDelete} title="Eliminar"
                style={{ ...btnAction('#ef4444', '#fff', '#fecaca'), padding: '6px 9px' }}>
                <Icon name="trash" size={13} color="#ef4444" strokeWidth={2.3} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function btnAction(color, bg, border) {
  return {
    fontSize: '12px', fontWeight: 700, padding: '6px 12px', borderRadius: '8px',
    border: `1.5px solid ${border}`, background: bg, color, cursor: 'pointer',
    whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '5px',
  };
}

// ─── Helpers de fecha ──────────────────────────────────────
function parseServicios(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map(String).filter(Boolean);
}
function toDateObj(val) {
  if (!val) return null;
  const d = new Date(String(val).replace(' ', 'T'));
  return isNaN(d.getTime()) ? null : d;
}
function formatFechaCorta(val) {
  const d = toDateObj(val);
  if (!d) return '';
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}
function formatDuration(ms) {
  if (!ms || ms < 0 || isNaN(ms)) return '—';
  const minutos = Math.floor(ms / 60000);
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `${horas}h ${minutos % 60}m`;
  const dias = Math.floor(horas / 24);
  return `${dias}d ${horas % 24}h`;
}
function diasDesde(val) {
  const d = toDateObj(val);
  if (!d) return null;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
}

// ─── Componente principal ─────────────────────────────────
export default function PosiblesVentasModule() {
  const navigate = useNavigate();
  const toast = useToast();
  const outlet = useOutletContext() || {};
  const outletSalones = outlet?.salones;
  const outletUsers = outlet?.users;
  const salones = useMemo(() => (Array.isArray(outletSalones) ? outletSalones : []), [outletSalones]);
  const users = useMemo(() => (Array.isArray(outletUsers) ? outletUsers : []), [outletUsers]);

  const currentUser = authService.getCurrentUser();
  const userRole = String(currentUser?.role || '').trim().toLowerCase();
  const isAdmin = userRole === 'admin';
  const isReception = ['recepcionista', 'frontoffice', 'front_office'].includes(userRole);
  const canCreate = isAdmin || isReception;

  const vendedores = useMemo(() => {
    return (users || []).filter(u => {
      const r = String(u.role || '').trim().toLowerCase();
      return r === 'vendedor' || r === 'admin';
    });
  }, [users]);

  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  // Soft delete UI (solo admin)
  const [vista, setVista] = useState('activas'); // 'activas' | 'eliminadas'
  const [eliminadas, setEliminadas] = useState([]);
  const [loadingEliminadas, setLoadingEliminadas] = useState(false);
  const [restoringId, setRestoringId] = useState(null);

  // Form state (el estado del lead NO se edita: se calcula del calendario + fecha)
  const [form, setForm] = useState({
    nombreCliente: '', telefono: '', correo: '', fechaEvento: '',
    pax: '', notas: '', vendedorId: '',
  });
  const [formSalones, setFormSalones] = useState(new Set());
  const [formServicios, setFormServicios] = useState(new Set());
  const [customServicio, setCustomServicio] = useState('');

  const loadLeads = useCallback(async () => {
    try {
      const data = await api.get('/api/posibles-ventas');
      setLeads(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error cargando posibles ventas:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadLeads(); }, [loadLeads]);

  const loadEliminadas = useCallback(async () => {
    setLoadingEliminadas(true);
    try {
      const data = await api.get('/api/posibles-ventas/eliminadas');
      setEliminadas(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error cargando posibles ventas eliminadas:', err);
      await swalError('No se pudieron cargar las eliminadas', err.message || 'Error inesperado.');
    } finally {
      setLoadingEliminadas(false);
    }
  }, []);

  useEffect(() => {
    if (vista === 'eliminadas' && isAdmin && eliminadas.length === 0) {
      loadEliminadas();
    }
  }, [vista, isAdmin, eliminadas.length, loadEliminadas]);

  const handleRestore = async (lead) => {
    const result = await swalConfirmRestore(lead.nombreCliente);
    if (!result.isConfirmed) return;
    setRestoringId(lead.id);
    try {
      await api.post(`/api/posibles-ventas/${lead.id}/restore`);
      toast.success('Evento asignado restaurado. Volvió a la lista principal.');
      setEliminadas(prev => prev.filter(l => l.id !== lead.id));
      loadLeads();
    } catch (err) {
      await swalError('No se pudo restaurar', err.message || 'Error inesperado al restaurar.');
    } finally {
      setRestoringId(null);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ nombreCliente: '', telefono: '', correo: '', fechaEvento: '', pax: '', notas: '', vendedorId: '' });
    setFormSalones(new Set());
    setFormServicios(new Set());
    setCustomServicio('');
    setModalOpen(true);
  };

  const openEdit = (lead) => {
    setEditing(lead);
    setForm({
      nombreCliente: lead.nombreCliente || '',
      telefono: lead.telefono || '',
      correo: lead.correo || '',
      fechaEvento: lead.fechaEvento || '',
      pax: lead.pax ?? '',
      notas: lead.notas || '',
      vendedorId: lead.vendedorId || '',
    });
    setFormSalones(new Set(Array.isArray(lead.salones) ? lead.salones : []));
    setFormServicios(new Set(parseServicios(lead.servicios).filter(s => SERVICIOS_FIJOS.includes(s))));
    setCustomServicio(parseServicios(lead.servicios).filter(s => !SERVICIOS_FIJOS.includes(s)).join(', '));
    setModalOpen(true);
  };

  const addCustomServicio = () => {
    const val = customServicio.trim();
    if (!val) return;
    const parts = val.split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length) {
      setFormServicios(prev => {
        const next = new Set(prev);
        parts.forEach(p => next.add(p));
        return next;
      });
    }
    setCustomServicio('');
  };

  const handleSave = async () => {
    if (!form.nombreCliente.trim()) {
      toast.warning('El nombre del cliente es requerido');
      return;
    }
    const servicios = [...formServicios];
    const payload = {
      nombreCliente: form.nombreCliente.trim(),
      telefono: form.telefono.trim(),
      correo: form.correo.trim(),
      fechaEvento: form.fechaEvento || null,
      salones: [...formSalones],
      pax: form.pax === '' ? null : Number(form.pax),
      servicios,
      notas: form.notas.trim(),
      vendedorId: form.vendedorId || null,
    };
    setSaving(true);
    try {
      if (editing) {
        // El estado ya no se envía (es derivado del calendario). El vendedor no
        // puede cambiar nada vía este endpoint — solo recepción/admin editan el lead.
        await api.patch(`/api/posibles-ventas/${editing.id}`, payload);
        toast.success('Evento asignado actualizado correctamente');
      } else {
        await api.post('/api/posibles-ventas', payload);
        toast.success('Evento asignado registrado. Se notificó al vendedor asignado.');
      }
      setModalOpen(false);
      loadLeads();
    } catch (err) {
      await swalError('No se pudo guardar', err.message || 'Ocurrió un error inesperado al guardar el evento asignado.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (lead) => {
    const result = await swalConfirmDelete(lead.nombreCliente);
    if (!result.isConfirmed) return;
    try {
      await api.delete(`/api/posibles-ventas/${lead.id}`);
      toast.success('Evento asignado eliminado');
      loadLeads();
    } catch (err) {
      await swalError('No se pudo eliminar', err.message || 'Ocurrió un error inesperado al eliminar.');
    }
  };

  const filteredLeads = useMemo(() => {
    let items = leads;
    if (estadoFilter !== 'all') {
      items = items.filter(l => l.estado === estadoFilter);
    }
    if (search) {
      const term = search.toLowerCase();
      items = items.filter(l =>
        (l.nombreCliente || '').toLowerCase().includes(term) ||
        (l.telefono || '').toLowerCase().includes(term) ||
        (l.vendedorNombre || '').toLowerCase().includes(term) ||
        (l.salones || []).some(s => String(s).toLowerCase().includes(term))
      );
    }
    return items;
  }, [leads, estadoFilter, search]);

  const stats = useMemo(() => {
    const byEstado = { pendiente: 0, en_proceso: 0, ganada: 0, perdida: 0 };
    const porVendedor = new Map();
    let sinSeguimiento = 0;
    let eventosAsignados = 0;
    let sinAsignar = 0;
    for (const l of leads) {
      const estado = ESTADO_MAP[l.estado] ? l.estado : 'pendiente';
      byEstado[estado] += 1;
      if (!l.ultimoSeguimientoEn) sinSeguimiento += 1;
      const hasVendor = l.vendedorId !== null && l.vendedorId !== undefined && l.vendedorId !== '';
      if (hasVendor) eventosAsignados += 1;
      else sinAsignar += 1;
      const vid = l.vendedorId || '__sin_asignar__';
      if (!porVendedor.has(vid)) {
        porVendedor.set(vid, {
          vendedorId: l.vendedorId,
          nombre: l.vendedorNombre || 'Sin asignar',
          total: 0, pendiente: 0, en_proceso: 0, ganada: 0, perdida: 0,
          totalRespMs: 0, nConSeguimiento: 0,
        });
      }
      const row = porVendedor.get(vid);
      row.total += 1;
      row[estado] += 1;
      // Tiempo al PRIMER seguimiento: creadoEn → primer cambio de estado del vendedor
      if (l.primerSeguimientoEn && l.creadoEn) {
        const t = new Date(String(l.primerSeguimientoEn).replace(' ', 'T')).getTime()
          - new Date(String(l.creadoEn).replace(' ', 'T')).getTime();
        if (Number.isFinite(t) && t >= 0) {
          row.totalRespMs += t;
          row.nConSeguimiento += 1;
        }
      }
    }
    const total = leads.length;
    const pctOf = (key) => (total > 0 ? Math.round((byEstado[key] / total) * 100) : 0);
    const conversion = total > 0 ? Math.round((byEstado.ganada / total) * 100) : 0;
    const pctAsignados = total > 0 ? Math.round((eventosAsignados / total) * 100) : 0;
    const vendedoresRows = [...porVendedor.values()]
      .map(r => ({
        ...r,
        pctConversion: r.total > 0 ? Math.round((r.ganada / r.total) * 100) : 0,
        respuestaPromedioMs: r.nConSeguimiento > 0 ? Math.round(r.totalRespMs / r.nConSeguimiento) : null,
      }))
      .sort((a, b) => b.total - a.total || b.ganada - a.ganada);
    return { total, byEstado, pctOf, conversion, sinSeguimiento, eventosAsignados, sinAsignar, pctAsignados, vendedoresRows };
  }, [leads]);

  const userName = (id) => {
    const u = (users || []).find(x => String(x.id) === String(id));
    return u ? (u.fullName || u.name) : null;
  };

  const canEditLead = (lead) => {
    if (isAdmin) return true;
    if (userRole === 'vendedor') return String(lead.vendedorId || '') === String(currentUser?.id || '');
    return String(lead.creadoPorId || '') === String(currentUser?.id || '');
  };

  const canDeleteLead = (lead) => {
    if (isAdmin) return true;
    return String(lead.creadoPorId || '') === String(currentUser?.id || '');
  };

  const inputStyle = {
    padding: '10px 12px', borderRadius: '8px', border: '2px solid #e2e8f0',
    fontSize: '13px', background: '#fff', color: '#1e293b', outline: 'none',
    boxSizing: 'border-box', width: '100%',
  };

  return (
    <div className="pv-module-wrapper" style={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxSizing: 'border-box' }}>
      <div style={{
        display: 'flex', flexDirection: 'column', height: '100%', width: '100%', maxWidth: '1600px',
        margin: '0 auto', background: '#fff', borderRadius: '20px',
        border: '1px solid #d3e4fe', overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(15,23,42,0.04)',
      }}>

        {/* ── Hero header ── */}
        <div style={{
          padding: '20px 24px',
          background: 'linear-gradient(135deg, #f0fdfa 0%, #ffffff 60%, #f8fafc 100%)',
          borderBottom: '1px solid #e2e8f0',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '14px',
                background: 'linear-gradient(135deg, #14b8a6, #0f766e)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 14px rgba(20,184,166,0.35)',
                color: '#fff',
              }}>
                <Icon name="handshake" size={26} color="#fff" strokeWidth={2.2} />
              </div>
              <div>
                <h1 style={{ fontSize: '22px', fontWeight: 900, color: '#0f172a', margin: 0, lineHeight: 1.15, letterSpacing: '-0.01em' }}>
                  Eventos Asignados
                </h1>
                <p style={{ color: '#64748b', fontSize: '12.5px', margin: '3px 0 0', fontWeight: 600 }}>
                  Pipeline de leads y seguimiento comercial
                </p>
              </div>
            </div>
            {canCreate && (
              <button
                onClick={openCreate}
                style={{
                  background: 'linear-gradient(135deg, #14b8a6, #0f766e)',
                  color: '#fff', border: 'none', padding: '11px 20px', borderRadius: '12px',
                  fontWeight: 800, fontSize: '13px', cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(20,184,166,0.4)',
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  transition: 'transform 0.12s, box-shadow 0.12s',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(20,184,166,0.5)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 4px 14px rgba(20,184,166,0.4)'; }}
              >
                <span style={{ display: 'inline-flex' }}>
                  <Icon name="plus" size={16} color="#fff" strokeWidth={2.5} />
                </span>
                Nuevo evento asignado
              </button>
            )}
          </div>

          {/* Pipeline mini-chart */}
          {stats.total > 0 && (
            <div style={{ marginTop: '16px' }}>
              <div style={{
                display: 'flex', height: '10px', borderRadius: '999px', overflow: 'hidden',
                background: '#f1f5f9', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)',
              }}>
                {ESTADOS.map(e => stats.byEstado[e.key] > 0 && (
                  <div key={e.key}
                    title={`${e.label}: ${stats.byEstado[e.key]} (${stats.pctOf(e.key)}%)`}
                    style={{ width: `${(stats.byEstado[e.key] / stats.total) * 100}%`, background: e.color, transition: 'width 0.3s' }}
                  />
                ))}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 18px', marginTop: '8px' }}>
                {ESTADOS.map(e => (
                  <span key={e.key} style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: e.color }} />
                    {e.label}
                    <span style={{ color: '#94a3b8', fontWeight: 800 }}>{stats.byEstado[e.key]} · {stats.pctOf(e.key)}%</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Stat cards ── */}
        {vista === 'activas' && (
          <div style={{ padding: '16px 24px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '10px',
            }}>
              {STAT_CARDS.map(s => {
                let value, pct = null, extra = null;
                if (s.isTotal) {
                  value = stats.total;
                  extra = stats.sinSeguimiento > 0 ? `${stats.sinSeguimiento} sin seg.` : null;
                } else if (s.isRate) {
                  value = stats.conversion;
                  extra = `${stats.byEstado.ganada} ganadas`;
                } else if (s.key === 'sin_seguimiento') {
                  value = stats.sinSeguimiento;
                  pct = stats.total > 0 ? Math.round((stats.sinSeguimiento / stats.total) * 100) : null;
                } else if (s.key === 'eventos_asignados') {
                  value = stats.eventosAsignados;
                  pct = stats.pctAsignados;
                  extra = stats.sinAsignar > 0 ? `${stats.sinAsignar} sin asignar` : null;
                } else if (s.key === 'sin_asignar') {
                  value = stats.sinAsignar;
                  pct = stats.total > 0 ? Math.round((stats.sinAsignar / stats.total) * 100) : null;
                  extra = stats.eventosAsignados > 0 ? `${stats.eventosAsignados} asignados` : null;
                } else {
                  value = stats.byEstado[s.key] || 0;
                  pct = stats.pctOf(s.key);
                }
                return <StatCard key={s.key} stat={s} value={value} pct={pct} extra={extra} />;
              })}
            </div>
          </div>
        )}

        {/* ── Toolbar: toggle de vista + quick filters + search ── */}
        <div style={{ padding: '14px 24px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
            {isAdmin ? (
              <ViewSegmented value={vista} onChange={setVista} adminCount={eliminadas.length} />
            ) : <div />}
            <div style={{ display: 'flex', gap: '8px', flex: '1 1 280px', maxWidth: '420px' }}>
              <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
                <span style={{ position: 'absolute', left: '12px', display: 'inline-flex', pointerEvents: 'none' }}>
                  <Icon name="search" size={15} color="#94a3b8" strokeWidth={2.3} />
                </span>
                <input
                  type="text"
                  placeholder={vista === 'activas' ? 'Buscar cliente, teléfono, salón, vendedor...' : 'Buscar en eliminadas...'}
                  value={search} onChange={e => setSearch(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 14px 10px 36px', borderRadius: '10px',
                    border: '2px solid #e2e8f0', fontSize: '13px', height: '40px',
                    boxSizing: 'border-box', background: '#fff', color: '#1e293b', outline: 'none',
                  }}
                />
              </div>
            </div>
          </div>
          {vista === 'activas' && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
              <QuickFilterChip
                active={estadoFilter === 'all'}
                count={stats.total}
                label="Todos"
                color="#0f172a"
                onClick={() => setEstadoFilter('all')}
              />
              {ESTADOS.map(e => (
                <QuickFilterChip
                  key={e.key}
                  active={estadoFilter === e.key}
                  count={stats.byEstado[e.key] || 0}
                  label={e.label}
                  color={e.color}
                  onClick={() => setEstadoFilter(e.key)}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Eventos Asignados por vendedor (solo en vista activas) ── */}
        {vista === 'activas' && stats.vendedoresRows.length > 0 && (
          <div style={{ padding: '14px 24px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: '26px', height: '26px', borderRadius: '8px',
                background: '#f0fdfa',
              }}>
                <Icon name="handshake" size={15} color="#0f766e" strokeWidth={2.3} />
              </span>
              <span style={{ fontSize: '13.5px', fontWeight: 800, color: '#0f172a' }}>Eventos Asignados</span>
              <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>· {stats.eventosAsignados} {stats.eventosAsignados === 1 ? 'evento' : 'eventos'} con vendedor · {stats.sinAsignar > 0 ? `${stats.sinAsignar} sin asignar` : 'todos asignados'}</span>
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '8px',
            }}>
              {stats.vendedoresRows.map(r => <VendedorCard key={r.vendedorId || '__sin_asignar__'} row={r} />)}
            </div>
          </div>
        )}

        {/* ── Lista: activas o eliminadas ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px 24px' }}>
          {vista === 'activas' ? (
            loading ? (
              <div style={{ textAlign: 'center', color: '#94a3b8', padding: '40px', fontSize: '13px' }}>
                <div style={{ display: 'inline-flex', marginBottom: '8px' }}>
                  <Icon name="loader" size={32} color="#94a3b8" className="pv-spin" strokeWidth={2} />
                </div>
                <div>Cargando eventos asignados...</div>
              </div>
            ) : filteredLeads.length === 0 ? (
              <div style={{
                textAlign: 'center', color: '#94a3b8', padding: '60px 20px',
                border: '2px dashed #e2e8f0', borderRadius: '16px',
              }}>
                <div style={{ display: 'inline-flex', marginBottom: '10px', color: '#cbd5e1' }}>
                  <Icon name={canCreate ? 'handshake' : 'inbox'} size={48} strokeWidth={1.5} />
                </div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: '#64748b' }}>
                  {canCreate ? 'Aún no hay eventos asignados registrados' : 'No tienes eventos asignados'}
                </div>
                {canCreate && (
                  <div style={{ fontSize: '12.5px', color: '#94a3b8', marginTop: '6px' }}>
                    Captura los datos del cliente y asigna un vendedor
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {filteredLeads.map(lead => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    userName={userName}
                    canEdit={canEditLead(lead)}
                    canDelete={canDeleteLead(lead)}
                    onEdit={() => openEdit(lead)}
                    onDelete={() => handleDelete(lead)}
                    onConvert={() => navigate(`/nueva-reserva?date=${lead.fechaEvento || ''}&pv=${lead.id}`)}
                    onVerReserva={() => navigate(`/reserva/${lead.eventoId}`)}
                  />
                ))}
              </div>
            )
          ) : (
            // Vista: eliminadas
            loadingEliminadas ? (
              <div style={{ textAlign: 'center', color: '#94a3b8', padding: '40px', fontSize: '13px' }}>
                <div style={{ display: 'inline-flex', marginBottom: '8px' }}>
                  <Icon name="loader" size={32} color="#94a3b8" className="pv-spin" strokeWidth={2} />
                </div>
                <div>Cargando eliminadas...</div>
              </div>
            ) : eliminadas.length === 0 ? (
              <div style={{
                textAlign: 'center', color: '#94a3b8', padding: '60px 20px',
                border: '2px dashed #fecaca', borderRadius: '16px', background: '#fef2f20d',
              }}>
                <div style={{ display: 'inline-flex', marginBottom: '10px', color: '#fca5a5' }}>
                  <Icon name="trash" size={48} strokeWidth={1.5} />
                </div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: '#64748b' }}>
                  No hay eventos asignados eliminados
                </div>
                <div style={{ fontSize: '12.5px', color: '#94a3b8', marginTop: '6px' }}>
                  Si eliminas un evento asignado, aparecerá acá para poder restaurarlo.
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {eliminadas
                  .filter(lead => {
                    if (!search) return true;
                    const term = search.toLowerCase();
                    return (lead.nombreCliente || '').toLowerCase().includes(term) ||
                      (lead.vendedorNombre || '').toLowerCase().includes(term) ||
                      (lead.deletedPorNombre || '').toLowerCase().includes(term);
                  })
                  .map(lead => (
                    <DeletedLeadCard
                      key={lead.id}
                      lead={lead}
                      restoring={restoringId === lead.id}
                      onRestore={() => handleRestore(lead)}
                    />
                  ))}
              </div>
            )
          )}
        </div>
      </div>

      {/* ── Modal crear/editar ── */}
      {modalOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)',
          zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
        }} onClick={() => setModalOpen(false)}>
          <div style={{
            background: '#fff', borderRadius: '20px', width: 'min(640px, 96vw)', maxHeight: '92vh',
            overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.3)', padding: '24px',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  {editing ? 'Editar evento asignado' : 'Nuevo evento asignado'}
                </h2>
                <p style={{ fontSize: '12px', color: '#94a3b8', margin: '2px 0 0', fontWeight: 600 }}>
                  {editing ? 'Modifica los datos del lead' : 'Captura los datos del cliente y asígnale un vendedor'}
                </p>
              </div>
              <button onClick={() => setModalOpen(false)}
                style={{ background: '#f1f5f9', border: 'none', width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer', color: '#64748b', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="x" size={18} color="#64748b" strokeWidth={2.3} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <label style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>Nombre del cliente *</span>
                <input value={form.nombreCliente} onChange={e => setForm({ ...form, nombreCliente: e.target.value })}
                  disabled={editing && userRole === 'vendedor'}
                  style={inputStyle} placeholder="Nombre del cliente" />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>Teléfono</span>
                <input value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })}
                  disabled={editing && userRole === 'vendedor'} style={inputStyle} placeholder="Teléfono de contacto" />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>Correo</span>
                <input type="email" value={form.correo} onChange={e => setForm({ ...form, correo: e.target.value })}
                  disabled={editing && userRole === 'vendedor'} style={inputStyle} placeholder="correo@ejemplo.com" />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>Fecha del evento</span>
                <input type="date" value={form.fechaEvento} onChange={e => setForm({ ...form, fechaEvento: e.target.value })}
                  disabled={editing && userRole === 'vendedor'} style={inputStyle} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>Nº de personas (pax)</span>
                <input type="number" min="0" value={form.pax} onChange={e => setForm({ ...form, pax: e.target.value })}
                  disabled={editing && userRole === 'vendedor'} style={inputStyle} placeholder="0" />
              </label>
            </div>

            <div style={{ marginTop: '14px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '6px' }}>Salones</span>
              <MultiSelect
                selected={formSalones}
                onChange={setFormSalones}
                options={(salones || []).map(s => ({ value: s, label: s }))}
                placeholder="Salones"
                emptyLabel="Sin salón seleccionado"
                searchable
                width={280}
              />
            </div>

            <div style={{ marginTop: '14px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '6px' }}>Tipos de servicios requeridos</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                {SERVICIOS_FIJOS.map(sv => {
                  const active = formServicios.has(sv);
                  return (
                    <button key={sv} type="button" onClick={() => {
                      setFormServicios(prev => {
                        const next = new Set(prev);
                        if (next.has(sv)) next.delete(sv); else next.add(sv);
                        return next;
                      });
                    }}
                      style={{
                        padding: '6px 12px', borderRadius: '999px', border: active ? '1px solid #0f766e' : '1px solid #e2e8f0',
                        background: active ? '#ccfbf1' : '#fff', color: active ? '#0f766e' : '#475569',
                        fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                      }}>
                      {sv}
                    </button>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input value={customServicio}
                  onChange={e => setCustomServicio(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomServicio(); } }}
                  style={{ ...inputStyle, flex: 1 }} placeholder="Otros servicios (Enter para agregar)" />
                <button type="button" onClick={addCustomServicio}
                  style={{ padding: '0 14px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', fontWeight: 700, color: '#475569', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="plus" size={14} color="#475569" strokeWidth={2.5} />
                </button>
              </div>
              {[...formServicios].filter(s => !SERVICIOS_FIJOS.includes(s)).length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '8px' }}>
                  {[...formServicios].filter(s => !SERVICIOS_FIJOS.includes(s)).map((s, i) => (
                    <span key={i} style={{ fontSize: '10px', fontWeight: 700, color: '#0369a1', padding: '2px 9px', borderRadius: '999px', background: '#e0f2fe', border: '1px solid #bae6fd' }}>
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '14px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>Notas</span>
              <textarea value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })}
                disabled={editing && userRole === 'vendedor'}
                rows={3} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} placeholder="Detalles adicionales del requerimiento" />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '14px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>
                {isReception || isAdmin ? 'Vendedor asignado' : 'Vendedor'}
              </span>
              <select value={form.vendedorId} onChange={e => setForm({ ...form, vendedorId: e.target.value })}
                disabled={editing && userRole === 'vendedor'} style={inputStyle}>
                <option value="">— Sin asignar —</option>
                {vendedores.map(v => (
                  <option key={v.id} value={v.id}>{v.fullName || v.name}</option>
                ))}
              </select>
            </label>

            {editing && (
              <div style={{
                marginTop: '14px', padding: '10px 12px', borderRadius: '10px',
                background: '#f8fafc', border: '1px solid #e2e8f0',
                display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
              }}>
                <Icon name="lock" size={14} color="#94a3b8" strokeWidth={2.5} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
                  <span style={{ fontSize: '12px', fontWeight: 800, color: '#475569' }}>
                    Estado: <EstadoPill estado={editing.estado} />
                  </span>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                    Se calcula solo: depende del estatus del evento en el calendario y de la fecha.
                  </span>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button onClick={() => setModalOpen(false)}
                style={{ padding: '10px 18px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontWeight: 700, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving}
                style={{
                  padding: '10px 22px', borderRadius: '10px', border: 'none',
                  background: 'linear-gradient(135deg, #14b8a6, #0f766e)', color: '#fff',
                  fontWeight: 800, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1,
                }}>
                {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Registrar y notificar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 99px; }
        ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        @media (max-width: 640px) {
          .pv-module-wrapper { padding: 10px !important; }
        }
        @keyframes pv-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .pv-spin { animation: pv-spin 1s linear infinite; transform-origin: center; }
        /* SweetAlert2 — estilos personalizados para el módulo */
        .pv-swal-title {
          font-size: 20px !important;
          font-weight: 800 !important;
          color: #0f172a !important;
        }
        .pv-swal-html {
          font-size: 14px !important;
          color: #475569 !important;
          line-height: 1.5 !important;
          margin-top: 4px !important;
        }
        .pv-swal-confirm, .pv-swal-cancel {
          font-size: 13px !important;
          font-weight: 700 !important;
          padding: 10px 18px !important;
          border-radius: 10px !important;
          border: none !important;
          cursor: pointer !important;
          margin: 0 6px !important;
          transition: transform 0.12s, box-shadow 0.12s !important;
        }
        .pv-swal-confirm {
          background: linear-gradient(135deg, #14b8a6, #0f766e) !important;
          color: #fff !important;
          box-shadow: 0 3px 10px rgba(20,184,166,0.35) !important;
        }
        .pv-swal-confirm:hover {
          transform: translateY(-1px) !important;
          box-shadow: 0 5px 14px rgba(20,184,166,0.45) !important;
        }
        .pv-swal-cancel {
          background: #fff !important;
          color: #475569 !important;
          border: 1.5px solid #e2e8f0 !important;
        }
        .pv-swal-cancel:hover {
          background: #f8fafc !important;
          border-color: #cbd5e1 !important;
        }
      `}</style>
    </div>
  );
}
