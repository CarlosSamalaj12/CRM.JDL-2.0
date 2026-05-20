import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout/MainLayout';
import Login from './modules/auth/Login';
import Calendar from './modules/calendar/Calendar';
import ReservationForm from './modules/calendar/components/ReservationForm';
import CustomersModule from './modules/customers/CustomersModule';
import ReportsModule from './modules/reports/ReportsModule';
import SearchModule from './modules/search/SearchModule';
// import HubModule from './modules/shared/HubModule'; // Hub view removed per user request
import SettingsMain from './modules/settings/SettingsMain';
import { SupportModule } from './modules/shared/GenericModule';

function App() {
  return (
    <Router>
      <Routes>
        {/* Ruta pública */}
        <Route path="/login" element={<Login />} />

        {/* Rutas privadas envueltas en el MainLayout */}
        <Route path="/" element={<MainLayout />}>
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

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
