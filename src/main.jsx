import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import Swal from 'sweetalert2';

// Importar estilos globales copiados del monolito (scoped to body:not(.informes-theme))
import './styles/global-scoped.css';
import './styles/design-system-scoped.css';
import './styles/responsive-mobile.css';

// SweetAlert2: evitar warning aria-hidden + elemento con foco
const origFire = Swal.fire.bind(Swal);
Swal.fire = function patchedFire(...args) {
  if (document.activeElement && typeof document.activeElement.blur === 'function') {
    document.activeElement.blur();
  }
  return origFire(...args);
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
