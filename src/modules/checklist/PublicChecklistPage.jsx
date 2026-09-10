import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';

// Página PÚBLICA (sin auth) para que el cliente llene la evaluación del checklist.
// El servidor monta esta vista detrás de GET /api/checklist-public/:token y
// filtra el template para mostrar SOLO secciones tipo "evaluacion".
// Las respuestas se persisten en app_state_kv bajo eventChecklists[eventoId][evaluacion]
// usando exactamente el shape que produce SettingsChecklist internamente.

const RATING_OPTIONS = [
  { value: 'muy_malo',  emoji: '😠', label: 'Muy malo' },
  { value: 'malo',      emoji: '🙁', label: 'Malo' },
  { value: 'regular',   emoji: '😐', label: 'Regular' },
  { value: 'bueno',     emoji: '🙂', label: 'Bueno' },
  { value: 'excelente', emoji: '🤩', label: 'Excelente' },
];

function formatFechaCorta(iso) {
  if (!iso) return '';
  // Acepta 'YYYY-MM-DD' o ISO completo
  const s = String(iso).slice(0, 10);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return s;
  const [, y, mo, d] = m;
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${parseInt(d, 10)} ${meses[parseInt(mo, 10) - 1]} ${y}`;
}

export default function PublicChecklistPage() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [payload, setPayload] = useState(null); // { event, template, status, expiresAt, submittedAt, previousSubmission }
  const [submitterNombre, setSubmitterNombre] = useState('');
  const [submitterContacto, setSubmitterContacto] = useState('');
  const [notas, setNotas] = useState('');
  // Mapa: itemId -> { rating, comentario }
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const bodyRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await fetch(`/api/checklist-public/${encodeURIComponent(token || '')}`, { credentials: 'omit' });
        const data = await r.json().catch(() => ({}));
        if (cancelled) return;
        if (!r.ok) {
          setError(data?.message || 'No se pudo cargar la evaluación.');
          return;
        }
        setPayload(data);
        // Pre-rellenar si ya fue enviado (modo solo lectura)
        if (data.status === 'submitted' && data.previousSubmission) {
          setSubmitterNombre(data.previousSubmission.submitterNombre || '');
          setSubmitterContacto(data.previousSubmission.submitterContacto || '');
          setNotas(data.previousSubmission.notas || '');
          const seed = {};
          for (const it of (data.previousSubmission.items || [])) {
            seed[Number(it.itemId)] = {
              rating: it.rating || '',
              comentario: it.comentario || '',
            };
          }
          setAnswers(seed);
        }
      } catch (_e) {
        if (!cancelled) setError('Error de red. Intenta de nuevo.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const totalItems = useMemo(() => {
    if (!payload) return 0;
    return (payload.template.sections || []).reduce((acc, s) => acc + (s.items || []).length, 0);
  }, [payload]);

  const answeredItems = useMemo(() => {
    return Object.values(answers).filter(a => (a.rating || a.comentario)).length;
  }, [answers]);

  const status = payload?.status;

  function setAnswer(itemId, patch) {
    setAnswers(prev => {
      const cur = prev[itemId] || { rating: '', comentario: '' };
      return { ...prev, [itemId]: { ...cur, ...patch } };
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!payload) return;
    if (status !== 'active') return;
    if (!submitterNombre.trim()) {
      setServerError('Por favor indícanos tu nombre para continuar.');
      return;
    }
    const items = [];
    for (const [itemId, ans] of Object.entries(answers)) {
      if (!ans.rating && !ans.comentario) continue;
      items.push({
        itemId: Number(itemId),
        rating: ans.rating || null,
        comentario: ans.comentario || '',
      });
    }
    if (!items.length) {
      setServerError('Por favor califica al menos un punto antes de enviar.');
      return;
    }
    setSubmitting(true);
    setServerError(null);
    try {
      const r = await fetch(`/api/checklist-public/${encodeURIComponent(token)}`, {
        method: 'POST',
        credentials: 'omit',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submitterNombre: submitterNombre.trim(),
          submitterContacto: submitterContacto.trim(),
          notas: notas.trim(),
          items,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setServerError(data?.message || 'No se pudo enviar la evaluación.');
        return;
      }
      setDone(true);
      // Scroll al top para mostrar el agradecimiento
      setTimeout(() => { try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (_err) { /* noop */ } }, 50);
    } catch (_e) {
      setServerError('Error de red. Verifica tu conexión e intenta de nuevo.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Estados terminales
  if (loading) {
    return (
      <div style={S.page}>
        <div style={S.center}>
          <div style={S.spinner} />
          <p style={{ color: '#475569', marginTop: 16 }}>Cargando evaluación…</p>
        </div>
        <style>{PUBLIC_CSS}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={S.page}>
        <div style={S.center}>
          <div style={S.errorIcon}>⚠️</div>
          <h1 style={S.h1}>No se pudo abrir esta evaluación</h1>
          <p style={S.muted}>{error}</p>
          <p style={{ ...S.muted, fontSize: 13, marginTop: 24 }}>
            Si el link fue compartido por WhatsApp, pídele a tu contacto que lo reenvíe.
          </p>
        </div>
        <style>{PUBLIC_CSS}</style>
      </div>
    );
  }

  if (status === 'revoked') {
    return (
      <div style={S.page}>
        <div style={S.center}>
          <div style={S.errorIcon}>🚫</div>
          <h1 style={S.h1}>Este link fue desactivado</h1>
          <p style={S.muted}>El equipo de Jardines del Lago revocó este enlace. Si crees que es un error, contacta directamente a tu asesor.</p>
        </div>
        <style>{PUBLIC_CSS}</style>
      </div>
    );
  }

  if (status === 'expired') {
    return (
      <div style={S.page}>
        <div style={S.center}>
          <div style={S.errorIcon}>⏰</div>
          <h1 style={S.h1}>Este link ha expirado</h1>
          <p style={S.muted}>La evaluación ya no está disponible. Si necesitas responderla, contacta a tu asesor para que te envíe un nuevo enlace.</p>
        </div>
        <style>{PUBLIC_CSS}</style>
      </div>
    );
  }

  if (done) {
    return (
      <div style={S.page}>
        <div style={S.center}>
          <div style={S.successIcon}>✅</div>
          <h1 style={S.h1}>¡Gracias por tu tiempo!</h1>
          <p style={S.muted}>Tu evaluación fue enviada al equipo de Jardines del Lago.</p>
          <p style={{ ...S.muted, fontSize: 13, marginTop: 16 }}>
            Evento: <strong style={{ color: '#0f172a' }}>{payload.event.nombre || '—'}</strong>
          </p>
          <p style={{ ...S.muted, fontSize: 13 }}>
            Enviada: {new Date().toLocaleString('es-GT', { dateStyle: 'long', timeStyle: 'short' })}
          </p>
        </div>
        <style>{PUBLIC_CSS}</style>
      </div>
    );
  }

  // ── Modo solo lectura si ya fue enviado
  const readOnly = status === 'submitted';

  return (
    <div style={S.page}>
      <header style={S.header}>
        <div style={S.brandRow}>
          <div style={S.logo} aria-hidden>
            <svg viewBox="0 0 24 24" width="22" height="22">
              <path d="M12 2 L14 8 L20 8 L15 12 L17 18 L12 14 L7 18 L9 12 L4 8 L10 8 Z"
                fill="#6366f1" stroke="#4f46e5" strokeWidth="0.6" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <div style={S.brandTitle}>Jardines del Lago</div>
            <div style={S.brandSubtitle}>Evaluación del evento</div>
          </div>
        </div>
      </header>

      <main ref={bodyRef} style={S.main}>
        <div style={S.card}>
          <div style={S.eventHeader}>
            <div style={S.eventLabel}>Evento</div>
            <div style={S.eventName}>{payload.event.nombre || '—'}</div>
            <div style={S.eventMeta}>
              {payload.event.fecha ? <>📅 {formatFechaCorta(payload.event.fecha)}</> : null}
              {payload.event.salon ? <span style={{ marginLeft: payload.event.fecha ? 12 : 0 }}>🏢 {payload.event.salon}</span> : null}
            </div>
          </div>

          {readOnly && (
            <div style={S.noticeReadonly}>
              <strong>Esta evaluación ya fue enviada</strong>
              <div style={{ fontSize: 13, marginTop: 4, opacity: 0.9 }}>
                Enviada el {new Date(payload.submittedAt).toLocaleString('es-GT', { dateStyle: 'long', timeStyle: 'short' })} por {payload.previousSubmission?.submitterNombre || '—'}.
                Esta es solo una vista de consulta.
              </div>
            </div>
          )}

          {!readOnly && (
            <p style={S.intro}>
              Hola 👋, nos encantaría conocer tu opinión sobre el evento. Tus respuestas son confidenciales
              y nos ayudan a mejorar. Solo te tomará un par de minutos.
            </p>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <section style={S.section}>
              <h2 style={S.sectionTitle}>Tus datos</h2>
              <label style={S.label}>
                Tu nombre *
                <input
                  type="text"
                  style={S.input}
                  value={submitterNombre}
                  onChange={(e) => setSubmitterNombre(e.target.value)}
                  placeholder="Ej. María López"
                  autoComplete="name"
                  maxLength={120}
                  required
                  readOnly={readOnly}
                />
              </label>
              <label style={S.label}>
                Contacto (opcional)
                <input
                  type="text"
                  style={S.input}
                  value={submitterContacto}
                  onChange={(e) => setSubmitterContacto(e.target.value)}
                  placeholder="Correo o teléfono"
                  maxLength={120}
                  readOnly={readOnly}
                />
              </label>
            </section>

            <section style={S.section}>
              <h2 style={S.sectionTitle}>Tu evaluación</h2>
              {(payload.template.sections || []).map((sec, sIdx) => (
                <div key={`s-${sIdx}`} style={S.sectionBlock}>
                  <h3 style={S.subSectionTitle}>{sec.name}</h3>
                  {(sec.items || []).map((it) => {
                    const cur = answers[Number(it.id)] || { rating: '', comentario: '' };
                    return (
                      <div key={it.id} style={S.itemCard}>
                        <div style={S.itemText}>{it.text}</div>
                        <div style={S.ratingRow} role="radiogroup" aria-label={`Calificación: ${it.text}`}>
                          {RATING_OPTIONS.map(opt => {
                            const selected = cur.rating === opt.value;
                            return (
                              <button
                                type="button"
                                key={opt.value}
                                onClick={() => !readOnly && setAnswer(Number(it.id), { rating: opt.value })}
                                aria-pressed={selected}
                                aria-label={opt.label}
                                style={{
                                  ...S.ratingBtn,
                                  ...(selected ? S.ratingBtnActive : null),
                                  cursor: readOnly ? 'default' : 'pointer',
                                }}
                                disabled={readOnly}
                              >
                                <span style={S.ratingEmoji} aria-hidden>{opt.emoji}</span>
                                <span style={S.ratingLabel}>{opt.label}</span>
                              </button>
                            );
                          })}
                        </div>
                        <textarea
                          style={S.textarea}
                          placeholder="Comentario (opcional)"
                          value={cur.comentario}
                          onChange={(e) => setAnswer(Number(it.id), { comentario: e.target.value })}
                          maxLength={500}
                          rows={2}
                          readOnly={readOnly}
                        />
                      </div>
                    );
                  })}
                </div>
              ))}
            </section>

            <section style={S.section}>
              <button
                type="button"
                onClick={() => setShowAdvanced(v => !v)}
                style={S.toggleAdvanced}
              >
                {showAdvanced ? '▾' : '▸'} Comentarios o sugerencias generales (opcional)
              </button>
              {showAdvanced && (
                <textarea
                  style={{ ...S.textarea, marginTop: 10, minHeight: 90 }}
                  placeholder="Cuéntanos cualquier cosa que quieras destacar: qué te gustó más, qué mejoraríamos, etc."
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  maxLength={2000}
                  readOnly={readOnly}
                />
              )}
            </section>

            {!readOnly && (
              <>
                <div style={S.progress}>
                  {answeredItems} de {totalItems} {totalItems === 1 ? 'punto calificado' : 'puntos calificados'}
                </div>
                {serverError && <div style={S.errorBanner}>{serverError}</div>}
                <button
                  type="submit"
                  style={{
                    ...S.submitBtn,
                    opacity: submitting ? 0.7 : 1,
                  }}
                  disabled={submitting}
                >
                  {submitting ? 'Enviando…' : 'Enviar evaluación'}
                </button>
                <p style={S.fineprint}>
                  Al enviar aceptas que el equipo de Jardines del Lago revise tus respuestas.
                </p>
              </>
            )}
          </form>
        </div>
      </main>

      <footer style={S.footer}>
        Jardines del Lago · Evaluación del cliente · Link seguro
      </footer>

      <style>{PUBLIC_CSS}</style>
    </div>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────
const S = {
  page: {
    minHeight: '100dvh',
    background: 'linear-gradient(180deg, #eef2ff 0%, #f8fafc 60%)',
    color: '#0f172a',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
    display: 'flex', flexDirection: 'column',
    WebkitTextSizeAdjust: '100%',
  },
  center: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' },
  spinner: { width: 36, height: 36, border: '3px solid #c7d2fe', borderTopColor: '#4f46e5', borderRadius: '50%', animation: 'pcpSpin 0.9s linear infinite' },
  errorIcon: { fontSize: 56, marginBottom: 12 },
  successIcon: { fontSize: 64, marginBottom: 12 },
  h1: { fontSize: 22, fontWeight: 700, margin: '0 0 8px', color: '#0f172a' },
  muted: { color: '#475569', margin: '6px 0', lineHeight: 1.5 },
  header: {
    background: '#fff',
    borderBottom: '1px solid #e2e8f0',
    padding: '12px 16px',
    position: 'sticky', top: 0, zIndex: 10,
  },
  brandRow: { display: 'flex', alignItems: 'center', gap: 12, maxWidth: 720, margin: '0 auto' },
  logo: {
    width: 40, height: 40, borderRadius: 10,
    background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  brandTitle: { fontSize: 16, fontWeight: 700, color: '#0f172a' },
  brandSubtitle: { fontSize: 12, color: '#64748b' },
  main: { flex: 1, padding: '16px 12px 32px', maxWidth: 720, width: '100%', margin: '0 auto', boxSizing: 'border-box' },
  card: { background: '#fff', borderRadius: 16, padding: 20, boxShadow: '0 1px 3px rgba(15,23,42,0.06), 0 8px 24px rgba(15,23,42,0.04)' },
  eventHeader: { marginBottom: 16, paddingBottom: 14, borderBottom: '1px solid #f1f5f9' },
  eventLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, color: '#64748b', fontWeight: 600 },
  eventName: { fontSize: 18, fontWeight: 700, marginTop: 4, color: '#0f172a' },
  eventMeta: { fontSize: 13, color: '#475569', marginTop: 6 },
  noticeReadonly: { background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', borderRadius: 10, padding: '10px 12px', marginBottom: 16, fontSize: 13 },
  intro: { color: '#475569', lineHeight: 1.55, margin: '0 0 16px', fontSize: 14 },
  section: { marginTop: 18 },
  sectionTitle: { fontSize: 14, fontWeight: 700, color: '#0f172a', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  sectionBlock: { marginTop: 16 },
  subSectionTitle: { fontSize: 14, fontWeight: 600, color: '#1e293b', margin: '0 0 8px' },
  itemCard: {
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  itemText: { fontSize: 14.5, color: '#0f172a', lineHeight: 1.4, marginBottom: 10, whiteSpace: 'pre-wrap', wordBreak: 'break-word' },
  ratingRow: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, marginBottom: 8 },
  ratingBtn: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
    padding: '8px 4px',
    background: '#fff',
    border: '1.5px solid #e2e8f0',
    borderRadius: 10,
    color: '#475569',
    fontSize: 11,
    fontWeight: 600,
    transition: 'all 0.15s ease',
    minHeight: 56,
  },
  ratingBtnActive: {
    background: '#eef2ff',
    borderColor: '#6366f1',
    color: '#3730a3',
    transform: 'scale(1.03)',
  },
  ratingEmoji: { fontSize: 22, lineHeight: 1 },
  ratingLabel: { fontSize: 10, lineHeight: 1.1, textAlign: 'center' },
  label: { display: 'block', fontSize: 13, color: '#475569', fontWeight: 600, marginBottom: 12 },
  input: {
    display: 'block', width: '100%', boxSizing: 'border-box',
    marginTop: 6, padding: '12px 14px',
    fontSize: 16, color: '#0f172a',
    background: '#fff',
    border: '1.5px solid #cbd5e1', borderRadius: 10,
    outline: 'none',
  },
  textarea: {
    display: 'block', width: '100%', boxSizing: 'border-box',
    padding: '10px 12px', fontSize: 15, color: '#0f172a',
    background: '#fff', border: '1.5px solid #cbd5e1', borderRadius: 10,
    resize: 'vertical', minHeight: 56, fontFamily: 'inherit', outline: 'none',
  },
  toggleAdvanced: {
    background: 'none', border: 'none', color: '#4f46e5',
    fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0,
  },
  progress: { fontSize: 12, color: '#64748b', marginTop: 8, textAlign: 'right' },
  errorBanner: { background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '10px 12px', borderRadius: 10, fontSize: 13, marginTop: 12 },
  submitBtn: {
    width: '100%', padding: '14px 16px', marginTop: 16,
    background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
    color: '#fff', border: 'none', borderRadius: 12,
    fontSize: 16, fontWeight: 700, cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(5, 150, 105, 0.25)',
  },
  fineprint: { fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: 10, lineHeight: 1.4 },
  footer: { textAlign: 'center', padding: '14px 12px 24px', fontSize: 11, color: '#94a3b8' },
};

const PUBLIC_CSS = `
@keyframes pcpSpin { to { transform: rotate(360deg); } }
@media (min-width: 640px) {
  .pcp-card-padding-fix { padding: 28px !important; }
}
`;
