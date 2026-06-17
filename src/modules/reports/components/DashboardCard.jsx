const VARIANT_COLORS = {
  default: '#2563eb', success: '#16a34a', info: '#0891b2',
  warning: '#d97706', danger: '#dc2626', purple: '#9333ea', teal: '#0d9488',
};

const VARIANT_BG = {
  default: 'linear-gradient(145deg, #f0f7ff 0%, #e8f0fe 100%)',
  success: 'linear-gradient(145deg, #f0fdf4 0%, #dcfce7 100%)',
  info: 'linear-gradient(145deg, #f0fdfa 0%, #ccfbf1 100%)',
  warning: 'linear-gradient(145deg, #fffbeb 0%, #fef3c7 100%)',
  danger: 'linear-gradient(145deg, #fff1f2 0%, #ffe4e6 100%)',
  purple: 'linear-gradient(145deg, #f5f3ff 0%, #ede9fe 100%)',
  teal: 'linear-gradient(145deg, #f0fdfa 0%, #ccfbf1 100%)',
};

export default function DashboardCard({ 
  eyebrow = '', value = '', meta = '', variant = 'default',
  children, size = 'normal', style = {},
}) {
  const accentColor = VARIANT_COLORS[variant] || VARIANT_COLORS.default;
  const gradientBg = VARIANT_BG[variant] || VARIANT_BG.default;

  const sizeStyles = {
    normal: { minHeight: '142px', padding: '16px' },
    large: { minHeight: '200px', padding: '24px', gridColumn: 'span 2' },
    small: { minHeight: '100px', padding: '12px' },
  };

  return (
    <div style={{
      position: 'relative',
      ...sizeStyles[size],
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      overflow: 'hidden',
      border: '1px solid rgba(226, 232, 240, 0.6)',
      borderRadius: '20px',
      background: gradientBg,
      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02), 0 4px 12px rgba(0, 0, 0, 0.03)',
      transition: 'transform 0.35s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.35s ease, border-color 0.25s ease',
      cursor: 'default',
      ...style,
    }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-3px)';
        e.currentTarget.style.boxShadow = '0 12px 32px rgba(0, 0, 0, 0.06), 0 24px 48px rgba(0, 0, 0, 0.04)';
        e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.3)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.02), 0 4px 12px rgba(0, 0, 0, 0.03)';
        e.currentTarget.style.borderColor = 'rgba(226, 232, 240, 0.6)';
      }}
    >
      {/* Accent bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
        background: `linear-gradient(90deg, ${accentColor}, ${accentColor}88)`,
        opacity: 0.7,
      }} />

      {eyebrow && (
        <span style={{ color: '#94a3b8', fontSize: '10px', fontWeight: '800', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {eyebrow}
        </span>
      )}

      <div style={{
        color: '#0f172a',
        fontSize: size === 'large' ? 'clamp(2rem, 1.5vw + 1.5rem, 3rem)' : 'clamp(1.5rem, 1vw + 1.2rem, 2.4rem)',
        lineHeight: '1.05', fontWeight: '800', letterSpacing: '-0.02em',
      }}>
        {value}
      </div>

      {children || (meta && (
        <div style={{
          marginTop: 'auto',
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          width: 'fit-content', maxWidth: '100%',
          padding: '5px 10px',
          border: '1px solid rgba(226, 232, 240, 0.8)',
          borderRadius: '999px',
          background: 'rgba(255, 255, 255, 0.7)',
          color: '#64748b', fontSize: '11px', fontWeight: '700',
        }}>
          {meta}
        </div>
      ))}
    </div>
  );
}
