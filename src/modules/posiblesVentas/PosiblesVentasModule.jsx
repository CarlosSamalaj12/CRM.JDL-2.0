import { useState, useMemo, useEffect, useCallback } from 'react';
import { useOutletContext, useNavigate, useSearchParams } from 'react-router-dom';
import Swal from 'sweetalert2';
import {
  Handshake, ClipboardList, Clock, Eye, Trophy, XCircle,
  TrendingUp, AlertTriangle, Calendar, MapPin, Users, Phone,
  Mail, RefreshCw, Link as LinkIcon, RotateCcw, Trash2, Pencil,
  Search, Loader2, Inbox, BarChart3, Plus, X, ChevronDown, ChevronUp, Lock,
  Download, LayoutList, LayoutGrid,
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
  download: Download,
  layoutList: LayoutList,
  layoutGrid: LayoutGrid,
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

const AVATAR_PALETTES = [
  { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' },
  { bg: '#ecfdf5', color: '#059669', border: '#a7f3d0' },
  { bg: '#f5f3ff', color: '#7c3aed', border: '#ddd6fe' },
  { bg: '#fff1f2', color: '#e11d48', border: '#fecdd3' },
  { bg: '#fffbeb', color: '#d97706', border: '#fde68a' },
  { bg: '#f0fdfa', color: '#0d9488', border: '#99f6e4' },
];

function getInitials(name) {
  if (!name) return '?';
  const clean = String(name).replace(/\(.*?\)/g, '').trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function getAvatarStyle(name, estado) {
  if (estado === 'perdida') {
    return { bg: '#fff1f2', color: '#e11d48', border: '#fecdd3' };
  }
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
  }
  const idx = Math.abs(hash) % (AVATAR_PALETTES.length - 1);
  return AVATAR_PALETTES[idx];
}

function formatDiaSeguimientoShort(val) {
  const d = toDateObj(val);
  if (!d) return null;
  const diaSemana = d.toLocaleDateString('es-ES', { weekday: 'short' });
  const diaNum = d.getDate();
  const mes = d.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '');
  const hora = d.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit', hour12: true });
  const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
  return `${cap(diaSemana)}, ${diaNum} ${mes} · ${hora}`;
}

function MetricCardClean({ label, value, subtitle, pill, dotColor, isAttention, onClick, active }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: isAttention ? '#fff1f2' : '#ffffff',
        border: isAttention ? '1px solid #fecdd3' : (active ? '1.5px solid #0f766e' : '1px solid #e2e8f0'),
        borderRadius: '10px',
        padding: '8px 14px',
        minWidth: '110px',
        flex: '1 1 auto',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.15s ease',
        boxShadow: active ? '0 2px 6px rgba(15,118,110,0.15)' : '0 1px 2px rgba(0,0,0,0.02)',
      }}
      onMouseEnter={e => {
        if (onClick) {
          e.currentTarget.style.borderColor = isAttention ? '#f43f5e' : '#94a3b8';
          e.currentTarget.style.transform = 'translateY(-1px)';
        }
      }}
      onMouseLeave={e => {
        if (onClick) {
          e.currentTarget.style.borderColor = isAttention ? '#fecdd3' : (active ? '#0f766e' : '#e2e8f0');
          e.currentTarget.style.transform = 'translateY(0)';
        }
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', marginBottom: '4px' }}>
        <span style={{
          fontSize: '9.5px',
          fontWeight: 800,
          color: isAttention ? '#e11d48' : '#64748b',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
        }}>
          {label}
        </span>
        {dotColor && (
          <span style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: dotColor,
            flexShrink: 0,
          }} />
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', flexWrap: 'wrap' }}>
        <span style={{
          fontSize: '18px',
          fontWeight: 800,
          color: isAttention ? '#e11d48' : '#0f172a',
          lineHeight: 1.1,
        }}>
          {value}
        </span>
        {pill && (
          <span style={{
            background: pill.bg || '#f1f5f9',
            color: pill.color || '#475569',
            border: pill.border ? `1px solid ${pill.border}` : 'none',
            fontSize: '10px',
            fontWeight: 700,
            padding: '1px 6px',
            borderRadius: '4px',
            whiteSpace: 'nowrap',
          }}>
            {pill.text}
          </span>
        )}
        {subtitle && (
          <span style={{
            fontSize: '11px',
            fontWeight: 600,
            color: isAttention ? '#e11d48' : (subtitle.color || '#64748b'),
            whiteSpace: 'nowrap',
          }}>
            {typeof subtitle === 'string' ? subtitle : subtitle.text}
          </span>
        )}
      </div>
    </div>
  );
}

function EstadoPillClean({ estado }) {
  const est = ESTADO_MAP[estado] || ESTADO_MAP.pendiente;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      fontSize: '11px', fontWeight: 700, color: est.color,
      padding: '2px 9px', borderRadius: '999px',
      background: est.softBg || est.bg,
      border: `1px solid ${est.border}`,
      whiteSpace: 'nowrap',
    }}>
      <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: est.color }} />
      {est.label}
    </span>
  );
}

