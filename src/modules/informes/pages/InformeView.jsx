import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getInformeById, getImagenes, imagenUrl, marcarInformeLeido, updateDiaMenuItemNotas } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import ColaboracionPanel from '../components/ColaboracionPanel.jsx';
import { IconArrowLeft, IconPrinter, IconDownload, IconFileText, IconMessageCircle, IconCheckCircle, IconX } from '../components/Icons.jsx';


const TIEMPOS_COMIDA = [
  { id: 'estacion',     label: 'Estación',    icon: '🏛️' },
  { id: 'desayuno',    label: 'Desayuno',    icon: '🌅' },
  { id: 'refaccion_am', label: 'Refacción AM', icon: '🥐' },
  { id: 'almuerzo',    label: 'Almuerzo',    icon: '🍽️' },
  { id: 'refaccion_pm', label: 'Refacción PM', icon: '🧁' },
  { id: 'postre',      label: 'Postre',      icon: '🍰' },
  { id: 'cena',        label: 'Cena',        icon: '🌙' },
];

const TIEMPO_COMIDA_ORDER = {
  estacion: 1,
  desayuno: 2,
  refaccion_am: 3,
  almuerzo: 4,
  refaccion_pm: 5,
  postre: 6,
  cena: 7,
};

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
  const params = (() => { try { return useParams(); } catch { return {}; } })();
  const { id } = params;
  let navigate;
  try {
    navigate = useNavigate();
  } catch (_err) {
    navigate = (path) => { window.location.href = path; };
  }
  const toast = useToast();
  const { user } = useAuth();
  const { connected: socketConnected, joinRoom, leaveRoom } = useSocket();
  const [informe, setInforme] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [colabOpen, setColabOpen] = useState(true);
  const [imagenes, setImagenes] = useState([]);
  const [editingNotaId, setEditingNotaId] = useState(null);
  const [editingNotaValue, setEditingNotaValue] = useState('');
  const [savingNotaId, setSavingNotaId] = useState(null);
  const savingNotaRef = useRef(false);
  const notaInputRef = useRef(null);
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
    return () => { leaveRoom(room); };
  }, [socketConnected, informe?.id_ocupacion, id, joinRoom, leaveRoom]);

  // ─── Inline edit de notas ───
  const startEditNota = (itemId, currentNotas) => {
    setEditingNotaId(itemId);
    setEditingNotaValue(currentNotas || '');
    setTimeout(() => {
      if (notaInputRef.current) notaInputRef.current.focus();
    }, 50);
  };

  const saveNotaEdit = async (itemId) => {
    // Evitar guardar si ya se canceló o ya hay un guardado en curso
    if (editingNotaId !== itemId || savingNotaRef.current) return;
    savingNotaRef.current = true;
    const value = editingNotaValue.trim();
    setSavingNotaId(itemId);
    try {
      await updateDiaMenuItemNotas(itemId, value);
      // Actualizar localmente las notas en el estado
      setInforme(prev => {
        if (!prev) return prev;
        const newDias = prev.dias.map(dia => ({
          ...dia,
          items: (dia.items || []).map(item =>
            item.id === itemId ? { ...item, notas: value || null } : item
          ),
        }));
        return { ...prev, dias: newDias };
      });
      toast.success('Nota actualizada');
    } catch (err) {
      toast.error('Error al guardar nota: ' + (err.message || ''));
    } finally {
      savingNotaRef.current = false;
      setEditingNotaId(null);
      setEditingNotaValue('');
      setSavingNotaId(null);
    }
  };

  const cancelEditNota = () => {
    setEditingNotaId(null);
    setEditingNotaValue('');
  };

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

      // Esperar a que se carguen todas las imágenes dentro del documento para evitar ancho/alto de 0 en el canvas
      const imgs = Array.from(el.querySelectorAll('img')).filter(img => !img.complete);
      if (imgs.length > 0) {
        await Promise.race([
          Promise.all(imgs.map(img => new Promise(r => { img.onload = r; img.onerror = r; }))),
          new Promise(r => setTimeout(r, 5000)) // timeout de 5 segundos máximo
        ]);
      }

      const canvas = await html2canvas(el, { 
        scale: 2, 
        backgroundColor: '#ffffff', 
        logging: false,
        useCORS: true 
      });
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
      // Generar nombre de archivo descriptivo (institución o encargado + no. cotización)
      const cleanString = (str) => {
        return str
          ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9-_]/g, "_")
          : "";
      };
      const namePart = cleanString(informe.Institucion || informe.EncargadoEvento || "");
      const docPart = cleanString(informe.NoDoc || id);
      const filename = `informe_${namePart}_${docPart}.pdf`.replace(/_+/g, "_").replace(/_$/, "").toLowerCase();

      pdf.save(filename);
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

  const formatFechaDia = (fechaStr) => {
    if (!fechaStr) return 'Fecha no asignada';
    const cleanFecha = String(fechaStr).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanFecha)) return 'Fecha no asignada';
    const date = new Date(cleanFecha + 'T12:00:00');
    if (isNaN(date.getTime())) return 'Fecha no asignada';
    
    const formatted = date.toLocaleDateString('es-ES', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
    
    // Capitalizar la primera letra
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  };

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
        .iv-imagenes {
          display: grid !important;
          grid-template-columns: repeat(3, 1fr) !important;
          gap: 0.25in !important;
          page-break-before: always !important;
          break-before: page !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
        .iv-imagen-item {
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          justify-content: flex-start !important;
          width: 100% !important;
          height: auto !important;
          border: 1px solid #ccc !important;
          border-radius: 4px !important;
          margin: 0 !important;
          padding: 0.15in !important;
          background: #f8f8f8 !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
        .iv-imagen-item:nth-child(6n) {
          page-break-after: always !important;
          break-after: page !important;
        }
        .iv-imagen-item:nth-child(6n+1) {
          page-break-before: always !important;
          break-before: page !important;
        }
        .iv-imagen-item:nth-child(1) {
          page-break-before: auto !important;
          break-before: auto !important;
        }
        .iv-imagen-item img {
          max-width: 100% !important;
          max-height: 2.5in !important;
          width: auto !important;
          height: auto !important;
          display: block !important;
          object-fit: contain !important;
        }
        .iv-imagen-desc {
          padding: 0.1in 0 0 0 !important;
          font-size: 8pt !important;
          text-align: center !important;
          font-style: italic !important;
          line-height: 1.2 !important;
        }
      `}</style>
      <div className="informe-print-container">
        {/* ─── BARRA DE ACCIONES (no se imprime) ─── */}
        <div className="no-print actions-bar">
          <button onClick={() => navigate(-1)} className="btn-secondary" data-tooltip="Volver">
            <IconArrowLeft size={16} /> <span className="btn-text">Volver</span>
          </button>
          <button onClick={handleExportPDF} className="btn-success" disabled={pdfLoading} data-tooltip="Descargar como PDF">
            <IconDownload size={16} /> <span className="btn-text">{pdfLoading ? 'Generando...' : 'Exportar PDF'}</span>
          </button>
          <button onClick={handlePrint} className="btn-primary" data-tooltip="Imprimir informe">
            <IconPrinter size={16} /> <span className="btn-text">Imprimir</span>
          </button>
          <button onClick={() => setColabOpen(!colabOpen)}
            className={`btn-secondary ${colabOpen ? 'colab-toggle-active' : ''}`}
            data-tooltip={colabOpen ? 'Ocultar panel' : 'Mostrar panel de colaboración'}>
            <IconMessageCircle size={16} /> <span className="btn-text">Colaborar</span>
          </button>
          {user && ['Admin','Vendedor','FrontOffice','Eventos'].includes(user.rol) && (
            <button onClick={() => navigate(`/informe/pos/${informe.id_ocupacion}`)} className="btn-secondary" data-tooltip="Editar informe">
              <IconFileText size={16} /> <span className="btn-text">Editar</span>
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

                  </div>
                  <div className="iv-divider" />
                </header>

                {/* ═══ DATOS DEL EVENTO ═══ */}
                <section className="iv-header-table">
                  <table>
                    <tbody>
                      <tr>
                        <td className="iv-ht-label">Encargado Evento</td>
                        <td className="iv-ht-value">{informe.EncargadoEvento || '-'}</td>
                        <td className="iv-ht-label">No Cotización</td>
                        <td className="iv-ht-value">
                          {informe.NoDoc || '-'}
                          {informe.fecha_creacion && <span className="iv-ht-sub">{fechaCreacion}</span>}
                        </td>
                      </tr>
                      <tr>
                        <td className="iv-ht-label">Horario</td>
                        <td className="iv-ht-value">{informe.HoraI || '-'}{informe.HoraF ? ` - ${informe.HoraF}` : ''}</td>
                        <td className="iv-ht-label">Teléfono</td>
                        <td className="iv-ht-value">{informe.Telefono || '-'}</td>
                      </tr>
                      <tr>
                        <td className="iv-ht-label">Institución</td>
                        <td className="iv-ht-value">{informe.Institucion}</td>
                        <td className="iv-ht-label">Fecha Evento</td>
                        <td className="iv-ht-value">{dia.fecha_evento ? formatFechaDia(dia.fecha_evento) : '-'}</td>
                      </tr>
                      <tr>
                        <td className="iv-ht-label">Salón / Área</td>
                        <td className="iv-ht-value">{informe.Salon || '-'}</td>
                        <td className="iv-ht-label">No Pax</td>
                        <td className="iv-ht-value">{informe.Pax || '-'}</td>
                      </tr>
                      <tr>
                        <td className="iv-ht-label">Vendedor</td>
                        <td className="iv-ht-value">{informe.Vendedor || '-'}</td>
                        <td className="iv-ht-label">No Folio</td>
                        <td className="iv-ht-value">{informe.folio || '-'}</td>
                      </tr>
                    </tbody>
                  </table>
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
                  {(() => {
                    try {
                      const p = typeof dia.descripcion_montaje === 'string' ? JSON.parse(dia.descripcion_montaje) : (dia.descripcion_montaje || {});
                      if (p && p._v === 2 && p.tiempo_comida) {
                        const tc = TIEMPOS_COMIDA.find(t => t.id === p.tiempo_comida);
                        return tc ? <span className="iv-day-tc-badge">{tc.icon} {tc.label}</span> : null;
                      }
                    } catch {}
                    return null;
                  })()}
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
                      {(() => {
                        let itemsTc = [];
                        try {
                          const p = typeof dia.descripcion_montaje === 'string' ? JSON.parse(dia.descripcion_montaje) : (dia.descripcion_montaje || {});
                          if (p && p._v === 2) itemsTc = p.items_tiempo_comida || [];
                        } catch {}
                        return agruparItemsPorTiempoComida(dia.items, itemsTc).map((grupo, gi) => (
                          <div key={gi} className="iv-grupo">
                            <div className="iv-grupo-label">{grupo.grupoIcon} {grupo.grupoLabel}</div>
                            <div className="iv-grupo-items">
                              {grupo.items.map((item, ii) => (
                                <div key={ii} className="iv-item-row">
                                  <span className="iv-item-nombre">{item.ingrediente_nombre}</span>
                                  {(() => {
                                    const tipoItem = (item.ingrediente_tipo || '').toLowerCase();
                                    const esProteina = tipoItem === 'carne' || tipoItem === 'proteina' || tipoItem === 'proteína' || tipoItem === 'proteinas' || tipoItem === 'proteínas';
                                    if (esProteina && item.cantidad_total) {
                                      return <span className="iv-item-qty">Cantidad: {item.cantidad_total}</span>;
                                    }
                                    return null;
                                  })()}
                                  {item.metodo_preparacion && (
                                    <span className="iv-item-prep">Preparación: {item.metodo_preparacion}</span>
                                  )}
                                  {item.opcion_nombre && (
                                    <span className="iv-item-opc">{item.opcion_nombre}</span>
                                  )}
                                  {editingNotaId === item.id ? (
                                    <span className="iv-item-notes iv-item-notes-editing">
                                      <input
                                        ref={notaInputRef}
                                        type="text"
                                        className="iv-nota-input"
                                        value={editingNotaValue}
                                        onChange={e => setEditingNotaValue(e.target.value)}
                                        onKeyDown={e => {
                                          if (e.key === 'Enter') { e.preventDefault(); saveNotaEdit(item.id); }
                                          if (e.key === 'Escape') cancelEditNota();
                                        }}
                                        onBlur={() => saveNotaEdit(item.id)}
                                        placeholder="Escribe una nota..."
                                        disabled={savingNotaId === item.id}
                                      />
                                      {savingNotaId === item.id ? (
                                        <span className="iv-nota-saving">…</span>
                                      ) : (
                                        <>
                                          <button className="iv-nota-btn" onMouseDown={e => { e.preventDefault(); saveNotaEdit(item.id); }} data-tooltip="Guardar">
                                            <IconCheckCircle size={12} />
                                          </button>
                                          <button className="iv-nota-btn iv-nota-btn-cancel" onMouseDown={e => { e.preventDefault(); cancelEditNota(); }} data-tooltip="Cancelar">
                                            <IconX size={12} />
                                          </button>
                                        </>
                                      )}
                                    </span>
                                  ) : (
                                    <span
                                      className={`iv-item-notes ${user && ['Admin','Vendedor','FrontOffice'].includes(user.rol) ? 'iv-item-notes-editable' : ''}`}
                                      onClick={() => {
                                        if (user && ['Admin','Vendedor','FrontOffice'].includes(user.rol)) {
                                          startEditNota(item.id, item.notas || '');
                                        }
                                      }}
                                      title={user && ['Admin','Vendedor','FrontOffice'].includes(user.rol) ? 'Click para editar' : ''}
                                    >
                                      📝 {item.notas}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                  </>
                )}

                {/* Comentarios del Menú */}
                {dia.comentario_menu && (
                  <div className="iv-menu-comentario" style={{
                    marginTop:'0.75rem', padding:'0.6rem 0.8rem',
                    background:'var(--bg-elevated, #f8f9fa)',
                    borderLeft:'3px solid var(--primary, #6366f1)',
                    borderRadius:'0 6px 6px 0',
                    fontSize:'0.82rem', lineHeight:1.5,
                    color:'var(--text-primary)',
                  }}>
                    <div style={{
                      fontSize:'0.68rem', fontWeight:700, textTransform:'uppercase',
                      letterSpacing:'0.04em', color:'var(--text-muted)',
                      marginBottom:'0.25rem',
                    }}>
                      💬 Comentarios del Menú
                    </div>
                    <div style={{whiteSpace:'pre-wrap'}}>{dia.comentario_menu}</div>
                  </div>
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
                    </div>
                  );

                  const renderMontajeComentarios = (m, idx) => {
                    if (!m.observaciones) return null;
                    return (
                      <div key={`com-${idx}`} className="iv-montaje-comentario" style={{
                        marginTop:'0.75rem', padding:'0.6rem 0.8rem',
                        background:'var(--bg-elevated, #f8f9fa)',
                        borderLeft:'3px solid var(--warning, #f59e0b)',
                        borderRadius:'0 6px 6px 0',
                        fontSize:'0.82rem', lineHeight:1.5,
                        color:'var(--text-primary)',
                      }}>
                        <div style={{
                          fontSize:'0.68rem', fontWeight:700, textTransform:'uppercase',
                          letterSpacing:'0.04em', color:'var(--text-muted)',
                          marginBottom:'0.25rem',
                        }}>
                          💬 Comentarios del Montaje
                        </div>
                        <div style={{whiteSpace:'pre-wrap'}}>{m.observaciones}</div>
                      </div>
                    );
                  };

                  return (
                    <div className="iv-montaje-section">
                      <div className="iv-section-divider">
                        <span className="iv-section-label">Montaje</span>
                      </div>
                      {montajes.length === 1
                        ? <>{renderMontajeGrid(montajes[0], 0)}{renderMontajeComentarios(montajes[0], 0)}</>
                        : montajes.map((m, mi) => (
                            <div key={mi} className="iv-montaje-multi">
                              <div className="iv-montaje-multi-header">
                                <span className="iv-montaje-multi-salon">🏛️ {m.salon || `Salón ${mi + 1}`}</span>
                              </div>
                              {renderMontajeGrid(m, mi)}
                              {renderMontajeComentarios(m, mi)}
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

// ─── Helper: agrupar items por tiempo de comida ───
function agruparItemsPorTiempoComida(items, itemsTc) {
  const grupos = {};
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const tcId = itemsTc && i < itemsTc.length ? itemsTc[i] : null;
    const key = tcId && TIEMPO_COMIDA_ORDER[tcId] ? tcId : '__sin_asignar';
    if (!grupos[key]) grupos[key] = [];
    grupos[key].push(item);
  }
  const resultado = [];
  for (const tc of TIEMPOS_COMIDA) {
    if (grupos[tc.id] && grupos[tc.id].length > 0) {
      resultado.push({ grupoLabel: tc.label, grupoIcon: tc.icon, items: grupos[tc.id] });
      delete grupos[tc.id];
    }
  }
  if (grupos['__sin_asignar'] && grupos['__sin_asignar'].length > 0) {
    resultado.push({ grupoLabel: 'Sin asignar', grupoIcon: '📌', items: grupos['__sin_asignar'] });
  }
  return resultado;
}
