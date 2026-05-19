import React from 'react';
import { STATUS_META_LIST } from '../../../modules/calendar/constants';

export default function Legend() {
  return (
    <section 
      className="legend" 
      id="legend" 
      style={{ 
        display: 'flex', 
        alignItems: 'flex-start', // Alinea los items al inicio de su fila
        alignContent: 'flex-start', // Pega las filas entre sí
        justifyContent: 'flex-start',
        flexWrap: 'wrap', 
        gap: '8px 12px', // 8px de separación vertical entre filas, 12px entre pastillas
        padding: '10px 20px', // Reducimos padding vertical para que no se separen
        background: 'transparent',
        border: 'none',
        width: '100%',
        height: 'auto', // Que la altura sea la que necesiten las filas, ni más ni menos
        overflow: 'hidden', // Matamos la barra de desplazamiento
        boxSizing: 'border-box'
      }}
    >
      {STATUS_META_LIST.map((status) => (
        <div key={status.key} style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px', 
          fontSize: '12px', 
          fontWeight: '700', 
          color: '#334155',
          padding: '4px 12px',
          borderRadius: '999px',
          border: '1px solid #d3e4fe',
          background: '#f8fbff',
          whiteSpace: 'nowrap',
          boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
        }}>
          <span style={{ 
            width: '8px', 
            height: '8px', 
            borderRadius: '50%', 
            background: status.color,
            boxShadow: `0 0 4px ${status.color}55`
          }}></span>
          <span>{status.key}</span>
        </div>
      ))}
    </section>
  );
}
