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

function CrmProtectedRoute({ children }) {
  const user = authService.getCurrentUser();
  return user ? children : <Navigate to="/login" replace />;
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
                <Route path="/catalog" element={<ProtectedRoute><Catalog /></ProtectedRoute>} />
                <Route path="/informe/pos/:id_ocupacion" element={<ProtectedRoute><ConstructorInforme /></ProtectedRoute>} />
                <Route path="/informe/create/:id_ocupacion" element={<ProtectedRoute><InformeCreator /></ProtectedRoute>} />
                <Route path="/informe/:id" element={<ProtectedRoute><InformeView /></ProtectedRoute>} />
                <Route path="/config" element={<ProtectedRoute allowedRoles={['Admin', 'Vendedor', 'FrontOffice']}><Configuracion /></ProtectedRoute>} />
              </Route>

              <Route path="/" element={<CrmProtectedRoute><MainLayout /></CrmProtectedRoute>}>
                <Route index element={<Navigate to="/calendar" replace />} />
                <Route path="calendar" element={<Calendar />} />
                <Route path="nueva-reserva" element={<Calendar />} />
                <Route path="reserva/:id" element={<Calendar />} />
                <Route path="customers" element={<CustomersModule />} />
                <Route path="reports" element={<ReportsModule />} />
                <Route path="settings" element={<SettingsMain />} />
                <Route path="support" element={<SupportModule />} />
                <Route path="search" element={<SearchModule />} />
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
