import React from 'react';

export default function DashboardGrid({ children }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
      gap: '14px',
      alignItems: 'stretch',
    }}>
      {children}
    </div>
  );
}