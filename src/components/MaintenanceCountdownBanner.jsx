import React, { useState, useEffect, useRef } from 'react';

/**
 * MaintenanceCountdownBanner
 * Barra fija superior con conteo regresivo animado de cortesía (30s)
 * para que los usuarios guarden sus datos antes del bloqueo por mantenimiento.
 * Permite interactuar libremente con formularios y botones debajo de la barra.
 */
export default function MaintenanceCountdownBanner({
  startsAt,
  duration = 30,
  onCountdownEnd,
  onImmediateLock
}) {
  const calculateSeconds = () => {
    if (!startsAt) return duration;
    const diffMs = Number(startsAt) - Date.now();
    return Math.max(0, Math.ceil(diffMs / 1000));
  };

  const [secondsLeft, setSecondsLeft] = useState(calculateSeconds);
  const audioPlayedRef = useRef(false);

  // Reproducir un aviso sonoro suave (Web Audio API autónomo) al iniciar la cuenta
  useEffect(() => {
    if (!audioPlayedRef.current) {
      audioPlayedRef.current = true;
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          if (ctx.state === 'suspended') {
            ctx.resume();
          }
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(880, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.35);
          gain.gain.setValueAtTime(0.18, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.42);
        }
      } catch (_) {}
    }
  }, []);

  // Intervalo de actualización del conteo segundo a segundo
  useEffect(() => {
    const checkRemaining = () => {
      const remaining = calculateSeconds();
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        onCountdownEnd?.();
      }
    };

    checkRemaining();
    const interval = setInterval(checkRemaining, 1000);
    return () => clearInterval(interval);
  }, [startsAt, onCountdownEnd]);

  const progressPct = Math.min(100, Math.max(0, (secondsLeft / duration) * 100));

  return (
    <aside
      role="alert"
      aria-live="assertive"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999999,
        background: 'linear-gradient(135deg, #991b1b 0%, #dc2626 50%, #ea580c 100%)',
        color: '#ffffff',
        boxShadow: '0 10px 30px rgba(220, 38, 38, 0.45)',
        borderBottom: '2px solid rgba(255, 255, 255, 0.25)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        pointerEvents: 'auto',
      }}
    >
      <div
        style={{
          maxWidth: '1360px',
          margin: '0 auto',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '14px',
          flexWrap: 'wrap'
        }}
      >
        {/* Lado izquierdo: Badge de segundos + Título descriptivo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '999px',
              background: '#ffffff',
              color: '#dc2626',
              fontWeight: 900,
              fontSize: '1rem',
              letterSpacing: '0.02em',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
              flexShrink: 0,
              animation: secondsLeft <= 10 ? 'pulse 1s infinite' : 'none'
            }}
          >
            <span>⏳</span>
            <span>{secondsLeft}s</span>
          </div>

          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.03em', lineHeight: 1.2 }}>
              AVISO: MODO MANTENIMIENTO EN {secondsLeft} SEGUNDOS
            </div>
            <div style={{ fontSize: '0.78rem', color: '#fed7aa', marginTop: '2px', lineHeight: 1.3 }}>
              Guarde sus cambios y finalice cualquier formulario abierto ahora para no perder información.
            </div>
          </div>
        </div>

        {/* Lado derecho: Botón opcional para bloquearse de una vez */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {onImmediateLock && (
            <button
              type="button"
              onClick={onImmediateLock}
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                border: '1.5px solid rgba(255, 255, 255, 0.5)',
                color: '#ffffff',
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: 800,
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.35)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'; }}
            >
              Cerrar y bloquear ahora
            </button>
          )}
        </div>
      </div>

      {/* Barra de progreso inferior animada */}
      <div style={{ height: '3.5px', background: 'rgba(0, 0, 0, 0.25)', width: '100%' }}>
        <div
          style={{
            height: '100%',
            background: '#ffffff',
            width: `${progressPct}%`,
            transition: 'width 1s linear'
          }}
        />
      </div>
    </aside>
  );
}

