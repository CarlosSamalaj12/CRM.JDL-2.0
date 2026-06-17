import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

// Importar estilos globales copiados del monolito (scoped to body:not(.informes-theme))
import './styles/global-scoped.css';
import './styles/design-system-scoped.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
