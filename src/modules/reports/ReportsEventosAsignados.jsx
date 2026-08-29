import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useOutletContext, useNavigate, useSearchParams } from 'react-router-dom';
import ReportInfo from './components/ReportInfo';
import MultiSelect from './components/MultiSelect';
import api from '../../services/api';
import {
  Handshake, Search, Link2, BarChart3, TrendingUp,
  CheckCircle, Clock, Users, Rocket, AlertTriangle, Eye, Repeat,
  Filter, ListFilter, History, Calendar, HelpCircle, X,
  Inbox, FileText, Loader2,
} from 'lucide-react';

// ─── Constantes de estado (alineadas con PosiblesVentasModule) ────────────
const ESTADOS = [
  { key: 'pendiente',   label: 'Pendiente',   color: '#f59e0b' },
  { key: 'en_proceso',  label: 'En proceso',  color: '#3b82f6' },
  { key: 'ganada',      label: 'Ganada',      color: '#10b981' },
  { key: 'perdida',     label: 'Perdida',     color: '#ef4444' },
];
const ESTADO_SET = new Set(ESTADOS.map(e => e.key));
const ESTADO_BY_KEY = Object.fromEntries(ESTADOS.map(e => [e.key, e]));

const PAX_BUCKETS = [
  { key: '0-50',     label: '0–50',     min: 0,   max: 50 },
  { key: '51-100',   label: '51–100',   min: 51,  max: 100 },
  { key: '101-200',  label: '101–200',  min: 101, max: 200 },
  { key: '201-500',  label: '201–500',  min: 201, max: 500 },
  { key: '500+',     label: '500+',     min: 501, max: Infinity },
];

const STALE_DAYS = 7;
const HOURS_MS = 3600 * 1000;
const DAYS_MS = 24 * HOURS_MS;

function getLocalDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function monthName(m) {
  return ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][m] || '';
}

function parseDateSafe(v) {
  if (!v) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  const s = String(v);
  // Acepta 'YYYY-MM-DD HH:MM:SS' y 'YYYY-MM-DDTHH:MM:SS'
  const norm = s.includes('T') ? s : s.replace(' ', 'T');
  const d = new Date(norm);
  return Number.isNaN(d.getTime()) ? null : d;
}

function getAssignmentDate(lead) {
  // asignadoEn puede ser null en posibles ventas históricas → fallback a creadoEn
  const a = parseDateSafe(lead.asignadoEn);
  if (a) return { date: a, isFallback: false };
  const c = parseDateSafe(lead.creadoEn);
  if (c) return { date: c, isFallback: true };
  return { date: null, isFallback: false };
}

function getResponseMs(lead) {
  const { date: asignado } = getAssignmentDate(lead);
  const primer = parseDateSafe(lead.primerSeguimientoEn);
  if (!asignado || !primer) return null;
  const ms = primer.getTime() - asignado.getTime();
  return ms >= 0 ? ms : null;
}

function formatDuration(ms) {
  if (ms === null || ms === undefined) return '—';
  if (ms < HOURS_MS) return `${Math.round(ms / 60000)} min`;
  if (ms < DAYS_MS) return `${(ms / HOURS_MS).toFixed(1)} h`;
  return `${(ms / DAYS_MS).toFixed(1)} d`;
}

function bucketOf(ms) {
  if (ms === null || ms === undefined) return { key: 'none', label: 'Sin respuesta', color: '#94a3b8' };
  if (ms <= 4 * HOURS_MS) return { key: 'lt4h',   label: '≤ 4 h',   color: '#10b981' };
  if (ms <= 24 * HOURS_MS) return { key: 'lt24h', label: '≤ 24 h',  color: '#22c55e' };
  if (ms <= 72 * HOURS_MS) return { key: 'lt72h', label: '≤ 72 h',  color: '#f59e0b' };
  if (ms <= 7 * DAYS_MS)   return { key: 'lt7d',  label: '≤ 7 d',   color: '#f97316' };
  return { key: 'gt7d', label: '> 7 d', color: '#ef4444' };
}

function daysSince(d) {
  if (!d) return null;
  return Math.floor((Date.now() - d.getTime()) / DAYS_MS);
}

