

export default function DashboardGrid({ children, columns = 4 }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
      gap: '16px',
      alignItems: 'stretch',
    }}>
      {children}
    </div>
  );
}
