import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import TimeSelect from '../../../components/TimeSelect';
import { loadState as loadCrmState } from '../../../services/stateService';
import './MenuMontajePanel.pos.css';

const uid = () => Math.random().toString(36).substring(2, 9);

const AutoResizeTextarea = ({ value, onChange, placeholder, className, style }) => {
  const textareaRef = useRef(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [value]);

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={className}
      rows={1}
      style={{
        ...style,
        resize: 'none',
        overflowY: 'hidden',
        boxSizing: 'border-box'
      }}
    />
  );
};

const Icon = {
  plate: <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /></svg>,
  prep: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 20h10v-7a5 5 0 0 0-10 0v7Z" /><path d="M5 20h14" /><path d="M8 9a4 4 0 0 1 8 0" /></svg>,
  sauce: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6" /><path d="M10 3v7" /><path d="M14 3v7" /><path d="M7 14a5 5 0 0 0 10 0c0-3-2-4-5-4s-5 1-5 4Z" /><path d="M8 17h8" /></svg>,
  side: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20 20 4" /><path d="M6 13c-2 2-2 5 0 7 2-2 2-5 0-7Z" /><path d="M11 8c-2 2-2 5 0 7 2-2 2-5 0-7Z" /><path d="M16 3c-2 2-2 5 0 7 2-2 2-5 0-7Z" /></svg>,
  dessert: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 11h10" /><path d="M8 11v8h8v-8" /><path d="M10 7a2 2 0 1 0 4 0 2 2 0 0 0-4 0Z" /></svg>,
  drink: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3h8l-1 16H9L8 3Z" /><path d="M9 8h6" /><path d="M10 21h4" /></svg>,
  bread: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 17c0-5 3-9 7-9s7 4 7 9a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3Z" /><path d="M9 11c1 1 1 3 0 4" /><path d="M13 10c1 1 1 4 0 6" /></svg>,
  layout: <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="7" height="7" rx="1" /><rect x="13" y="4" width="7" height="7" rx="1" /><rect x="4" y="13" width="16" height="7" rx="1" /></svg>,
  plus: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14" /><path d="M5 12h14" /></svg>,
  edit: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4Z" /><path d="m14 6 4 4" /></svg>,
  trash: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16" /><path d="M9 7V5h6v2" /><path d="m6 7 1 13h10l1-13" /></svg>,
  close: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12" /><path d="m18 6-12 12" /></svg>,
  search: <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m16 16 4 4" /></svg>,
  catalog: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h7a3 3 0 0 1 3 3v11a3 3 0 0 0-3-3H4V5Z" /><path d="M20 5h-7a3 3 0 0 0-3 3" /></svg>,
  print: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 9V4h10v5" /><path d="M7 17H5a2 2 0 0 1-2-2v-4h18v4a2 2 0 0 1-2 2h-2" /><path d="M7 14h10v6H7z" /></svg>,
  save: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h12l2 2v14H5V4Z" /><path d="M8 4v6h8" /><path d="M8 20v-6h8v6" /></svg>,
  check: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>,
};

const STAGES_MENU = [
  { id: 'plato', label: 'Plato Fuerte', icon: '🍽️', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.14)' },
  { id: 'preparacion', label: 'Preparación', icon: '👨‍🍳', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.14)' },
  { id: 'salsa', label: 'Salsas', icon: '🫙', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.14)' },
  { id: 'guarnicion', label: 'Guarniciones', icon: '🥦', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.14)' },
  { id: 'postre', label: 'Postres', icon: '🍰', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.14)' },
  { id: 'bebida', label: 'Bebidas', icon: '🥤', color: '#ec4899', bg: 'rgba(236, 72, 153, 0.14)' },
  { id: 'comentario', label: 'Pan/Tortilla', icon: '🥖', color: '#84cc16', bg: 'rgba(132, 204, 22, 0.14)' },
  { id: 'adicional_menu', label: 'Adicionales', icon: '✨', color: '#f43f5e', bg: 'rgba(244, 63, 94, 0.14)' },
];

const STAGES_MONTAJE = [
  { id: 'montaje_tipo', label: 'Tipo Montaje', icon: '🏛️', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.14)' },
  { id: 'montaje_adicional', label: 'Adicionales', icon: '✨', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.14)' },
];

const CATALOG_KIND_OPTIONS = [
  { value: 'plato_fuerte', label: 'Proteína / Plato base' },
  { value: 'preparacion', label: 'Preparación' },
  { value: 'salsa', label: 'Salsas' },
  { value: 'guarnicion', label: 'Guarniciones' },
  { value: 'postre', label: 'Postres' },
  { value: 'bebida', label: 'Bebidas' },
  { value: 'comentario', label: 'Tortilla/Pan y extras' },
  { value: 'montaje_tipo', label: 'Montaje Tipo' },
  { value: 'montaje_adicional', label: 'Montaje Adicional' },
];

const EMPTY_RULE_LINKS = {
  salsaIds: [],
  guarnicionIds: [],
  postreIds: [],
  bebidaIds: [],
  montajeTipoIds: [],
  montajeAdicionalIds: [],
};

const RULE_GROUPS = [
  { key: 'salsaIds', title: 'Salsas', catalog: 'salsas' },
  { key: 'guarnicionIds', title: 'Guarniciones', catalog: 'guarniciones' },
  { key: 'postreIds', title: 'Postres', catalog: 'postres' },
  { key: 'bebidaIds', title: 'Bebidas', catalog: 'bebidas' },
  { key: 'montajeTipoIds', title: 'Tipos de montaje', catalog: 'montajeTipos' },
  { key: 'montajeAdicionalIds', title: 'Adicionales de montaje', catalog: 'montajeAdicionales' },
];

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

const ensureQtyMap = (ids = [], qtyMap = {}) => ids.reduce((acc, id) => {
  const key = String(id);
  const val = qtyMap?.[key] ?? qtyMap?.[id];
  acc[key] = val === '' ? 1 : Math.max(1, Number(val || 1) || 1);
  return acc;
}, {});

const normalizeIdList = (ids = []) => Array.from(new Set(
  (Array.isArray(ids) ? ids : [])
    .map(Number)
    .filter((id) => Number.isFinite(id) && id > 0),
));

const normalizeLineItem = (line = {}) => {
  const salsaIds = (line.salsaIds || []).map(Number).filter(Boolean);
  const guarnicionIds = (line.guarnicionIds || []).map(Number).filter(Boolean);
  const postreIds = (line.postreIds || []).map(Number).filter(Boolean);
  const bebidaIds = (line.bebidaIds || []).map(Number).filter(Boolean);
  const comentarioIds = (line.comentarioIds || []).map(Number).filter(Boolean);
  return {
    ...line,
    key: line.key || uid(),
    platoId: line.platoId ? Number(line.platoId) : null,
    preparacionId: line.preparacionId ? Number(line.preparacionId) : null,
    qty: line.qty === '' ? 1 : Math.max(1, Number(line.qty || 1) || 1),
    servicioHora: line.servicioHora || '',
    salsaIds,
    salsaQtys: ensureQtyMap(salsaIds, line.salsaQtys),
    guarnicionIds,
    guarnicionQtys: ensureQtyMap(guarnicionIds, line.guarnicionQtys),
    postreIds,
    postreQtys: ensureQtyMap(postreIds, line.postreQtys),
    bebidaIds,
    bebidaQtys: ensureQtyMap(bebidaIds, line.bebidaQtys),
    comentarioIds,
    comentarioQtys: ensureQtyMap(comentarioIds, line.comentarioQtys),
    adicionales: (line.adicionales || []).map((a) => ({
      id: String(a.id),
      nombre: String(a.nombre || ''),
      qty: a.qty === '' ? 1 : Math.max(1, Number(a.qty) || 1),
    })),
    suggestedSalsaIds: normalizeIdList(line.suggestedSalsaIds),
    suggestedGuarnicionIds: normalizeIdList(line.suggestedGuarnicionIds),
    suggestedPostreIds: normalizeIdList(line.suggestedPostreIds),
    suggestedBebidaIds: normalizeIdList(line.suggestedBebidaIds),
    comentarioLibre: '',
  };
};

