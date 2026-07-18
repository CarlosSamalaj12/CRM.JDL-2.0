import React, { useState, useMemo, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import ErrorBoundary from '../../components/ErrorBoundary';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import Legend from './components/Legend';
import eventService from '../../services/eventService';
import salonService from '../../services/salonService';
import { useVersionCheck } from '../../hooks/useVersionCheck';
import ForceUpdateModal from '../../components/ForceUpdateModal';
import VersionFooter from '../../components/VersionFooter';
import authService from '../../services/authService';
import socketService from '../../services/socketService';
import { loadState, saveState } from '../../services/stateService';
import api from '../../services/api';
import Swal from 'sweetalert2';
import { toast } from '../../utils/toast';

// Caché en memoria para persistencia de datos del CRM entre cambios de layout
let memoryCache = null;

export default function MainLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const isCalendarView = location.pathname === '/calendar' || location.pathname === '/nueva-reserva' || location.pathname.startsWith('/reserva/');
  // Sistema de control de versiones: polling cada 3h, modal obligatorio si hay update
  const { updateState, serverVersion, currentVersion, reload } = useVersionCheck({
    intervalMs: 3 * 60 * 60 * 1000,
  });
  
  const getStartOfWeek = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.setDate(diff));
  };

  const [viewMode, setViewMode] = useState('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [customTitle, setCustomTitle] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [roomFilter, setRoomFilter] = useState('all');
  const [sellerFilter, setSellerFilter] = useState(() => {
    return localStorage.getItem('calendar_sellerFilter') || 'all';
  });
  const [loading, setLoading] = useState(true);

  // Siempre iniciar en la semana actual cuando se cambia a vista semanal
  useEffect(() => {
    if (viewMode === 'week') {
      setCurrentDate(new Date());
    }
  }, [viewMode]);

  // Handler para cambio de vista
  const handleViewModeChange = (newMode) => {
    if (newMode === 'week') {
      setCurrentDate(new Date());
    }
    setViewMode(newMode);
  };
  
  const [events, setEvents] = useState([]);
  const [salones, setSalones] = useState([]);
  const [users, setUsers] = useState([]);
  const [occupancyWeeklyOps, setOccupancyWeeklyOps] = useState({});
  const [reminders, setReminders] = useState({});
  const [salonConflictDisabled, setSalonConflictDisabled] = useState([]);

  async function loadInitialData(useCache = true) {
    if (useCache && memoryCache) {
      setEvents(memoryCache.events);
      setSalones(memoryCache.salones);
      setUsers(memoryCache.users);
      setOccupancyWeeklyOps(memoryCache.occupancyWeeklyOps);
      setReminders(memoryCache.reminders);
      setSalonConflictDisabled(memoryCache.salonConflictDisabled || []);
      setLoading(false);
      // Cargar del servidor en segundo plano de forma silenciosa
      loadInitialDataFromServer(true);
      return;
    }
    await loadInitialDataFromServer(false);
  }

  async function loadInitialDataFromServer(isBackground) {
    try {
      if (!isBackground) {
        setLoading(true);
      }
      
      // Una única petición combinada en lugar de 3 consultas redundantes a /api/state
      const [stateRes, usersData] = await Promise.all([
        loadState().catch(() => ({})),
        authService.getLoginUsers().catch(() => [])
      ]);
      
      const eventsData = stateRes?.events || [];
      const salonesData = stateRes?.salones || [];
      const stateUsers = stateRes?.users || [];
      // Usar stateUsers (datos completos con goalTiers, salesTargetEnabled, etc.)
      // en lugar de usersData del endpoint de login que solo trae columnas básicas
      const loadedUsers = stateUsers.length > 0 ? stateUsers : usersData;
      const loadedOps = (stateRes?.occupancyWeeklyOps && typeof stateRes.occupancyWeeklyOps === 'object') 
        ? stateRes.occupancyWeeklyOps 
        : {};
      const loadedReminders = stateRes?.reminders || {};
      const loadedNoConflict = Array.isArray(stateRes?.salonConflictDisabled) ? stateRes.salonConflictDisabled : [];

      memoryCache = {
        events: eventsData,
        salones: salonesData,
        users: loadedUsers,
        occupancyWeeklyOps: loadedOps,
        reminders: loadedReminders,
        salonConflictDisabled: loadedNoConflict
      };

      setEvents(eventsData);
      setSalones(salonesData);
      setUsers(loadedUsers);
      setOccupancyWeeklyOps(loadedOps);
      setReminders(loadedReminders);
      setSalonConflictDisabled(loadedNoConflict);
    } catch (err) {
      console.error('Error cargando datos:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!authService.getCurrentUser()) {
      memoryCache = null; // Limpiar caché en desautenticación
      navigate('/login', { replace: true });
      return undefined;
    }

    socketService.connect();

    loadInitialData(true);

    const unsubscribeState = socketService.on('state-updated', () => {
      loadInitialData(true);
    });

    const unsubscribeEntity = socketService.on('entity:changed', () => {
      loadInitialData(true);
    });

    const unsubDiscountAuth = socketService.on('discount-auth-request', (data) => {
      const curUser = authService.getCurrentUser();
      if (curUser?.canAuthorizeDiscount !== true) return;
      if (data.autorizadorId && data.autorizadorId !== curUser.id) return;

      const eventName = data.eventoNombre || data.eventoId || 'Desconocido';
      const clientName = data.eventoCliente || '—';
      const amount = `Q ${Number(data.montoDescuento || 0).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`;

      Swal.fire({
        title: 'Solicitud de autorización',
        html: `
          <div style="text-align:left;font-size:13px">
            <p><strong>Evento:</strong> ${eventName}</p>
            <p><strong>Cliente:</strong> ${clientName}</p>
            <p><strong>Descuento:</strong> ${amount}</p>
            ${data.eventoSalon ? `<p><strong>Salón:</strong> ${data.eventoSalon}</p>` : ''}
            ${data.eventoFecha ? `<p><strong>Fecha:</strong> ${data.eventoFecha}</p>` : ''}
            <hr style="margin:10px 0">
            <p style="font-size:12px;color:#64748b;">¿Autorizas este descuento?</p>
          </div>
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: '✅ Aprobar',
        cancelButtonText: '❌ Rechazar',
        confirmButtonColor: '#059669',
        cancelButtonColor: '#dc2626',
        showDenyButton: true,
        denyButtonText: '🔙 Revisar después',
        denyButtonColor: '#6b7280',
        input: 'textarea',
        inputPlaceholder: 'Motivo (opcional, requerido si rechazas)',
        inputValidator: (value) => {
          if (value && value.trim().length > 500) return 'Máximo 500 caracteres';
        },
        preDeny: () => { Swal.close(); },
      }).then(async (result) => {
        if (result.isConfirmed) {
          try {
            await api.post('/api/discount-auth/responder', {
              solicitudId: data.solicitudId,
              autorizadorId: curUser.id,
              estado: 'aprobado',
              motivo: result.value || '',
            });
            Swal.fire('Aprobado', 'Descuento autorizado correctamente', 'success');
          } catch (err) {
            Swal.fire('Error', err.message || 'No se pudo procesar la respuesta', 'error');
          }
        } else if (result.dismiss === Swal.DismissReason.cancel) {
          try {
            await api.post('/api/discount-auth/responder', {
              solicitudId: data.solicitudId,
              autorizadorId: curUser.id,
              estado: 'rechazado',
              motivo: result.value || '',
            });
            Swal.fire('Rechazado', 'Descuento rechazado', 'info');
          } catch (err) {
            Swal.fire('Error', err.message || 'No se pudo procesar la respuesta', 'error');
          }
        }
      });
    });

    return () => {
      unsubscribeState();
      unsubscribeEntity();
      unsubDiscountAuth();
    };
  }, [navigate]);

  // Auto-filtrar por el usuario actual al entrar al calendario
  useEffect(() => {
    const currentUser = authService.getCurrentUser();
    if (currentUser?.id) {
      const role = String(currentUser.role || '').trim().toLowerCase();
      const saved = localStorage.getItem('calendar_sellerFilter');

      if (!saved) {
        // Primera vez: auto-filtrar solo para no-admins
        if (role !== 'admin') {
          setSellerFilter(currentUser.id);
        }
      } else if (role !== 'admin' && saved !== currentUser.id && saved !== 'all') {
        // Un vendedor diferente inició sesión y el filtro guardado era para otro usuario específico
        // Reajustar a sus propios eventos
        setSellerFilter(currentUser.id);
      }
      // Para admin: respetar siempre el filtro guardado (ya se inicializó desde useState)
      // Para no-admin con filtro 'all' o su propio ID: respetar el filtro guardado
    }
  }, []);

  // Guardar el filtro de vendedor en localStorage cuando cambie
  useEffect(() => {
    localStorage.setItem('calendar_sellerFilter', sellerFilter);
  }, [sellerFilter]);

  const handleAddEvent = async (eventData) => {
    try {
      const isEditing = !!eventData.id;
      let savedEvent;
      
      if (isEditing) {
        savedEvent = await eventService.update(eventData.id, eventData);
      } else {
        savedEvent = await eventService.create(eventData);
      }

      // Forzar recarga completa del servidor para actualizar la caché en memoria
      await loadInitialData(false);
      
      return savedEvent;
    } catch (err) {
      console.error('Error guardando evento:', err);
      toast('Error al guardar el evento');
      throw err;
    }
  };

  const handleDeleteEvent = async (eventId) => {
    try {
      await eventService.delete(eventId);
      // Forzar recarga completa del servidor para actualizar la caché en memoria
      await loadInitialData(false);
    } catch (err) {
      console.error('Error eliminando evento:', err);
      toast('Error al eliminar el evento');
    }
  };

  const handleUpdateEventStatus = async (eventId, status) => {
    try {
      await eventService.updateStatus(eventId, status);
      // Forzar recarga completa del servidor para actualizar la caché en memoria
      await loadInitialData(false);
    } catch (err) {
      console.error('Error actualizando estado:', err);
      toast('Error al actualizar el estado');
    }
  };

  const handleUpdateOccupancyOps = async (weekIso, dayIso, values) => {
    const weekKey = String(weekIso || '').trim();
    const dayKey = String(dayIso || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(weekKey) || !/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) return;
    
    let newOps = {};
    setOccupancyWeeklyOps(prev => {
      const weekData = prev[weekKey] || {};
      const current = weekData[dayKey] || { breakfasts: 0, rooms: 0 };
      const breakfasts = Math.max(0, Math.floor(Number(values?.breakfasts ?? current.breakfasts ?? 0)));
      const rooms = Math.max(0, Math.floor(Number(values?.rooms ?? current.rooms ?? 0)));
      newOps = {
        ...prev,
        [weekKey]: {
          ...weekData,
          [dayKey]: { breakfasts, rooms }
        }
      };
      return newOps;
    });

    try {
      const currentState = await loadState();
      await saveState({ ...currentState, occupancyWeeklyOps: newOps });
    } catch (err) {
      console.error('Error guardando occupancyOps:', err);
    }
  };

  const dateRangeLabel = useMemo(() => {
    const options = { day: 'numeric', month: 'short' };
    
    if (viewMode === 'day') {
      return currentDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
    } else if (viewMode === 'week') {
      const start = new Date(currentDate);
      
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      
      return `${start.toLocaleDateString('es-ES', options)} - ${end.toLocaleDateString('es-ES', options)} ${end.getFullYear()}`;
    } else if (viewMode === 'year') {
      return currentDate.getFullYear().toString();
    } else if (viewMode === 'agenda') {
      return `Agenda - ${currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}`.toUpperCase();
    } else {
      return currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase();
    }
  }, [currentDate, viewMode]);

  const handleGoToday = () => {
    setCurrentDate(new Date());
  };

  const handlePrev = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'day') newDate.setDate(newDate.getDate() - 1);
    else if (viewMode === 'week') newDate.setDate(newDate.getDate() - 7);
    else if (viewMode === 'year') newDate.setFullYear(newDate.getFullYear() - 1);
    else newDate.setMonth(newDate.getMonth() - 1);
    setCurrentDate(newDate);
  };

  const handleNext = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'day') newDate.setDate(newDate.getDate() + 1);
    else if (viewMode === 'week') newDate.setDate(newDate.getDate() + 7);
    else if (viewMode === 'year') newDate.setFullYear(newDate.getFullYear() + 1);
    else newDate.setMonth(newDate.getMonth() + 1);
    setCurrentDate(newDate);
  };

  return (
    <div className="app lum-calendar" id="appShell" style={{ position: 'relative', minHeight: '100vh' }}>
      <Sidebar events={events} users={users} reminders={reminders} />
      
      <div className="lum-main" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        {isCalendarView && (
          <>
            <Topbar 
              viewMode={viewMode} 
              setViewMode={handleViewModeChange} 
              dateLabel={customTitle || dateRangeLabel}
              onToday={handleGoToday}
              onPrev={handlePrev}
              onNext={handleNext}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              isCalendarView={isCalendarView}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              roomFilter={roomFilter}
              setRoomFilter={setRoomFilter}
              salones={salones}
              sellerFilter={sellerFilter}
              setSellerFilter={setSellerFilter}
              users={users}
            />
            <Legend />
          </>
        )}
        
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'auto', position: 'relative' }}>
          {/* Subtle top indicator bar (fixed to the absolute top of the browser viewport) */}
          {loading && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              height: '3px',
              background: 'linear-gradient(90deg, #18c5bc 0%, #0c7f7b 50%, #18c5bc 100%)',
              backgroundSize: '200% 100%',
              animation: 'loadingProgress 1.5s infinite linear',
              zIndex: 10000,
              pointerEvents: 'none'
            }} />
          )}

          <ErrorBoundary>
            <Outlet context={{ 
              viewMode, 
              setViewMode,
              currentDate, 
              setCurrentDate,
              customTitle, 
              setCustomTitle,
              events, 
              salones,
              users,
              handleAddEvent,
              handleDeleteEvent,
              handleUpdateEventStatus,
              refreshData: loadInitialData,
              loadingData: loading,
              statusFilter,
              setStatusFilter,
              searchQuery,
              setSearchQuery,
              roomFilter,
              setRoomFilter,
              sellerFilter,
              setSellerFilter,
              occupancyWeeklyOps,
              handleUpdateOccupancyOps,
              salonConflictDisabled
            }} />
          </ErrorBoundary>
        </div>
      </div>
      
      <div className="toast" id="toast" aria-live="polite"></div>

      {/* Footer con versión actual + server (control de versiones) */}
      <VersionFooter style={{ position: 'fixed', bottom: 0, right: 0, zIndex: 1000 }} />

      {/* Modal obligatorio si hay una versión más reciente en el server */}
      <ForceUpdateModal
        open={!!updateState}
        serverVersion={updateState?.serverVersion || serverVersion}
        currentVersion={currentVersion}
        message={updateState?.message}
        reason={updateState?.reason}
        onUpdate={reload}
      />
    </div>
  );
}
