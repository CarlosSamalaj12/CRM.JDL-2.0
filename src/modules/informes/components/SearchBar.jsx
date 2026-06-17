import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchEvents } from '../services/api.js';
import { IconSearch, IconMapPin, IconClock, IconUser } from './Icons.jsx';

export default function SearchBar() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(null);
  const wrapRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const data = await fetchEvents(new Date().toISOString().slice(0, 10));
        const q = query.toLowerCase();
        const filtered = data.filter((e) =>
          (e.Institucion && e.Institucion.toLowerCase().includes(q)) ||
          (e.Salon && e.Salon.toLowerCase().includes(q)) ||
          (e.Vendedor && e.Vendedor.toLowerCase().includes(q)) ||
          (e.TipoEvento && e.TipoEvento.toLowerCase().includes(q))
        );
        setResults(filtered.slice(0, 10));
      } catch { setResults([]); }
      setLoading(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const selectEvent = (ev) => {
    setQuery('');
    setResults([]);
    inputRef.current?.blur();
    navigate(`/informe/pos/${ev.Idocupacion}`);
  };

  // Close results on click outside
  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setFocused(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const showResults = focused && query.length >= 2;

  return (
    <div ref={wrapRef} style={{ position: 'relative', minWidth: '200px' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '0.4rem 0.7rem',
        background: 'var(--bg-elevated)',
        borderRadius: 'var(--radius-sm)',
        border: '1.5px solid var(--border)',
        transition: 'all 0.2s var(--ease)'
      }}>
        <IconSearch size={14} style={{ flexShrink: 0 }} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          style={{
            flex: 1,
            border: 'none',
            background: 'transparent',
            outline: 'none',
            fontSize: '0.82rem',
            minWidth: 0,
            padding: 0,
            color: 'var(--text-main)'
          }}
        />
        {query && (
          <button
            type="button"
            onClick={() => { setQuery(''); setResults([]); inputRef.current?.focus(); }}
            style={{
              background: 'none', border: 'none', color: 'var(--text-muted)',
              cursor: 'pointer', padding: '2px', fontSize: '0.85rem', lineHeight: 1,
              flexShrink: 0
            }}
          >
            ✕
          </button>
        )}
      </div>
      {showResults && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          left: 0,
          right: 0,
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-lg)',
          zIndex: 200,
          maxHeight: '320px',
          overflowY: 'auto',
          animation: 'fadeSlideIn 0.15s var(--ease)'
        }}>
          {loading && (
            <p style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontSize: '0.82rem', textAlign: 'center' }}>
              Buscando...
            </p>
          )}
          {!loading && results.length === 0 && (
            <p style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontSize: '0.82rem', textAlign: 'center' }}>
              Sin resultados
            </p>
          )}
          {results.length > 0 && (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {results.map((ev) => (
                <li
                  key={ev.Idocupacion}
                  onClick={() => selectEvent(ev)}
                  style={{
                    padding: '0.65rem 1rem',
                    cursor: 'pointer',
                    borderBottom: '1px solid var(--border)',
                    transition: 'background 0.12s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.25rem'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-elevated)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <strong style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>
                    {ev.Institucion || '—'}
                  </strong>
                  <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <span><IconMapPin size={11} /> {ev.Salon || '—'}</span>
                    <span><IconClock size={11} /> {ev.FechaEvento?.slice(0,10) || '—'}</span>
                    <span><IconUser size={11} /> {ev.Vendedor || '—'}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
