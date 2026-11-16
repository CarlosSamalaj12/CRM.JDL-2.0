import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom';
import authService from '../../services/authService';
import socketService from '../../services/socketService';
import { toast } from '../../utils/toast';
import './autorizaciones.css';

const API_BASE = import.meta.env.VITE_API_URL || '';

export default function AutorizacionesModule() {
  const [activeTab, setActiveTab] = useState('pendientes'); // 'pendientes' | 'historial'
  const [pendingList, setPendingList] = useState([]);
  const [historyList, setHistoryList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'aprobado' | 'rechazado'

  // Modal de acción (aprobar o rechazar)
  const [activeActionModal, setActiveActionModal] = useState(null); // { item, type: 'aprobar' | 'rechazar' }
  const [actionReason, setActionReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const currentUser = useMemo(() => authService.getCurrentUser() || {}, []);

  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
  }, []);

  const fetchPending = useCallback(async () => {
    try {
      const url = `${API_BASE}/api/discount-auth/pendientes${currentUser.id ? `?userId=${encodeURIComponent(currentUser.id)}` : ''}`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setPendingList(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Error al cargar pendientes:', err);
    }
  }, [currentUser.id, getAuthHeaders]);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/discount-auth/historial`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setHistoryList(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Error al cargar historial:', err);
    }
  }, [getAuthHeaders]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchPending(), fetchHistory()]);
    setLoading(false);
  }, [fetchPending, fetchHistory]);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchPending(), fetchHistory()]);
    setRefreshing(false);
    toast.success('Datos actualizados');
  };

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Escuchar eventos de sockets en tiempo real
  useEffect(() => {
    const unsubRequest = socketService.on('discount-auth-request', () => {
      fetchPending();
      window.dispatchEvent(new CustomEvent('discount-auth:count-updated'));
    });

    const unsubResponse = socketService.on('discount-auth-response', () => {
      fetchPending();
      fetchHistory();
      window.dispatchEvent(new CustomEvent('discount-auth:count-updated'));
    });

    const unsubCanceled = socketService.on('discount-auth-canceled', (data) => {
      if (data && (data.eventoId || data.solicitudId)) {
        setPendingList(prev => prev.filter(p => String(p.eventoId) !== String(data.eventoId) && Number(p.id) !== Number(data.solicitudId)));
      }
      fetchPending();
      window.dispatchEvent(new CustomEvent('discount-auth:count-updated'));
    });

    return () => {
      if (typeof unsubRequest === 'function') unsubRequest();
      if (typeof unsubResponse === 'function') unsubResponse();
      if (typeof unsubCanceled === 'function') unsubCanceled();
    };
  }, [fetchPending, fetchHistory]);

  const handleOpenActionModal = (item, type) => {
    setActiveActionModal({ item, type });
    setActionReason('');
  };

  const handleCloseActionModal = () => {
    if (submitting) return;
    setActiveActionModal(null);
    setActionReason('');
  };

  const handleSubmitAction = async () => {
    if (!activeActionModal) return;
    const { item, type } = activeActionModal;

    // Validación: Rechazo requiere motivo obligatorio
    if (type === 'rechazar' && !actionReason.trim()) {
      toast.warning('Debes ingresar el motivo del rechazo para informar al vendedor.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/discount-auth/responder`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          solicitudId: item.id,
          autorizadorId: currentUser.id || 'admin',
          estado: type === 'aprobar' ? 'aprobado' : 'rechazado',
          motivo: actionReason.trim() || (type === 'aprobar' ? 'Descuento autorizado' : '')
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Error al procesar la solicitud');
      }

      toast.success(type === 'aprobar' ? 'Descuento autorizado correctamente' : 'Descuento rechazado');
      setActiveActionModal(null);
      setActionReason('');

      // Actualizar listas locales
      setPendingList(prev => prev.filter(x => x.id !== item.id));
      fetchHistory();
      window.dispatchEvent(new CustomEvent('discount-auth:count-updated'));
    } catch (err) {
      toast.error(err.message || 'Error al procesar respuesta');
    } finally {
      setSubmitting(false);
    }
  };

  const formatMoney = (val) => {
    const n = Number(val || 0);
    return `Q ${n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleString('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  // Filtrado de Historial
  const filteredHistory = useMemo(() => {
    let result = [...historyList];
    if (statusFilter !== 'all') {
      result = result.filter(item => item.estado === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(item =>
        (item.eventoNombre || '').toLowerCase().includes(q) ||
        (item.eventoCliente || '').toLowerCase().includes(q) ||
        (item.solicitanteNombre || '').toLowerCase().includes(q) ||
        (item.autorizadorNombre || '').toLowerCase().includes(q) ||
        (item.respuestaMotivo || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [historyList, statusFilter, searchQuery]);

  return (
    <div className="autorizaciones-container">
      {/* CABECERA SUPERIOR */}
      <div className="autorizaciones-header">
        <div className="autorizaciones-title-box">
          <div className="autorizaciones-icon-badge">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <polyline points="9 12 11 14 15 10" />
            </svg>
          </div>
          <div>
            <h1 className="autorizaciones-title">Centro de Autorizaciones</h1>
            <p className="autorizaciones-subtitle">Control ejecutivo de solicitudes de descuento y excepciones de venta</p>
          </div>
        </div>

        <div className="autorizaciones-actions-bar">
          <button
            type="button"
            className="autorizaciones-btn-refresh"
            onClick={handleManualRefresh}
            disabled={refreshing || loading}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }}>
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            <span>{refreshing ? 'Actualizando...' : 'Actualizar'}</span>
          </button>
        </div>
      </div>

      {/* TABS SELECTOR */}
      <div className="autorizaciones-tabs">
        <button
          type="button"
          className={`autorizaciones-tab-btn ${activeTab === 'pendientes' ? 'active' : ''}`}
          onClick={() => setActiveTab('pendientes')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span>Solicitudes Pendientes</span>
          <span className={`autorizaciones-counter-badge ${pendingList.length > 0 ? 'amber' : ''}`}>
            {pendingList.length}
          </span>
        </button>

        <button
          type="button"
          className={`autorizaciones-tab-btn ${activeTab === 'historial' ? 'active' : ''}`}
          onClick={() => setActiveTab('historial')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
          <span>Historial de Resoluciones</span>
          <span className="autorizaciones-counter-badge">
            {historyList.length}
          </span>
        </button>
      </div>

      {/* CONTENIDO TAB 1: PENDIENTES */}
      {activeTab === 'pendientes' && (
        <>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b', fontSize: '13px' }}>
              Cargando solicitudes pendientes...
            </div>
          ) : pendingList.length === 0 ? (
            <div className="autorizaciones-empty-box">
              <div className="autorizaciones-empty-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
              <h3 className="autorizaciones-empty-title">¡Al día! No hay solicitudes pendientes</h3>
              <p className="autorizaciones-empty-desc">
                Todas las cotizaciones con descuento han sido resueltas. Cuando un vendedor envíe una nueva solicitud, aparecerá aquí inmediatamente.
              </p>
            </div>
          ) : (
            <div className="autorizaciones-grid">
              {pendingList.map((item) => {
                const totalConDescuento = Math.max(0, Number(item.eventoTotal || 0) - Number(item.montoDescuento || 0));
                const esPorcentaje = String(item.tipoDescuento || '').toUpperCase() === 'PERCENT';

                return (
                  <div key={item.id} className="autorizaciones-card">
                    <div className="autorizaciones-card-header">
                      <div>
                        <h2 className="autorizaciones-event-name">{item.eventoNombre || 'Evento sin nombre'}</h2>
                        <p className="autorizaciones-client-name">{item.eventoCliente || 'Cliente no especificado'}</p>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                        <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
                          {formatDate(item.fechaSolicitud)}
                        </span>
                        {item.editado && (
                          <span className="autorizaciones-badge-edited" title={`Monto corregido por el vendedor${item.montoAnterior ? ` (Anterior: ${formatMoney(item.montoAnterior)})` : ''}`}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block' }}>
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                            Monto editado
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Metadatos del evento */}
                    <div className="autorizaciones-card-meta">
                      <div className="autorizaciones-meta-item">
                        <span className="autorizaciones-meta-label">Vendedor Solicitante</span>
                        <span className="autorizaciones-meta-value">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                          </svg>
                          {item.solicitanteNombre || item.solicitanteId}
                        </span>
                      </div>
                      <div className="autorizaciones-meta-item">
                        <span className="autorizaciones-meta-label">Salón / Espacio</span>
                        <span className="autorizaciones-meta-value">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                            <path d="M9 3v18" />
                          </svg>
                          {item.eventoSalon || 'Sin asignar'}
                        </span>
                      </div>
                      <div className="autorizaciones-meta-item">
                        <span className="autorizaciones-meta-label">Fecha del Evento</span>
                        <span className="autorizaciones-meta-value">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                            <line x1="16" y1="2" x2="16" y2="6" />
                            <line x1="8" y1="2" x2="8" y2="6" />
                            <line x1="3" y1="10" x2="21" y2="10" />
                          </svg>
                          {item.eventoFecha || '—'}
                        </span>
                      </div>
                      <div className="autorizaciones-meta-item">
                        <span className="autorizaciones-meta-label">Total Cotizado</span>
                        <span className="autorizaciones-meta-value" style={{ fontWeight: 800 }}>
                          {formatMoney(item.eventoTotal)}
                        </span>
                      </div>
                    </div>

                    {/* Banner de Descuento Solicitado */}
                    <div className="autorizaciones-discount-banner">
                      <div className="autorizaciones-discount-box">
                        <span className="autorizaciones-discount-label">
                          Descuento Solicitado {esPorcentaje ? `(${item.valorDescuento}%)` : ''}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                          <span className="autorizaciones-discount-amount">
                            {formatMoney(item.montoDescuento)}
                          </span>
                          {item.editado && Boolean(item.montoAnterior) && (
                            <span style={{ fontSize: '11px', color: '#b45309', textDecoration: 'line-through', fontWeight: 600 }}>
                              {formatMoney(item.montoAnterior)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="autorizaciones-discount-total">
                        <span className="autorizaciones-total-label">Total a Pagar</span>
                        <span className="autorizaciones-total-amount">
                          {formatMoney(totalConDescuento)}
                        </span>
                      </div>
                    </div>

                    {/* Acciones */}
                    <div className="autorizaciones-card-actions">
                      <button
                        type="button"
                        className="autorizaciones-btn-approve"
                        onClick={() => handleOpenActionModal(item, 'aprobar')}
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        <span>Aprobar Descuento</span>
                      </button>

                      <button
                        type="button"
                        className="autorizaciones-btn-reject"
                        onClick={() => handleOpenActionModal(item, 'rechazar')}
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                        <span>Rechazar</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* CONTENIDO TAB 2: HISTORIAL */}
      {activeTab === 'historial' && (
        <div className="autorizaciones-history-wrap">
          {/* Filtros */}
          <div className="autorizaciones-filter-row">
            <div className="autorizaciones-search-wrapper">
              <svg className="autorizaciones-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                className="autorizaciones-search-input"
                placeholder="Buscar por evento, cliente o vendedor..."
                value={searchQuery ?? ''}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="autorizaciones-filter-group">
              <span className="autorizaciones-filter-label">Estado:</span>
              <select
                className="autorizaciones-filter-select"
                value={statusFilter ?? 'all'}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">Todos</option>
                <option value="aprobado">Aprobados</option>
                <option value="rechazado">Rechazados</option>
              </select>
            </div>
          </div>

          {/* Tabla de Historial (Desktop) */}
          <div className="autorizaciones-table-card">
            {filteredHistory.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px 0', color: '#64748b', fontSize: '13px' }}>
                No se encontraron registros en el historial con los filtros aplicados.
              </div>
            ) : (
              <>
                <table className="autorizaciones-table">
                  <thead>
                    <tr>
                      <th>Estado</th>
                      <th>Evento / Cliente</th>
                      <th>Solicitante</th>
                      <th>Descuento</th>
                      <th>Total Evento</th>
                      <th>Resuelto Por</th>
                      <th>Fecha Respuesta</th>
                      <th>Motivo / Nota</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistory.map((item) => {
                      const isApproved = item.estado === 'aprobado';
                      return (
                        <tr key={item.id}>
                          <td>
                            <span className={`autorizaciones-status-pill ${isApproved ? 'approved' : 'rejected'}`}>
                              {isApproved ? '✓ Aprobado' : '✕ Rechazado'}
                            </span>
                          </td>
                          <td>
                            <div style={{ fontWeight: 700, color: '#0f172a' }}>{item.eventoNombre || '—'}</div>
                            <div style={{ fontSize: '11.5px', color: '#64748b' }}>{item.eventoCliente || ''}</div>
                          </td>
                          <td>
                            <span style={{ fontWeight: 600 }}>{item.solicitanteNombre || item.solicitanteId}</span>
                          </td>
                          <td>
                            <div style={{ fontWeight: 800, color: isApproved ? '#059669' : '#dc2626' }}>
                              {formatMoney(item.montoDescuento)}
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>
                              {item.tipoDescuento === 'PERCENT' ? `${item.valorDescuento}%` : 'Monto fijo'}
                            </div>
                          </td>
                          <td style={{ fontWeight: 700 }}>
                            {formatMoney(item.eventoTotal)}
                          </td>
                          <td>
                            <span style={{ fontWeight: 600 }}>{item.autorizadorNombre || item.autorizadorId || '—'}</span>
                          </td>
                          <td style={{ fontSize: '12px', color: '#64748b' }}>
                            {formatDate(item.fechaRespuesta || item.fechaSolicitud)}
                          </td>
                          <td style={{ maxWidth: '240px', fontSize: '12px', color: '#475569' }}>
                            {item.respuestaMotivo ? (
                              <span title={item.respuestaMotivo} style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                {item.respuestaMotivo}
                              </span>
                            ) : (
                              <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Sin nota</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Versión móvil tipo tarjeta para pantallas pequeñas */}
                <div className="autorizaciones-mobile-history-list">
                  {filteredHistory.map((item) => {
                    const isApproved = item.estado === 'aprobado';
                    return (
                      <div key={item.id} className="autorizaciones-mobile-history-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span className={`autorizaciones-status-pill ${isApproved ? 'approved' : 'rejected'}`}>
                            {isApproved ? '✓ Aprobado' : '✕ Rechazado'}
                          </span>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>
                            {formatDate(item.fechaRespuesta)}
                          </span>
                        </div>
                        <div style={{ fontWeight: 800, fontSize: '14px' }}>{item.eventoNombre}</div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>{item.eventoCliente}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: '12.5px' }}>
                          <span>Descuento: <strong style={{ color: isApproved ? '#059669' : '#dc2626' }}>{formatMoney(item.montoDescuento)}</strong></span>
                          <span>Total: <strong>{formatMoney(item.eventoTotal)}</strong></span>
                        </div>
                        {item.respuestaMotivo && (
                          <div style={{ fontSize: '11.5px', background: '#f8fafc', padding: '6px 8px', borderRadius: 6, marginTop: 4, color: '#475569' }}>
                            <strong>Nota:</strong> {item.respuestaMotivo}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* MODAL DE APROBACIÓN O RECHAZO (PORTAL A DOCUMENT.BODY) */}
      {activeActionModal && ReactDOM.createPortal(
        <div className="autorizaciones-modal-overlay" onClick={handleCloseActionModal}>
          <div className="autorizaciones-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="autorizaciones-modal-header">
              <div className="autorizaciones-modal-header-left">
                <div className={`autorizaciones-modal-icon-badge ${activeActionModal.type === 'aprobar' ? 'approve' : 'reject'}`}>
                  {activeActionModal.type === 'aprobar' ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  )}
                </div>
                <div>
                  <h3 className="autorizaciones-modal-title">
                    {activeActionModal.type === 'aprobar' ? 'Autorizar Descuento' : 'Rechazar Descuento'}
                  </h3>
                  <p className="autorizaciones-modal-subtitle">
                    {activeActionModal.type === 'aprobar' ? 'Aprobación de tarifa comercial preferencial' : 'Resolución de excepción de precio'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="autorizaciones-modal-close"
                onClick={handleCloseActionModal}
                disabled={submitting}
                aria-label="Cerrar modal"
                title="Cerrar"
                style={{
                  width: 32,
                  height: 32,
                  minWidth: 32,
                  maxWidth: 32,
                  minHeight: 32,
                  maxHeight: 32,
                  padding: 0,
                  margin: 0,
                  boxSizing: 'border-box'
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: '16px', height: '16px', display: 'block' }}>
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="autorizaciones-modal-body">
              <div className="autorizaciones-modal-summary">
                <div className="autorizaciones-modal-summary-row">
                  <span className="autorizaciones-modal-summary-label">Evento:</span>
                  <span className="autorizaciones-modal-summary-value">{activeActionModal.item.eventoNombre}</span>
                </div>
                <div className="autorizaciones-modal-summary-row">
                  <span className="autorizaciones-modal-summary-label">Cliente:</span>
                  <span className="autorizaciones-modal-summary-value">{activeActionModal.item.eventoCliente || '—'}</span>
                </div>
                <div className="autorizaciones-modal-discount-pill">
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>Descuento a evaluar:</span>
                  <span style={{ color: activeActionModal.type === 'aprobar' ? '#059669' : '#dc2626', fontWeight: 800, fontSize: '15px' }}>
                    {formatMoney(activeActionModal.item.montoDescuento)}
                  </span>
                </div>
              </div>

              <div className="autorizaciones-modal-field">
                <label className="autorizaciones-modal-label">
                  {activeActionModal.type === 'aprobar' ? 'Nota o condición adicional (opcional):' : 'Motivo del rechazo (obligatorio para el vendedor): *'}
                </label>
                <textarea
                  className="autorizaciones-modal-textarea"
                  placeholder={activeActionModal.type === 'aprobar' ? 'Ej. Autorizado con condición de pago al contado...' : 'Ej. El margen del paquete no permite descuento mayor al 5%...'}
                  value={actionReason ?? ''}
                  onChange={(e) => setActionReason(e.target.value)}
                  disabled={submitting}
                  maxLength={500}
                />
              </div>
            </div>

            <div className="autorizaciones-modal-footer">
              <button
                type="button"
                className="autorizaciones-modal-btn-cancel"
                onClick={handleCloseActionModal}
                disabled={submitting}
              >
                Cancelar
              </button>

              <button
                type="button"
                className={`autorizaciones-modal-btn-confirm ${activeActionModal.type === 'aprobar' ? 'approve' : 'reject'}`}
                onClick={handleSubmitAction}
                disabled={submitting}
              >
                {submitting ? 'Procesando...' : activeActionModal.type === 'aprobar' ? 'Confirmar Aprobación' : 'Confirmar Rechazo'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
