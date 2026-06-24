import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getInformeById, getImagenes, imagenUrl, marcarInformeLeido } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import ColaboracionPanel from '../components/ColaboracionPanel.jsx';
import { IconArrowLeft, IconPrinter, IconDownload, IconFileText, IconMessageCircle } from '../components/Icons.jsx';

const TIPO_LABELS = {
  proteina:     'PROTEÍNA',
  guarnicion:   'GUARNICIÓN',
  guarnición:   'GUARNICIÓN',
  salsa:        'SALSA',
  postre:       'POSTRE',
  tortilla_pan: 'TORTILLA / PAN',
  bebida:       'BEBIDA',
  otros:        'OTROS',
};

const TIPO_OPTS_ORDER = ['proteina', 'guarnicion', 'guarnición', 'salsa', 'postre', 'tortilla_pan', 'bebida', 'otros'];

const ALERTAS_PREDEFINIDAS = [
  { label: 'Sin Gluten', emoji: '🌾' },
  { label: 'Sin Lactosa', emoji: '🥛' },
  { label: 'Vegano', emoji: '🌱' },
  { label: 'Vegetariano', emoji: '🥗' },
  { label: 'Alérgeno', emoji: '⚠️' },
  { label: 'Sin Azúcar', emoji: '🍬' },
  { label: 'Bajo en Sodio', emoji: '🧂' },
];

