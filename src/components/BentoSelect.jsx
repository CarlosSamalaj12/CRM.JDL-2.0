import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Bed, User, Layers, Search, ChevronDown, Check, ShieldCheck, Tag } from 'lucide-react';
import './bentoSelect.css';

// Paleta ejecutiva minimalista suave para avatares (Stitch MCP)
const AVATAR_PALETTE = [
  { bg: '#ecfdf5', text: '#065f46', border: '#a7f3d0' }, // Emerald
  { bg: '#eff6ff', text: '#1e40af', border: '#bfdbfe' }, // Blue
  { bg: '#f0fdfa', text: '#115e59', border: '#99f6e4' }, // Teal
  { bg: '#f5f3ff', text: '#5b21b6', border: '#ddd6fe' }, // Purple
  { bg: '#f8fafc', text: '#334155', border: '#cbd5e1' }, // Slate
  { bg: '#e0f2fe', text: '#0369a1', border: '#bae6fd' }, // Sky
  { bg: '#fef3c7', text: '#92400e', border: '#fde68a' }, // Amber
  { bg: '#fff1f2', text: '#9f1239', border: '#fecdd3' }, // Rose
];

function getAvatarTheme(name = '') {
  if (!name) return AVATAR_PALETTE[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[index];
}

function getInitials(name = '') {
  if (!name) return '—';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '—';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * BentoSelect: Selector Minimalista Moderno Proyectado vía Portal (Stitch MCP)
 * 
 * - Fondo 100% blanco puro (#ffffff) sin elementos oscuros ni sangrados visuales
 * - Soporte Single-Select y Multi-Select interactivo
 * - Ancho generoso (380px - 440px) para legibilidad total de nombres de vendedores y habitaciones
 * - Trigger con estilo bento card, avatar/icono temático y chevron suave
 * - Popover flotante proyectado con createPortal en document.body con zIndex máximo
 * - Elementos de lista basados en div role="option" para evitar interferencias de estilos globales en botones
 * - Inmune a solapamiento o compresión vertical de filas
 */
export default function BentoSelect({
  value = '',
  onChange,
  options = [],
  placeholder = 'Todos',
  allLabel,
  allSublabel = 'Mostrar todos los registros',
  searchPlaceholder = 'Buscar...',
  headerTitle = 'OPCIONES DISPONIBLES',
  kind = 'default', // 'room' | 'user' | 'status' | 'default'
  isMulti = false,
  disabled = false,
  popoverWidth = 380,
  footerText = 'Filtro interactivo del sistema · Resultados actualizados'
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [popoverPos, setPopoverPos] = useState(null);

  const triggerRef = useRef(null);
  const popoverRef = useRef(null);
  const searchInputRef = useRef(null);

  const effectiveAllLabel = allLabel || placeholder;

  // Normalizar opciones
  const normalizedOptions = useMemo(() => {
    return (options || []).map(opt => {
      if (typeof opt === 'string') {
        return { value: opt, label: opt };
      }
      return {
        value: String(opt.value !== undefined ? opt.value : (opt.id !== undefined ? opt.id : '')),
        label: String(opt.label || opt.nombre || opt.name || opt.value || ''),
        sublabel: opt.sublabel || opt.email || '',
        badge: opt.badge,
        role: opt.role || opt.rol,
        color: opt.color,
        icon: opt.icon,
        active: opt.active !== false
      };
    });
  }, [options]);

  // Manejo de valores en Multi-Select (Set)
  const selectedSet = useMemo(() => {
    if (!isMulti) return new Set();
    if (!value) return new Set();
    if (value instanceof Set) return value;
    if (Array.isArray(value)) return new Set(value.map(String));
    if (typeof value === 'string') {
      const parts = value.split(',').map(s => s.trim()).filter(Boolean);
      return new Set(parts);
    }
    return new Set();
  }, [isMulti, value]);

  // Opción seleccionada en Single-Select
  const selectedOption = useMemo(() => {
    if (isMulti) return null;
    if (value === '' || value === null || value === undefined) return null;
    return normalizedOptions.find(o => String(o.value) === String(value)) || null;
  }, [isMulti, normalizedOptions, value]);

  // Lista de opciones seleccionadas en Multi-Select
  const selectedMultiOptions = useMemo(() => {
    if (!isMulti || selectedSet.size === 0) return [];
    return normalizedOptions.filter(o => selectedSet.has(String(o.value)));
  }, [isMulti, normalizedOptions, selectedSet]);

  // Filtrado de opciones por búsqueda
  const filteredOptions = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return normalizedOptions;
    return normalizedOptions.filter(o => {
      const matchLabel = o.label.toLowerCase().includes(q);
      const matchSub = (o.sublabel || '').toLowerCase().includes(q);
      const matchBadge = (o.badge || '').toLowerCase().includes(q);
      return matchLabel || matchSub || matchBadge;
    });
  }, [normalizedOptions, searchQuery]);

  // Posicionamiento preciso del popover flotante
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 1024;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 768;

    const width = Math.min(Math.max(rect.width, popoverWidth), viewportWidth - 24);
    const estimatedHeight = 440;

    const spaceBelow = viewportHeight - rect.bottom;
    const shouldOpenAbove = spaceBelow < estimatedHeight && rect.top > spaceBelow;

    let left = rect.left;
    if (left + width > viewportWidth - 12) {
      left = Math.max(12, viewportWidth - width - 12);
    }
    if (left < 12) left = 12;

    const top = shouldOpenAbove
      ? Math.max(12, rect.top - estimatedHeight - 6)
      : Math.min(rect.bottom + 6, viewportHeight - estimatedHeight - 12);

    setPopoverPos({
      top,
      left,
      width,
      maxHeight: estimatedHeight
    });
  }, [popoverWidth]);

  const toggleMenu = () => {
    if (disabled) return;
    if (isOpen) {
      setIsOpen(false);
    } else {
      updatePosition();
      setSearchQuery('');
      setIsOpen(true);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (
        (triggerRef.current && triggerRef.current.contains(e.target)) ||
        (popoverRef.current && popoverRef.current.contains(e.target))
      ) {
        return;
      }
      setIsOpen(false);
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    const handleScrollOrResize = () => {
      updatePosition();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);

    const timer = setTimeout(() => {
      if (searchInputRef.current) searchInputRef.current.focus();
    }, 40);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      clearTimeout(timer);
    };
  }, [isOpen, updatePosition]);

  // Selección individual
  const handleSingleSelect = (val) => {
    if (onChange) onChange(val);
    setIsOpen(false);
  };

  // Toggle en selección múltiple
  const handleMultiToggle = (val) => {
    const nextSet = new Set(selectedSet);
    const strVal = String(val);
    if (nextSet.has(strVal)) {
      nextSet.delete(strVal);
    } else {
      nextSet.add(strVal);
    }
    const result = Array.from(nextSet).join(',');
    if (onChange) onChange(result);
  };

  // Limpiar selección múltiple
  const handleMultiClearAll = () => {
    if (onChange) onChange('');
  };

  // Seleccionar todas las opciones mostradas
  const handleMultiSelectAll = () => {
    const allVals = normalizedOptions.map(o => String(o.value)).join(',');
    if (onChange) onChange(allVals);
  };

  // Render del icono del trigger
  const renderTriggerIcon = () => {
    if (kind === 'room') {
      return (
        <div className="bento-sel-icon-box room">
          <Bed size={13} strokeWidth={2.4} />
        </div>
      );
    }
    if (kind === 'user') {
      const singleUser = isMulti ? (selectedMultiOptions[0] || null) : selectedOption;
      if (!singleUser || (isMulti && selectedSet.size > 1)) {
        return (
          <div className="bento-sel-icon-box default">
            <User size={13} strokeWidth={2.4} />
          </div>
        );
      }
      const theme = getAvatarTheme(singleUser.label);
      return (
        <div
          className="bento-sel-icon-box user"
          style={{
            backgroundColor: theme.bg,
            color: theme.text,
            border: `1.5px solid ${theme.border}`
          }}
        >
          {getInitials(singleUser.label)}
        </div>
      );
    }
    if (kind === 'status' && selectedOption?.color) {
      return (
        <div className="bento-sel-icon-box status">
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: selectedOption.color }} />
        </div>
      );
    }
    return (
      <div className="bento-sel-icon-box default">
        <Layers size={13} strokeWidth={2.2} />
      </div>
    );
  };

  // Texto o contenido a mostrar en el trigger
  const renderTriggerLabel = () => {
    if (isMulti) {
      if (selectedSet.size === 0) {
        return <span className="bento-sel-label">{effectiveAllLabel}</span>;
      }
      if (selectedSet.size === 1) {
        const first = selectedMultiOptions[0];
        return (
          <span className="bento-sel-label" title={first ? first.label : ''}>
            {first ? first.label : effectiveAllLabel}
          </span>
        );
      }
      return (
        <div className="bento-sel-trigger-multi-wrap">
          <span className="bento-sel-multi-pill">
            {selectedSet.size} seleccionados
          </span>
          <span className="bento-sel-label is-subdued" title={selectedMultiOptions.map(o => o.label).join(', ')}>
            {selectedMultiOptions.slice(0, 2).map(o => o.label.split(' ')[0]).join(', ')}{selectedMultiOptions.length > 2 ? '...' : ''}
          </span>
        </div>
      );
    }

    return (
      <span className="bento-sel-label" title={selectedOption ? selectedOption.label : effectiveAllLabel}>
        {selectedOption ? selectedOption.label : effectiveAllLabel}
      </span>
    );
  };

  return (
    <div className="bento-sel-container" ref={triggerRef}>
      <button
        type="button"
        className={`bento-sel-trigger ${isOpen ? 'is-open' : ''} ${disabled ? 'is-disabled' : ''}`}
        onClick={toggleMenu}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="bento-sel-trigger-left">
          {renderTriggerIcon()}
          <div className="bento-sel-text-wrap">
            {renderTriggerLabel()}
          </div>
        </div>

        <div className="bento-sel-trigger-right">
          {!isMulti && selectedOption && kind === 'user' && selectedOption.role && (
            <span className={`bento-sel-tag-badge ${String(selectedOption.role).toLowerCase() === 'admin' ? 'blue' : 'emerald'}`}>
              {String(selectedOption.role).toLowerCase() === 'admin' ? 'ADMIN' : 'VENDEDOR'}
            </span>
          )}
          {!isMulti && selectedOption && kind === 'room' && selectedOption.badge && (
            <span className="bento-sel-tag-badge cyan">
              {selectedOption.badge}
            </span>
          )}
          <ChevronDown
            size={14}
            className={`bento-sel-chevron ${isOpen ? 'rotate' : ''}`}
            strokeWidth={2.4}
          />
        </div>
      </button>

      {/* Popover flotante proyectado en body */}
      {isOpen && popoverPos && createPortal(
        <div
          ref={popoverRef}
          className="bento-sel-popover"
          style={{
            position: 'fixed',
            top: `${popoverPos.top}px`,
            left: `${popoverPos.left}px`,
            width: `${popoverPos.width}px`,
            maxHeight: `${popoverPos.maxHeight}px`,
            zIndex: 99999999,
            background: '#ffffff',
            backgroundColor: '#ffffff'
          }}
        >
          <div className="bento-sel-popover-inner">
            {/* Header con Buscador 100% BLANCO */}
            <div className="bento-sel-header">
              <div className="bento-sel-search-wrap">
                <Search size={14} className="bento-sel-search-icon" strokeWidth={2.2} />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder={searchPlaceholder}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bento-sel-search-input search-input-naked"
                  style={{
                    backgroundColor: '#ffffff',
                    background: '#ffffff',
                    color: '#0f172a'
                  }}
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="bento-sel-clear-btn"
                    title="Limpiar búsqueda"
                  >
                    ✕
                  </button>
                ) : (
                  <span className="bento-sel-shortcut-pill">⌘K</span>
                )}
              </div>

              {/* Subbarra informativa con enlaces ligeros (Stitch MCP) */}
              <div className="bento-sel-subbar">
                <div className="bento-sel-subbar-left">
                  <span className="bento-sel-dot" />
                  <span className="bento-sel-title">{headerTitle}</span>
                  <span className="bento-sel-count">{normalizedOptions.length} total</span>
                  {isMulti && selectedSet.size > 0 && (
                    <span className="bento-sel-selected-pill-small">
                      {selectedSet.size} selec.
                    </span>
                  )}
                </div>
                {isMulti ? (
                  <div className="bento-sel-subbar-actions">
                    <span
                      role="button"
                      tabIndex={0}
                      className="bento-sel-action-link"
                      onClick={handleMultiSelectAll}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleMultiSelectAll(); }}
                    >
                      Todos
                    </span>
                    <span className="bento-sel-action-sep">|</span>
                    <span
                      role="button"
                      tabIndex={0}
                      className="bento-sel-action-link is-muted"
                      onClick={handleMultiClearAll}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleMultiClearAll(); }}
                    >
                      Limpiar
                    </span>
                  </div>
                ) : (
                  <span className="bento-sel-tag">Filtrado</span>
                )}
              </div>
            </div>

            {/* Opciones Scroll */}
            <div className="bento-sel-scroll">
              {/* Opción "Todos" / Deseleccionar */}
              <div
                role="option"
                tabIndex={0}
                aria-selected={isMulti ? selectedSet.size === 0 : !value}
                onClick={() => (isMulti ? handleMultiClearAll() : handleSingleSelect(''))}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') (isMulti ? handleMultiClearAll() : handleSingleSelect('')); }}
                className={`bento-sel-item all-option ${(isMulti ? selectedSet.size === 0 : !value) ? 'is-selected' : ''}`}
              >
                <div className="bento-sel-item-left">
                  <div className="bento-sel-item-icon-box all">
                    <Layers size={14} strokeWidth={2.2} />
                  </div>
                  <div className="bento-sel-item-text">
                    <span className="bento-sel-item-name">{effectiveAllLabel}</span>
                    <span className="bento-sel-item-desc">{allSublabel}</span>
                  </div>
                </div>
                {(isMulti ? selectedSet.size === 0 : !value) && (
                  <div className="bento-sel-check-mark">
                    <Check size={16} strokeWidth={2.8} />
                  </div>
                )}
              </div>

              <div className="bento-sel-divider">
                <span>Catálogo de Opciones</span>
              </div>

              {/* Lista filtrada */}
              {filteredOptions.length > 0 ? (
                filteredOptions.map((opt, optIdx) => {
                  const isSel = isMulti
                    ? selectedSet.has(String(opt.value))
                    : String(opt.value) === String(value);

                  const theme = kind === 'user' ? getAvatarTheme(opt.label) : null;
                  const isAdmin = String(opt.role || '').toLowerCase() === 'admin';

                  return (
                    <div
                      key={`${opt.value || 'item'}-${optIdx}`}
                      role="option"
                      tabIndex={0}
                      aria-selected={isSel}
                      onClick={() => (isMulti ? handleMultiToggle(opt.value) : handleSingleSelect(opt.value))}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') (isMulti ? handleMultiToggle(opt.value) : handleSingleSelect(opt.value)); }}
                      className={`bento-sel-item ${isSel ? 'is-selected' : ''}`}
                    >
                      <div className="bento-sel-item-left">
                        {/* Checkbox en modo Multi-Select */}
                        {isMulti && (
                          <div className={`bento-sel-checkbox ${isSel ? 'checked' : ''}`}>
                            {isSel && <Check size={12} strokeWidth={3} />}
                          </div>
                        )}

                        {kind === 'user' ? (
                          <div className="bento-sel-avatar-wrapper">
                            <div
                              className="bento-sel-item-icon-box user"
                              style={{
                                backgroundColor: theme.bg,
                                color: theme.text,
                                border: `1px solid ${theme.border}`
                              }}
                            >
                              {getInitials(opt.label)}
                            </div>
                            {opt.active !== false && (
                              <span className="bento-sel-avatar-dot" title="Usuario activo" />
                            )}
                          </div>
                        ) : kind === 'room' ? (
                          <div className="bento-sel-item-icon-box room">
                            <Bed size={14} strokeWidth={2.4} />
                          </div>
                        ) : kind === 'status' && opt.color ? (
                          <div className="bento-sel-item-icon-box status">
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: opt.color }} />
                          </div>
                        ) : (
                          <div className="bento-sel-item-icon-box default">
                            <Tag size={14} strokeWidth={2.2} />
                          </div>
                        )}

                        {/* Nombre completo en su propia fila para evitar truncamiento */}
                        <div className="bento-sel-item-text">
                          <span className="bento-sel-item-name">
                            {opt.label}
                          </span>
                          <div className="bento-sel-item-meta-row">
                            {kind === 'user' && opt.role && (
                              <span className={`bento-sel-tag-badge ${isAdmin ? 'blue' : 'emerald'}`}>
                                {isAdmin ? 'ADMIN' : 'VENDEDOR'}
                              </span>
                            )}
                            {opt.badge && (
                              <span className="bento-sel-tag-badge cyan">
                                {opt.badge}
                              </span>
                            )}
                            {opt.sublabel && (
                              <span className="bento-sel-item-desc" title={opt.sublabel}>
                                {opt.sublabel}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="bento-sel-item-right">
                        {!isMulti && (
                          isSel ? (
                            <span className="bento-sel-selected-pill">
                              <span>Seleccionado</span>
                              <Check size={12} strokeWidth={3} />
                            </span>
                          ) : (
                            <span className="bento-sel-hover-select">
                              Seleccionar →
                            </span>
                          )
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="bento-sel-empty">
                  <span>No se encontraron opciones con "{searchQuery}"</span>
                </div>
              )}
            </div>

            {/* Barra de acción unificada en modo Multi-Select (Stitch MCP) */}
            {isMulti ? (
              <div className="bento-sel-bottom-bar">
                <div className="bento-sel-bottom-left">
                  <span className="bento-sel-selected-counter">
                    {selectedSet.size === 0 ? 'Sin selección activa' : `${selectedSet.size} ${selectedSet.size === 1 ? 'seleccionado' : 'seleccionados'}`}
                  </span>
                  {selectedSet.size > 0 && (
                    <>
                      <span className="bento-sel-dot-sep">•</span>
                      <span
                        role="button"
                        tabIndex={0}
                        className="bento-sel-link-clear"
                        onClick={handleMultiClearAll}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleMultiClearAll(); }}
                      >
                        Limpiar
                      </span>
                    </>
                  )}
                </div>
                <div className="bento-sel-bottom-right">
                  <span className="bento-sel-esc-hint">Esc para salir</span>
                  <button
                    type="button"
                    className="bento-sel-btn-apply"
                    onClick={() => setIsOpen(false)}
                  >
                    <span>Listo</span>
                    {selectedSet.size > 0 && (
                      <span className="bento-sel-badge-apply">{selectedSet.size}</span>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              footerText && (
                <div className="bento-sel-footer">
                  <ShieldCheck size={13} strokeWidth={2.4} color="#059669" />
                  <span>{footerText}</span>
                </div>
              )
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
