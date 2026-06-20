import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import authService from '../../../services/authService';

function mapRole(role) {
  const raw = String(role || '').trim().toLowerCase();
  if (raw === 'admin') return 'Admin';
  if (raw === 'frontoffice' || raw === 'front_office' || raw === 'recepcionista') return 'FrontOffice';
  if (raw === 'vendedor' || raw === 'sales') return 'Vendedor';
  if (raw === 'coordinador') return 'Coordinador';
  if (raw === 'eventos') return 'Eventos';
  return role || '';
}

export default function ProtectedRoute({ children, allowedRoles }) {
  const auth = useAuth();

  if (auth.loading) {
    return (
      <div className="status-message" style={{ margin: '2rem auto', maxWidth: 400 }}>
        Verificando sesión...
      </div>
    );
  }
  
  // Obtener sesión: primero del AuthContext, si no hay, leer directamente de localStorage
  const token = auth.token || localStorage.getItem('token');
  let user = auth.user;
  
  if (!user && token) {
    const rawUser = authService.getCurrentUser();
    if (rawUser) {
      user = {
        ...rawUser,
        nombre: rawUser.nombre || rawUser.fullName || rawUser.name || '',
        rol: mapRole(rawUser.rol || rawUser.role),
        email: rawUser.email || rawUser.correo || '',
      };
    }
  }

  if (!user || !token) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.rol)) {
    return <Navigate to="/" replace />;
  }

  return children;
}
