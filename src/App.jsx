import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import React, { Suspense, lazy } from 'react';
import MainLayout from './layouts/MainLayout/MainLayout';
import { SupportModule } from './modules/shared/GenericModule';
import authService from './services/authService';

import ErrorBoundary from './components/ErrorBoundary';
import ProtectedRoute from './modules/informes/components/ProtectedRoute';
import ReportsLayout from './modules/informes/components/ReportsLayout';

import { AuthProvider } from './modules/informes/context/AuthContext';
import { ToastProvider } from './modules/informes/context/ToastContext';
import { SocketProvider } from './modules/informes/context/SocketContext';

const Login = lazy(() => import('./modules/auth/Login'));
const Calendar = lazy(() => import('./modules/calendar/Calendar'));
const CustomersModule = lazy(() => import('./modules/customers/CustomersModule'));
const ReportsModule = lazy(() => import('./modules/reports/ReportsModule'));
const SearchModule = lazy(() => import('./modules/search/SearchModule'));
const SettingsMain = lazy(() => import('./modules/settings/SettingsMain'));
const Kanban = lazy(() => import('./modules/informes/pages/Kanban'));
const Catalog = lazy(() => import('./modules/informes/pages/Catalog'));
const ConstructorInforme = lazy(() => import('./modules/informes/pages/ConstructorInforme'));
const InformeCreator = lazy(() => import('./modules/informes/pages/InformeCreator'));
const InformeView = lazy(() => import('./modules/informes/pages/InformeView'));
const Configuracion = lazy(() => import('./modules/informes/pages/Configuracion'));
const Dashboard = lazy(() => import('./modules/informes/pages/Dashboard'));

function getHomePath(user) {
  if (!user) return '/login';
  const role = String(user.rol || user.role || '').trim().toLowerCase();
  if (['admin', 'vendedor', 'recepcionista', 'frontoffice', 'front_office'].includes(role)) {
    return '/calendar';
  }
  if (['eventos', 'coordinador'].includes(role)) {
    return '/kanban';
  }
  return '/kanban';
}

function CrmProtectedRoute({ children }) {
  const user = authService.getCurrentUser();
  return user ? children : <Navigate to="/login" replace />;
}

function RoleRoute({ children, roles }) {
  const user = authService.getCurrentUser();
  if (!user) return <Navigate to="/login" replace />;
  const userRole = String(user.role || '').trim().toLowerCase();
  const normalizedRoles = (roles || []).map(r => String(r).trim().toLowerCase());
  if (normalizedRoles.includes('recepcionista')) {
    if (!normalizedRoles.includes('frontoffice')) normalizedRoles.push('frontoffice');
    if (!normalizedRoles.includes('front_office')) normalizedRoles.push('front_office');
  }
  if (!normalizedRoles.includes(userRole)) return <Navigate to={getHomePath(user)} replace />;
  return children;
}

function HomeRedirect() {
  const user = authService.getCurrentUser();
  return <Navigate to={getHomePath(user)} replace />;
}

function App() {
  React.useEffect(() => {
    const handleSWMessage = (event) => {
      if (event.data && event.data.type === 'NAVIGATE_TO' && event.data.url) {
        console.log('[SW Message] Redirigiendo vía mensaje:', event.data.url);
        window.location.href = event.data.url;
      }
    };
    
    // Escuchar a través del canal de Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleSWMessage);

      const syncActiveUser = () => {
        const user = authService.getCurrentUser();
        if (user && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: 'SET_ACTIVE_USER',
            userId: user.id
          });
        }
      };

      // Sincronizar usuario activo ahora
      syncActiveUser();
      // Sincronizar si cambia el controlador del Service Worker
      navigator.serviceWorker.addEventListener('controllerchange', syncActiveUser);
    }
    // Escuchar a través del objeto window global de forma cruzada
    window.addEventListener('message', handleSWMessage);
    
    return () => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleSWMessage);
      }
      window.removeEventListener('message', handleSWMessage);
    };
  }, []);

  return (
    <Router>
      <ErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <SocketProvider>
            <Suspense fallback={<div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:'100vh', color:'#64748b' }}>Cargando...</div>}>
            <Routes>
              <Route path="/login" element={<Login />} />

              <Route element={<ReportsLayout />}>
                <Route path="/informes" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/kanban" element={<ProtectedRoute><Kanban /></ProtectedRoute>} />
                <Route path="/catalog" element={<ProtectedRoute allowedRoles={['Admin', 'Vendedor', 'FrontOffice', 'Eventos']}><Catalog /></ProtectedRoute>} />
                <Route path="/informe/pos/:id_ocupacion" element={<ProtectedRoute allowedRoles={['Admin', 'Vendedor', 'FrontOffice']}><ConstructorInforme /></ProtectedRoute>} />
                <Route path="/informe/create/:id_ocupacion" element={<ProtectedRoute allowedRoles={['Admin', 'Vendedor', 'FrontOffice']}><InformeCreator /></ProtectedRoute>} />
                <Route path="/informe/:id" element={<ProtectedRoute allowedRoles={['Admin', 'Vendedor', 'FrontOffice', 'Eventos', 'Coordinador']}><InformeView /></ProtectedRoute>} />
                <Route path="/config" element={<ProtectedRoute allowedRoles={['Admin', 'Vendedor', 'FrontOffice', 'Eventos']}><Configuracion /></ProtectedRoute>} />
              </Route>

              <Route path="/" element={<CrmProtectedRoute><MainLayout /></CrmProtectedRoute>}>
                <Route index element={<HomeRedirect />} />
                <Route path="calendar" element={<RoleRoute roles={['admin','vendedor','recepcionista']}><Calendar /></RoleRoute>} />
                <Route path="nueva-reserva" element={<RoleRoute roles={['admin','vendedor','recepcionista']}><Calendar /></RoleRoute>} />
                <Route path="reserva/:id" element={<RoleRoute roles={['admin','vendedor','recepcionista']}><Calendar /></RoleRoute>} />
                <Route path="customers" element={<RoleRoute roles={['admin','vendedor','recepcionista']}><CustomersModule /></RoleRoute>} />
                <Route path="reports" element={<RoleRoute roles={['admin','vendedor','recepcionista']}><ReportsModule /></RoleRoute>} />
                <Route path="settings" element={<RoleRoute roles={['admin']}><SettingsMain /></RoleRoute>} />
                <Route path="support" element={<SupportModule />} />
                <Route path="search" element={<RoleRoute roles={['admin','vendedor','recepcionista']}><SearchModule /></RoleRoute>} />
              </Route>

              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
            </Suspense>
          </SocketProvider>
        </ToastProvider>
      </AuthProvider>
      </ErrorBoundary>
    </Router>
  );
}

export default App;
