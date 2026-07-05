import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  createInforme,
  createInformeDia,
  saveDiaMenuDetalle,
  getPlatillos,
  getPlatilloDetalle,
  fetchEventById,
} from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';
import {
  IconFileText, IconPlus, IconTrash, IconSearch, IconCheckCircle,
  IconChevronDown, IconChevronUp, IconArrowLeft, IconX
} from '../components/Icons.jsx';

const TIPO_LABELS = {
  proteina:     { label: 'Proteína',      icon: '🥩', color: '#ef4444' },
  guarnicion:   { label: 'Guarnición',    icon: '🥗', color: '#10b981' },
  salsa:        { label: 'Salsa',         icon: '🫗', color: '#f59e0b' },
  postre:       { label: 'Postre',        icon: '🍰', color: '#ec4899' },
  bebida:       { label: 'Bebida',        icon: '🥤', color: '#06b6d4' },
  refaccion:    { label: 'Refacción',     icon: '🥪', color: '#8b5cf6' },
  boquita:      { label: 'Boquita',       icon: '🍿', color: '#f43f5e' },
  desayuno:     { label: 'Desayuno',      icon: '🌅', color: '#f59e0b' },
};

const TIPO_OPTS = ['entradas','proteina','guarnicion','salsa','postre','bebida','refaccion','boquita','desayuno'];
const METODOS_PREPARACION = [
  'A la plancha', 'Al vapor', 'Frito', 'Parrilla', 'Horneado',
  'Salteado', 'Guisado', 'Crudo / Fresco', 'Otro'
];

function crearDiaVacio(fecha) {
  return {
    id: null,
    fecha: fecha || new Date().toISOString().slice(0, 10),
    platillo: null,
    platilloDetalle: null,
    selectedItems: [],
    platilloSearch: '',
  };
}

