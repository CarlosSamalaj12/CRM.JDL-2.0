import { useEffect, useState, useRef, useContext, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { getInformeById, getImagenes, imagenUrl, marcarInformeLeido, updateDiaMenuItemNotas } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import { InformeActionsContext } from '../components/ReportsLayout.jsx';
import ColaboracionPanel from '../components/ColaboracionPanel.jsx';
import { IconArrowLeft, IconPrinter, IconDownload, IconFileText, IconMessageCircle, IconCheckCircle, IconX, IconEdit } from '../components/Icons.jsx';
import { TIEMPOS_COMIDA } from '../constants/tiemposComida.js';
import { loadState as loadCrmState } from '../../../services/stateService.js';

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
  const [searchParams] = useSearchParams();
  const highlightComentarioId = searchParams.get('highlightComentario') || null;
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
  const actionsBarRef = useRef(null);
  const { setInformeActions } = useContext(InformeActionsContext) || {};

  // Orden personalizado de tiempos de comida (informe_tiempos_orden en DB)
  const [customTiempoComidaOrder, setCustomTiempoComidaOrder] = useState(null);

  useEffect(() => {
    const loadConfig = async (opts = {}) => {
      try {
        const state = await loadCrmState(opts);
        setCustomTiempoComidaOrder(state?.informe_tiempos_orden || null);
      } catch {
        setCustomTiempoComidaOrder(null);
      }
    };
    loadConfig();
    const handleStateUpdate = () => loadConfig({ cacheBust: true });
    window.addEventListener('stateUpdated', handleStateUpdate);
    const handleVisibility = () => { if (!document.hidden) loadConfig({ cacheBust: true }); };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('stateUpdated', handleStateUpdate);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

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
    // FIX: en vez de window.print() (que pasa por el motor de impresión de
    // Chrome y aplica el margen residual del @page), generamos el PDF con
    // la misma lógica de handleExportPDF y lo abrimos en una nueva ventana.
    // El usuario imprime desde el visor de PDF del navegador, que respeta
    // los márgenes exactos del PDF. Así el formato es IDÉNTICO al "Exportar PDF".
    setPdfLoading(true);
    try {
      const pdf = await generarPdfInforme();
      if (!pdf) return;
      const blob = pdf.output('blob');
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      // Liberar el URL después de un tiempo prudente
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      console.error('Error al generar PDF para imprimir:', err);
      toast.error('Error al generar el PDF. Intenta usar la opción "Exportar PDF" e imprimir desde ahí.');
    } finally {
      setPdfLoading(false);
    }
  };

  // Genera el jsPDF del informe con html2canvas. Usado por handleExportPDF
  // (descarga) y handlePrint (abre en nueva ventana). La función hace TODO
  // el pre-trabajo del DOM (ocultar no-print, neutralizar sticky, etc.) y
  // pagina el contenido en tajadas. Devuelve la instancia de jsPDF.
  const generarPdfInforme = async () => {
    const { default: html2canvas } = await import('html2canvas');
    const { default: jsPDF } = await import('jspdf');
    const el = docRef.current;
    if (!el) return null;

    // Esperar a que se carguen todas las imágenes dentro del documento para
    // evitar ancho/alto de 0 en el canvas
    const imgs = Array.from(el.querySelectorAll('img')).filter(img => !img.complete);
    if (imgs.length > 0) {
      await Promise.race([
        Promise.all(imgs.map(img => new Promise(r => { img.onload = r; img.onerror = r; }))),
        new Promise(r => setTimeout(r, 5000)) // timeout de 5 segundos máximo
      ]);
    }

    // Ocultar elementos que no deben aparecer en el PDF (actions-bar,
    // .no-print, position:sticky/fixed que html2canvas renderiza raro).
    const previouslyHidden = [];
    const stickyElements = [];
    const restoreStyles = () => {
      previouslyHidden.forEach(({ el, prev }) => { el.style.display = prev; });
      stickyElements.forEach(({ el, prev }) => {
        el.style.position = prev.position;
        el.style.top = prev.top;
        el.style.zIndex = prev.zIndex;
        el.style.backdropFilter = prev.backdropFilter;
      });
    };
    try {
      if (actionsBarRef.current) {
        previouslyHidden.push({ el: actionsBarRef.current, prev: actionsBarRef.current.style.display });
        actionsBarRef.current.style.display = 'none';
      }
      el.querySelectorAll('.no-print').forEach((n) => {
        previouslyHidden.push({ el: n, prev: n.style.display });
        n.style.display = 'none';
      });
      el.querySelectorAll('*').forEach((n) => {
        const cs = window.getComputedStyle(n);
        if (cs.position === 'sticky' || cs.position === 'fixed') {
          stickyElements.push({
            el: n,
            prev: {
              position: n.style.position,
              top: n.style.top,
              zIndex: n.style.zIndex,
              backdropFilter: n.style.backdropFilter || n.style.webkitBackdropFilter,
            },
          });
          n.style.position = 'static';
          n.style.top = 'auto';
          n.style.zIndex = 'auto';
          n.style.backdropFilter = 'none';
          n.style.webkitBackdropFilter = 'none';
        }
      });
    } catch (e) {
      console.warn('Pre-capture cleanup failed:', e);
    }

    // Dimensiones de la página A4 y margen del PDF (1cm, alineado con el
    // padding-top del .iv-documento). Se calculan ANTES de la captura
    // porque el clon necesita el ancho útil de la página.
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const marginMm = 10; // 1 cm
    const usableW = pageW - marginMm * 2;
    const usableH = pageH - marginMm * 2;

    // Ancho objetivo del documento en el clon: el ancho útil de la página
    // A4 expresado en px a 96dpi (190mm ≈ 718px). Con esto el canvas se
    // captura SIEMPRE a ancho de página y la escala del PDF es 1:1
    // (1px CSS = 1/96in), sin importar el ancho de la ventana actual.
    // Antes el documento se estiraba/comprimía según la ventana (en
    // móvil/ventana angosta el texto salía enorme y estirado; en
    // escritorio salía ~15% más chico que en pantalla).
    const targetWidthPx = (usableW / 25.4) * 96;

    // Intervalos de contenido (líneas de texto y elementos no-divisibles)
    // con los que se calculan cortes de página limpios. Se llenan dentro
    // de `onclone` (sobre el MISMO clon que captura html2canvas) para que
    // coincidan 1:1 con el canvas resultante.
    let safeBreakIntervals = [];
    let clonedDayRanges = [];
    let clonedImagesRange = null;

    // El logo del encabezado se muestra con filter: invert(1) porque es el
    // logo BLANCO de la marca (/logo.png = Oficial_JDL_blanco.png).
    // html2canvas NO aplica filtros CSS, así que en el PDF el logo saldría
    // blanco-sobre-blanco (invisible). Generamos la versión ya invertida
    // con un canvas del documento real (donde la imagen ya está cargada) y
    // la inyectamos en el clon que se va a capturar.
    let logoDataUrl = '';
    try {
      const headerLogo = el.querySelector('.iv-header-left img');
      if (headerLogo && headerLogo.naturalWidth > 0) {
        const logoCanvas = document.createElement('canvas');
        logoCanvas.width = headerLogo.naturalWidth;
        logoCanvas.height = headerLogo.naturalHeight;
        const logoCtx = logoCanvas.getContext('2d');
        logoCtx.drawImage(headerLogo, 0, 0);
        const imageData = logoCtx.getImageData(0, 0, logoCanvas.width, logoCanvas.height);
        const px = imageData.data;
        for (let i = 0; i < px.length; i += 4) {
          px[i] = 255 - px[i];
          px[i + 1] = 255 - px[i + 1];
          px[i + 2] = 255 - px[i + 2];
        }
        logoCtx.putImageData(imageData, 0, 0);
        logoDataUrl = logoCanvas.toDataURL('image/png');
      }
    } catch (e) {
      console.warn('No se pudo generar la versión invertida del logo:', e);
    }

    let canvas;
    try {
      canvas = await html2canvas(el, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true,
        // Viewport de escritorio fijo
        windowWidth: Math.max(el.scrollWidth, 1024),
        windowHeight: Math.max(el.scrollHeight, Math.ceil(targetWidthPx * 1.5)),
        onclone: (clonedDoc) => {
          try {
            clonedDoc.querySelectorAll('.no-print').forEach((n) => {
              n.style.display = 'none';
            });
            const colabSidebar = clonedDoc.querySelector('.colab-sidebar');
            if (colabSidebar) colabSidebar.style.display = 'none';

            const docEl = clonedDoc.querySelector('.iv-documento');
            if (docEl) {
              docEl.style.width = `${Math.ceil(targetWidthPx)}px`;
              docEl.style.maxWidth = 'none';
              docEl.style.margin = '0 auto';
              docEl.style.boxSizing = 'border-box';
              docEl.style.boxShadow = 'none';
              docEl.style.border = 'none';
            }
            const container = clonedDoc.querySelector('.informe-print-container');
            if (container) {
              container.style.width = '100%';
              container.style.maxWidth = 'none';
            }

            // Inyectar estilos optimizados para que cada día quepa completo en su hoja
            const pdfStyle = clonedDoc.createElement('style');
            pdfStyle.textContent = [
              '.iv-day-block { margin-bottom: 0 !important; padding-bottom: 0 !important; border-bottom: none !important; }',
              '.iv-header-table { margin-bottom: 0.4rem !important; padding: 0.25rem 0.5rem !important; }',
              '.iv-ht-row { padding: 0.16rem 0.35rem !important; }',
              '.iv-day-header { margin-bottom: 0.3rem !important; padding-bottom: 0.2rem !important; }',
              '.iv-montaje-container { padding: 0.4rem 0.6rem !important; }',
              '.iv-montaje-comentario { margin-top: 0.3rem !important; padding: 0.3rem 0.5rem !important; }',
              '.iv-imagenes { gap: 0.5rem !important; margin-top: 0 !important; }',
              '.iv-imagen-item { width: 200px !important; }',
              '.iv-imagen-thumb { width: 200px !important; height: 200px !important; }',
              '.iv-imagen-thumb img { max-width: 100% !important; max-height: 100% !important; }',
            ].join('\n');
            clonedDoc.head.appendChild(pdfStyle);

            if (logoDataUrl) {
              const headerLogo = clonedDoc.querySelector('.iv-header-left img');
              if (headerLogo) {
                headerLogo.src = logoDataUrl;
                headerLogo.removeAttribute('srcset');
                headerLogo.style.filter = 'none';
              }
            }

            // Medir las posiciones exactas de cada día sobre el clon
            if (docEl) {
              const rootRect = docEl.getBoundingClientRect();
              const rootTop = rootRect.top;

              const dayEls = Array.from(docEl.querySelectorAll('.iv-day-block'));
              clonedDayRanges = dayEls.map((db, idx) => {
                const r = db.getBoundingClientRect();
                return {
                  index: idx,
                  top: r.top - rootTop,
                  bottom: r.bottom - rootTop,
                  height: r.height,
                };
              });

              const imgsEl = docEl.querySelector('.iv-imagenes');
              if (imgsEl) {
                const ir = imgsEl.getBoundingClientRect();
                clonedImagesRange = {
                  top: ir.top - rootTop,
                  bottom: ir.bottom - rootTop,
                  height: ir.height,
                };
              }

              safeBreakIntervals = measureSafeBreakPositions(docEl, PDF_AVOID_SPLIT_SELECTOR);
            }
          } catch (e) { /* ignore */ }
        }
      });
    } finally {
      restoreStyles();
    }

    const mmPerPx = usableW / canvas.width;
    const pageContentPxH = usableH / mmPerPx;
    const canvasScale = canvas.width / targetWidthPx;

    if (!clonedDayRanges || clonedDayRanges.length === 0) {
      clonedDayRanges = [{ index: 0, top: 0, bottom: canvas.height / canvasScale, height: canvas.height / canvasScale }];
    }

    let isFirstPage = true;

    // Procesar cada día de forma independiente: cada día va en su propia(s) hoja(s)
    for (const dRange of clonedDayRanges) {
      const dayTopPx = Math.max(0, Math.round(dRange.top * canvasScale));
      const dayBottomPx = Math.min(canvas.height, Math.round(dRange.bottom * canvasScale));
      const dayHeightPx = dayBottomPx - dayTopPx;
      if (dayHeightPx <= 0) continue;

      // Si el día cabe en 1 hoja (hasta un 15% de tolerancia para que comentarios finales no se partan)
      if (dayHeightPx <= pageContentPxH * 1.15) {
        if (!isFirstPage) pdf.addPage();
        isFirstPage = false;

        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = dayHeightPx;
        const pCtx = pageCanvas.getContext('2d');
        pCtx.fillStyle = '#ffffff';
        pCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        pCtx.drawImage(
          canvas,
          0, dayTopPx, canvas.width, dayHeightPx,
          0, 0, pageCanvas.width, dayHeightPx
        );

        const sliceImg = pageCanvas.toDataURL('image/png');
        if (dayHeightPx <= pageContentPxH) {
          pdf.addImage(sliceImg, 'PNG', marginMm, marginMm, usableW, dayHeightPx * mmPerPx);
        } else {
          // Ajustar proporcionalmente para que todo el día quepa completo en la hoja sin cortarse
          const scale = pageContentPxH / dayHeightPx;
          const fitW = usableW * scale;
          const offsetX = marginMm + (usableW - fitW) / 2;
          pdf.addImage(sliceImg, 'PNG', offsetX, marginMm, fitW, usableH);
        }
      } else {
        // Si el día es excepcionalmente largo (más de 1.15 páginas), paginar SOLO este día
        let dayY = dayTopPx;
        const minH = pageContentPxH * 0.2;
        while (dayY < dayBottomPx) {
          const targetY = dayY + pageContentPxH;
          if (targetY >= dayBottomPx) {
            if (!isFirstPage) pdf.addPage();
            isFirstPage = false;
            const sliceH = dayBottomPx - dayY;
            const pageCanvas = document.createElement('canvas');
            pageCanvas.width = canvas.width;
            pageCanvas.height = sliceH;
            const pCtx = pageCanvas.getContext('2d');
            pCtx.fillStyle = '#ffffff';
            pCtx.fillRect(0, 0, pageCanvas.width, sliceH);
            pCtx.drawImage(canvas, 0, dayY, canvas.width, sliceH, 0, 0, pageCanvas.width, sliceH);
            pdf.addImage(pageCanvas.toDataURL('image/png'), 'PNG', marginMm, marginMm, usableW, sliceH * mmPerPx);
            break;
          }

          let cut = targetY;
          for (const it of safeBreakIntervals) {
            const itT = Math.round(it.t * canvasScale);
            const itB = Math.round(it.b * canvasScale);
            if (itT <= dayY) continue;
            if (itT >= targetY) break;
            if (itB > targetY) {
              cut = itT;
              break;
            }
          }
          if (cut - dayY < minH) cut = targetY;

          if (!isFirstPage) pdf.addPage();
          isFirstPage = false;
          const sliceH = cut - dayY;
          const pageCanvas = document.createElement('canvas');
          pageCanvas.width = canvas.width;
          pageCanvas.height = sliceH;
          const pCtx = pageCanvas.getContext('2d');
          pCtx.fillStyle = '#ffffff';
          pCtx.fillRect(0, 0, pageCanvas.width, sliceH);
          pCtx.drawImage(canvas, 0, dayY, canvas.width, sliceH, 0, 0, pageCanvas.width, sliceH);
          pdf.addImage(pageCanvas.toDataURL('image/png'), 'PNG', marginMm, marginMm, usableW, sliceH * mmPerPx);
          dayY = cut;
        }
      }
    }

    // 2. Procesar imágenes si existen (siempre en hoja nueva independiente)
    if (clonedImagesRange && clonedImagesRange.height > 0) {
      const imgTopPx = Math.max(0, Math.round(clonedImagesRange.top * canvasScale));
      const imgBottomPx = Math.min(canvas.height, Math.round(clonedImagesRange.bottom * canvasScale));
      const imgHeightPx = imgBottomPx - imgTopPx;
      if (imgHeightPx > 0) {
        if (!isFirstPage) pdf.addPage();
        isFirstPage = false;
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = Math.min(imgHeightPx, pageContentPxH);
        const pCtx = pageCanvas.getContext('2d');
        pCtx.fillStyle = '#ffffff';
        pCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        pCtx.drawImage(canvas, 0, imgTopPx, canvas.width, pageCanvas.height, 0, 0, pageCanvas.width, pageCanvas.height);
        pdf.addImage(pageCanvas.toDataURL('image/png'), 'PNG', marginMm, marginMm, usableW, pageCanvas.height * mmPerPx);
      }
    }

    return pdf;
  };

  const handleExportPDF = async () => {
    setPdfLoading(true);
    try {
      const pdf = await generarPdfInforme();
      if (!pdf) return;
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

  const handleVolver = () => {
    navigate(-1);
  };

  // Botones de acción para el header (segunda línea)
   const informeActionsEl = useMemo(() => (
     <>
       <button onClick={handleVolver} className="btn-secondary" data-tooltip="Volver">
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
         <button onClick={() => navigate(`/informe/pos/${informe?.id_ocupacion}`)} className="btn-secondary" data-tooltip="Editar informe">
           <IconFileText size={16} /> <span className="btn-text">Editar</span>
         </button>
       )}
     </>
   ), [pdfLoading, colabOpen, user, informe?.id_ocupacion, navigate]);

  // Pasar las acciones al header
  useEffect(() => {
    if (setInformeActions) {
      setInformeActions(informeActionsEl);
    }
    return () => {
      if (setInformeActions) setInformeActions(null);
    };
  }, [informeActionsEl, setInformeActions]);

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
    
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  };

  return (
    <div className={`informe-view-layout ${colabOpen ? 'colab-open' : ''}`}>
      <style media="print">{`
        /* Reset completo de la cadena de ancestros al imprimir.
           Importante: este <style> está inline en el DOM, así que su
           !important pisa a los archivos CSS externos. Si no reseteamos
           margin/padding aquí, los valores del tema (ej. .app-shell
           padding: 1rem 1.5rem, body margin: 8px) se mantienen y suman
           espacio en blanco arriba del logo. */
        html, body, body.informes-theme, #root, .reports-root, .app-shell, .informes-shell, main, .informe-view-layout, .informe-print-container {
          display: block !important;
          background: #ffffff !important;
          background-color: #ffffff !important;
          background-image: none !important;
          height: auto !important;
          min-height: 0 !important;
          max-height: none !important;
          margin: 0 !important;
          padding: 0 !important;
          border: none !important;
          box-shadow: none !important;
          overflow: visible !important;
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
        @page {
          size: A4 portrait;
          margin: 0.8cm;
        }
        .iv-documento {
          box-shadow: none !important;
          position: static !important;
          background: #ffffff !important;
          background-color: #ffffff !important;
          padding: 0 !important;
          margin: 0 auto !important;
          width: 100% !important;
          max-width: 100% !important;
          height: auto !important;
          min-height: 0 !important;
          border: none !important;
          font-family: 'Georgia', 'Times New Roman', serif !important;
          overflow: visible !important;
        }
        .iv-day-block {
          page-break-after: always !important;
          break-after: page !important;
          page-break-inside: auto !important;
          break-inside: auto !important;
          padding: 0 !important;
          margin: 0 0 1rem 0 !important;
        }
        .iv-day-block:not(:first-of-type) {
          page-break-before: always !important;
          break-before: page !important;
        }
        .iv-day-block:last-of-type {
          page-break-after: auto !important;
          break-after: auto !important;
        }
        .iv-day-block:first-of-type {
          margin-top: 0 !important;
          padding-top: 0 !important;
        }
        .iv-header-table {
          margin-bottom: 0.4rem !important;
          padding: 0.25rem 0.5rem !important;
        }
        .iv-ht-row {
          padding: 0.16rem 0.35rem !important;
        }
        .iv-day-header {
          margin-bottom: 0.3rem !important;
          padding-bottom: 0.2rem !important;
        }
        .iv-montaje-container {
          padding: 0.4rem 0.6rem !important;
        }
        .iv-montaje-comentario {
          margin-top: 0.3rem !important;
          padding: 0.3rem 0.5rem !important;
        }
        .iv-imagenes {
          display: grid !important;
          grid-template-columns: repeat(3, 1fr) !important;
          gap: 0.25in !important;
          page-break-before: always !important;
          break-before: page !important;
          page-break-inside: auto !important;
          break-inside: auto !important;
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

                {/* ═══ DATOS DEL EVENTO (ESPECÍFICOS DE CADA DÍA) ═══ */}
                {(() => {
                  let parsed = null;
                  let montajesList = [];
                  if (dia.descripcion_montaje) {
                    try {
                      parsed = typeof dia.descripcion_montaje === 'string' ? JSON.parse(dia.descripcion_montaje) : dia.descripcion_montaje;
                      if (parsed && parsed._v === 2) {
                        montajesList = parsed.montajes || [];
                      } else if (Array.isArray(parsed)) {
                        montajesList = parsed;
                      } else if (parsed && typeof parsed === 'object') {
                        montajesList = [parsed];
                      }
                    } catch { /* ignore */ }
                  }

                  // 1. Salón del día (montaje > slot > informe)
                  const salonesDelDia = [
                    parsed?.salon,
                    ...montajesList.map(m => m.salon),
                    dia.slot_salon,
                    dia.salon
                  ].filter(Boolean);
                  const diaSalon = salonesDelDia.length > 0 
                    ? Array.from(new Set(salonesDelDia.map(s => String(s).trim()))).join(', ')
                    : (informe.Salon || '-');

                  // 2. Pax del día (personas en montaje > cantidad platillos > slot_pax > informe.Pax)
                  let diaPax = null;
                  const personasMontaje = montajesList.find(m => m.num_personas && Number(m.num_personas) > 0)?.num_personas;
                  if (personasMontaje) {
                    diaPax = personasMontaje;
                  } else if (dia.items && dia.items.length > 0) {
                    const maxQty = Math.max(...dia.items.map(it => Number(it.cantidad_total) || 0));
                    if (maxQty > 0) diaPax = maxQty;
                  }
                  if (!diaPax && dia.slot_pax && Number(dia.slot_pax) > 0) {
                    diaPax = dia.slot_pax;
                  }
                  if (!diaPax) {
                    diaPax = informe.Pax || '-';
                  }

                  // 3. Horario del día
                  const diaHorario = parsed?.horario || montajesList.find(m => m.horario)?.horario || dia.slot_horario || (informe.HoraI ? `${informe.HoraI}${informe.HoraF ? ` - ${informe.HoraF}` : ''}` : '-');

                  // 4. No Cotización del día
                  const diaNoDoc = dia.slot_nodoc || informe.NoDoc || '-';

                  return (
                    <section className="iv-header-table">
                      <div className="iv-ht-rows">
                        <div className="iv-ht-row">
                          <span className="iv-ht-label">Encargado Evento</span>
                          <span className="iv-ht-value">{informe.EncargadoEvento || '-'}</span>
                        </div>
                        <div className="iv-ht-row">
                          <span className="iv-ht-label">No Cotización</span>
                          <span className="iv-ht-value">
                            {diaNoDoc}
                            {informe.fecha_creacion && <span className="iv-ht-sub">{fechaCreacion}</span>}
                          </span>
                        </div>
                        <div className="iv-ht-row">
                          <span className="iv-ht-label">Horario</span>
                          <span className="iv-ht-value">{diaHorario}</span>
                        </div>
                        <div className="iv-ht-row">
                          <span className="iv-ht-label">Fecha Evento</span>
                          <span className="iv-ht-value">{dia.fecha_evento ? formatFechaDia(dia.fecha_evento) : '-'}</span>
                        </div>
                        <div className="iv-ht-row">
                          <span className="iv-ht-label">Institución</span>
                          <span className="iv-ht-value">{informe.Institucion}</span>
                        </div>
                        <div className="iv-ht-row">
                          <span className="iv-ht-label">No Pax</span>
                          <span className="iv-ht-value">{diaPax}</span>
                        </div>
                        <div className="iv-ht-row">
                          <span className="iv-ht-label">Salón / Área</span>
                          <span className="iv-ht-value">{diaSalon}</span>
                        </div>
                        <div className="iv-ht-row">
                          <span className="iv-ht-label">No Folio</span>
                          <span className="iv-ht-value">{informe.folio || '-'}</span>
                        </div>
                        <div className="iv-ht-row">
                          <span className="iv-ht-label">Vendedor</span>
                          <span className="iv-ht-value">{informe.Vendedor || '-'}</span>
                        </div>
                      </div>
                    </section>
                  );
                })()}

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
                        return tc ? <span className="iv-day-tc-badge" style={{ '--tc-color': tc.color, '--tc-bg': `${tc.color}15` }}>{tc.label}</span> : null;
                      }
                    } catch {}
                    return null;
                  })()}
                  {(() => {
                    try {
                      const p = typeof dia.descripcion_montaje === 'string' ? JSON.parse(dia.descripcion_montaje) : (dia.descripcion_montaje || {});
                      if (p && p._v === 2 && (p.salon || p.horario)) {
                        const parts = [];
                        if (p.salon) parts.push(`🏛️ ${p.salon}`);
                        if (p.horario) parts.push(`🕐 ${p.horario}`);
                        return (
                          <span style={{
                            fontSize: '0.85rem', fontWeight: 700,
                            color: 'var(--primary-dark)',
                            marginLeft: '0.5rem',
                            display: 'inline-flex', gap: '0.75rem',
                            alignItems: 'center',
                            fontFamily: "'Playfair Display','Georgia','Times New Roman',serif",
                          }}>
                            {parts.map((part, i) => (
                              <span key={i}>{part}</span>
                            ))}
                          </span>
                        );
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
                        return agruparItemsPorTiempoComida(dia.items, itemsTc, customTiempoComidaOrder).map((grupo, gi) => (
                          <div key={gi} className="iv-grupo">
                            <div className="iv-grupo-label" style={{ '--tc-color': grupo.grupoColor, '--tc-bg': `${grupo.grupoColor}15` }}>{grupo.grupoLabel}</div>
                            <div className="iv-grupo-items">
                              {grupo.items.map((item, ii) => (
                                <div key={ii} className="iv-item-row">
                                  <span className="iv-item-nombre">{item.ingrediente_nombre}</span>
                                  {(() => {
                                    const tipoItem = (item.ingrediente_tipo || '').toLowerCase();
                                    const esProteina = tipoItem === 'carne' || tipoItem === 'proteina' || tipoItem === 'proteína' || tipoItem === 'proteinas' || tipoItem === 'proteínas';
                                    if (esProteina && item.cantidad_total) {
                                      const qty = parseInt(item.cantidad_total, 10);
                                      return <span className="iv-item-qty">Cantidad: {qty}</span>;
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
                                      <IconEdit size={11} className="iv-item-notes-icon" /> {item.notas}
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
                  <div className="iv-imagen-thumb">
                    <img src={imagenUrl(img.url)} alt={img.descripcion || ''} />
                  </div>
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
          <ColaboracionPanel informeId={informe?.id} highlightComentarioId={highlightComentarioId} />
        </aside>
      )}
    </div>
  );
}

// ─── Helper: agrupar items por tiempo de comida ───
function agruparItemsPorTiempoComida(items, itemsTc, order) {
  const grupos = {};
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const tcId = itemsTc && i < itemsTc.length ? itemsTc[i] : null;
    const key = tcId && TIEMPOS_COMIDA.some(t => t.id === tcId) ? tcId : '__sin_asignar';
    if (!grupos[key]) grupos[key] = [];
    grupos[key].push(item);
  }
  const resultado = [];
  const orderedIds = Array.isArray(order) && order.length > 0 ? order : TIEMPOS_COMIDA.map(t => t.id);
  for (const id of orderedIds) {
    const tc = TIEMPOS_COMIDA.find(t => t.id === id);
    if (!tc || !grupos[id] || grupos[id].length === 0) continue;
    resultado.push({ grupoLabel: tc.label, grupoColor: tc.color, items: grupos[id] });
    delete grupos[id];
  }
  for (const tc of TIEMPOS_COMIDA) {
    if (grupos[tc.id] && grupos[tc.id].length > 0) {
      resultado.push({ grupoLabel: tc.label, grupoColor: tc.color, items: grupos[tc.id] });
      delete grupos[tc.id];
    }
  }
  if (grupos['__sin_asignar'] && grupos['__sin_asignar'].length > 0) {
    resultado.push({ grupoLabel: 'Sin asignar', grupoColor: '#94a3b8', items: grupos['__sin_asignar'] });
  }
  return resultado;
}

// ─── Ayudantes de paginación del PDF ───

// Elementos que no deben dividirse entre páginas al generar el PDF
// (equivalente a los `page-break-inside: avoid` del CSS de impresión).
const PDF_AVOID_SPLIT_SELECTOR = [
  '.iv-header',
  '.iv-header-table',
  '.iv-info-grid',
  '.iv-alertas-banner',
  '.iv-day-header',
  '.iv-item-row',
  '.iv-menu-comentario',
  // Nota: `.iv-montaje-grid` / `.iv-montaje-multi` NO se marcan como
  // no-divisibles (eran la principal fuente de espacio desperdiciado al
  // moverse enteros a la siguiente hoja). En su lugar se protegen las
  // filas internas `.iv-montaje-item`, de modo que el cuadro se corta en
  // los límites de sus pares etiqueta/valor (nunca a mitad de fila).
  '.iv-montaje-item',
  '.iv-montaje-comentario',
  '.iv-imagen-item',
].join(',');

// Mide los intervalos verticales de contenido (en px CSS, relativos al
// inicio de `root`): cada línea de texto (fuera de elementos no-divisibles)
// y los límites de los elementos que no deben dividirse. El paginador usa
// estos intervalos para que el corte de página nunca caiga dentro de una
// línea de texto ni parta un elemento (fila, cuadro de montaje, imagen,
// etc.) a la mitad.
function measureSafeBreakPositions(root, avoidSelector) {
  const doc = root.ownerDocument;
  const rootTop = root.getBoundingClientRect().top;
  const intervals = [];

  // Límites (inicio/fin) de los elementos que no deben dividirse
  root.querySelectorAll(avoidSelector).forEach((n) => {
    const r = n.getBoundingClientRect();
    if (r.height <= 0) return;
    intervals.push({ t: r.top - rootTop, b: r.bottom - rootTop });
  });

  // Líneas de texto (solo fuera de elementos no-divisibles; dentro de ellos
  // solo se permite cortar en sus propios límites). Se usa el documento del
  // clon (root.ownerDocument) porque createRange/createTreeWalker exigen
  // operar sobre el mismo documento del nodo.
  const walker = doc.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */);
  let node;
  while ((node = walker.nextNode())) {
    const text = (node.textContent || '').trim();
    if (!text) continue;
    let p = node.parentElement;
    let insideAvoid = false;
    while (p && p !== root) {
      if (p.matches(avoidSelector)) { insideAvoid = true; break; }
      p = p.parentElement;
    }
    if (insideAvoid) continue;
    const range = doc.createRange();
    range.selectNodeContents(node);
    const lineRects = range.getClientRects();
    for (let i = 0; i < lineRects.length; i++) {
      const r = lineRects[i];
      if (r.height > 0) intervals.push({ t: r.top - rootTop, b: r.bottom - rootTop });
    }
  }

  return intervals.sort((a, b) => a.t - b.t);
}