function median(arr) {
  if (!arr.length) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function startOfWeek(d) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // lunes = 0
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - day);
  return x;
}

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function bucketKey(date, granularity) {
  if (granularity === 'day') return getLocalDateStr(date);
  if (granularity === 'week') {
    const w = startOfWeek(date);
    return getLocalDateStr(w);
  }
  // month
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function bucketLabel(key, granularity) {
  if (granularity === 'day') {
    const d = new Date(key + 'T00:00:00');
    return `${d.getDate()} ${monthName(d.getMonth())}`;
  }
  if (granularity === 'week') {
    const d = new Date(key + 'T00:00:00');
    return `${d.getDate()} ${monthName(d.getMonth())}`;
  }
  // month
  const [y, m] = key.split('-').map(Number);
  return `${monthName(m - 1)} ${y}`;
}

// ─── Descripciones y fórmulas de cada KPI (usadas en el tooltip) ────────
const KPI_META = {
  total: {
    desc: 'Cantidad de posibles ventas del flujo comercial que recibieron un vendedor (o fueron creadas) en el rango de fechas seleccionado.',
    calc: 'COUNT(*) sobre posibles_ventas WHERE asignado_en ∈ [desde, hasta] (fallback: creado_en).',
  },
  tasaCierre: {
    desc: 'Porcentaje de posibles ventas cerradas que terminaron como ganada. Mide la efectividad de conversión del flujo comercial.',
    calc: 'ganada / (ganada + perdida) × 100. Sólo cuenta posibles ventas con estado final cerrado.',
  },
  respuestaProm: {
    desc: 'Tiempo promedio entre la asignación de la posible venta y el primer seguimiento del vendedor. Indica velocidad de reacción general del equipo.',
    calc: 'AVG(primer_seguimiento_en − asignado_en) sobre posibles ventas con seguimiento, en milisegundos.',
  },
  p90: {
    desc: 'Percentil 90 del tiempo de respuesta. Indica el tiempo en el que el 90% de las posibles ventas ya recibieron su primer seguimiento. Sirve para detectar la "cola larga" de respuestas tardías.',
    calc: 'p90 de (primer_seguimiento_en − asignado_en). Complementa al promedio, que se distorsiona con valores extremos.',
  },
  pax: {
    desc: 'Suma total y promedio de PAX de los eventos asignados en el rango. Da una idea del tamaño del flujo comercial en volumen de personas.',
    calc: 'SUM(pax) y AVG(pax) sobre el set filtrado.',
  },
  diasHastaEvento: {
    desc: 'Mediana de días que hay entre la asignación de la posible venta y la fecha del evento. Detecta asignaciones tardías (ej: posible venta asignada 2 días antes del evento).',
    calc: 'MEDIAN(fecha_evento − asignado_en), en días, sobre posibles ventas con ambos timestamps.',
  },
  velocidadCierre: {
    desc: 'Mediana de días que tarda una posible venta en pasar de "asignada" a un estado final (ganada o perdida).',
    calc: 'MEDIAN(actualizado_en − asignado_en) sobre posibles ventas con estado ganada o perdida.',
  },
  stale: {
    desc: 'Posibles ventas activas (pendiente o en_proceso) sin seguimiento en más de N días. Configurable con el filtro "Sin seguimiento (días)".',
    calc: 'COUNT(*) WHERE estado ∈ {pendiente, en_proceso} AND NOW() − COALESCE(ultimo_seguimiento_en, asignado_en) ≥ N días.',
  },
  huerfanos: {
    desc: 'Porcentaje de posibles ventas asignadas hace más de 24 horas que aún no recibieron ningún primer seguimiento.',
    calc: 'COUNT(WHERE primer_seguimiento_en IS NULL AND NOW() − asignado_en > 24h) / total × 100.',
  },
  recurrentes: {
    desc: 'Cantidad de posibles ventas cuyo teléfono o correo aparece en más de una del conjunto filtrado. Mide recurrencia de demanda.',
    calc: 'COUNT(DISTINCT id) WHERE telefono O correo aparece en > 1 posible venta del universo filtrado.',
  },
};

export default function ReportsEventosAsignados({ onClose }) {
  const { users } = useOutletContext();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // ── Carga inicial desde query params (deep link) ───────────────────────
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const [fromDate, setFromDate] = useState(searchParams.get('from') || getLocalDateStr(firstOfMonth));
  const [toDate,   setToDate]   = useState(searchParams.get('to')   || getLocalDateStr(lastOfMonth));
  const [vendorSel, setVendorSel] = useState(() => {
    const v = searchParams.get('vendor');
    return v ? new Set(v.split(',').filter(Boolean)) : new Set();
  });
  const [estadoSel, setEstadoSel] = useState(() => {
    const e = searchParams.get('estado');
    return e ? new Set(e.split(',').filter(Boolean).filter(x => ESTADO_SET.has(x))) : new Set();
  });
  const [staleDays, setStaleDays] = useState(() => {
    const n = parseInt(searchParams.get('stale'), 10);
    return Number.isFinite(n) && n > 0 ? n : STALE_DAYS;
  });
  const [granularity, setGranularity] = useState(() => {
    const g = searchParams.get('gran');
    return ['day', 'week', 'month'].includes(g) ? g : 'week';
  });

  // ── Data fetching ──────────────────────────────────────────────────────
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadLeads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get('/api/posibles-ventas');
      setLeads(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('[ReportsEventosAsignados] load error:', err);
      setError(err.message || 'No se pudo cargar la información.');
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadLeads(); }, [loadLeads]);

  // ── Persistir filtros en query params (deep link) ──────────────────────
  useEffect(() => {
    const next = new URLSearchParams();
    if (fromDate) next.set('from', fromDate);
    if (toDate)   next.set('to', toDate);
    if (vendorSel.size) next.set('vendor', [...vendorSel].join(','));
    if (estadoSel.size) next.set('estado', [...estadoSel].join(','));
    if (staleDays !== STALE_DAYS) next.set('stale', String(staleDays));
    if (granularity !== 'week') next.set('gran', granularity);
    setSearchParams(next, { replace: true });
  }, [fromDate, toDate, vendorSel, estadoSel, staleDays, granularity, setSearchParams]);

  // ── Opciones de filtros ───────────────────────────────────────────────
  const vendors = useMemo(() => {
    return (users || [])
      .filter(u => {
        const r = String(u.role || u.rol || '').toLowerCase();
        return r === 'vendedor';
      })
      .map(u => ({ value: String(u.id), label: u.fullName || u.name || u.id }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es'));
  }, [users]);

  const estadoOptions = ESTADOS.map(e => ({ value: e.key, label: e.label, color: e.color }));

  // ── Filtrado por rango de fechas + vendedor + estado ───────────────────
  const filtered = useMemo(() => {
    const from = fromDate || '0000-00-00';
    const to = toDate || '9999-99-99';
    return leads.filter(l => {
      const { date } = getAssignmentDate(l);
      if (!date) return false;
      const ds = getLocalDateStr(date);
      if (ds < from || ds > to) return false;
      if (vendorSel.size > 0) {
        const vid = String(l.vendedorId || '');
        if (!vendorSel.has(vid)) return false;
      }
      if (estadoSel.size > 0) {
        if (!estadoSel.has(l.estado)) return false;
      }
      return true;
    });
  }, [leads, fromDate, toDate, vendorSel, estadoSel]);

  // ── Detección de clientes recurrentes (teléfono o correo) ─────────────
  const recurrentSet = useMemo(() => {
    const counts = new Map();
    for (const l of leads) {
      const k1 = String(l.telefono || '').trim().toLowerCase();
      const k2 = String(l.correo || '').trim().toLowerCase();
      if (k1) counts.set(`t:${k1}`, (counts.get(`t:${k1}`) || 0) + 1);
      if (k2) counts.set(`e:${k2}`, (counts.get(`e:${k2}`) || 0) + 1);
    }
    const set = new Set();
    for (const l of leads) {
      const k1 = String(l.telefono || '').trim().toLowerCase();
      const k2 = String(l.correo || '').trim().toLowerCase();
      if ((k1 && (counts.get(`t:${k1}`) || 0) > 1) || (k2 && (counts.get(`e:${k2}`) || 0) > 1)) {
        set.add(String(l.id));
      }
    }
    return set;
  }, [leads]);

  // ── KPIs ──────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const total = filtered.length;
    const conVendedor = filtered.filter(l => l.vendedorId).length;
    const sinVendedor = total - conVendedor;
    const responseMs = filtered.map(l => getResponseMs(l)).filter(x => x !== null);
    const huérfanos = responseMs.length === 0 ? 0
      : filtered.filter(l => {
          const r = getResponseMs(l);
          // Huérfano = nunca tuvo seguimiento y lleva más de 24h asignado
          if (r !== null) return false;
          const { date } = getAssignmentDate(l);
          if (!date) return false;
          return (Date.now() - date.getTime()) > 24 * HOURS_MS;
        }).length;
    const cerrados = filtered.filter(l => l.estado === 'ganada' || l.estado === 'perdida');
    const ganadas = filtered.filter(l => l.estado === 'ganada').length;
    const tasaCierre = cerrados.length > 0 ? (ganadas / cerrados.length) : 0;
    const velocidadCierre = (() => {
      const ms = [];
      for (const l of cerrados) {
        const fin = parseDateSafe(l.actualizadoEn || l.ultimoSeguimientoEn || l.creadoEn);
        const { date: ini } = getAssignmentDate(l);
        if (fin && ini) ms.push(fin.getTime() - ini.getTime());
      }
      return median(ms);
    })();
    const paxTotal = filtered.reduce((s, l) => s + (Number(l.pax) || 0), 0);
    const paxAvg = total > 0 ? paxTotal / total : 0;
    const diasHastaEvento = (() => {
      const ms = [];
      for (const l of filtered) {
        const ev = parseDateSafe(l.fechaEvento);
        const { date: ini } = getAssignmentDate(l);
        if (ev && ini) {
          const d = (ev.getTime() - ini.getTime()) / DAYS_MS;
          if (d >= 0 && d < 365) ms.push(d);
        }
      }
      return median(ms);
    })();
    const staleCount = filtered.filter(l => {
      if (l.estado !== 'pendiente' && l.estado !== 'en_proceso') return false;
      const last = parseDateSafe(l.ultimoSeguimientoEn);
      const ref = last || (() => {
        const { date } = getAssignmentDate(l);
        return date;
      })();
      if (!ref) return false;
      return daysSince(ref) >= staleDays;
    }).length;
    const recurrentes = filtered.filter(l => recurrentSet.has(String(l.id))).length;

    return {
      total,
      conVendedor,
      sinVendedor,
      pctAsignados: total > 0 ? conVendedor / total : 0,
      pctHuérfanos: total > 0 ? huérfanos / total : 0,
      promedioRespuestaMs: responseMs.length ? responseMs.reduce((a, b) => a + b, 0) / responseMs.length : null,
      medianaRespuestaMs: median(responseMs),
      p75RespuestaMs: (() => {
        if (!responseMs.length) return null;
        const s = [...responseMs].sort((a, b) => a - b);
        return s[Math.floor(s.length * 0.75)];
      })(),
      p90RespuestaMs: (() => {
        if (!responseMs.length) return null;
        const s = [...responseMs].sort((a, b) => a - b);
        return s[Math.floor(s.length * 0.90)];
      })(),
      tasaCierre,
      velocidadCierreMs: velocidadCierre,
      paxTotal,
      paxAvg,
      diasHastaEvento,
      staleCount,
      recurrentes,
    };
  }, [filtered, recurrentSet, staleDays]);

  // ── Distribución por estado × vendedor (gráfico 1) ────────────────────
  const byVendorEstado = useMemo(() => {
    const map = new Map();
    let sinAsignar = { name: 'Sin asignar', total: 0, byEstado: {} };
    for (const l of filtered) {
      const vid = String(l.vendedorId || '');
      let entry;
      if (vid) {
        if (!map.has(vid)) {
          const u = (users || []).find(x => String(x.id) === vid);
          map.set(vid, {
            vendorId: vid,
            name: u ? (u.fullName || u.name) : vid,
            total: 0,
            byEstado: {},
          });
        }
        entry = map.get(vid);
      } else {
        entry = sinAsignar;
      }
      entry.total += 1;
      entry.byEstado[l.estado] = (entry.byEstado[l.estado] || 0) + 1;
    }
    const rows = [...map.values()].sort((a, b) => b.total - a.total);
    if (sinAsignar.total > 0) rows.push(sinAsignar);
    return rows;
  }, [filtered, users]);

  // ── Serie temporal (gráfico 2) ─────────────────────────────────────────
  const timeSeries = useMemo(() => {
    if (!filtered.length) return { buckets: [], granularity };
    const counts = new Map();
    const resp = new Map();
    for (const l of filtered) {
      const { date } = getAssignmentDate(l);
      if (!date) continue;
      const key = bucketKey(date, granularity);
      counts.set(key, (counts.get(key) || 0) + 1);
      const r = getResponseMs(l);
      if (r !== null) {
        if (!resp.has(key)) resp.set(key, []);
        resp.get(key).push(r);
      }
    }
    // Generar buckets contiguos en el rango
    const start = new Date(fromDate + 'T00:00:00');
    const end = new Date(toDate + 'T00:00:00');
    const out = [];
    const cur = granularity === 'month' ? startOfMonth(start) : (granularity === 'week' ? startOfWeek(start) : new Date(start));
    while (cur <= end) {
      const key = bucketKey(cur, granularity);
      out.push({
        key,
        label: bucketLabel(key, granularity),
        count: counts.get(key) || 0,
        avgRespMs: resp.has(key) ? resp.get(key).reduce((a, b) => a + b, 0) / resp.get(key).length : null,
      });
      if (granularity === 'day')   cur.setDate(cur.getDate() + 1);
      if (granularity === 'week')  cur.setDate(cur.getDate() + 7);
      if (granularity === 'month') cur.setMonth(cur.getMonth() + 1);
    }
    return { buckets: out, granularity };
  }, [filtered, fromDate, toDate, granularity]);

  // ── Embudo de conversión (gráfico 3) ──────────────────────────────────
  const funnel = useMemo(() => {
    const asignados = filtered.length;
    const conSeguimiento = filtered.filter(l => l.primerSeguimientoEn).length;
    const enProceso = filtered.filter(l => l.estado === 'en_proceso' || l.estado === 'ganada').length;
    const ganadas = filtered.filter(l => l.estado === 'ganada').length;
    return [
      { key: 'asignados',     label: 'Asignados',         count: asignados,        color: '#0d9488' },
      { key: 'seguimiento',   label: '1er seguimiento',   count: conSeguimiento,   color: '#3b82f6' },
      { key: 'en_proceso',    label: 'En proceso',        count: enProceso,        color: '#f59e0b' },
      { key: 'ganada',        label: 'Ganada',            count: ganadas,          color: '#10b981' },
    ];
  }, [filtered]);

  // ── Heatmap día×hora (gráfico 4) ─────────────────────────────────────
  const heatmap = useMemo(() => {
    const matrix = Array.from({ length: 7 }, () => Array(24).fill(0));
    let max = 0;
    for (const l of filtered) {
      const { date } = getAssignmentDate(l);
      if (!date) continue;
      const dow = (date.getDay() + 6) % 7; // lunes=0
      const hr = date.getHours();
      matrix[dow][hr] += 1;
      if (matrix[dow][hr] > max) max = matrix[dow][hr];
    }
    return { matrix, max };
  }, [filtered]);

  // ── Top-N (Salones / Servicios / Vendedores) ─────────────────────────
  const topN = useMemo(() => {
    const countBy = (arr) => {
      const m = new Map();
      for (const a of arr || []) {
        const k = String(a || '').trim();
        if (!k) continue;
        m.set(k, (m.get(k) || 0) + 1);
      }
      return [...m.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
    };
    return {
      salones: countBy(filtered.flatMap(l => l.salones || [])),
      servicios: countBy(filtered.flatMap(l => l.servicios || [])),
      vendedores: byVendorEstado.filter(r => r.vendorId).slice(0, 5),
    };
  }, [filtered, byVendorEstado]);

  // ── Stale leads (lista accionable) ────────────────────────────────────
  const staleLeads = useMemo(() => {
    return filtered
      .filter(l => {
        if (l.estado !== 'pendiente' && l.estado !== 'en_proceso') return false;
        const last = parseDateSafe(l.ultimoSeguimientoEn);
        const ref = last || (() => {
          const { date } = getAssignmentDate(l);
          return date;
        })();
        if (!ref) return false;
        return daysSince(ref) >= staleDays;
      })
      .sort((a, b) => {
        const { date: aDate } = getAssignmentDate(a);
        const { date: bDate } = getAssignmentDate(b);
        return (aDate?.getTime() || 0) - (bDate?.getTime() || 0);
      })
      .slice(0, 12);
  }, [filtered, staleDays]);

  // ── Tabla detallada (search + sort) ──────────────────────────────────
  const [tableSearch, setTableSearch] = useState('');
  const [tableSort, setTableSort] = useState({ key: 'asignadoEn', dir: 'desc' });
  const [tableStatus, setTableStatus] = useState(new Set()); // filtro por estado local para la tabla (al click en chart)

  const tableFiltered = useMemo(() => {
    const q = tableSearch.trim().toLowerCase();
    let rows = filtered;
    if (tableStatus.size > 0) {
      rows = rows.filter(r => tableStatus.has(r.estado));
    }
    if (q) {
      rows = rows.filter(r => {
        const hay = [
          r.nombreCliente, r.vendedorNombre, r.creadoPorNombre,
          (r.salones || []).join(' '), (r.servicios || []).join(' '),
          r.notas, r.telefono, r.correo, r.estado,
        ].filter(Boolean).join(' ').toLowerCase();
        return hay.includes(q);
      });
    }
    const sorted = [...rows];
    const k = tableSort.key;
    const dir = tableSort.dir === 'asc' ? 1 : -1;
    sorted.sort((a, b) => {
      let av, bv;
      switch (k) {
        case 'asignadoEn': {
          const { date: aD } = getAssignmentDate(a);
          const { date: bD } = getAssignmentDate(b);
          av = aD?.getTime() || 0; bv = bD?.getTime() || 0; break;
        }
        case 'cliente': av = (a.nombreCliente || '').toLowerCase(); bv = (b.nombreCliente || '').toLowerCase(); break;
        case 'vendedor': av = (a.vendedorNombre || '').toLowerCase(); bv = (b.vendedorNombre || '').toLowerCase(); break;
        case 'estado': av = a.estado || ''; bv = b.estado || ''; break;
        case 'respuesta': av = getResponseMs(a) ?? Infinity; bv = getResponseMs(b) ?? Infinity; break;
        case 'pax': av = a.pax || 0; bv = b.pax || 0; break;
        case 'diasEvento': {
          const ev = parseDateSafe(a.fechaEvento);
          const { date: ini } = getAssignmentDate(a);
          av = (ev && ini) ? (ev.getTime() - ini.getTime()) / DAYS_MS : Infinity;
          const ev2 = parseDateSafe(b.fechaEvento);
          const { date: ini2 } = getAssignmentDate(b);
          bv = (ev2 && ini2) ? (ev2.getTime() - ini2.getTime()) / DAYS_MS : Infinity;
          break;
        }
        default: av = 0; bv = 0;
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return sorted;
  }, [filtered, tableSearch, tableSort, tableStatus]);

  // ── Storytelling ──────────────────────────────────────────────────────
  const story = useMemo(() => {
    const fromTxt = fromDate;
    const toTxt = toDate;
    const totalTxt = kpis.total;
    const vendorCount = byVendorEstado.filter(r => r.vendorId).length;
    const promTxt = kpis.promedioRespuestaMs !== null ? formatDuration(kpis.promedioRespuestaMs) : '—';
    const p24 = (() => {
      if (!kpis.total) return 0;
      const n = filtered.filter(l => {
        const r = getResponseMs(l);
        return r !== null && r <= 24 * HOURS_MS;
      }).length;
      return Math.round((n / kpis.total) * 100);
    })();
    return `Del ${fromTxt} al ${toTxt} se asignaron ${totalTxt} eventos a ${vendorCount} vendedores. El tiempo de respuesta promedio fue de ${promTxt}, con un ${p24}% que recibió respuesta en menos de 24h.`;
  }, [kpis, fromDate, toDate, byVendorEstado, filtered]);

  // ── Helpers UI ────────────────────────────────────────────────────────
  const formatDate = (v) => {
    const d = parseDateSafe(v);
    if (!d) return '—';
    return `${getLocalDateStr(d)} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  };
  const onSort = (key) => {
    setTableSort(s => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' });
  };
  const sortIcon = (key) => {
    if (tableSort.key !== key) return '↕';
    return tableSort.dir === 'asc' ? '↑' : '↓';
  };

  // ── Reset filtros ─────────────────────────────────────────────────────
  const handleReset = () => {
    const t = new Date();
    setFromDate(getLocalDateStr(new Date(t.getFullYear(), t.getMonth(), 1)));
    setToDate(getLocalDateStr(new Date(t.getFullYear(), t.getMonth() + 1, 0)));
    setVendorSel(new Set());
    setEstadoSel(new Set());
    setStaleDays(STALE_DAYS);
    setGranularity('week');
    setTableStatus(new Set());
  };

  // ── Export PDF (formato profesional con jsPDF nativo) ──────────────────
  const [pdfLoading, setPdfLoading] = useState(false);

  const handleExportPDF = async () => {
    setPdfLoading(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 14;
      const usableW = pageW - margin * 2;

      // Paleta
      const NAVY = [15, 23, 42];
      const TEAL = [13, 148, 136];
      const GRAY = [100, 116, 139];
      const BORDER = [226, 232, 240];
      const ROW_ALT = [248, 250, 252];

      // Helper: dibuja el footer de página (la cantidad de páginas se actualiza al final)
      const drawFooter = (pageNum) => {
        pdf.setDrawColor(...BORDER);
        pdf.setLineWidth(0.2);
        pdf.line(margin, pageH - 12, pageW - margin, pageH - 12);
        pdf.setTextColor(...GRAY);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7.5);
        pdf.text('EMS Reservas · Jardines del Lago', margin, pageH - 7);
        pdf.text(
          `Generado: ${new Date().toLocaleString('es-GT')}  ·  Página ${pageNum}`,
          pageW - margin,
          pageH - 7,
          { align: 'right' }
        );
      };

      let pageNum = 1;
      let y = margin;

      // ── Header band (color teal) ───────────────────────────────────
      pdf.setFillColor(...TEAL);
      pdf.rect(0, 0, pageW, 28, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(15);
      pdf.text('JARDINES DEL LAGO', margin, 12);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8.5);
      pdf.text('EMS Reservas  ·  Reporte de Eventos Asignados', margin, 18);
      // Sello de fecha a la derecha
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.text('FECHA DE GENERACIÓN', pageW - margin, 10, { align: 'right' });
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.text(new Date().toLocaleString('es-GT'), pageW - margin, 16, { align: 'right' });
      pdf.setFontSize(7.5);
      pdf.setTextColor(220, 252, 231);
      pdf.text('Documento generado automáticamente', pageW - margin, 21, { align: 'right' });

      y = 38;

      // ── Title ──────────────────────────────────────────────────────
      pdf.setTextColor(...NAVY);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(20);
      pdf.text('Eventos Asignados', margin, y);
      y += 6;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9.5);
      pdf.setTextColor(...GRAY);
      pdf.text('Fechas de asignación · Tiempo de respuesta · Distribución por vendedor y estado', margin, y);
      y += 8;

      // ── Metadata block (grid 3×2 limpio) ──────────────────────────
      const metaY = y;
      const metaH = 28;
      const cellW = usableW / 3;
      // Fondo y borde
      pdf.setFillColor(248, 250, 252);
      pdf.rect(margin, metaY, usableW, metaH, 'F');
      pdf.setDrawColor(...BORDER);
      pdf.setLineWidth(0.2);
      pdf.rect(margin, metaY, usableW, metaH);
      // Divisorias verticales entre las 3 celdas
      pdf.setDrawColor(...BORDER);
      pdf.setLineWidth(0.15);
      pdf.line(margin + cellW,     metaY, margin + cellW,     metaY + metaH);
      pdf.line(margin + cellW * 2, metaY, margin + cellW * 2, metaY + metaH);
      // Divisorias horizontales (entre fila 1 y fila 2)
      pdf.line(margin, metaY + metaH / 2, margin + usableW, metaY + metaH / 2);

      // Helper: escribe una celda (label arriba, valor abajo)
      const writeCell = (col, row, label, value) => {
        const cx = margin + col * cellW;
        const cy = metaY + row * (metaH / 2);
        // Label
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(7);
        pdf.setTextColor(...GRAY);
        pdf.text(label, cx + 3, cy + 5);
        // Value
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(11);
        pdf.setTextColor(...NAVY);
        // Truncar el value si es muy largo (cabe ~cellW-6 mm)
        let v = String(value);
        const maxW = cellW - 6;
        while (pdf.getTextWidth(v) > maxW && v.length > 1) v = v.slice(0, -1);
        if (v !== String(value) && v.length > 1) v = v.slice(0, -1) + '…';
        pdf.text(v, cx + 3, cy + 13);
      };

      const periodTxt = `${fromDate}  al  ${toDate}`;
      const vendorsTxt = vendorSel.size === 0
        ? 'Todos los vendedores'
        : `${vendorSel.size} seleccionado${vendorSel.size > 1 ? 's' : ''}`;
      const estadosTxt = estadoSel.size === 0
        ? 'Todos los estados'
        : `${estadoSel.size} seleccionado${estadoSel.size > 1 ? 's' : ''}`;
      const totalTxt = String(kpis.total);
      const staleTxt = `${kpis.staleCount}  (>= ${staleDays}d)`;
      const cierreTxt = kpis.cerrados ? `${Math.round(kpis.tasaCierre * 100)}%` : '-';

      writeCell(0, 0, 'PERÍODO',       periodTxt);
      writeCell(1, 0, 'VENDEDORES',     vendorsTxt);
      writeCell(2, 0, 'ESTADOS',        estadosTxt);
      writeCell(0, 1, 'TOTAL LEADS',         totalTxt);
      writeCell(1, 1, 'SIN SEGUIMIENTO',     staleTxt);
      writeCell(2, 1, 'TASA DE CIERRE',      cierreTxt);

      y = metaY + metaH + 8;

      // ── KPIs grid ─────────────────────────────────────────────────
      pdf.setTextColor(...NAVY);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.text('Indicadores clave', margin, y);
      y += 5;

      const kpiItems = [
        { label: 'Total asignados',    value: String(kpis.total),                                                       color: [13, 148, 136] },
        { label: 'Tasa de cierre',     value: kpis.cerrados ? `${Math.round(kpis.tasaCierre * 100)}%` : '—',            color: [16, 185, 129] },
        { label: 'Respuesta prom.',    value: kpis.promedioRespuestaMs !== null ? formatDuration(kpis.promedioRespuestaMs) : '—', color: [59, 130, 246] },
        { label: '90% respondido en',  value: kpis.p90RespuestaMs !== null ? formatDuration(kpis.p90RespuestaMs) : '—',     color: [245, 158, 11] },
        { label: 'PAX',                value: kpis.paxTotal.toLocaleString('en-US'),                                    color: [139, 92, 246] },
        { label: 'Días hasta evento',  value: kpis.diasHastaEvento !== null ? `${Math.round(kpis.diasHastaEvento)} d` : '—', color: [14, 165, 233] },
        { label: 'Vel. de cierre',     value: kpis.velocidadCierreMs !== null ? `${(kpis.velocidadCierreMs / DAYS_MS).toFixed(1)} d` : '—', color: [236, 72, 153] },
        { label: 'Posibles ventas\nsin seguimiento', value: String(kpis.staleCount),                              color: [249, 115, 22] },
        { label: 'Huérfanos',          value: `${Math.round(kpis.pctHuérfanos * 100)}%`,                               color: [239, 68, 68] },
        { label: 'Recurrentes',        value: String(kpis.recurrentes),                                                 color: [20, 184, 166] },
      ];

      const kpiCols = 5;
      const kpiGap = 3;
      const kpiW = (usableW - (kpiCols - 1) * kpiGap) / kpiCols;
      const kpiH = 19;
      kpiItems.forEach((k, i) => {
        const col = i % kpiCols;
        const row = Math.floor(i / kpiCols);
        const kx = margin + col * (kpiW + kpiGap);
        const ky = y + row * (kpiH + kpiGap);
        // Background teñido
        const [r, g, b] = k.color;
        pdf.setFillColor(r, g, b);
        // Tinte claro via opacidad (jsPDF soporta setGState)
        if (pdf.setGState) {
          const gs = new pdf.GState({ opacity: 0.07 });
          pdf.setGState(gs);
          pdf.rect(kx, ky, kpiW, kpiH, 'F');
          pdf.setGState(new pdf.GState({ opacity: 1 }));
        } else {
          pdf.rect(kx, ky, kpiW, kpiH, 'F');
        }
        // Borde
        pdf.setDrawColor(r, g, b);
        pdf.setLineWidth(0.4);
        pdf.rect(kx, ky, kpiW, kpiH);
        // Banda superior con el color sólido
        pdf.setFillColor(r, g, b);
        pdf.rect(kx, ky, kpiW, 1.2, 'F');
        // Label
        pdf.setTextColor(r, g, b);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(7);
        // Soporta label multi-línea con \n
        const labelLines = k.label.toUpperCase().split('\n');
        if (labelLines.length === 1) {
          pdf.text(labelLines[0], kx + 2, ky + 6);
        } else {
          pdf.text(labelLines[0], kx + 2, ky + 4.5);
          pdf.text(labelLines[1], kx + 2, ky + 8);
        }
        // Value (más abajo si el label tiene 2 líneas)
        const valueY = labelLines.length > 1 ? ky + 14 : ky + 13;
        pdf.setTextColor(...NAVY);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(13);
        pdf.text(String(k.value), kx + 2, valueY);
      });

      y += (kpiH + kpiGap) * 2 + 8;

      // ── Detalle: tabla paginada ───────────────────────────────────
      const rows = tableFiltered.length ? tableFiltered : filtered;
      // Calcular anchos de columna (proporcionales, suman = usableW)
      const colDefs = [
        { label: 'Fecha',          p: 0.14 },
        { label: 'Cliente',        p: 0.19 },
        { label: 'Vendedor',       p: 0.17 },
        { label: 'Estado',         p: 0.12 },
        { label: 'Respuesta',      p: 0.12 },
        { label: 'PAX',            p: 0.06 },
        { label: 'Días al\nevento', p: 0.20 },
      ];
      const sumP = colDefs.reduce((a, c) => a + c.p, 0);
      const colWidths = colDefs.map(c => (c.p / sumP) * usableW);

      // Helper: dibuja el header de la tabla en Y actual
      const drawTableHeader = (yPos) => {
        pdf.setFillColor(...NAVY);
        pdf.rect(margin, yPos, usableW, 8, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(7.5);
        let cx = margin;
        colDefs.forEach((c, i) => {
          const lines = c.label.toUpperCase().split('\n');
          // Línea 1 arriba, línea 2 (si hay) más abajo; centradas verticalmente en 8mm
          if (lines.length === 1) {
            pdf.text(lines[0], cx + 2, yPos + 5.5);
          } else {
            pdf.text(lines[0], cx + 2, yPos + 4);
            pdf.text(lines[1], cx + 2, yPos + 7.2);
          }
          cx += colWidths[i];
        });
      };

      // Título de la sección
      pdf.setTextColor(...NAVY);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.text(`Detalle (${rows.length} ${rows.length === 1 ? 'posible venta' : 'posibles ventas'})`, margin, y);
      y += 4;

      // Si no hay filas, mensaje y nada más
      if (rows.length === 0) {
        pdf.setFont('helvetica', 'italic');
        pdf.setFontSize(9.5);
        pdf.setTextColor(...GRAY);
        pdf.text('No hay posibles ventas en el rango seleccionado con los filtros aplicados.', margin, y + 8);
        y += 14;
      } else {
        drawTableHeader(y);
        y += 8;

        const rowH = 6;
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);

        rows.forEach((l, idx) => {
          // Salto de página si no entra la fila + footer + header repetido
          if (y + rowH + 14 > pageH - 12) {
            drawFooter(pageNum);
            pageNum += 1;
            pdf.addPage();
            y = margin;
            // Redibujar título + header de la tabla
            pdf.setTextColor(...NAVY);
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(11);
            pdf.text('Eventos Asignados (continuación)', margin, y);
            y += 6;
            drawTableHeader(y);
            y += 8;
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(8);
          }

          // Zebra bg
          if (idx % 2 === 1) {
            pdf.setFillColor(...ROW_ALT);
            pdf.rect(margin, y, usableW, rowH, 'F');
          }
          // Línea inferior
          pdf.setDrawColor(...BORDER);
          pdf.setLineWidth(0.1);
          pdf.line(margin, y + rowH, margin + usableW, y + rowH);

          // Celdas
          const { date: asignado } = getAssignmentDate(l);
          const resp = getResponseMs(l);
          const bucket = bucketOf(resp);
          const ev = parseDateSafe(l.fechaEvento);
          const diasEv = (ev && asignado) ? Math.round((ev.getTime() - asignado.getTime()) / DAYS_MS) : null;

          const cells = [
            asignado ? formatDate(asignado) : '-',
            l.nombreCliente || '-',
            l.vendedorNombre || 'Sin asignar',
            (l.estado || '-').replace('_', ' '),
            bucket.label,
            l.pax ? String(l.pax) : '-',
            diasEv !== null ? `${diasEv} d` : '-',
          ];

          // Color de la celda de estado (basado en color del estado)
          let cx = margin;
          cells.forEach((txt, i) => {
            // Truncar si se pasa del ancho
            let display = String(txt);
            const maxW = colWidths[i] - 3;
            while (pdf.getTextWidth(display) > maxW && display.length > 1) {
              display = display.slice(0, -1);
            }
            if (display !== String(txt) && display.length > 0) {
              display = display.slice(0, -1) + '…';
            }
            // Color por columna especial
            if (i === 3 && ESTADO_BY_KEY[l.estado]) {
              const ec = hexToRgb(ESTADO_BY_KEY[l.estado].color);
              pdf.setTextColor(ec[0], ec[1], ec[2]);
              pdf.setFont('helvetica', 'bold');
            } else if (i === 4) {
              const bc = hexToRgb(bucket.color);
              pdf.setTextColor(bc[0], bc[1], bc[2]);
              pdf.setFont('helvetica', 'bold');
            } else if (i === 6 && diasEv !== null && diasEv < 7) {
              pdf.setTextColor(220, 38, 38); // rojo si <7 días
              pdf.setFont('helvetica', 'bold');
            } else {
              pdf.setTextColor(...NAVY);
              pdf.setFont('helvetica', 'normal');
            }
            pdf.text(display, cx + 2, y + 4);
            cx += colWidths[i];
          });

          y += rowH;
        });
      }

      // ── Pie: firma de cierre ─────────────────────────────────────
      y += 8;
      if (y > pageH - 40) {
        drawFooter(pageNum);
        pageNum += 1;
        pdf.addPage();
        y = margin;
      }
      pdf.setDrawColor(...BORDER);
      pdf.setLineWidth(0.3);
      pdf.line(margin, y, pageW - margin, y);
      y += 6;
      pdf.setFont('helvetica', 'italic');
      pdf.setFontSize(8);
      pdf.setTextColor(...GRAY);
      pdf.text(
        'Este reporte se generó automáticamente a partir de la tabla posibles_ventas. ' +
        'Para dudas o inconsistencias contactar al equipo de TI.',
        margin, y
      );

      // Footer final
      drawFooter(pageNum);
      pdf.save(`eventos-asignados_${fromDate}_a_${toDate}.pdf`);
    } catch (err) {
      console.error('Error al exportar PDF:', err);
      window.alert('No se pudo exportar el PDF. Revisa la consola del navegador.');
    } finally {
      setPdfLoading(false);
    }
  };

  const copyLink = () => {
    const url = window.location.href;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      });
    }
  };
  const [copied, setCopied] = useState(false);

  // Helper: convierte un color hex (#rrggbb) a [r, g, b]
  function hexToRgb(hex) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
    if (!m) return [0, 0, 0];
    return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
  }

  // ── Hover state para gráficos ─────────────────────────────────────────
  const [hoveredTime, setHoveredTime] = useState(null);
  const [hoveredHeat, setHoveredHeat] = useState(null);

  // ── Render ────────────────────────────────────────────────────────────
  const sectionStyle = { opacity: 1, transform: 'translateY(0)', transition: 'opacity 0.4s ease' };

  if (loading) {
    return (
      <div className="reports-page-container">
        <div className="reports-page-header">
          <div className="reports-brand-header">
            <div className="reports-brand-badge"><img src="/Oficial_JDL_acua.png" alt="" className="reports-brand-logo" /></div>
            <div>
              <div className="reports-eyebrow">EMS Reservas | Jardines del Lago</div>
              <div className="reports-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Handshake size={20} strokeWidth={2.2} style={{ color: '#0d9488' }} />
                Eventos Asignados
              </div>
              <div className="reports-subtitle">Fechas de asignación · Tiempo de respuesta · Distribución por vendedor</div>
            </div>
          </div>
          <ReportInfo reportKey="eventosAsignados" />
          <button className="btn-exit" type="button" onClick={onClose}>Volver</button>
        </div>
        <div className="reports-page-body" style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
          <span style={{ color: '#94a3b8', fontWeight: 700 }}>Cargando posibles ventas…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="reports-page-container">
        <div className="reports-page-header">
          <div className="reports-brand-header">
            <div className="reports-brand-badge"><img src="/Oficial_JDL_acua.png" alt="" className="reports-brand-logo" /></div>
            <div>
              <div className="reports-eyebrow">EMS Reservas | Jardines del Lago</div>
              <div className="reports-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Handshake size={20} strokeWidth={2.2} style={{ color: '#0d9488' }} />
                Eventos Asignados
              </div>
            </div>
          </div>
          <button className="btn-exit" type="button" onClick={onClose}>Volver</button>
        </div>
        <div className="reports-page-body">
          <section className="reports-hero-panel" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56, borderRadius: '50%', background: '#fef2f2', color: '#ef4444', marginBottom: '12px' }}>
              <AlertTriangle size={26} strokeWidth={2.2} />
            </div>
            <div style={{ fontWeight: 800, fontSize: '15px', color: '#64748b' }}>No se pudo cargar la información</div>
            <div style={{ fontSize: '12px', marginTop: '4px' }}>{error}</div>
            <button type="button" className="btnPrimary" onClick={loadLeads} style={{ marginTop: '16px' }}>Reintentar</button>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="reports-page-container">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="reports-page-header">
        <div className="reports-brand-header">
          <div className="reports-brand-badge">
            <img src="/Oficial_JDL_acua.png" alt="" className="reports-brand-logo" />
          </div>
          <div>
            <div className="reports-eyebrow">EMS Reservas | Jardines del Lago</div>
            <div className="reports-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Handshake size={20} strokeWidth={2.2} style={{ color: '#0d9488' }} />
              Eventos Asignados
            </div>
            <div className="reports-subtitle">Fechas de asignación · Tiempo de respuesta · Distribución por vendedor y estado</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            className="btn-exit"
            onClick={copyLink}
            style={{ background: copied ? '#10b981' : undefined, color: copied ? '#fff' : undefined, borderColor: copied ? '#10b981' : undefined }}
            title="Copiar enlace con los filtros actuales"
          >
            {copied
              ? <><CheckCircle size={14} strokeWidth={2.4} style={{ marginRight: '4px', verticalAlign: '-2px' }} />Copiado</>
              : <><Link2 size={14} strokeWidth={2.4} style={{ marginRight: '4px', verticalAlign: '-2px' }} />Copiar link</>
            }
          </button>
          <ReportInfo reportKey="eventosAsignados" />
          <button className="btn-exit" type="button" onClick={onClose}>
            <svg viewBox="0 0 18 18" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 4 7 9l6 5" /></svg>
            Volver
          </button>
        </div>
      </div>

      <div className="reports-page-body">
        {/* ── Hero + Toolbar ─────────────────────────────────────────── */}
        <section className="reports-hero-panel" style={sectionStyle}>
          <div className="reports-section-intro">
            <div>
              <span className="reports-eyebrow">Flujo comercial de asignaciones</span>
              <h3 className="reports-section-title">Fechas de asignación y tiempo de respuesta</h3>
              <p className="reports-section-text">
                Análisis de los eventos del flujo comercial, agrupados por vendedor y estado. La fecha de asignación
                se considera <code>asignado_en</code> cuando existe; para posibles ventas anteriores al 2026-08-28 se usa
                <code> creado_en</code> como proxy.
              </p>
            </div>
          </div>

          <div className="reports-toolbar" style={{ gap: '16px', padding: '16px 20px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <label className="field" style={{ flex: '0 0 148px', marginBottom: 0 }}>
              <span>Desde</span>
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
            </label>
            <label className="field" style={{ flex: '0 0 148px', marginBottom: 0 }}>
              <span>Hasta</span>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
            </label>
            <div style={{ flex: '0 0 260px' }}>
              <MultiSelect
                selected={vendorSel}
                onChange={setVendorSel}
                options={vendors}
                placeholder="Vendedor"
                emptyLabel="Todos los vendedores"
                searchable
              />
            </div>
            <div style={{ flex: '0 0 220px' }}>
              <MultiSelect
                selected={estadoSel}
                onChange={setEstadoSel}
                options={estadoOptions}
                placeholder="Estado"
                emptyLabel="Todos los estados"
              />
            </div>
            <label className="field" style={{ flex: '0 0 110px', marginBottom: 0 }}>
              <span>Sin seguimiento (días)</span>
              <input
                type="number" min={1} max={60}
                value={staleDays}
                onChange={e => setStaleDays(Math.max(1, parseInt(e.target.value, 10) || STALE_DAYS))}
              />
            </label>
            <button type="button" className="btnPrimary" onClick={handleReset} style={{ height: '36px' }}>
              Mes Actual
            </button>

            <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <ListFilter size={13} strokeWidth={2.3} />
                <strong style={{ color: '#0f172a' }}>{kpis.total}</strong> en rango
              </span>
              <button type="button" onClick={handleExportPDF} disabled={pdfLoading} style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                fontSize: '11.5px', fontWeight: 800, padding: '8px 14px',
                borderRadius: '8px', border: '1.5px solid #dc2626',
                background: pdfLoading ? '#fca5a5' : '#dc2626', color: '#ffffff', cursor: pdfLoading ? 'wait' : 'pointer',
                transition: 'all 0.15s', opacity: pdfLoading ? 0.85 : 1,
              }}
                onMouseEnter={e => { if (!pdfLoading) e.currentTarget.style.background = '#b91c1c'; }}
                onMouseLeave={e => { if (!pdfLoading) e.currentTarget.style.background = '#dc2626'; }}
              >
                {pdfLoading
                  ? <Loader2 size={14} strokeWidth={2.4} className="reports-ea-spin" />
                  : <FileText size={14} strokeWidth={2.4} />
                }
                {pdfLoading ? 'Generando PDF…' : 'Exportar PDF'}
              </button>
            </div>
          </div>
        </section>

        {/* ── KPI strip ─────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px' }}>
          <KpiCard icon={BarChart3}    label="Total asignados"   value={kpis.total}                                                          sub={`${kpis.conVendedor} con vendedor · ${kpis.sinVendedor} sin asignar`}     color="#0d9488" desc={KPI_META.total.desc}       calc={KPI_META.total.calc} />
          <KpiCard icon={CheckCircle}  label="Tasa de cierre"    value={kpis.cerrados ? `${Math.round(kpis.tasaCierre * 100)}%` : '—'}        sub={`${kpis.ganadas || 0} ganadas de ${kpis.cerrados || 0} cerradas`}          color="#10b981" desc={KPI_META.tasaCierre.desc}  calc={KPI_META.tasaCierre.calc} />
          <KpiCard icon={Clock}        label="Respuesta prom."   value={kpis.promedioRespuestaMs !== null ? formatDuration(kpis.promedioRespuestaMs) : '—'} sub={kpis.medianaRespuestaMs !== null ? `mediana ${formatDuration(kpis.medianaRespuestaMs)}` : 'sin datos'} color="#3b82f6" desc={KPI_META.respuestaProm.desc} calc={KPI_META.respuestaProm.calc} />
          <KpiCard icon={TrendingUp}   label="90% respondido en" value={kpis.p90RespuestaMs !== null ? formatDuration(kpis.p90RespuestaMs) : '—'} sub={kpis.p75RespuestaMs !== null ? `p75: ${formatDuration(kpis.p75RespuestaMs)}` : 'percentil 90'} color="#f59e0b" desc={KPI_META.p90.desc} calc={KPI_META.p90.calc} />
          <KpiCard icon={Users}        label="PAX"               value={kpis.paxTotal.toLocaleString('en-US')}                              sub={`promedio ${Math.round(kpis.paxAvg)}`}                                    color="#8b5cf6" desc={KPI_META.pax.desc} calc={KPI_META.pax.calc} />
          <KpiCard icon={Calendar}     label="Días hasta evento" value={kpis.diasHastaEvento !== null ? `${Math.round(kpis.diasHastaEvento)} d` : '—'} sub="mediana"                                            color="#0ea5e9" desc={KPI_META.diasHastaEvento.desc} calc={KPI_META.diasHastaEvento.calc} />
          <KpiCard icon={Rocket}       label="Velocidad de cierre" value={kpis.velocidadCierreMs !== null ? `${(kpis.velocidadCierreMs / DAYS_MS).toFixed(1)} d` : '—'} sub="asignado → ganada/perdida" color="#ec4899" desc={KPI_META.velocidadCierre.desc} calc={KPI_META.velocidadCierre.calc} />
          <KpiCard icon={AlertTriangle} label={'Posibles ventas\nsin seguimiento'} value={kpis.staleCount}                                  sub={`≥ ${staleDays} días sin seguimiento`}                                    color="#f97316" desc={KPI_META.stale.desc} calc={KPI_META.stale.calc} />
          <KpiCard icon={Eye}          label="Huérfanos"         value={`${Math.round(kpis.pctHuérfanos * 100)}%`}                           sub="sin 1er seguimiento >24h"                                                color="#ef4444" desc={KPI_META.huerfanos.desc} calc={KPI_META.huerfanos.calc} />
          <KpiCard icon={Repeat}       label="Recurrentes"       value={kpis.recurrentes}                                                    sub="cliente con >1 posible venta"                                            color="#14b8a6" desc={KPI_META.recurrentes.desc} calc={KPI_META.recurrentes.calc} />
        </div>

        {/* ── Storytelling ──────────────────────────────────────────── */}
        <div className="reports-storytelling-card" style={sectionStyle}>
          <p className="reports-story-text" style={{ margin: 0, lineHeight: 1.7 }}>{story}</p>
        </div>

        {/* ── Gráfico 1: Distribución por estado × vendedor ──────────── */}
        <section className="reports-hero-panel" style={sectionStyle}>
          <div className="reports-section-intro">
            <div>
              <span className="reports-eyebrow">Distribución por vendedor</span>
              <h3 className="reports-section-title">Eventos por estado × Vendedor</h3>
              <p className="reports-section-text">
                Una fila por vendedor. Click en un segmento para filtrar la tabla detallada por ese estado.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '14px', fontSize: '10px', fontWeight: 700, color: '#64748b', alignItems: 'center', flexWrap: 'wrap' }}>
              {ESTADOS.map(s => (
                <span key={s.key} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, display: 'inline-block' }} />
                  {s.label}
                </span>
              ))}
            </div>
          </div>

          {byVendorEstado.length === 0 ? (
            <EmptyHint text="Sin datos en el rango seleccionado" />
          ) : (
            <VendorBars
              rows={byVendorEstado}
              onSegmentClick={(estado) => {
                setTableStatus(prev => {
                  const next = new Set(prev);
                  if (next.has(estado)) next.delete(estado);
                  else next.add(estado);
                  return next;
                });
              }}
              activeEstados={tableStatus}
            />
          )}
        </section>

        {/* ── Gráfico 2: Serie temporal ──────────────────────────────── */}
        <section className="reports-hero-panel" style={sectionStyle}>
          <div className="reports-section-intro">
            <div>
              <span className="reports-eyebrow">Serie temporal</span>
              <h3 className="reports-section-title">Asignaciones en el tiempo</h3>
              <p className="reports-section-text">
                Barras: cantidad de eventos asignados por bucket. Línea punteada: tiempo de respuesta promedio del bucket.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {[
                { k: 'day',   l: 'Día' },
                { k: 'week',  l: 'Semana' },
                { k: 'month', l: 'Mes' },
              ].map(g => (
                <button key={g.k} type="button" onClick={() => setGranularity(g.k)} style={{
                  fontSize: '10.5px', fontWeight: 800, padding: '5px 10px',
                  borderRadius: '999px', cursor: 'pointer', transition: 'all 0.15s',
                  border: `1.5px solid ${granularity === g.k ? '#0d9488' : '#e2e8f0'}`,
                  background: granularity === g.k ? '#0d9488' : '#ffffff',
                  color: granularity === g.k ? '#ffffff' : '#475569',
                }}>{g.l}</button>
              ))}
            </div>
          </div>

          {timeSeries.buckets.length === 0 ? (
            <EmptyHint text="Sin datos en el rango" />
          ) : (
            <TimeSeriesChart
              buckets={timeSeries.buckets}
              hovered={hoveredTime}
              setHovered={setHoveredTime}
            />
          )}
        </section>

        {/* ── Gráfico 3: Embudo ─────────────────────────────────────── */}
        <section className="reports-hero-panel" style={sectionStyle}>
          <div className="reports-section-intro">
            <div>
              <span className="reports-eyebrow">Embudo de conversión</span>
              <h3 className="reports-section-title">Asignado → Ganada</h3>
              <p className="reports-section-text">Visualiza cuántas asignaciones progresaron por cada etapa del flujo comercial.</p>
            </div>
          </div>
          <FunnelChart stages={funnel} />
        </section>

        {/* ── Gráfico 4: Mapa de calor día×hora ────────────────────── */}
        <section className="reports-hero-panel" style={sectionStyle}>
          <div className="reports-section-intro">
            <div>
              <span className="reports-eyebrow">Patrón de carga</span>
              <h3 className="reports-section-title">Mapa de calor: día × hora de asignación</h3>
              <p className="reports-section-text">Detecta los momentos de mayor actividad de asignaciones. Pasa el mouse sobre cada celda para ver el detalle.</p>
            </div>
            <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700 }}>
              Máximo: <strong style={{ color: '#0f172a' }}>{heatmap.max}</strong>
            </div>
          </div>
          <HeatmapChart matrix={heatmap.matrix} max={heatmap.max} hovered={hoveredHeat} setHovered={setHoveredHeat} />
        </section>

        {/* ── Top-N (Salones / Servicios / Vendedores) ────────────────── */}
        <section className="reports-hero-panel" style={sectionStyle}>
          <div className="reports-section-intro">
            <div>
              <span className="reports-eyebrow">Los 5 más frecuentes</span>
              <h3 className="reports-section-title">Salones, servicios y vendedores más frecuentes</h3>
              <p className="reports-section-text">Distribución de la demanda del flujo comercial en el rango seleccionado.</p>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
            <TopList title="Salones"    items={topN.salones}    total={filtered.length} Icon={Filter} />
            <TopList title="Servicios"  items={topN.servicios}  total={filtered.length} Icon={ListFilter} />
            <TopList
              title="Vendedores"
              items={topN.vendedores.map(v => ({ name: v.name, count: v.total }))}
              total={filtered.length}
              Icon={Users}
            />
          </div>
        </section>

        {/* ── PAX buckets ────────────────────────────────────────────── */}
        <section className="reports-hero-panel" style={sectionStyle}>
          <div className="reports-section-intro">
            <div>
              <span className="reports-eyebrow">Distribución PAX</span>
              <h3 className="reports-section-title">Tamaño de los eventos asignados</h3>
              <p className="reports-section-text">Cantidad de eventos en cada bucket de PAX.</p>
            </div>
          </div>
          <PaxBucketsChart leads={filtered} />
        </section>

        {/* ── Leads sin seguimiento ──────────────────────────────── */}
        {staleLeads.length > 0 && (
          <section className="reports-hero-panel" style={sectionStyle}>
            <div className="reports-section-intro">
              <div>
                <span className="reports-eyebrow">Acción requerida</span>
                <h3 className="reports-section-title">Posibles ventas sin seguimiento · ≥ {staleDays} días</h3>
                <p className="reports-section-text">Posibles ventas activas con seguimiento vencido. Click en una fila para abrir el detalle.</p>
              </div>
              <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700 }}>
                Mostrando <strong style={{ color: '#0f172a' }}>{staleLeads.length}</strong> de <strong>{kpis.staleCount}</strong>
              </div>
            </div>
            <StaleList leads={staleLeads} onClick={(id) => navigate(`/posibles-ventas?focus=${id}`)} />
          </section>
        )}

        {/* ── Tabla detallada ───────────────────────────────────────── */}
        <section className="reports-hero-panel" style={sectionStyle}>
          <div className="reports-section-intro">
            <div>
              <span className="reports-eyebrow">Detalle</span>
              <h3 className="reports-section-title">Tabla detallada de asignaciones</h3>
              <p className="reports-section-text">Click en una fila para abrir la posible venta en el módulo operativo.</p>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {tableStatus.size > 0 && (
                <button type="button" onClick={() => setTableStatus(new Set())} style={{
                  fontSize: '10.5px', fontWeight: 800, padding: '5px 10px',
                  borderRadius: '999px', cursor: 'pointer',
                  border: '1.5px solid #ef4444', background: '#fef2f2', color: '#b91c1c',
                }}>
                  Quitar filtro estado ({tableStatus.size})
                </button>
              )}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '5px 10px',
                border: '1.5px solid #e2e8f0', borderRadius: '20px',
                background: '#ffffff',
                boxShadow: '0 1px 3px #00000008',
                minWidth: '280px', transition: 'border-color 0.15s, box-shadow 0.15s',
              }}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#0d9488'; e.currentTarget.style.boxShadow = '0 0 0 2px #0d948830'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = '0 1px 3px #00000008'; }}
              >
                <Search size={14} strokeWidth={2.3} style={{ color: '#94a3b8', flexShrink: 0 }} />
                <input
                  type="text"
                  placeholder="Buscar cliente, vendedor, salón, servicio, nota…"
                  value={tableSearch}
                  onChange={e => setTableSearch(e.target.value)}
                  style={{
                    flex: 1, minWidth: 0, border: 'none', outline: 'none',
                    background: 'transparent', color: '#0f172a', fontSize: '12px', padding: 0,
                  }}
                />
                {tableSearch && (
                  <button type="button" onClick={() => setTableSearch('')} aria-label="Limpiar búsqueda" style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 18, height: 18, padding: 0, border: 'none', borderRadius: '50%',
                    background: '#e2e8f0', color: '#64748b', cursor: 'pointer',
                  }}>×</button>
                )}
              </div>
            </div>
          </div>

          <div className="reports-table-wrap" style={{ maxHeight: '520px', overflow: 'auto' }}>
            <table className="reports-table" style={{ minWidth: '1100px' }}>
              <thead>
                <tr>
                  <Th label="Fecha Asignación" sortKey="asignadoEn" sortIcon={sortIcon} onSort={onSort} />
                  <Th label="Cliente" sortKey="cliente" sortIcon={sortIcon} onSort={onSort} />
                  <Th label="Vendedor" sortKey="vendedor" sortIcon={sortIcon} onSort={onSort} />
                  <Th label="Estado" sortKey="estado" sortIcon={sortIcon} onSort={onSort} />
                  <Th label="Respuesta" sortKey="respuesta" sortIcon={sortIcon} onSort={onSort} />
                  <Th label="PAX" sortKey="pax" sortIcon={sortIcon} onSort={onSort} />
                  <Th label="Días → Evento" sortKey="diasEvento" sortIcon={sortIcon} onSort={onSort} />
                  <th>Último seguimiento</th>
                  <th>Recurrente</th>
                </tr>
              </thead>
              <tbody>
                {tableFiltered.length === 0 ? (
                  <tr><td colSpan={9} style={{ textAlign: 'center', color: '#94a3b8', padding: '24px' }}>
                    {filtered.length === 0 ? 'Sin datos en el rango' : 'Sin coincidencias para la búsqueda'}
                  </td></tr>
                ) : tableFiltered.slice(0, 200).map(l => {
                  const { date: asignado, isFallback } = getAssignmentDate(l);
                  const resp = getResponseMs(l);
                  const bucket = bucketOf(resp);
                  const diasEv = (() => {
                    const ev = parseDateSafe(l.fechaEvento);
                    if (!ev || !asignado) return null;
                    return Math.round((ev.getTime() - asignado.getTime()) / DAYS_MS);
                  })();
                  const isRec = recurrentSet.has(String(l.id));
                  return (
                    <tr key={l.id} onClick={() => navigate(`/posibles-ventas?focus=${l.id}`)} style={{ cursor: 'pointer' }}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontSize: '11.5px' }}>{asignado ? formatDate(asignado) : '—'}</span>
                          {isFallback && (
                            <span title="Lead histórico: usando creado_en como fecha de asignación" style={{ display: 'inline-flex', color: '#94a3b8' }}>
                              <History size={12} strokeWidth={2.3} />
                            </span>
                          )}
                        </div>
                      </td>
                      <td><strong>{l.nombreCliente || '—'}</strong></td>
                      <td>
                        <div style={{ fontSize: '11.5px', fontWeight: 600 }}>{l.vendedorNombre || <span style={{ color: '#d97706' }}>Sin asignar</span>}</div>
                        <div style={{ fontSize: '9.5px', color: '#94a3b8' }}>{l.creadoPorNombre ? `por ${l.creadoPorNombre}` : ''}</div>
                      </td>
                      <td><EstadoPill estado={l.estado} /></td>
                      <td>
                        <span style={{
                          fontSize: '10.5px', fontWeight: 800,
                          padding: '3px 8px', borderRadius: '999px',
                          background: `${bucket.color}18`,
                          border: `1px solid ${bucket.color}40`,
                          color: bucket.color,
                        }}>{bucket.label}</span>
                      </td>
                      <td style={{ fontSize: '11.5px', fontWeight: 600 }}>{l.pax || '—'}</td>
                      <td style={{ fontSize: '11.5px', color: diasEv !== null && diasEv < 7 ? '#ef4444' : '#0f172a', fontWeight: diasEv !== null && diasEv < 7 ? 800 : 500 }}>
                        {diasEv !== null ? `${diasEv} d` : '—'}
                      </td>
                      <td style={{ fontSize: '10.5px', color: '#475569' }}>{l.ultimoSeguimientoEn ? formatDate(l.ultimoSeguimientoEn) : '—'}</td>
                      <td>{isRec ? <span style={{ fontSize: '10.5px', fontWeight: 800, padding: '2px 6px', borderRadius: '999px', background: '#14b8a618', border: '1px solid #14b8a640', color: '#0f766e' }}>Recurrente</span> : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {tableFiltered.length > 200 && (
            <div style={{ fontSize: '10.5px', color: '#94a3b8', fontWeight: 700, textAlign: 'center', padding: '8px' }}>
              Mostrando las primeras 200 filas. Usá los filtros o exportá a CSV para ver todas.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

// ─── Componentes auxiliares (locales al archivo) ────────────────────────

function KpiCard({ icon: Icon, label, value, sub, color, desc, calc }) {
  const [tipOpen, setTipOpen] = useState(false);
  const [tipCoords, setTipCoords] = useState(null);
  const cardRef = useRef(null);
  const tipTimerRef = useRef(null);

  const showTip = useCallback(() => {
    if (!desc) return;
    clearTimeout(tipTimerRef.current);
    tipTimerRef.current = setTimeout(() => {
      if (cardRef.current) {
        const r = cardRef.current.getBoundingClientRect();
        setTipCoords({
          top: r.bottom + window.scrollY + 8,
          left: r.left + window.scrollX,
          width: r.width,
        });
        setTipOpen(true);
      }
    }, 200);
  }, [desc]);

  const hideTip = useCallback(() => {
    clearTimeout(tipTimerRef.current);
    setTipOpen(false);
  }, []);

  useEffect(() => () => clearTimeout(tipTimerRef.current), []);

  const tooltip = tipOpen && desc && tipCoords ? createPortal(
    <div
      role="tooltip"
      data-kpi-tooltip
      onMouseEnter={() => clearTimeout(tipTimerRef.current)}
      onMouseLeave={hideTip}
      style={{
        position: 'absolute',
        top: tipCoords.top,
        left: tipCoords.left,
        width: Math.max(tipCoords.width, 280),
        maxWidth: 320,
        background: '#0f172a',
        color: '#f8fafc',
        borderRadius: '12px',
        padding: '12px 14px',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.25), 0 2px 6px rgba(0, 0, 0, 0.1)',
        zIndex: 100000,
        fontSize: '12px',
        lineHeight: 1.5,
        pointerEvents: 'auto',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '6px' }}>
        <span style={{ fontSize: '10.5px', fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
        <button
          type="button"
          onClick={hideTip}
          aria-label="Cerrar"
          style={{
            background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer',
            padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginTop: '-2px',
          }}
        >
          <X size={14} strokeWidth={2.4} />
        </button>
      </div>
      <div style={{ marginBottom: '8px' }}>{desc}</div>
      {calc && (
        <div style={{
          background: 'rgba(255, 255, 255, 0.06)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '8px',
          padding: '6px 8px',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: '10.5px',
          color: '#cbd5e1',
          lineHeight: 1.45,
        }}>
          <span style={{ color, fontFamily: 'inherit', fontWeight: 700 }}>⚙ Cálculo: </span>
          {calc}
        </div>
      )}
      <div style={{
        position: 'absolute', top: -6, left: 16,
        width: 12, height: 12,
        background: '#0f172a',
        transform: 'rotate(45deg)',
        borderRadius: '2px',
      }} />
    </div>,
    document.body
  ) : null;

  return (
    <div
      ref={cardRef}
      onMouseEnter={showTip}
      onMouseLeave={hideTip}
      style={{
        background: `linear-gradient(135deg, ${color}08, ${color}02)`,
        border: `1px solid ${color}30`,
        borderRadius: '12px', padding: '12px 14px',
        display: 'flex', flexDirection: 'column', gap: '2px',
        minWidth: '150px',
        position: 'relative',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: '22px', height: '22px', borderRadius: '6px',
          background: `${color}15`, color,
        }}>
          {Icon ? <Icon size={13} strokeWidth={2.4} /> : null}
        </span>
        <span style={{ fontSize: '9.5px', fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: '0.04em', flex: 1, whiteSpace: 'pre-line', lineHeight: 1.15 }}>{label}</span>
        {desc && (
          <span
            role="button"
            tabIndex={0}
            aria-label={`¿Qué mide ${label}?`}
            onClick={(e) => { e.stopPropagation(); tipOpen ? hideTip() : showTip(); }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tipOpen ? hideTip() : showTip(); } }}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 16, height: 16, aspectRatio: '1 / 1',
              minWidth: 16, minHeight: 16, maxWidth: 16, maxHeight: 16,
              padding: 0, border: 'none', borderRadius: '50%',
              boxSizing: 'border-box',
              background: `${color}18`, color,
              cursor: 'help', transition: 'background 0.15s, transform 0.15s',
              flexShrink: 0, flexGrow: 0,
              outline: 'none',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = `${color}30`; e.currentTarget.style.transform = 'scale(1.15)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = `${color}18`; e.currentTarget.style.transform = 'scale(1)'; }}
            onFocus={(e) => { e.currentTarget.style.boxShadow = `0 0 0 2px ${color}40`; }}
            onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
          >
            <HelpCircle size={11} strokeWidth={2.6} />
          </span>
        )}
      </div>
      <strong style={{ fontSize: '20px', fontWeight: 900, color: '#0f172a', lineHeight: 1.1 }}>{value}</strong>
      {sub && <span style={{ fontSize: '9.5px', color: '#64748b', fontWeight: 600 }}>{sub}</span>}
      {tooltip}
    </div>
  );
}

function Th({ label, sortKey, sortIcon, onSort }) {
  return (
    <th onClick={() => onSort(sortKey)} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
        {label} <span style={{ fontSize: '10px', color: '#94a3b8' }}>{sortIcon(sortKey)}</span>
      </span>
    </th>
  );
}

function EstadoPill({ estado }) {
  const meta = ESTADO_BY_KEY[estado] || { label: estado, color: '#94a3b8' };
  return (
    <span style={{
      fontSize: '10.5px', fontWeight: 800, padding: '3px 8px', borderRadius: '999px',
      background: `${meta.color}18`, border: `1px solid ${meta.color}40`, color: meta.color,
      textTransform: 'uppercase', letterSpacing: '0.04em',
    }}>{meta.label}</span>
  );
}

function EmptyHint({ text }) {
  return (
    <div style={{
      textAlign: 'center', color: '#94a3b8', padding: '40px 20px',
      border: '2px dashed #cbd5e1', borderRadius: '14px', background: '#f8fafc',
    }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, borderRadius: '50%', background: '#e2e8f0', color: '#64748b', marginBottom: '8px' }}>
        <Inbox size={22} strokeWidth={2.2} />
      </div>
      <div style={{ fontWeight: 800, fontSize: '13px', color: '#64748b' }}>{text}</div>
    </div>
  );
}

function VendorBars({ rows, onSegmentClick, activeEstados }) {
  const maxTotal = Math.max(1, ...rows.map(r => r.total));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {rows.map((r) => {
        const isNoVendor = !r.vendorId;
        return (
          <div key={r.vendorId || '__sin_asignar__'} style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '6px 0',
          }}>
            <div style={{ width: '160px', fontSize: '12px', fontWeight: 700, color: isNoVendor ? '#d97706' : '#0f172a', flexShrink: 0 }}>
              {r.name}
              {isNoVendor && <span style={{ fontSize: '9.5px', color: '#d97706', marginLeft: '4px' }}>(pendiente)</span>}
            </div>
            <div style={{ flex: 1, display: 'flex', height: '22px', borderRadius: '6px', overflow: 'hidden', background: '#f1f5f9' }}>
              {ESTADOS.map(s => {
                const count = r.byEstado[s.key] || 0;
                if (count === 0) return null;
                const w = (count / maxTotal) * 100;
                const active = activeEstados.has(s.key);
                return (
                  <div
                    key={s.key}
                    onClick={() => onSegmentClick(s.key)}
                    title={`${s.label}: ${count}`}
                    style={{
                      width: `${w}%`, background: s.color, cursor: 'pointer',
                      opacity: activeEstados.size > 0 && !active ? 0.3 : 1,
                      outline: active ? `2px solid #0f172a` : 'none',
                      transition: 'opacity 0.2s, outline 0.2s',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#ffffff', fontSize: '10px', fontWeight: 800,
                      minWidth: count > 0 ? '4px' : 0,
                    }}
                  >
                    {w > 8 ? count : ''}
                  </div>
                );
              })}
            </div>
            <div style={{ width: '40px', textAlign: 'right', fontSize: '12px', fontWeight: 800, color: '#0f172a' }}>
              {r.total}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TimeSeriesChart({ buckets, hovered, setHovered }) {
  const maxCount = Math.max(1, ...buckets.map(b => b.count));
  const maxResp = Math.max(1, ...buckets.map(b => b.avgRespMs || 0));
  const chartH = 240;
  const padL = 40, padR = 50, padT = 10, padB = 30;
  const innerW = Math.max(0, buckets.length * 32 - 10);

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'flex', minWidth: innerW + padL + padR + 20 }}>
        {/* Y axis (count) */}
        <div style={{ width: padL, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', paddingBottom: padB, paddingTop: padT, height: chartH, flexShrink: 0 }}>
          {[1, 0.75, 0.5, 0.25, 0].map((p, i) => (
            <span key={i} style={{ fontSize: '9px', fontWeight: 700, color: '#94a3b8', textAlign: 'right', lineHeight: '12px' }}>
              {Math.round(maxCount * p)}
            </span>
          ))}
        </div>
        <div style={{ position: 'relative', height: chartH, flex: 1, minWidth: innerW + 20 }}>
          {/* grid lines */}
          {[0.25, 0.5, 0.75, 1].map((p, i) => (
            <div key={i} style={{
              position: 'absolute', left: 0, right: 0, top: padT + (chartH - padT - padB) * (1 - p),
              height: 1, background: '#f1f5f9', borderTop: '1px dashed #e2e8f0', pointerEvents: 'none',
            }} />
          ))}
          {/* bars */}
          <div style={{
            position: 'absolute', top: padT, left: 0, right: 0, bottom: padB,
            display: 'flex', alignItems: 'flex-end', gap: '4px',
          }}>
            {buckets.map((b, i) => {
              const h = (b.count / maxCount) * (chartH - padT - padB);
              const isHov = hovered === i;
              return (
                <div
                  key={b.key}
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                  style={{ flex: '0 0 28px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', position: 'relative' }}
                >
                  {isHov && (
                    <div style={{
                      position: 'absolute', bottom: `calc(${h}px + 28px)`, left: '50%', transform: 'translateX(-50%)',
                      background: '#0f172a', color: '#fff', padding: '4px 8px', borderRadius: '6px',
                      fontSize: '10px', fontWeight: 700, whiteSpace: 'nowrap', zIndex: 10,
                      pointerEvents: 'none',
                    }}>
                      {b.count} eventos
                      {b.avgRespMs !== null && <div style={{ fontSize: '9px', color: '#94a3b8' }}>resp. prom. {formatDuration(b.avgRespMs)}</div>}
                    </div>
                  )}
                  <div style={{
                    width: '100%', height: `${h}px`,
                    background: isHov ? '#0d9488' : 'linear-gradient(180deg, #14b8a6, #0d9488)',
                    borderRadius: '4px 4px 0 0', transition: 'background 0.15s',
                  }} />
                  <span style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 700, position: 'absolute', bottom: -22, whiteSpace: 'nowrap' }}>
                    {b.label}
                  </span>
                </div>
              );
            })}
          </div>
          {/* Y axis right (response time) */}
          <div style={{
            position: 'absolute', right: 0, top: padT, bottom: padB,
            width: padR - 6, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            pointerEvents: 'none',
          }}>
            {[1, 0.75, 0.5, 0.25, 0].map((p, i) => (
              <span key={i} style={{ fontSize: '9px', fontWeight: 700, color: '#ec4899', textAlign: 'right', lineHeight: '12px' }}>
                {formatDuration(maxResp * p)}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function FunnelChart({ stages }) {
  const max = Math.max(1, ...stages.map(s => s.count));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '8px 0' }}>
      {stages.map((s, i) => {
        const w = (s.count / max) * 100;
        const next = stages[i + 1];
        const dropPct = next && s.count > 0 ? Math.round((next.count / s.count) * 100) : null;
        return (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '140px', fontSize: '11.5px', fontWeight: 800, color: s.color }}>{s.label}</div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                height: '32px',
                width: `${Math.max(2, w)}%`,
                background: `linear-gradient(90deg, ${s.color}, ${s.color}cc)`,
                borderRadius: '6px',
                display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                paddingRight: '10px',
                color: '#ffffff', fontSize: '12px', fontWeight: 900,
                minWidth: '40px',
                boxShadow: `0 2px 6px ${s.color}30`,
              }}>{s.count}</div>
              {dropPct !== null && (
                <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700, whiteSpace: 'nowrap' }}>
                  ↓ {dropPct}% avanza
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function HeatmapChart({ matrix, max, hovered, setHovered }) {
  const days = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const getColor = (v) => {
    if (!v) return '#f1f5f9';
    const intensity = max > 0 ? v / max : 0;
    // 0 → gris muy claro, 1 → teal fuerte
    const a = 0.12 + intensity * 0.78;
    return `rgba(20, 184, 166, ${a})`;
  };
  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'inline-block', minWidth: '660px' }}>
        {/* Header de horas */}
        <div style={{ display: 'grid', gridTemplateColumns: '40px repeat(24, 1fr)', gap: '2px', marginBottom: '2px' }}>
          <div />
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} style={{ fontSize: '8px', color: '#94a3b8', fontWeight: 700, textAlign: 'center' }}>
              {h % 3 === 0 ? String(h).padStart(2, '0') : ''}
            </div>
          ))}
        </div>
        {/* Filas por día */}
        {days.map((d, dow) => (
          <div key={d} style={{ display: 'grid', gridTemplateColumns: '40px repeat(24, 1fr)', gap: '2px', marginBottom: '2px' }}>
            <div style={{ fontSize: '10px', color: '#475569', fontWeight: 800, display: 'flex', alignItems: 'center' }}>{d}</div>
            {Array.from({ length: 24 }, (_, h) => {
              const v = matrix[dow][h];
              const isHov = hovered && hovered.dow === dow && hovered.hr === h;
              return (
                <div
                  key={h}
                  onMouseEnter={() => setHovered({ dow, hr: h, val: v })}
                  onMouseLeave={() => setHovered(null)}
                  title={`${d} ${String(h).padStart(2,'0')}:00 — ${v} eventos`}
                  style={{
                    height: '24px', borderRadius: '3px',
                    background: getColor(v),
                    outline: isHov ? '2px solid #0f172a' : 'none',
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '9px', color: v > max * 0.5 ? '#ffffff' : '#475569', fontWeight: 700,
                    position: 'relative',
                  }}
                >
                  {v > 0 && (h % 6 === 0 || isHov) ? v : ''}
                  {isHov && (
                    <div style={{
                      position: 'absolute', bottom: '110%', left: '50%', transform: 'translateX(-50%)',
                      background: '#0f172a', color: '#fff', padding: '3px 6px', borderRadius: '4px',
                      fontSize: '10px', fontWeight: 700, whiteSpace: 'nowrap', zIndex: 10, pointerEvents: 'none',
                    }}>
                      {d} {String(h).padStart(2,'0')}:00 — {v} eventos
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center', marginTop: '10px', fontSize: '9px', color: '#94a3b8', fontWeight: 700 }}>
          <span>Menos</span>
          {[0, 0.25, 0.5, 0.75, 1].map(p => (
            <div key={p} style={{ width: 20, height: 12, background: getColor(max * p), borderRadius: '2px' }} />
          ))}
          <span>Más</span>
        </div>
      </div>
    </div>
  );
}

function TopList({ title, items, total, Icon: TitleIcon }) {
  const top = items.slice(0, 5);
  const max = Math.max(1, ...top.map(i => i.count));
  return (
    <div style={{
      background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 14px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 800, color: '#0f172a', marginBottom: '10px' }}>
        {TitleIcon && <TitleIcon size={14} strokeWidth={2.3} style={{ color: '#0d9488' }} />}
        {title}
      </div>
      {top.length === 0 ? (
        <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>Sin datos</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {top.map((it) => {
            const w = (it.count / max) * 100;
            const pct = total > 0 ? Math.round((it.count / total) * 100) : 0;
            return (
              <div key={`${title}-${it.name}`} title={it.name}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '6px', marginBottom: '2px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name}</span>
                  <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, flexShrink: 0 }}>{it.count} · {pct}%</span>
                </div>
                <div style={{ height: '6px', background: '#f1f5f9', borderRadius: '999px', overflow: 'hidden' }}>
                  <div style={{ width: `${w}%`, height: '100%', background: 'linear-gradient(90deg, #0d9488, #14b8a6)', borderRadius: '999px' }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PaxBucketsChart({ leads }) {
  const counts = PAX_BUCKETS.map(b => ({
    ...b,
    count: leads.filter(l => (Number(l.pax) || 0) >= b.min && (Number(l.pax) || 0) <= b.max).length,
  }));
  const max = Math.max(1, ...counts.map(c => c.count));
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px' }}>
      {counts.map(b => {
        const w = (b.count / max) * 100;
        return (
          <div key={b.key} style={{
            background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px',
            padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '4px',
          }}>
            <span style={{ fontSize: '10px', fontWeight: 800, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{b.label} PAX</span>
            <strong style={{ fontSize: '20px', fontWeight: 900, color: '#0f172a', lineHeight: 1.1 }}>{b.count}</strong>
            <div style={{ height: '5px', background: '#f1f5f9', borderRadius: '999px', overflow: 'hidden' }}>
              <div style={{ width: `${w}%`, height: '100%', background: 'linear-gradient(90deg, #8b5cf6, #a78bfa)', borderRadius: '999px' }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StaleList({ leads, onClick }) {
  return (
    <div className="reports-table-wrap" style={{ maxHeight: '320px', overflow: 'auto' }}>
      <table className="reports-table" style={{ minWidth: '700px' }}>
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Vendedor</th>
            <th>Estado</th>
            <th>Sin seguimiento</th>
            <th>Asignado hace</th>
          </tr>
        </thead>
        <tbody>
          {leads.map(l => {
            const last = parseDateSafe(l.ultimoSeguimientoEn);
            const { date: asignado } = getAssignmentDate(l);
            const ref = last || asignado;
            const dSin = daysSince(ref);
            const dAsig = daysSince(asignado);
            return (
              <tr key={l.id} onClick={() => onClick(l.id)} style={{ cursor: 'pointer' }}>
                <td><strong>{l.nombreCliente || '—'}</strong></td>
                <td>{l.vendedorNombre || <span style={{ color: '#d97706' }}>Sin asignar</span>}</td>
                <td><EstadoPill estado={l.estado} /></td>
                <td>
                  <span style={{ fontSize: '10.5px', fontWeight: 800, color: dSin >= 14 ? '#ef4444' : '#f97316' }}>
                    {dSin !== null ? `${dSin} d` : '—'}
                  </span>
                </td>
                <td style={{ fontSize: '11px', color: '#475569' }}>{dAsig !== null ? `${dAsig} d` : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