function sumarDias(fechaStr, dias) {
  if (!fechaStr) return new Date().toISOString().slice(0, 10);
  const d = new Date(fechaStr + 'T12:00:00');
  if (isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

function mapCategoriaToTiempoComida(categoriaNombre) {
  if (!categoriaNombre) return null;
  const n = categoriaNombre.toLowerCase().trim();
  if (n.includes('desayuno')) return 'desayuno';
  if (n.includes('refacción') || n.includes('refaccion')) return 'refaccion_am';
  if (n.includes('almuerzo')) return 'almuerzo';
  if (n.includes('cena')) return 'cena';
  return null;
}

// ═══════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════
export default function InformeCreator() {
  const params = (() => { try { return useParams(); } catch { return {}; } })();
  const { id_ocupacion } = params;
  let navigate;
  try {
    navigate = useNavigate();
  } catch (_err) {
    navigate = (path) => { window.location.href = path; };
  }
  const toast = useToast();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [informeId, setInformeId] = useState(null);
  const [platillos, setPlatillos] = useState([]);
  const [evento, setEvento] = useState(null);
  const [dias, setDias] = useState([crearDiaVacio()]);
  const [activeDay, setActiveDay] = useState(0);

  if (!id_ocupacion) {
    return (
      <div className="informe-creator">
        <p className="status-message status-error">Error: No se especificó una ocupación válida.</p>
      </div>
    );
  }

  useEffect(() => { loadInitialData(); }, []);

  useEffect(() => {
    if (evento?.FechaEvento && dias.length > 0 && !dias[0].id) {
      const eventDate = String(evento.FechaEvento).slice(0, 10);
      if (eventDate && eventDate !== dias[0].fecha) {
        setDias(prev => {
          const next = [...prev];
          next[0] = { ...next[0], fecha: eventDate };
          return next;
        });
      }
    }
  }, [evento]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [platillosData, eventoData] = await Promise.all([
        getPlatillos(),
        fetchEventById(id_ocupacion),
      ]);
      setPlatillos(platillosData);
      setEvento(eventoData);
    } catch (err) {
      setError('Error al cargar datos: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ─── Seleccionar platillo para el día activo ───
  const handleSelectPlatillo = async (platillo) => {
    const diaIndex = activeDay;
    const newDias = [...dias];
    newDias[diaIndex] = {
      ...newDias[diaIndex],
      platillo: { id: platillo.id, nombre_platillo: platillo.nombre_platillo, categoria_nombre: platillo.categoria_nombre },
      platilloDetalle: null,
      selectedItems: [],
      platilloSearch: '',
    };
    setDias(newDias);

    try {
      const detalle = await getPlatilloDetalle(platillo.id);
      const updated = [...newDias];
      updated[diaIndex].platilloDetalle = detalle;
      setDias(updated);
    } catch {
      // Platillo seleccionado sin detalle
    }
  };

  // ─── Quitar platillo del día activo ───
  const handleRemovePlatillo = () => {
    const diaIndex = activeDay;
    const newDias = [...dias];
    newDias[diaIndex] = {
      ...newDias[diaIndex],
      platillo: null,
      platilloDetalle: null,
      selectedItems: [],
    };
    setDias(newDias);
  };

  // ─── Toggle items seleccionados ───
  const handleToggleItems = (items) => {
    const diaIndex = activeDay;
    const newDias = [...dias];
    newDias[diaIndex].selectedItems = items;
    setDias(newDias);
  };

  // ─── Cambiar campo de un item ───
  const handleItemChange = (compId, field, value) => {
    const diaIndex = activeDay;
    const newDias = [...dias];
    const target = newDias[diaIndex].selectedItems.find(s => s.comp_id === compId);
    if (target) {
      target[field] = value;
      setDias(newDias);
    }
  };

  // ─── Agregar/quitar días ───
  const addDia = () => {
    const ultimaFecha = dias[dias.length - 1]?.fecha;
    setDias([...dias, crearDiaVacio(sumarDias(ultimaFecha, 1))]);
    setActiveDay(dias.length);
  };
  const removeDia = (index) => {
    const newDias = dias.filter((_, i) => i !== index);
    setDias(newDias);
    if (activeDay >= newDias.length) {
      setActiveDay(Math.max(0, newDias.length - 1));
    }
  };

  // ─── Guardar informe ───
  const handleSaveFullInforme = async () => {
    setLoading(true);
    try {
      let targetId = informeId;
      if (!targetId) {
        const res = await createInforme(id_ocupacion);
        targetId = res.id;
        setInformeId(targetId);
      }

      let diasGuardados = 0;
      for (let i = 0; i < dias.length; i++) {
        const dia = dias[i];
        if (!dia.fecha) continue;

        const catNombre = dia.platillo?.categoria_nombre || '';
        const tc = mapCategoriaToTiempoComida(catNombre);
        const itemsTc = dia.selectedItems.map(() => tc);

        const descripcionMontaje = JSON.stringify({
          _v: 2,
          nombre_platillo: dia.platillo?.nombre_platillo || '',
          tiempo_comida: tc,
          items_tiempo_comida: itemsTc,
        });

        const diaRes = await createInformeDia({
          informe_id: targetId,
          fecha_evento: dia.fecha,
          menu_id: null,
          descripcion_montaje: descripcionMontaje,
        });
        diasGuardados++;

        if (dia.selectedItems.length > 0) {
          await saveDiaMenuDetalle(diaRes.id, dia.selectedItems.map(item => ({
            menu_item_id: null,
            ingrediente_id: item.ingrediente_id,
            opcion_id: item.opcion_id,
            metodo_preparacion: item.metodo_preparacion,
            cantidad_total: item.cantidad,
            notas: item.notas || '',
          })));
        }
      }

      toast.success(`¡Informe creado con éxito! (${diasGuardados} día(s) guardados)`, {
        action: {
          label: 'Ver informe',
          onClick: () => navigate(`/informe/${targetId}`),
        }
      });
      navigate(targetId ? `/informe/${targetId}` : '/kanban');
    } catch (err) {
      const msg = err.message || 'Error desconocido';
      setError('Error al guardar el informe: ' + msg);
      toast.error('Error al guardar el informe: ' + msg);
    } finally {
      setLoading(false);
    }
  };

  // ─── Obtener el día activo ───
  const diaActivo = dias[activeDay] || dias[0];

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════
  if (error) return <p className="status-message status-error">{error}</p>;
  if (loading && !evento) return <p className="status-message">Cargando datos...</p>;

  return (
    <div className="informe-creator-pos">
      {/* ─── BARRA SUPERIOR: datos del evento ─── */}
      <div className="pos-topbar">
        <button onClick={() => navigate(-1)} className="btn-ghost" data-tooltip="Volver">
          <IconArrowLeft size={16} />
        </button>
        <div className="pos-topbar-info">
          <span className="pos-topbar-inst">{evento?.Institucion || 'Cargando...'}</span>
          <span className="pos-topbar-meta">
            <strong>{evento?.Pax || '?'}</strong> pax · {evento?.Salon || '?'} · {evento?.TipoEvento || '?'}
          </span>
        </div>
        <div className="pos-topbar-ocup">
          Ocupación <strong>#{id_ocupacion}</strong>
        </div>
      </div>

      {/* ─── PESTAÑAS DE DÍAS ─── */}
      <div className="pos-tabs">
        {dias.map((_, i) => (
          <button
            key={i}
            className={`pos-tab ${activeDay === i ? 'pos-tab-active' : ''}`}
            onClick={() => setActiveDay(i)}
          >
            Día {i + 1}
            {dias.length > 1 && (
              <span className="pos-tab-close" onClick={(e) => { e.stopPropagation(); removeDia(i); }}>
                <IconX size={12} />
              </span>
            )}
          </button>
        ))}
        <button className="pos-tab pos-tab-add" onClick={addDia}>
          <IconPlus size={14} /> Día
        </button>
      </div>

      {/* ─── CUERPO PRINCIPAL: 2 COLUMNAS ─── */}
      <div className="pos-body">
        {/* ─── COLUMNA IZQUIERDA: Editor POS ─── */}
        <div className="pos-editor">
          {/* Fecha del día activo */}
          <div className="pos-fecha-row">
            <label>Fecha del evento:</label>
            <input
              type="date"
              value={diaActivo.fecha}
              onChange={e => {
                const newDias = [...dias];
                newDias[activeDay].fecha = e.target.value;
                setDias(newDias);
              }}
            />
          </div>

          {/* Buscador de platillos */}
          <div className="pos-search-section">
            <div className="pos-search-input-wrap">
              <IconSearch size={16} />
              <input
                type="text"
                placeholder="Buscar platillo…"
                value={diaActivo.platilloSearch}
                onChange={e => {
                  const newDias = [...dias];
                  newDias[activeDay].platilloSearch = e.target.value;
                  setDias(newDias);
                }}
                autoFocus
              />
              {diaActivo.platilloSearch && (
                <button className="pos-search-clear" onClick={() => {
                  const newDias = [...dias];
                  newDias[activeDay].platilloSearch = '';
                  setDias(newDias);
                }}>
                  <IconX size={14} />
                </button>
              )}
            </div>

            {/* Resultados como botones POS */}
            <PlatilloGrid
              platillos={platillos}
              search={diaActivo.platilloSearch}
              selectedPlatillo={diaActivo.platillo}
              onSelect={handleSelectPlatillo}
            />
          </div>

          {/* Items seleccionados del platillo */}
          {diaActivo.platillo && (
            <div className="pos-selected-section">
              <div className="pos-selected-header">
                <span className="pos-selected-title">
                  <IconCheckCircle size={14} style={{ color: 'var(--success-color)' }} />
                  {diaActivo.platillo.nombre_platillo}
                </span>
                <button className="btn-ghost btn-sm" onClick={handleRemovePlatillo}>
                  Cambiar platillo
                </button>
              </div>

              {diaActivo.platilloDetalle && (
                <div className="pos-ingredientes">
                  {TIPO_OPTS.map(tipo => {
                    const componentes = diaActivo.platilloDetalle.componentes_agrupados[tipo] || [];
                    if (componentes.length === 0) return null;
                    const cfg = TIPO_LABELS[tipo] || { label: tipo, icon: '📦', color: '#64748b' };
                    const seleccionados = diaActivo.selectedItems.filter(s => s.tipo === tipo);

                    return (
                      <div key={tipo} className="pos-ing-group">
                        <div className="pos-ing-header" style={{ borderLeftColor: cfg.color }}>
                          <span className="pos-ing-icon">{cfg.icon}</span>
                          <span className="pos-ing-label">{cfg.label}</span>
                          <span className="pos-ing-count">{seleccionados.length}/{componentes.length}</span>
                        </div>
                        <div className="pos-ing-buttons">
                          {componentes.map(comp => {
                            const sel = seleccionados.find(s => s.comp_id === comp.id);
                            return (
                              <div key={comp.id} className={`pos-ing-btn-wrap ${sel ? 'pos-ing-selected' : ''}`}>
                                <button
                                  className={`pos-ing-btn ${sel ? 'pos-ing-btn-on' : ''}`}
                                  onClick={() => {
                                    const newItems = [...diaActivo.selectedItems];
                                    const idx = newItems.findIndex(s => s.comp_id === comp.id);
                                    if (idx >= 0) {
                                      newItems.splice(idx, 1);
                                    } else {
                                      newItems.push({
                                        comp_id: comp.id,
                                        ingrediente_id: comp.ingrediente_id,
                                        ingrediente_nombre: comp.ingrediente_nombre,
                                        opcion_id: comp.opcion_id,
                                        opcion_nombre: comp.opcion_nombre,
                                        tipo: comp.tipo_componente,
                                        metodo_preparacion: '',
                                        cantidad: 1,
                                        notas: '',
                                      });
                                    }
                                    handleToggleItems(newItems);
                                  }}
                                >
                                  <span className="pos-ing-btn-name">{comp.ingrediente_nombre}</span>
                                </button>
                                {sel && (
                                  <div className="pos-ing-options">
                                    <select
                                      value={sel.metodo_preparacion}
                                      onChange={e => handleItemChange(comp.id, 'metodo_preparacion', e.target.value)}
                                    >
                                      <option value="">Prep.</option>
                                      {METODOS_PREPARACION.map(m => (
                                        <option key={m} value={m}>{m}</option>
                                      ))}
                                    </select>
                                    {diaActivo.platilloDetalle.opciones_por_ingrediente[comp.ingrediente_id]?.length > 0 && (
                                      <select
                                        value={sel.opcion_id || ''}
                                        onChange={e => handleItemChange(comp.id, 'opcion_id', e.target.value ? Number(e.target.value) : null)}
                                      >
                                        <option value="">Opción</option>
                                        {diaActivo.platilloDetalle.opciones_por_ingrediente[comp.ingrediente_id].map(op => (
                                          <option key={op.id} value={op.id}>{op.nombre_opcion}</option>
                                        ))}
                                      </select>
                                    )}
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.1"
                                      value={sel.cantidad}
                                      onChange={e => {
                                        const raw = e.target.value;
                                        handleItemChange(comp.id, 'cantidad', raw === '' ? '' : parseFloat(raw) || 0);
                                      }}
                                      className="pos-qty-input"
                                      title="Cantidad"
                                    />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Botón guardar */}
          <div className="pos-actions">
            <button onClick={handleSaveFullInforme} className="btn-success" disabled={loading} style={{ width: '100%' }}>
              <IconFileText size={16} />
              {loading ? 'Guardando…' : 'Guardar Informe'}
            </button>
          </div>
        </div>

        {/* ─── COLUMNA DERECHA: Vista previa en vivo ─── */}
        <div className="pos-preview">
          <div className="pos-preview-header">
            <IconFileText size={16} />
            Informe en vivo
          </div>
          <LivePreview
            evento={evento}
            dias={dias}
            informeId={informeId}
          />
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SUBCOMPONENTE: Cuadrícula de platillos (estilo POS)
// ═══════════════════════════════════════════════════════════════
function PlatilloGrid({ platillos, search, selectedPlatillo, onSelect }) {
  const filtered = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return platillos.filter(p => p.nombre_platillo.toLowerCase().includes(q));
  }, [platillos, search]);

  if (!search.trim()) return (
    <div className="pos-grid-hint">
      <IconSearch size={20} />
      <span>Escribe para buscar platillos</span>
    </div>
  );

  if (filtered.length === 0) return (
    <div className="pos-grid-hint">
      <span>No se encontraron platillos</span>
    </div>
  );

  return (
    <div className="pos-grid">
      {filtered.map(p => (
        <button
          key={p.id}
          className={`pos-grid-btn ${selectedPlatillo?.id === p.id ? 'pos-grid-btn-active' : ''}`}
          onClick={() => onSelect(p)}
        >
          <span className="pos-grid-btn-icon">🍽️</span>
          <span className="pos-grid-btn-name">{p.nombre_platillo}</span>
        </button>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SUBCOMPONENTE: Vista previa en vivo del informe
// ═══════════════════════════════════════════════════════════════
function LivePreview({ evento, dias, informeId }) {
  return (
    <div className="live-preview">
      {/* Datos del evento */}
      <div className="live-preview-event">
        <div className="live-preview-inst">{evento?.Institucion || '—'}</div>
        <div className="live-preview-meta">
          <span><strong>{evento?.Pax || '?'}</strong> pax</span>
          <span>{evento?.Salon || '?'}</span>
          <span>{evento?.TipoEvento || '?'}</span>
        </div>
        {informeId && (
          <div className="live-preview-badge">Informe #{informeId}</div>
        )}
      </div>

      {/* Días */}
      <div className="live-preview-dias">
        {dias.map((dia, i) => (
          <div key={i} className="live-preview-dia">
            <div className="live-preview-dia-header">
              <span className="live-preview-dia-num">Día {i + 1}</span>
              <span className="live-preview-dia-fecha">
                {dia.fecha ? new Date(dia.fecha + 'T12:00:00').toLocaleDateString('es-ES', {
                  weekday: 'long', day: 'numeric', month: 'long'
                }) : 'Sin fecha'}
              </span>
            </div>

            {dia.platillo ? (
              <>
                <div className="live-preview-platillo">
                  🍽️ {dia.platillo.nombre_platillo}
                </div>
                {dia.selectedItems.length > 0 && (
                  <div className="live-preview-items">
                    {TIPO_OPTS.map(tipo => {
                      const items = dia.selectedItems.filter(s => s.tipo === tipo);
                      if (items.length === 0) return null;
                      const cfg = TIPO_LABELS[tipo] || { label: tipo, icon: '📦', color: '#64748b' };
                      return (
                        <div key={tipo} className="live-preview-tipo">
                          <span className="live-preview-tipo-label" style={{ color: cfg.color }}>
                            {cfg.icon} {cfg.label}
                          </span>
                          <div className="live-preview-tipo-items">
                            {items.map(item => (
                              <span key={item.comp_id} className="live-preview-chip">
                                {item.ingrediente_nombre}
                                {item.metodo_preparacion && <small> ({item.metodo_preparacion})</small>}
                                <strong> ×{item.cantidad}</strong>
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <div className="live-preview-empty">
                Selecciona un platillo en el panel izquierdo
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer del preview */}
      <div className="live-preview-footer">
        Documento generado automáticamente
      </div>
    </div>
  );
}