function StagePicker({ stage, items, selected, isMulti, onToggle, onClose, quantities = {}, onQtyChange, onQtySet }) {
  const [filter, setFilter] = useState('');
  const filtered = useMemo(() => {
    const term = filter.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) => String(item.nombre || '').toLowerCase().includes(term));
  }, [filter, items]);

  return (
    <div className="mmp-modalShade" onMouseDown={onClose}>
      <section className="mmp-picker" onMouseDown={(event) => event.stopPropagation()}>
        <header className="mmp-pickerHead" style={{ '--stage-bg': stage.bg, '--stage-color': stage.color }}>
          <span className="mmp-pickerIcon">{stage.icon}</span>
          <div>
            <h3>{stage.label}</h3>
            <p>{isMulti ? 'Selección múltiple permitida' : 'Seleccione una opción'}</p>
          </div>
          <button className="mmp-iconBtn" type="button" onClick={onClose} aria-label="Cerrar">&#10005;</button>
        </header>

        <div className="mmp-pickerSearch">
          <span>{Icon.search}</span>
          <input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder={`Filtrar ${stage.label.toLowerCase()}...`} />
        </div>

        <div className="mmp-pickerGrid">
          {stage.id === 'adicional_menu' && filter.trim() && (
            <div
              className="mmp-pickerItem is-add-custom"
              style={{ '--stage-bg': stage.bg, '--stage-color': stage.color, borderStyle: 'dashed' }}
              onClick={() => {
                const newName = filter.trim();
                const newItem = { id: 'custom-' + Date.now(), nombre: newName };
                onToggle(newItem);
                setFilter('');
              }}
            >
              <div style={{ flex: 1, fontWeight: 'bold', color: stage.color }}>
                + Agregar "{filter.trim()}"
              </div>
            </div>
          )}
          {filtered.map((item) => {
            const isSelected = selected.includes(String(item.id));
            const rawQty = isSelected ? (quantities[String(item.id)] ?? quantities[item.id]) : 1;
            const displayQty = rawQty === '' ? '' : (Number(rawQty) || 1);
            return (
              <div
                key={item.id}
                className={`mmp-pickerItem ${isSelected ? 'is-selected' : ''}`}
                style={{ '--stage-bg': stage.bg, '--stage-color': stage.color }}
                onClick={() => onToggle(item)}
              >
                <div
                  className="mmp-pickerItemContent"
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    gap: '4px',
                    minWidth: 0,
                  }}
                >
                  <span>{item.nombre}</span>
                  {isSelected && <small>Seleccionado</small>}
                </div>
                {isMulti && isSelected && (
                  <div className="mmp-pickerItemQty" onClick={(event) => event.stopPropagation()}>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        if (displayQty === '' || Number(displayQty) <= 1) {
                          onQtySet?.(item, 1);
                        } else {
                          onQtyChange?.(item, -1);
                        }
                      }}
                    >
                      -
                    </button>
                    <input
                      type="number"
                      value={displayQty}
                      onChange={(event) => {
                        const valStr = event.target.value;
                        const val = valStr === '' ? '' : Math.max(1, parseInt(valStr, 10) || 1);
                        onQtySet?.(item, val);
                      }}
                      onBlur={(event) => {
                        if (event.target.value === '' || parseInt(event.target.value, 10) < 1) {
                          onQtySet?.(item, 1);
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onQtyChange?.(item, 1);
                      }}
                    >
                      +
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {!filtered.length && stage.id !== 'adicional_menu' && <div className="mmp-empty">Sin opciones disponibles</div>}
        </div>

        <footer className="mmp-pickerFoot">
          <button className="mmp-primaryBtn" type="button" onClick={onClose}>Listo</button>
        </footer>
      </section>
    </div>
  );
}

function LineCard({ line, index, catalogs, active, onEdit, onRemove, onQtyChange, onQtySet, onTimeChange, onComponentQtyChange, onComponentQtySet, onRemoveComponent }) {
  const protein = catalogs.proteins.find((item) => String(item.id) === String(line.platoId));
  const prep = catalogs.preparations.find((item) => String(item.id) === String(line.preparacionId));
  const componentRows = [
    prep?.nombre && { label: 'Preparación', value: prep.nombre, fixed: true },
    { label: 'Salsas', ids: line.salsaIds, qtys: line.salsaQtys, list: catalogs.salsas, field: 'salsaQtys' },
    { label: 'Guarniciones', ids: line.guarnicionIds, qtys: line.guarnicionQtys, list: catalogs.guarniciones, field: 'guarnicionQtys' },
    { label: 'Postres', ids: line.postreIds, qtys: line.postreQtys, list: catalogs.postres, field: 'postreQtys' },
    { label: 'Bebidas', ids: line.bebidaIds, qtys: line.bebidaQtys, list: catalogs.bebidas, field: 'bebidaQtys' },
    { label: 'Pan/Tortilla', ids: line.comentarioIds, qtys: line.comentarioQtys, list: catalogs.comentarios, field: 'comentarioQtys' },
    { label: 'Adicionales', ids: line.adicionales?.map(a => a.id) || [], qtys: line.adicionales?.reduce((acc, a) => { acc[a.id] = a.qty; return acc; }, {}) || {}, list: line.adicionales || [], field: 'adicionales' },
  ].filter((row) => row && (row.fixed || row.ids?.length));

  const displayLineQty = line.qty === '' ? '' : (Number(line.qty) || 1);

  return (
    <article
      className={`mmp-lineCard ${active ? 'is-active' : ''}`}
      style={{ cursor: 'pointer' }}
      onClick={(event) => {
        const isInteractive = event.target.closest('button, input, textarea, select');
        if (!isInteractive) {
          onEdit();
        }
      }}
    >
      <div className="mmp-lineTop">
        <button className="mmp-lineTitle" type="button" onClick={onEdit}>
          <b>Plato {index + 1}</b>
          <span>{protein?.nombre || 'Sin plato fuerte'}</span>
        </button>
        <div className="mmp-lineQty">
          <button
            type="button"
            onClick={() => {
              if (displayLineQty === '' || Number(displayLineQty) <= 1) {
                onQtySet?.(1);
              } else {
                onQtyChange(-1);
              }
            }}
          >
            -
          </button>
          <input
            type="number"
            value={displayLineQty}
            onChange={(event) => {
              const valStr = event.target.value;
              const val = valStr === '' ? '' : Math.max(1, parseInt(valStr, 10) || 1);
              onQtySet?.(val);
            }}
            onBlur={(event) => {
              if (event.target.value === '' || parseInt(event.target.value, 10) < 1) {
                onQtySet?.(1);
              }
            }}
          />
          <button type="button" onClick={() => onQtyChange(1)}>+</button>
        </div>
        <button className="mmp-rowAction" type="button" onClick={onEdit} title="Editar plato">Editar</button>
        <button className="mmp-rowAction danger" type="button" onClick={onRemove} title="Quitar plato">Quitar</button>
      </div>

      <div className="mmp-lineControls is-compact">
        <label>
          Hora
          <TimeSelect value={line.servicioHora || ''} onChange={onTimeChange} />
        </label>
      </div>

      {!!componentRows.length && (
        <div className="mmp-lineDetails">
          {componentRows.map((row) => (
            <div className="mmp-componentGroup" key={row.label}>
              <b>{row.label}</b>
              {row.fixed ? (
                <span className="mmp-componentPill">{row.value}</span>
              ) : row.ids.map((id) => {
                const item = row.list.find((catalogItem) => String(catalogItem.id) === String(id));
                if (!item) return null;
                const rawQty = row.qtys?.[String(id)] ?? row.qtys?.[id];
                const displayQty = rawQty === '' ? '' : (Number(rawQty) || 1);
                return (
                  <span className="mmp-componentPill is-editable" key={`${row.field}-${id}`}>
                    {item.nombre}
                    <button
                      type="button"
                      onClick={() => {
                        if (displayQty === '' || Number(displayQty) <= 1) {
                          onComponentQtySet?.(row.field, id, 1);
                        } else {
                          onComponentQtyChange(row.field, id, -1);
                        }
                      }}
                    >
                      -
                    </button>
                    <input
                      type="number"
                      value={displayQty}
                      onChange={(event) => {
                        const valStr = event.target.value;
                        const val = valStr === '' ? '' : Math.max(1, parseInt(valStr, 10) || 1);
                        onComponentQtySet?.(row.field, id, val);
                      }}
                      onBlur={(event) => {
                        if (event.target.value === '' || parseInt(event.target.value, 10) < 1) {
                          onComponentQtySet?.(row.field, id, 1);
                        }
                      }}
                    />
                    <button type="button" onClick={() => onComponentQtyChange(row.field, id, 1)}>+</button>
                    <button
                      className="mmp-pill-remove"
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveComponent?.(row.field, id);
                      }}
                      title="Quitar complemento"
                    >
                      ✕
                    </button>
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

export default function MenuMontajePanel({
  event,
  quote = {},
  setQuote,
  initialMode = 'builder',
  onDirtyChange,
  onPersistQuote,
  onClose,
}) {
  const [activeSubTab, setActiveSubTab] = useState(initialMode);
  const [primaryMode, setPrimaryMode] = useState('menu');
  const [selectedKey, setSelectedKey] = useState('');
  const [events, setEvents] = useState([]);
  const [activeStageId, setActiveStageId] = useState('');
  const [notice, setNotice] = useState(null);

  const [catalogs, setCatalogs] = useState({
    proteins: [],
    preparations: [],
    salsas: [],
    guarniciones: [],
    postres: [],
    bebidas: [],
    comentarios: [],
    montajeTipos: [],
    montajeAdicionales: [],
  });

  const [selectedProtein, setSelectedProtein] = useState('');
  const [selectedPrep, setSelectedPrep] = useState('');
  const [selectedSalsas, setSelectedSalsas] = useState([]);
  const [selectedGuarniciones, setSelectedGuarniciones] = useState([]);
  const [selectedPostres, setSelectedPostres] = useState([]);
  const [selectedBebidas, setSelectedBebidas] = useState([]);
  const [selectedComentarios, setSelectedComentarios] = useState([]);
  const [selectedMontajeTipo, setSelectedMontajeTipo] = useState('');
  const [selectedMontajeAdicionales, setSelectedMontajeAdicionales] = useState([]);

  const [menuTitle, setMenuTitle] = useState('');
  const [menuQty, setMenuQty] = useState('');
  const [menuNotes, setMenuNotes] = useState('');
  const [menuDescription, setMenuDescription] = useState('');
  const [montajeDescription, setMontajeDescription] = useState('');
  const [editingCompiledMenu, setEditingCompiledMenu] = useState(false);
  const [editingCompiledMontaje, setEditingCompiledMontaje] = useState(false);
  const [selectedMmsVersion, setSelectedMmsVersion] = useState(quote.menuMontajeVersion || 1);
  const [lineItemsDraft, setLineItemsDraft] = useState([]);
  const [activeLineKey, setActiveLineKey] = useState('');

  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [catalogMode, setCatalogMode] = useState('base');
  const [catalogKind, setCatalogKind] = useState('plato_fuerte');
  const [catalogItems, setCatalogItems] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogNameDraft, setCatalogNameDraft] = useState('');
  const [catalogProteinDraft, setCatalogProteinDraft] = useState('');
  const [catalogDishTypeDraft, setCatalogDishTypeDraft] = useState('NORMAL');
  const [catalogEditingItem, setCatalogEditingItem] = useState(null);
  const [ruleProtein, setRuleProtein] = useState('');
  const [rulePreparation, setRulePreparation] = useState('');
  const [rulePreparations, setRulePreparations] = useState([]);
  const [ruleLinks, setRuleLinks] = useState(EMPTY_RULE_LINKS);
  const [ruleLoading, setRuleLoading] = useState(false);
  const [ruleSaving, setRuleSaving] = useState(false);
  const [printPreviewHtml, setPrintPreviewHtml] = useState('');

  const savedDraftSnapshotRef = useRef('');

  const buildDraftSnapshot = useCallback((values = {}) => JSON.stringify({
    selectedKey: values.selectedKey ?? selectedKey,
    menuTitle: values.menuTitle ?? menuTitle,
    menuQty: String(values.menuQty ?? menuQty ?? ''),
    menuNotes: values.menuNotes ?? menuNotes,
    menuDescription: values.menuDescription ?? menuDescription,
    montajeDescription: values.montajeDescription ?? montajeDescription,
    lineItemsDraft: values.lineItemsDraft ?? lineItemsDraft,
  }), [selectedKey, menuTitle, menuQty, menuNotes, menuDescription, montajeDescription, lineItemsDraft]);

  const showNotice = (message) => {
    const id = Date.now();
    setNotice({ id, message });
    window.setTimeout(() => setNotice((current) => (current?.id === id ? null : current)), 3400);
  };

  const loadData = async () => {
    try {
      const data = await loadCrmState();
      setEvents(data?.events || []);

      const kinds = ['plato_fuerte', 'salsa', 'guarnicion', 'postre', 'bebida', 'comentario', 'montaje_tipo', 'montaje_adicional'];
      const [proteins, salsas, guarniciones, postres, bebidas, comentarios, montajeTipos, montajeAdicionales] = await Promise.all(
        kinds.map((kind) => fetch(`/api/menu-catalog/${kind}`).then((res) => res.json()).catch(() => ({ items: [] }))),
      );

      setCatalogs((prev) => ({
        ...prev,
        proteins: (proteins.items || []).filter((item) => item.activo !== false),
        salsas: (salsas.items || []).filter((item) => item.activo !== false),
        guarniciones: (guarniciones.items || []).filter((item) => item.activo !== false),
        postres: (postres.items || []).filter((item) => item.activo !== false),
        bebidas: (bebidas.items || []).filter((item) => item.activo !== false),
        comentarios: (comentarios.items || []).filter((item) => item.activo !== false),
        montajeTipos: (montajeTipos.items || []).filter((item) => item.activo !== false),
        montajeAdicionales: (montajeAdicionales.items || []).filter((item) => item.activo !== false),
      }));
    } catch {
      console.error('Error cargando Menú y Montaje.');
      showNotice('No se pudieron cargar todos los catálogos.');
    }
  };

  useEffect(() => { loadData(); }, []);
  useEffect(() => { setActiveSubTab(initialMode); }, [initialMode]);

  useEffect(() => {
    if (!savedDraftSnapshotRef.current) return;
    onDirtyChange?.(buildDraftSnapshot() !== savedDraftSnapshotRef.current);
  }, [selectedKey, menuTitle, menuQty, menuNotes, menuDescription, montajeDescription, lineItemsDraft, buildDraftSnapshot, onDirtyChange]);

  useEffect(() => {
    if (!selectedProtein) {
      setCatalogs((prev) => ({ ...prev, preparations: [] }));
      setSelectedPrep('');
      return;
    }

    fetch(`/api/menu-catalog/preparacion?plato_id=${selectedProtein}`)
      .then((res) => res.json())
      .then((data) => {
        const preps = (data.items || []).filter((item) => item.activo !== false);
        setCatalogs((prev) => ({ ...prev, preparations: preps }));
        setSelectedPrep(preps[0]?.id ? String(preps[0].id) : '');
      })
      .catch(() => setCatalogs((prev) => ({ ...prev, preparations: [] })));
  }, [selectedProtein]);

  const combos = useMemo(() => {
    if (!event) return [];
    const groupId = event.id_grupo || event.idGroup;
    let source = groupId && events.length
      ? events.filter((item) => String(item.id_grupo || item.idGroup || '') === String(groupId))
      : [event];

    if (Array.isArray(event.slots) && event.slots.length) {
      source = event.slots.map((slot) => ({
        ...event,
        fecha_evento: slot.dateStart || slot.date || event.date,
        date: slot.dateStart || slot.date || event.date,
        nombre_salon: slot.salon || event.salon,
        salon: slot.salon || event.salon,
        hora_inicio: slot.startTime || event.startTime,
      }));
    }

    const result = [];
    const seen = new Set();
    source
      .slice()
      .sort((a, b) => String(a.fecha_evento || a.date || '').localeCompare(String(b.fecha_evento || b.date || '')))
      .forEach((item) => {
        const date = item.fecha_evento || item.date || '';
        const salon = item.nombre_salon || item.salon || '';
        if (!date || !salon) return;
        const key = `${date}|${salon}`;
        if (seen.has(key)) return;
        seen.add(key);
        result.push({ key, date, salon });
      });

    return result;
  }, [event, events]);

  useEffect(() => {
    if (combos.length > 0 && !selectedKey) setSelectedKey(combos[0].key);
  }, [combos, selectedKey]);

  useEffect(() => {
    if (!selectedKey) return;

    const [date, salon] = selectedKey.split('|');
    const entry = (quote.menuMontajeEntries || []).find(
      (item) => String(item.date || '') === date && String(item.salon || '') === salon,
    );
    const nextMenuTitle = entry?.menuTitle || '';
    const nextMenuQty = entry?.menuQty || quote.people || event?.pax || '';
    const nextMenuNotes = entry?.menuNotes || entry?.generalNotes || '';
    const nextMenuDescription = entry?.menuDescription || '';
    const nextMontajeDescription = entry?.montajeDescription || '';
    const nextLines = Array.isArray(entry?.lineItems) ? entry.lineItems.map(normalizeLineItem) : [];

    setMenuTitle(nextMenuTitle);
    setMenuQty(nextMenuQty);
    setMenuNotes(nextMenuNotes);
    setMenuDescription(nextMenuDescription);
    setMontajeDescription(nextMontajeDescription);
    setLineItemsDraft(nextLines);
    setActiveLineKey('');
    setSelectedProtein('');
    setSelectedPrep('');
    setSelectedSalsas([]);
    setSelectedGuarniciones([]);
    setSelectedPostres([]);
    setSelectedBebidas([]);
    setSelectedComentarios([]);
    setSelectedMontajeTipo('');
    setSelectedMontajeAdicionales([]);
    savedDraftSnapshotRef.current = buildDraftSnapshot({
      selectedKey,
      menuTitle: nextMenuTitle,
      menuQty: nextMenuQty,
      menuNotes: nextMenuNotes,
      menuDescription: nextMenuDescription,
      montajeDescription: nextMontajeDescription,
      lineItemsDraft: nextLines,
    });
    onDirtyChange?.(false);
  }, [selectedKey, quote.menuMontajeEntries, selectedMmsVersion, buildDraftSnapshot, onDirtyChange, quote.people, event?.pax]);

  const findName = (list, id, fallback = 'Por definir') => (
    list.find((item) => String(item.id) === String(id))?.nombre || fallback
  );

  const formatComponents = (ids = [], qtys = {}, list = []) => {
    if (!ids.length) return 'Por definir';
    return ids.map((id) => {
      const name = findName(list, id, '');
      if (!name) return '';
      const qty = Math.max(1, Number(qtys?.[String(id)] || qtys?.[id] || 1) || 1);
      return qty > 1 ? `${name} (x${qty})` : name;
    }).filter(Boolean).join(', ') || 'Por definir';
  };

  const compileMenuDescription = useCallback((items) => {
    const generalComment = String(menuNotes || '').trim();
    if (!items.length) {
      return `[PLATOS FUERTES]\n- Por definir${generalComment ? `\n\n[COMENTARIO]\n- ${generalComment}` : ''}`;
    }

    const plates = items.map((rawLine, index) => {
      const line = normalizeLineItem(rawLine);
      const plateName = findName(catalogs.proteins, line.platoId);
      const prepName = line.preparacionId ? findName(catalogs.preparations, line.preparacionId, `Preparación #${line.preparacionId}`) : 'Por definir';
      const salsas = formatComponents(line.salsaIds, line.salsaQtys, catalogs.salsas);
      const guarniciones = formatComponents(line.guarnicionIds, line.guarnicionQtys, catalogs.guarniciones);
      const postres = formatComponents(line.postreIds, line.postreQtys, catalogs.postres);
      const bebidas = formatComponents(line.bebidaIds, line.bebidaQtys, catalogs.bebidas);
      const panTortilla = formatComponents(line.comentarioIds, line.comentarioQtys, catalogs.comentarios);
      const adicionales = formatComponents(line.adicionales?.map(a => a.id) || [], line.adicionales?.reduce((acc, a) => { acc[a.id] = a.qty; return acc; }, {}) || {}, line.adicionales || []);

      const parts = [
        `PLATO FUERTE (Cant ${line.qty || 1} - ${plateName})`,
        `HORARIO (${line.servicioHora || 'Sin hora'})`,
        `PREPARACION (${prepName})`,
        `SALSAS (${salsas})`,
        `GUARNICIONES (${guarniciones})`,
        `POSTRES (${postres})`,
        `BEBIDAS (${bebidas})`,
        `PAN/TORTILLA (${panTortilla})`,
      ];
      if (adicionales && adicionales !== 'Por definir') {
        parts.push(`ADICIONALES (${adicionales})`);
      }
      return `[PLATO ${index + 1}]\n- ${parts.join(' | ')}`;
    }).join('\n\n');

    return `${plates}${generalComment ? `\n\n[COMENTARIO]\n- ${generalComment}` : ''}`;
  }, [menuNotes, catalogs]);

  const compileMontajeDescription = (tipo = selectedMontajeTipo, adicionales = selectedMontajeAdicionales) => {
    const tipoName = tipo ? findName(catalogs.montajeTipos, tipo) : 'Por definir';
    const adicionalesText = adicionales.length
      ? adicionales.map((id) => findName(catalogs.montajeAdicionales, id, '')).filter(Boolean).join(', ')
      : 'Ninguno';
    return `[MONTAJE]\n- TIPO (${tipoName}) | ADICIONALES (${adicionalesText})`;
  };

  useEffect(() => {
    if (activeSubTab !== 'builder') return;
    if (!lineItemsDraft.length && !String(menuNotes || '').trim()) return;
    setMenuDescription(compileMenuDescription(lineItemsDraft));
  }, [menuNotes, lineItemsDraft, catalogs.proteins, catalogs.preparations, catalogs.salsas, catalogs.guarniciones, catalogs.postres, catalogs.bebidas, catalogs.comentarios, activeSubTab, compileMenuDescription]);

  const updateLines = (updater) => {
    setLineItemsDraft((current) => {
      const next = typeof updater === 'function' ? updater(current) : updater;
      setMenuDescription(compileMenuDescription(next));
      return next;
    });
  };

  const updateActiveLine = (patch) => {
    if (!activeLineKey) {
      showNotice('Seleccione un plato primero.');
      return;
    }
    updateLines((current) => current.map((line) => (line.key === activeLineKey ? { ...line, ...patch } : line)));
  };

  const applySuggestedLinksToLine = (line, links = {}) => {
    const salsaIds = normalizeIdList(links.salsaIds);
    const guarnicionIds = normalizeIdList(links.guarnicionIds);
    const postreIds = normalizeIdList(links.postreIds);
    const bebidaIds = normalizeIdList(links.bebidaIds);
    return {
      ...line,
      suggestedSalsaIds: salsaIds,
      suggestedGuarnicionIds: guarnicionIds,
      suggestedPostreIds: postreIds,
      suggestedBebidaIds: bebidaIds,
    };
  };

  const loadAndApplySuggestions = async (preparacionId, preparacionName = '') => {
    const active = lineItemsDraft.find((line) => line.key === activeLineKey);
    const platoId = Number(active?.platoId || selectedProtein || 0);
    if (!activeLineKey || !platoId || !preparacionId) {
      updateActiveLine({ preparacionId });
      return;
    }

    try {
      const response = await fetch(`/api/menu-suggestions?plato_id=${platoId}&preparacion_id=${preparacionId}`);
      const links = response.ok ? await response.json() : {};
      const patch = {
        preparacionId,
        ...applySuggestedLinksToLine(active, links),
      };
      delete patch.key;
      delete patch.platoId;
      delete patch.qty;
      delete patch.servicioHora;
      updateActiveLine(patch);
      setSelectedSalsas(patch.salsaIds || []);
      setSelectedGuarniciones(patch.guarnicionIds || []);
      setSelectedPostres(patch.postreIds || []);
      setSelectedBebidas(patch.bebidaIds || []);
      const total = ['suggestedSalsaIds', 'suggestedGuarnicionIds', 'suggestedPostreIds', 'suggestedBebidaIds'].reduce((sum, key) => sum + (patch[key]?.length || 0), 0);
      showNotice(total ? `Preparación lista con ${total} opción(es) de acompañamiento.` : `Preparación agregada: ${preparacionName}`);
    } catch {
      updateActiveLine({ preparacionId });
      showNotice(`Preparación agregada: ${preparacionName}`);
    }
  };

  const changeLineComponentQty = (lineKey, qtyField, componentId, delta) => {
    updateLines((current) => current.map((line) => {
      if (line.key !== lineKey) return line;
      const currentQtys = line[qtyField] || {};
      const key = String(componentId);
      return {
        ...line,
        [qtyField]: {
          ...currentQtys,
          [key]: Math.max(1, Number(currentQtys[key] || currentQtys[componentId] || 1) + delta),
        },
      };
    }));
  };

  const removeLineComponent = async (lineKey, qtyField, componentId) => {
    const confirm = await Swal.fire({
      title: '¿Quitar complemento?',
      text: '¿Estás seguro de que deseas quitar este elemento del plato?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, quitar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#94a3b8',
    });

    if (!confirm.isConfirmed) return;

    updateLines((current) => current.map((line) => {
      if (line.key !== lineKey) return line;

      if (qtyField === 'adicionales') {
        const nextAdicionales = (line.adicionales || []).filter(
          (a) => String(a.id) !== String(componentId)
        );
        return { ...line, adicionales: nextAdicionales };
      }

      const idField = {
        salsaQtys: 'salsaIds',
        guarnicionQtys: 'guarnicionIds',
        postreQtys: 'postreIds',
        bebidaQtys: 'bebidaIds',
        comentarioQtys: 'comentarioIds',
      }[qtyField];

      if (!idField) return line;

      const nextIds = (line[idField] || []).filter((id) => String(id) !== String(componentId));
      const nextQtys = { ...(line[qtyField] || {}) };
      delete nextQtys[String(componentId)];
      delete nextQtys[componentId];

      const updatedLine = {
        ...line,
        [idField]: nextIds,
        [qtyField]: nextQtys,
      };

      if (lineKey === activeLineKey) {
        if (qtyField === 'salsaQtys') setSelectedSalsas(nextIds);
        if (qtyField === 'guarnicionQtys') setSelectedGuarniciones(nextIds);
        if (qtyField === 'postreQtys') setSelectedPostres(nextIds);
        if (qtyField === 'bebidaQtys') setSelectedBebidas(nextIds);
        if (qtyField === 'comentarioQtys') setSelectedComentarios(nextIds);
      }

      return updatedLine;
    }));
  };

  const handleEditLine = (line) => {
    setActiveLineKey(line.key);
    setSelectedProtein(String(line.platoId || ''));
    setSelectedPrep(String(line.preparacionId || ''));
    setSelectedSalsas(line.salsaIds || []);
    setSelectedGuarniciones(line.guarnicionIds || []);
    setSelectedPostres(line.postreIds || []);
    setSelectedBebidas(line.bebidaIds || []);
    setSelectedComentarios(line.comentarioIds || []);
    setPrimaryMode('menu');
  };

  const handleToggleItem = async (stageId, item) => {
    const id = Number(item.id);

    if (stageId === 'plato') {
      const qty = Math.max(1, Math.floor(Number(menuQty || quote.people || event?.pax || 1)) || 1);
      const key = activeLineKey || uid();
      const newLine = {
        key,
        platoId: id,
        preparacionId: null,
        qty,
        servicioHora: '',
        salsaIds: [],
        guarnicionIds: [],
        postreIds: [],
        bebidaIds: [],
        bebidaQtys: {},
        comentarioIds: [],
        comentarioQtys: {},
        salsaQtys: {},
        guarnicionQtys: {},
        postreQtys: {},
        adicionales: [],
        comentarioLibre: '',
      };
      setSelectedProtein(String(id));
      setMenuQty(qty);
      setActiveLineKey(key);
      updateLines((current) => (current.some((line) => line.key === key)
        ? current.map((line) => (line.key === key ? { ...line, platoId: id, qty } : line))
        : [...current, newLine]));
      setActiveStageId('');
      showNotice(`Plato agregado: ${item.nombre}`);
      return;
    }

    if (stageId === 'preparacion') {
      setSelectedPrep(String(id));
      await loadAndApplySuggestions(id, item.nombre);
      return;
    }

    if (stageId === 'adicional_menu') {
      if (!activeLineKey) {
        showNotice('Seleccione un plato primero.');
        return;
      }
      const active = lineItemsDraft.find((line) => line.key === activeLineKey);
      const currentAdicionales = active?.adicionales || [];
      const exists = currentAdicionales.some((a) => String(a.id) === String(item.id));
      let nextAdicionales;
      if (exists) {
        nextAdicionales = currentAdicionales.filter((a) => String(a.id) !== String(item.id));
      } else {
        nextAdicionales = [...currentAdicionales, { id: String(item.id), nombre: item.nombre, qty: 1 }];
      }
      updateActiveLine({ adicionales: nextAdicionales });
      return;
    }

    const multiMap = {
      salsa: ['selectedSalsas', selectedSalsas, setSelectedSalsas, 'salsaIds', 'salsaQtys'],
      guarnicion: ['selectedGuarniciones', selectedGuarniciones, setSelectedGuarniciones, 'guarnicionIds', 'guarnicionQtys'],
      postre: ['selectedPostres', selectedPostres, setSelectedPostres, 'postreIds', 'postreQtys'],
      bebida: ['selectedBebidas', selectedBebidas, setSelectedBebidas, 'bebidaIds', 'bebidaQtys'],
      comentario: ['selectedComentarios', selectedComentarios, setSelectedComentarios, 'comentarioIds', 'comentarioQtys'],
    };

    if (multiMap[stageId]) {
      const [, current, setter, field, qtyField] = multiMap[stageId];
      if (!activeLineKey) {
        showNotice('Seleccione un plato primero.');
        return;
      }
      const next = current.includes(id) ? current.filter((value) => value !== id) : [...current, id];
      setter(next);
      const active = lineItemsDraft.find((line) => line.key === activeLineKey);
      const nextQtys = ensureQtyMap(next, active?.[qtyField]);
      updateActiveLine({ [field]: next, [qtyField]: nextQtys });
      return;
    }

    if (stageId === 'montaje_tipo') {
      setSelectedMontajeTipo(String(id));
      const text = compileMontajeDescription(String(id), selectedMontajeAdicionales);
      setMontajeDescription(text);
      showNotice(`Montaje agregado: ${item.nombre}`);
      return;
    }

    if (stageId === 'montaje_adicional') {
      if (!selectedMontajeTipo) {
        showNotice('Seleccione un tipo de montaje primero.');
        return;
      }
      const next = selectedMontajeAdicionales.includes(id)
        ? selectedMontajeAdicionales.filter((value) => value !== id)
        : [...selectedMontajeAdicionales, id];
      setSelectedMontajeAdicionales(next);
      setMontajeDescription(compileMontajeDescription(selectedMontajeTipo, next));
    }
  };

  const getStageItems = (stageId) => {
    const active = lineItemsDraft.find((line) => line.key === activeLineKey);
    if (stageId === 'adicional_menu') {
      return active?.adicionales || [];
    }
    const suggestedMap = {
      salsa: ['salsas', 'suggestedSalsaIds'],
      guarnicion: ['guarniciones', 'suggestedGuarnicionIds'],
      postre: ['postres', 'suggestedPostreIds'],
      bebida: ['bebidas', 'suggestedBebidaIds'],
    };

    if (suggestedMap[stageId]) {
      const [catalogKey, suggestionKey] = suggestedMap[stageId];
      const catalog = catalogs[catalogKey] || [];
      const suggested = normalizeIdList(active?.[suggestionKey]);
      if (suggested.length) return catalog.filter((item) => suggested.includes(Number(item.id)));
      return catalog;
    }

    return ({
      plato: catalogs.proteins,
      preparacion: catalogs.preparations,
      comentario: catalogs.comentarios,
      montaje_tipo: catalogs.montajeTipos,
      montaje_adicional: catalogs.montajeAdicionales,
    }[stageId] || []);
  };

  const getSelectedForStage = (stageId) => {
    const active = lineItemsDraft.find((line) => line.key === activeLineKey);
    if (stageId === 'plato') return selectedProtein ? [selectedProtein] : [];
    if (stageId === 'preparacion') return selectedPrep ? [selectedPrep] : [];
    if (stageId === 'adicional_menu') return (active?.adicionales || []).map((a) => String(a.id));
    if (stageId === 'salsa') return (active?.salsaIds || selectedSalsas).map(String);
    if (stageId === 'guarnicion') return (active?.guarnicionIds || selectedGuarniciones).map(String);
    if (stageId === 'postre') return (active?.postreIds || selectedPostres).map(String);
    if (stageId === 'bebida') return (active?.bebidaIds || selectedBebidas).map(String);
    if (stageId === 'comentario') return (active?.comentarioIds || selectedComentarios).map(String);
    if (stageId === 'montaje_tipo') return selectedMontajeTipo ? [selectedMontajeTipo] : [];
    if (stageId === 'montaje_adicional') return selectedMontajeAdicionales.map(String);
    return [];
  };

  const getStageCount = (stageId) => {
    const active = lineItemsDraft.find((line) => line.key === activeLineKey);
    if (stageId === 'plato') return lineItemsDraft.length;
    if (stageId === 'preparacion') return active?.preparacionId ? 1 : 0;
    if (stageId === 'montaje_tipo') return selectedMontajeTipo ? 1 : 0;
    if (stageId === 'montaje_adicional') return selectedMontajeAdicionales.length;
    if (stageId === 'adicional_menu') return active?.adicionales?.length || 0;
    const field = { salsa: 'salsaIds', guarnicion: 'guarnicionIds', postre: 'postreIds', bebida: 'bebidaIds', comentario: 'comentarioIds' }[stageId];
    return active?.[field]?.length || 0;
  };

  const handleSave = async (updateCurrent = false) => {
    if (!selectedKey) {
      Swal.fire('Error', 'Seleccione fecha y salón.', 'error');
      return;
    }
    if (!menuDescription && !montajeDescription && !lineItemsDraft.length) {
      Swal.fire('Atención', 'Complete al menos menú o montaje para guardar.', 'info');
      return;
    }

    const [date, salon] = selectedKey.split('|');
    const existingEntries = [...(quote.menuMontajeEntries || [])];
    const entryIndex = existingEntries.findIndex((item) => String(item.date || '') === date && String(item.salon || '') === salon);
    const normalizedLines = lineItemsDraft.map(normalizeLineItem);
    const entry = {
      id: entryIndex >= 0 ? existingEntries[entryIndex].id : uid(),
      date,
      salon,
      menuTitle: menuTitle || `Menú de ${event?.name || event?.title || 'Evento'}`,
      menuQty: menuQty ? Number(menuQty) : '',
      menuNotes,
      menuDescription: menuDescription || compileMenuDescription(normalizedLines),
      montajeDescription,
      lineItems: normalizedLines,
      updatedAt: new Date().toISOString(),
    };

    if (entryIndex >= 0) existingEntries[entryIndex] = entry;
    else existingEntries.push(entry);

    const versions = [...(quote.menuMontajeVersions || [])];
    let version = Number(selectedMmsVersion || quote.menuMontajeVersion || 1);
    let createdNew = false;

    if (updateCurrent) {
      const versionIndex = versions.findIndex((item) => Number(item.version) === version);
      const payload = { version, entries: existingEntries, savedAt: new Date().toISOString() };
      if (versionIndex >= 0) versions[versionIndex] = payload;
      else versions.push(payload);
    } else {
      const maxVersion = versions.reduce((max, item) => Math.max(max, Number(item.version || 0)), 0);
      version = maxVersion + 1;
      versions.push({ version, entries: existingEntries, savedAt: new Date().toISOString() });
      createdNew = true;
    }

    const patch = { menuMontajeEntries: existingEntries, menuMontajeVersion: version, menuMontajeVersions: versions };
    const nextQuote = { ...quote, ...patch };
    setQuote?.((prev) => ({ ...prev, ...patch }));
    if (typeof onPersistQuote === 'function') await onPersistQuote(nextQuote);

    setSelectedMmsVersion(version);
    savedDraftSnapshotRef.current = buildDraftSnapshot({
      selectedKey,
      menuTitle: entry.menuTitle,
      menuQty: entry.menuQty,
      menuNotes: entry.menuNotes,
      menuDescription: entry.menuDescription,
      montajeDescription: entry.montajeDescription,
      lineItemsDraft: entry.lineItems,
    });
    onDirtyChange?.(false);
    Swal.fire({
      title: 'Guardado',
      text: createdNew ? `Nueva versión V${version} creada.` : `Versión V${version} actualizada.`,
      icon: 'success',
      timer: 1800,
      showConfirmButton: false,
    });
    if (!updateCurrent) onClose?.();
  };

  const handleLoadVersion = () => {
    const version = Number(selectedMmsVersion);
    const snapshot = quote.menuMontajeVersions?.find((item) => Number(item.version) === version);
    if (!snapshot) {
      Swal.fire('Error', 'Versión no encontrada.', 'error');
      return;
    }

    Swal.fire({
      title: `¿Cargar V${version}?`,
      text: 'Reemplazará las asignaciones actuales de Menú & Montaje.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Cargar',
      cancelButtonText: 'Cancelar',
    }).then((result) => {
      if (!result.isConfirmed) return;
      setQuote?.((prev) => ({ ...prev, menuMontajeEntries: snapshot.entries || [], menuMontajeVersion: version }));
      savedDraftSnapshotRef.current = '';
      onDirtyChange?.(false);
      Swal.fire('Cargado', `V${version} aplicada.`, 'success');
    });
  };

  const handleClearForm = () => {
    Swal.fire({
      title: '¿Limpiar todo?',
      text: 'Se vaciarán todas las selecciones actuales de este Menú & Montaje.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, limpiar',
      cancelButtonText: 'Cancelar',
    }).then((result) => {
      if (!result.isConfirmed) return;
      setLineItemsDraft([]);
      setActiveLineKey('');
      setSelectedProtein('');
      setSelectedPrep('');
      setSelectedSalsas([]);
      setSelectedGuarniciones([]);
      setSelectedPostres([]);
      setSelectedBebidas([]);
      setSelectedComentarios([]);
      setSelectedMontajeTipo('');
      setSelectedMontajeAdicionales([]);
      setMenuTitle('');
      setMenuQty('');
      setMenuNotes('');
      setMenuDescription('');
      setMontajeDescription('');
      showNotice('Formulario limpio.');
    });
  };

  const insertTextSnippet = (target) => {
    const separator = '\n\n------------------------------\n\n';
    if (target === 'menu') setMenuDescription((current) => `${current || ''}${separator}`);
    if (target === 'montaje') setMontajeDescription((current) => `${current || ''}${separator}`);
  };

  const buildPrintHtml = () => {
    let entries = [...(quote.menuMontajeEntries || [])];
    if (selectedKey && (menuDescription || montajeDescription || lineItemsDraft.length)) {
      const [date, salon] = selectedKey.split('|');
      const draft = {
        id: 'preview',
        date,
        salon,
        menuTitle: menuTitle || `Menú de ${event?.name || event?.title || 'Evento'}`,
        menuQty: menuQty ? Number(menuQty) : '',
        menuNotes,
        menuDescription: menuDescription || compileMenuDescription(lineItemsDraft.map(normalizeLineItem)),
        montajeDescription,
      };
      const index = entries.findIndex((item) => String(item.date || '') === date && String(item.salon || '') === salon);
      if (index >= 0) entries[index] = draft;
      else entries.push(draft);
    }

    if (!entries.length) return '';

    return `<!doctype html><html><head><meta charset="utf-8"><title>Menú & Montaje</title><style>
      *{box-sizing:border-box}body{margin:0;background:#eaf0f7;padding:22px;font-family:Segoe UI,Arial,sans-serif;color:#07162d}.card{max-width:940px;margin:0 auto 20px;border:1px solid #b9d0ea;border-radius:12px;overflow:hidden;background:#fff}.head{background:#155987;color:#fff;padding:16px 20px;font-size:20px;font-weight:900}.meta{display:grid;grid-template-columns:1fr 1fr;gap:8px 28px;padding:14px 20px;background:#eaf4ff;border-bottom:1px solid #cbdff4;font-size:13px}.block{padding:16px 20px;border-bottom:1px solid #e4edf7}.block h2{margin:0 0 10px;color:#06436e;font-size:17px;font-weight:900;text-transform:uppercase}.block pre{margin:0;white-space:pre-wrap;font-family:Segoe UI,Arial,sans-serif;font-size:13px;line-height:1.55}@media print{body{background:#fff;padding:0}.card{border-radius:0;margin:0 0 12px;page-break-after:always}}
    </style></head><body>${entries.map((entry) => `<section class="card"><div class="head">MENÚ Y MONTAJE - ${escapeHtml(entry.date)}</div><div class="meta"><div><b>Institución:</b> ${escapeHtml(quote.companyName || quote.institution || '-')}</div><div><b>No. Cotización:</b> ${escapeHtml(quote.code || 'N/A')}</div><div><b>Salón:</b> ${escapeHtml(entry.salon || 'N/A')}</div><div><b>Pax Asignado:</b> ${escapeHtml(entry.menuQty || quote.people || 'N/A')}</div><div><b>Tipo Evento:</b> ${escapeHtml(quote.eventType || 'N/A')}</div><div><b>Fecha:</b> ${escapeHtml(entry.date || 'N/A')}</div></div><div class="block"><h2>Menú - ${escapeHtml(entry.salon || '')}</h2><pre>${escapeHtml(entry.menuDescription || 'Sin detalle')}</pre></div><div class="block"><h2>Montaje - ${escapeHtml(entry.salon || '')}</h2><pre>${escapeHtml(entry.montajeDescription || 'Sin detalle')}</pre></div></section>`).join('')}</body></html>`;
  };

  const handlePreviewPrint = () => {
    const html = buildPrintHtml();
    if (!html) {
      Swal.fire('Error', 'No hay datos para vista previa.', 'error');
      return;
    }
    setPrintPreviewHtml(html);
  };

  const loadCatalogItems = useCallback(async (kind = catalogKind) => {
    setCatalogLoading(true);
    try {
      const response = await fetch(`/api/menu-catalog/${kind}`);
      const data = await response.json();
      setCatalogItems(Array.isArray(data.items) ? data.items : []);
      setCatalogEditingItem(null);
      setCatalogNameDraft('');
      setCatalogProteinDraft('');
      setCatalogDishTypeDraft('NORMAL');
    } catch {
      showNotice('No se pudo cargar el catálogo.');
    } finally {
      setCatalogLoading(false);
    }
  }, [catalogKind, showNotice]);

  useEffect(() => {
    if (showCatalogModal) loadCatalogItems(catalogKind);
  }, [showCatalogModal, catalogKind, loadCatalogItems]);

  const loadRulePreparations = useCallback(async (platoId = ruleProtein) => {
    if (!platoId) {
      setRulePreparations([]);
      setRulePreparation('');
      return;
    }
    try {
      const response = await fetch(`/api/menu-catalog/preparacion?plato_id=${platoId}`);
      const data = await response.json();
      const items = (data.items || []).filter((item) => item.activo !== false);
      setRulePreparations(items);
      setRulePreparation((current) => (items.some((item) => String(item.id) === String(current)) ? current : (items[0]?.id ? String(items[0].id) : '')));
    } catch {
      setRulePreparations([]);
      setRulePreparation('');
      showNotice('No se pudieron cargar las preparaciones.');
    }
  }, [ruleProtein, showNotice]);

  const loadRuleLinks = useCallback(async (platoId = ruleProtein, preparacionId = rulePreparation) => {
    if (!platoId || !preparacionId) {
      setRuleLinks(EMPTY_RULE_LINKS);
      return;
    }
    setRuleLoading(true);
    try {
      const response = await fetch(`/api/menu-suggestions?plato_id=${platoId}&preparacion_id=${preparacionId}`);
      const data = await response.json();
      setRuleLinks({
        salsaIds: normalizeIdList(data.salsaIds),
        guarnicionIds: normalizeIdList(data.guarnicionIds),
        postreIds: normalizeIdList(data.postreIds),
        bebidaIds: normalizeIdList(data.bebidaIds),
        montajeTipoIds: normalizeIdList(data.montajeTipoIds),
        montajeAdicionalIds: normalizeIdList(data.montajeAdicionalIds),
      });
    } catch {
      setRuleLinks(EMPTY_RULE_LINKS);
      showNotice('No se pudieron cargar las combinaciones.');
    } finally {
      setRuleLoading(false);
    }
  }, [ruleProtein, rulePreparation, showNotice]);

  useEffect(() => {
    if (!showCatalogModal || catalogMode !== 'rules') return;
    if (!ruleProtein) {
      const active = lineItemsDraft.find((line) => line.key === activeLineKey);
      if (active?.platoId) setRuleProtein(String(active.platoId));
    }
  }, [showCatalogModal, catalogMode, ruleProtein, lineItemsDraft, activeLineKey]);

  useEffect(() => {
    if (!showCatalogModal || catalogMode !== 'rules') return;
    loadRulePreparations(ruleProtein);
  }, [showCatalogModal, catalogMode, ruleProtein, loadRulePreparations]);

  useEffect(() => {
    if (!showCatalogModal || catalogMode !== 'rules') return;
    loadRuleLinks(ruleProtein, rulePreparation);
  }, [showCatalogModal, catalogMode, ruleProtein, rulePreparation, loadRuleLinks]);

  const handleToggleRule = (field, id) => {
    const numericId = Number(id);
    setRuleLinks((current) => {
      const list = normalizeIdList(current[field]);
      const next = list.includes(numericId) ? list.filter((item) => item !== numericId) : [...list, numericId];
      return { ...current, [field]: next };
    });
  };

  const handleSaveRules = async () => {
    if (!ruleProtein || !rulePreparation) {
      showNotice('Seleccione plato base y preparación.');
      return;
    }
    setRuleSaving(true);
    try {
      const response = await fetch('/api/menu-suggestions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_plato_fuerte: Number(ruleProtein),
          id_preparacion: Number(rulePreparation),
          ...ruleLinks,
        }),
      });
      const data = await response.json();
      if (!response.ok || data.ok === false) throw new Error(data.message || 'No se pudo guardar la combinación.');
      showNotice('Combinación guardada.');
      const active = lineItemsDraft.find((line) => line.key === activeLineKey);
      if (active && String(active.platoId) === String(ruleProtein) && String(active.preparacionId) === String(rulePreparation)) {
        updateLines((current) => current.map((line) => (line.key === activeLineKey ? applySuggestedLinksToLine(line, ruleLinks) : line)));
      }
    } catch {
      showNotice('No se pudo guardar la combinaci?n.');
    } finally {
      setRuleSaving(false);
    }
  };

  const handleSaveCatalogItem = async () => {
    const nombre = catalogNameDraft.trim();
    if (!nombre) {
      showNotice('Escriba el nombre del registro.');
      return;
    }

    const payload = { nombre };
    if (catalogKind === 'preparacion') payload.id_plato_fuerte = Number(catalogProteinDraft);
    if (catalogKind === 'plato_fuerte') payload.tipo_plato = catalogDishTypeDraft || 'NORMAL';
    if (catalogEditingItem) payload.activo = catalogEditingItem.activo !== false;

    try {
      const url = catalogEditingItem ? `/api/menu-catalog/${catalogKind}/${catalogEditingItem.id}` : `/api/menu-catalog/${catalogKind}`;
      const response = await fetch(url, {
        method: catalogEditingItem ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!data.ok) throw new Error(data.message || 'No se pudo guardar.');
      await loadCatalogItems(catalogKind);
      await loadData();
      showNotice(catalogEditingItem ? 'Registro actualizado.' : 'Registro guardado.');
    } catch {
      showNotice('Error al guardar el cat?logo.');
    }
  };

  const handleToggleCatalogItem = async (item) => {
    const payload = { nombre: item.nombre, activo: item.activo === false };
    if (catalogKind === 'preparacion') payload.id_plato_fuerte = item.id_plato_fuerte;
    if (catalogKind === 'plato_fuerte') payload.tipo_plato = item.tipo_plato || 'NORMAL';

    try {
      const response = await fetch(`/api/menu-catalog/${catalogKind}/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!data.ok) throw new Error(data.message || 'No se pudo actualizar.');
      await loadCatalogItems(catalogKind);
      await loadData();
      showNotice(payload.activo ? 'Registro activado.' : 'Registro inhabilitado.');
    } catch {
      showNotice('Error al actualizar cat?logo.');
    }
  };

  const currentStages = primaryMode === 'menu' ? STAGES_MENU : STAGES_MONTAJE;
  const activeStage = [...STAGES_MENU, ...STAGES_MONTAJE].find((stage) => stage.id === activeStageId);
  const activeLine = lineItemsDraft.find((line) => line.key === activeLineKey);
  const selectedCombo = combos.find((combo) => combo.key === selectedKey) || combos[0] || {
    date: quote.eventDate || event?.date || '',
    salon: quote.venue || event?.salon || '',
  };
  const hasEntries = Array.isArray(quote.menuMontajeEntries) && quote.menuMontajeEntries.length > 0;

  return (
    <div className="mmp-pos">
      {notice && <div className="mmp-toast"><span>{notice.message}</span><i /></div>}

      <header className="mmp-shellHead">
        <div className="mmp-titleBlock" aria-hidden="true">
          <h2>Menú & Montaje</h2>
          <p>Gestión de comandas por evento</p>
        </div>
        <button className="mmp-close-btn" type="button" onClick={onClose} aria-label="Cerrar">✕</button>

        <div className="mmp-segment">
          <button type="button" className={primaryMode === 'menu' ? 'is-active' : ''} onClick={() => { setPrimaryMode('menu'); setActiveStageId(''); }}>Menú</button>
          <button type="button" className={primaryMode === 'montaje' ? 'is-active' : ''} onClick={() => { setPrimaryMode('montaje'); setActiveStageId(''); }}>Montaje</button>
        </div>

        <div className="mmp-segment">
          <button type="button" className={activeSubTab === 'builder' ? 'is-active' : ''} onClick={() => setActiveSubTab('builder')}>Constructor</button>
          <button type="button" className={activeSubTab === 'classic' ? 'is-active' : ''} onClick={() => setActiveSubTab('classic')}>Manual</button>
        </div>

        <div className="mmp-headFields">
          <label>
            Versión
            <select value={selectedMmsVersion} onChange={(event) => setSelectedMmsVersion(Number(event.target.value))}>
              {quote.menuMontajeVersions?.length
                ? quote.menuMontajeVersions.map((version) => <option key={version.version} value={version.version}>V{version.version} ({version.savedAt?.split('T')[0] || 'sin fecha'})</option>)
                : <option value="1">V1 (Borrador)</option>}
            </select>
          </label>
          <div className="mmp-headAction"><span aria-hidden="true">.</span><button className="mmp-lightBtn" type="button" onClick={handleLoadVersion}>Cargar</button></div>
          <label>
            Fecha / Salón
            <select value={selectedKey} onChange={(event) => setSelectedKey(event.target.value)}>
              {combos.map((combo) => <option key={combo.key} value={combo.key}>{combo.date} · {combo.salon}</option>)}
            </select>
          </label>
          <div className="mmp-headAction"><span aria-hidden="true">.</span><span className="mmp-code">{quote.code || 'Sin código'}</span></div>
          <div className="mmp-headAction mmp-desktop-close"><span aria-hidden="true">.</span><button className="mmp-lightBtn danger" type="button" onClick={onClose}>Cerrar</button></div>
        </div>
      </header>

      <main className="mmp-layout">
        <section className="mmp-workspace">
          {activeSubTab === 'builder' ? (
            <>
              <div className="mmp-workIntro">
                <div>
                  <h3>Armar menú y montaje</h3>
                  <p>{selectedCombo.date || 'Sin fecha'} · {selectedCombo.salon || 'Sin salón'}</p>
                </div>
                <div className="mmp-workActions">
                  <button className="mmp-lightBtn" type="button" onClick={() => setShowCatalogModal(true)}>{Icon.catalog} Gestionar catálogo</button>
                  <button className="mmp-lightBtn danger" type="button" onClick={handleClearForm}>Anular todo</button>
                </div>
              </div>



              <div className="mmp-stageGrid">
                {currentStages.map((stage) => {
                  const count = getStageCount(stage.id);
                  const enabled = stage.id === 'plato' || stage.id === 'montaje_tipo'
                    ? true
                    : primaryMode === 'menu' ? Boolean(activeLineKey) : Boolean(selectedMontajeTipo);
                  return (
                    <button
                      key={stage.id}
                      type="button"
                      disabled={!enabled}
                      className={`mmp-stageCard ${count ? 'has-data' : ''}`}
                      style={{ '--stage-color': stage.color, '--stage-bg': stage.bg }}
                      onClick={() => setActiveStageId(stage.id)}
                    >
                      <span className="mmp-stageIcon">{stage.icon}</span>
                      <strong>{stage.label}</strong>
                      {count > 0 && <em>{count}</em>}
                    </button>
                  );
                })}
              </div>

              {primaryMode === 'menu' && activeLine && (
                <div className="mmp-editHint-box">
                  <span>Editando <b>{findName(catalogs.proteins, activeLine.platoId, 'plato seleccionado')}</b>. Seleccione una categoría para completar la comanda.</span>
                </div>
              )}

              <div className="mmp-scrollableArea">
                {primaryMode === 'menu' && (
                  <>
                    <section className="mmp-configured">
                      <header style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h3>Platos configurados</h3>
                        <button
                          type="button"
                          className="mmp-add-plate-btn"
                          onClick={() => {
                            setActiveLineKey('');
                            setSelectedProtein('');
                            setSelectedPrep('');
                            setSelectedSalsas([]);
                            setSelectedGuarniciones([]);
                            setSelectedPostres([]);
                            setSelectedBebidas([]);
                            setSelectedComentarios([]);
                          }}
                        >
                          + Nuevo Plato
                        </button>
                        <span style={{ marginLeft: 'auto' }}>{lineItemsDraft.length} plato(s)</span>
                      </header>

                      <div className="mmp-lineList">
                        {lineItemsDraft.map((line, index) => (
                          <LineCard
                            key={line.key}
                            line={line}
                            index={index}
                            catalogs={catalogs}
                            active={line.key === activeLineKey}
                            onEdit={() => handleEditLine(line)}
                            onRemove={async () => {
                              const confirm = await Swal.fire({
                                title: '¿Quitar plato?',
                                text: 'Se eliminará el plato y todos sus complementos.',
                                icon: 'warning',
                                showCancelButton: true,
                                confirmButtonText: 'Sí, quitar',
                                cancelButtonText: 'Cancelar',
                                confirmButtonColor: '#dc2626',
                                cancelButtonColor: '#94a3b8',
                              });
                              if (confirm.isConfirmed) {
                                updateLines((current) => current.filter((item) => item.key !== line.key));
                                if (line.key === activeLineKey) setActiveLineKey('');
                              }
                            }}
                            onRemoveComponent={(qtyField, componentId) => removeLineComponent(line.key, qtyField, componentId)}
                            onQtyChange={(delta) => updateLines((current) => current.map((item) => (
                              item.key === line.key ? { ...item, qty: Math.max(1, Number(item.qty || 1) + delta) } : item
                            )))}
                            onQtySet={(val) => updateLines((current) => current.map((item) => (
                              item.key === line.key ? { ...item, qty: val } : item
                            )))}
                            onTimeChange={(value) => updateLines((current) => current.map((item) => (
                              item.key === line.key ? { ...item, servicioHora: value } : item
                            )))}
                            onComponentQtyChange={(qtyField, componentId, delta) => changeLineComponentQty(line.key, qtyField, componentId, delta)}
                            onComponentQtySet={(qtyField, componentId, val) => {
                              updateLines((current) => current.map((item) => {
                                if (item.key !== line.key) return item;
                                const currentQtys = item[qtyField] || {};
                                const key = String(componentId);
                                return {
                                  ...item,
                                  [qtyField]: {
                                    ...currentQtys,
                                    [key]: val,
                                  },
                                };
                              }));
                            }}
                          />
                        ))}
                        {!lineItemsDraft.length && <div className="mmp-emptyCard">Sin platos configurados todavía.</div>}
                      </div>
                    </section>

                    <label className="mmp-generalNote">
                      <span>Comentario:</span>
                      <AutoResizeTextarea
                        value={menuNotes}
                        onChange={(event) => setMenuNotes(event.target.value)}
                        placeholder="Comentario para servicio, cocina o meseros..."
                      />
                    </label>
                  </>
                )}

                {primaryMode === 'montaje' && (
                  <section className="mmp-montajeBox">
                    <h3>Montaje configurado</h3>
                    <pre>{montajeDescription || '[MONTAJE]\n- TIPO (Por definir) | ADICIONALES (Ninguno)'}</pre>
                  </section>
                )}

                {hasEntries && (
                  <section className="mmp-saved">
                    <header>
                      <h3>Registros de comanda generados</h3>
                      <p>{quote.menuMontajeEntries.length} registro(s) para esta cotización.</p>
                    </header>
                    <div className="mmp-tableWrap">
                      <table>
                        <thead><tr><th>Fecha</th><th>Salón</th><th>Título Menú</th><th>Cantidad</th><th>Última actualización</th></tr></thead>
                        <tbody>
                          {quote.menuMontajeEntries.map((entry) => (
                            <tr key={entry.id}>
                              <td>{entry.date}</td>
                              <td>{entry.salon}</td>
                              <td>{entry.menuTitle}</td>
                              <td>{entry.menuQty || 'N/A'}</td>
                              <td>{entry.updatedAt?.split('T')[0] || 'N/A'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}
              </div>
            </>
          ) : (
            <div className="mmp-scrollableArea">
              <section className="mmp-manual">
                <div className="mmp-formGrid">
                  <label>Título comercial del menú<input value={menuTitle} onChange={(event) => setMenuTitle(event.target.value)} placeholder="Ej: Almuerzo Gala Empresarial" /></label>
                  <label>Cantidad (Menú PAX)<input type="number" value={menuQty} onChange={(event) => setMenuQty(event.target.value)} placeholder="Ej: 150" /></label>
                </div>
                <label className="mmp-generalNote in-manual">
                  <span>Comentario:</span>
                  <AutoResizeTextarea value={menuNotes} onChange={(event) => setMenuNotes(event.target.value)} placeholder="Comentario para servicio, cocina o meseros..." />
                </label>
                <div className="mmp-formGrid two">
                  <label>
                    <span className="mmp-labelRow">Descripción del menú <button type="button" onClick={() => insertTextSnippet('menu')}>Agregar separador</button></span>
                    <textarea value={menuDescription} onChange={(event) => setMenuDescription(event.target.value)} rows={14} />
                  </label>
                  <label>
                    <span className="mmp-labelRow">Descripción del montaje <button type="button" onClick={() => insertTextSnippet('montaje')}>Agregar separador</button></span>
                    <textarea value={montajeDescription} onChange={(event) => setMontajeDescription(event.target.value)} rows={14} />
                  </label>
                </div>
              </section>

              {hasEntries && (
                <section className="mmp-saved">
                  <header>
                    <h3>Registros de comanda generados</h3>
                    <p>{quote.menuMontajeEntries.length} registro(s) para esta cotización.</p>
                  </header>
                  <div className="mmp-tableWrap">
                    <table>
                      <thead><tr><th>Fecha</th><th>Salón</th><th>Título Menú</th><th>Cantidad</th><th>Última actualización</th></tr></thead>
                      <tbody>
                        {quote.menuMontajeEntries.map((entry) => (
                          <tr key={entry.id}>
                            <td>{entry.date}</td>
                            <td>{entry.salon}</td>
                            <td>{entry.menuTitle}</td>
                            <td>{entry.menuQty || 'N/A'}</td>
                            <td>{entry.updatedAt?.split('T')[0] || 'N/A'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </div>
          )}
        </section>

        <aside className="mmp-ticket">
          <header>
            <h3>Resumen de comanda</h3>
            <p>{selectedCombo.date || '-'} · {selectedCombo.salon || '-'}</p>
          </header>

          <div className="mmp-ticketScroll">
            <label className="mmp-ticketField">
              Título del menú
              <input value={menuTitle} onChange={(event) => setMenuTitle(event.target.value)} placeholder="Ej: Menú Gala" />
            </label>
            <label className="mmp-ticketField">
              PAX
              <input type="number" value={menuQty} onChange={(event) => setMenuQty(event.target.value)} placeholder="Cantidad" />
            </label>
            <label className="mmp-ticketField">
              Comentario:
              <AutoResizeTextarea value={menuNotes} onChange={(event) => setMenuNotes(event.target.value)} placeholder="Comentario para servicio, cocina o meseros" />
            </label>

            <section>
              <div className="mmp-ticketSectionHead">
                <h4>Menú compilado</h4>
                <button type="button" onClick={() => setEditingCompiledMenu((current) => !current)}>
                  {editingCompiledMenu ? 'Listo' : 'Editar'}
                </button>
              </div>
              {editingCompiledMenu ? (
                <textarea
                  className="mmp-compiledEditor"
                  value={menuDescription}
                  onChange={(event) => setMenuDescription(event.target.value)}
                  rows={8}
                  placeholder="[PLATOS FUERTES]\n- Por definir"
                />
              ) : (
                <pre>{menuDescription || '[PLATOS FUERTES]\n- Por definir'}</pre>
              )}
            </section>
            <section>
              <div className="mmp-ticketSectionHead">
                <h4>Montaje compilado</h4>
                <button type="button" onClick={() => setEditingCompiledMontaje((current) => !current)}>
                  {editingCompiledMontaje ? 'Listo' : 'Editar'}
                </button>
              </div>
              {editingCompiledMontaje ? (
                <textarea
                  className="mmp-compiledEditor"
                  value={montajeDescription}
                  onChange={(event) => setMontajeDescription(event.target.value)}
                  rows={6}
                  placeholder="[MONTAJE]\n- TIPO (Por definir) | ADICIONALES (Ninguno)"
                />
              ) : (
                <pre>{montajeDescription || '[MONTAJE]\n- TIPO (Por definir) | ADICIONALES (Ninguno)'}</pre>
              )}
            </section>
          </div>

          <footer>
            <button className="mmp-lightBtn" type="button" onClick={handlePreviewPrint}>{Icon.print} Imprimir</button>
            <button className="mmp-lightBtn" type="button" onClick={() => handleSave(true)}>Actualizar</button>
            <button className="mmp-saveBtn" type="button" onClick={() => handleSave(false)}>{Icon.save} Guardar</button>
          </footer>
        </aside>
      </main>

      {activeStage && (
        <StagePicker
          stage={activeStage}
          items={getStageItems(activeStage.id)}
          selected={getSelectedForStage(activeStage.id)}
          isMulti={!['plato', 'preparacion', 'montaje_tipo'].includes(activeStage.id)}
          onToggle={(item) => handleToggleItem(activeStage.id, item)}
          onClose={() => setActiveStageId('')}
          quantities={
            activeStage.id === 'adicional_menu'
              ? (activeLine?.adicionales || []).reduce((acc, a) => { acc[String(a.id)] = a.qty; return acc; }, {})
              : activeLine ? (activeLine[
                  {
                    salsa: 'salsaQtys',
                    guarnicion: 'guarnicionQtys',
                    postre: 'postreQtys',
                    bebida: 'bebidaQtys',
                    comentario: 'comentarioQtys',
                  }[activeStage.id]
                ] || {}) : {}
          }
          onQtyChange={(item, delta) => {
            const qtyField = {
              salsa: 'salsaQtys',
              guarnicion: 'guarnicionQtys',
              postre: 'postreQtys',
              bebida: 'bebidaQtys',
              comentario: 'comentarioQtys',
            }[activeStage.id];
            if (activeLineKey && qtyField) {
              changeLineComponentQty(activeLineKey, qtyField, item.id, delta);
            } else if (activeLineKey && activeStage.id === 'adicional_menu') {
              updateLines((current) => current.map((line) => {
                if (line.key !== activeLineKey) return line;
                const nextAdicionales = (line.adicionales || []).map((a) => {
                  if (String(a.id) === String(item.id)) {
                    return { ...a, qty: a.qty === '' ? delta : Math.max(1, Number(a.qty) + delta) };
                  }
                  return a;
                });
                return { ...line, adicionales: nextAdicionales };
              }));
            }
          }}
          onQtySet={(item, val) => {
            const qtyField = {
              salsa: 'salsaQtys',
              guarnicion: 'guarnicionQtys',
              postre: 'postreQtys',
              bebida: 'bebidaQtys',
              comentario: 'comentarioQtys',
            }[activeStage.id];
            if (activeLineKey && qtyField) {
              updateLines((current) => current.map((line) => {
                if (line.key !== activeLineKey) return line;
                const currentQtys = line[qtyField] || {};
                const key = String(item.id);
                return {
                  ...line,
                  [qtyField]: {
                    ...currentQtys,
                    [key]: val,
                  },
                };
              }));
            } else if (activeLineKey && activeStage.id === 'adicional_menu') {
              updateLines((current) => current.map((line) => {
                if (line.key !== activeLineKey) return line;
                const nextAdicionales = (line.adicionales || []).map((a) => {
                  if (String(a.id) === String(item.id)) {
                    return { ...a, qty: val };
                  }
                  return a;
                });
                return { ...line, adicionales: nextAdicionales };
              }));
            }
          }}
        />
      )}

      {showCatalogModal && (
        <div className="mmp-modalShade">
          <section className="mmp-catalogModal">
            <header>
              <div>
                <h3>Gestionar catálogo Menú & Montaje</h3>
                <p>Catálogo base y combinaciones para crear menús completos.</p>
              </div>
              <button className="mmp-iconBtn" type="button" onClick={() => setShowCatalogModal(false)}>&#10005;</button>
            </header>

            <div className="mmp-catalogBody">
              <div className="mmp-catalogTabs">
                <button type="button" className={catalogMode === 'base' ? 'is-active' : ''} onClick={() => setCatalogMode('base')}>Catálogo base</button>
                <button type="button" className={catalogMode === 'rules' ? 'is-active' : ''} onClick={() => setCatalogMode('rules')}>Combinaciones</button>
              </div>

              {catalogMode === 'base' ? (
                <>
                  <form className="mmp-catalogForm" onSubmit={(event) => { event.preventDefault(); handleSaveCatalogItem(); }}>
                    <label>Catálogo<select value={catalogKind} onChange={(event) => setCatalogKind(event.target.value)}>{CATALOG_KIND_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
                    {catalogKind === 'preparacion' && (
                      <label>Proteína base<select value={catalogProteinDraft} onChange={(event) => setCatalogProteinDraft(event.target.value)}><option value="">Seleccione</option>{catalogs.proteins.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label>
                    )}
                    <label>Nombre<input value={catalogNameDraft} onChange={(event) => setCatalogNameDraft(event.target.value)} placeholder="Escribe el nombre" /></label>
                    {catalogKind === 'plato_fuerte' && (
                      <label>Tipo de plato<select value={catalogDishTypeDraft} onChange={(event) => setCatalogDishTypeDraft(event.target.value)}><option value="NORMAL">Normal</option><option value="VEGETARIANO">Vegetariano</option><option value="SIN PROTEINA">Sin proteína</option></select></label>
                    )}
                    <div className="mmp-catalogActions">
                      <button className="mmp-lightBtn" type="button" onClick={() => { setCatalogEditingItem(null); setCatalogNameDraft(''); setCatalogProteinDraft(''); setCatalogDishTypeDraft('NORMAL'); }}>Limpiar formulario</button>
                      <button className="mmp-saveBtn" type="submit">{catalogEditingItem ? 'Actualizar registro' : 'Guardar registro'}</button>
                    </div>
                  </form>

                  <div className="mmp-catalogTable">
                    {catalogLoading ? <div className="mmp-empty">Cargando...</div> : (
                      <table>
                        <thead><tr><th>Nombre</th><th>Detalle</th><th>Estado</th><th>Acciones</th></tr></thead>
                        <tbody>
                          {catalogItems.length ? catalogItems.map((item) => {
                            const detail = catalogKind === 'preparacion'
                              ? findName(catalogs.proteins, item.id_plato_fuerte, '-')
                              : catalogKind === 'plato_fuerte' ? (item.tipo_plato || 'NORMAL') : '-';
                            return (
                              <tr key={item.id}>
                                <td>{item.nombre}</td>
                                <td>{detail}</td>
                                <td><span className={item.activo === false ? 'is-off' : 'is-on'}>{item.activo === false ? 'Inactivo' : 'Activo'}</span></td>
                                <td>
                                  <button className="mmp-btn-edit" type="button" onClick={() => { setCatalogEditingItem(item); setCatalogNameDraft(item.nombre || ''); setCatalogProteinDraft(item.id_plato_fuerte ? String(item.id_plato_fuerte) : ''); setCatalogDishTypeDraft(item.tipo_plato || 'NORMAL'); }}>Editar</button>
                                  <button className={item.activo === false ? "mmp-btn-activate" : "mmp-btn-deactivate"} type="button" onClick={() => handleToggleCatalogItem(item)}>{item.activo === false ? 'Activar' : 'Inhabilitar'}</button>
                                </td>
                              </tr>
                            );
                          }) : <tr><td colSpan="4">Sin registros</td></tr>}
                        </tbody>
                      </table>
                    )}
                  </div>
                </>
              ) : (
                <section className="mmp-ruleBuilder">
                  <div className="mmp-ruleContext">
                    <label>Plato base<select value={ruleProtein} onChange={(event) => setRuleProtein(event.target.value)}><option value="">Seleccione plato</option>{catalogs.proteins.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label>
                    <label>Preparación<select value={rulePreparation} onChange={(event) => setRulePreparation(event.target.value)} disabled={!ruleProtein}><option value="">Seleccione preparación</option>{rulePreparations.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label>
                    <button className="mmp-saveBtn" type="button" onClick={handleSaveRules} disabled={ruleSaving || !ruleProtein || !rulePreparation}>{ruleSaving ? 'Guardando...' : 'Guardar combinación'}</button>
                  </div>

                  {ruleLoading ? <div className="mmp-empty">Cargando combinaciones...</div> : (
                    <div className="mmp-ruleGrid">
                      {RULE_GROUPS.map((group) => (
                        <div className="mmp-ruleGroup" key={group.key}>
                          <h4>{group.title}</h4>
                          <div>
                            {(catalogs[group.catalog] || []).map((item) => {
                              const checked = normalizeIdList(ruleLinks[group.key]).includes(Number(item.id));
                              return (
                                <label key={item.id} className={checked ? 'is-checked' : ''}>
                                  <input type="checkbox" checked={checked} onChange={() => handleToggleRule(group.key, item.id)} />
                                  <span>{item.nombre}</span>
                                </label>
                              );
                            })}
                            {!(catalogs[group.catalog] || []).length && <p>Sin registros.</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}
            </div>
          </section>
        </div>
      )}

      {printPreviewHtml && (
        <div className="mmp-modalShade">
          <section className="mmp-printModal">
            <header>
              <h3>Vista previa de impresión</h3>
              <div>
                <button
                  className="mmp-saveBtn"
                  type="button"
                  onClick={() => {
                    const printWindow = window.open('', '_blank');
                    if (!printWindow) {
                      Swal.fire('Error', 'Habilite ventanas emergentes para imprimir.', 'error');
                      return;
                    }
                    printWindow.document.open();
                    printWindow.document.write(printPreviewHtml.replace('</body></html>', '<script>window.onload=function(){window.print();}</script></body></html>'));
                    printWindow.document.close();
                  }}
                >
                  {Icon.print} Imprimir
                </button>
                <button className="mmp-lightBtn" type="button" onClick={() => setPrintPreviewHtml('')}>Cerrar</button>
              </div>
            </header>
            <iframe title="Vista previa Menú & Montaje" srcDoc={printPreviewHtml} />
          </section>
        </div>
      )}
    </div>
  );
}


