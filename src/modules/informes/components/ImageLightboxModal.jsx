import React, { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { imagenUrl } from '../services/api.js';

/**
 * ImageLightboxModal - Visor carrusel a pantalla completa para imágenes de informes.
 * Diseñado especialmente para pantallas táctiles móviles y compatible con teclado en PC.
 * 
 * @param {Array} images - Lista de objetos de imagen [{ id, url, descripcion }, ...]
 * @param {number} initialIndex - Índice de la imagen que se abre inicialmente
 * @param {boolean} isOpen - Controla la visibilidad del modal
 * @param {Function} onClose - Callback al cerrar el visor
 */
export default function ImageLightboxModal({
  images = [],
  initialIndex = 0,
  isOpen = false,
  onClose
}) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const [touchStartY, setTouchStartY] = useState(null);
  const [touchEndY, setTouchEndY] = useState(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const containerRef = useRef(null);

  // Sincronizar índice inicial cuando se abre el modal
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(Math.max(0, Math.min(initialIndex, images.length - 1)));
      setImgLoaded(false);
    }
  }, [isOpen, initialIndex, images.length]);

  // Bloquear scroll de la página de fondo mientras el visor está abierto
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  const goToNext = useCallback(() => {
    if (images.length <= 1) return;
    setImgLoaded(false);
    setCurrentIndex(prev => (prev + 1) % images.length);
  }, [images.length]);

  const goToPrev = useCallback(() => {
    if (images.length <= 1) return;
    setImgLoaded(false);
    setCurrentIndex(prev => (prev - 1 + images.length) % images.length);
  }, [images.length]);

  // Navegación por teclado (Flechas y Escape)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
      } else if (e.key === 'ArrowRight') {
        goToNext();
      } else if (e.key === 'ArrowLeft') {
        goToPrev();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, goToNext, goToPrev, onClose]);

  // Gestos táctiles para móviles (Swipe horizontal y deslizar abajo para cerrar)
  const minSwipeDistance = 45;

  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchEndY(null);
    setTouchStart(e.targetTouches[0].clientX);
    setTouchStartY(e.targetTouches[0].clientY);
  };

  const onTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
    setTouchEndY(e.targetTouches[0].clientY);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distanceX = touchStart - touchEnd;
    const distanceY = (touchStartY && touchEndY) ? touchStartY - touchEndY : 0;
    const isHorizontalSwipe = Math.abs(distanceX) > Math.abs(distanceY) * 1.2;

    if (isHorizontalSwipe) {
      if (distanceX > minSwipeDistance) {
        // Deslizar izquierda -> siguiente foto
        goToNext();
      } else if (distanceX < -minSwipeDistance) {
        // Deslizar derecha -> foto anterior
        goToPrev();
      }
    } else if (distanceY < -90 && Math.abs(distanceX) < 60) {
      // Deslizar hacia abajo -> cerrar modal
      onClose?.();
    }
  };

  if (!isOpen || !images || images.length === 0) return null;

  const currentImg = images[currentIndex] || images[0];
  const total = images.length;
  const rawUrl = currentImg?.url || '';
  const displayUrl = rawUrl ? imagenUrl(rawUrl) : '';
  const description = String(currentImg?.descripcion || '').trim();

  const modalContent = (
    <div
      ref={containerRef}
      className="crm-image-lightbox no-print"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        background: 'rgba(10, 15, 29, 0.94)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 'env(safe-area-inset-top, 12px) env(safe-area-inset-right, 12px) env(safe-area-inset-bottom, 16px) env(safe-area-inset-left, 12px)',
        boxSizing: 'border-box',
        touchAction: 'pan-y',
        animation: 'crmLightboxFadeIn 0.22s ease-out'
      }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onClick={(e) => {
        // Cerrar al hacer clic en el fondo oscuro fuera de la imagen y controles
        if (e.target === containerRef.current || e.target.classList.contains('crm-lightbox-stage')) {
          onClose?.();
        }
      }}
    >
      {/* ─── BARRA SUPERIOR: Contador y botón de cierre ─── */}
      <div style={{
        width: '100%',
        maxWidth: '1200px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        boxSizing: 'border-box',
        zIndex: 2
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(255, 255, 255, 0.12)',
          padding: '4px 12px',
          borderRadius: '20px',
          color: '#f8fafc',
          fontSize: '0.85rem',
          fontWeight: '600',
          letterSpacing: '0.3px',
          backdropFilter: 'blur(4px)'
        }}>
          <span>📷</span>
          <span>{currentIndex + 1} de {total}</span>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar visor"
          style={{
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.15)',
            border: '1px solid rgba(255, 255, 255, 0.25)',
            color: '#ffffff',
            fontSize: '1.25rem',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            outline: 'none',
            transition: 'background 0.18s, transform 0.15s'
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.8)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'; }}
        >
          ✕
        </button>
      </div>

      {/* ─── ESCENARIO CENTRAL: Imagen y controles de carrusel ─── */}
      <div
        className="crm-lightbox-stage"
        style={{
          flex: 1,
          width: '100%',
          maxWidth: '1200px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          padding: '4px 0',
          overflow: 'hidden'
        }}
      >
        {/* Botón Anterior (Desktop y Tablet) */}
        {total > 1 && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); goToPrev(); }}
            aria-label="Foto anterior"
            style={{
              position: 'absolute',
              left: '8px',
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 3,
              width: '46px',
              height: '46px',
              borderRadius: '50%',
              background: 'rgba(15, 23, 42, 0.65)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              color: '#ffffff',
              fontSize: '1.75rem',
              lineHeight: '1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
              transition: 'background 0.18s, transform 0.15s',
              userSelect: 'none'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(14, 165, 233, 0.85)'; e.currentTarget.style.transform = 'translateY(-50%) scale(1.08)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(15, 23, 42, 0.65)'; e.currentTarget.style.transform = 'translateY(-50%) scale(1)'; }}
          >
            ‹
          </button>
        )}

        {/* Contenedor de la Imagen con auto-fit y transición suave */}
        <div style={{
          maxWidth: '94vw',
          maxHeight: 'calc(100vh - 180px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative'
        }}>
          {!imgLoaded && (
            <div style={{
              position: 'absolute',
              color: 'rgba(255, 255, 255, 0.7)',
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span className="spinner-border spinner-border-sm" role="status" style={{ width: '20px', height: '20px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#38bdf8', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <span>Cargando imagen...</span>
            </div>
          )}

          <img
            key={currentImg?.id || currentIndex}
            src={displayUrl}
            alt={description || `Foto ${currentIndex + 1}`}
            onLoad={() => setImgLoaded(true)}
            style={{
              maxWidth: '92vw',
              maxHeight: 'calc(100vh - 190px)',
              objectFit: 'contain',
              borderRadius: '8px',
              boxShadow: '0 20px 35px -10px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.1)',
              opacity: imgLoaded ? 1 : 0.2,
              transition: 'opacity 0.22s ease-in-out',
              userSelect: 'none',
              WebkitUserSelect: 'none',
              pointerEvents: 'auto'
            }}
            draggable={false}
          />
        </div>

        {/* Botón Siguiente (Desktop y Tablet) */}
        {total > 1 && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); goToNext(); }}
            aria-label="Foto siguiente"
            style={{
              position: 'absolute',
              right: '8px',
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 3,
              width: '46px',
              height: '46px',
              borderRadius: '50%',
              background: 'rgba(15, 23, 42, 0.65)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              color: '#ffffff',
              fontSize: '1.75rem',
              lineHeight: '1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
              transition: 'background 0.18s, transform 0.15s',
              userSelect: 'none'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(14, 165, 233, 0.85)'; e.currentTarget.style.transform = 'translateY(-50%) scale(1.08)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(15, 23, 42, 0.65)'; e.currentTarget.style.transform = 'translateY(-50%) scale(1)'; }}
          >
            ›
          </button>
        )}
      </div>

      {/* ─── BARRA INFERIOR: Comentario / Descripción de la foto actual ─── */}
      <div style={{
        width: '100%',
        maxWidth: '750px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
        padding: '4px 12px 10px',
        boxSizing: 'border-box',
        zIndex: 2
      }}>
        {description ? (
          <div style={{
            width: '100%',
            background: 'rgba(30, 41, 59, 0.88)',
            border: '1px solid rgba(255, 255, 255, 0.18)',
            borderRadius: '12px',
            padding: '10px 16px',
            color: '#f8fafc',
            fontSize: '0.92rem',
            lineHeight: 1.45,
            textAlign: 'center',
            maxHeight: '85px',
            overflowY: 'auto',
            backdropFilter: 'blur(8px)',
            boxShadow: '0 6px 16px rgba(0, 0, 0, 0.45)',
            boxSizing: 'border-box'
          }}>
            <span style={{ color: '#38bdf8', fontWeight: '600', marginRight: '6px' }}>Nota:</span>
            <span>{description}</span>
          </div>
        ) : (
          <div style={{
            color: 'rgba(255, 255, 255, 0.45)',
            fontSize: '0.8rem',
            fontStyle: 'italic'
          }}>
            (Sin comentarios asignados para esta foto)
          </div>
        )}

        {/* Indicadores de bolitas (puntos) si hay 2 a 10 fotos */}
        {total > 1 && total <= 10 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginTop: '2px'
          }}>
            {images.map((_, idx) => (
              <button
                key={idx}
                type="button"
                aria-label={`Ir a foto ${idx + 1}`}
                onClick={() => {
                  setImgLoaded(false);
                  setCurrentIndex(idx);
                }}
                style={{
                  width: idx === currentIndex ? '22px' : '8px',
                  height: '8px',
                  borderRadius: '4px',
                  background: idx === currentIndex ? '#38bdf8' : 'rgba(255, 255, 255, 0.3)',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  outline: 'none'
                }}
              />
            ))}
          </div>
        )}

        {/* Mensaje de ayuda sutil para móviles */}
        <div style={{
          color: 'rgba(255, 255, 255, 0.4)',
          fontSize: '0.72rem',
          letterSpacing: '0.3px',
          userSelect: 'none'
        }}>
          Desliza para navegar • Toca fuera para cerrar
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : null;
}
