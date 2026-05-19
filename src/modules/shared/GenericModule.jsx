import React from 'react';

const GenericModule = ({ title, description }) => {
  return (
    <div style={{ 
      padding: '40px', 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      height: '100%',
      color: '#64748b',
      background: '#f8fafc',
      borderRadius: '12px',
      border: '1px solid #d3e4fe',
      textAlign: 'center'
    }}>
      <div style={{ fontSize: '48px', marginBottom: '20px' }}>🚧</div>
      <h2 style={{ color: '#1e293b', fontSize: '24px', fontWeight: '800', marginBottom: '10px' }}>{title}</h2>
      <p style={{ fontSize: '16px', maxWidth: '400px' }}>{description || "Estamos migrando esta sección a la nueva arquitectura. Estará disponible muy pronto."}</p>
    </div>
  );
};

export const CustomersModule = () => <GenericModule title="Clientes Potenciales" description="Aquí podrás gestionar todos tus prospectos y cotizaciones." />;
export const ReportsModule = () => <GenericModule title="Reportes y Estadísticas" description="Visualiza el rendimiento de tus eventos y salones en tiempo real." />;
export const SupportModule = () => <GenericModule title="Soporte Técnico" description="¿Necesitas ayuda? Nuestro equipo estará listo para asistirte." />;
export const SettingsModule = () => <GenericModule title="Configuración" description="Gestiona las preferencias y ajustes de tu cuenta." />;
export const SearchModule = () => <GenericModule title="Búsqueda Avanzada" description="Encuentra cualquier evento o cliente rápidamente." />;
