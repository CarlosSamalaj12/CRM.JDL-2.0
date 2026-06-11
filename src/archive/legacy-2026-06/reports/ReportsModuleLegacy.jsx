import React from 'react';

export default function ReportsModuleLegacy() {
  const eventSummary = [
    { estado: 'Confirmado', cantidad: 12, porcentaje: '50%' },
    { estado: 'Pre-reserva', cantidad: 8, porcentaje: '33%' },
    { estado: 'Seguimiento', cantidad: 3, porcentaje: '12%' },
    { estado: 'Cancelado', cantidad: 1, porcentaje: '5%' },
  ];

  const salonOccupancy = [
    { salon: 'Salón Las Flores', eventos: 15, diasLibres: 15 },
    { salon: 'Salón El Lago', eventos: 10, diasLibres: 20 },
    { salon: 'Jardín Principal', eventos: 5, diasLibres: 25 },
    { salon: 'Terraza', eventos: 12, diasLibres: 18 },
  ];

  return (
    <div style={{ padding: '20px', background: '#fff', height: '100%', overflowY: 'auto' }}>
      
      <h2 style={{ fontSize: '18px', borderBottom: '2px solid #334155', paddingBottom: '10px', marginBottom: '20px' }}>
        REPORTE GENERAL DE OPERACIONES
      </h2>

      {/* Tabla 1 */}
      <div style={{ marginBottom: '40px' }}>
        <h3 style={{ fontSize: '14px', color: '#64748b', textTransform: 'uppercase', marginBottom: '10px' }}>Resumen por Estado de Reserva</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #e2e8f0' }}>
          <thead style={{ background: '#f8fafc' }}>
            <tr>
              <th style={{ border: '1px solid #e2e8f0', padding: '10px', textAlign: 'left' }}>Estado</th>
              <th style={{ border: '1px solid #e2e8f0', padding: '10px', textAlign: 'center' }}>Cantidad</th>
              <th style={{ border: '1px solid #e2e8f0', padding: '10px', textAlign: 'center' }}>Distribución</th>
            </tr>
          </thead>
          <tbody>
            {eventSummary.map((row, i) => (
              <tr key={i}>
                <td style={{ border: '1px solid #e2e8f0', padding: '10px' }}>{row.estado}</td>
                <td style={{ border: '1px solid #e2e8f0', padding: '10px', textAlign: 'center' }}>{row.cantidad}</td>
                <td style={{ border: '1px solid #e2e8f0', padding: '10px', textAlign: 'center' }}>{row.porcentaje}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Tabla 2 */}
      <div>
        <h3 style={{ fontSize: '14px', color: '#64748b', textTransform: 'uppercase', marginBottom: '10px' }}>Ocupación Mensual por Salón</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #e2e8f0' }}>
          <thead style={{ background: '#f8fafc' }}>
            <tr>
              <th style={{ border: '1px solid #e2e8f0', padding: '10px', textAlign: 'left' }}>Salón</th>
              <th style={{ border: '1px solid #e2e8f0', padding: '10px', textAlign: 'center' }}>Eventos Registrados</th>
              <th style={{ border: '1px solid #e2e8f0', padding: '10px', textAlign: 'center' }}>Días Disponibles</th>
            </tr>
          </thead>
          <tbody>
            {salonOccupancy.map((row, i) => (
              <tr key={i}>
                <td style={{ border: '1px solid #e2e8f0', padding: '10px' }}>{row.salon}</td>
                <td style={{ border: '1px solid #e2e8f0', padding: '10px', textAlign: 'center' }}>{row.eventos}</td>
                <td style={{ border: '1px solid #e2e8f0', padding: '10px', textAlign: 'center' }}>{row.diasLibres}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: '40px', fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>
        * Este reporte se genera automáticamente basado en los datos actuales del sistema.
      </div>

    </div>
  );
}
