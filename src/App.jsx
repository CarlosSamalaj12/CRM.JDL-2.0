import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout/MainLayout';
import Login from './modules/auth/Login';
import Calendar from './modules/calendar/Calendar';
import CustomersModule from './modules/customers/CustomersModule';
import ReportsModule from './modules/reports/ReportsModule';
import SearchModule from './modules/search/SearchModule';
import SettingsMain from './modules/settings/SettingsMain';
import { SupportModule } from './modules/shared/GenericModule';
import authService from './services/authService';

import ErrorBoundary from './components/ErrorBoundary';
import Kanban from './modules/informes/pages/Kanban';
import Catalog from './modules/informes/pages/Catalog';
import ConstructorInforme from './modules/informes/pages/ConstructorInforme';
import InformeCreator from './modules/informes/pages/InformeCreator';
import InformeView from './modules/informes/pages/InformeView';
import Configuracion from './modules/informes/pages/Configuracion';
import Dashboard from './modules/informes/pages/Dashboard';
import ReportsLayout from './modules/informes/components/ReportsLayout';
import ProtectedRoute from './modules/informes/components/ProtectedRoute';

import { AuthProvider } from './modules/informes/context/AuthContext';
import { ToastProvider } from './modules/informes/context/ToastContext';
import { SocketProvider } from './modules/informes/context/SocketContext';

function getHomePath(user) {
  if (!user) return '/login';
  const role = String(user.role || '').trim().toLowerCase();
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
  return (
    <Router>
      <ErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <SocketProvider>
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
          </SocketProvider>
        </ToastProvider>
      </AuthProvider>
      </ErrorBoundary>
    </Router>
  );
}

export default App;
