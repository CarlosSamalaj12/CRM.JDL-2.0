import React, { useState, useMemo, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import Legend from './components/Legend';
import eventService from '../../services/eventService';
import salonService from '../../services/salonService';
import authService from '../../services/authService';
import socketService from '../../services/socketService';

export default function MainLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const isCalendarView = location.pathname === '/calendar' || location.pathname === '/nueva-reserva' || location.pathname.startsWith('/reserva/');
  
  const getStartOfWeek = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.setDate(diff));
  };

  const [viewMode, setViewMode] = useState('week');
  const [currentDate, setCurrentDate] = useState(getStartOfWeek(new Date()));
  const [customTitle, setCustomTitle] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [roomFilter, setRoomFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  // Siempre iniciar en la semana actual cuando se cambia a vista semanal
  useEffect(() => {
    if (viewMode === 'week') {
      setCurrentDate(getStartOfWeek(new Date()));
    }
  }, [viewMode]);

  // Handler para cambio de vista
  const handleViewModeChange = (newMode) => {
    if (newMode === 'week') {
      setCurrentDate(getStartOfWeek(new Date()));
    }
    setViewMode(newMode);
  };
  
  const [events, setEvents] = useState([]);
  const [salones, setSalones] = useState([]);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    const user = authService.getCurrentUser();
    if (!user) {
      navigate('/login');
      return;
    }
    socketService.connect();
    
    // Cargar datos iniciales al montar el layout
    loadInitialData();
    
    const unsubscribeState = socketService.on('state-updated', () => {
      loadInitialData();
    });

    return () => {
      unsubscribeState();
    };
  }, [navigate]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      
      const [eventsData, salonesData, usersData] = await Promise.all([
        eventService.getAll(),
        salonService.getAll(),
        authService.getLoginUsers(),
      ]);
      
      setEvents(eventsData);
      setSalones(salonesData);
      setUsers(usersData);
    } catch (err) {
      console.error('Error cargando datos:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddEvent = async (eventData) => {
    try {
      const isEditing = !!eventData.id;
      let savedEvent;
      
      if (isEditing) {
        savedEvent = await eventService.update(eventData.id, eventData);
        setEvents(prev => prev.map(ev => ev.id === eventData.id ? savedEvent : ev));
      } else {
        savedEvent = await eventService.create(eventData);
        setEvents(prev => [...prev, savedEvent]);
      }
      
      return savedEvent;
    } catch (err) {
      console.error('Error guardando evento:', err);
      alert('Error al guardar el evento');
      throw err;
    }
  };

  const handleDeleteEvent = async (eventId) => {
    try {
      await eventService.delete(eventId);
      setEvents(prev => prev.filter(ev => ev.id !== eventId));
    } catch (err) {
      console.error('Error eliminando evento:', err);
      alert('Error al eliminar el evento');
    }
  };

  const handleUpdateEventStatus = async (eventId, status) => {
    try {
      await eventService.updateStatus(eventId, status);
      setEvents(prev => prev.map(ev => ev.id === eventId ? { ...ev, status } : ev));
    } catch (err) {
      console.error('Error actualizando estado:', err);
      alert('Error al actualizar el estado');
    }
  };

  const dateRangeLabel = useMemo(() => {
    const options = { day: 'numeric', month: 'short' };
    
    if (viewMode === 'day') {
      return currentDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
    } else if (viewMode === 'week') {
      const start = new Date(currentDate);
      const day = start.getDay();
      const diff = start.getDate() - day;
      start.setDate(diff);
      
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
      <Sidebar />
      
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
            setRoomFilter
          }} />
        </div>
      </div>
      
      <div className="toast" id="toast" aria-live="polite"></div>
    </div>
  );
}