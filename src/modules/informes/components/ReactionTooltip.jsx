import { useEffect, useRef } from 'react';

const TOOLTIP_STYLES = {
  position: 'fixed',
  top: '-9999px',
  left: '-9999px',
  background: '#1e293b',
  color: '#fff',
  borderRadius: '10px',
  padding: '0.45rem 0.7rem',
  boxShadow: '0 8px 28px rgba(0,0,0,0.25)',
  zIndex: 10000,
  fontSize: '0.78rem',
  lineHeight: 1.4,
  pointerEvents: 'none',
  animation: 'tooltipFadeIn 0.12s ease',
  maxWidth: '220px',
  whiteSpace: 'nowrap',
};

export default function ReactionTooltip({ emoji, label, userIds, userMap, x, y, onClose }) {
  const tipRef = useRef(null);

  useEffect(() => {
    if (!tipRef.current) return;
    const el = tipRef.current;
    const rect = el.getBoundingClientRect();
    const viewportW = window.innerWidth;

    // Adjust horizontal position so tooltip doesn't go off-screen
    let left = x;
    if (left + rect.width > viewportW - 10) {
      left = viewportW - rect.width - 10;
    }
    if (left < 10) left = 10;

    el.style.left = `${left}px`;
    el.style.top = `${y - rect.height - 8}px`;
  }, [x, y]);

  const names = userIds.map(id => userMap[id]).filter(Boolean);

  return (
    <div ref={tipRef} style={TOOLTIP_STYLES}>
      <div style={{
        fontWeight: 600, marginBottom: names.length > 1 ? '0.2rem' : 0,
        display: 'flex', alignItems: 'center', gap: '0.3rem',
        fontSize: '0.82rem',
      }}>
        <span style={{ fontSize: '0.95rem' }}>{emoji}</span>
        <span>{label}</span>
      </div>
      {names.length > 0 && (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: '0.08rem',
          borderTop: names.length > 1 ? '1px solid rgba(255,255,255,0.12)' : 'none',
          paddingTop: names.length > 1 ? '0.2rem' : 0,
        }}>
          {names.map((name, i) => (
            <span key={i} style={{ opacity: 0.88, fontSize: '0.74rem' }}>{name}</span>
          ))}
        </div>
      )}
      {names.length > 3 && (
        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.12)',
          paddingTop: '0.15rem', marginTop: '0.1rem',
          opacity: 0.6, fontSize: '0.68rem',
        }}>
          {userIds.length} personas
        </div>
      )}
    </div>
  );
}
