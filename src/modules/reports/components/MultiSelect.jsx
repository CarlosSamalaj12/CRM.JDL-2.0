import { useEffect, useRef, useState } from 'react';

/**
 * Dropdown multi-selección con búsqueda opcional.
 * - selected: Set<string>  (vacío = "Todos" / sin filtro)
 * - options:  Array<{ value, label, color?, sublabel? }>
 * - emptyLabel: texto cuando no hay selección (ej. "Todos los vendedores")
 * - searchable: muestra input de búsqueda si true
 */
export default function MultiSelect({
  selected,
  value,
  onChange,
  options = [],
  placeholder = 'Seleccionar...',
  emptyLabel = 'Todos',
  searchable = false,
  width = 240,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef(null);

  const rawSel = selected !== undefined ? selected : value;
  const selSet = rawSel instanceof Set ? rawSel : new Set(Array.isArray(rawSel) ? rawSel : []);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (val) => {
    const next = new Set(selSet);
    if (next.has(val)) next.delete(val);
    else next.add(val);
    if (onChange) onChange(next);
  };

  const clearAll = () => {
    if (onChange) onChange(new Set());
  };

  const q = query.trim().toLowerCase();
  const safeOptions = Array.isArray(options) ? options : [];
  const filteredOptions = searchable && q
    ? safeOptions.filter(o => String(o.label || '').toLowerCase().includes(q))
    : safeOptions;

  const count = selSet.size;
  const previewList = safeOptions.filter(o => selSet.has(o.value));

  return (
    <div ref={ref} style={{ minWidth: 240, position: 'relative', width }}>
      <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '4px' }}>
        {placeholder}
      </span>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '5px 10px',
          border: `1px solid ${open ? '#2563eb' : '#e2e8f0'}`,
          borderRadius: '20px', background: '#ffffff',
          boxShadow: open ? '0 0 0 2px #2563eb30' : '0 1px 3px #00000008',
          transition: 'box-shadow 0.15s, border-color 0.15s',
          minHeight: 36, cursor: 'pointer', width: '100%',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1, minWidth: 0, overflow: 'hidden', flexWrap: 'nowrap' }}>
          {count === 0 ? (
            <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{emptyLabel}</span>
          ) : (
            <>
              {previewList.slice(0, 1).map(o => (
                <span key={o.value} style={{
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  padding: '2px 8px', borderRadius: '10px',
                  background: o.color ? `${o.color}18` : '#eff6ff',
                  border: `1px solid ${o.color ? `${o.color}40` : '#bfdbfe'}`,
                  fontSize: '11px', fontWeight: 600,
                  color: o.color || '#1d4ed8',
                  maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  flexShrink: 1, minWidth: 0,
                }}>
                  {o.color && <span style={{ width: 6, height: 6, borderRadius: '50%', background: o.color, flexShrink: 0 }} />}
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.label}</span>
                </span>
              ))}
              {count > 1 && (
                <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>
                  +{count - 1}
                </span>
              )}
            </>
          )}
        </div>
        <svg viewBox="0 0 12 12" width="14" height="14" fill="none" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
          <path d="M2 4l4 4 4-4" />
        </svg>
      </div>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
          background: '#ffffff', borderRadius: '16px',
          boxShadow: '0 8px 32px #00000020', zIndex: 9999,
          overflow: 'hidden', padding: '6px',
        }}>
          {searchable && (
            <div style={{ padding: '4px 4px 8px', borderBottom: '1px solid #f1f5f9', marginBottom: '4px' }}>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar..."
                style={{
                  width: '100%', padding: '6px 10px', borderRadius: '10px',
                  border: '1px solid #e2e8f0', fontSize: '12px', outline: 'none',
                  background: '#ffffff', color: '#0f172a', boxSizing: 'border-box',
                }}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}
          <div style={{ maxHeight: 240, overflowY: 'auto' }}>
            {filteredOptions.length === 0 ? (
              <div style={{ padding: '14px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>
                Sin resultados
              </div>
            ) : filteredOptions.map(o => {
              const active = selSet.has(o.value);
              const color = o.color || '#2563eb';
              return (
                <label key={o.value} style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '8px 10px', cursor: 'pointer',
                  borderRadius: '10px', marginBottom: '2px',
                  transition: 'background 0.1s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = active ? `${color}12` : '#f1f5f9'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <div style={{
                    width: 18, height: 18, borderRadius: '5px', flexShrink: 0,
                    background: active ? color : '#f1f5f9',
                    border: active ? 'none' : '1.5px solid #cbd5e1',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s',
                  }}>
                    {active && (
                      <svg viewBox="0 0 12 12" width="11" height="11" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 6l3 3 5-5" />
                      </svg>
                    )}
                  </div>
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => toggle(o.value)}
                    style={{ display: 'none' }}
                  />
                  {o.color && <span style={{ width: 8, height: 8, borderRadius: '50%', background: o.color, flexShrink: 0 }} />}
                  <span style={{ fontSize: '13px', fontWeight: 500, color: '#475569', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {o.label}
                  </span>
                </label>
              );
            })}
          </div>
          <div style={{ padding: '8px 4px 4px', borderTop: '1px solid #f1f5f9', marginTop: '4px', display: 'flex', gap: '6px' }}>
            <button
              type="button"
              onClick={clearAll}
              disabled={count === 0}
              title="Deseleccionar todo"
              style={{
                flex: '0 0 auto', padding: '8px 10px', borderRadius: '14px',
                background: count === 0 ? '#f1f5f9' : '#ffffff',
                color: count === 0 ? '#94a3b8' : '#475569',
                border: '1px solid #e2e8f0', fontSize: '12px', fontWeight: 700,
                cursor: count === 0 ? 'default' : 'pointer',
                transition: 'all 0.15s',
                display: 'inline-flex', alignItems: 'center', gap: '5px',
                whiteSpace: 'nowrap',
              }}
            >
              <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 4h10M6 4V2.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1V4M5 4l1 9.5a1 1 0 0 0 1 .9h2a1 1 0 0 0 1-.9L11 4" />
              </svg>
              Limpiar
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{
                flex: 1, padding: '8px', borderRadius: '14px',
                background: '#2563eb', color: '#ffffff',
                border: 'none', fontSize: '12px', fontWeight: 700,
                cursor: 'pointer', boxShadow: '0 2px 8px #2563eb40',
                transition: 'background 0.15s',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#1d4ed8'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#2563eb'; }}
            >
              Listo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