export default function InformeView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const { connected: socketConnected, onEvent, joinRoom, leaveRoom } = useSocket();
  const [informe, setInforme] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [colabOpen, setColabOpen] = useState(true);
  const [imagenes, setImagenes] = useState([]);
  const docRef = useRef(null);

  useEffect(() => {
    const loadInforme = async () => {
      try {
        const data = await getInformeById(id);
        setInforme(data);
        if (data?.id) {
          getImagenes(data.id).then(setImagenes).catch(() => {});
          // Auto-marcar como leído al entrar al informe
          marcarInformeLeido(data.id).catch(() => {});
          
        }
      } catch (err) {
        if (err.status === 404 || err.message?.includes('no encontrado')) {
          setError('No hay informe creado para este evento');
        } else {
          setError('No se pudo cargar el informe: ' + err.message);
        }
      } finally {
        setLoading(false);
      }
    };
    loadInforme();
  }, [id]);

  useEffect(() => {
    if (!socketConnected || !informe?.id_ocupacion) return;
    const room = `evento:${informe.id_ocupacion}`;
    joinRoom(room);
    const cleanup = onEvent('informe:created', () => {
      if (informe?.id) getInformeById(id).then(setInforme).catch(() => {});
    });
    return () => { cleanup(); leaveRoom(room); };
  }, [socketConnected, informe?.id_ocupacion, id, onEvent, joinRoom, leaveRoom]);

  const handlePrint = async () => {
    // Esperar a que todas las imágenes carguen antes de imprimir
    const imgs = Array.from(document.images).filter(img => !img.complete);
    if (imgs.length > 0) {
      await Promise.race([
        Promise.all(imgs.map(img => new Promise(r => { img.onload = r; img.onerror = r; }))),
        new Promise(r => setTimeout(r, 5000)),
      ]);
    }
    await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 2000))]);
    await new Promise(r => setTimeout(r, 500));
    window.print();
  };

  const handleExportPDF = async () => {
    setPdfLoading(true);
    try {
      const { default: html2canvas } = await import('html2canvas');
      const { default: jsPDF } = await import('jspdf');
      const el = docRef.current;
      if (!el) return;
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', logging: false });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = (canvas.height * pdfW) / canvas.width;
      let heightLeft = pdfH;
      let position = 0;
      const pageH = pdf.internal.pageSize.getHeight();
      pdf.addImage(imgData, 'PNG', 0, position, pdfW, pdfH);
      heightLeft -= pageH;
      while (heightLeft > 0) {
        position -= pageH;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfW, pdfH);
        heightLeft -= pageH;
      }
      pdf.save(`informe-${id}.pdf`);
    } catch (err) {
      console.error('Error al exportar PDF:', err);
      toast.error('Error al generar el PDF. Intenta usar la opción Imprimir.');
    } finally {
      setPdfLoading(false);
    }
  };

  if (loading) return <p className="status-message">Cargando informe...</p>;
  if (error) return <p className="status-message status-error">{error}</p>;
  if (!informe) return <p className="status-message">Informe no encontrado.</p>;

  const fechaCreacion = new Date(informe.fecha_creacion).toLocaleDateString('es-ES', {
    day: 'numeric', month: 'long', year: 'numeric'
  });

  return (
    <div className={`informe-view-layout ${colabOpen ? 'colab-open' : ''}`}>
      <style media="print">{`
        html, body, body.informes-theme, #root, .reports-root, .app-shell, .informes-shell, main, .informe-view-layout, .informe-print-container {
          background: #ffffff !important;
          background-color: #ffffff !important;
          background-image: none !important;
          min-height: 0 !important;
          height: auto !important;
        }
        body > :not(#root),
        #root > :not(.reports-root),
        .reports-root > :not(main),
        main > :not(.informe-view-layout),
        .informe-view-layout > :not(.informe-print-container),
        .informe-print-container > :not(.iv-documento) {
          display: none !important;
        }
        .mobile-hamburger-btn,
        .mobile-drawer-backdrop,
        .no-print,
        .actions-bar,
        .colab-sidebar,
        .app-header,
        .app-nav {
          display: none !important;
        }
        .iv-documento {
          box-shadow: none !important;
          padding: 0 !important;
          margin: 0 auto !important;
          width: 100% !important;
          max-width: 100% !important;
          height: auto !important;
          min-height: 0 !important;
          border: none !important;
          background: #ffffff !important;
          background-color: #ffffff !important;
        }
      `}</style>
      <div className="informe-print-container">
        {/* ─── BARRA DE ACCIONES (no se imprime) ─── */}
        <div className="no-print actions-bar">
          <button onClick={() => navigate(-1)} className="btn-secondary" data-tooltip="Volver">
            <IconArrowLeft size={16} /> Volver
          </button>
          <button onClick={handleExportPDF} className="btn-success" disabled={pdfLoading} data-tooltip="Descargar como PDF">
            <IconDownload size={16} /> {pdfLoading ? 'Generando...' : 'Exportar PDF'}
          </button>
          <button onClick={handlePrint} className="btn-primary" data-tooltip="Imprimir informe">
            <IconPrinter size={16} /> Imprimir
          </button>
          <button onClick={() => setColabOpen(!colabOpen)}
            className={`btn-secondary ${colabOpen ? 'colab-toggle-active' : ''}`}
            data-tooltip={colabOpen ? 'Ocultar panel' : 'Mostrar panel de colaboración'}>
            <IconMessageCircle size={16} /> Colaborar
          </button>
          {user && ['Admin','Vendedor','FrontOffice','Eventos'].includes(user.rol) && (
            <button onClick={() => navigate(`/informe/pos/${informe.id_ocupacion}`)} className="btn-secondary" data-tooltip="Editar informe">
              <IconFileText size={16} /> Editar
            </button>
          )}
        </div>

        {/* ─── DOCUMENTO FORMAL ─── */}
        <div className="iv-documento" ref={docRef}>
          {/* ─── DÍAS (cada uno con encabezado completo) ─── */}
          {informe.dias.length > 0 ? (
            informe.dias.map((dia, index) => (
              <div key={index} className="iv-day-block">
                {/* ═══ ENCABEZADO COMPLETO POR DÍA ═══ */}
                <header className="iv-header">
                  <div className="iv-header-top">
                    <div className="iv-header-left" style={{display:'flex', alignItems:'center', gap:'1rem'}}>
                      <img src="/logo.png" alt="JDL" style={{height:'48px', width:'auto', filter:'invert(1)', opacity:0.85}} />
                      <div>
                        <h1 className="iv-title">INFORME DE EVENTO</h1>
                        <p className="iv-subtitle">Sistema de Gestión de Informes</p>
                      </div>
                    </div>
                    <div className="iv-header-right" style={{display:'flex', flexDirection:'column', alignItems:'flex-end', gap:'0.3rem'}}>
                      {informe.version && <div className="iv-badge" style={{background:'var(--success)'}}>v{informe.version}</div>}
                      <div className="iv-badge">#{id}</div>
                      <p className="iv-date" style={{marginTop:'0.1rem'}}>{fechaCreacion}</p>
                    </div>
                  </div>
                  <div className="iv-divider" />
                  <div className="iv-event-name">{informe.Institucion}</div>
                </header>

                {/* ═══ DATOS DEL EVENTO ═══ */}
                <section className="iv-info-grid">
                  <div className="iv-info-item">
                    <span className="iv-info-label">Institución</span>
                    <span className="iv-info-value">{informe.Institucion}</span>
                  </div>
                  <div className="iv-info-item">
                    <span className="iv-info-label">Pax</span>
                    <span className="iv-info-value iv-info-value-lg">{informe.Pax}</span>
                  </div>
                  <div className="iv-info-item">
                    <span className="iv-info-label">Salón</span>
                    <span className="iv-info-value">{informe.Salon || 'No asignado'}</span>
                  </div>
                  <div className="iv-info-item">
                    <span className="iv-info-label">Tipo de Evento</span>
                    <span className="iv-info-value">{informe.TipoEvento || 'N/A'}</span>
                  </div>
                  {informe.Vendedor && (
                    <div className="iv-info-item">
                      <span className="iv-info-label">Vendedor</span>
                      <span className="iv-info-value">{informe.Vendedor}</span>
                    </div>
                  )}
                  {informe.EncargadoEvento && (
                    <div className="iv-info-item">
                      <span className="iv-info-label">Encargado</span>
                      <span className="iv-info-value">{informe.EncargadoEvento}</span>
                    </div>
                  )}
                  {informe.HoraI && (
                    <div className="iv-info-item">
                      <span className="iv-info-label">Horario</span>
                      <span className="iv-info-value">
                        {informe.HoraI}{informe.HoraF ? ` - ${informe.HoraF}` : ''}
                      </span>
                    </div>
                  )}
                  {informe.NoDoc && (
                    <div className="iv-info-item">
                      <span className="iv-info-label">No. Cotización</span>
                      <span className="iv-info-value">{informe.NoDoc}</span>
                    </div>
                  )}
                </section>

                {/* ═══ ALERTAS / RESTRICCIONES ═══ */}
                {(() => {
                  let alertas = [];
                  let alertaCustom = '';
                  if (dia.descripcion_montaje) {
                    try {
                      const parsed = typeof dia.descripcion_montaje === 'string' ? JSON.parse(dia.descripcion_montaje) : dia.descripcion_montaje;
                      if (parsed && parsed._v === 2) {
                        alertas = parsed.alertas || [];
                        alertaCustom = parsed.alertaCustom || '';
                      }
                    } catch { /* ignore */ }
                  }
                  const todas = [...alertas, ...(alertaCustom ? [alertaCustom] : [])];
                  if (todas.length === 0) return null;
                  return (
                    <div className="iv-alertas-banner">
                      {todas.map((a, i) => {
                        const def = ALERTAS_PREDEFINIDAS.find(p => p.label === a);
                        return (
                          <span key={i} className={`iv-alerta-chip ${def ? '' : 'iv-alerta-chip-custom'}`}>
                            {def ? `${def.emoji} ${def.label}` : `⚠️ ${a}`}
                          </span>
                        );
                      })}
                    </div>
                  );
                })()}

                {/* ═══ TÍTULO DEL DÍA ═══ */}
                <div className="iv-day-header">
                  <span className="iv-day-num">DÍA {index + 1}</span>
                  <span className="iv-day-fecha">
                    {(() => {
                      if (!dia.fecha_evento) return 'Fecha no asignada';
                      const fechaStr = dia.fecha_evento;
                      const fechaDate = fechaStr.length <= 10
                        ? new Date(fechaStr + 'T12:00:00')
                        : new Date(fechaStr);
                      if (isNaN(fechaDate.getTime())) return 'Fecha no asignada';
                      return fechaDate.toLocaleDateString('es-ES', {
                        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
                      });
                    })()}
                  </span>
                </div>

                {/* ═══ SECCIÓN: MENÚ ═══ */}
                {dia.items && dia.items.length > 0 && (
                  <>
                    <div className="iv-section-divider">
                      <span className="iv-section-label">Menú</span>
                      {dia.nombre_menu && (
                        <span style={{
                          fontSize:'0.72rem', fontWeight:600,
                          color:'var(--text-secondary)', marginLeft:'0.5rem'
                        }}>
                          {dia.nombre_menu}
                          {dia.categoria_nombre && (
                            <span style={{
                              fontSize:'0.6rem',padding:'0.05rem 0.3rem',
                              borderRadius:'var(--radius-full)',background:'var(--primary-bg)',
                              color:'var(--primary)',fontWeight:600,marginLeft:'0.3rem',
                              verticalAlign:'middle'
                            }}>
                              {dia.categoria_nombre}
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                    <div className="iv-items-section">
                      {agruparItems(dia.items).map((grupo, gi) => (
                        <div key={gi} className="iv-grupo">
                          <div className="iv-grupo-label">{grupo.tipoLabel}</div>
                          <div className="iv-grupo-items">
                            {grupo.items.map((item, ii) => (
                              <div key={ii} className="iv-item-row">
                                <span className="iv-item-nombre">{item.ingrediente_nombre}</span>
                                {item.cantidad_total && (
                                  <span className="iv-item-qty">×{item.cantidad_total}</span>
                                )}
                                {item.metodo_preparacion && (
                                  <span className="iv-item-prep">Preparación: {item.metodo_preparacion}</span>
                                )}
                                {item.opcion_nombre && (
                                  <span className="iv-item-opc">{item.opcion_nombre}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* Sin items */}
                {(!dia.items || dia.items.length === 0) && (
                  <div className="iv-section-divider">
                    <span className="iv-section-label">Sin platillo asignado</span>
                  </div>
                )}

                {/* ═══ SECCIÓN: MONTAJE ═══ */}
                {(() => {
                  let montajes = [];
                  if (dia.descripcion_montaje) {
                    try {
                      const parsed = typeof dia.descripcion_montaje === 'string' ? JSON.parse(dia.descripcion_montaje) : dia.descripcion_montaje;
                      if (parsed && parsed._v === 2) {
                        montajes = parsed.montajes || [];
                      } else {
                        montajes = Array.isArray(parsed) ? parsed : (parsed && Object.keys(parsed).length > 0 ? [parsed] : []);
                      }
                    } catch { montajes = []; }
                  }
                  if (!montajes || montajes.length === 0) return null;

                  const renderMontajeGrid = (m, mIdx) => (
                    <div key={mIdx} className="iv-montaje-grid">
                      {m.salon && (
                        <div className="iv-montaje-item iv-montaje-item-full">
                          <span className="iv-montaje-label">Salón</span>
                          <span className="iv-montaje-value iv-montaje-value-salon">🏛️ {m.salon}</span>
                        </div>
                      )}
                      {m.tipo_montaje && (
                        <div className="iv-montaje-item">
                          <span className="iv-montaje-label">Tipo de Montaje</span>
                          <span className="iv-montaje-value">{m.tipo_montaje}</span>
                        </div>
                      )}
                      {m.num_personas && (
                        <div className="iv-montaje-item">
                          <span className="iv-montaje-label">Personas</span>
                          <span className="iv-montaje-value">{m.num_personas}</span>
                        </div>
                      )}
                      {m.horario && (
                        <div className="iv-montaje-item">
                          <span className="iv-montaje-label">Horario</span>
                          <span className="iv-montaje-value">{m.horario}</span>
                        </div>
                      )}
                      {m.equipo_necesario && (
                        <div className="iv-montaje-item iv-montaje-item-full">
                          <span className="iv-montaje-label">Equipo</span>
                          <div className="iv-montaje-chips">
                            {m.equipo_necesario.split(',').map(s => s.trim()).filter(Boolean).map((item, i) => (
                              <span key={i} className="iv-montaje-chip">🔧 {item}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {m.manteleria && (
                        <div className="iv-montaje-item">
                          <span className="iv-montaje-label">Mantelería</span>
                          <span className="iv-montaje-value">{m.manteleria}</span>
                        </div>
                      )}
                      {m.cristaleria && (
                        <div className="iv-montaje-item">
                          <span className="iv-montaje-label">Cristalería</span>
                          <span className="iv-montaje-value">{m.cristaleria}</span>
                        </div>
                      )}
                      {m.mesas && (
                        <div className="iv-montaje-item iv-montaje-item-full">
                          <span className="iv-montaje-label">Mesas</span>
                          <div className="iv-montaje-chips">
                            {m.mesas.split(',').map(s => s.trim()).filter(Boolean).map((item, i) => (
                              <span key={i} className="iv-montaje-chip">🪟 {item}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {m.sillas && (
                        <div className="iv-montaje-item iv-montaje-item-full">
                          <span className="iv-montaje-label">Sillas</span>
                          <div className="iv-montaje-chips">
                            {m.sillas.split(',').map(s => s.trim()).filter(Boolean).map((item, i) => (
                              <span key={i} className="iv-montaje-chip">🪑 {item}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {m.observaciones && (
                        <div className="iv-montaje-item iv-montaje-item-full">
                          <span className="iv-montaje-label">Observaciones</span>
                          <span className="iv-montaje-obs">{m.observaciones}</span>
                        </div>
                      )}
                    </div>
                  );

                  return (
                    <div className="iv-montaje-section">
                      <div className="iv-section-divider">
                        <span className="iv-section-label">Montaje</span>
                      </div>
                      {montajes.length === 1
                        ? renderMontajeGrid(montajes[0], 0)
                        : montajes.map((m, mi) => (
                            <div key={mi} className="iv-montaje-multi">
                              <div className="iv-montaje-multi-header">
                                <span className="iv-montaje-multi-salon">🏛️ {m.salon || `Salón ${mi + 1}`}</span>
                              </div>
                              {renderMontajeGrid(m, mi)}
                            </div>
                          ))
                      }
                    </div>
                  );
                })()}
              </div>
            ))
          ) : (
            <p className="iv-empty-msg">No hay detalles de días registrados.</p>
          )}

          {/* ─── IMÁGENES DE REFERENCIA (al final de todos los días) ─── */}
          {imagenes.length > 0 && (
            <section className="iv-imagenes" style={{marginTop:'1.5rem'}}>
              {imagenes.map(img => (
                <div key={img.id} className="iv-imagen-item">
                  <img src={imagenUrl(img.url)} alt={img.descripcion || ''} />
                  {img.descripcion && <div className="iv-imagen-desc">{img.descripcion}</div>}
                </div>
              ))}
            </section>
          )}
        </div>
      </div>

      {/* ─── SIDEBAR COLABORACIÓN ─── */}
      {colabOpen && (
        <aside className="colab-sidebar">
          <div className="colab-sidebar-header">
            <h3><IconMessageCircle size={16} /> Colaboración</h3>
            <button className="btn-ghost btn-sm" onClick={() => setColabOpen(false)}>✕</button>
          </div>
          <ColaboracionPanel informeId={informe?.id} />
        </aside>
      )}
    </div>
  );
}

// ─── Helper: agrupar items por tipo ───
function agruparItems(items) {
  const grupos = {};
  for (const item of items) {
    const tipo = item.ingrediente_tipo || 'otros';
    if (!grupos[tipo]) grupos[tipo] = [];
    grupos[tipo].push(item);
  }
  const resultado = [];
  for (const t of TIPO_OPTS_ORDER) {
    if (grupos[t] && grupos[t].length > 0) {
      resultado.push({ tipo: t, tipoLabel: TIPO_LABELS[t] || t.toUpperCase(), items: grupos[t] });
      delete grupos[t];
    }
  }
  for (const t of Object.keys(grupos)) {
    if (grupos[t].length > 0) {
      resultado.push({ tipo: t, tipoLabel: t.toUpperCase(), items: grupos[t] });
    }
  }
  return resultado;
}
