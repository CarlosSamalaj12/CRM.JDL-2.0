import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

import './styles/global-scoped.css';
import './styles/design-system-scoped.css';
import './styles/responsive-mobile.css';


ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);