import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useOutletContext, useNavigate, useSearchParams } from 'react-router-dom';
import Swal from 'sweetalert2';
import {
  Handshake, ClipboardList, Clock, Eye, Trophy, XCircle,
  TrendingUp, AlertTriangle, Calendar, MapPin, Users, Phone,
  Mail, RefreshCw, Link as LinkIcon, RotateCcw, Trash2, Pencil,
  Search, Loader2, Inbox, BarChart3, Plus, X, ChevronDown, ChevronUp, Lock,
} from 'lucide-react';
import api from '../../services/api';
import authService from '../../services/authService';
import MultiSelect from '../reports/components/MultiSelect';
import { useToast } from '../informes/context/ToastContext';

// ─── Wrapper de iconos minimalistas con color ─────────────────
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
  chevronUp: ChevronUp,
  lock: Lock,
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
  background: '#ffffff',
  color: '#0f172a',
  customClass: {
    popup: 'pv-swal-popup',
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

// ─── Componentes auxiliares ─────────────────────────────────

function MetricMiniCard({ icon, label, value, subtitle, color, bg, border, iconBg, iconBorder }) {
  return (
    <div style={{
      background: bg || '#ffffff',
      border: `1px solid ${border || '#e2e8f0'}`,
      borderRadius: '10px',
      padding: '6px 12px',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      minWidth: '135px',
      flex: '1 1 auto',
      boxSizing: 'border-box',
    }}>
      <div style={{
        width: '32px',
        height: '32px',
        borderRadius: '8px',
        background: iconBg || '#f8fafc',
        border: `1px solid ${iconBorder || border || '#cbd5e1'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon name={icon} size={15} color={color} strokeWidth={2.3} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, lineHeight: 1.15 }}>
        <span style={{ fontSize: '9.5px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {label}
        </span>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginTop: '2px' }}>
          <span style={{ fontSize: '15px', fontWeight: 900, color: color || '#0f172a' }}>
            {value}
          </span>
          {subtitle && (
            <span style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap' }}>
              {subtitle}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function EstadoPill({ estado, size = 'md' }) {
  const est = ESTADO_MAP[estado] || ESTADO_MAP.pendiente;
  const padding = size === 'lg' ? '4px 12px' : '2px 8px';
  const fontSize = size === 'lg' ? '11.5px' : '10.5px';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
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
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        padding: '5px 12px', borderRadius: '999px',
        border: active ? `1.5px solid ${color}` : '1px solid #cbd5e1',
        background: active ? `${color}15` : '#ffffff',
        color: active ? color : '#475569',
        fontSize: '12px', fontWeight: 700, cursor: 'pointer',
        transition: 'all 0.12s',
      }}
    >
      {label}
      <span style={{
        background: active ? color : '#f1f5f9',
        color: active ? '#ffffff' : '#64748b',
        padding: '1px 6px', borderRadius: '999px',
        fontSize: '10.5px', fontWeight: 800, minWidth: '18px', textAlign: 'center',
      }}>{count}</span>
    </button>
  );
}

function ViewSegmented({ value, onChange, adminCount }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center',
      background: '#f1f5f9', borderRadius: '10px', padding: '3px',
      border: '1px solid #cbd5e1',
    }}>
      <button
        onClick={() => onChange('activas')}
        style={{
          padding: '5px 14px', borderRadius: '7px', border: 'none',
          background: value === 'activas' ? '#ffffff' : 'transparent',
          color: value === 'activas' ? '#0f172a' : '#64748b',
          fontWeight: value === 'activas' ? 800 : 600,
          fontSize: '12px', cursor: 'pointer',
          boxShadow: value === 'activas' ? '0 1px 3px rgba(15,23,42,0.08)' : 'none',
          transition: 'all 0.12s',
          display: 'inline-flex', alignItems: 'center', gap: '5px',
        }}
      >
        <Icon name="clipboard" size={13} color={value === 'activas' ? '#0f172a' : '#64748b'} strokeWidth={2.3} />
        Activas
      </button>
      <button
        onClick={() => onChange('eliminadas')}
        style={{
          padding: '5px 14px', borderRadius: '7px', border: 'none',
          background: value === 'eliminadas' ? '#ffffff' : 'transparent',
          color: value === 'eliminadas' ? '#dc2626' : '#64748b',
          fontWeight: value === 'eliminadas' ? 800 : 600,
          fontSize: '12px', cursor: 'pointer',
          boxShadow: value === 'eliminadas' ? '0 1px 3px rgba(220,38,38,0.15)' : 'none',
          transition: 'all 0.12s',
          display: 'inline-flex', alignItems: 'center', gap: '5px',
        }}
      >
        <Icon name="trash" size={13} color={value === 'eliminadas' ? '#dc2626' : '#64748b'} strokeWidth={2.3} />
        Eliminadas
        {adminCount > 0 && (
          <span style={{
            background: '#dc2626', color: '#ffffff',
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
      display: 'flex', background: '#ffffff',
      border: '1px solid #fecaca', borderRadius: '12px',
      overflow: 'hidden', opacity: 0.95,
    }}>
      <div style={{ width: '4px', background: '#dc2626', flexShrink: 0 }} />
      <div style={{ flex: 1, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{
            width: '34px', height: '34px', borderRadius: '50%',
            background: '#fef2f2', color: '#dc2626',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: '13px', flexShrink: 0,
          }}>
            {(lead.nombreCliente || '?').trim().charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '14.5px', fontWeight: 800, color: '#0f172a' }}>{lead.nombreCliente}</span>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                fontSize: '10.5px', fontWeight: 800, color: '#dc2626',
                padding: '2px 8px', borderRadius: '999px',
                background: '#fef2f2', border: '1px solid #fecaca',
              }}>
                <Icon name="trash" size={11} color="#dc2626" strokeWidth={2.5} />
                Eliminada
              </span>
              {lead.estado && (
                <EstadoPill estado={lead.estado} />
              )}
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              {lead.vendedorNombre ? (
                <>
                  <Icon name="users" size={12} color="#94a3b8" strokeWidth={2.2} />
                  {lead.vendedorNombre}
                </>
              ) : (
                <>
                  <Icon name="alertTriangle" size={12} color="#d97706" strokeWidth={2.3} />
                  Sin vendedor asignado
                </>
              )}
            </div>
          </div>
        </div>

        {(lead.fechaEvento || (lead.salones || []).length > 0 || lead.pax) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 12px', fontSize: '11.5px', color: '#334155', fontWeight: 600 }}>
            {lead.fechaEvento && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Icon name="calendar" size={13} color="#94a3b8" strokeWidth={2.2} />
                {lead.fechaEvento}
              </span>
            )}
            {(lead.salones || []).length > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Icon name="mapPin" size={13} color="#94a3b8" strokeWidth={2.2} />
                {(lead.salones || []).join(', ')}
              </span>
            )}
            {lead.pax ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Icon name="users" size={13} color="#94a3b8" strokeWidth={2.2} />
                {lead.pax} pax
              </span>
            ) : null}
          </div>
        )}

        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexWrap: 'wrap', gap: '8px', paddingTop: '4px',
          borderTop: '1px dashed #fecaca',
        }}>
          <div style={{ fontSize: '11px', color: '#7f1d1d', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <Icon name="trash" size={12} color="#7f1d1d" strokeWidth={2.3} />
            Eliminada {lead.deletedAt ? `el ${new Date(String(lead.deletedAt).replace(' ', 'T')).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}
            {lead.deletedPorNombre ? ` por ${lead.deletedPorNombre}` : ''}
          </div>
          <button
            onClick={onRestore}
            disabled={restoring}
            style={{
              fontSize: '11.5px', fontWeight: 800, padding: '6px 12px', borderRadius: '7px',
              border: '1.5px solid #0f766e', background: restoring ? '#a7f3d0' : '#ccfbf1',
              color: '#0f766e', cursor: restoring ? 'default' : 'pointer',
              whiteSpace: 'nowrap', opacity: restoring ? 0.7 : 1,
              display: 'inline-flex', alignItems: 'center', gap: '5px',
            }}
          >
            {restoring ? (
              <>
                <Icon name="loader" size={12} color="#0f766e" className="pv-spin" strokeWidth={2.3} />
                Restaurando...
              </>
            ) : (
              <>
                <Icon name="rotateCcw" size={12} color="#0f766e" strokeWidth={2.3} />
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
      background: '#ffffff', border: `1px solid ${isSinAsignar ? '#fde68a' : '#cbd5e1'}`, borderRadius: '10px',
      padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '10px',
    }}>
      <div style={{
        width: '32px', height: '32px', borderRadius: '50%',
        background: isSinAsignar ? '#fef3c7' : `hsl(${hue}, 65%, 88%)`,
        color: isSinAsignar ? '#b45309' : `hsl(${hue}, 50%, 35%)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 800, fontSize: '13px', flexShrink: 0,
      }}>
        {isSinAsignar ? (
          <Icon name="alertTriangle" size={16} color="#b45309" strokeWidth={2.4} />
        ) : initial}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '12.5px', fontWeight: 800, color: '#0f172a', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {row.nombre}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '3px',
            fontSize: '10.5px', fontWeight: 800, color: isSinAsignar ? '#b45309' : '#0f766e',
            padding: '2px 7px', borderRadius: '999px',
            background: isSinAsignar ? '#fef3c7' : '#f0fdfa',
            border: `1px solid ${isSinAsignar ? '#fde68a' : '#99f6e4'}`,
          }}>
            <Icon name={isSinAsignar ? 'inbox' : 'handshake'} size={10} color={isSinAsignar ? '#b45309' : '#0f766e'} strokeWidth={2.4} />
            Asignados: {row.total}
          </span>
          <span style={{ fontSize: '10.5px', color: '#d97706', fontWeight: 700 }}>{row.pendiente} pend.</span>
          <span style={{ fontSize: '10.5px', color: '#047857', fontWeight: 700 }}>{row.ganada} gan.</span>
          <span style={{ fontSize: '10.5px', color: '#b91c1c', fontWeight: 700 }}>{row.perdida} perd.</span>
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: 900, color: convColor }}>{row.pctConversion}%</div>
        <div
          style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '3px' }}
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

function LeadCard({ lead, userName, canEdit, canDelete, canSendMessage, onEdit, onDelete, onConvert, onVerReserva, onSendMessage }) {
  const est = ESTADO_MAP[lead.estado] || ESTADO_MAP.pendiente;
  const servicios = parseServicios(lead.servicios);
  return (
    <div style={{
      display: 'flex',
      background: '#ffffff',
      border: '1px solid #cbd5e1',
      borderRadius: '12px',
      overflow: 'hidden',
      transition: 'border-color 0.15s, box-shadow 0.15s',
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = '#94a3b8'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(15,23,42,0.06)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      {/* Barra lateral con color del estado */}
      <div style={{ width: '4px', background: est.color, flexShrink: 0 }} />

      <div style={{ flex: 1, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0 }}>
        {/* Cabecera: avatar + cliente + estado + vendedor */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{
            width: '34px', height: '34px', borderRadius: '50%',
            background: `${est.color}15`, color: est.color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: '13.5px', flexShrink: 0,
          }}>
            {(lead.nombreCliente || '?').trim().charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>{lead.nombreCliente}</span>
              <EstadoPill estado={lead.estado} />
              {lead.eventoId && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  fontSize: '10.5px', fontWeight: 700, color: '#0f766e',
                  padding: '2px 8px', borderRadius: '999px',
                  background: '#ccfbf1', border: '1px solid #5eead4',
                }}>
                  <Icon name="link" size={11} color="#0f766e" strokeWidth={2.5} />
                  Vinculada
                </span>
              )}
            </div>
            {lead.vendedorNombre ? (
              <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Icon name="users" size={12} color="#64748b" strokeWidth={2.2} />
                Vendedor: <strong>{lead.vendedorNombre}</strong>
              </div>
            ) : (
              <div style={{ fontSize: '11px', color: '#d97706', marginTop: '2px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Icon name="alertTriangle" size={12} color="#d97706" strokeWidth={2.3} />
                Sin vendedor asignado
              </div>
            )}
          </div>
        </div>

        {/* Info del evento */}
        {(lead.fechaEvento || (lead.salones || []).length > 0 || lead.pax || lead.telefono || lead.correo) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', fontSize: '11.5px', color: '#334155', fontWeight: 600 }}>
            {lead.fechaEvento && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Icon name="calendar" size={13} color="#64748b" strokeWidth={2.2} />
                {lead.fechaEvento}
              </span>
            )}
            {(lead.salones || []).length > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Icon name="mapPin" size={13} color="#64748b" strokeWidth={2.2} />
                {(lead.salones || []).join(', ')}
              </span>
            )}
            {lead.pax ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Icon name="users" size={13} color="#64748b" strokeWidth={2.2} />
                {lead.pax} pax
              </span>
            ) : null}
            {lead.telefono && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Icon name="phone" size={13} color="#64748b" strokeWidth={2.2} />
                {lead.telefono}
              </span>
            )}
            {lead.correo && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Icon name="mail" size={13} color="#64748b" strokeWidth={2.2} />
                {lead.correo}
              </span>
            )}
          </div>
        )}

        {/* Servicios */}
        {servicios.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {servicios.map((s, i) => (
              <span key={i} style={{
                fontSize: '10px', fontWeight: 700, color: '#0c4a6e',
                padding: '2px 8px', borderRadius: '999px',
                background: '#f0f9ff', border: '1px solid #bae6fd',
              }}>{s}</span>
            ))}
          </div>
        )}

        {/* Notas */}
        {lead.notas && (
          <div style={{
            fontSize: '11.5px', color: '#475569', lineHeight: 1.4,
            background: '#f8fafc', borderRadius: '6px',
            padding: '6px 10px', borderLeft: `3px solid ${est.color}`,
          }}>{lead.notas}</div>
        )}

        {/* Footer: seguimiento + acciones */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexWrap: 'wrap', gap: '8px', paddingTop: '4px',
          borderTop: '1px dashed #e2e8f0',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {lead.ultimoSeguimientoEn ? (
              <span style={{ fontSize: '11px', color: '#475569', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Icon name="refresh" size={12} color="#64748b" strokeWidth={2.3} />
                Seg: {formatFechaCorta(lead.ultimoSeguimientoEn)} ({formatTiempoTranscurrido(lead.ultimoSeguimientoEn)})
              </span>
            ) : (
              <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Icon name="alertTriangle" size={12} color="#dc2626" strokeWidth={2.3} />
                Sin seguimiento ({formatTiempoTranscurrido(lead.creadoEn)})
              </span>
            )}
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
              · {userName(lead.creadoPorId) || lead.creadoPorNombre || '—'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            {lead.eventoId ? (
              <button onClick={onVerReserva} title="Abrir la reserva vinculada" style={btnAction('#0f766e', '#ccfbf1', '#5eead4')}>
                <Icon name="link" size={12} color="#0f766e" strokeWidth={2.3} />
                Ver reserva
              </button>
            ) : (
              <button onClick={onConvert} title="Convertir en reserva del calendario" style={btnAction('#0f766e', '#ccfbf1', '#5eead4')}>
                <Icon name="calendar" size={12} color="#0f766e" strokeWidth={2.3} />
                Convertir
              </button>
            )}
            {canSendMessage && (
              <button
                onClick={onSendMessage}
                title="Enviar mensaje recordatorio al vendedor"
                style={btnAction('#7c3aed', '#ede9fe', '#c4b5fd')}
              >
                <Icon name="mail" size={12} color="#7c3aed" strokeWidth={2.3} />
                Mensaje
              </button>
            )}
            {canEdit && (
              <button onClick={onEdit} title="Editar" style={{ ...btnAction('#475569', '#ffffff', '#cbd5e1'), width: '30px', padding: 0 }}>
                <Icon name="pencil" size={12} color="#475569" strokeWidth={2.3} />
              </button>
            )}
            {canDelete && (
              <button onClick={onDelete} title="Eliminar" style={{ ...btnAction('#ef4444', '#ffffff', '#fecaca'), width: '30px', padding: 0 }}>
                <Icon name="trash" size={12} color="#ef4444" strokeWidth={2.3} />
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
    fontSize: '11.5px', fontWeight: 700, height: '30px', padding: '0 10px', borderRadius: '8px',
    border: `1.5px solid ${border}`, background: bg, color, cursor: 'pointer',
    whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
    boxSizing: 'border-box',
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

function formatTiempoTranscurrido(val) {
  const d = toDateObj(val);
  if (!d) return '0m';
  const diffMs = Date.now() - d.getTime();
  if (diffMs < 0) return '0m';
  const minTotales = Math.floor(diffMs / 60000);
  const dias = Math.floor(minTotales / (24 * 60));
  const horas = Math.floor((minTotales % (24 * 60)) / 60);
  const minutos = minTotales % 60;

  if (dias > 0) {
    return `${dias}d ${horas}h ${minutos}m`;
  } else if (horas > 0) {
    return `${horas}h ${minutos}m`;
  } else {
    return `${minutos}m`;
  }
}

// ─── Componente principal ─────────────────────────────────
export default function PosiblesVentasModule() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const outlet = useOutletContext() || {};
  const outletSalones = outlet?.salones;
  const outletUsers = outlet?.users;
  const salones = useMemo(() => (Array.isArray(outletSalones) ? outletSalones : []), [outletSalones]);
  const users = useMemo(() => (Array.isArray(outletUsers) ? outletUsers : []), [outletUsers]);

  const currentUser = authService.getCurrentUser();
  const userRole = String(currentUser?.role || '').trim().toLowerCase();
  const isAdmin = userRole === 'admin';
  const isCoordinator = userRole.includes('coordinad') || userRole === 'eventos';
  const canCreate = !isCoordinator;

  const vendedores = useMemo(() => {
    return (users || [])
      .filter(u => {
        const r = String(u.role || '').trim().toLowerCase();
        return r === 'vendedor' || r === 'admin';
      })
      .sort((a, b) => {
        const nameA = (a.fullName || a.name || a.nombre || '').trim();
        const nameB = (b.fullName || b.name || b.nombre || '').trim();
        return nameA.localeCompare(nameB, 'es', { sensitivity: 'base' });
      });
  }, [users]);

  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [vendedorFilter, setVendedorFilter] = useState(() => (isAdmin ? 'all' : 'mine'));
  const [estadoFilter, setEstadoFilter] = useState('all');
  const [showVendorSummary, setShowVendorSummary] = useState(false);
  const [focusedLeadId, setFocusedLeadId] = useState(() => searchParams.get('focus') || null);
  const focusTimerRef = useRef(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  // Soft delete UI (solo admin)
  const [vista, setVista] = useState('activas'); // 'activas' | 'eliminadas'
  const [eliminadas, setEliminadas] = useState([]);
  const [loadingEliminadas, setLoadingEliminadas] = useState(false);
  const [restoringId, setRestoringId] = useState(null);

  // Form state
  const [form, setForm] = useState({
    nombreCliente: '', telefono: '', correo: '', fechaEvento: '',
    pax: '', notas: '', vendedorId: '',
  });
  const [formSalones, setFormSalones] = useState(new Set());
  const [formServicios, setFormServicios] = useState(new Set());

  const loadLeads = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get('/api/posibles-ventas');
      setLeads(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error cargando posibles ventas:', err);
      toast.error('No se pudieron cargar las posibles ventas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLeads();

    const handleEntityChange = (e) => {
      const detail = e.detail || {};
      const entity = detail.entity || detail.table;
      if (!entity || entity === 'posible_venta' || entity === 'evento' || entity === 'evento_status') {
        loadLeads();
        if (vista === 'eliminadas' && isAdmin) {
          loadEliminadas();
        }
      }
    };

    window.addEventListener('entity:changed', handleEntityChange);
    return () => {
      window.removeEventListener('entity:changed', handleEntityChange);
    };
  }, [loadLeads, loadEliminadas, vista, isAdmin]);

  useEffect(() => {
    if (!focusedLeadId || loading || leads.length === 0) return;
    const el = document.getElementById(`pv-lead-${focusedLeadId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    const t = setTimeout(() => {
      setFocusedLeadId(null);
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        next.delete('focus');
        return next;
      }, { replace: true });
    }, 4000);
    return () => clearTimeout(t);
  }, [focusedLeadId, loading, leads.length, setSearchParams]);

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
    setFormServicios(new Set(parseServicios(lead.servicios)));
    setModalOpen(true);
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

  const leadsForVendorFilter = useMemo(() => {
    let items = leads;
    if (vendedorFilter === 'mine') {
      const myId = String(currentUser?.id || '');
      items = items.filter(l => String(l.vendedorId || '') === myId || String(l.creadoPorId || '') === myId);
    } else if (vendedorFilter !== 'all') {
      items = items.filter(l => String(l.vendedorId || '') === String(vendedorFilter));
    }
    return items;
  }, [leads, vendedorFilter, currentUser?.id]);

  const filteredLeads = useMemo(() => {
    let items = leadsForVendorFilter;
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
  }, [leadsForVendorFilter, estadoFilter, search]);

  const stats = useMemo(() => {
    const byEstado = { pendiente: 0, en_proceso: 0, ganada: 0, perdida: 0 };
    const porVendedor = new Map();
    let sinSeguimiento = 0;
    let eventosAsignados = 0;
    let sinAsignar = 0;
    for (const l of leadsForVendorFilter) {
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
      if (l.primerSeguimientoEn && l.creadoEn) {
        const t = new Date(String(l.primerSeguimientoEn).replace(' ', 'T')).getTime()
          - new Date(String(l.creadoEn).replace(' ', 'T')).getTime();
        if (Number.isFinite(t) && t >= 0) {
          row.totalRespMs += t;
          row.nConSeguimiento += 1;
        }
      }
    }
    const total = leadsForVendorFilter.length;
    const pctOf = (key) => (total > 0 ? Math.round((byEstado[key] / total) * 100) : 0);
    const conversion = total > 0 ? Math.round((byEstado.ganada / total) * 100) : 0;
    const pctAsignados = total > 0 ? Math.round((eventosAsignados / total) * 100) : 0;
    const vendedoresRows = [...porVendedor.values()]
      .map(r => ({
        ...r,
        pctConversion: r.total > 0 ? Math.round((r.ganada / r.total) * 100) : 0,
        respuestaPromedioMs: r.nConSeguimiento > 0 ? Math.round(r.totalRespMs / r.nConSeguimiento) : null,
      }))
      .sort((a, b) => {
        if (!a.vendedorId) return -1;
        if (!b.vendedorId) return 1;
        return a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' });
      });
    return { total, byEstado, pctOf, conversion, sinSeguimiento, eventosAsignados, sinAsignar, pctAsignados, vendedoresRows };
  }, [leadsForVendorFilter]);

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

  /**
   * Determina si el usuario actual puede enviar un mensaje recordatorio
   * al vendedor de este lead. Reglas:
   *  - El lead debe tener vendedor asignado.
   *  - El estado derivado no debe ser "ganada" (ya cerrado) ni "perdida" (cancelado).
   *  - Admin: puede siempre.
   *  - Recepcionista/frontoffice: sólo si él creó el lead.
   *  - Vendedor y coordinador: nunca.
   * Definición de "sin seguimiento" operativa (alineada con
   * `cleanupNotificacionesPorSeguimiento` y el filtro del GET del feature
   * anterior): no hay reserva ligada, o la reserva ligada NO está en
   * estado 'Seguimiento'. El estado derivado "pendiente" o "en_proceso"
   * implica sin seguimiento.
   */
  const canSendMessage = (lead) => {
    if (!lead || !lead.vendedorId) return false;
    if (lead.estado === 'ganada' || lead.estado === 'perdida') return false;
    if (isAdmin) return true;
    if (userRole === 'frontoffice' || userRole === 'recepcionista') {
      return String(lead.creadoPorId || '') === String(currentUser?.id || '');
    }
    return false;
  };

  /**
   * Abre el modal SweetAlert2 para escribir el mensaje al vendedor.
   * Al confirmar, hace POST y muestra toast. Loading state nativo via
   * `showLoaderOnConfirm` + `preConfirm` (mantiene el modal abierto
   * durante el envío y muestra el spinner en el botón).
   */
  const openSendMessage = async (lead) => {
    if (!lead) return;
    const vendedorNombre = lead.vendedorNombre || 'el vendedor';
    const safeVendedorNombre = String(vendedorNombre).replace(/[<>]/g, '');

    const result = await Swal.fire({
      ...swalBase,
      title: 'Enviar mensaje al vendedor',
      html: `
        <div class="pv-swal-pill">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="2" y="4" width="20" height="16" rx="2"></rect>
            <path d="m22 7-10 5L2 7"></path>
          </svg>
          Para: <strong>${safeVendedorNombre}</strong>
        </div>
        <div class="pv-swal-counter">0 / 500</div>
      `,
      input: 'textarea',
      inputPlaceholder: 'Escribe un recordatorio breve para el vendedor...',
      inputAttributes: {
        'aria-label': 'Mensaje para el vendedor',
        maxlength: '500',
        style: 'min-height: 96px; font-size: 13.5px;',
      },
      showCancelButton: true,
      confirmButtonText: 'Enviar mensaje',
      cancelButtonText: 'Cancelar',
      showLoaderOnConfirm: true,
      allowOutsideClick: () => !Swal.isLoading(),
      inputValidator: (value) => {
        const v = String(value || '').trim();
        if (!v) return 'El mensaje no puede estar vacío';
        if (v.length > 500) return 'El mensaje no puede exceder 500 caracteres';
        return null;
      },
      preConfirm: async (mensaje) => {
        const mensajeTrim = String(mensaje || '').trim();
        try {
          await api.post(`/api/posibles-ventas/${lead.id}/mensaje-vendedor`, { mensaje: mensajeTrim });
          return mensajeTrim;
        } catch (err) {
          const msg = err?.responseBody?.message || err?.message || 'No se pudo enviar el mensaje';
          Swal.showValidationMessage(msg);
          return false; // mantiene el modal abierto
        }
      },
      didOpen: () => {
        // Foco automático en el textarea + wiring del contador en vivo
        const ta = document.querySelector('.swal2-textarea');
        const counter = document.querySelector('.pv-swal-counter');
        if (ta) {
          ta.focus();
          if (counter) {
            const update = () => { counter.textContent = `${ta.value.length} / 500`; };
            ta.addEventListener('input', update);
            update();
          }
        }
      },
    });

    if (result.isConfirmed && result.value) {
      toast.success('Mensaje enviado al vendedor');
    }
  };

  const inputStyle = {
    padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1',
    fontSize: '13px', background: '#ffffff', color: '#0f172a', outline: 'none',
    boxSizing: 'border-box', width: '100%',
  };

  return (
    <div className="pv-module-wrapper" style={{ padding: '16px', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxSizing: 'border-box' }}>
      <div style={{
        display: 'flex', flexDirection: 'column', height: '100%', width: '100%', maxWidth: '1600px',
        margin: '0 auto', background: '#ffffff', borderRadius: '16px',
        border: '1px solid #cbd5e1', overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(15,23,42,0.04)',
      }}>

        {/* ── 1. COMPACT HERO HEADER + PIPELINE ── */}
        <div style={{
          padding: '14px 20px',
          background: 'linear-gradient(135deg, #f0fdfa 0%, #ffffff 60%, #f8fafc 100%)',
          borderBottom: '1px solid #cbd5e1',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '10px',
                background: 'linear-gradient(135deg, #14b8a6, #0f766e)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 3px 10px rgba(20,184,166,0.3)',
                color: '#ffffff',
              }}>
                <Icon name="handshake" size={22} color="#ffffff" strokeWidth={2.2} />
              </div>
              <div>
                <h1 style={{ fontSize: '19px', fontWeight: 900, color: '#0f172a', margin: 0, lineHeight: 1.15, letterSpacing: '-0.01em' }}>
                  Eventos Asignados
                </h1>
                <p style={{ color: '#64748b', fontSize: '11.5px', margin: '2px 0 0', fontWeight: 600 }}>
                  Pipeline de leads y seguimiento comercial
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {canCreate && (
                <button
                  onClick={openCreate}
                  style={{
                    background: 'linear-gradient(135deg, #14b8a6, #0f766e)',
                    color: '#ffffff', border: 'none', padding: '8px 16px', borderRadius: '8px',
                    fontWeight: 800, fontSize: '12.5px', cursor: 'pointer',
                    boxShadow: '0 3px 10px rgba(20,184,166,0.35)',
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    transition: 'transform 0.12s, box-shadow 0.12s',
                  }}
                >
                  <Icon name="plus" size={15} color="#ffffff" strokeWidth={2.5} />
                  Asignar evento
                </button>
              )}
            </div>
          </div>

          {/* Progress mini bar */}
          {stats.total > 0 && (
            <div style={{ marginTop: '10px' }}>
              <div style={{
                display: 'flex', height: '6px', borderRadius: '999px', overflow: 'hidden',
                background: '#e2e8f0',
              }}>
                {ESTADOS.map(e => stats.byEstado[e.key] > 0 && (
                  <div key={e.key}
                    title={`${e.label}: ${stats.byEstado[e.key]} (${stats.pctOf(e.key)}%)`}
                    style={{ width: `${(stats.byEstado[e.key] / stats.total) * 100}%`, background: e.color, transition: 'width 0.3s' }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── 2. UNIFIED METRICS STRIP (Mini Tarjetas KPIs en 1 sola fila) ── */}
        {vista === 'activas' && (
          <div style={{
            padding: '10px 20px',
            borderBottom: '1px solid #cbd5e1',
            background: '#f8fafc',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            overflowX: 'auto',
          }}>
            <MetricMiniCard
              icon="clipboard"
              label="TOTAL"
              value={stats.total}
              subtitle={`${stats.sinSeguimiento} sin seg.`}
              color="#0f172a"
              bg="#ffffff"
              border="#e2e8f0"
              iconBg="#f8fafc"
            />
            <MetricMiniCard
              icon="clock"
              label="PENDIENTE"
              value={stats.byEstado.pendiente}
              subtitle={`${stats.pctOf('pendiente')}%`}
              color="#d97706"
              bg="#ffffff"
              border="#fde68a"
              iconBg="#fffbeb"
            />
            <MetricMiniCard
              icon="eye"
              label="EN PROCESO"
              value={stats.byEstado.en_proceso}
              subtitle={`${stats.pctOf('en_proceso')}%`}
              color="#2563eb"
              bg="#ffffff"
              border="#bfdbfe"
              iconBg="#eff6ff"
            />
            <MetricMiniCard
              icon="trophy"
              label="GANADA"
              value={stats.byEstado.ganada}
              subtitle={`${stats.pctOf('ganada')}%`}
              color="#059669"
              bg="#ffffff"
              border="#a7f3d0"
              iconBg="#ecfdf5"
            />
            <MetricMiniCard
              icon="x"
              label="PERDIDA"
              value={stats.byEstado.perdida}
              subtitle={`${stats.pctOf('perdida')}%`}
              color="#dc2626"
              bg="#ffffff"
              border="#fecaca"
              iconBg="#fef2f2"
            />
            <MetricMiniCard
              icon="trendingUp"
              label="CONVERSIÓN"
              value={`${stats.conversion}%`}
              subtitle={`${stats.byEstado.ganada} ganadas`}
              color="#7c3aed"
              bg="#ffffff"
              border="#ddd6fe"
              iconBg="#f5f3ff"
            />
            <MetricMiniCard
              icon="handshake"
              label="EVENTOS ASIGNADOS"
              value={stats.eventosAsignados}
              subtitle={`${stats.pctAsignados}%`}
              color="#0f766e"
              bg="#ffffff"
              border="#99f6e4"
              iconBg="#f0fdfa"
            />
            <MetricMiniCard
              icon="alertTriangle"
              label="SIN ASIGNAR"
              value={stats.sinAsignar}
              subtitle={`${stats.total > 0 ? Math.round((stats.sinAsignar / stats.total) * 100) : 0}%`}
              color="#ca8a04"
              bg="#ffffff"
              border="#fef08a"
              iconBg="#fefce8"
            />
            {stats.sinSeguimiento > 0 && (
              <MetricMiniCard
                icon="alertTriangle"
                label="SIN SEGUIMIENTO"
                value={stats.sinSeguimiento}
                subtitle={`${stats.total > 0 ? Math.round((stats.sinSeguimiento / stats.total) * 100) : 0}%`}
                color="#dc2626"
                bg="#ffffff"
                border="#fecaca"
                iconBg="#fef2f2"
              />
            )}
          </div>
        )}

        {/* ── 3. CLEAN TOOLBAR ── */}
        <div style={{ padding: '10px 20px', borderBottom: '1px solid #e2e8f0', flexShrink: 0, background: '#ffffff' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', justifyContent: 'space-between' }}>
            {/* Filtros izquierdos */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
              {isAdmin && (
                <ViewSegmented value={vista} onChange={setVista} adminCount={eliminadas.length} />
              )}
              {vista === 'activas' && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
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

            {/* Vendedor + Buscador + Toggle Resumen Vendedor */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              {vista === 'activas' && stats.vendedoresRows.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowVendorSummary(v => !v)}
                  style={{
                    height: '34px', padding: '0 12px', borderRadius: '8px',
                    border: '1.5px solid #cbd5e1',
                    background: showVendorSummary ? '#e0f2fe' : '#ffffff',
                    color: showVendorSummary ? '#0284c7' : '#475569',
                    fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    transition: 'all 0.12s'
                  }}
                  title="Ver u ocultar resumen de eventos asignados por vendedor"
                >
                  <Icon name="users" size={14} color={showVendorSummary ? '#0284c7' : '#475569'} strokeWidth={2.3} />
                  <span>Vendedores ({stats.vendedoresRows.length})</span>
                  <Icon name={showVendorSummary ? 'chevronUp' : 'chevronDown'} size={14} color="#64748b" strokeWidth={2.3} />
                </button>
              )}

              <select
                value={vendedorFilter}
                onChange={e => setVendedorFilter(e.target.value)}
                style={{
                  height: '34px', padding: '0 10px', borderRadius: '8px',
                  border: '1.5px solid',
                  borderColor: vendedorFilter !== 'all' ? '#14b8a6' : '#cbd5e1',
                  fontSize: '12px', fontWeight: 700,
                  background: vendedorFilter !== 'all' ? '#f0fdfa' : '#ffffff',
                  color: vendedorFilter !== 'all' ? '#0f766e' : '#1e293b',
                  outline: 'none', cursor: 'pointer', flexShrink: 0,
                  maxWidth: '180px',
                }}
                title="Filtrar eventos por vendedor"
              >
                <option value="mine" style={{ background: '#ffffff', color: '#0f172a' }}>👤 Mis asignaciones</option>
                <option value="all" style={{ background: '#ffffff', color: '#0f172a' }}>👥 Todos los vendedores</option>
                {vendedores.length > 0 && (
                  <optgroup label="Vendedor específico">
                    {vendedores.map(v => (
                      <option key={v.id} value={v.id} style={{ background: '#ffffff', color: '#0f172a' }}>
                        {v.fullName || v.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>

              <div style={{ position: 'relative', minWidth: '220px', flex: 1, display: 'flex', alignItems: 'center' }}>
                <span style={{ position: 'absolute', left: '10px', display: 'inline-flex', pointerEvents: 'none' }}>
                  <Icon name="search" size={14} color="#94a3b8" strokeWidth={2.3} />
                </span>
                <input
                  type="text"
                  placeholder={vista === 'activas' ? 'Buscar cliente, teléfono, salón...' : 'Buscar en eliminadas...'}
                  value={search} onChange={e => setSearch(e.target.value)}
                  style={{
                    width: '100%', padding: '6px 12px 6px 32px', borderRadius: '8px',
                    border: '1.5px solid #cbd5e1', fontSize: '12px', height: '34px',
                    boxSizing: 'border-box', background: '#ffffff', color: '#1e293b', outline: 'none',
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── 4. RESUMEN POR VENDEDOR (Plegable / Opcional) ── */}
        {vista === 'activas' && showVendorSummary && stats.vendedoresRows.length > 0 && (
          <div style={{ padding: '12px 20px', borderBottom: '1px solid #cbd5e1', background: '#f8fafc', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Icon name="handshake" size={14} color="#0f766e" strokeWidth={2.3} />
              <span style={{ fontSize: '12.5px', fontWeight: 800, color: '#0f172a' }}>Resumen por Vendedor</span>
              <span style={{ fontSize: '11px', color: '#64748b' }}>· {stats.eventosAsignados} eventos con vendedor</span>
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '8px',
              maxHeight: '136px',
              overflowY: 'auto',
              paddingRight: '4px',
            }}>
              {stats.vendedoresRows.map(r => <VendedorCard key={r.vendedorId || '__sin_asignar__'} row={r} />)}
            </div>
          </div>
        )}

        {/* ── 5. LISTA PRINCIPAL DE TARJETAS DE EVENTOS ASIGNADOS (Con Scroll Directo) ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 24px', background: '#f8fafc' }}>
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
                textAlign: 'center', color: '#94a3b8', padding: '50px 20px',
                border: '2px dashed #cbd5e1', borderRadius: '14px', background: '#ffffff',
              }}>
                <div style={{ display: 'inline-flex', marginBottom: '10px', color: '#cbd5e1' }}>
                  <Icon name={canCreate ? 'handshake' : 'inbox'} size={44} strokeWidth={1.5} />
                </div>
                <div style={{ fontSize: '14.5px', fontWeight: 800, color: '#64748b' }}>
                  {canCreate ? 'No hay eventos asignados coincidentes' : 'No tienes eventos asignados'}
                </div>
                {canCreate && (
                  <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                    Ajusta los filtros o presiona "+ Asignar evento" para agregar uno nuevo
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {filteredLeads.map(lead => (
                  <div
                    key={lead.id}
                    id={`pv-lead-${lead.id}`}
                    style={{
                      borderRadius: '12px',
                      transition: 'box-shadow 0.3s ease, transform 0.3s ease',
                      boxShadow: focusedLeadId && String(focusedLeadId) === String(lead.id)
                        ? '0 0 0 3px #14b8a6, 0 8px 24px rgba(20,184,166,0.35)'
                        : 'none',
                      transform: focusedLeadId && String(focusedLeadId) === String(lead.id)
                        ? 'scale(1.01)'
                        : 'scale(1)',
                    }}
                  >
                    <LeadCard
                      lead={lead}
                      userName={userName}
                      canEdit={canEditLead(lead)}
                      canDelete={canDeleteLead(lead)}
                      canSendMessage={canSendMessage(lead)}
                      onEdit={() => openEdit(lead)}
                      onDelete={() => handleDelete(lead)}
                      onSendMessage={() => openSendMessage(lead)}
                      onConvert={() => {
                        const params = new URLSearchParams();
                        params.set('pv', String(lead.id));
                        if (lead.fechaEvento) params.set('date', lead.fechaEvento);
                        navigate(`/nueva-reserva?${params.toString()}`);
                      }}
                      onVerReserva={() => {
                        if (!lead.eventoId) return;
                        navigate(`/reserva/${lead.eventoId}`);
                      }}
                    />
                  </div>
                ))}
              </div>
            )
          ) : (
            /* Vista eliminadas */
            loadingEliminadas ? (
              <div style={{ textAlign: 'center', color: '#94a3b8', padding: '40px', fontSize: '13px' }}>
                <div style={{ display: 'inline-flex', marginBottom: '8px' }}>
                  <Icon name="loader" size={32} color="#94a3b8" className="pv-spin" strokeWidth={2} />
                </div>
                <div>Cargando eventos eliminados...</div>
              </div>
            ) : eliminadas.length === 0 ? (
              <div style={{
                textAlign: 'center', color: '#94a3b8', padding: '50px 20px',
                border: '2px dashed #fecaca', borderRadius: '14px', background: '#ffffff',
              }}>
                <div style={{ display: 'inline-flex', marginBottom: '10px', color: '#fecaca' }}>
                  <Icon name="trash" size={44} strokeWidth={1.5} />
                </div>
                <div style={{ fontSize: '14.5px', fontWeight: 800, color: '#991b1b' }}>
                  No hay eventos asignados eliminados
                </div>
                <div style={{ fontSize: '12px', color: '#b91c1c', marginTop: '4px' }}>
                  Los eventos asignados que eliminen los administradores o creadores aparecerán aquí para ser restaurados.
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {eliminadas
                  .filter(l => {
                    if (!search) return true;
                    const term = search.toLowerCase();
                    return (
                      (l.nombreCliente || '').toLowerCase().includes(term) ||
                      (l.telefono || '').toLowerCase().includes(term) ||
                      (l.vendedorNombre || '').toLowerCase().includes(term) ||
                      (l.salones || []).some(s => String(s).toLowerCase().includes(term))
                    );
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

      {/* ── MODAL NUEVO / EDITAR LEAD ── */}
      {modalOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)',
          backdropFilter: 'blur(3px)', zIndex: 999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '16px',
        }} onClick={() => setModalOpen(false)}>
          <div style={{
            background: '#ffffff', borderRadius: '16px', border: '1px solid #cbd5e1',
            maxWidth: '560px', width: '100%', maxHeight: '90vh', overflowY: 'auto',
            padding: '24px', boxShadow: '0 20px 40px rgba(15,23,42,0.2)',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '10px',
                  background: '#f0fdfa', color: '#0f766e',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon name={editing ? 'pencil' : 'plus'} size={20} color="#0f766e" strokeWidth={2.3} />
                </div>
                <div>
                  <h3 style={{ fontSize: '17px', fontWeight: 900, color: '#0f172a', margin: 0 }}>
                    {editing ? 'Editar evento asignado' : 'Asignar nuevo evento'}
                  </h3>
                  <p style={{ fontSize: '11.5px', color: '#64748b', margin: '2px 0 0' }}>
                    {editing ? 'Modifica los datos y asignación del lead' : 'Ingresa la información básica para notificar al vendedor'}
                  </p>
                </div>
              </div>
              <button onClick={() => setModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px', borderRadius: '6px' }}>
                <Icon name="x" size={20} color="#94a3b8" strokeWidth={2.3} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>Nombre del cliente / Empresa *</span>
                <input value={form.nombreCliente} onChange={e => setForm({ ...form, nombreCliente: e.target.value })}
                  disabled={editing && userRole === 'vendedor'}
                  style={inputStyle} placeholder="Ej. Juan Pérez / Banco Industrial" autoFocus />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>Teléfono</span>
                  <input value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })}
                    disabled={editing && userRole === 'vendedor'}
                    style={inputStyle} placeholder="55554444" />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>Correo electrónico</span>
                  <input type="email" value={form.correo} onChange={e => setForm({ ...form, correo: e.target.value })}
                    disabled={editing && userRole === 'vendedor'}
                    style={inputStyle} placeholder="cliente@correo.com" />
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>Fecha tentativa del evento</span>
                  <input type="date" value={form.fechaEvento} onChange={e => setForm({ ...form, fechaEvento: e.target.value })}
                    disabled={editing && userRole === 'vendedor'}
                    style={inputStyle} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>Cantidad de personas (PAX)</span>
                  <input type="number" value={form.pax} onChange={e => setForm({ ...form, pax: e.target.value })}
                    disabled={editing && userRole === 'vendedor'}
                    style={inputStyle} placeholder="Ej. 150" min="1" />
                </label>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>Salones requeridos</span>
                <MultiSelect
                  options={salones.map(s => {
                    const name = typeof s === 'string' ? s : (s?.name || s?.nombre || String(s));
                    return { value: name, label: name };
                  })}
                  selected={formSalones}
                  onChange={vals => setFormSalones(new Set(vals))}
                  placeholder="Seleccionar salones..."
                  emptyLabel="Seleccionar salones..."
                  disabled={editing && userRole === 'vendedor'}
                  width="100%"
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>Servicios requeridos</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {SERVICIOS_FIJOS.map(s => {
                    const sel = formServicios.has(s);
                    return (
                      <button key={s} type="button"
                        disabled={editing && userRole === 'vendedor'}
                        onClick={() => {
                          setFormServicios(prev => {
                            const next = new Set(prev);
                            if (next.has(s)) next.delete(s); else next.add(s);
                            return next;
                          });
                        }}
                        style={{
                          padding: '5px 12px', borderRadius: '999px', fontSize: '11.5px', fontWeight: 700,
                          border: sel ? '1.5px solid #0284c7' : '1px solid #cbd5e1',
                          background: sel ? '#e0f2fe' : '#ffffff',
                          color: sel ? '#0369a1' : '#475569',
                          cursor: 'pointer', transition: 'all 0.12s',
                        }}>
                        {s}
                      </button>
                    );
                  })}
                </div>
                {[...formServicios].filter(s => !SERVICIOS_FIJOS.includes(s)).length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '6px' }}>
                    {[...formServicios].filter(s => !SERVICIOS_FIJOS.includes(s)).map((s, i) => (
                      <span key={i} style={{ fontSize: '10.5px', fontWeight: 700, color: '#0369a1', padding: '2px 8px', borderRadius: '999px', background: '#e0f2fe', border: '1px solid #bae6fd' }}>
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>Requisitos del cliente</span>
                <textarea value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })}
                  disabled={editing && userRole === 'vendedor'}
                  rows={2} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} placeholder="Ej. tipo de cocina, restricciones o preferencias del cliente" />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>
                  Vendedor asignado
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
                  padding: '8px 12px', borderRadius: '8px',
                  background: '#f8fafc', border: '1px solid #cbd5e1',
                  display: 'flex', alignItems: 'center', gap: '8px',
                }}>
                  <Icon name="lock" size={14} color="#64748b" strokeWidth={2.5} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', flex: 1 }}>
                    <span style={{ fontSize: '11.5px', fontWeight: 800, color: '#475569' }}>
                      Estado: <EstadoPill estado={editing.estado} />
                    </span>
                    <span style={{ fontSize: '10.5px', color: '#64748b' }}>
                      Se calcula automáticamente del calendario y fecha.
                    </span>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                <button onClick={() => setModalOpen(false)}
                  style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#64748b', fontWeight: 700, cursor: 'pointer', fontSize: '12.5px' }}>
                  Cancelar
                </button>
                <button onClick={handleSave} disabled={saving}
                  style={{
                    padding: '8px 20px', borderRadius: '8px', border: 'none',
                    background: 'linear-gradient(135deg, #14b8a6, #0f766e)', color: '#ffffff',
                    fontWeight: 800, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1, fontSize: '12.5px',
                  }}>
                  {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Registrar y notificar'}
                </button>
              </div>
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
          .pv-module-wrapper { padding: 8px !important; }
        }
        @keyframes pv-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .pv-spin { animation: pv-spin 1s linear infinite; transform-origin: center; }
        .pv-swal-title {
          font-size: 19px !important;
          font-weight: 800 !important;
          color: #0f172a !important;
        }
        .pv-swal-html {
          font-size: 13.5px !important;
          color: #475569 !important;
          line-height: 1.5 !important;
          margin-top: 4px !important;
        }
        .pv-swal-confirm, .pv-swal-cancel {
          font-size: 12.5px !important;
          font-weight: 700 !important;
          padding: 8px 16px !important;
          border-radius: 8px !important;
          border: none !important;
          cursor: pointer !important;
          margin: 0 4px !important;
        }
        .pv-swal-confirm {
          background: linear-gradient(135deg, #14b8a6, #0f766e) !important;
          color: #fff !important;
        }
        .pv-swal-cancel {
          background: #fff !important;
          color: #475569 !important;
          border: 1.5px solid #cbd5e1 !important;
        }
        .pv-swal-popup {
          border-radius: 14px !important;
          border: 1px solid #e2e8f0 !important;
          box-shadow: 0 12px 36px rgba(15, 23, 42, 0.12) !important;
          padding: 28px 24px 20px !important;
        }
        .pv-swal-popup .swal2-title {
          padding-top: 0 !important;
        }
        .pv-swal-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 12px;
          background: #f1f5f9;
          border-radius: 999px;
          font-size: 11.5px;
          color: #475569;
          margin-bottom: 12px;
          font-weight: 500;
          line-height: 1.2;
        }
        .pv-swal-pill strong {
          color: #0f172a;
          font-weight: 700;
        }
        .pv-swal-pill svg {
          flex-shrink: 0;
          color: #7c3aed;
        }
        .pv-swal-counter {
          font-size: 10.5px;
          color: #94a3b8;
          text-align: right;
          margin-top: 6px;
          font-weight: 500;
          font-variant-numeric: tabular-nums;
        }
        .swal2-textarea {
          border: 1.5px solid #cbd5e1 !important;
          border-radius: 10px !important;
          padding: 12px !important;
          transition: border-color 0.15s, box-shadow 0.15s !important;
          margin: 0 !important;
        }
        .swal2-textarea:focus {
          border-color: #14b8a6 !important;
          box-shadow: 0 0 0 3px rgba(20,184,166,0.15) !important;
          outline: none !important;
        }
        .swal2-loader {
          border-color: #14b8a6 transparent #14b8a6 transparent !important;
        }
      `}</style>
    </div>
  );
}
