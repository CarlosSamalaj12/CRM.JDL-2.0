import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import './sellerSelector.css';

// Paleta minimalista moderna ejecutiva para avatares (tonos suaves y elegantes)
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

function getUserInitials(name) {
  if (!name) return 'SE';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * SellerSelector: Selector Minimalista Moderno de Vendedor (Stitch MCP)
 * 
 * - Fondo 100% blanco puro (#ffffff) sin elementos oscuros
 * - Borde ultra-fino de 1px (#e2e8f0)
 * - Sombras difusas y suaves (estilo Linear / Apple)
 * - Búsqueda rápida con input blanco puro inmune a estilos globales
 * - Filtrado estricto: solo vendedores activos
 * - Preservación de usuarios históricos
 */
export default function SellerSelector({
  value,
  onChange,
  users = [],
  isMobile = false,
  disabled = false
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [popoverPos, setPopoverPos] = useState(null);

  const triggerRef = useRef(null);
  const popoverRef = useRef(null);
  const searchInputRef = useRef(null);

  // 1. Filtrar estrictamente solo usuarios ACTIVOS con rol de VENDEDOR o ADMIN
  const activeSellers = useMemo(() => {
    return (users || [])
      .filter(u => {
        const role = String(u.role || u.rol || '').trim().toLowerCase();
        const isActive = u.active !== false;
        return (role === 'vendedor' || role === 'admin') && isActive;
      })
      .sort((a, b) => {
        const nameA = (a.fullName || a.name || a.nombre || '').trim();
        const nameB = (b.fullName || b.name || b.nombre || '').trim();
        return nameA.localeCompare(nameB, 'es', { sensitivity: 'base' });
      });
  }, [users]);

  // 2. Identificar al usuario actualmente asignado
  const assignedUser = useMemo(() => {
    if (!value) return null;
    return (users || []).find(u => String(u.id) === String(value)) || null;
  }, [users, value]);

  // 3. Detectar si el usuario actual es histórico (desactivado o no vendedor/admin)
  const isHistoricalUser = useMemo(() => {
    if (!assignedUser) return false;
    const role = String(assignedUser.role || assignedUser.rol || '').trim().toLowerCase();
    const isActive = assignedUser.active !== false;
    return (role !== 'vendedor' && role !== 'admin') || !isActive;
  }, [assignedUser]);

  // 4. Filtrar lista por término de búsqueda
  const filteredSellers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return activeSellers;
    return activeSellers.filter(u => {
      const name = (u.fullName || u.name || u.nombre || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      const phone = (u.phone || '').toLowerCase();
      return name.includes(q) || email.includes(q) || phone.includes(q);
    });
  }, [activeSellers, searchQuery]);

  // Posicionamiento preciso del popover flotante
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 1024;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 768;

    const width = isMobile ? Math.min(360, viewportWidth - 24) : Math.max(rect.width, 360);
    const estimatedHeight = 380;

    const spaceBelow = viewportHeight - rect.bottom;
    const shouldOpenAbove = spaceBelow < estimatedHeight && rect.top > spaceBelow;

    let left = rect.left;
    if (left + width > viewportWidth - 12) {
      left = Math.max(12, viewportWidth - width - 12);
    }
    if (left < 12) left = 12;

    const top = shouldOpenAbove
      ? Math.max(12, rect.top - estimatedHeight - 8)
      : Math.min(rect.bottom + 6, viewportHeight - estimatedHeight - 12);

    setPopoverPos({
      top,
      left,
      width,
      maxHeight: estimatedHeight,
      openAbove: shouldOpenAbove
    });
  }, [isMobile]);

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
        triggerRef.current && triggerRef.current.contains(e.target) ||
        popoverRef.current && popoverRef.current.contains(e.target)
      ) {
        return;
      }
      setIsOpen(false);
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    const handleScrollOrResize = () => {
      updatePosition();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);

    const timer = setTimeout(() => {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }, 40);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      clearTimeout(timer);
    };
  }, [isOpen, updatePosition]);

  const handleSelect = (userObj) => {
    const selectedId = userObj ? String(userObj.id) : '';
    if (onChange) {
      onChange({
        target: {
          name: 'userId',
          value: selectedId
        }
      });
    }
    setIsOpen(false);
  };

  const assignedName = assignedUser
    ? (assignedUser.fullName || assignedUser.name || assignedUser.nombre)
    : '';

  const avatarTheme = getAvatarTheme(assignedName);

  // ── Render Móvil: Chip moderno estilizado ──
  if (isMobile) {
    return (
      <div className="seller-sel-mobile-wrap" ref={triggerRef}>
        <button
          type="button"
          onClick={toggleMenu}
          disabled={disabled}
          className={`seller-sel-mobile-chip ${isOpen ? 'active' : ''} ${isHistoricalUser ? 'warning' : ''}`}
        >
          <div
            className="seller-sel-mobile-avatar"
            style={{
              backgroundColor: assignedUser ? avatarTheme.bg : '#f1f5f9',
              color: assignedUser ? avatarTheme.text : '#64748b',
              border: `1px solid ${assignedUser ? avatarTheme.border : '#cbd5e1'}`
            }}
          >
            {assignedUser ? getUserInitials(assignedName) : '--'}
          </div>
          <span className="seller-sel-mobile-name">
            {assignedName || 'Sin Encargado'}
          </span>
          <svg className={`seller-sel-chevron ${isOpen ? 'rotate' : ''}`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {isOpen && popoverPos && createPortal(
          <div
            ref={popoverRef}
            className="seller-sel-popover"
            style={{
              position: 'fixed',
              top: `${popoverPos.top}px`,
              left: `${popoverPos.left}px`,
              width: `${popoverPos.width}px`,
              zIndex: 99999999
            }}
          >
            {renderPopoverContent()}
          </div>,
          document.body
        )}
      </div>
    );
  }

  // ── Render Desktop: Bento Card Trigger Minimalista ──
  return (
    <div className="seller-sel-container" ref={triggerRef}>
      <div
        className={`seller-sel-trigger ${isOpen ? 'is-open' : ''} ${disabled ? 'is-disabled' : ''}`}
        onClick={toggleMenu}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="seller-sel-trigger-left">
          {/* Avatar circular moderno con iniciales e indicador sutil */}
          <div className="seller-sel-avatar-box">
            <div
              className="seller-sel-avatar"
              style={{
                backgroundColor: assignedUser ? avatarTheme.bg : '#f8fafc',
                color: assignedUser ? avatarTheme.text : '#64748b',
                border: `1.5px solid ${assignedUser ? avatarTheme.border : '#e2e8f0'}`
              }}
            >
              {assignedUser ? getUserInitials(assignedName) : '--'}
            </div>
            {assignedUser && !isHistoricalUser && (
              <span className="seller-sel-dot-online" title="Vendedor activo en el sistema" />
            )}
          </div>

          <div className="seller-sel-meta">
            {/* Nombre del responsable */}
            <div className="seller-sel-name-text">
              <span>{assignedName || 'Sin Encargado Asignado'}</span>
            </div>

            {/* Sublínea con etiquetas minimalistas */}
            <div className="seller-sel-sub-line">
              {assignedUser ? (
                isHistoricalUser ? (
                  <span className="seller-sel-badge-hist">
                    Histórico ({assignedUser.role || 'Inactivo'})
                  </span>
                ) : (
                  <>
                    <span className={`seller-sel-badge-role ${String(assignedUser.role || assignedUser.rol || '').trim().toLowerCase() === 'admin' ? 'admin' : ''}`}>
                      {String(assignedUser.role || assignedUser.rol || '').trim().toLowerCase() === 'admin' ? 'Admin' : 'Vendedor'}
                    </span>
                    <span className="seller-sel-dot-sep">·</span>
                    <span className="seller-sel-status-text">Activo</span>
                  </>
                )
              ) : (
                <span className="seller-sel-unassigned-sub">Cola general de cotizaciones</span>
              )}
            </div>
          </div>
        </div>

        {/* Lado derecho: botón minimalista Cambiar y Chevron */}
        <div className="seller-sel-trigger-right">
          <div className="seller-sel-action-button">
            <span>Cambiar</span>
            <svg
              className={`seller-sel-chevron ${isOpen ? 'rotate' : ''}`}
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>
      </div>

      {/* Popover Flotante Proyectado con createPortal */}
      {isOpen && popoverPos && createPortal(
        <div
          ref={popoverRef}
          className="seller-sel-popover"
          style={{
            position: 'fixed',
            top: `${popoverPos.top}px`,
            left: `${popoverPos.left}px`,
            width: `${popoverPos.width}px`,
            maxHeight: `${popoverPos.maxHeight}px`,
            zIndex: 99999999
          }}
        >
          {renderPopoverContent()}
        </div>,
        document.body
      )}
    </div>
  );

  function renderPopoverContent() {
    return (
      <div className="seller-sel-popover-inner">
        {/* Encabezado: Buscador Minimalista con fondo 100% BLANCO PURO */}
        <div className="seller-sel-popover-header">
          <div className="seller-sel-search-field">
            <svg
              className="seller-sel-search-svg"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#64748b"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Buscar vendedor o administrador activo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="seller-sel-search-input search-input-naked"
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
                className="seller-sel-clear-btn"
                title="Limpiar"
              >
                ✕
              </button>
            ) : (
              <span className="seller-sel-shortcut-pill">⌘K</span>
            )}
          </div>

          {/* Subbarra informativa */}
          <div className="seller-sel-filter-info-bar">
            <div className="seller-sel-filter-info-left">
              <span className="seller-sel-presence-dot" />
              <span className="seller-sel-filter-label">USUARIOS AUTORIZADOS</span>
              <span className="seller-sel-filter-count">{activeSellers.length} disponibles</span>
            </div>
            <span className="seller-sel-filter-tag">Filtrado</span>
          </div>
        </div>

        {/* Lista de Opciones */}
        <div className="seller-sel-list-scroll">
          {/* Opción 'Sin Encargado' */}
          <button
            type="button"
            onClick={() => handleSelect(null)}
            className={`seller-sel-item unassign ${!value ? 'is-selected' : ''}`}
          >
            <div className="seller-sel-item-left">
              <div className="seller-sel-item-avatar unassign">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="8.5" cy="7" r="4" />
                  <line x1="18" y1="8" x2="23" y2="13" />
                  <line x1="23" y1="8" x2="18" y2="13" />
                </svg>
              </div>
              <div className="seller-sel-item-text">
                <span className="seller-sel-item-name">Sin Encargado Asignado</span>
                <span className="seller-sel-item-desc">Asignar más tarde a la cola general</span>
              </div>
            </div>
            {!value && (
              <div className="seller-sel-check-mark">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
            )}
          </button>

          {/* Opción Histórica Actual (si el evento tiene un usuario inactivo asignado) */}
          {isHistoricalUser && assignedUser && (
            <div className="seller-sel-hist-card">
              <div className="seller-sel-hist-label">Asignación Histórica Preservada</div>
              <div className="seller-sel-item is-selected historical">
                <div className="seller-sel-item-left">
                  <div className="seller-sel-item-avatar hist">
                    {getUserInitials(assignedName)}
                  </div>
                  <div className="seller-sel-item-text">
                    <div className="seller-sel-item-row">
                      <span className="seller-sel-item-name">{assignedName}</span>
                      <span className="seller-sel-badge-hist">Inactivo / No Comercial</span>
                    </div>
                    <span className="seller-sel-item-desc">
                      Asignado originalmente · No se perderá a menos que elijas otro
                    </span>
                  </div>
                </div>
                <div className="seller-sel-check-mark">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
              </div>
            </div>
          )}

          {/* Separador de lista */}
          <div className="seller-sel-divider">
            <span>Equipo Comercial y Administradores</span>
          </div>

          {/* Vendedores y Administradores Activos */}
          {filteredSellers.length > 0 ? (
            filteredSellers.map((seller) => {
              const isSel = String(seller.id) === String(value);
              const name = seller.fullName || seller.name || seller.nombre || 'Usuario';
              const email = seller.email || '';
              const theme = getAvatarTheme(name);
              const role = String(seller.role || seller.rol || '').trim().toLowerCase();
              const isAdmin = role === 'admin';

              return (
                <button
                  key={seller.id}
                  type="button"
                  onClick={() => handleSelect(seller)}
                  className={`seller-sel-item ${isSel ? 'is-selected' : ''}`}
                >
                  <div className="seller-sel-item-left">
                    <div className="seller-sel-avatar-box-mini">
                      <div
                        className="seller-sel-item-avatar"
                        style={{
                          backgroundColor: theme.bg,
                          color: theme.text,
                          border: `1px solid ${theme.border}`
                        }}
                      >
                        {getUserInitials(name)}
                      </div>
                      <span className="seller-sel-dot-online-mini" />
                    </div>

                    <div className="seller-sel-item-text">
                      <div className="seller-sel-item-row">
                        <span className="seller-sel-item-name">{name}</span>
                        <span className={`seller-sel-badge-role ${isAdmin ? 'admin' : ''}`}>
                          {isAdmin ? 'ADMIN' : 'VENDEDOR'}
                        </span>
                      </div>
                      {email && (
                        <span className="seller-sel-item-desc">{email}</span>
                      )}
                    </div>
                  </div>

                  <div className="seller-sel-item-right">
                    {isSel ? (
                      <span className="seller-sel-selected-pill">
                        <span>Seleccionado</span>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </span>
                    ) : (
                      <span className="seller-sel-hover-assign">
                        Asignar →
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          ) : (
            <div className="seller-sel-empty">
              <span>No se encontraron usuarios activos con "{searchQuery}"</span>
            </div>
          )}
        </div>

        {/* Pie del popover */}
        <div className="seller-sel-popover-footer">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <polyline points="9 12 11 14 15 10" />
          </svg>
          <span>Solo usuarios activos con permisos para reservar (Vendedores y Administradores)</span>
        </div>
      </div>
    );
  }
}
