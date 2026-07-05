import { Suspense } from 'react';
import ErrorBoundary from './ErrorBoundary';

/* ─── CSS keyframes (single injection) ─── */
const SPINNER_KEYFRAMES = `
@keyframes sr-spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
@keyframes sr-dash {
  0% { stroke-dasharray: 1, 200; stroke-dashoffset: 0; }
  50% { stroke-dasharray: 90, 200; stroke-dashoffset: -35; }
  100% { stroke-dasharray: 90, 200; stroke-dashoffset: -124; }
}
@keyframes sr-shimmer {
  0% { background-position: -400px 0; }
  100% { background-position: 400px 0; }
}
@keyframes sr-dot {
  0%, 20% { opacity: 0; transform: translateY(0); }
  40% { opacity: 1; transform: translateY(-4px); }
  60% { opacity: 1; transform: translateY(-4px); }
  80%, 100% { opacity: 0; transform: translateY(0); }
}
@keyframes sr-fadeSlide {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes sr-logoPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.3); }
  50% { box-shadow: 0 0 0 12px rgba(99, 102, 241, 0); }
}
`;

/* ─── Theme helpers ─── */
function isDark() {
  try {
    return localStorage.getItem('theme') === 'dark';
  } catch {
    return false;
  }
}

const theme = (dark) => ({
  bgApp: dark ? '#0f172a' : '#f0f4ff',
  cardBg: dark ? '#1e293b' : '#ffffff',
  cardBorder: dark ? '#334155' : '#e2e8f0',
  cardShadow: dark
    ? '0 4px 24px rgba(0,0,0,0.3), 0 1px 4px rgba(0,0,0,0.2)'
    : '0 4px 24px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04)',
  shimmerFrom: dark ? '#1e293b' : '#f1f5f9',
  shimmerTo: dark ? '#334155' : '#e2e8f0',
  divider: dark ? '#334155' : '#e2e8f0',
  textMuted: dark ? '#64748b' : '#94a3b8',
  textSecondary: dark ? '#94a3b8' : '#64748b',
  dotColor: dark ? '#64748b' : '#94a3b8',
  spinnerTrack: dark ? '#334155' : '#e2e8f0',
});

/* ─── Sub-components ─── */

function Spinner({ trackColor }) {
  return (
    <svg width={48} height={48} viewBox="0 0 50 50" style={{ animation: 'sr-spin 1.4s linear infinite' }}>
      <circle cx={25} cy={25} r={20} fill="none" stroke={trackColor} strokeWidth={4} />
      <circle
        cx={25} cy={25} r={20}
        fill="none" stroke="url(#sr-gradient)" strokeWidth={4}
        strokeLinecap="round"
        style={{
          strokeDasharray: 126,
          strokeDashoffset: 0,
          transformOrigin: 'center',
          animation: 'sr-dash 1.4s ease-in-out infinite',
        }}
      />
      <defs>
        <linearGradient id="sr-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="50%" stopColor="#818cf8" />
          <stop offset="100%" stopColor="#4f46e5" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function SkeletonBar({ width = '100%', height = 12, radius = 6, from, to }) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: radius,
        background: `linear-gradient(90deg, ${from} 25%, ${to} 50%, ${from} 75%)`,
        backgroundSize: '400px 100%',
        animation: 'sr-shimmer 1.8s ease-in-out infinite',
      }}
    />
  );
}

function LoadingDots({ color }) {
  return (
    <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
      {[0, 1, 2].map(i => (
        <span
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: color,
            display: 'inline-block',
            animation: `sr-dot 1.4s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
    </span>
  );
}

/* ─── Fallback builder ─── */
function createFallback() {
  const dark = isDark();
  const t = theme(dark);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '360px',
        padding: '40px 20px',
        gap: '28px',
        background: t.bgApp,
        transition: 'background 0.3s ease',
      }}
    >
      <style>{SPINNER_KEYFRAMES}</style>

      <div
        style={{
          background: t.cardBg,
          borderRadius: 16,
          padding: '40px 48px',
          boxShadow: t.cardShadow,
          border: `1px solid ${t.cardBorder}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '24px',
          maxWidth: 400,
          width: '100%',
          transition: 'background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease',
        }}
      >
        {/* Logo / Brand icon */}
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: 22,
            fontWeight: 800,
            letterSpacing: -1,
            boxShadow: '0 4px 16px rgba(99, 102, 241, 0.3)',
            animation: 'sr-logoPulse 2s ease-in-out infinite',
          }}
        >
          J
        </div>

        {/* Spinner */}
        <Spinner trackColor={t.spinnerTrack} />

        {/* Skeleton card preview */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <SkeletonBar width="60%" height={14} from={t.shimmerFrom} to={t.shimmerTo} />
          <SkeletonBar width="90%" height={10} from={t.shimmerFrom} to={t.shimmerTo} />
          <SkeletonBar width="75%" height={10} from={t.shimmerFrom} to={t.shimmerTo} />
          <div style={{ height: 1, background: t.divider, margin: '4px 0' }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <SkeletonBar width={80} height={32} radius={8} from={t.shimmerFrom} to={t.shimmerTo} />
            <SkeletonBar width={100} height={32} radius={8} from={t.shimmerFrom} to={t.shimmerTo} />
          </div>
        </div>

        {/* Loading text with animated dots */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            color: t.textSecondary,
            fontSize: 13,
            fontWeight: 500,
            animation: 'sr-fadeSlide 0.4s ease-out',
          }}
        >
          Cargando<LoadingDots color={t.dotColor} />
        </div>
      </div>

      <p style={{ margin: 0, fontSize: 12, color: t.textMuted, fontWeight: 400, textAlign: 'center' }}>
        Preparando el contenido...
      </p>
    </div>
  );
}

export default function SafeRoute({ children, fallback }) {
  return (
    <ErrorBoundary>
      <Suspense fallback={fallback || createFallback()}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}