const EstadoPill = EstadoPillClean;

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
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', fontWeight: 600, display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {lead.vendedorNombre ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Icon name="users" size={12} color="#94a3b8" strokeWidth={2.2} />
                  <span>Asignado: {lead.vendedorNombre}</span>
                  {(lead.asignadoEn || lead.creadoEn) && (
                    <span style={{ color: '#94a3b8', fontSize: '10.5px' }} title={`Asignado el ${formatFechaCompleta(lead.asignadoEn || lead.creadoEn)}`}>
                      (hace {formatDiasAsignado(lead.asignadoEn || lead.creadoEn)})
                    </span>
                  )}
                </span>
              ) : (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#d97706' }}>
                  <Icon name="alertTriangle" size={12} color="#d97706" strokeWidth={2.3} />
                  Sin vendedor asignado
                </span>
              )}
              {lead.tomadoPorOtro && lead.atendidoPorNombre && (
                <span style={{
                  fontSize: '10.5px', color: '#b45309', fontWeight: 700,
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  background: '#fef3c7', padding: '1px 5px', borderRadius: '4px', border: '1px solid #fde68a', width: 'fit-content'
                }}>
                  <Icon name="alertTriangle" size={10} color="#b45309" strokeWidth={2.5} />
                  Atendido por: {lead.atendidoPorNombre}
                </span>
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

function LeadCard({
  lead,
  userName,
  canEdit,
  canDelete,
  canSendMessage,
  onEdit,
  onDelete,
  onConvert,
  onVerReserva,
  onSendMessage,
  onReactivar,
}) {
  const est = ESTADO_MAP[lead.estado] || ESTADO_MAP.pendiente;
  const fechaAsig = lead.asignadoEn || lead.creadoEn;
  const fechaSeg = lead.ultimoSeguimientoEn || lead.primerSeguimientoEn || (lead.eventoId ? (lead.actualizadoEn || lead.creadoEn) : null);
  const initials = getInitials(lead.nombreCliente);
  const avatarStyle = getAvatarStyle(lead.nombreCliente, lead.estado);
  const accentColor = est.color || '#0d9488';

  return (
    <div
      style={{
        position: 'relative',
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '16px 20px 16px 22px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        display: 'flex',
        alignItems: 'stretch',
        justifyContent: 'space-between',
        gap: '16px',
        overflow: 'hidden',
        transition: 'border-color 0.15s, box-shadow 0.15s, transform 0.15s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = '#cbd5e1';
        e.currentTarget.style.boxShadow = '0 4px 14px rgba(15,23,42,0.06)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = '#e2e8f0';
        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.03)';
      }}
    >
      {/* Barra lateral con color del estado */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: '4.5px',
          background: accentColor,
        }}
      />

      {/* Contenido Principal Izquierdo */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
        {/* Cabecera: Avatar Iniciales + Cliente + Estado + Vinculada + Info Asignado */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: avatarStyle.bg,
              color: avatarStyle.color,
              border: `1px solid ${avatarStyle.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '12px',
              letterSpacing: '0.02em',
              flexShrink: 0,
            }}
          >
            {initials}
          </div>

          <span style={{ fontSize: '15.5px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' }}>
            {lead.nombreCliente}
          </span>

          <EstadoPillClean estado={lead.estado} />

          {lead.eventoId && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                fontWeight: 600,
                color: '#475569',
                padding: '2px 8px',
                borderRadius: '6px',
                background: '#f1f5f9',
                border: '1px solid #e2e8f0',
              }}
            >
              <Icon name="link" size={11} color="#64748b" strokeWidth={2.4} />
              Vinculada
            </span>
          )}

          <span style={{ fontSize: '12px', color: '#64748b' }}>
            {lead.vendedorNombre ? (
              <>
                Asignado a: <strong style={{ color: '#334155' }}>{lead.vendedorNombre}</strong>
                {fechaAsig && <span> · hace {formatDiasAsignado(fechaAsig)}</span>}
              </>
            ) : (
              <span style={{ color: '#d97706', fontWeight: 600 }}>Sin vendedor asignado</span>
            )}
            {lead.tomadoPorOtro && lead.atendidoPorNombre && (
              <span style={{ color: '#b45309', marginLeft: '6px' }}>
                · Atendido por: <strong>{lead.atendidoPorNombre}</strong>
              </span>
            )}
          </span>
        </div>

        {/* Metadatos con iconos limpios (Fecha, Salón, Pax, Teléfono, Correo) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '14px',
            fontSize: '12px',
            color: '#475569',
            fontWeight: 500,
            marginTop: '2px',
          }}
        >
          {lead.fechaEvento && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
              <Icon name="calendar" size={13} color="#94a3b8" strokeWidth={2} />
              <span>{lead.fechaEvento}</span>
            </span>
          )}

          {(lead.salones || []).length > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
              <Icon name="mapPin" size={13} color="#94a3b8" strokeWidth={2} />
              <span>{(lead.salones || []).join(', ')}</span>
            </span>
          )}

          {lead.pax ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
              <Icon name="users" size={13} color="#94a3b8" strokeWidth={2} />
              <span>{lead.pax} pax</span>
            </span>
          ) : null}

          {lead.telefono && (
            <a
              href={`tel:${lead.telefono}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                color: '#475569',
                textDecoration: 'none',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = '#0f766e')}
              onMouseLeave={e => (e.currentTarget.style.color = '#475569')}
            >
              <Icon name="phone" size={13} color="#94a3b8" strokeWidth={2} />
              <span>{lead.telefono}</span>
            </a>
          )}

          {lead.correo && (
            <a
              href={`mailto:${lead.correo}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                color: '#475569',
                textDecoration: 'none',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = '#0f766e')}
              onMouseLeave={e => (e.currentTarget.style.color = '#475569')}
            >
              <Icon name="mail" size={13} color="#94a3b8" strokeWidth={2} />
              <span>{lead.correo}</span>
            </a>
          )}
        </div>

        {/* Burbuja de notas / cotización */}
        {lead.notas && (
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #f1f5f9',
              borderRadius: '8px',
              padding: '7px 12px',
              fontSize: '12px',
              color: '#475569',
              lineHeight: 1.45,
              marginTop: '4px',
              marginBottom: '4px',
            }}
          >
            <span style={{ color: '#0d9488', fontWeight: 800, fontSize: '14px', marginRight: '5px' }}>“</span>
            {lead.notas}
          </div>
        )}

        {/* Seguimiento / Estado */}
        <div style={{ marginTop: '2px' }}>
          {lead.estado === 'perdida' ? (
            <span style={{ fontSize: '11.5px', color: '#e11d48', fontStyle: 'italic', fontWeight: 500 }}>
              Prospecto marcado como perdido por el asesor. Sin seguimiento programado.
            </span>
          ) : fechaSeg ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: lead.estado === 'pendiente' ? '#fffbeb' : '#f8fafc',
                border: lead.estado === 'pendiente' ? '1px solid #fef3c7' : '1px solid #e2e8f0',
                color: lead.estado === 'pendiente' ? '#b45309' : '#475569',
                padding: '3px 10px',
                borderRadius: '6px',
                fontSize: '11.5px',
                fontWeight: 600,
              }}
            >
              <Icon
                name="clock"
                size={12}
                color={lead.estado === 'pendiente' ? '#b45309' : '#64748b'}
                strokeWidth={2.3}
              />
              <span>
                {lead.estado === 'pendiente' ? 'Próximo seguimiento:' : 'Último contacto:'}{' '}
                <strong>{formatDiaSeguimientoShort(fechaSeg)}</strong>
                {lead.creadoPorNombre && <span> · {lead.creadoPorNombre}</span>}
              </span>
            </span>
          ) : (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: '#fffbeb',
                border: '1px solid #fef3c7',
                color: '#b45309',
                padding: '3px 10px',
                borderRadius: '6px',
                fontSize: '11.5px',
                fontWeight: 600,
              }}
            >
              <Icon name="alertTriangle" size={12} color="#b45309" strokeWidth={2.3} />
              <span>Sin seguimiento programado</span>
            </span>
          )}
        </div>
      </div>

      {/* Columna Derecha: Botones de Acción */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'stretch',
          gap: '8px',
          minWidth: '125px',
          flexShrink: 0,
        }}
      >
        {lead.eventoId ? (
          <button
            type="button"
            onClick={onVerReserva}
            title="Ver reserva vinculada"
            style={{
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              color: '#334155',
              fontSize: '12px',
              fontWeight: 600,
              height: '34px',
              padding: '0 12px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              transition: 'all 0.12s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#94a3b8'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
          >
            <Icon name="eye" size={13} color="#475569" strokeWidth={2.2} />
            Ver reserva
          </button>
        ) : (
          <button
            type="button"
            onClick={onConvert}
            title="Ver detalle / convertir en reserva"
            style={{
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              color: '#334155',
              fontSize: '12px',
              fontWeight: 600,
              height: '34px',
              padding: '0 12px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              transition: 'all 0.12s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#94a3b8'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
          >
            <Icon name="eye" size={13} color="#475569" strokeWidth={2.2} />
            Ver detalle
          </button>
        )}

        {lead.estado === 'perdida' ? (
          <button
            type="button"
            onClick={onReactivar || onEdit}
            title="Reactivar evento"
            style={{
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              color: '#334155',
              fontSize: '12px',
              fontWeight: 600,
              height: '34px',
              padding: '0 12px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              transition: 'all 0.12s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#94a3b8'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
          >
            <Icon name="rotateCcw" size={13} color="#475569" strokeWidth={2.2} />
            Reactivar
          </button>
        ) : (
          canSendMessage && (
            <button
              type="button"
              onClick={onSendMessage}
              title="Enviar mensaje recordatorio al vendedor"
              style={{
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                borderRadius: '8px',
                color: '#059669',
                fontSize: '12px',
                fontWeight: 700,
                height: '34px',
                padding: '0 12px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                boxShadow: '0 1px 2px rgba(5,150,105,0.08)',
                transition: 'all 0.12s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#d1fae5'; e.currentTarget.style.borderColor = '#6ee7b7'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#ecfdf5'; e.currentTarget.style.borderColor = '#a7f3d0'; }}
            >
              <Icon name="mail" size={13} color="#059669" strokeWidth={2.2} />
              Mensaje
            </button>
          )
        )}
      </div>

      {/* Controles secundarios (Editar / Eliminar) */}
      {(canEdit || canDelete) && (
        <div
          style={{
            position: 'absolute',
            top: '8px',
            right: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
          }}
        >
          {canEdit && (
            <button
              type="button"
              onClick={onEdit}
              title="Editar"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '4px',
                display: 'inline-flex',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = '#0f172a'; e.currentTarget.style.background = '#f1f5f9'; }}
              onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = 'transparent'; }}
            >
              <Icon name="pencil" size={12} strokeWidth={2.2} />
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={onDelete}
              title="Eliminar"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '4px',
                display: 'inline-flex',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = '#dc2626'; e.currentTarget.style.background = '#fef2f2'; }}
              onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = 'transparent'; }}
            >
              <Icon name="trash" size={12} strokeWidth={2.2} />
            </button>
          )}
        </div>
      )}
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
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  const d = new Date(String(val).replace(' ', 'T'));
  return isNaN(d.getTime()) ? null : d;
}
function formatFechaCompleta(val) {
  const d = toDateObj(val);
  if (!d) return '—';
  const fecha = d.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const hora = d.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit', hour12: true });
  return `${fecha} a las ${hora}`;
}
function formatDiaSeguimiento(val) {
  const d = toDateObj(val);
  if (!d) return '—';

  const hoy = new Date();
  const esMismoDia = (a, b) => (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );

  const ayer = new Date(hoy);
  ayer.setDate(ayer.getDate() - 1);

  const hora = d.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit', hour12: true });

  if (esMismoDia(d, hoy)) {
    return `Hoy a las ${hora}`;
  }
  if (esMismoDia(d, ayer)) {
    return `Ayer a las ${hora}`;
  }

  const weekdayRaw = d.toLocaleDateString('es-ES', { weekday: 'short' });
  const weekday = weekdayRaw ? weekdayRaw.charAt(0).toUpperCase() + weekdayRaw.slice(1).replace('.', '') : '';
  const diaMes = d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  const año = d.getFullYear() !== hoy.getFullYear() ? ` ${d.getFullYear()}` : '';

  return `${weekday}, ${diaMes}${año} · ${hora}`;
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
function formatDiasAsignado(val) {
  const d = toDateObj(val);
  if (!d) return '—';
  const diffMs = Date.now() - d.getTime();
  if (diffMs < 0) return '< 1 día';
  const dias = Math.floor(diffMs / 86400000);
  if (dias === 0) {
    const horas = Math.floor(diffMs / 3600000);
    return horas > 0 ? `${horas}h` : '< 1h';
  }
  return dias === 1 ? '1 día' : `${dias} días`;
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
  const outletEvents = outlet?.events;
  const salones = useMemo(() => (Array.isArray(outletSalones) ? outletSalones : []), [outletSalones]);
  const users = useMemo(() => (Array.isArray(outletUsers) ? outletUsers : []), [outletUsers]);
  const events = useMemo(() => (Array.isArray(outletEvents) ? outletEvents : []), [outletEvents]);

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

  // Lista deduplicada de reservas para vinculación en el modal
  const availableEventsList = useMemo(() => {
    if (!Array.isArray(events)) return [];
    const seen = new Set();
    const list = [];
    for (const ev of events) {
      if (!ev || !ev.id) continue;
      const baseId = String(ev.id).replace(/_(s|slot)\d+_\d{6,}$/, '') || String(ev.id);
      if (seen.has(baseId)) continue;
      seen.add(baseId);
      list.push(ev);
    }
    return list.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  }, [events]);

  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [vendedorFilter, setVendedorFilter] = useState(() => (isAdmin ? 'all' : 'mine'));
  const [estadoFilter, setEstadoFilter] = useState('all');
  const [showVendorSummary, setShowVendorSummary] = useState(false);
  const [focusedLeadId, setFocusedLeadId] = useState(() => searchParams.get('focus') || null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  // Soft delete UI (solo admin)
  const [vista, setVista] = useState('activas'); // 'activas' | 'eliminadas'
  const [eliminadas, setEliminadas] = useState([]);
  const [loadingEliminadas, setLoadingEliminadas] = useState(false);
  const [restoringId, setRestoringId] = useState(null);

  // Filtros adicionales: salón y vista list/grid
  const [salonFilter, setSalonFilter] = useState('all');
  const [layoutMode, setLayoutMode] = useState('list');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Form state
  const [form, setForm] = useState({
    nombreCliente: '', telefono: '', correo: '', fechaEvento: '',
    pax: '', notas: '', vendedorId: '', eventoId: '',
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
    const focusId = searchParams.get('focus');
    if (focusId) {
      setFocusedLeadId(focusId);
      setVendedorFilter('all');
      setEstadoFilter('all');
      setVista('activas');
    }
  }, [searchParams]);

  useEffect(() => {
    if (!focusedLeadId || loading || leads.length === 0) return;
    const timer = setTimeout(() => {
      const el = document.getElementById(`pv-lead-${focusedLeadId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);

    const t = setTimeout(() => {
      setFocusedLeadId(null);
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        next.delete('focus');
        return next;
      }, { replace: true });
    }, 5000);
    return () => {
      clearTimeout(timer);
      clearTimeout(t);
    };
  }, [focusedLeadId, loading, leads.length, setSearchParams]);

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
    setForm({ nombreCliente: '', telefono: '', correo: '', fechaEvento: '', pax: '', notas: '', vendedorId: '', eventoId: '' });
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
      eventoId: lead.eventoId || '',
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
      eventoId: form.eventoId !== undefined ? (form.eventoId || null) : undefined,
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
      items = items.filter(l =>
        String(l.vendedorId || '') === myId ||
        String(l.creadoPorId || '') === myId ||
        String(l.atendidoPorId || '') === myId
      );
    } else if (vendedorFilter !== 'all') {
      const vId = String(vendedorFilter);
      items = items.filter(l =>
        String(l.vendedorId || '') === vId ||
        String(l.atendidoPorId || '') === vId
      );
    }
    return items;
  }, [leads, vendedorFilter, currentUser?.id]);

  const filteredLeads = useMemo(() => {
    let items = leadsForVendorFilter;
    if (estadoFilter === 'sin_seguimiento') {
      items = items.filter(l => !l.ultimoSeguimientoEn);
    } else if (estadoFilter !== 'all') {
      items = items.filter(l => l.estado === estadoFilter);
    }
    if (salonFilter !== 'all') {
      items = items.filter(l => (l.salones || []).includes(salonFilter));
    }
    if (search) {
      const term = search.toLowerCase();
      items = items.filter(l =>
        (l.nombreCliente || '').toLowerCase().includes(term) ||
        (l.telefono || '').toLowerCase().includes(term) ||
        (l.correo || '').toLowerCase().includes(term) ||
        (l.vendedorNombre || '').toLowerCase().includes(term) ||
        (l.atendidoPorNombre || '').toLowerCase().includes(term) ||
        (l.salones || []).some(s => String(s).toLowerCase().includes(term)) ||
        (l.notas || '').toLowerCase().includes(term)
      );
    }
    return items;
  }, [leadsForVendorFilter, estadoFilter, salonFilter, search]);

  const totalLeadsCount = filteredLeads.length;
  const totalPages = Math.max(1, Math.ceil(totalLeadsCount / pageSize));

  useEffect(() => {
    setCurrentPage(1);
  }, [estadoFilter, vendedorFilter, salonFilter, search]);

  const paginatedLeads = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLeads.slice(start, start + pageSize);
  }, [filteredLeads, currentPage, pageSize]);

  const exportToExcel = async () => {
    try {
      const XLSX = await import('xlsx');
      const rows = filteredLeads.map(l => ({
        ID: l.id,
        Cliente: l.nombreCliente || '—',
        Teléfono: l.telefono || '—',
        Correo: l.correo || '—',
        'Fecha Evento': l.fechaEvento || '—',
        Pax: l.pax || 0,
        Salones: (l.salones || []).join(', ') || '—',
        Estado: ESTADO_MAP[l.estado]?.label || l.estado || '—',
        Vendedor: l.vendedorNombre || 'Sin asignar',
        'Creado Por': l.creadoPorNombre || '—',
        'Fecha Asignación': l.asignadoEn ? formatFechaCompleta(l.asignadoEn) : '—',
        'Último Seguimiento': l.ultimoSeguimientoEn ? formatFechaCompleta(l.ultimoSeguimientoEn) : 'Sin seguimiento',
        Notas: l.notas || '—',
      }));
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'Eventos Asignados');
      XLSX.writeFile(wb, `eventos-asignados-${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success('Eventos asignados exportados a Excel');
    } catch (err) {
      console.error('Error exportando Excel:', err);
      toast.error('Error al exportar a Excel');
    }
  };

  const handleSync = async () => {
    toast.info('Sincronizando...');
    await loadLeads();
    toast.success('Eventos asignados sincronizados');
  };

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
      const asigDate = l.asignadoEn || l.creadoEn;
      if (l.primerSeguimientoEn && asigDate) {
        const t = new Date(String(l.primerSeguimientoEn).replace(' ', 'T')).getTime()
          - new Date(String(asigDate).replace(' ', 'T')).getTime();
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
    if (lead?.estado === 'ganada') return false;
    if (isAdmin) return true;
    if (userRole === 'vendedor') return true;
    if (userRole === 'frontoffice' || userRole === 'recepcionista') return true;
    return String(lead?.creadoPorId || '') === String(currentUser?.id || '');
  };

  const canDeleteLead = (lead) => {
    if (lead?.estado !== 'pendiente') return false;
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

  const linkedEventObj = useMemo(() => {
    if (!form.eventoId || !Array.isArray(events)) return null;
    const baseId = String(form.eventoId).replace(/_(s|slot)\d+_\d{6,}$/, '') || String(form.eventoId);
    return events.find(e => String(e.id) === form.eventoId || String(e.id).startsWith(baseId)) || null;
  }, [form.eventoId, events]);

  const suggestedMatch = useMemo(() => {
    if (!editing || form.eventoId || !Array.isArray(events)) return null;
    const clientWords = String(form.nombreCliente || '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3 && !['boda', 'cumpleanos', 'cumpleaños', 'anos', 'años', 'evento', 'para', 'hotel'].includes(w));
    if (clientWords.length === 0) return null;

    return availableEventsList.find(ev => {
      const evName = String(ev.name || '').toLowerCase();
      const matchWords = clientWords.filter(w => evName.includes(w));
      const wordsMatch = matchWords.length >= Math.min(2, clientWords.length);
      const dateMatch = form.fechaEvento && ev.date && String(form.fechaEvento).slice(0, 10) === String(ev.date).slice(0, 10);
      return wordsMatch || (dateMatch && matchWords.length >= 1);
    }) || null;
  }, [editing, form.eventoId, form.nombreCliente, form.fechaEvento, availableEventsList, events]);

  const inputStyle = {
    padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1',
    fontSize: '13px', background: '#ffffff', color: '#0f172a', outline: 'none',
    boxSizing: 'border-box', width: '100%',
  };

  return (
    <div className="pv-module-wrapper" style={{ padding: '0', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxSizing: 'border-box', background: '#f8fafc' }}>
      <div style={{
        display: 'flex', flexDirection: 'column', height: '100%', width: '100%',
        margin: '0 auto', background: '#f8fafc', overflow: 'hidden',
      }}>

        {/* ── 1. ENCABEZADO MODERNO: PIPELINE ACTIVO + ACCIONES ── */}
        <div style={{
          padding: '16px 24px',
          background: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
                  Eventos Asignados
                </h1>
                <span style={{
                  background: '#ecfdf5',
                  color: '#059669',
                  border: '1px solid #a7f3d0',
                  borderRadius: '999px',
                  padding: '2px 10px',
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.02em',
                }}>
                  Seguimiento activo
                </span>
              </div>
              <p style={{ color: '#64748b', fontSize: '12.5px', margin: '4px 0 0', fontWeight: 500 }}>
                Seguimiento comercial de solicitudes, prospectos y reservas vinculadas.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={exportToExcel}
                style={{
                  background: '#ffffff',
                  color: '#334155',
                  border: '1px solid #cbd5e1',
                  padding: '7px 14px',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '12.5px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                  transition: 'all 0.12s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#94a3b8'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
              >
                <Icon name="download" size={14} color="#64748b" strokeWidth={2.2} />
                Exportar
              </button>

              <button
                type="button"
                onClick={handleSync}
                style={{
                  background: '#ffffff',
                  color: '#334155',
                  border: '1px solid #cbd5e1',
                  padding: '7px 14px',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '12.5px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                  transition: 'all 0.12s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#94a3b8'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
              >
                <Icon name="refresh" size={14} color="#64748b" strokeWidth={2.2} />
                Sincronizar
              </button>

              {canCreate && (
                <button
                  type="button"
                  onClick={openCreate}
                  style={{
                    background: 'linear-gradient(135deg, #0f766e 0%, #0d9488 100%)',
                    color: '#ffffff',
                    border: 'none',
                    padding: '7px 16px',
                    borderRadius: '8px',
                    fontWeight: 700,
                    fontSize: '12.5px',
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(15,118,110,0.25)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.12s',
                  }}
                >
                  <Icon name="plus" size={14} color="#ffffff" strokeWidth={2.5} />
                  Asignar evento
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── 2. KPIS REDISEÑADOS: TARJETAS EN FILA HORIZONTAL ── */}
        {vista === 'activas' && (
          <div style={{
            padding: '12px 24px',
            background: '#ffffff',
            borderBottom: '1px solid #e2e8f0',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(115px, 1fr))',
            gap: '10px',
            flexShrink: 0,
          }}>
            <MetricCardClean
              label="TOTAL PROSPECTOS"
              value={stats.total}
              pill={stats.sinSeguimiento > 0 ? { text: `${stats.sinSeguimiento} s/seg`, bg: '#fef3c7', color: '#b45309' } : null}
              active={estadoFilter === 'all'}
              onClick={() => setEstadoFilter('all')}
            />
            <MetricCardClean
              label="PENDIENTE"
              value={stats.byEstado.pendiente}
              subtitle={`${stats.pctOf('pendiente')}%`}
              dotColor="#f59e0b"
              active={estadoFilter === 'pendiente'}
              onClick={() => setEstadoFilter('pendiente')}
            />
            <MetricCardClean
              label="EN PROCESO"
              value={stats.byEstado.en_proceso}
              subtitle={{ text: `${stats.pctOf('en_proceso')}%`, color: '#2563eb' }}
              dotColor="#3b82f6"
              active={estadoFilter === 'en_proceso'}
              onClick={() => setEstadoFilter('en_proceso')}
            />
            <MetricCardClean
              label="GANADA"
              value={stats.byEstado.ganada}
              subtitle={`${stats.pctOf('ganada')}%`}
              dotColor="#10b981"
              active={estadoFilter === 'ganada'}
              onClick={() => setEstadoFilter('ganada')}
            />
            <MetricCardClean
              label="PERDIDA"
              value={stats.byEstado.perdida}
              subtitle={`${stats.pctOf('perdida')}%`}
              dotColor="#ef4444"
              active={estadoFilter === 'perdida'}
              onClick={() => setEstadoFilter('perdida')}
            />
            <MetricCardClean
              label="CONVERSIÓN"
              value={`${stats.conversion}%`}
              subtitle={`${stats.byEstado.ganada} ganadas`}
            />
            <MetricCardClean
              label="ASIGNADOS"
              value={stats.eventosAsignados}
              pill={{ text: `${stats.pctAsignados}%`, bg: '#ecfdf5', color: '#059669' }}
            />
            <MetricCardClean
              label="ATENCIÓN"
              value={stats.sinSeguimiento}
              subtitle="s/seguimiento"
              dotColor="#e11d48"
              isAttention={stats.sinSeguimiento > 0}
              active={estadoFilter === 'sin_seguimiento'}
              onClick={() => setEstadoFilter(f => f === 'sin_seguimiento' ? 'all' : 'sin_seguimiento')}
            />
          </div>
        )}

        {/* ── 3. TOOLBAR: TABS TIPO CÁPSULA + VENDEDORES + SALONES + VISTA + BUSCADOR ── */}
        <div style={{
          padding: '12px 24px',
          background: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          flexShrink: 0,
        }}>
          {/* Lado izquierdo: Tabs redondeados */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              background: '#f1f5f9',
              borderRadius: '999px',
              padding: '3px 4px',
              gap: '2px',
            }}>
              <button
                type="button"
                onClick={() => { setVista('activas'); setEstadoFilter('all'); }}
                style={{
                  padding: '5px 12px',
                  borderRadius: '999px',
                  border: 'none',
                  background: estadoFilter === 'all' && vista === 'activas' ? '#ffffff' : 'transparent',
                  color: estadoFilter === 'all' && vista === 'activas' ? '#0f172a' : '#64748b',
                  fontWeight: estadoFilter === 'all' && vista === 'activas' ? 700 : 500,
                  fontSize: '12px',
                  cursor: 'pointer',
                  boxShadow: estadoFilter === 'all' && vista === 'activas' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.12s',
                }}
              >
                Todos
                <span style={{
                  background: estadoFilter === 'all' && vista === 'activas' ? '#f1f5f9' : 'transparent',
                  color: '#64748b',
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '0 4px',
                  borderRadius: '4px',
                }}>
                  {stats.total}
                </span>
              </button>

              {ESTADOS.map(e => {
                const isActive = estadoFilter === e.key && vista === 'activas';
                const count = stats.byEstado[e.key] || 0;
                return (
                  <button
                    key={e.key}
                    type="button"
                    onClick={() => { setVista('activas'); setEstadoFilter(e.key); }}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '999px',
                      border: 'none',
                      background: isActive ? '#ffffff' : 'transparent',
                      color: isActive ? '#0f172a' : '#64748b',
                      fontWeight: isActive ? 700 : 500,
                      fontSize: '12px',
                      cursor: 'pointer',
                      boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.12s',
                    }}
                  >
                    {e.label}
                    <span style={{
                      background: e.key === 'en_proceso' ? '#dbeafe' : (e.key === 'perdida' ? '#fee2e2' : (isActive ? '#f1f5f9' : 'transparent')),
                      color: e.key === 'en_proceso' ? '#2563eb' : (e.key === 'perdida' ? '#dc2626' : '#64748b'),
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '0 6px',
                      borderRadius: '999px',
                    }}>
                      {count}
                    </span>
                  </button>
                );
              })}

              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setVista(v => v === 'eliminadas' ? 'activas' : 'eliminadas')}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '999px',
                    border: 'none',
                    background: vista === 'eliminadas' ? '#fee2e2' : 'transparent',
                    color: vista === 'eliminadas' ? '#dc2626' : '#64748b',
                    fontWeight: vista === 'eliminadas' ? 700 : 500,
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.12s',
                  }}
                >
                  <Icon name="trash" size={12} color={vista === 'eliminadas' ? '#dc2626' : '#64748b'} strokeWidth={2.2} />
                  Eliminadas
                  {eliminadas.length > 0 && (
                    <span style={{
                      background: '#dc2626',
                      color: '#ffffff',
                      fontSize: '10px',
                      fontWeight: 800,
                      padding: '1px 6px',
                      borderRadius: '999px',
                    }}>
                      {eliminadas.length}
                    </span>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Lado derecho: Vendedores dropdown + Salones dropdown + Vista List/Grid + Buscador */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
              <div style={{
                position: 'absolute',
                left: '10px',
                display: 'flex',
                alignItems: 'center',
                pointerEvents: 'none',
              }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#0d9488', border: '1.5px solid #fff' }} />
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6', border: '1.5px solid #fff', marginLeft: '-3px' }} />
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#8b5cf6', border: '1.5px solid #fff', marginLeft: '-3px' }} />
              </div>
              <select
                value={vendedorFilter}
                onChange={e => setVendedorFilter(e.target.value)}
                style={{
                  height: '34px',
                  padding: '0 28px 0 34px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12px',
                  fontWeight: 600,
                  background: '#ffffff',
                  color: '#334155',
                  outline: 'none',
                  cursor: 'pointer',
                  appearance: 'none',
                }}
              >
                <option value="all">Vendedores ({vendedores.length})</option>
                <option value="mine">👤 Mis asignaciones</option>
                {vendedores.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.fullName || v.name}
                  </option>
                ))}
              </select>
              <span style={{ position: 'absolute', right: '10px', pointerEvents: 'none' }}>
                <Icon name="chevronDown" size={13} color="#64748b" strokeWidth={2.4} />
              </span>
            </div>

            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
              <span style={{ position: 'absolute', left: '10px', pointerEvents: 'none' }}>
                <Icon name="mapPin" size={13} color="#64748b" strokeWidth={2.2} />
              </span>
              <select
                value={salonFilter}
                onChange={e => setSalonFilter(e.target.value)}
                style={{
                  height: '34px',
                  padding: '0 28px 0 28px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12px',
                  fontWeight: 600,
                  background: '#ffffff',
                  color: '#334155',
                  outline: 'none',
                  cursor: 'pointer',
                  appearance: 'none',
                  maxWidth: '180px',
                }}
              >
                <option value="all">Todos los salones</option>
                {salones.map(s => {
                  const name = typeof s === 'string' ? s : (s.nombre || s.name);
                  return <option key={name} value={name}>{name}</option>;
                })}
              </select>
              <span style={{ position: 'absolute', right: '10px', pointerEvents: 'none' }}>
                <Icon name="chevronDown" size={13} color="#64748b" strokeWidth={2.4} />
              </span>
            </div>

            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              background: '#f1f5f9',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '2px',
            }}>
              <button
                type="button"
                onClick={() => setLayoutMode('list')}
                title="Vista de lista"
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  border: 'none',
                  background: layoutMode === 'list' ? '#ffffff' : 'transparent',
                  color: layoutMode === 'list' ? '#0f172a' : '#64748b',
                  boxShadow: layoutMode === 'list' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <Icon name="clipboard" size={13} strokeWidth={2.3} />
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode('grid')}
                title="Vista de cuadrícula"
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  border: 'none',
                  background: layoutMode === 'grid' ? '#ffffff' : 'transparent',
                  color: layoutMode === 'grid' ? '#0f172a' : '#64748b',
                  boxShadow: layoutMode === 'grid' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <Icon name="barChart" size={13} strokeWidth={2.3} />
              </button>
            </div>

            <div style={{ position: 'relative', minWidth: '200px', display: 'flex', alignItems: 'center' }}>
              <span style={{ position: 'absolute', left: '10px', display: 'inline-flex', pointerEvents: 'none' }}>
                <Icon name="search" size={13} color="#94a3b8" strokeWidth={2.3} />
              </span>
              <input
                type="text"
                placeholder="Buscar cliente, teléfono..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 10px 6px 30px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12px',
                  height: '34px',
                  background: '#ffffff',
                  color: '#1e293b',
                  outline: 'none',
                }}
              />
            </div>
          </div>
        </div>

        {/* ── 4. RESUMEN POR VENDEDOR (Plegable / Opcional) ── */}
        {vista === 'activas' && showVendorSummary && stats.vendedoresRows.length > 0 && (
          <div style={{ padding: '12px 24px', borderBottom: '1px solid #cbd5e1', background: '#f8fafc', flexShrink: 0 }}>
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

        {/* ── 5. LISTA PRINCIPAL DE TARJETAS DE EVENTOS ASIGNADOS ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px 24px', background: '#f8fafc' }}>
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
              <>
                <div style={layoutMode === 'grid' ? {
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(460px, 1fr))',
                  gap: '12px',
                } : {
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}>
                  {paginatedLeads.map(lead => (
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
                        onReactivar={() => openEdit(lead)}
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

                {/* ── FOOTER DE PAGINACIÓN ── */}
                {totalLeadsCount > 0 && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px 4px 8px',
                    flexWrap: 'wrap',
                    gap: '12px',
                    marginTop: '8px',
                  }}>
                    <span style={{ fontSize: '12.5px', color: '#64748b', fontWeight: 600 }}>
                      Mostrando <strong>{Math.min(totalLeadsCount, (currentPage - 1) * pageSize + 1)}</strong> a{' '}
                      <strong>{Math.min(totalLeadsCount, currentPage * pageSize)}</strong> de{' '}
                      <strong>{totalLeadsCount}</strong> eventos activos
                    </span>

                    {totalPages > 1 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            background: '#ffffff',
                            color: currentPage === 1 ? '#94a3b8' : '#334155',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                            transition: 'all 0.12s',
                          }}
                        >
                          Anterior
                        </button>

                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                          <button
                            key={page}
                            type="button"
                            onClick={() => setCurrentPage(page)}
                            style={{
                              minWidth: '32px',
                              height: '32px',
                              padding: '0 6px',
                              borderRadius: '8px',
                              border: page === currentPage ? '1px solid #0f766e' : '1px solid #cbd5e1',
                              background: page === currentPage ? '#0f766e' : '#ffffff',
                              color: page === currentPage ? '#ffffff' : '#334155',
                              fontSize: '12px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                              transition: 'all 0.12s',
                            }}
                          >
                            {page}
                          </button>
                        ))}

                        <button
                          type="button"
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            background: '#ffffff',
                            color: currentPage === totalPages ? '#94a3b8' : '#334155',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                            transition: 'all 0.12s',
                          }}
                        >
                          Siguiente
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
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
                      (l.atendidoPorNombre || '').toLowerCase().includes(term) ||
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
                    {editing ? 'Modifica los datos y asignación del prospecto' : 'Ingresa la información básica para notificar al vendedor'}
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
                  style={inputStyle} placeholder="Ej. Juan Pérez / Banco Industrial" autoFocus />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>Teléfono</span>
                  <input value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })}
                    style={inputStyle} placeholder="55554444" />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>Correo electrónico</span>
                  <input type="email" value={form.correo} onChange={e => setForm({ ...form, correo: e.target.value })}
                    style={inputStyle} placeholder="cliente@correo.com" />
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>Fecha tentativa del evento</span>
                  <input type="date" value={form.fechaEvento} onChange={e => setForm({ ...form, fechaEvento: e.target.value })}
                    style={inputStyle} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>Cantidad de personas (PAX)</span>
                  <input type="number" value={form.pax} onChange={e => setForm({ ...form, pax: e.target.value })}
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
                  rows={2} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} placeholder="Ej. tipo de cocina, restricciones o preferencias del cliente" />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>
                  Vendedor asignado
                </span>
                <select value={form.vendedorId} onChange={e => setForm({ ...form, vendedorId: e.target.value })}
                  style={inputStyle}>
                  <option value="">— Sin asignar —</option>
                  {vendedores.map(v => (
                    <option key={v.id} value={v.id}>{v.fullName || v.name}</option>
                  ))}
                </select>
              </label>

              {editing && (
                <div style={{
                  padding: '12px', borderRadius: '10px',
                  background: '#f8fafc', border: '1px solid #cbd5e1',
                  display: 'flex', flexDirection: 'column', gap: '8px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', fontWeight: 800, color: '#334155', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <Icon name="link" size={13} color="#0d9488" strokeWidth={2.4} />
                      Reserva vinculada en Calendario
                    </span>
                    {form.eventoId && (
                      <button
                        type="button"
                        onClick={() => setForm(f => ({ ...f, eventoId: '' }))}
                        style={{
                          background: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c',
                          fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '6px',
                          cursor: 'pointer',
                        }}
                        title="Desvincular reserva del calendario"
                      >
                        ✕ Desvincular
                      </button>
                    )}
                  </div>

                  {form.eventoId ? (
                    <div style={{
                      background: '#ffffff', border: '1px solid #99f6e4', borderRadius: '8px',
                      padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 800, color: '#0f766e' }}>
                          {linkedEventObj ? (linkedEventObj.name || linkedEventObj.nombre) : `Reserva ID: ${form.eventoId}`}
                        </span>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>
                          {linkedEventObj ? `${linkedEventObj.date || linkedEventObj.fecha_evento || ''} · ${linkedEventObj.status || linkedEventObj.estado || ''} · Salón: ${linkedEventObj.salon || linkedEventObj.nombre_salon || '—'}` : 'Reserva conectada'}
                        </span>
                      </div>
                      <span style={{ fontSize: '10.5px', background: '#ccfbf1', color: '#0f766e', fontWeight: 800, padding: '2px 8px', borderRadius: '999px' }}>
                        Conectada
                      </span>
                    </div>
                  ) : (
                    <div>
                      {suggestedMatch && (
                        <div style={{
                          background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '8px',
                          padding: '8px 10px', marginBottom: '8px', display: 'flex', alignItems: 'center',
                          justifyContent: 'space-between', gap: '8px',
                        }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                            <span style={{ fontSize: '11px', fontWeight: 800, color: '#065f46' }}>
                              💡 Reserva coincidente detectada:
                            </span>
                            <span style={{ fontSize: '11.5px', color: '#047857', fontWeight: 600 }}>
                              {suggestedMatch.name || suggestedMatch.nombre} ({suggestedMatch.date || suggestedMatch.fecha_evento || '—'})
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setForm(f => ({ ...f, eventoId: suggestedMatch.id }))}
                            style={{
                              background: '#059669', color: '#ffffff', border: 'none',
                              borderRadius: '6px', padding: '4px 10px', fontSize: '11.5px', fontWeight: 800,
                              cursor: 'pointer', flexShrink: 0,
                            }}
                          >
                            ✓ Vincular
                          </button>
                        </div>
                      )}

                      <select
                        value={form.eventoId || ''}
                        onChange={e => setForm(f => ({ ...f, eventoId: e.target.value }))}
                        style={{ ...inputStyle, fontSize: '12px' }}
                      >
                        <option value="">— Ninguna reserva vinculada (Sin vincular) —</option>
                        {availableEventsList.map(ev => (
                          <option key={ev.id} value={ev.id}>
                            {ev.name || ev.nombre} ({ev.date || ev.fecha_evento || 'Sin fecha'}) — {ev.status || ev.estado || 'Sin estado'}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

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
