import './LoadingSpinner.css';

export default function LoadingSpinner({ mensaje = 'Espere...' }) {
  return (
    <div className="loading-overlay">
      <div className="loading-spinner">
        <svg className="loading-circle" viewBox="0 0 50 50">
          <circle className="loading-track" cx="25" cy="25" r="20" fill="none" strokeWidth="4" />
          <circle className="loading-dash" cx="25" cy="25" r="20" fill="none" strokeWidth="4" />
        </svg>
        <p className="loading-mensaje">{mensaje}</p>
      </div>
    </div>
  );
}
