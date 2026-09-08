import { useEffect, useState, useRef, useContext, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { getInformeById, getImagenes, imagenUrl, marcarInformeLeido, updateDiaMenuItemNotas, updateDiaMenuItemCantidad } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import { InformeActionsContext } from '../components/ReportsLayout.jsx';
import ColaboracionPanel from '../components/ColaboracionPanel.jsx';
import { 
  IconArrowLeft, 
  IconPrinter, 
  IconDownload, 
  IconFileText, 
  IconMessageCircle, 
  IconCheckCircle, 
  IconX, 
  IconEdit,
  IconClock,
  IconUtensils,
  IconLayers,
  IconWrench,
  IconArmchair,
  IconLayoutGrid,
  IconAlertCircle,
} from '../components/Icons.jsx';
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

function formatQty(qty) {
  const n = Number(qty);
  if (isNaN(n)) return qty;
  return n % 1 === 0 ? String(Math.round(n)) : String(n);
}

function isProteina(item) {
  const tipo = String(item.ingrediente_tipo || '').toLowerCase().trim();
  if (['proteina', 'proteína', 'carne', 'carnes', 'aves', 'plato fuerte', 'platillo'].includes(tipo)) return true;
  const cat = String(item.categoria_nombre || '').toLowerCase();
  if (cat.includes('carne') || cat.includes('prote') || cat.includes('plato fuerte') || cat.includes('aves')) return true;
  return false;
}

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
  const [colabOpen, setColabOpen] = useState(() => (typeof window !== 'undefined' && window.innerWidth <= 768 ? Boolean(highlightComentarioId) : true));
  const [isMobileView, setIsMobileView] = useState(() => (typeof window !== 'undefined' ? window.innerWidth <= 768 : false));

  useEffect(() => {
    const handleResize = () => setIsMobileView(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const [imagenes, setImagenes] = useState([]);
  const [editingNotaId, setEditingNotaId] = useState(null);
  const [editingNotaValue, setEditingNotaValue] = useState('');
  const [savingNotaId, setSavingNotaId] = useState(null);
  const savingNotaRef = useRef(false);
  const notaInputRef = useRef(null);

  // Inline edit de cantidad
  const [editingQtyId, setEditingQtyId] = useState(null);
  const [editingQtyValue, setEditingQtyValue] = useState('');
  const [savingQtyId, setSavingQtyId] = useState(null);
  const savingQtyRef = useRef(false);
  const qtyInputRef = useRef(null);

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

  // ─── Inline edit de cantidad de ítem (especialmente proteínas) ───
  const startEditQty = (itemId, currentQty) => {
    setEditingQtyId(itemId);
    const n = Number(currentQty);
    setEditingQtyValue(isNaN(n) || n <= 0 ? '' : (n % 1 === 0 ? String(Math.round(n)) : String(n)));
    setTimeout(() => {
      if (qtyInputRef.current) {
        qtyInputRef.current.focus();
        qtyInputRef.current.select();
      }
    }, 50);
  };

  const saveQtyEdit = async (itemId) => {
    if (editingQtyId !== itemId || savingQtyRef.current) return;
    savingQtyRef.current = true;
    const rawVal = String(editingQtyValue).trim();
    const numVal = rawVal === '' ? null : Number(rawVal);
    if (rawVal !== '' && (isNaN(numVal) || numVal < 0)) {
      toast.error('Ingresa una cantidad numérica válida');
      savingQtyRef.current = false;
      return;
    }
    setSavingQtyId(itemId);
    try {
      await updateDiaMenuItemCantidad(itemId, numVal);
      setInforme(prev => {
        if (!prev) return prev;
        const newDias = prev.dias.map(dia => ({
          ...dia,
          items: (dia.items || []).map(item =>
            item.id === itemId ? { ...item, cantidad_total: numVal } : item
          ),
        }));
        return { ...prev, dias: newDias };
      });
      toast.success('Cantidad actualizada');
    } catch (err) {
      toast.error('Error al guardar cantidad: ' + (err.message || ''));
    } finally {
      savingQtyRef.current = false;
      setEditingQtyId(null);
      setEditingQtyValue('');
      setSavingQtyId(null);
    }
  };

  const cancelEditQty = () => {
    setEditingQtyId(null);
    setEditingQtyValue('');
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

  // Interceptar Ctrl+P / Cmd+P para usar handlePrint() (motor PDF exacto)
  // evitando que el diálogo nativo de Chrome descuadre el diseño
  const handlePrintRef = useRef(handlePrint);
  useEffect(() => {
    handlePrintRef.current = handlePrint;
  }, [handlePrint]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        e.stopPropagation();
        if (handlePrintRef.current) {
          handlePrintRef.current();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, []);

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
              '.iv-day-block { margin-bottom: 0 !important; padding: 0.8rem 1rem !important; border: none !important; box-shadow: none !important; }',
              '.iv-sheet-header { padding-bottom: 0.35rem !important; }',
              '.iv-meta-grid-full { margin-top: 0.4rem !important; padding: 0.35rem 0.6rem !important; }',
              '.iv-meta-bar-compact { margin-top: 0.3rem !important; padding: 0.25rem 0.6rem !important; }',
              '.iv-day-ribbon { margin-top: 0.35rem !important; margin-bottom: 0.45rem !important; padding: 0.25rem 0.6rem !important; }',
              '.iv-two-col-layout { gap: 0.5rem !important; }',
              '.iv-col-card { padding: 0.4rem 0.6rem !important; }',
              '.iv-empty-service-box-wide { padding: 1.2rem 1rem !important; }',
              '.iv-imagenes { gap: 0.5rem !important; margin-top: 0 !important; }',
              '.iv-imagen-item { width: 200px !important; }',
              '.iv-imagen-thumb { width: 200px !important; height: 200px !important; }',
              '.iv-imagen-thumb img { max-width: 100% !important; max-height: 100% !important; }',
            ].join('\n');
            clonedDoc.head.appendChild(pdfStyle);

            if (logoDataUrl) {
              const headerLogos = clonedDoc.querySelectorAll('.iv-header-left img');
              headerLogos.forEach(logo => {
                logo.src = logoDataUrl;
                logo.removeAttribute('srcset');
                logo.style.filter = 'none';
              });
            }
            clonedDoc.querySelectorAll('.iv-sheet-logo').forEach(logo => {
              logo.style.filter = 'none';
            });

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

  const handleVolver = (e) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    // 1. Si el usuario navegó desde otra vista dentro del CRM, retroceder exactamente a donde estaba
    if (window.history.state && typeof window.history.state.idx === 'number' && window.history.state.idx > 0) {
      navigate(-1);
      return;
    }
    // 2. Si se recargó la página o se abrió directamente, volver a la vista anterior recordada o a Ocupación
    let lastRoute = null;
    try {
      lastRoute = sessionStorage.getItem('informes_last_parent_route');
    } catch {}

    if (lastRoute && !lastRoute.startsWith('/informe/')) {
      navigate(lastRoute);
    } else {
      // Por defecto siempre volver al Tablero de Ocupación (/kanban)
      navigate('/kanban');
    }
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

  // Pasar las acciones al header (solo en desktop, móvil usa barra inferior)
  useEffect(() => {
    if (setInformeActions) {
      if (isMobileView) {
        setInformeActions(null);
      } else {
        setInformeActions(informeActionsEl);
      }
    }
    return () => {
      if (setInformeActions) setInformeActions(null);
    };
  }, [informeActionsEl, setInformeActions, isMobileView]);

  // Filtrar días que tengan menú o montaje (para omitir hojas vacías/solo habitaciones al imprimir o exportar)
  const diasFiltrados = useMemo(() => {
    if (!informe?.dias || !Array.isArray(informe.dias) || informe.dias.length === 0) {
      return [];
    }

    const procesados = informe.dias.map((dia, idx) => {
      let parsed = null;
      let montajesList = [];
      let alertas = [];
      let alertaCustom = '';

      if (dia.descripcion_montaje) {
        try {
          parsed = typeof dia.descripcion_montaje === 'string' ? JSON.parse(dia.descripcion_montaje) : dia.descripcion_montaje;
          if (parsed && parsed._v === 2) {
            montajesList = parsed.montajes || [];
            alertas = parsed.alertas || [];
            alertaCustom = parsed.alertaCustom || '';
          } else if (Array.isArray(parsed)) {
            montajesList = parsed;
          } else if (parsed && typeof parsed === 'object') {
            montajesList = [parsed];
          }
        } catch {
          if (typeof dia.descripcion_montaje === 'string' && dia.descripcion_montaje.trim()) {
            montajesList = [{ observaciones: dia.descripcion_montaje.trim() }];
          }
        }
      }

      // Filtrar montajes que realmente tengan contenido asignado
      const montajesValidos = montajesList.filter(m => {
        if (!m) return false;
        if (typeof m === 'string') return m.trim().length > 0;
        return Boolean(
          (m.tipo_montaje && String(m.tipo_montaje).trim()) ||
          (m.equipo_necesario && String(m.equipo_necesario).trim()) ||
          (m.manteleria && String(m.manteleria).trim()) ||
          (m.mesas && String(m.mesas).trim()) ||
          (m.sillas && String(m.sillas).trim()) ||
          (m.cristaleria && String(m.cristaleria).trim()) ||
          (m.observaciones && String(m.observaciones).trim()) ||
          (m.num_personas && Number(m.num_personas) > 0)
        );
      });

      const tieneMenu = (Array.isArray(dia.items) && dia.items.length > 0) || Boolean(dia.nombre_menu?.trim()) || Boolean(dia.comentario_menu?.trim());
      const tieneMontaje = montajesValidos.length > 0;
      const tieneContenido = tieneMenu || tieneMontaje;

      return {
        dia,
        numeroDiaOriginal: idx + 1,
        parsed,
        montajesList: montajesValidos.length > 0 ? montajesValidos : montajesList,
        alertas,
        alertaCustom,
        tieneMenu,
        tieneMontaje,
        tieneContenido,
      };
    });

    const conContenido = procesados.filter(p => p.tieneContenido);
    return conContenido.length > 0 ? conContenido : procesados;
  }, [informe?.dias]);

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
        /* Reset completo de la cadena de ancestros al imprimir. */
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
        .colab-mobile-backdrop,
        .iv-mobile-bottom-bar,
        .app-header,
        .app-nav,
        .iv-badge-edit-icon,
        .iv-mic-badge-placeholder,
        .iv-item-qty-editing,
        .iv-item-notes-editing,
        .iv-item-notes-icon {
          display: none !important;
        }
        @page {
          size: A4 portrait;
          margin: 0.6cm;
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
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
          overflow: visible !important;
        }
        .iv-paper-sheet {
          box-shadow: none !important;
          border: none !important;
          border-radius: 0 !important;
          padding: 0 !important;
          margin: 0 !important;
          background: #ffffff !important;
        }
        .iv-day-block {
          page-break-after: always !important;
          break-after: page !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
          padding: 0 !important;
          margin: 0 !important;
        }
        .iv-day-block:not(:first-of-type) {
          page-break-before: always !important;
          break-before: page !important;
        }
        .iv-day-block:last-of-type {
          page-break-after: auto !important;
          break-after: auto !important;
        }
        .iv-two-col-layout {
          display: grid !important;
          grid-template-columns: 1fr 1fr !important;
          gap: 0.5rem !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
        .iv-col-card {
          border: 1px solid #cbd5e1 !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
        .iv-sheet-logo-circle {
          background: #6366f1 !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .iv-sheet-logo {
          filter: none !important;
        }
        .iv-day-ribbon {
          background: #4f46e5 !important;
          color: #ffffff !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .iv-dr-pill, .iv-dr-pax-badge {
          background: #ffffff !important;
          color: #4338ca !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
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
          {/* ─── DÍAS (cada uno con diseño compacto en 2 columnas para ahorro de papel) ─── */}
          {diasFiltrados.length > 0 ? (
            diasFiltrados.map((itemDia, pageIndex) => {
              const {
                dia,
                numeroDiaOriginal,
                parsed,
                montajesList,
                alertas,
                alertaCustom,
                tieneMenu,
                tieneMontaje,
              } = itemDia;

              const todasAlertas = [...alertas, ...(alertaCustom ? [alertaCustom] : [])];

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

              // 2. Pax del día
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

              // Items de menú agrupados por tiempo de comida
              let itemsTc = [];
              try {
                if (parsed && parsed._v === 2) itemsTc = parsed.items_tiempo_comida || [];
              } catch {}
              const gruposMenu = tieneMenu ? agruparItemsPorTiempoComida(dia.items, itemsTc, customTiempoComidaOrder) : [];

              return (
                <div key={dia.id || `dia-${numeroDiaOriginal}`} className="iv-day-block iv-paper-sheet">
                  {/* ═══ ENCABEZADO DE HOJA (Logo, Título Serif, Folio/Cotización, Fecha Emisión) ═══ */}
                  <header className="iv-sheet-header">
                    <div className="iv-sheet-brand">
                      <div className="iv-sheet-logo-circle">
                        <img src="/logo.png" alt="JDL" className="iv-sheet-logo" />
                      </div>
                      <div className="iv-sheet-title-group">
                        <h1 className="iv-sheet-main-title">INFORME DE EVENTO</h1>
                        <p className="iv-sheet-sub-title">ORDEN DE SERVICIO Y LOGÍSTICA • PÁGINA {pageIndex + 1}</p>
                      </div>
                    </div>
                    <div className="iv-sheet-meta-badge">
                      <div className="iv-cotizacion-pill">COTIZACIÓN: {diaNoDoc}</div>
                      <div className="iv-emision-date">Emitido: {fechaCreacion}</div>
                    </div>
                  </header>

                  {/* ═══ DATOS DEL EVENTO: PÁGINA 1 FULL (2x4) vs PÁGINAS 2+ COMPACT (1 fila) ═══ */}
                  {pageIndex === 0 ? (
                    <div className="iv-meta-grid-full">
                      <div className="iv-mg-cell">
                        <span className="iv-mg-label">INSTITUCIÓN / CLIENTE</span>
                        <span className="iv-mg-val iv-mg-val-strong">{informe.Institucion || '-'}</span>
                      </div>
                      <div className="iv-mg-cell">
                        <span className="iv-mg-label">ENCARGADO EVENTO</span>
                        <span className="iv-mg-val">{informe.EncargadoEvento || '-'}</span>
                      </div>
                      <div className="iv-mg-cell">
                        <span className="iv-mg-label">{informe.dias?.length > 1 ? `FECHA DEL DÍA ${numeroDiaOriginal}` : 'FECHA DEL DÍA 1'}</span>
                        <span className="iv-mg-val iv-mg-val-blue">{formatFechaDia(dia.fecha_evento)}</span>
                      </div>
                      <div className="iv-mg-cell">
                        <span className="iv-mg-label">HORARIO RESERVADO</span>
                        <span className="iv-mg-val">{diaHorario}</span>
                      </div>
                      <div className="iv-mg-cell">
                        <span className="iv-mg-label">SALÓN / ÁREA</span>
                        <span className="iv-mg-val">{diaSalon}</span>
                      </div>
                      <div className="iv-mg-cell">
                        <span className="iv-mg-label">PERSONAS (NO. PAX)</span>
                        <span className="iv-mg-val">
                          <span className="iv-pax-tag">{diaPax} Pax</span>
                        </span>
                      </div>
                      <div className="iv-mg-cell">
                        <span className="iv-mg-label">NO. FOLIO</span>
                        <span className="iv-mg-val">{informe.folio || '0'}</span>
                      </div>
                      <div className="iv-mg-cell">
                        <span className="iv-mg-label">VENDEDOR ASIGNADO</span>
                        <span className="iv-mg-val">{informe.Vendedor || '-'}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="iv-meta-bar-compact">
                      <div className="iv-mb-item">
                        <span className="iv-mb-label">CLIENTE:</span>
                        <span className="iv-mb-val">{informe.Institucion || '-'}</span>
                      </div>
                      <div className="iv-mb-item">
                        <span className="iv-mb-label">ENCARGADO:</span>
                        <span className="iv-mb-val">{informe.EncargadoEvento || '-'}</span>
                      </div>
                      <div className="iv-mb-item">
                        <span className="iv-mb-label">FECHA EVENTO:</span>
                        <span className="iv-mb-val iv-mg-val-blue">{formatFechaDia(dia.fecha_evento)}</span>
                      </div>
                      <div className="iv-mb-item">
                        <span className="iv-mb-label">VENDEDOR:</span>
                        <span className="iv-mb-val">{informe.Vendedor || '-'}</span>
                      </div>
                    </div>
                  )}

                  {/* ═══ BARRA DEL DÍA (Navy Blue Ribbon) ═══ */}
                  <div className="iv-day-ribbon">
                    <div className="iv-dr-left">
                      <span className="iv-dr-pill">DÍA {numeroDiaOriginal}</span>
                      <span className="iv-dr-salon">
                        {diaSalon && diaSalon !== '-' ? `Salón: ${diaSalon}` : 'Área de Habitaciones / General'}
                      </span>
                    </div>
                    <div className="iv-dr-right">
                      {diaHorario && diaHorario !== '-' && (
                        <span className="iv-dr-time">
                          <IconClock size={12} className="iv-inline-icon" /> {diaHorario}
                        </span>
                      )}
                      {diaPax && diaPax !== '-' && (
                        <span className="iv-dr-pax-badge">
                          {diaPax} PERSONAS
                        </span>
                      )}
                    </div>
                  </div>

                  {/* ═══ CONTENIDO DEL DÍA: CASO ESPECIAL SIN MENÚ NI MONTAJE ═══ */}
                  {!tieneMenu && !tieneMontaje ? (
                    <div className="iv-empty-service-box-wide">
                      <div className="iv-empty-icon"><IconUtensils size={30} strokeWidth={1.5} /></div>
                      <h4 className="iv-empty-title">SIN PLATILLO ASIGNADO PARA ESTA FECHA</h4>
                      <p className="iv-empty-desc">
                        Recepción de huéspedes en área de habitaciones • Sin requerimientos de montaje especial.
                      </p>
                    </div>
                  ) : (
                    /* ═══ CUADRÍCULA DE 2 COLUMNAS (MENÚ PROGRAMADO / MONTAJE Y LOGÍSTICA) ═══ */
                    <div className="iv-two-col-layout">
                      {/* ─── COLUMNA IZQUIERDA: MENÚ PROGRAMADO ─── */}
                      {tieneMenu ? (
                        <div className="iv-col-card iv-menu-col">
                          <div className="iv-col-header">
                            <span className="iv-col-title">
                              <IconUtensils size={14} className="iv-title-icon" /> MENÚ PROGRAMADO
                            </span>
                            <span className="iv-col-subtitle">
                              {dia.nombre_menu || 'Servicio Banquete'}
                            </span>
                          </div>

                          {/* Alertas alimentarias */}
                          {todasAlertas.length > 0 && (
                            <div className="iv-card-alertas">
                              {todasAlertas.map((a, i) => {
                                const def = ALERTAS_PREDEFINIDAS.find(p => p.label === a);
                                return (
                                  <span key={i} className="iv-alerta-chip-sm">
                                    {def ? `${def.emoji} ${def.label}` : `⚠️ ${a}`}
                                  </span>
                                );
                              })}
                            </div>
                          )}

                          {/* Grupos por tiempo de comida */}
                          {gruposMenu.map((grupo, gi) => (
                            <div key={gi} className="iv-menu-grupo-block">
                              <div
                                className="iv-menu-grupo-pill"
                                style={{
                                  background: `${grupo.grupoColor}15`,
                                  color: grupo.grupoColor,
                                  border: `1px solid ${grupo.grupoColor}35`
                                }}
                              >
                                {grupo.grupoLabel}
                              </div>
                              <div className="iv-menu-grupo-items">
                                {grupo.items.map((item, ii) => {
                                  const cat = (item.categoria_nombre || '').toLowerCase();
                                  const esPostre = cat.includes('postre') || (item.ingrediente_nombre || '').toLowerCase().includes('postre') || (item.opcion_nombre || '').toLowerCase().includes('postre');
                                  const esProt = isProteina(item);
                                  const qtyNum = Number(item.cantidad_total);
                                  const hasValidQty = !isNaN(qtyNum) && qtyNum > 0;
                                  // Solo mostrar cantidad si es proteína, o si tiene una cantidad personalizada mayor a 1
                                  // (Evita que guarniciones, salsas, etc. salgan con "Cant: 1.00")
                                  const showQtyBadge = esProt ? hasValidQty : (hasValidQty && qtyNum > 1);
                                  const canEdit = user && ['Admin', 'Vendedor', 'FrontOffice', 'Eventos'].includes(user.rol);

                                  return (
                                    <div key={ii} className="iv-menu-item-card">
                                      <div className="iv-mic-row">
                                        <span className="iv-mic-nombre">{item.ingrediente_nombre}</span>

                                        {editingQtyId === item.id ? (
                                          <span className="iv-item-qty-editing" onClick={e => e.stopPropagation()}>
                                            <input
                                              ref={qtyInputRef}
                                              type="number"
                                              step="any"
                                              min="0"
                                              className="iv-qty-input"
                                              value={editingQtyValue}
                                              onChange={e => setEditingQtyValue(e.target.value)}
                                              onKeyDown={e => {
                                                if (e.key === 'Enter') { e.preventDefault(); saveQtyEdit(item.id); }
                                                if (e.key === 'Escape') cancelEditQty();
                                              }}
                                              onBlur={() => saveQtyEdit(item.id)}
                                              disabled={savingQtyId === item.id}
                                              placeholder="Cant..."
                                            />
                                            {savingQtyId === item.id ? (
                                              <span className="iv-qty-saving">…</span>
                                            ) : (
                                              <>
                                                <button className="iv-qty-btn" onMouseDown={e => { e.preventDefault(); saveQtyEdit(item.id); }} data-tooltip="Guardar">
                                                  <IconCheckCircle size={12} />
                                                </button>
                                                <button className="iv-qty-btn iv-qty-btn-cancel" onMouseDown={e => { e.preventDefault(); cancelEditQty(); }} data-tooltip="Cancelar">
                                                  <IconX size={12} />
                                                </button>
                                              </>
                                            )}
                                          </span>
                                        ) : showQtyBadge ? (
                                          <span
                                            className={`iv-mic-badge ${canEdit ? 'iv-mic-badge-editable' : ''}`}
                                            onClick={() => { if (canEdit) startEditQty(item.id, item.cantidad_total); }}
                                            title={canEdit ? 'Clic para editar cantidad' : ''}
                                          >
                                            Cant: {formatQty(item.cantidad_total)}
                                            {canEdit && <IconEdit size={10} className="iv-badge-edit-icon" />}
                                          </span>
                                        ) : (esProt && canEdit) ? (
                                          <span
                                            className="iv-mic-badge iv-mic-badge-placeholder"
                                            onClick={() => startEditQty(item.id, '')}
                                            title="Clic para definir cantidad de proteína"
                                          >
                                            + Cant
                                          </span>
                                        ) : esPostre ? (
                                          <span className="iv-mic-badge iv-mic-badge-postre">Postre</span>
                                        ) : null}
                                      </div>
                                      {item.metodo_preparacion && (
                                        <div className="iv-mic-sub">
                                          • {item.metodo_preparacion}
                                        </div>
                                      )}
                                      {item.opcion_nombre && (
                                        <div className="iv-mic-tags">
                                          <span className="iv-mic-tag">{item.opcion_nombre}</span>
                                        </div>
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
                                      ) : item.notas ? (
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
                                      ) : user && ['Admin','Vendedor','FrontOffice'].includes(user.rol) ? (
                                        <span
                                          className="iv-item-notes iv-item-notes-editable"
                                          onClick={() => startEditNota(item.id, '')}
                                          style={{ opacity: 0.5, fontStyle: 'italic', fontSize: '0.68rem', cursor: 'pointer' }}
                                        >
                                          + Agregar nota
                                        </span>
                                      ) : null}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}

                          {dia.comentario_menu && (
                            <div className="iv-montaje-obs-callout" style={{ borderLeftColor: '#6366f1', background: '#f5f3ff' }}>
                              <div className="iv-moc-title" style={{ color: '#4338ca' }}>
                                <IconMessageCircle size={12} className="iv-inline-icon" /> Comentarios del Menú
                              </div>
                              <div className="iv-moc-text" style={{ color: '#312e81' }}>
                                {dia.comentario_menu}
                              </div>
                            </div>
                          )}

                          <div className="iv-col-footer">
                            <span>Servicio a tiempo y temperatura adecuada</span>
                            <span className="iv-col-footer-bold">Total Comensales: {diaPax}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="iv-col-card iv-empty-col">
                          <div className="iv-empty-service-box">
                            <span className="iv-empty-icon"><IconUtensils size={26} strokeWidth={1.5} /></span>
                            <h4 className="iv-empty-title">SIN PLATILLO ASIGNADO</h4>
                            <p className="iv-empty-desc">Sin servicio de alimentación o banquete programado para este día.</p>
                          </div>
                        </div>
                      )}

                      {/* ─── COLUMNA DERECHA: MONTAJE Y LOGÍSTICA ─── */}
                      {tieneMontaje ? (
                        <div className="iv-col-card iv-montaje-col">
                          <div className="iv-col-header">
                            <span className="iv-col-title">
                              <IconLayers size={14} className="iv-title-icon" /> MONTAJE Y LOGÍSTICA
                            </span>
                            {diaSalon && diaSalon !== '-' && (
                              <span className="iv-col-badge">
                                {diaSalon}
                              </span>
                            )}
                          </div>

                          {montajesList.map((m, mi) => (
                            <div key={mi} className="iv-montaje-sub-block">
                              {montajesList.length > 1 && (
                                <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#312e81', marginBottom: '4px', textTransform: 'uppercase' }}>
                                  <IconLayers size={11} className="iv-inline-icon" /> {m.salon || `Montaje ${mi + 1}`}
                                </div>
                              )}

                              {/* Caja Tipo Montaje & Capacidad */}
                              <div className="iv-montaje-top-box">
                                <div className="iv-mtb-tipo">
                                  <span className="iv-msc-label">TIPO MONTAJE:</span>{' '}
                                  <IconLayoutGrid size={11} className="iv-inline-icon" /> {m.tipo_montaje || 'Banquete'}
                                </div>
                                <div className="iv-mtb-cap">
                                  <span className="iv-msc-label">CAPACIDAD / PERSONAS:</span>{' '}
                                  {m.num_personas || diaPax} Asistentes
                                </div>
                              </div>

                              {/* Equipo Audiovisual & Mobiliario */}
                              {m.equipo_necesario && (
                                <>
                                  <span className="iv-montaje-sec-label"><IconWrench size={11} className="iv-inline-icon" /> EQUIPO AUDIOVISUAL & MOBILIARIO</span>
                                  <div className="iv-montaje-chips-box">
                                    {m.equipo_necesario.split(',').map(s => s.trim()).filter(Boolean).map((eq, i) => (
                                      <span key={i} className="iv-montaje-chip-pill"><IconWrench size={9} className="iv-inline-icon" /> {eq}</span>
                                    ))}
                                  </div>
                                </>
                              )}

                              {/* Mantelería */}
                              {m.manteleria && (
                                <>
                                  <span className="iv-montaje-sec-label">MANTELERÍA</span>
                                  <div className="iv-montaje-mantel-box">
                                    {m.manteleria}
                                  </div>
                                </>
                              )}

                              {/* Mesas y Sillas */}
                              {(m.mesas || m.sillas) && (
                                <div className="iv-montaje-subcard">
                                  <div className="iv-msc-col">
                                    <span className="iv-msc-label">MESAS</span>
                                    <span className="iv-msc-val">{m.mesas || 'Estándar'}</span>
                                  </div>
                                  <div className="iv-msc-col">
                                    <span className="iv-msc-label">SILLAS</span>
                                    <span className="iv-msc-val"><IconArmchair size={11} className="iv-inline-icon" /> {m.sillas || 'Estándar'}</span>
                                  </div>
                                </div>
                              )}

                              {/* Cristalería */}
                              {m.cristaleria && (
                                <div style={{ fontSize: '0.72rem', color: '#475569', marginBottom: '0.35rem' }}>
                                  <span className="iv-msc-label">CRISTALERÍA:</span> <b>{m.cristaleria}</b>
                                </div>
                              )}

                              {/* Comentarios / Observaciones de Montaje */}
                              {m.observaciones && (
                                <div className="iv-montaje-obs-callout">
                                  <div className="iv-moc-title">
                                    <IconAlertCircle size={12} className="iv-inline-icon" /> Comentarios e Instrucciones de Montaje
                                  </div>
                                  <div className="iv-moc-text">
                                    “{m.observaciones}”
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}

                          <div className="iv-col-footer">
                            <span>Revisión técnica: {diaSalon}</span>
                            <span className="iv-col-footer-ready">✓ Listo para montaje</span>
                          </div>
                        </div>
                      ) : (
                        <div className="iv-col-card iv-empty-col">
                          <div className="iv-empty-service-box">
                            <span className="iv-empty-icon"><IconLayers size={26} strokeWidth={1.5} /></span>
                            <h4 className="iv-empty-title">SIN REQUERIMIENTOS DE MONTAJE</h4>
                            <p className="iv-empty-desc">Sin especificaciones de mobiliario o equipo audiovisual para este día.</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
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

      {/* ─── SIDEBAR / BOTTOM SHEET DE COLABORACIÓN ─── */}
      {colabOpen && (
        isMobileView && typeof document !== 'undefined' ? (
          createPortal(
            <>
              <div
                className="colab-mobile-backdrop no-print"
                onClick={() => setColabOpen(false)}
                style={{
                  position: 'fixed',
                  inset: 0,
                  background: 'rgba(15, 23, 42, 0.5)',
                  backdropFilter: 'blur(4px)',
                  WebkitBackdropFilter: 'blur(4px)',
                  zIndex: 99998,
                }}
              />
              <aside
                className="colab-sidebar colab-mobile-sheet no-print"
                style={{
                  position: 'fixed',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  width: '100vw',
                  maxWidth: '100vw',
                  height: '80vh',
                  maxHeight: '80vh',
                  zIndex: 99999,
                  background: 'var(--bg-card, #ffffff)',
                  borderRadius: '20px 20px 0 0',
                  boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.28)',
                  display: 'flex',
                  flexDirection: 'column',
                  border: '1px solid var(--border, #e2e8f0)',
                  borderBottom: 'none',
                }}
              >
                <div className="colab-sidebar-header" style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border, #e2e8f0)' }}>
                  <h3><IconMessageCircle size={16} /> Colaboración</h3>
                  <button className="btn-ghost btn-sm" onClick={() => setColabOpen(false)} title="Cerrar">✕</button>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                  <ColaboracionPanel informeId={informe?.id} highlightComentarioId={highlightComentarioId} />
                </div>
              </aside>
            </>,
            document.body
          )
        ) : (
          <aside className="colab-sidebar">
            <div className="colab-sidebar-header">
              <h3><IconMessageCircle size={16} /> Colaboración</h3>
              <button className="btn-ghost btn-sm" onClick={() => setColabOpen(false)} title="Cerrar">✕</button>
            </div>
            <ColaboracionPanel informeId={informe?.id} highlightComentarioId={highlightComentarioId} />
          </aside>
        )
      )}

      {/* ─── BARRA INFERIOR DE ACCIONES EN MÓVIL (PORTAL AL BODY) ─── */}
      {isMobileView && typeof document !== 'undefined' && createPortal(
        <div
          className="iv-mobile-bottom-bar no-print"
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            width: '100%',
            maxWidth: '100%',
            zIndex: 99995,
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-around',
            gap: '4px',
            background: 'rgba(255, 255, 255, 0.97)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderTop: '1px solid rgba(226, 232, 240, 0.95)',
            boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.12)',
            paddingTop: '6px',
            paddingBottom: 'max(16px, env(safe-area-inset-bottom, 16px))',
            paddingLeft: 'max(8px, env(safe-area-inset-left, 8px))',
            paddingRight: 'max(8px, env(safe-area-inset-right, 8px))',
            boxSizing: 'border-box',
            transform: 'translateZ(0)',
            WebkitTransform: 'translateZ(0)',
            willChange: 'transform',
          }}
        >
          {/* 1. Volver */}
          <button
            type="button"
            onClick={handleVolver}
            className="iv-mob-btn iv-mob-btn-secondary"
            style={{
              flex: '1 1 0',
              minWidth: 0,
              height: '42px',
              background: 'transparent',
              border: 'none',
              borderRadius: '10px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '2px',
              color: '#64748b',
              cursor: 'pointer',
              padding: '2px 0',
              touchAction: 'manipulation',
              WebkitTapHighlightColor: 'rgba(0,0,0,0.05)',
            }}
            title="Volver"
          >
            <IconArrowLeft size={17} />
            <span style={{ fontSize: '10.5px', fontWeight: 600, lineHeight: 1.1 }}>Volver</span>
          </button>

          {/* 2. Exportar PDF */}
          <button
            type="button"
            onClick={handleExportPDF}
            disabled={pdfLoading}
            className="iv-mob-btn iv-mob-btn-pdf"
            style={{
              flex: '1 1 0',
              minWidth: 0,
              height: '42px',
              background: 'rgba(5, 150, 105, 0.08)',
              border: 'none',
              borderRadius: '10px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '2px',
              color: '#059669',
              cursor: pdfLoading ? 'wait' : 'pointer',
              padding: '2px 0',
              opacity: pdfLoading ? 0.7 : 1,
            }}
            title="Exportar PDF"
          >
            <IconDownload size={17} />
            <span style={{ fontSize: '10.5px', fontWeight: 600, lineHeight: 1.1 }}>{pdfLoading ? 'PDF...' : 'PDF'}</span>
          </button>

          {/* 3. Imprimir (Destacado) */}
          <button
            type="button"
            onClick={handlePrint}
            className="iv-mob-btn iv-mob-btn-print"
            style={{
              flex: '1.2 1 0',
              minWidth: 0,
              height: '42px',
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              border: 'none',
              borderRadius: '12px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '2px',
              color: '#ffffff',
              cursor: 'pointer',
              padding: '2px 4px',
              boxShadow: '0 2px 8px rgba(99, 102, 241, 0.35)',
            }}
            title="Imprimir informe"
          >
            <IconPrinter size={17} />
            <span style={{ fontSize: '10.5px', fontWeight: 600, lineHeight: 1.1, color: '#ffffff' }}>Imprimir</span>
          </button>

          {/* 4. Colaborar */}
          <button
            type="button"
            onClick={() => setColabOpen(!colabOpen)}
            className={`iv-mob-btn iv-mob-btn-colab ${colabOpen ? 'active' : ''}`}
            style={{
              flex: '1 1 0',
              minWidth: 0,
              height: '42px',
              background: colabOpen ? 'rgba(79, 70, 229, 0.12)' : 'transparent',
              border: 'none',
              borderRadius: '10px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '2px',
              color: colabOpen ? '#4338ca' : '#4f46e5',
              cursor: 'pointer',
              padding: '2px 0',
            }}
            title={colabOpen ? 'Cerrar colaboración' : 'Abrir colaboración'}
          >
            <IconMessageCircle size={17} />
            <span style={{ fontSize: '10.5px', fontWeight: 600, lineHeight: 1.1 }}>Colaborar</span>
          </button>

          {/* 5. Editar */}
          {user && ['Admin', 'Vendedor', 'FrontOffice', 'Eventos'].includes(user.rol) && (
            <button
              type="button"
              onClick={() => navigate(`/informe/pos/${informe?.id_ocupacion}`)}
              className="iv-mob-btn iv-mob-btn-edit"
              style={{
                flex: '1 1 0',
                minWidth: 0,
                height: '42px',
                background: 'transparent',
                border: 'none',
                borderRadius: '10px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '2px',
                color: '#d97706',
                cursor: 'pointer',
                padding: '2px 0',
              }}
              title="Editar informe"
            >
              <IconFileText size={17} />
              <span style={{ fontSize: '10.5px', fontWeight: 600, lineHeight: 1.1 }}>Editar</span>
            </button>
          )}
        </div>,
        document.body
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
  '.iv-sheet-header',
  '.iv-meta-grid-full',
  '.iv-meta-bar-compact',
  '.iv-day-ribbon',
  '.iv-col-header',
  '.iv-col-footer',
  '.iv-menu-grupo-block',
  '.iv-menu-subitem',
  '.iv-montaje-top-box',
  '.iv-montaje-chips-box',
  '.iv-montaje-mantel-box',
  '.iv-montaje-subcard',
  '.iv-montaje-obs-callout',
  '.iv-empty-service-box',
  '.iv-empty-service-box-wide',
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
