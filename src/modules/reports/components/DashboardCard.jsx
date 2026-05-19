import React from 'react';

const VARIANT_COLORS = {
  default: '#2563eb',
  success: '#16a34a',
  info: '#0891b2',
  warning: '#d97706',
  danger: '#dc2626',
  purple: '#9333ea',
  teal: '#0d9488',
};

export default function DashboardCard({ 
  eyebrow = '',
  value = '',
  meta = '',
  variant = 'default',
  children 
}) {
  const accentColor = VARIANT_COLORS[variant] || VARIANT_COLORS.default;

  return (
    <div style={{
      position: 'relative',
      minHeight: '142px',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '7px',
      overflow: 'hidden',
      border: '1px solid #dbe7f5',
      borderRadius: '16px',
      background: '#ffffff',
      boxShadow: '0 10px 24px rgba(15,23,42,0.06)',
    }}>
      {/* Barra de color arriba */}
      <div style={{
        content: '""',
        display: 'block',
        position: 'absolute',
        inset: '0 0 auto 0',
        height: '4px',
        background: accentColor,
      }} />

      {/* Etiqueta superior (eyebrow) */}
      {eyebrow && (
        <span style={{
          color: '#64748b',
          fontSize: '11px',
          fontWeight: '900',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}>
          {eyebrow}
        </span>
      )}

      {/* Valor principal */}
      <div style={{
        color: '#07172c',
        fontSize: 'clamp(1.75rem, 1.15vw + 1.35rem, 2.7rem)',
        lineHeight: '1.05',
        fontWeight: '700',
      }}>
        {value}
      </div>

      {/* Children (contenido adicional) o Meta */}
      {children || (meta && (
        <div style={{
          marginTop: 'auto',
          width: 'fit-content',
          maxWidth: '100%',
          padding: '6px 10px',
          border: '1px solid #dbe3ef',
          borderRadius: '999px',
          background: '#f8fafc',
          color: '#475569',
          fontSize: '12px',
          fontWeight: '700',
        }}>
          {meta}
        </div>
      ))}
    </div>
  );
}